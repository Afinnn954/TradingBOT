import fetch from 'node-fetch';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// Konfigurasi logging
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const LOG_LEVEL = process.env.LOG_LEVEL ? LOG_LEVELS[process.env.LOG_LEVEL] : LOG_LEVELS.INFO;
const LOG_FILE = process.env.LOG_FILE || 'trading_bot.log';

// Fungsi logging yang lebih baik
function log(level, message, data = null) {
  if (LOG_LEVELS[level] <= LOG_LEVEL) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    
    if (level === 'ERROR') {
      console.error(logMessage, data || '');
    } else if (level === 'WARN') {
      console.warn(logMessage, data || '');
    } else if (level === 'INFO') {
      console.info(logMessage, data || '');
    } else {
      console.log(logMessage, data || '');
    }
    
    // Simpan log ke file
    try {
      fs.appendFileSync(LOG_FILE, `${logMessage} ${data ? JSON.stringify(data) : ''}\n`);
    } catch (error) {
      console.error(`Failed to write to log file: ${error.message}`);
    }
  }
}

// Validasi konfigurasi
function validateConfig() {
  log('INFO', 'Validating configuration...');
  
  const requiredEnvVars = [
    'BINANCE_API_KEY',
    'BINANCE_SECRET_KEY',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
  
  // Validasi nilai numerik
  const numericVars = [
    'TRADING_AMOUNT',
    'TAKE_PROFIT_PERCENTAGE',
    'STOP_LOSS_PERCENTAGE',
    'PREDICTION_CONFIDENCE_THRESHOLD',
    'CHECK_INTERVAL'
  ];
  
  for (const varName of numericVars) {
    if (process.env[varName] && isNaN(parseFloat(process.env[varName]))) {
      throw new Error(`Environment variable ${varName} must be a number`);
    }
  }
  
  log('INFO', '✅ Configuration validated successfully');
}

// Konfigurasi bot trading dari environment variables
const config = {
  binanceApiKey: process.env.BINANCE_API_KEY,
  binanceSecretKey: process.env.BINANCE_SECRET_KEY,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,
  
  // Setting trading
  tradingAmount: parseFloat(process.env.TRADING_AMOUNT || '0.1'),
  takeProfitPercentage: parseFloat(process.env.TAKE_PROFIT_PERCENTAGE || '2.5'),
  stopLossPercentage: parseFloat(process.env.STOP_LOSS_PERCENTAGE || '1.5'),
  predictionConfidenceThreshold: parseFloat(process.env.PREDICTION_CONFIDENCE_THRESHOLD || '75'),
  checkInterval: parseInt(process.env.CHECK_INTERVAL || (5 * 60 * 1000)), // Default 5 menit
  
  // Daftar koin yang berhubungan dengan BNB untuk dipantau
  tradingPairs: JSON.parse(process.env.TRADING_PAIRS || `[
    { "symbol": "BNBUSDT", "baseAsset": "BNB", "quoteAsset": "USDT" },
    { "symbol": "BTCBNB", "baseAsset": "BTC", "quoteAsset": "BNB" },
    { "symbol": "ETHBNB", "baseAsset": "ETH", "quoteAsset": "BNB" },
    { "symbol": "ADABNB", "baseAsset": "ADA", "quoteAsset": "BNB" },
    { "symbol": "DOGEBNB", "baseAsset": "DOGE", "quoteAsset": "BNB" }
  ]`),
  
  // Saldo awal untuk pelacakan kinerja
  initialBalance: JSON.parse(process.env.INITIAL_BALANCE || '{"BNB": 1.0, "USDT": 1000.0}')
};

// Implementasi rate limiter untuk API Binance
const rateLimiter = {
  lastRequestTime: {},
  minDelay: {
    default: 500,
    '/api/v3/order': 1000,
    '/api/v3/account': 1000,
    '/api/v3/klines': 300
  },
  
  async throttleRequest(endpoint) {
    const now = Date.now();
    const lastTime = this.lastRequestTime[endpoint] || 0;
    const delay = this.minDelay[endpoint] || this.minDelay.default;
    
    const timeToWait = Math.max(0, lastTime + delay - now);
    
    if (timeToWait > 0) {
      log('DEBUG', `Rate limiting: waiting ${timeToWait}ms for ${endpoint}`);
      await new Promise(resolve => setTimeout(resolve, timeToWait));
    }
    
    this.lastRequestTime[endpoint] = Date.now();
  }
};

// Fungsi untuk melakukan fetch dengan retry
async function fetchWithRetry(url, options = {}, maxRetries = 3, initialDelay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      log('WARN', `Attempt ${attempt}/${maxRetries} failed: ${error.message}`);
      lastError = error;
      
      if (attempt < maxRetries) {
        // Exponential backoff
        const backoffDelay = initialDelay * Math.pow(2, attempt - 1);
        log('DEBUG', `Retrying in ${backoffDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
  }
  
  throw lastError;
}

// Variabel untuk melacak status trading dan kinerja
let tradingStatus = {
  activeOrders: [],
  completedOrders: [],
  balance: { ...config.initialBalance },
  performance: {
    totalTrades: 0,
    profitableTrades: 0,
    totalProfitLoss: 0,
    winRate: 0
  },
  lastPerformanceReport: 0
};

// Fungsi untuk membatasi ukuran array (mencegah memory leak)
function limitArraySize(array, maxSize = 100) {
  if (array.length > maxSize) {
    return array.slice(array.length - maxSize);
  }
  return array;
}

// Fungsi untuk menyimpan status trading ke file
function saveStatusToFile() {
  try {
    // Batasi ukuran array sebelum menyimpan
    const statusToSave = {
      ...tradingStatus,
      completedOrders: limitArraySize(tradingStatus.completedOrders)
    };
    
    fs.writeFileSync('trading_status.json', JSON.stringify(statusToSave, null, 2));
    log('DEBUG', 'Trading status saved to file');
  } catch (error) {
    log('ERROR', 'Failed to save trading status to file', error);
  }
}

// Fungsi untuk memuat status trading dari file
function loadStatusFromFile() {
  try {
    if (fs.existsSync('trading_status.json')) {
      const data = fs.readFileSync('trading_status.json', 'utf8');
      tradingStatus = JSON.parse(data);
      log('INFO', 'Trading status loaded from file');
    }
  } catch (error) {
    log('ERROR', 'Failed to load trading status from file', error);
  }
}

// Fungsi untuk mendapatkan data harga dari Binance dengan error handling yang lebih baik
async function getPrice(symbol) {
  try {
    await rateLimiter.throttleRequest('/api/v3/ticker/price');
    
    const data = await fetchWithRetry(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    return parseFloat(data.price);
  } catch (error) {
    log('ERROR', `Error fetching ${symbol} price:`, error);
    await sendTelegramNotification(`❌ Error fetching ${symbol} price: ${error.message}`);
    return null;
  }
}

// Fungsi untuk mendapatkan data historis untuk analisis dengan error handling yang lebih baik
async function getHistoricalData(symbol, interval = '1h', limit = 24) {
  try {
    await rateLimiter.throttleRequest('/api/v3/klines');
    
    const data = await fetchWithRetry(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
    );
    
    // Format data untuk analisis
    return data.map(candle => ({
      timestamp: candle[0],
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5])
    }));
  } catch (error) {
    log('ERROR', `Error fetching historical data for ${symbol}:`, error);
    return [];
  }
}

// Fungsi untuk menghitung indikator teknis
const technicalIndicators = {
  // RSI (Relative Strength Index)
  calculateRSI: (data, period = 14) => {
    if (data.length < period + 1) {
      return 50;
    }
    
    let gains = 0;
    let losses = 0;
    
    for (let i = data.length - period; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      if (change >= 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }
    
    if (losses === 0) return 100;
    
    const rs = gains / losses;
    return 100 - (100 / (1 + rs));
  },
  
  // SMA (Simple Moving Average)
  calculateSMA: (data, period = 20) => {
    if (data.length < period) {
      return data[data.length - 1].close;
    }
    
    let sum = 0;
    for (let i = data.length - period; i < data.length; i++) {
      sum += data[i].close;
    }
    
    return sum / period;
  },
  
  // EMA (Exponential Moving Average)
  calculateEMA: (data, period = 20) => {
    if (data.length < period) {
      return data[data.length - 1].close;
    }
    
    const prices = data.map(d => d.close);
    const k = 2 / (period + 1);
    
    // Mulai dengan SMA
    let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
    
    // Hitung EMA
    for (let i = period; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    
    return ema;
  },
  
  // MACD (Moving Average Convergence Divergence)
  calculateMACD: (data) => {
    const shortPeriod = 12;
    const longPeriod = 26;
    const signalPeriod = 9;
    
    if (data.length < longPeriod) {
      return { macd: 0, signal: 0, histogram: 0, previousHistogram: 0 };
    }
    
    const prices = data.map(d => d.close);
    
    // Hitung EMA
    const calculateEMA = (prices, period) => {
      const k = 2 / (period + 1);
      let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
      
      for (let i = period; i < prices.length; i++) {
        ema = prices[i] * k + ema * (1 - k);
      }
      
      return ema;
    };
    
    const shortEMA = calculateEMA(prices, shortPeriod);
    const longEMA = calculateEMA(prices, longPeriod);
    
    const macd = shortEMA - longEMA;
    
    // Hitung signal line (EMA dari MACD)
    const macdValues = [];
    for (let i = 0; i < prices.length - longPeriod + 1; i++) {
      const shortEMA = calculateEMA(prices.slice(0, longPeriod + i), shortPeriod);
      const longEMA = calculateEMA(prices.slice(0, longPeriod + i), longPeriod);
      macdValues.push(shortEMA - longEMA);
    }
    
    const signal = calculateEMA(macdValues, signalPeriod);
    const histogram = macd - signal;
    
    // Dapatkan histogram sebelumnya untuk mendeteksi perubahan
    let previousHistogram = 0;
    if (macdValues.length >= 2) {
      const prevMacd = macdValues[macdValues.length - 2];
      const prevSignal = calculateEMA(macdValues.slice(0, -1), signalPeriod);
      previousHistogram = prevMacd - prevSignal;
    }
    
    return { macd, signal, histogram, previousHistogram };
  },
  
  // Analisis volume
  analyzeVolume: (data) => {
    if (data.length < 10) {
      return { trend: 'neutral', changePercent: 0 };
    }
    
    const recentVolumes = data.slice(-5).map(d => d.volume);
    const avgRecentVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
    const prevVolumes = data.slice(-10, -5).map(d => d.volume);
    const avgPrevVolume = prevVolumes.reduce((a, b) => a + b, 0) / prevVolumes.length;
    
    return {
      trend: avgRecentVolume > avgPrevVolume ? 'increasing' : 'decreasing',
      changePercent: ((avgRecentVolume - avgPrevVolume) / avgPrevVolume) * 100
    };
  },
  
  // Bollinger Bands
  calculateBollingerBands: (data, period = 20, multiplier = 2) => {
    if (data.length < period) {
      return { upper: 0, middle: 0, lower: 0 };
    }
    
    const prices = data.slice(-period).map(d => d.close);
    const sma = prices.reduce((a, b) => a + b, 0) / period;
    
    const squaredDifferences = prices.map(price => Math.pow(price - sma, 2));
    const variance = squaredDifferences.reduce((a, b) => a + b, 0) / period;
    const standardDeviation = Math.sqrt(variance);
    
    return {
      upper: sma + (standardDeviation * multiplier),
      middle: sma,
      lower: sma - (standardDeviation * multiplier)
    };
  },
  
  // Stochastic Oscillator
  calculateStochastic: (data, period = 14, smoothK = 3, smoothD = 3) => {
    if (data.length < period) {
      return { k: 50, d: 50 };
    }
    
    // Fungsi untuk mendapatkan nilai tertinggi dan terendah dalam periode
    const getHighLow = (data, period) => {
      const slice = data.slice(-period);
      const high = Math.max(...slice.map(d => d.high));
      const low = Math.min(...slice.map(d => d.low));
      return { high, low };
    };
    
    // Hitung %K raw
    const { high, low } = getHighLow(data, period);
    const close = data[data.length - 1].close;
    
    if (high === low) {
      return { k: 50, d: 50 };
    }
    
    const kRaw = ((close - low) / (high - low)) * 100;
    
    // Smooth %K dengan SMA
    const kValues = [];
    for (let i = 0; i < smoothK; i++) {
      if (data.length > period + i) {
        const dataSlice = data.slice(0, data.length - i);
        const { high, low } = getHighLow(dataSlice, period);
        const closeValue = dataSlice[dataSlice.length - 1].close;
        if (high !== low) {
          kValues.push(((closeValue - low) / (high - low)) * 100);
        } else {
          kValues.push(50);
        }
      } else {
        kValues.push(50);
      }
    }
    
    const k = kValues.reduce((a, b) => a + b, 0) / kValues.length;
    
    // Hitung %D (SMA dari %K)
    const dValues = [];
    for (let i = 0; i < smoothD; i++) {
      if (kValues.length > i) {
        dValues.push(kValues[i]);
      } else {
        dValues.push(50);
      }
    }
    
    const d = dValues.reduce((a, b) => a + b, 0) / dValues.length;
    
    return { k, d };
  }
};

// Fungsi untuk memprediksi pergerakan harga dengan indikator yang lebih akurat
function predictPriceMovement(symbol, historicalData) {
  if (!historicalData || historicalData.length < 30) {
    return { prediction: 'HOLD', confidence: 0 };
  }
  
  // Hitung semua indikator
  const rsi = technicalIndicators.calculateRSI(historicalData);
  const sma = technicalIndicators.calculateSMA(historicalData);
  const ema9 = technicalIndicators.calculateEMA(historicalData, 9);
  const ema21 = technicalIndicators.calculateEMA(historicalData, 21);
  const macd = technicalIndicators.calculateMACD(historicalData);
  const volume = technicalIndicators.analyzeVolume(historicalData);
  const bollingerBands = technicalIndicators.calculateBollingerBands(historicalData);
  const stochastic = technicalIndicators.calculateStochastic(historicalData);
  
  const currentPrice = historicalData[historicalData.length - 1].close;
  
  // Sistem scoring yang lebih kompleks dengan bobot
  let bullishScore = 0;
  let bearishScore = 0;
  let totalWeight = 0;
  
  // RSI (weight: 2)
  totalWeight += 2;
  if (rsi < 30) bullishScore += 2; // Oversold
  else if (rsi > 70) bearishScore += 2; // Overbought
  
  // EMA Cross (weight: 3)
  totalWeight += 3;
  if (ema9 > ema21) bullishScore += 3; // Golden cross
  else if (ema9 < ema21) bearishScore += 3; // Death cross
  
  // MACD (weight: 2.5)
  totalWeight += 2.5;
  if (macd.histogram > 0 && macd.histogram > macd.previousHistogram) bullishScore += 2.5; // Bullish momentum
  else if (macd.histogram < 0 && macd.histogram < macd.previousHistogram) bearishScore += 2.5; // Bearish momentum
  
  // Volume (weight: 1.5)
  totalWeight += 1.5;
  if (volume.trend === 'increasing' && currentPrice > sma) bullishScore += 1.5; // Increasing volume in uptrend
  else if (volume.trend === 'increasing' && currentPrice < sma) bearishScore += 1.5; // Increasing volume in downtrend
  
  // Bollinger Bands (weight: 2)
  totalWeight += 2;
  if (currentPrice < bollingerBands.lower) bullishScore += 2; // Price below lower band (potential reversal up)
  else if (currentPrice > bollingerBands.upper) bearishScore += 2; // Price above upper band (potential reversal down)
  
  // Stochastic (weight: 2)
  totalWeight += 2;
  if (stochastic.k < 20 && stochastic.k > stochastic.d) bullishScore += 2; // Oversold and %K crossing above %D
  else if (stochastic.k > 80 && stochastic.k < stochastic.d) bearishScore += 2; // Overbought and %K crossing below %D
  
  // Tentukan prediksi dan confidence
  let prediction = 'HOLD';
  let confidence = 0;
  
  if (bullishScore > bearishScore) {
    prediction = 'BUY';
    confidence = (bullishScore / totalWeight) * 100;
  } else if (bearishScore > bullishScore) {
    prediction = 'SELL';
    confidence = (bearishScore / totalWeight) * 100;
  }
  
  return {
    symbol,
    prediction,
    confidence,
    currentPrice,
    indicators: {
      rsi,
      sma,
      ema: { ema9, ema21 },
      macd: {
        value: macd.macd,
        signal: macd.signal,
        histogram: macd.histogram,
        trend: macd.histogram > 0 ? 'bullish' : 'bearish'
      },
      volume: volume.trend,
      bollingerBands,
      stochastic
    },
    takeProfitPrice: prediction === 'BUY' ? currentPrice * (1 + config.takeProfitPercentage / 100) : null,
    stopLossPrice: prediction === 'BUY' ? currentPrice * (1 - config.stopLossPercentage / 100) : null
  };
}

// Fungsi untuk mengirim notifikasi ke Telegram dengan retry
async function sendTelegramNotification(message, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: config.telegramChatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Telegram API error: ${errorData.description || response.statusText}`);
      }
      
      const data = await response.json();
      if (data.ok) {
        log('DEBUG', 'Telegram notification sent successfully');
        return true;
      }
    } catch (error) {
      log('ERROR', `Attempt ${attempt} to send Telegram notification failed`, error);
      
      if (attempt < retries) {
        // Tunggu sebelum mencoba lagi
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      } else {
        log('ERROR', 'All attempts to send Telegram notification failed', { message });
        return false;
      }
    }
  }
}

