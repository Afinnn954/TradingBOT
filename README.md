# BNB Trading Bot

Bot trading otomatis untuk BNB dan koin-koin yang berhubungan dengan BNB dengan notifikasi Telegram lengkap. Bot ini menggunakan analisis teknis dan indikator untuk membuat prediksi pergerakan harga dan melakukan trading secara otomatis.

![BNB Trading Bot](https://placeholder.svg?height=300&width=600&text=BNB+Trading+Bot)


### 2. Install Dependencies

```shellscript
npm install
```

### 3. Konfigurasi

Buat file `.env` di root project:

```plaintext
BINANCE_API_KEY=your_binance_api_key
BINANCE_SECRET_KEY=your_binance_secret_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
TRADING_AMOUNT=0.1
TAKE_PROFIT_PERCENTAGE=2.5
STOP_LOSS_PERCENTAGE=1.5
PREDICTION_CONFIDENCE_THRESHOLD=75
CHECK_INTERVAL=300000
```

### 4. Konfigurasi Trading Pairs (Opsional)

Buka file `enhanced_bnb_trading_bot.js` dan sesuaikan daftar trading pairs di bagian konfigurasi:

```javascript
// Daftar koin yang berhubungan dengan BNB untuk dipantau
tradingPairs: [
  { symbol: 'BNBUSDT', baseAsset: 'BNB', quoteAsset: 'USDT' },
  { symbol: 'BTCBNB', baseAsset: 'BTC', quoteAsset: 'BNB' },
  { symbol: 'ETHBNB', baseAsset: 'ETH', quoteAsset: 'BNB' },
  // Tambahkan atau hapus pair sesuai kebutuhan
]
```

### 5. Jalankan Bot

```shellscript
npm start
```

Untuk pengembangan dengan auto-restart:

```shellscript
npm run dev
```

### 6. Verifikasi Bot Berjalan

Bot akan mengirimkan pesan ke Telegram Anda saat dimulai dengan semua setting yang dikonfigurasi.

## 📱 Notifikasi Telegram

Bot akan mengirimkan berbagai jenis notifikasi ke Telegram Anda:

### Notifikasi Startup

```plaintext
🤖 BNB Trading Bot Started

Trading Settings:
Trading Amount: 0.1 BNB
Take Profit: 2.5%
Stop Loss: 1.5%
Confidence Threshold: 75%
Check Interval: 5 minutes

Trading Pairs:
BNBUSDT, BTCBNB, ETHBNB, ADABNB, DOGEBNB

Initial Balance:
BNB: 1, USDT: 1000

Bot akan memantau harga dan melakukan trading otomatis berdasarkan sinyal.
```

### Notifikasi Prediksi

```plaintext
🔮 BNBUSDT Prediction Update
Current Price: $389.45
Signal: 🟢 BUY
Confidence: 80.00%

Indicators:
RSI: 42.50
SMA: $375.20
MACD: bullish
Volume: increasing
Bollinger Bands:
  - Upper: $395.30
  - Middle: $380.15
  - Lower: $365.00

Entry Plan:
Take Profit: $399.19 (+2.5%)
Stop Loss: $383.61 (-1.5%)
```

### Notifikasi Order

```plaintext
🟢 BUY Order Executed
Symbol: BNBUSDT
Amount: 0.100000 BNB
Price: $389.45
Total: $38.95

Take Profit: $399.19
Stop Loss: $383.61

Order ID: 12345678
```

### Notifikasi Take Profit/Stop Loss

```plaintext
💰 Take Profit Executed
Symbol: BNBUSDT
Quantity: 0.100000
Entry Price: $389.45
Exit Price: $399.19
Profit: $0.97 (2.50%)

Performance Summary:
Total Trades: 5
Win Rate: 80.00%
Total P/L: $4.25
```

### Laporan Kinerja

```plaintext
📊 Performance Report

Current Balance:
BNB: 1.050000 (≈$409.92)
USDT: 950.25 (≈$950.25)
Total Value: $1360.17

Trading Performance:
Total Trades: 8
Profitable Trades: 6
Win Rate: 75.00%
Total Profit/Loss: $10.17

Active Orders: 1
Completed Orders: 7
```

## ⚙️ Konfigurasi Lanjutan

### Menyesuaikan Indikator Teknis

Anda dapat menyesuaikan parameter indikator teknis di fungsi `predictPriceMovement()`:

```javascript
// Contoh: Mengubah periode RSI
const rsi = calculateRSI(historicalData, 14); // Ubah 14 menjadi periode yang diinginkan

// Contoh: Mengubah periode SMA
const sma = calculateSMA(historicalData, 20); // Ubah 20 menjadi periode yang diinginkan

// Contoh: Mengubah parameter Bollinger Bands
const bollingerBands = calculateBollingerBands(historicalData, 20, 2); // Periode 20, multiplier 2
```

### Menyesuaikan Strategi Trading

Anda dapat menyesuaikan logika prediksi di fungsi `predictPriceMovement()`:

```javascript
// Logika prediksi berdasarkan indikator
let bullishSignals = 0;
let bearishSignals = 0;
let totalSignals = 0;

// Tambahkan atau modifikasi sinyal di sini
```

## 📈 Strategi Trading

Bot ini menggunakan kombinasi indikator teknis untuk membuat keputusan trading:

1. **RSI (Relative Strength Index)**

1. RSI < 30: Sinyal bullish (oversold)
2. RSI > 70: Sinyal bearish (overbought)



2. **Moving Average**

1. Harga di atas SMA: Sinyal bullish (uptrend)
2. Harga di bawah SMA: Sinyal bearish (downtrend)



3. **MACD (Moving Average Convergence Divergence)**

1. MACD histogram positif dan meningkat: Sinyal bullish
2. MACD histogram negatif dan menurun: Sinyal bearish



4. **Volume**

1. Volume meningkat dalam uptrend: Sinyal bullish
2. Volume meningkat dalam downtrend: Sinyal bearish



5. **Bollinger Bands**

1. Harga di bawah lower band: Potential reversal up (bullish)
2. Harga di atas upper band: Potential reversal down (bearish)





## ⚠️ Risiko dan Peringatan

- **Gunakan dengan Risiko Sendiri**: Trading cryptocurrency memiliki risiko tinggi. Bot ini tidak menjamin keuntungan.
- **Uji di Akun Demo**: Uji bot ini di akun demo Binance sebelum menggunakan dana nyata.
- **Batasi Akses API**: Pastikan API key Binance Anda hanya memiliki izin trading, bukan penarikan.
- **Pantau Bot**: Meskipun otomatis, bot tetap perlu dipantau secara berkala.


## 🔒 Keamanan

- Simpan API key dan secret key Anda dengan aman
- Jangan pernah membagikan file `.env` Anda
- Gunakan variabel lingkungan untuk menyimpan informasi sensitif
- Batasi izin API key Binance Anda hanya untuk trading


## 🤝 Kontribusi

Kontribusi, issue, dan permintaan fitur sangat diterima!

1. Fork repository
2. Buat branch fitur (`git checkout -b feature/amazing-feature`)
3. Commit perubahan Anda (`git commit -m 'Add some amazing feature'`)
4. Push ke branch (`git push origin feature/amazing-feature`)
5. Buka Pull Request


## 📝 Lisensi

Didistribusikan di bawah Lisensi MIT. Lihat `LICENSE` untuk informasi lebih lanjut.

## 📞 Kontak

Your Name - [@your_twitter](https://twitter.com/your_twitter) - [email@example.com](mailto:email@example.com)

Project Link: [https://github.com/username/bnb-trading-bot](https://github.com/username/bnb-trading-bot)
