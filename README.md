# My Financial Compass

My Financial Compass is a personal finance dashboard for tracking cash, investments, debts, receivables, and transactions in one place. It is designed to make financial data easier to reconcile and understand, with specific support for M-Pesa SMS imports and Fuliza overdraft accounting.

## What it does

- Tracks cash, investment, debt, and receivable accounts.
- Records and reviews income, expenses, transfers, and other transactions.
- Imports M-Pesa SMS messages for review before transactions are saved.
- Separates Fuliza from external debt while keeping the M-Pesa balance synchronized.
- Calculates total debt, available M-Pesa balance, and net worth using consistent accounting rules.
- Provides reports, spending views, and a food budget view.
- Persists recent query data locally so the application can remain useful when the backend is temporarily unavailable.
- Includes public product pages and technical documentation.

## Public pages

The site can be visited without signing in:

- `/` - Landing page
- `/apps` - Applications and downloads
- `/Documentation` - Ledger, M-Pesa, and MacroDroid setup guide
- `/auth` - Sign in and account creation

The Android Ledger APK is available from the Apps page and is served as `public/ledger.apk`.

## Authenticated application

After signing in, the main application is available at `/app`:

- **Dashboard** - Financial overview, debt, net worth, cash flow, and account summaries.
- **Accounts** - Manage cash, investment, debt, and receivable accounts.
- **Transactions** - Review and manage recorded transactions.
- **Import SMS** - Parse M-Pesa messages and confirm imported transactions.
- **Reports** - Review financial reports and trends.
- **Food** - Track food-related spending.

## Accounting rules

### Debt

Every account with `type === "debt"` contributes to total debt. Stored balances are converted to absolute values so both positive and negative debt balances represent the amount owed:

```ts
const totalDebt = accounts
  .filter((account) => account.type === "debt")
  .reduce((sum, account) => sum + Math.abs(Number(account.balance) || 0), 0);
```

### Fuliza and net worth

Fuliza is identified using the shared `isFuliza()` classification helper, not by assuming that every debt account is Fuliza. A negative M-Pesa cash balance already represents the Fuliza overdraft, so Fuliza is excluded from the debt deduction when net worth is calculated. External debt accounts are deducted separately.

```text
net worth =
  total cash
  + total investments
  + total receivables
  - external debt
```

### M-Pesa available balance

- A negative M-Pesa balance is shown unchanged.
- A positive M-Pesa balance is reduced only by outstanding Fuliza.
- External debts do not affect M-Pesa availability.

The database trigger keeps Fuliza mirrored to the M-Pesa balance: negative M-Pesa balances set the Fuliza balance, while non-negative balances clear it. It does not modify external debt accounts.

## Technology

- React 18 and TypeScript
- Vite
- React Router
- Tailwind CSS and shadcn/ui components
- TanStack React Query with persisted query data
- Supabase client and PostgreSQL migrations
- Drizzle ORM and Drizzle Kit
- Recharts
- Vitest and Testing Library

## Getting started

### Requirements

- Node.js 20 or newer
- npm
- A Supabase project for authenticated application data

### Install dependencies

```bash
npm install
```

### Configure environment variables

Copy the example file and provide the public Supabase configuration:

```bash
cp .env.example .env
```

The required variables are:

```dotenv
VITE_SUPABASE_PROJECT_ID=your-project-id
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Never commit `.env`, service-role keys, database passwords, or other credentials. The repository intentionally tracks only `.env.example`.

### Run the development server

```bash
npm run dev
```

Vite will print the local URL, normally `http://localhost:5173`.

## Available commands

```bash
npm run dev       # Start the Vite development server
npm run build     # Create a production build
npm run preview   # Preview the production build locally
npm run lint      # Run ESLint
npm test          # Run the test suite once
npm run test:watch
```

## Project structure

```text
src/
  components/    Shared UI, layouts, navigation, and route protection
  content/       Public documentation content
  hooks/         Authentication, theme, and data hooks
  lib/           Shared calculations, Supabase client, and utilities
  pages/         Public and authenticated route pages
  integrations/  Backend integration code
public/          Static assets, including the Ledger APK
supabase/        Database migrations and generated backend configuration
```

The central accounting helpers are in [`src/lib/finance.ts`](./src/lib/finance.ts), with regression tests in [`src/lib/finance.test.ts`](./src/lib/finance.test.ts).

## Testing the accounting calculations

The regression suite covers the Fuliza and debt edge cases, including:

- M-Pesa cash: `-600`
- Fuliza debt: `-600`
- External debt: `1,600`
- Other cash: `5,000`
- Investments: `2,000`
- Receivables: `500`

Expected results:

| Metric | Expected value |
| --- | ---: |
| Total debt | KES 2,200 |
| Total cash | KES 4,400 |
| Total investments | KES 2,000 |
| Total receivables | KES 500 |
| Net worth | KES 5,300 |
| M-Pesa available | -KES 600 |

Run the focused tests with:

```bash
npm test -- src/lib/finance.test.ts
```

## Database and migrations

Database migrations are stored in [`supabase/migrations`](./supabase/migrations). Apply them through the normal Supabase workflow for the project. The Fuliza mirror trigger is defined in the migration containing `tg_auto_fuliza_balance()`.

Account balances should be changed through the application or approved database workflows. Do not edit balances or transaction history to change a displayed calculation.

## Documentation

The complete M-Pesa SMS and MacroDroid setup guide is maintained in [`src/content/ledger-mpesa-sms-guide.md`](./src/content/ledger-mpesa-sms-guide.md) and rendered on the public Documentation page.

## Contributing

1. Create a focused branch for the change.
2. Keep financial calculations in shared helpers where possible.
3. Add regression tests for changes to accounting behavior.
4. Run `npm run lint`, `npm test`, and `npm run build`.
5. Do not commit environment files, credentials, generated secrets, or private user data.

## License

No license has currently been specified for this repository.
