import fetch from 'node-fetch';
import crypto from 'crypto';

// Konfigurasi bot trading
const config = {
  binanceApiKey: 'YOUR_BINANCE_API_KEY',
  binanceSecretKey: 'YOUR_BINANCE_SECRET_KEY',
  telegramBotToken: 'YOUR_TELEGRAM_BOT_TOKEN',
  telegramChatId: 'YOUR_TELEGRAM_CHAT_ID',
  
  // Setting trading sesuai permintaan
  tradingAmount: 0.1,
  takeProfitPercentage: 2.5,
  stopLossPercentage: 1.5,
  predictionConfidenceThreshold: 75,
  checkInterval: 5 * 60 * 1000, // 5 menit
  
  // Daftar koin yang berhubungan dengan BNB untuk dipantau
  tradingPairs: [
    { symbol: 'BNBUSDT', baseAsset: 'BNB', quoteAsset: 'USDT' },
    { symbol: 'BTCBNB', baseAsset: 'BTC', quoteAsset: 'BNB' },
    { symbol: 'ETHBNB', baseAsset: 'ETH', quoteAsset: 'BNB' },
    { symbol: 'ADABNB', baseAsset: 'ADA', quoteAsset: 'BNB' },
    { symbol: 'DOGEBNB', baseAsset: 'DOGE', quoteAsset: 'BNB' }
  ],
  
  // Saldo awal untuk pelacakan kinerja
  initialBalance: {
    BNB: 1.0,
    USDT: 1000.0
  }
};

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
  }
};

// Fungsi untuk mendapatkan data harga dari Binance
async function getPrice(symbol) {
  try {
    const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    const data = await response.json();
    return parseFloat(data.price);
  } catch (error) {
    console.error(`Error fetching ${symbol} price:`, error);
    return null;
  }
}

// Fungsi untuk mendapatkan data historis untuk analisis
async function getHistoricalData(symbol, interval = '1h', limit = 24) {
  try {
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    const data = await response.json();
    
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
    console.error(`Error fetching historical data for ${symbol}:`, error);
    return [];
  }
}

// Fungsi untuk memprediksi pergerakan harga
function predictPriceMovement(symbol, historicalData) {
  if (!historicalData || historicalData.length < 2) {
    return { prediction: 'HOLD', confidence: 0 };
  }
  
  // Analisis teknis
  
  // 1. Hitung RSI (Relative Strength Index)
  const calculateRSI = (data, period = 14) => {
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
  };
  
  // 2. Hitung Moving Average
  const calculateSMA = (data, period = 20) => {
    if (data.length < period) {
      return data[data.length - 1].close;
    }
    
    let sum = 0;
    for (let i = data.length - period; i < data.length; i++) {
      sum += data[i].close;
    }
    
    return sum / period;
  };
  
  // 3. Hitung MACD (Moving Average Convergence Divergence)
  const calculateMACD = (data) => {
    const shortPeriod = 12;
    const longPeriod = 26;
    const signalPeriod = 9;
    
    if (data.length < longPeriod) {
      return { macd: 0, signal: 0, histogram: 0 };
    }
    
    // Hitung EMA (Exponential Moving Average)
    const calculateEMA = (data, period) => {
      const k = 2 / (period + 1);
      let ema = data[0];
      
      for (let i = 1; i < data.length; i++) {
        ema = data[i] * k + ema * (1 - k);
      }
      
      return ema;
    };
    
    const prices = data.map(d => d.close);
    const shortEMA = calculateEMA(prices, shortPeriod);
    const longEMA = calculateEMA(prices, longPeriod);
    
    const macd = shortEMA - longEMA;
    const signal = calculateEMA([...Array(signalPeriod)].map(() => macd), signalPeriod);
    const histogram = macd - signal;
    
    return { macd, signal, histogram };
  };
  
  // 4. Analisis volume
  const analyzeVolume = () => {
    const recentVolumes = historicalData.slice(-5).map(d => d.volume);
    const avgRecentVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
    const prevVolumes = historicalData.slice(-10, -5).map(d => d.volume);
    const avgPrevVolume = prevVolumes.reduce((a, b) => a + b, 0) / prevVolumes.length;
    
    return {
      trend: avgRecentVolume > avgPrevVolume ? 'increasing' : 'decreasing',
      changePercent: ((avgRecentVolume - avgPrevVolume) / avgPrevVolume) * 100
    };
  };
  
  // 5. Analisis Bollinger Bands
  const calculateBollingerBands = (data, period = 20, multiplier = 2) => {
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
  };
  
  // Hitung semua indikator
  const rsi = calculateRSI(historicalData);
  const sma = calculateSMA(historicalData);
  const macd = calculateMACD(historicalData);
  const volume = analyzeVolume();
  const bollingerBands = calculateBollingerBands(historicalData);
  
  const currentPrice = historicalData[historicalData.length - 1].close;
  
  // Logika prediksi berdasarkan indikator
  let bullishSignals = 0;
  let bearishSignals = 0;
  let totalSignals = 0;
  
  // RSI
  totalSignals++;
  if (rsi < 30) bullishSignals += 1; // Oversold
  else if (rsi > 70) bearishSignals += 1; // Overbought
  
  // SMA
  totalSignals++;
  if (currentPrice > sma) bullishSignals += 1; // Harga di atas SMA (uptrend)
  else if (currentPrice < sma) bearishSignals += 1; // Harga di bawah SMA (downtrend)
  
  // MACD
  totalSignals++;
  if (macd.histogram > 0 && macd.histogram > macd.histogram) bullishSignals += 1; // MACD histogram positif dan meningkat
  else if (macd.histogram < 0 && macd.histogram < macd.histogram) bearishSignals += 1; // MACD histogram negatif dan menurun
  
  // Volume
  totalSignals++;
  if (volume.trend === 'increasing' && currentPrice > sma) bullishSignals += 1; // Volume meningkat dalam uptrend
  else if (volume.trend === 'increasing' && currentPrice < sma) bearishSignals += 1; // Volume meningkat dalam downtrend
  
  // Bollinger Bands
  totalSignals++;
  if (currentPrice < bollingerBands.lower) bullishSignals += 1; // Harga di bawah lower band (potential reversal up)
  else if (currentPrice > bollingerBands.upper) bearishSignals += 1; // Harga di atas upper band (potential reversal down)
  
  // Tentukan prediksi dan confidence
  let prediction = 'HOLD';
  let confidence = 0;
  
  if (bullishSignals > bearishSignals) {
    prediction = 'BUY';
    confidence = (bullishSignals / totalSignals) * 100;
  } else if (bearishSignals > bullishSignals) {
    prediction = 'SELL';
    confidence = (bearishSignals / totalSignals) * 100;
  }
  
  return {
    symbol,
    prediction,
    confidence,
    currentPrice,
    indicators: {
      rsi,
      sma,
      macd: macd.histogram > 0 ? 'bullish' : 'bearish',
      volume: volume.trend,
      bollingerBands: {
        upper: bollingerBands.upper,
        middle: bollingerBands.middle,
        lower: bollingerBands.lower
      }
    },
    takeProfitPrice: prediction === 'BUY' ? currentPrice * (1 + config.takeProfitPercentage / 100) : null,
    stopLossPrice: prediction === 'BUY' ? currentPrice * (1 - config.stopLossPercentage / 100) : null
  };
}

