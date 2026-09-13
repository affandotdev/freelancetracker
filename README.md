# 🚀 Freelance Project Tracker

A full-stack, enterprise-grade project and financial management web application built with **Next.js 16 (App Router & Turbopack)**, **React 19**, **PostgreSQL**, **Prisma ORM**, and **Tailwind CSS**.

---

## ✨ Features

- **📊 Comprehensive Dashboard**: Top KPI cards for Total Contract Value, Cash Received, and Pending Receivables.
- **💡 Pipeline Management**: Track projects through **Enquiry (Lead)**, **Planning / Upcoming**, **Active Work**, and **Completed** stages.
- **⏱️ Flexible Deadline & Duration**:
  - Two-way synchronized calendar picker and duration in days (e.g. `20`, `30` days).
  - One-click presets (`+7d`, `+15d`, `+20d`, `+30d`, `+45d`, `+60d`).
  - One-click deadline extensions on project details (`+7d`, `+15d`, `+30d`).
  - Dynamic status alerts: Overdue, Due Today, Urgent, and Planning.
- **📁 Quotations, Documents & Photos**:
  - Permanent inline upload suite supporting direct file uploads (up to 4.5MB) and external cloud links (Google Drive, Figma, Notion).
  - Categorization pills: `📄 Quotation`, `🧾 Invoice`, `📝 Contract`, `💳 Receipt`, `🖼️ Photo`, `📎 Other`.
  - Built-in interactive document/photo preview modal and direct download.
- **🔒 Secure Authentication**: Cookie-based JWT sessions with Next.js Edge middleware route protection.
- **⚡ Automated CI/CD**: Automatic production deployments on Vercel via GitHub `main` branch pushes.

---

## 📖 Complete Documentation

For the full architectural breakdown, database models, and end-to-end workflows, see [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md).

---

## 🛠️ Getting Started

### 1. Prerequisites
- Node.js 18+ installed
- PostgreSQL database (Supabase, Neon, Railway, or local)

### 2. Environment Setup
Create a `.env` file in the root directory:

```env
DATABASE_URL="postgresql://user:password@host:port/dbname?sslmode=require"
APP_USERNAME="admin"
APP_PASSWORD="your-secure-password"
SESSION_SECRET="your-super-secret-jwt-signing-key-here-32-chars-min"
```

### 3. Install & Run
```bash
# Install dependencies
npm install

# Generate Prisma Client
npx prisma generate

# Push DB schema
npx prisma db push

# Start development server
npm run dev
```

Visit `http://localhost:3000` and log in with your configured credentials.

---

## 🚀 Build & Deploy

```bash
# Verify production build locally
npm run build

# Push to GitHub (Vercel deploys automatically)
git add .
git commit -m "Deploy update"
git push origin main
```