// Fungsi untuk membuat signature untuk API Binance
function createBinanceSignature(queryString) {
  return crypto
    .createHmac('sha256', config.binanceSecretKey)
    .update(queryString)
    .digest('hex');
}

// Fungsi untuk memeriksa saldo di Binance
async function checkBalance(asset) {
  try {
    await rateLimiter.throttleRequest('/api/v3/account');
    
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = createBinanceSignature(queryString);
    
    const data = await fetchWithRetry(
      `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`,
      {
        headers: {
          'X-MBX-APIKEY': config.binanceApiKey
        }
      }
    );
    
    const balance = data.balances.find(b => b.asset === asset);
    return balance ? parseFloat(balance.free) : 0;
  } catch (error) {
    log('ERROR', `Error checking balance for ${asset}:`, error);
    await sendTelegramNotification(`❌ Error checking balance for ${asset}: ${error.message}`);
    return 0;
  }
}

// Fungsi untuk melakukan order di Binance dengan error handling yang lebih baik
async function placeBinanceOrder(symbol, side, quantity, price) {
  try {
    await rateLimiter.throttleRequest('/api/v3/order');
    
    const timestamp = Date.now();
    const queryString = `symbol=${symbol}&side=${side}&type=LIMIT&timeInForce=GTC&quantity=${quantity}&price=${price}&timestamp=${timestamp}`;
    const signature = createBinanceSignature(queryString);
    
    const data = await fetchWithRetry(
      `https://api.binance.com/api/v3/order?${queryString}&signature=${signature}`,
      {
        method: 'POST',
        headers: {
          'X-MBX-APIKEY': config.binanceApiKey
        }
      }
    );
    
    log('INFO', `${side} order placed for ${symbol}:`, data);
    
    // Tambahkan order ke status trading
    if (data.orderId) {
      const order = {
        id: data.orderId,
        symbol,
        side,
        quantity: parseFloat(quantity),
        price: parseFloat(price),
        status: 'ACTIVE',
        timestamp: Date.now(),
        takeProfitPrice: side === 'BUY' ? parseFloat(price) * (1 + config.takeProfitPercentage / 100) : null,
        stopLossPrice: side === 'BUY' ? parseFloat(price) * (1 - config.stopLossPercentage / 100) : null
      };
      
      tradingStatus.activeOrders.push(order);
      tradingStatus.performance.totalTrades++;
      
      // Simpan status trading ke file
      saveStatusToFile();
    }
    
    return data;
  } catch (error) {
    log('ERROR', `Error placing ${side} order for ${symbol}:`, error);
    await sendTelegramNotification(`❌ Error placing ${side} order for ${symbol}: ${error.message}`);
    return null;
  }
}

