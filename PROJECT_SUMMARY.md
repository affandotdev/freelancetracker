# 🚀 Freelance Project & Team Tracker — Architecture & Workflow Guide

A full-stack, enterprise-grade freelance project and team management system built with **Next.js 16 (App Router & Turbopack)**, **React 19**, **PostgreSQL**, **Prisma ORM**, and **Tailwind CSS**.

---

## 📌 Table of Contents
1. [Project Overview](#-project-overview)
2. [Role-Based Access Control](#-role-based-access-control)
3. [Tech Stack & Architecture](#-tech-stack--architecture)
4. [Environment & Configuration](#-environment--configuration)
5. [Database Schema & Models](#-database-schema--models)
6. [End-to-End User Workflows](#-end-to-end-user-workflows)
   - [Authentication & Auto-Seeding](#1-authentication--auto-seeding)
   - [Team Management & Worker Onboarding](#2-team-management--worker-onboarding)
   - [Project Creation & Task Assignment](#3-project-creation--task-assignment)
   - [Worker Dashboard & Task Execution](#4-worker-dashboard--task-execution)
   - [Work Updates & Objection Resolution](#5-work-updates--objection-resolution)
   - [Documents, Quotations & Photos](#6-documents-quotations--photos)
7. [Application & Directory Structure](#-application--directory-structure)
8. [API Routes & Server Actions](#-api-routes--server-actions)
9. [Deployment & CI/CD Pipeline](#-deployment--cicd-pipeline)

---

## 🌟 Project Overview

The **Freelance Project & Team Tracker** (`Work_plan`) extends traditional freelance financial tracking into a **collaborative team management system**. It bridges the gap between client financials and worker execution by allowing business owners to break projects into assignable deliverables, monitor worker activity, and address blockers in real time.

---

## 👥 Role-Based Access Control

The system strictly enforces two roles at both middleware and server-action levels:

| Role | Scope | Permissions |
| :--- | :--- | :--- |
| **`SUPER_ADMIN`** | Business Owner / Lead | Creates & updates projects, manages team members, assigns tasks, views global activity feed, resolves objections, and accesses project financials. |
| **`MEMBER`** | Freelance Worker | Restricted to personal dashboard showing only their assigned tasks. Can update task progress/status, post work updates, and raise objections. Cannot access other workers' tasks, financials, or `/team` / `/objections` / `/projects`. |

---

## 🛠️ Tech Stack & Architecture

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Framework** | Next.js 16.3.4 (App Router) | Server Components, Server Actions, Turbopack compilation |
| **Frontend UI** | React 19 + Tailwind CSS | Role-based layouts, responsive modals, progress sliders, activity feeds |
| **Language** | TypeScript 5 | End-to-end type safety |
| **Database** | PostgreSQL + Prisma 6.19.3 | Relational schema with direct connections (`directUrl`) and connection pooler support |
| **Password Hashing** | `bcryptjs` | Salt rounds = 10; zero-compilation pure JS implementation |
| **Auth** | Encrypted JWT (`jose`) | HTTP-only session cookies with Edge-ready middleware guard |
| **Storage** | PostgreSQL (Base64) + Cloud URLs | In-DB storage for files up to 4.5MB + support for Google Drive / Figma / Notion |
| **Hosting** | Vercel | Automatic CI/CD deployments triggered on GitHub push to `main` |

---

## 🔐 Environment & Configuration

Environment variables configured in `.env`:

```env
# PostgreSQL Connection Strings
DATABASE_URL="postgresql://user:password@host-pooler/dbname?sslmode=require"
DIRECT_URL="postgresql://user:password@host-direct/dbname?sslmode=require"

# Initial Super Admin Seed Credentials
SEED_ADMIN_EMAIL="admin@workplan.dev"
SEED_ADMIN_PASSWORD="your-secure-password"

# Legacy Fallback Credentials
APP_USERNAME="admin"
APP_PASSWORD="your-secure-password"

# JWT Session Secret (minimum 32 characters)
SESSION_SECRET="your-super-secret-jwt-signing-key-here-32-chars-min"
```

---

## 🗄️ Database Schema & Models

Defined in `prisma/schema.prisma`:

### 1. `User`
```prisma
model User {
  id            String      @id @default(cuid())
  name          String
  email         String      @unique
  passwordHash  String
  role          String      @default("MEMBER") // SUPER_ADMIN | MEMBER
  createdAt     DateTime    @default(now())
  tasksAssigned Task[]      @relation("AssignedTasks")
  objections    Objection[]
}
```

### 2. `Project`
```prisma
model Project {
  id              String       @id @default(cuid())
  name            String
  client          String?
  clientEmail     String?
  category        String?      @default("Web Development")
  priority        String       @default("Medium")
  status          String       @default("Not Started")
  progress        Int          @default(0)
  totalAmount     Float        @default(0)
  receivedAmount  Float        @default(0)
  deadline        DateTime?
  description     String?
  attachments     Attachment[]
  tasks           Task[]
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
}
```

### 3. `Task`
```prisma
model Task {
  id            String       @id @default(cuid())
  projectId     String
  project       Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  title         String
  description   String?
  assignedToId  String?
  assignedTo    User?        @relation("AssignedTasks", fields: [assignedToId], references: [id])
  status        String       @default("To Do") // To Do | In Progress | In Review | Done | Blocked
  progress      Int          @default(0)
  deadline      DateTime?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  objections    Objection[]
  updates       TaskUpdate[]

  @@index([projectId])
  @@index([assignedToId])
}
```

### 4. `TaskUpdate`
```prisma
model TaskUpdate {
  id        String   @id @default(cuid())
  taskId    String
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  text      String
  createdAt DateTime @default(now())

  @@index([taskId])
}
```

### 5. `Objection`
```prisma
model Objection {
  id          String    @id @default(cuid())
  taskId      String
  task        Task      @relation(fields: [taskId], references: [id], onDelete: Cascade)
  raisedById  String
  raisedBy    User      @relation(fields: [raisedById], references: [id])
  message     String
  status      String    @default("Open") // Open | Resolved
  resolution  String?
  createdAt   DateTime  @default(now())
  resolvedAt  DateTime?

  @@index([taskId])
  @@index([raisedById])
}
```

---

## 🔄 End-to-End User Workflows

### 1. Authentication & Auto-Seeding
1. Unauthenticated users visiting any route are redirected to `/login`.
2. On first run or new deployment, if the database has 0 users, the system automatically creates the initial `SUPER_ADMIN` account from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (default: `admin@workplan.dev` / `admin123`).
3. Users authenticate via work email and password. `bcryptjs` verifies the password hash.
4. An encrypted JWT cookie containing `userId`, `name`, `email`, and `role` is issued.

### 2. Team Management & Worker Onboarding (`/team`)
- Super Admin opens `/team` and clicks **+ Add Team Member**.
- Enters worker name, email, and temporary password.
- The worker account is created with role `MEMBER`.
- Super Admin can remove members; removing a member unassigns their tasks automatically.

### 3. Project Creation & Task Assignment (`/projects/[id]`)
- Super Admin creates projects on `/projects/new` (with contract value, deposit, and deadline).
- Under the project detail page, the **Deliverable Tasks** section allows the admin to click **+ Add Task**, enter deliverables, select a team member from the dropdown, and set an optional task deadline.

### 4. Worker Dashboard & Task Execution (`/`)
- Freelance worker logs in and lands on their personal workspace.
- The dashboard displays only tasks assigned to them, with filters (`All`, `To Do`, `In Progress`, `In Review`, `Done`, `Blocked`).
- Worker clicks a task to open `/tasks/[id]`, where they can adjust the progress slider (0–100%) and select a status.

### 5. Work Updates & Objection Resolution (`/tasks/[id]` & `/objections`)
- **Work Updates Log**: Worker types a progress note ("Finished authentication API") and clicks "Post Update". It appears in chronological order and on the Super Admin's live activity feed.
- **Raise an Objection**: When blocked, the worker clicks "+ Raise an Objection". The task changes to `Blocked` and routes the blocker to the Super Admin's `/objections` inbox.
- **Resolution**: Super Admin reviews the objection on `/objections`, writes a resolution note, and marks it resolved. The task automatically shifts back to `In Progress`.

---

## 📁 Application & Directory Structure

```
Work_plan/
├── app/
│   ├── api/attachments/            # Attachment upload and download handlers
│   ├── login/page.tsx              # Secure authentication login screen
│   ├── objections/                 # Super Admin objections inbox
│   │   ├── page.tsx
│   │   └── ObjectionsClient.tsx
│   ├── projects/
│   │   ├── [id]/                   # Project detail with tasks & attachments
│   │   └── new/page.tsx            # Project & lead creation
│   ├── accounts/                   # Accounts ledger & payment history
│   │   ├── page.tsx                # Main ledger with CSV export
│   │   └── [projectId]/            # Project account detail with payment logs & invoices
│   ├── commissions/                # Commission & referral payouts
│   │   └── page.tsx
│   ├── invoices/                   # Sequential invoice print engine
│   │   └── [id]/page.tsx           # Print-friendly invoice sheet
│   ├── tasks/
│   │   └── [id]/                   # Role-aware task detail workspace
│   │       ├── page.tsx
│   │       └── TaskDetailClient.tsx
│   ├── team/                       # Super Admin team management
│   │   ├── page.tsx
│   │   ├── [id]/page.tsx           # Member deliverables & direct task assignment
│   │   └── TeamClient.tsx
│   ├── layout.tsx                  # Root layout with role-based navigation & print isolation
│   └── page.tsx                    # Role-aware dashboard (Admin vs Member)
├── components/
│   ├── BackButton.tsx              # Universal back navigation
│   ├── ExportCsvButton.tsx         # Reusable client-side CSV downloader
│   ├── PaymentHistoryTable.tsx     # Itemized payment log table
│   ├── AddPaymentForm.tsx          # Real payment recording form
│   ├── InvoiceList.tsx             # Invoice management table
│   ├── ActivityFeed.tsx            # Recent team events stream
│   ├── DashboardClient.tsx         # Super Admin project & revenue dashboard
│   ├── MemberDashboardClient.tsx   # Freelance worker personal task dashboard
│   ├── TaskCard.tsx                # Reusable task card with progress & alerts
│   └── TaskStatusBadge.tsx         # Color-coded status badges
├── lib/
│   ├── actions.ts                  # Server Actions (payments, invoices, commissions, tasks)
│   ├── csvExport.ts                # Client-side RFC-4180 CSV export generator
│   ├── invoiceNumber.ts            # Auto-incrementing invoice number generator
│   ├── dateUtils.ts                # Two-way date/days calculation utilities
│   ├── prisma.ts                   # Singleton Prisma Client
│   ├── roles.ts                    # Server-side role authorization helpers
│   └── session.ts                  # JWT token creation & Edge verification
├── prisma/
│   ├── schema.prisma               # PostgreSQL models (User, Project, Payment, Invoice, Task, Commission)
│   └── seed.ts                     # Standalone Super Admin seed script
└── proxy.ts                        # Next.js 16 Edge network route protection guard
```

---

## 🚀 Build & Deploy to Vercel

```powershell
# 1. Stage all new files
git add .

# 2. Commit changes
git commit -m "Upgrade Accounts Ledger: Payment History, Invoices, CSV Export, and Print Engine"

# 3. Push to GitHub (triggers Vercel deployment)
git push origin main
```
