# MCX Trading Dashboard

A comprehensive **Multi Commodity Exchange (MCX) Option Chain Trading Application** built with Next.js, featuring real-time data, advanced analytics, and professional trading tools.

![MCX Trading Dashboard](https://img.shields.io/badge/MCX-Trading%20Dashboard-blue?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3-38B2AC?style=for-the-badge&logo=tailwind-css)

## 🚀 Features

### 📊 **Real-Time MCX Option Chain**
- Live option chain data from MCX India
- PUT and CALL options with complete market depth
- Strike prices, LTP, Volume, Open Interest
- Bid/Ask prices with quantities
- Real-time price changes and percentage movements

### 📈 **Advanced Market Analytics**
- **Put-Call Ratio** analysis
- **Market Sentiment** indicators (Bullish/Bearish)
- **Maximum OI Analysis** for PUT and CALL options
- **Volume and Turnover** comparisons
- **Live calculations** updated in real-time

### 🔔 **Smart Alert System**
- **Customizable price alerts** with threshold settings
- **Sound notifications** for critical price movements
- **Strike-wise alerts** for both PUT and CALL options
- **Critical alert modals** for major market moves
- **Alert history** with timestamps

### ⚡ **Live Data Updates**
- **Auto-refresh** every 5 minutes
- **Live updates** every 10 seconds
- **Manual refresh** on-demand
- **Real-time countdown** timers
- **Background data collection**

### 💾 **Data Export & History**
- **Complete CSV export** with all option chain fields
- **Historical data** tracking throughout the day
- **Timestamped records** for analysis
- **Professional formatting** for Excel/analysis tools

### 🎯 **Multi-Commodity Support**
- **CRUDE OIL** - Primary commodity
- **GOLD** - Precious metals
- **SILVER** - Precious metals
- **COPPER** - Base metals
- **ZINC, LEAD, NICKEL, ALUMINIUM** - Industrial metals

### 🔧 **Professional Controls**
- **Commodity selection** dropdown
- **Expiry date** selection
- **Alert threshold** customization
- **Sound alert** toggle
- **Live/Auto refresh** controls

## 🛠️ Installation

### **Prerequisites**
- Node.js 18+ 
- npm or yarn
- Modern web browser

### **Quick Start**

```bash
# Clone the repository
git clone <your-repo-url>
cd mcx-trading-app

# Install dependencies
npm install

# Initialize shadcn/ui (if not already done)
npx shadcn@latest init

# Install required UI components
npx shadcn@latest add card button badge table alert toast

# Start development server
npm run dev
```

### **Manual Setup (if shadcn setup was interrupted)**

```bash
# Re-initialize shadcn/ui
npx shadcn@latest init

# When prompted, choose:
# ✅ TypeScript: Yes
# ✅ Style: Default  
# ✅ Base color: Slate
# ✅ CSS variables: Yes

# Install all required components
npx shadcn@latest add card button badge table alert toast
```

### **Verify Installation**

Your project structure should look like:

```
mcx-trading-app/
├── app/
│   ├── api/
│   │   └── option-chain/
│   │       └── route.ts          # MCX API proxy
│   ├── layout.tsx
│   └── page.tsx                  # Main trading dashboard
├── components/
│   └── ui/                       # shadcn/ui components
│       ├── card.tsx
│       ├── button.tsx
│       ├── badge.tsx
│       ├── table.tsx
│       ├── alert.tsx
│       └── toast.tsx
├── services/
│   └── mcx-api.ts               # MCX API service
├── hooks/
│   └── use-toast.ts
├── lib/
│   └── utils.ts
└── README.md
```

## 🚀 Usage

### **Starting the Application**

```bash
npm run dev
```

Navigate to `http://localhost:3000`

### **Basic Operations**

1. **Select Commodity**: Choose from dropdown (CRUDEOIL, GOLD, SILVER, etc.)
2. **Select Expiry**: Choose contract expiry date
3. **Fetch Data**: Click "Fetch Data" or enable auto-refresh
4. **Set Alerts**: Configure alert thresholds and enable notifications
5. **Export Data**: Download complete data as CSV

### **Live Trading Features**

- **Start Live Updates**: Enable 10-second real-time updates
- **Auto Refresh**: Enable 5-minute automatic data refresh  
- **Price Alerts**: Get notified of significant price movements
- **Market Analytics**: Monitor Put-Call ratio and market sentiment

## 📡 API Integration

### **MCX Option Chain API**

The app integrates with the official MCX India API:

```
Endpoint: https://www.mcxindia.com/backpage.aspx/GetOptionChain
Method: POST
Headers: Content-Type: application/json
```

### **Proxy Implementation**

Due to CORS restrictions, the app uses a Next.js API route as a proxy:

```
Client → /api/option-chain → MCX India API
```

### **Fallback System**

If the MCX API is unavailable:
- App automatically falls back to realistic mock data
- User is notified via toast messages
- All features continue to work normally

## 🔧 Configuration

### **Alert Settings**
- **Threshold**: 1-50% price change threshold
- **Sound Alerts**: Enable/disable audio notifications
- **Alert Types**: Regular alerts and critical alert modals

### **Refresh Settings**
- **Live Updates**: 10-second intervals
- **Auto Refresh**: 5-minute intervals
- **Manual Refresh**: On-demand updates

### **Data Export**
- **Format**: CSV with all option chain fields
- **Filename**: `mcx-option-chain-{COMMODITY}-{DATE}.csv`
- **Fields**: 20+ data points per option

## 📊 Data Fields

### **Option Chain Data**
- **Strike Price** - Option strike prices
- **PUT Options**: LTP, Change, Volume, OI, Bid/Ask
- **CALL Options**: LTP, Change, Volume, OI, Bid/Ask
- **Market Data**: Turnover, OI Changes, Percentages

### **Analytics Data**
- **Put-Call Ratio** - Market sentiment indicator
- **Max OI Strikes** - Highest open interest levels
- **Volume Analysis** - PUT vs CALL volume comparison
- **Market Sentiment** - Bullish/Bearish classification

## 🚨 Troubleshooting

### **Common Issues**

**1. "Failed to fetch" Error**
```bash
# This is usually a CORS issue - the proxy should handle it
# Check if the API route is working:
curl http://localhost:3000/api/option-chain?commodity=CRUDEOIL
```

**2. Missing shadcn Components**
```bash
# Install missing components
npx shadcn@latest add card button badge table alert toast
```

**3. TypeScript Errors**
```bash
# Install TypeScript dependencies
npm install --save-dev typescript @types/node @types/react @types/react-dom
```

**4. Styling Issues**
```bash
# Check Tailwind configuration
npm run build
```

### **API Issues**

- **MCX API Down**: App automatically uses mock data
- **Rate Limiting**: Implemented with reasonable request intervals
- **CORS Errors**: Handled via Next.js API proxy

## 🔄 Development

### **Adding New Features**

1. **New Commodities**: Add to `commodities` array in `page.tsx`
2. **New Expiries**: Add to `expiries` array in `page.tsx`
3. **Custom Alerts**: Modify alert logic in `checkForAlerts` function
4. **Additional Analytics**: Extend `calculateAnalytics` in `mcx-api.ts`

### **Testing**

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 📱 Deployment

### **Vercel (Recommended)**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### **Other Platforms**

The app works on any platform supporting Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **MCX India** for providing the option chain API
- **shadcn/ui** for the beautiful UI components
- **Next.js** team for the amazing framework
- **Tailwind CSS** for the utility-first CSS framework

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section above
- Review the Next.js and shadcn/ui documentation

---

**Built with ❤️ for MCX traders and developers**
```

## 🔧 **Regarding shadcn CLI Setup**

**You DON'T need to delete everything!** Here's what to do:

### **Option 1: Continue with Existing Setup (Recommended)**
```bash
# Just complete the shadcn setup
npx shadcn@latest init
npx shadcn@latest add card button badge table alert toast