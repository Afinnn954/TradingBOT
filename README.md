# BNB Trading Bot

Bot trading otomatis untuk BNB dan koin-koin yang berhubungan dengan BNB dengan notifikasi Telegram lengkap. Bot ini menggunakan analisis teknis dan indikator untuk membuat prediksi pergerakan harga dan melakukan trading secara otomatis.

### 2. Install Dependencies

```shellscript
npm install
```

### 3. Buat File Konfigurasi

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

## ⚙️ Konfigurasi

### Konfigurasi Dasar

Berikut adalah penjelasan untuk setiap parameter konfigurasi di file `.env`:

| Parameter | Deskripsi | Contoh Nilai
|-----|-----|-----
| `BINANCE_API_KEY` | API Key dari akun Binance Anda | `1a2b3c4d5e6f7g8h9i0j`
| `BINANCE_SECRET_KEY` | Secret Key dari akun Binance Anda | `a1b2c3d4e5f6g7h8i9j0`
| `TELEGRAM_BOT_TOKEN` | Token bot Telegram dari BotFather | `1234567890:ABCDefGhIJKlmnOPQRstUVwxYZ`
| `TELEGRAM_CHAT_ID` | ID chat Telegram Anda | `123456789`
| `TRADING_AMOUNT` | Jumlah BNB untuk setiap trade | `0.1`
| `TAKE_PROFIT_PERCENTAGE` | Persentase take profit | `2.5`
| `STOP_LOSS_PERCENTAGE` | Persentase stop loss | `1.5`
| `PREDICTION_CONFIDENCE_THRESHOLD` | Threshold kepercayaan untuk eksekusi trading (%) | `75`
| `CHECK_INTERVAL` | Interval pengecekan dalam milidetik (5 menit = 300000) | `300000`


### Konfigurasi Trading Pairs

Buka file `enhanced_bnb_trading_bot.js` dan sesuaikan daftar trading pairs di bagian konfigurasi:

```javascript
// Daftar koin yang berhubungan dengan BNB untuk dipantau
tradingPairs: [
  { symbol: 'BNBUSDT', baseAsset: 'BNB', quoteAsset: 'USDT' },
  { symbol: 'BTCBNB', baseAsset: 'BTC', quoteAsset: 'BNB' },
  { symbol: 'ETHBNB', baseAsset: 'ETH', quoteAsset: 'BNB' },
  { symbol: 'ADABNB', baseAsset: 'ADA', quoteAsset: 'BNB' },
  { symbol: 'DOGEBNB', baseAsset: 'DOGE', quoteAsset: 'BNB' }
  // Tambahkan atau hapus pair sesuai kebutuhan
]
```

### Mendapatkan API Key Binance

1. Login ke akun Binance Anda
2. Klik pada profil Anda dan pilih "API Management"
3. Buat API key baru dengan label "BNB Trading Bot"
4. Aktifkan izin "Enable Reading" dan "Enable Spot & Margin Trading"
5. JANGAN aktifkan "Enable Withdrawals"
6. Salin API Key dan Secret Key ke file `.env` Anda





*Screenshot langkah-langkah membuat API key di Binance*

### Membuat Bot Telegram