// Fungsi untuk memeriksa status order dan memperbarui saldo
async function checkOrderStatus() {
  for (let i = 0; i < tradingStatus.activeOrders.length; i++) {
    const order = tradingStatus.activeOrders[i];
    
    try {
      await rateLimiter.throttleRequest('/api/v3/order');
      
      const timestamp = Date.now();
      const queryString = `symbol=${order.symbol}&orderId=${order.id}&timestamp=${timestamp}`;
      const signature = createBinanceSignature(queryString);
      
      const data = await fetchWithRetry(
        `https://api.binance.com/api/v3/order?${queryString}&signature=${signature}`,
        {
          method: 'GET',
          headers: {
            'X-MBX-APIKEY': config.binanceApiKey
          }
        }
      );
      
      if (data.status === 'FILLED' && order.status !== 'COMPLETED') {
        // Order telah diisi, perbarui status
        order.status = 'COMPLETED';
        order.filledTime = Date.now();
        
        // Perbarui saldo
        const [baseAsset, quoteAsset] = order.symbol.replace('BNB', '').length > 0 
          ? [order.symbol.replace('BNB', ''), 'BNB'] 
          : ['BNB', order.symbol.replace('BNB', '')];
        
        if (order.side === 'BUY') {
          tradingStatus.balance[baseAsset] = (tradingStatus.balance[baseAsset] || 0) + order.quantity;
          tradingStatus.balance[quoteAsset] -= order.quantity * order.price;
        } else {
          tradingStatus.balance[baseAsset] = (tradingStatus.balance[baseAsset] || 0) - order.quantity;
          tradingStatus.balance[quoteAsset] += order.quantity * order.price;
        }
        
        // Pindahkan dari active ke completed
        tradingStatus.completedOrders.push(order);
        tradingStatus.activeOrders.splice(i, 1);
        i--; // Sesuaikan indeks karena kita menghapus elemen
        
        // Batasi ukuran array completedOrders
        tradingStatus.completedOrders = limitArraySize(tradingStatus.completedOrders);
        
        // Simpan status trading ke file
        saveStatusToFile();
        
        // Kirim notifikasi
        const orderCompletedMessage = `
🔄 <b>Order Completed</b>
Symbol: ${order.symbol}
Side: ${order.side}
Quantity: ${order.quantity}
Price: $${order.price}
Total: $${(order.quantity * order.price).toFixed(2)}
        `;
        
        await sendTelegramNotification(orderCompletedMessage);
      }
    } catch (error) {
      log('ERROR', `Error checking order status for ${order.symbol}:`, error);
    }
  }
}

