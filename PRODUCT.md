# FS25 Accounting — Product Overview

A local webapp that adds a realistic business/finance layer on top of Farming Simulator 25. The goal is entertainment — watching the numbers, tracking company growth, managing investors, making leasing vs buying decisions. Not formal accounting education, no chart of accounts numbers — just the concepts that make business management fun.

## Core Concepts

### Cash
All operations flow through cash. Revenue increases it, expenses decrease it. Asset purchases, loan repayments, and dividends also affect cash. Depreciation does **not** — it's a non-cash charge.

### Revenue & Expenses
- **Revenue**: crop sales, animal sales, wood, contracts, missions, subsidies, capital gains
- **Expenses**: seeds, fertilizer, fuel, feed, salaries, maintenance, land rent, lease payments, loan interest, capital losses

### Fixed Assets & Depreciation
When buying something, the user chooses:
- **Expense** (charge) — hits the P&L immediately, reduces profit
- **Investment** (asset) — tracked on the balance sheet, depreciates over time

Depreciation schedule (straight-line):
| Type | Duration |
|------|----------|
| Vehicle | 5 years |
| Building | 10 years |
| Land | Never |

Depreciation reduces asset value and profit but **not** cash.

### Asset Sales
Selling an asset liquidates it at its current net book value (purchase price minus accumulated depreciation). The difference between sale price and NBV is:
- **Capital gain** (revenue) if sold above NBV
- **Capital loss** (expense) if sold below NBV

### Leasing
An alternative to buying outright:
1. **Sign lease**: down payment + monthly payment amount + duration + residual value
2. **Monthly**: record payment (cash goes down, expense recorded)
3. **End of lease**: "Purchase" (pay residual value, asset created with depreciation) or "Return" (nothing more owed)

Remaining lease obligations count against company valuation.

### Loans
- Taking a loan increases cash and creates a debt
- Monthly payments are split: principal (reduces debt) + interest (expense on P&L)
- Outstanding balance counts against company valuation

### Company Valuation
```
Valuation = Cash + Total Asset NBV - Total Debt - Remaining Lease Obligations
```

### Shares & Investors
- 500,000 starting capital split into 5,000 shares at 100 each
- 50% investors (2,500 shares) / 50% farm (2,500 shares)
- **Share price** = Valuation / Total shares — the number everyone watches
- **Buyback lock**: investors can't sell back until share price reaches 2x initial (200/share)

### Year-End Closing
At fiscal year end, profit is allocated:
1. **Absorb accumulated losses** — past losses must be covered first
2. **Tax** — applied at a user-configurable rate (default 25%)
3. **Dividends** — free field, user decides how much to distribute (up to after-tax profit)
4. **Reserve** — remainder stays in the company

If the year is a loss, it gets accumulated and must be offset by future profits before any dividends can be paid.

Manual dividends can also be paid at any time from available cash.

### Profit / Loss
```
Profit = Total Revenue - Total Expenses - Depreciation
```

### Cash Balance
```
Cash = Initial Capital
     + Revenue - Expenses
     - Asset Purchases + Asset Sales
     + Loan Proceeds - Loan Principal Payments
     - Dividends Paid
```

## Pages

| Page | Purpose |
|------|---------|
| **Dashboard** | Cash, share price, valuation, current period. Revenue vs expenses chart, share price history, recent transactions, quick action buttons. |
| **Transactions** | Add/delete revenue and expense entries. Quick templates for common FS25 operations. Filter by period. |
| **Assets** | Buy/sell assets. See depreciation progress, net book value, depreciation schedule per asset. Sold assets history with gain/loss. |
| **Leases** | Create leases, record monthly payments, buy out or return at end. Progress tracking. |
| **Loans** | Create loans, record payments with auto principal/interest split. Progress tracking. |
| **Income Statement** | Revenue and expense breakdown by category, depreciation, net profit. Filter by period or full year. |
| **Balance Sheet** | Assets (cash + fixed assets NBV) vs Liabilities & Equity (capital + profit + losses + debt + lease obligations). Must balance. |
| **Shares & Investors** | Share price, valuation breakdown, investor return tracking, buyback eligibility, dividend history, pay dividend. |
| **Periods** | Timeline of fiscal years and months. Open/close months. Year-end closing wizard. |
| **Settings** | Tax rate configuration. Export/import/reset database. |

## Data Persistence
- SQLite database running in the browser (via WebAssembly)
- Saved to IndexedDB automatically
- Export/import as `.db` file to move data between machines
- Entire app ships as a single HTML file — no server needed
