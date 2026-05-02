You are an expert full-stack engineer, product designer, and financial analyst.

Your task is to design and continuously improve a personal finance web application with AI-assisted insights.

Core Objective

Build a centralized financial intelligence dashboard that helps track, analyze, and optimize personal finances across multiple accounts, investments, debts, and expected income.

---

Accounts to Support

The system must support multiple account types:

- Mobile money (M-Pesa)

- Money Market Funds (Ziidi MMF, Etica MMF)

- Trading/Investment accounts (Ziidi Trader, other assets)

- Debt accounts (Fuliza)

- Receivables (expected money)

Each account must store:

- name

- type (cash, investment, debt, receivable)

- current balance

- historical balance changes

- last updated timestamp

---

Transactions System

Implement a robust transaction engine.

Each transaction must include:

- amount (positive = inflow, negative = outflow)

- category (food, transport, rent, etc.)

- account

- date

- description

- source (manual, parsed, AI-assisted)



M-Pesa Statement Parsing

The system must accept raw pasted M-Pesa SMS statements and:

1. Extract:

   - transaction type (send, receive, paybill, withdrawal)

   - amount

   - counterparty

   - date

2. Automatically create transactions

3. Use AI to suggest categories

4. Ask for user confirmation before finalizing

Investment Tracking (MMF & Assets)

Track investments with daily compounding:

- principal

- daily interest rate

- accrued interest

- historical rate changes



System must:

- recalculate expected returns daily

- store historical rates

- visualize growth over time

Interest Validation

The system must compare:

- expected interest (calculated)

- actual interest (user input or statement)

If discrepancy exists:

- calculate difference

- flag inconsistencies

- log anomalies

---

Debt Tracking (Fuliza)

Track:

- usage frequency

- accumulated fees

- interest over time

Provide insights on:

- cost of borrowing

- behavioral patterns



Expected Money (Receivables)

Allow tracking of incoming money:

- amount

- source

- expected date

- status (pending/received)

Analytics Dashboard

Provide visual insights including:

1. Cash flow (income vs expenses over time)

2. Spending breakdown by category

3. Account distribution (where money is stored)

4. Debt trends

5. Investment growth

Use tables and graphs.

---

AI Assistant Behavior

The AI must act as a financial analyst, not an autonomous agent.

It should:

- categorize transactions

- detect unusual spending

- summarize daily/weekly/monthly financial behavior

- suggest optimizations (saving, reducing expenses)

It must NOT:

- make financial decisions

- modify data without user confirmation

- execute transactions



User Workflow

Daily:

- User pastes M-Pesa messages

- AI parses and suggests categories

- User confirms/edit

- Dashboard updates

Weekly:

- AI generates spending insights and warnings

Monthly:

- AI generates a financial report including:

  - total income

  - total expenses

  - savings rate

  - investment performance

  - debt cost

---

UI/UX Requirements

- Clean dashboard layout

- Tables for transactions

- Graphs for trends

- Quick add/edit transactions

- Highlight anomalies and warnings clearly

---

Technical Requirements

- Frontend: React

- Backend: Node.js + Express

- Database: MongoDB

- Modular architecture

- Scalable schema design

---

Constraints

- Accuracy is critical — never assume financial data

- Always confirm ambiguous parsed data

- Maintain audit trail of all changes

- Prioritize clarity over automation

Continuous Improvement

You should iteratively:

- improve parsing accuracy

- refine categorization

- enhance financial insights

- simplify user workflows

Always justify improvements before applying them.

Your goal is to build a reliable, transparent, and insightful financial system that helps the user understand exactly where their money is going and how to optimize it.

Build the backend first.![alt text](image.png)