// Fungsi untuk memeriksa take profit dan stop loss dengan error handling yang lebih baik
async function checkTakeProfitStopLoss() {
  for (const order of tradingStatus.activeOrders) {
    if (order.side === 'BUY' && order.status === 'COMPLETED') {
      try {
        // Dapatkan harga saat ini
        const currentPrice = await getPrice(order.symbol);
        
        if (!currentPrice) continue;
        
        // Periksa take profit
        if (currentPrice >= order.takeProfitPrice) {
          log('INFO', `Take profit triggered for ${order.symbol} at $${currentPrice}`);
          
          // Periksa saldo sebelum melakukan SELL
          const baseAsset = order.symbol.replace('USDT', '').replace('BNB', '');
          const balance = await checkBalance(baseAsset);
          
          if (balance < order.quantity) {
            log('WARN', `Insufficient balance for take profit: ${balance} ${baseAsset} < ${order.quantity} ${baseAsset}`);
            await sendTelegramNotification(`⚠️ Insufficient balance for take profit on ${order.symbol}`);
            continue;
          }
          
          // Eksekusi SELL untuk take profit
          const sellResult = await placeBinanceOrder(order.symbol, 'SELL', order.quantity.toFixed(6), currentPrice.toFixed(8));
          
          if (sellResult && sellResult.orderId) {
            // Hitung profit
            const profit = (currentPrice - order.price) * order.quantity;
            const profitPercentage = ((currentPrice - order.price) / order.price) * 100;
            
            // Perbarui statistik kinerja
            tradingStatus.performance.profitableTrades++;
            tradingStatus.performance.totalProfitLoss += profit;
            tradingStatus.performance.winRate = (tradingStatus.performance.profitableTrades / tradingStatus.performance.totalTrades) * 100;
            
            // Simpan status trading ke file
            saveStatusToFile();
            
            // Kirim notifikasi take profit
            const takeProfitMessage = `
💰 <b>Take Profit Executed</b>
Symbol: ${order.symbol}
Quantity: ${order.quantity}
Entry Price: $${order.price}
Exit Price: $${currentPrice}
Profit: $${profit.toFixed(2)} (${profitPercentage.toFixed(2)}%)

<b>Performance Summary:</b>
Total Trades: ${tradingStatus.performance.totalTrades}
Win Rate: ${tradingStatus.performance.winRate.toFixed(2)}%
Total P/L: $${tradingStatus.performance.totalProfitLoss.toFixed(2)}
            `;
            
            await sendTelegramNotification(takeProfitMessage);
          }
        }
        
        // Periksa stop loss
        else if (currentPrice <= order.stopLossPrice) {
          log('INFO', `Stop loss triggered for ${order.symbol} at $${currentPrice}`);
          
          // Periksa saldo sebelum melakukan SELL
          const baseAsset = order.symbol.replace('USDT', '').replace('BNB', '');
          const balance = await checkBalance(baseAsset);
          
          if (balance < order.quantity) {
            log('WARN', `Insufficient balance for stop loss: ${balance} ${baseAsset} < ${order.quantity} ${baseAsset}`);
            await sendTelegramNotification(`⚠️ Insufficient balance for stop loss on ${order.symbol}`);
            continue;
          }
          
          // Eksekusi SELL untuk stop loss
          const sellResult = await placeBinanceOrder(order.symbol, 'SELL', order.quantity.toFixed(6), currentPrice.toFixed(8));
          
          if (sellResult && sellResult.orderId) {
            // Hitung loss
            const loss = (order.price - currentPrice) * order.quantity;
            const lossPercentage = ((order.price - currentPrice) / order.price) * 100;
            
            // Perbarui statistik kinerja
            tradingStatus.performance.totalProfitLoss -= loss;
            tradingStatus.performance.winRate = (tradingStatus.performance.profitableTrades / tradingStatus.performance.totalTrades) * 100;
            
            // Simpan status trading ke file
            saveStatusToFile();
            
            // Kirim notifikasi stop loss
            const stopLossMessage = `
🛑 <b>Stop Loss Triggered</b>
Symbol: ${order.symbol}
Quantity: ${order.quantity}
Entry Price: $${order.price}
Exit Price: $${currentPrice}
Loss: $${loss.toFixed(2)} (${lossPercentage.toFixed(2)}%)

<b>Performance Summary:</b>
Total Trades: ${tradingStatus.performance.totalTrades}
Win Rate: ${tradingStatus.performance.winRate.toFixed(2)}%
Total P/L: $${tradingStatus.performance.totalProfitLoss.toFixed(2)}
            `;
            
            await sendTelegramNotification(stopLossMessage);
          }
        }
      } catch (error) {
        log('ERROR', `Error processing take profit/stop loss for ${order.symbol}:`, error);
      }
    }
  }
}

