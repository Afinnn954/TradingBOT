import fetch from 'node-fetch';
import crypto from 'crypto';

// Konfigurasi (dalam implementasi nyata, ini akan disimpan dalam variabel lingkungan)
const config = {
  binanceApiKey: 'YOUR_BINANCE_API_KEY',
  binanceSecretKey: 'YOUR_BINANCE_SECRET_KEY',
  telegramBotToken: 'YOUR_TELEGRAM_BOT_TOKEN',
  telegramChatId: 'YOUR_TELEGRAM_CHAT_ID',
  tradingAmount: 0.1, // Jumlah BNB untuk trading
  takeProfitPercentage: 2.5,
  stopLossPercentage: 1.5,
  predictionConfidenceThreshold: 75, // dalam persen
  checkInterval: 5 * 60 * 1000, // 5 menit
};

// Fungsi untuk mendapatkan data harga BNB terbaru dari Binance
async function getBnbPrice() {
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT');
    const data = await response.json();
    return parseFloat(data.price);
  } catch (error) {
    console.error('Error fetching BNB price:', error);
    return null;
  }
}

// Fungsi untuk mendapatkan data historis BNB untuk analisis
async function getBnbHistoricalData() {
  try {
    const response = await fetch('https://api.binance.com/api/v3/klines?symbol=BNBUSDT&interval=1h&limit=24');
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
    console.error('Error fetching historical data:', error);
    return [];
  }
}