// Fungsi untuk mengirim notifikasi ke Telegram
async function sendTelegramNotification(message) {
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
        parse_mode: 'HTML'
      })
    });
    
    const data = await response.json();
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`);
    }
    
    console.log('Telegram notification sent successfully');
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
  }
}

// Fungsi untuk membuat signature untuk API Binance
function createBinanceSignature(queryString) {
  return crypto
    .createHmac('sha256', config.binanceSecretKey)
    .update(queryString)
    .digest('hex');
}

// Fungsi untuk melakukan order di Binance
async function placeBinanceOrder(symbol, side, quantity, price) {
  try {
    const timestamp = Date.now();
    const queryString = `symbol=${symbol}&side=${side}&type=LIMIT&timeInForce=GTC&quantity=${quantity}&price=${price}&timestamp=${timestamp}`;
    const signature = createBinanceSignature(queryString);
    
    const url = `https://api.binance.com/api/v3/order?${queryString}&signature=${signature}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-MBX-APIKEY': config.binanceApiKey
      }
    });
    
    const data = await response.json();
    console.log(`${side} order placed for ${symbol}:`, data);
    
    // Tambahkan order ke status trading
    if (data.orderId) {
      const order = {
        id: data.orderId,
        symbol,
        side,
        quantity,
        price: parseFloat(price),
        status: 'ACTIVE',
        timestamp: Date.now(),
        takeProfitPrice: side === 'BUY' ? parseFloat(price) * (1 + config.takeProfitPercentage / 100) : null,
        stopLossPrice: side === 'BUY' ? parseFloat(price) * (1 - config.stopLossPercentage / 100) : null
      };
      
      tradingStatus.activeOrders.push(order);
      tradingStatus.performance.totalTrades++;
    }
    
    return data;
  } catch (error) {
    console.error(`Error placing ${side} order for ${symbol}:`, error);
    return null;
  }
}