// Fungsi untuk memperbarui saldo dari Binance
async function updateBalances() {
  try {
    await rateLimiter.throttleRequest('/api/v3/account');
    
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = createBinanceSignature(queryString);
    
    const data = await fetchWithRetry(
      `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`,
      {
        headers: {
          'X-MBX-APIKEY': config.binanceApiKey
        }
      }
    );
    
    // Perbarui saldo untuk semua aset yang diperlukan
    const balances = {};
    for (const balance of data.balances) {
      if (parseFloat(balance.free) > 0 || parseFloat(balance.locked) > 0) {
        balances[balance.asset] = parseFloat(balance.free) + parseFloat(balance.locked);
      }
    }
    
    // Perbarui saldo di tradingStatus
    for (const [asset, amount] of Object.entries(balances)) {
      tradingStatus.balance[asset] = amount;
    }
    
    log('INFO', 'Balances updated from Binance');
    return balances;
  } catch (error) {
    log('ERROR', 'Failed to update balances from Binance', error);
    return null;
  }
}

// Fungsi untuk mengirim laporan saldo dan kinerja
async function sendPerformanceReport(force = false) {
  // Jika tidak dipaksa, periksa apakah sudah waktunya untuk laporan (setiap 6 jam)
  if (!force) {
    const now = Date.now();
    const sixHoursInMs = 6 * 60 * 60 * 1000;
    
    if (now - tradingStatus.lastPerformanceReport < sixHoursInMs) {
      return;
    }
  }
  
  try {
    // Perbarui saldo dari Binance
    await updateBalances();
    
    // Dapatkan harga saat ini untuk semua aset
    const prices = {};
    for (const pair of config.tradingPairs) {
      prices[pair.symbol] = await getPrice(pair.symbol);
    }
    
    // Hitung nilai saldo dalam USDT
    let totalBalanceUSDT = 0;
    const balanceDetails = [];
    
    for (const [asset, amount] of Object.entries(tradingStatus.balance)) {
      let valueUSDT = 0;
      
      if (asset === 'USDT') {
        valueUSDT = amount;
      } else {
        const price = prices[`${asset}USDT`] || prices[`USDT${asset}`];
        if (price) {
          valueUSDT = amount * price;
        }
      }
      
      totalBalanceUSDT += valueUSDT;
      balanceDetails.push(`${asset}: ${amount.toFixed(6)} (≈$${valueUSDT.toFixed(2)})`);
    }
    
    // Buat laporan kinerja
    const performanceReport = `
📊 <b>Performance Report</b>

<b>Current Balance:</b>
${balanceDetails.join('\n')}
Total Value: $${totalBalanceUSDT.toFixed(2)}

<b>Trading Performance:</b>
Total Trades: ${tradingStatus.performance.totalTrades}
Profitable Trades: ${tradingStatus.performance.profitableTrades}
Win Rate: ${tradingStatus.performance.winRate.toFixed(2)}%
Total Profit/Loss: $${tradingStatus.performance.totalProfitLoss.toFixed(2)}

<b>Active Orders:</b> ${tradingStatus.activeOrders.length}
<b>Completed Orders:</b> ${tradingStatus.completedOrders.length}

<b>Bot Status:</b> Running since ${new Date(tradingStatus.startTime).toLocaleString()}
    `;
    
    await sendTelegramNotification(performanceReport);
    
    // Perbarui waktu laporan terakhir
    tradingStatus.lastPerformanceReport = Date.now();
    
    // Simpan status trading ke file
    saveStatusToFile();
    
    log('INFO', 'Performance report sent');
  } catch (error) {
    log('ERROR', 'Failed to send performance report', error);
  }
}