1. Buka Telegram dan cari [@BotFather](https://t.me/botfather)
2. Kirim pesan `/newbot` dan ikuti instruksinya
3. Setelah selesai, Anda akan menerima token bot
4. Salin token tersebut ke file `.env` Anda


### Mendapatkan Chat ID Telegram

1. Mulai chat dengan bot [@userinfobot](https://t.me/userinfobot)
2. Bot akan mengirimkan ID Anda
3. Salin ID tersebut ke file `.env` Anda


## 🚀 Cara Menggunakan

### 1. Jalankan Bot

```shellscript
npm start
```

Untuk pengembangan dengan auto-restart:

```shellscript
npm run dev
```

### 2. Verifikasi Bot Berjalan

Bot akan mengirimkan pesan ke Telegram Anda saat dimulai dengan semua setting yang dikonfigurasi:




*Screenshot notifikasi Telegram saat bot dimulai*

### 3. Pantau Notifikasi

Bot akan mengirimkan berbagai jenis notifikasi ke Telegram Anda:

- Prediksi pergerakan harga
- Eksekusi order
- Take profit dan stop loss
- Laporan kinerja berkala


### 4. Menghentikan Bot

Untuk menghentikan bot, tekan `Ctrl+C` di terminal tempat bot berjalan.

### 5. Menjalankan Bot di Background (Server)

Untuk menjalankan bot secara terus-menerus di server, gunakan [PM2](https://pm2.keymetrics.io/):

```shellscript
# Install PM2
npm install -g pm2

# Jalankan bot dengan PM2
pm2 start enhanced_bnb_trading_bot.js --name "bnb-trading-bot"

# Lihat status bot
pm2 status

# Lihat log bot
pm2 logs bnb-trading-bot

# Restart bot
pm2 restart bnb-trading-bot

# Hentikan bot
pm2 stop bnb-trading-bot
```

## 📱 Contoh Notifikasi

### 1. Notifikasi Startup

Bot akan mengirimkan pesan ini saat pertama kali dijalankan:

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




*Screenshot notifikasi startup bot*

### 2. Notifikasi Prediksi

Bot akan mengirimkan prediksi pergerakan harga secara berkala:

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




*Screenshot notifikasi prediksi*

### 3. Notifikasi Order

Saat bot melakukan trading otomatis:

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




*Screenshot notifikasi order*

### 4. Notifikasi Take Profit

Saat target take profit tercapai:

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




*Screenshot notifikasi take profit*

### 5. Notifikasi Stop Loss

Saat stop loss terpicu:

```plaintext
🛑 Stop Loss Triggered
Symbol: BNBUSDT
Quantity: 0.100000
Entry Price: $389.45
Exit Price: $383.61
Loss: $0.58 (1.50%)

Performance Summary:
Total Trades: 6
Win Rate: 66.67%
Total P/L: $3.67
```




*Screenshot notifikasi stop loss*

### 6. Laporan Kinerja

Bot akan mengirimkan laporan kinerja secara berkala:

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




*Screenshot laporan kinerja*

## 📈 Strategi Trading

Bot ini menggunakan kombinasi indikator teknis untuk membuat keputusan trading. Berikut adalah penjelasan detail tentang strategi yang digunakan:

### 1. RSI (Relative Strength Index)

RSI adalah indikator momentum yang mengukur kecepatan dan perubahan pergerakan harga.

- **RSI < 30**: Kondisi oversold, sinyal bullish (BUY)
- **RSI > 70**: Kondisi overbought, sinyal bearish (SELL)
- **RSI antara 30-70**: Netral





*Ilustrasi indikator RSI dan sinyal trading*

### 2. Moving Average

Moving Average membantu mengidentifikasi tren harga.

- **Harga di atas SMA**: Uptrend, sinyal bullish (BUY)
- **Harga di bawah SMA**: Downtrend, sinyal bearish (SELL)





*Ilustrasi Moving Average dan sinyal trading*

### 3. MACD (Moving Average Convergence Divergence)

MACD adalah indikator momentum yang menunjukkan hubungan antara dua moving average.

- **MACD histogram positif dan meningkat**: Sinyal bullish (BUY)
- **MACD histogram negatif dan menurun**: Sinyal bearish (SELL)





*Ilustrasi indikator MACD dan sinyal trading*

### 4. Volume Analysis

Volume membantu mengkonfirmasi kekuatan tren.

- **Volume meningkat dalam uptrend**: Konfirmasi tren naik, sinyal bullish (BUY)
- **Volume meningkat dalam downtrend**: Konfirmasi tren turun, sinyal bearish (SELL)





*Ilustrasi analisis volume dan sinyal trading*

### 5. Bollinger Bands

Bollinger Bands membantu mengidentifikasi volatilitas dan level harga relatif.

- **Harga di bawah lower band**: Potential reversal up, sinyal bullish (BUY)
- **Harga di atas upper band**: Potential reversal down, sinyal bearish (SELL)





*Ilustrasi Bollinger Bands dan sinyal trading*

### Kombinasi Sinyal dan Confidence

Bot menggabungkan semua indikator di atas untuk menghitung confidence level:

- Setiap indikator memberikan sinyal bullish atau bearish
- Bot menghitung rasio sinyal bullish vs bearish
- Confidence level dihitung sebagai persentase dari total sinyal
- Trading hanya dilakukan jika confidence level melebihi threshold yang dikonfigurasi


## ⚙️ Konfigurasi Lanjutan

### Menyesuaikan Parameter Indikator Teknis

Anda dapat menyesuaikan parameter indikator teknis di fungsi `predictPriceMovement()`:

```javascript
// Contoh: Mengubah periode RSI
const rsi = calculateRSI(historicalData, 14); // Ubah 14 menjadi periode yang diinginkan

// Contoh: Mengubah periode SMA
const sma = calculateSMA(historicalData, 20); // Ubah 20 menjadi periode yang diinginkan

// Contoh: Mengubah parameter Bollinger Bands
const bollingerBands = calculateBollingerBands(historicalData, 20, 2); // Periode 20, multiplier 2
```

### Menyesuaikan Interval Data Historis

Anda dapat mengubah interval dan jumlah candle yang diambil untuk analisis:

```javascript
// Mengubah interval dan jumlah candle
async function getHistoricalData(symbol, interval = '1h', limit = 24) {
  // ...
}

// Contoh penggunaan:
// 15 menit interval, 96 candle (24 jam)
const historicalData = await getHistoricalData(pair.symbol, '15m', 96);

// 4 jam interval, 30 candle (5 hari)
const historicalData = await getHistoricalData(pair.symbol, '4h', 30);
```

### Menyesuaikan Logika Prediksi

Anda dapat menyesuaikan bobot untuk setiap indikator dalam logika prediksi:

```javascript
// Contoh: Memberikan bobot lebih pada RSI
if (rsi &lt; 30) bullishSignals += 2; // Bobot 2x untuk RSI oversold
else if (rsi > 70) bearishSignals += 2; // Bobot 2x untuk RSI overbought

// Contoh: Memberikan bobot lebih pada MACD
if (macd.histogram > 0 && macd.histogram > macd.histogram) bullishSignals += 1.5;
else if (macd.histogram &lt; 0 && macd.histogram &lt; macd.histogram) bearishSignals += 1.5;
```

### Menambahkan Indikator Baru

Anda dapat menambahkan indikator teknis baru ke dalam strategi:

```javascript
// Contoh: Menambahkan Stochastic Oscillator
const calculateStochastic = (data, period = 14, smoothK = 3, smoothD = 3) => {
  if (data.length &lt; period) {
    return { k: 50, d: 50 };
  }
  
  // Implementasi Stochastic Oscillator
  // ...
  
  return { k: stochK, d: stochD };
};

// Menggunakan Stochastic dalam prediksi
const stochastic = calculateStochastic(historicalData);
totalSignals++;
if (stochastic.k &lt; 20 && stochastic.k > stochastic.d) bullishSignals += 1;
else if (stochastic.k > 80 && stochastic.k &lt; stochastic.d) bearishSignals += 1;
```

## ⚠️ Manajemen Risiko

### 1. Batasan Trading

Bot ini memiliki beberapa fitur manajemen risiko bawaan:

- **Take Profit**: Mengambil keuntungan secara otomatis saat target tercapai
- **Stop Loss**: Membatasi kerugian secara otomatis
- **Confidence Threshold**: Hanya melakukan trading saat sinyal memiliki kepercayaan tinggi


### 2. Rekomendasi Keamanan

- **Mulai dengan Jumlah Kecil**: Mulai dengan jumlah trading yang kecil
- **Uji di Akun Demo**: Uji bot di akun demo Binance sebelum menggunakan dana nyata
- **Batasi Akses API**: Pastikan API key Binance Anda hanya memiliki izin trading, bukan penarikan
- **Pantau Bot**: Meskipun otomatis, bot tetap perlu dipantau secara berkala


### 3. Menyesuaikan Manajemen Risiko

Anda dapat menyesuaikan parameter manajemen risiko di file `.env`:

```plaintext
# Mengurangi jumlah trading
TRADING_AMOUNT=0.05

# Mengubah take profit dan stop loss
TAKE_PROFIT_PERCENTAGE=1.5
STOP_LOSS_PERCENTAGE=1.0

# Meningkatkan threshold kepercayaan
PREDICTION_CONFIDENCE_THRESHOLD=85
```

## ❓ FAQ

### 1. Apakah bot ini aman digunakan?

Ya, bot ini aman digunakan selama Anda mengikuti praktik keamanan yang baik:

- Jangan pernah memberikan izin penarikan pada API key Binance
- Simpan API key dan secret key dengan aman
- Mulai dengan jumlah trading yang kecil untuk menguji kinerja bot


### 2. Berapa keuntungan yang bisa diharapkan?

Keuntungan bervariasi tergantung pada kondisi pasar dan konfigurasi bot. Tidak ada jaminan keuntungan dalam trading cryptocurrency. Bot ini dirancang untuk membantu mengotomatiskan strategi trading, tetapi tetap ada risiko kerugian.

### 3. Apakah bot ini bekerja 24/7?

Ya, bot ini dirancang untuk berjalan terus-menerus selama server aktif. Disarankan untuk menjalankannya di server yang stabil dengan koneksi internet yang andal.

### 4. Bagaimana cara menyesuaikan strategi trading?

Anda dapat menyesuaikan strategi trading dengan mengubah parameter indikator teknis dan logika prediksi di file `enhanced_bnb_trading_bot.js`. Lihat bagian [Konfigurasi Lanjutan](#-konfigurasi-lanjutan) untuk detail lebih lanjut.

### 5. Apakah bot ini mendukung exchange selain Binance?

Saat ini, bot ini hanya mendukung Binance. Untuk mendukung exchange lain, perlu dilakukan modifikasi pada kode untuk mengintegrasikan API exchange tersebut.

### 6. Bagaimana cara menambahkan koin baru untuk dipantau?

Tambahkan koin baru ke daftar `tradingPairs` di file `enhanced_bnb_trading_bot.js`:

```javascript
tradingPairs: [
  // Koin yang sudah ada
  { symbol: 'BNBUSDT', baseAsset: 'BNB', quoteAsset: 'USDT' },
  // Tambahkan koin baru
  { symbol: 'SOLBNB', baseAsset: 'SOL', quoteAsset: 'BNB' },
]
```

## 🔧 Pemecahan Masalah

### 1. Bot tidak mengirim notifikasi ke Telegram

**Kemungkinan penyebab:**

- Token bot Telegram tidak valid
- Chat ID Telegram tidak benar
- Bot Telegram belum diaktifkan


**Solusi:**

- Verifikasi token bot dan chat ID di file `.env`
- Pastikan Anda telah memulai chat dengan bot Telegram Anda
- Coba kirim pesan manual ke bot untuk memastikan bot aktif


### 2. Error saat menghubungi API Binance

**Kemungkinan penyebab:**

- API key atau secret key tidak valid
- Rate limit API Binance terlampaui
- Masalah jaringan


**Solusi:**

- Verifikasi API key dan secret key di file `.env`
- Kurangi frekuensi pengecekan dengan meningkatkan `CHECK_INTERVAL`
- Periksa koneksi internet server Anda


### 3. Bot tidak melakukan trading

**Kemungkinan penyebab:**

- Confidence threshold terlalu tinggi
- Tidak ada sinyal yang cukup kuat
- Saldo tidak mencukupi


**Solusi:**

- Kurangi `PREDICTION_CONFIDENCE_THRESHOLD` di file `.env`
- Periksa log bot untuk melihat confidence level sinyal
- Pastikan saldo Binance Anda mencukupi untuk trading


### 4. Error "Invalid symbol" saat trading

**Kemungkinan penyebab:**

- Trading pair tidak valid atau tidak tersedia di Binance


**Solusi:**

- Verifikasi bahwa semua trading pair di `tradingPairs` tersedia di Binance
- Periksa apakah ada perubahan pada simbol di Binance


## 🤝 Kontribusi

Kontribusi, issue, dan permintaan fitur sangat diterima! Berikut cara untuk berkontribusi:

1. Fork repository
2. Buat branch fitur (`git checkout -b feature/amazing-feature`)
3. Commit perubahan Anda (`git commit -m 'Add some amazing feature'`)
4. Push ke branch (`git push origin feature/amazing-feature`)
5. Buka Pull Request


## 📝 Lisensi

Didistribusikan di bawah Lisensi MIT. Lihat `LICENSE` untuk informasi lebih lanjut.

## 📞 Kontak

Your Name - [@JoestarMojo](https://t.me/JoestarMojo) 

Project Link: [https://github.com/Afinnn954/TradingBOT](https://github.com/Afinnn954/TradingBOT)

---

`<div align="center">
  <p>Dibuat dengan ❤️ untuk komunitas trading cryptocurrency</p>
  <p>
    <a href="https://github.com/Afinnn954/TradingBOT/stargazers">⭐ Star</a> •
    <a href="https://github.com/Afinnn954/TradingBOT/issues">🐛 Report Bug</a> •
    <a href="https://github.com/Afinnn954/TradingBOT/issues">✨ Request Feature</a>
  </p>
</div>