// Fungsi untuk memeriksa status order dan memperbarui saldo
async function checkOrderStatus() {
  for (let i = 0; i < tradingStatus.activeOrders.length; i++) {
    const order = tradingStatus.activeOrders[i];
    
    try {
      const timestamp = Date.now();
      const queryString = `symbol=${order.symbol}&orderId=${order.id}&timestamp=${timestamp}`;
      const signature = createBinanceSignature(queryString);
      
      const url = `https://api.binance.com/api/v3/order?${queryString}&signature=${signature}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-MBX-APIKEY': config.binanceApiKey
        }
      });
      
      const data = await response.json();
      
      if (data.status === 'FILLED') {
        // Order telah diisi, perbarui status
        order.status = 'COMPLETED';
        
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
      console.error(`Error checking order status for ${order.symbol}:`, error);
    }
  }
}

// Fungsi untuk memeriksa take profit dan stop loss
async function checkTakeProfitStopLoss() {
  for (const order of tradingStatus.activeOrders) {
    if (order.side === 'BUY' && order.status === 'COMPLETED') {
      // Dapatkan harga saat ini
      const currentPrice = await getPrice(order.symbol);
      
      if (!currentPrice) continue;
      
      // Periksa take profit
      if (currentPrice >= order.takeProfitPrice) {
        // Eksekusi SELL untuk take profit
        const sellResult = await placeBinanceOrder(order.symbol, 'SELL', order.quantity, currentPrice.toFixed(2));
        
        if (sellResult && sellResult.orderId) {
          // Hitung profit
          const profit = (currentPrice - order.price) * order.quantity;
          const profitPercentage = ((currentPrice - order.price) / order.price) * 100;
          
          // Perbarui statistik kinerja
          tradingStatus.performance.profitableTrades++;
          tradingStatus.performance.totalProfitLoss += profit;
          tradingStatus.performance.winRate = (tradingStatus.performance.profitableTrades / tradingStatus.performance.totalTrades) * 100;
          
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
        // Eksekusi SELL untuk stop loss
        const sellResult = await placeBinanceOrder(order.symbol, 'SELL', order.quantity, currentPrice.toFixed(2));
        
        if (sellResult && sellResult.orderId) {
          // Hitung loss
          const loss = (order.price - currentPrice) * order.quantity;
          const lossPercentage = ((order.price - currentPrice) / order.price) * 100;
          
          // Perbarui statistik kinerja
          tradingStatus.performance.totalProfitLoss -= loss;
          tradingStatus.performance.winRate = (tradingStatus.performance.profitableTrades / tradingStatus.performance.totalTrades) * 100;
          
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
    }
  }
}

// Fungsi untuk mengirim laporan saldo dan kinerja
async function sendPerformanceReport() {
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
  `;
  
  await sendTelegramNotification(performanceReport);
}

// Fungsi utama untuk menjalankan bot trading
async function runTradingBot() {
  console.log('Starting Enhanced BNB Trading Bot...');
  
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
  
  // Jalankan loop untuk terus memantau dan trading
  setInterval(async () => {
    try {
      // Periksa status order yang ada
      await checkOrderStatus();
      
      // Periksa take profit dan stop loss
      await checkTakeProfitStopLoss();
      
      // Analisis semua pasangan trading
      for (const pair of config.tradingPairs) {
        // Dapatkan data historis
        const historicalData = await getHistoricalData(pair.symbol);
        if (!historicalData || historicalData.length === 0) {
          console.log(`No historical data available for ${pair.symbol}, skipping`);
          continue;
        }
        
        // Dapatkan harga saat ini
        const currentPrice = await getPrice(pair.symbol);
        if (!currentPrice) {
          console.log(`Could not get current price for ${pair.symbol}, skipping`);
          continue;
        }
        
        // Buat prediksi
        const prediction = predictPriceMovement(pair.symbol, historicalData);
        console.log(`Prediction for ${pair.symbol}:`, prediction);
        
        // Kirim notifikasi prediksi ke Telegram
        const predictionMessage = `
🔮 <b>${pair.symbol} Prediction Update</b>
Current Price: $${currentPrice}
Signal: ${prediction.prediction === 'BUY' ? '🟢 BUY' : prediction.prediction === 'SELL' ? '🔴 SELL' : '⚪ HOLD'}
Confidence: ${prediction.confidence.toFixed(2)}%

<b>Indicators:</b>
RSI: ${prediction.indicators.rsi.toFixed(2)}
SMA: $${prediction.indicators.sma.toFixed(2)}
MACD: ${prediction.indicators.macd}
Volume: ${prediction.indicators.volume}
Bollinger Bands:
  - Upper: $${prediction.indicators.bollingerBands.upper.toFixed(2)}
  - Middle: $${prediction.indicators.bollingerBands.middle.toFixed(2)}
  - Lower: $${prediction.indicators.bollingerBands.lower.toFixed(2)}

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
            if (tradingStatus.balance[assetToSell] && tradingStatus.balance[assetToSell] > 0) {
              const quantity = Math.min(tradingStatus.balance[assetToSell], config.tradingAmount);
              
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
            } else {
              await sendTelegramNotification(`⚠️ <b>SELL Signal for ${pair.symbol}</b> but insufficient balance of ${assetToSell}`);
            }
          }
        }
      }
      
      // Kirim laporan kinerja setiap 6 jam
      const currentHour = new Date().getHours();
      if (currentHour % 6 === 0 && new Date().getMinutes() < 5) {
        await sendPerformanceReport();
      }
      
    } catch (error) {
      console.error('Error in trading bot loop:', error);
      await sendTelegramNotification(`❌ <b>Error in Trading Bot</b>\n${error.message}`);
    }
  }, config.checkInterval);
}

// Jalankan bot
runTradingBot();

console.log('Bot is running and will check for trading opportunities every', config.checkInterval / 60000, 'minutes');