// Fungsi sederhana untuk memprediksi pergerakan harga BNB
// Dalam implementasi nyata, ini akan menggunakan model ML yang lebih kompleks
function predictBnbMovement(historicalData) {
  if (!historicalData || historicalData.length < 2) {
    return { prediction: 'HOLD', confidence: 0 };
  }
  
  // Analisis sederhana berdasarkan beberapa indikator teknis
  
  // 1. Hitung RSI (Relative Strength Index) sederhana
  const calculateRSI = (data, period = 14) => {
    if (data.length < period + 1) {
      return 50; // Nilai default jika data tidak cukup
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
  
  // 2. Hitung Moving Average sederhana
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
  
  // 3. Analisis volume
  const isVolumeIncreasing = () => {
    const recentVolumes = historicalData.slice(-5).map(d => d.volume);
    const avgRecentVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
    const prevVolumes = historicalData.slice(-10, -5).map(d => d.volume);
    const avgPrevVolume = prevVolumes.reduce((a, b) => a + b, 0) / prevVolumes.length;
    
    return avgRecentVolume > avgPrevVolume;
  };
  
  // Hitung indikator
  const rsi = calculateRSI(historicalData);
  const sma = calculateSMA(historicalData);
  const currentPrice = historicalData[historicalData.length - 1].close;
  const volumeIncreasing = isVolumeIncreasing();
  
  // Logika prediksi sederhana
  let bullishSignals = 0;
  let bearishSignals = 0;
  
  // RSI di bawah 30 (oversold) adalah sinyal bullish
  if (rsi < 30) bullishSignals += 1;
  // RSI di atas 70 (overbought) adalah sinyal bearish
  if (rsi > 70) bearishSignals += 1;
  
  // Harga di atas SMA adalah sinyal bullish
  if (currentPrice > sma) bullishSignals += 1;
  // Harga di bawah SMA adalah sinyal bearish
  if (currentPrice < sma) bearishSignals += 1;
  
  // Volume meningkat bisa menjadi sinyal bullish dalam uptrend
  if (volumeIncreasing && currentPrice > sma) bullishSignals += 1;
  
  // Hitung total sinyal dan confidence
  const totalSignals = 3; // Jumlah maksimum sinyal yang kita periksa
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
    prediction,
    confidence,
    indicators: {
      rsi,
      priceVsSMA: currentPrice > sma ? 'above' : 'below',
      volumeTrend: volumeIncreasing ? 'increasing' : 'decreasing'
    }
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
async function placeBinanceOrder(side, quantity, price) {
  try {
    const timestamp = Date.now();
    const queryString = `symbol=BNBUSDT&side=${side}&type=LIMIT&timeInForce=GTC&quantity=${quantity}&price=${price}&timestamp=${timestamp}`;
    const signature = createBinanceSignature(queryString);
    
    const url = `https://api.binance.com/api/v3/order?${queryString}&signature=${signature}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-MBX-APIKEY': config.binanceApiKey
      }
    });
    
    const data = await response.json();
    console.log(`${side} order placed:`, data);
    return data;
  } catch (error) {
    console.error(`Error placing ${side} order:`, error);
    return null;
  }
}

// Fungsi utama untuk menjalankan bot trading
async function runTradingBot() {
  console.log('Starting BNB trading bot...');
  
  // Kirim notifikasi bahwa bot telah dimulai
  await sendTelegramNotification('🤖 <b>BNB Trading Bot Started</b>\nBot akan memantau harga BNB dan melakukan trading otomatis.');
  
  // Jalankan loop untuk terus memantau dan trading
  setInterval(async () => {
    try {
      // 1. Dapatkan data historis BNB
      const historicalData = await getBnbHistoricalData();
      if (!historicalData || historicalData.length === 0) {
        console.log('No historical data available, skipping this iteration');
        return;
      }
      
      // 2. Dapatkan harga BNB saat ini
      const currentPrice = await getBnbPrice();
      if (!currentPrice) {
        console.log('Could not get current BNB price, skipping this iteration');
        return;
      }
      
      // 3. Buat prediksi
      const prediction = predictBnbMovement(historicalData);
      console.log('Prediction:', prediction);
      
      // 4. Kirim notifikasi prediksi ke Telegram
      const predictionMessage = `
🔮 <b>BNB Prediction Update</b>
Current Price: $${currentPrice}
Signal: ${prediction.prediction === 'BUY' ? '🟢 BUY' : prediction.prediction === 'SELL' ? '🔴 SELL' : '⚪ HOLD'}
Confidence: ${prediction.confidence.toFixed(2)}%

<b>Indicators:</b>
RSI: ${prediction.indicators.rsi.toFixed(2)}
Price vs SMA: ${prediction.indicators.priceVsSMA}
Volume: ${prediction.indicators.volumeTrend}

<i>This is an automated message from your BNB Trading Bot.</i>
      `;
      
      await sendTelegramNotification(predictionMessage);
      
      // 5. Jika confidence melebihi threshold, lakukan trading
      if (prediction.confidence >= config.predictionConfidenceThreshold) {
        if (prediction.prediction === 'BUY') {
          // Hitung harga take profit dan stop loss
          const takeProfitPrice = currentPrice * (1 + config.takeProfitPercentage / 100);
          const stopLossPrice = currentPrice * (1 - config.stopLossPercentage / 100);
          
          // Lakukan order BUY
          const orderResult = await placeBinanceOrder('BUY', config.tradingAmount, currentPrice.toFixed(2));
          
          if (orderResult && orderResult.orderId) {
            // Kirim notifikasi order berhasil
            const orderMessage = `
🟢 <b>BUY Order Executed</b>
Symbol: BNB/USDT
Amount: ${config.tradingAmount} BNB
Price: $${currentPrice}
Total: $${(currentPrice * config.tradingAmount).toFixed(2)}

Take Profit: $${takeProfitPrice.toFixed(2)}
Stop Loss: $${stopLossPrice.toFixed(2)}

Order ID: ${orderResult.orderId}
            `;
            
            await sendTelegramNotification(orderMessage);
          }
        } else if (prediction.prediction === 'SELL') {
          // Lakukan order SELL
          const orderResult = await placeBinanceOrder('SELL', config.tradingAmount, currentPrice.toFixed(2));
          
          if (orderResult && orderResult.orderId) {
            // Kirim notifikasi order berhasil
            const orderMessage = `
🔴 <b>SELL Order Executed</b>
Symbol: BNB/USDT
Amount: ${config.tradingAmount} BNB
Price: $${currentPrice}
Total: $${(currentPrice * config.tradingAmount).toFixed(2)}

Order ID: ${orderResult.orderId}
            `;
            
            await sendTelegramNotification(orderMessage);
          }
        }
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