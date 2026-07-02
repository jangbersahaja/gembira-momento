# Gembira Momento Sales Assessment Dashboard

A comprehensive Next.js-based sales analytics dashboard for Gembira Momento souvenir shop in KLCC. This application provides detailed insights into daily sales, product performance, payment methods, staff performance, and supplier analytics.

## Features

### 📊 Multi-Dimensional Analytics

- **Daily Sales**: Primary overview with daily breakdown showing sales, costs, and profit margins
- **Sales by Time**: Hourly analysis with trend charts and day-of-week patterns (10 AM - 12 AM operation hours)
- **Sales by Products**: Top-performing products with detailed unit and cost analysis
- **Payment Methods**: Cash, QR, and card payment breakdown
- **Staff Performance**: Individual staff member sales and discount tracking
- **Sales by Supplier**: Supplier-based analytics with cost and profit analysis

### 📈 Chart Visualizations

- Bar charts for quick comparisons
- Line charts for trend analysis
- 7-day hourly breakdown charts
- Day-of-week pattern analysis

### 🎯 Key Metrics

For each analysis dimension:
- Total sales (RM)
- Transaction count
- Cost of goods sold (COGS)
- Profit calculations
- Profit margin percentages

### 📅 Date Range Filtering

- All time
- This month
- Last month
- Custom date range

### 📥 PDF Export

Generate comprehensive PDF reports of any analysis in A4 format

## Tech Stack

- **Framework**: Next.js 16.2.9 (App Router)
- **Frontend**: React 19.2.4, Tailwind CSS v4
- **Charts**: Recharts 3.9.1
- **PDF Export**: html-to-image + jsPDF
- **Language**: TypeScript
- **Deployment**: Vercel-ready

## Project Structure

```
gembira-momento/
├── app/
│   ├── layout.tsx              # Root layout with header/footer
│   ├── page.tsx                # Homepage
│   ├── about/page.tsx          # About page
│   ├── contact/page.tsx        # Contact page
│   ├── sales-assessment/
│   │   └── page.tsx            # Sales dashboard page
│   └── globals.css             # Global styles
├── components/
│   ├── Header.tsx              # Navigation header
│   ├── Footer.tsx              # Footer
│   ├── Hero.tsx                # Homepage hero section
│   ├── SalesAssessmentClient.tsx   # Main dashboard component
│   └── SalesChart.tsx          # Chart components library
├── data/
│   ├── products.ts             # Product catalog with costs and suppliers
│   └── transactions.ts         # Historical transaction data
└── public/                      # Static assets
```

## Data Structure

### Products

- SKU-based identification
- Cost pricing for COGS calculation
- Supplier information
- Category classification

### Transactions

- Receipt-level data with line items
- Payment method tracking
- Staff assignment
- Discount handling
- Timestamp information

## Key Calculations

### Cost of Goods Sold (COGS)

Products are matched via:
1. **Primary**: SKU matching
2. **Fallback**: Product name matching
3. Items with missing supplier grouped as "(No supplier)"

Discounts are proportionally distributed across items in receipt.

### Profit Analysis

```
Profit = Sales - COGS
Margin % = (Profit / Sales) × 100
```

### Operation Hours

Default analysis window: **10 AM - 12 AM (11 PM)** - customizable in code

## Running the Project

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
npm start

# Format code
npm run format
```

Open [http://localhost:3000](http://localhost:3000) to view the site.

Navigate to [http://localhost:3000/sales-assessment](http://localhost:3000/sales-assessment) for the analytics dashboard.

## Features in Detail

### Daily Sales Tab
Primary view showing:
- Days in period
- Total transactions
- Total sales and costs
- Overall profit

Displays daily breakdown table with date, sales, cost, profit, and margin %.

### Sales by Time Tab
Two viewing modes:
- **By Hour**: Hourly breakdown with bar chart, trend line, and hourly table
- **By Day of Week**: 7-day pattern analysis with mini trend charts per day

### Sales by Products Tab
- Top 10 performing products bar chart
- All products breakdown table
- Unit quantities and cost analysis

### Payment Type Tab
Shows breakdown of:
- Cash payments
- QR payments
- Credit/Debit card payments
- Total payment value

### Staff Performance Tab
Individual staff metrics:
- Sales value
- Transaction count
- Discounts given
- Cost and profit analysis

### Sales by Supplier Tab
Supplier-focused analytics:
- Top 10 suppliers by sales
- Complete supplier breakdown
- Supplier profitability
- Unit volume per supplier

## Export Functionality

Generate PDF reports with:
- All current dashboard metrics and charts
- Timestamp and date range information
- Professional A4 formatting
- Multi-page support for large reports

## Notes

- All calculations include proper discount distribution
- Timezone: Malaysia (MYT)
- Currency: Ringgit Malaysia (RM)

## License

Private project for Gembira Momento