// Fungsi untuk menangani shutdown dengan baik
function setupGracefulShutdown() {
  async function shutdown(signal) {
    log('INFO', `Received ${signal}, shutting down gracefully...`);
    
    // Kirim notifikasi ke Telegram
    await sendTelegramNotification(`🛑 <b>Bot shutting down</b>\nReason: ${signal}`);
    
    // Simpan status trading ke file
    saveStatusToFile();
    
    // Tunggu beberapa detik untuk memastikan notifikasi terkirim dan file tersimpan
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Keluar dengan kode sukses
    process.exit(0);
  }
  
  // Tangkap sinyal untuk shutdown
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  
  // Tangkap uncaught exceptions
  process.on('uncaughtException', async (error) => {
    log('ERROR', 'Uncaught exception', error);
    await sendTelegramNotification(`❌ <b>Bot crashed</b>\nError: ${error.message}`);
    process.exit(1);
  });
  
  // Tangkap unhandled promise rejections
  process.on('unhandledRejection', async (reason, promise) => {
    log('ERROR', 'Unhandled promise rejection', { reason });
    await sendTelegramNotification(`❌ <b>Unhandled promise rejection</b>\nReason: ${reason}`);
  });
}

// Fungsi utama untuk menjalankan bot trading
async function runTradingBot() {
  try {
    // Validasi konfigurasi
    validateConfig();
    
    // Setup graceful shutdown
    setupGracefulShutdown();
    
    // Muat status trading dari file jika ada
    loadStatusFromFile();
    
    // Set waktu mulai
    tradingStatus.startTime = Date.now();
    
    log('INFO', 'Starting Enhanced BNB Trading Bot...');
    
    // Kirim notifikasi bahwa bot telah dimulai dengan semua setting
    const startupMessage = `
🤖 <b>BNB Trading Bot Started</b>

<b>Trading Settings:</b>
Trading Amount: ${config.tradingAmount} BNB
Take Profit: ${config.takeProfitPercentage}%
Stop Loss: ${config.stopLossPercentage}%
Confidence Threshold: ${config.predictionConfidenceThreshold}%
Check Interval: ${config.checkInterval / 60000} minutes

<b>Trading Pairs:</b>
${config.tradingPairs.map(pair => pair.symbol).join(', ')}

<b>Initial Balance:</b>
${Object.entries(config.initialBalance).map(([asset, amount]) => `${asset}: ${amount}`).join(', ')}

Bot akan memantau harga dan melakukan trading otomatis berdasarkan sinyal.
    `;
    
    await sendTelegramNotification(startupMessage);
    
    // Perbarui saldo dari Binance
    await updateBalances();
    
    // Jalankan loop untuk terus memantau dan trading
    setInterval(async () => {
      try {
        // Periksa status order yang ada
        await checkOrderStatus();
        
        // Periksa take profit dan stop loss
        await checkTakeProfitStopLoss();
        
        // Analisis semua pasangan trading
        for (const pair of config.tradingPairs) {
          try {
            // Dapatkan data historis
            const historicalData = await getHistoricalData(pair.symbol);
            if (!historicalData || historicalData.length === 0) {
              log('WARN', `No historical data available for ${pair.symbol}, skipping`);
              continue;
            }
            
            // Dapatkan harga saat ini
            const currentPrice = await getPrice(pair.symbol);
            if (!currentPrice) {
              log('WARN', `Could not get current price for ${pair.symbol}, skipping`);
              continue;
            }
            
            // Buat prediksi
            const prediction = predictPriceMovement(pair.symbol, historicalData);
            log('INFO', `Prediction for ${pair.symbol}:`, prediction);
            
            // Kirim notifikasi prediksi ke Telegram
            const predictionMessage = `
🔮 <b>${pair.symbol} Prediction Update</b>
Current Price: $${currentPrice}
Signal: ${prediction.prediction === 'BUY' ? '🟢 BUY' : prediction.prediction === 'SELL' ? '🔴 SELL' : '⚪ HOLD'}
Confidence: ${prediction.confidence.toFixed(2)}%

<b>Indicators:</b>
RSI: ${prediction.indicators.rsi.toFixed(2)}
SMA: $${prediction.indicators.sma.toFixed(2)}
EMA: 9-period $${prediction.indicators.ema.ema9.toFixed(2)}, 21-period $${prediction.indicators.ema.ema21.toFixed(2)}
MACD: ${prediction.indicators.macd.trend} (${prediction.indicators.macd.histogram.toFixed(4)})
Volume: ${prediction.indicators.volume}
Bollinger Bands:
  - Upper: $${prediction.indicators.bollingerBands.upper.toFixed(2)}
  - Middle: $${prediction.indicators.bollingerBands.middle.toFixed(2)}
  - Lower: $${prediction.indicators.bollingerBands.lower.toFixed(2)}
Stochastic: %K ${prediction.indicators.stochastic.k.toFixed(2)}, %D ${prediction.indicators.stochastic.d.toFixed(2)}

${prediction.prediction === 'BUY' ? `<b>Entry Plan:</b>
Take Profit: $${prediction.takeProfitPrice.toFixed(2)} (+${config.takeProfitPercentage}%)
Stop Loss: $${prediction.stopLossPrice.toFixed(2)} (-${config.stopLossPercentage}%)` : ''}
            `;
            
            await sendTelegramNotification(predictionMessage);
            
            // Jika confidence melebihi threshold, lakukan trading
            if (prediction.confidence >= config.predictionConfidenceThreshold) {
              if (prediction.prediction === 'BUY') {
                // Hitung jumlah yang akan dibeli
                let quantity = config.tradingAmount;
                
                // Jika bukan BNB, konversi jumlah
                if (pair.symbol !== 'BNBUSDT' && pair.symbol !== 'BNBBUSD') {
                  // Untuk pasangan seperti BTCBNB, kita perlu menyesuaikan jumlah
                  if (pair.quoteAsset === 'BNB') {
                    quantity = config.tradingAmount / currentPrice;
                  }
                }
                
                // Periksa saldo sebelum melakukan BUY
                const quoteAsset = pair.quoteAsset;
                const requiredBalance = quantity * currentPrice;
                const actualBalance = await checkBalance(quoteAsset);
                
                if (actualBalance < requiredBalance) {
                  log('WARN', `Insufficient ${quoteAsset} balance for BUY: ${actualBalance} < ${requiredBalance}`);
                  await sendTelegramNotification(`⚠️ <b>Insufficient Balance</b>\nCannot buy ${pair.symbol}: need ${requiredBalance} ${quoteAsset}, have ${actualBalance} ${quoteAsset}`);
                  continue;
                }
                
                // Lakukan order BUY
                const orderResult = await placeBinanceOrder(pair.symbol, 'BUY', quantity.toFixed(6), currentPrice.toFixed(8));
                
                if (orderResult && orderResult.orderId) {
                  // Kirim notifikasi order berhasil
                  const orderMessage = `
🟢 <b>BUY Order Executed</b>
Symbol: ${pair.symbol}
Amount: ${quantity.toFixed(6)} ${pair.baseAsset}
Price: $${currentPrice}
Total: $${(currentPrice * quantity).toFixed(2)}

Take Profit: $${prediction.takeProfitPrice.toFixed(2)}
Stop Loss: $${prediction.stopLossPrice.toFixed(2)}

Order ID: ${orderResult.orderId}
                  `;
                  
                  await sendTelegramNotification(orderMessage);
                }
              } else if (prediction.prediction === 'SELL') {
                // Periksa apakah kita memiliki aset untuk dijual
                const assetToSell = pair.baseAsset;
                const balance = await checkBalance(assetToSell);
                
                if (balance <= 0) {
                  log('WARN', `No ${assetToSell} balance to sell`);
                  await sendTelegramNotification(`⚠️ <b>SELL Signal for ${pair.symbol}</b> but no ${assetToSell} balance to sell`);
                  continue;
                }
                
                const quantity = Math.min(balance, config.tradingAmount);
                
                // Lakukan order SELL
                const orderResult = await placeBinanceOrder(pair.symbol, 'SELL', quantity.toFixed(6), currentPrice.toFixed(8));
                
                if (orderResult && orderResult.orderId) {
                  // Kirim notifikasi order berhasil
                  const orderMessage = `
🔴 <b>SELL Order Executed</b>
Symbol: ${pair.symbol}
Amount: ${quantity.toFixed(6)} ${pair.baseAsset}
Price: $${currentPrice}
Total: $${(currentPrice * quantity).toFixed(2)}

Order ID: ${orderResult.orderId}
                  `;
                  
                  await sendTelegramNotification(orderMessage);
                }
              }
            }
          } catch (error) {
            log('ERROR', `Error processing trading pair ${pair.symbol}:`, error);
          }
        }
        
        // Kirim laporan kinerja setiap 6 jam
        const now = new Date();
        if (now.getHours() % 6 === 0 && now.getMinutes() < 5) {
          await sendPerformanceReport();
        }
        
      } catch (error) {
        log('ERROR', 'Error in trading bot main loop:', error);
        await sendTelegramNotification(`❌ <b>Error in Trading Bot</b>\n${error.message}`);
      }
    }, config.checkInterval);
    
    log('INFO', `Bot is running and will check for trading opportunities every ${config.checkInterval / 60000} minutes`);
  } catch (error) {
    log('ERROR', 'Failed to start trading bot:', error);
    console.error('Failed to start trading bot:', error);
    process.exit(1);
  }
}

// Jalankan bot
runTradingBot();