# 🚀 WorkPlan • Comprehensive Application & System Architecture Guide

**WorkPlan** is a full-stack, enterprise-grade **Freelance Deliverables, Team Management, Accounts Ledger & Commission System** built with **Next.js 16 (App Router & Turbopack)**, **React 19**, **PostgreSQL (Neon DB)**, **Prisma ORM**, and **Tailwind CSS**.

It is engineered with **strict server-side role isolation** supporting two operational roles:
1. **`SUPER_ADMIN`** (Agency Owner / Lead): Manages client projects, assigns deliverables, oversees agency cashflow, tracks referral commissions, manages worker accounts, and resolves team blockers.
2. **`MEMBER`** (Freelance Worker): An isolated, clutter-free personal workspace displaying only their assigned tasks, with progress sliders, work update logs, and roadblock reporting.

---

## 📌 Table of Contents
1. [Application Map & Routes](#-application-map--routes)
2. [Core Feature Modules](#-core-feature-modules)
   - [Universal Back Navigation](#1-universal-back-navigation-backbutton)
   - [Team Member Workspaces & Direct Task Assignment](#2-team-member-workspaces--direct-task-assignment-team--teamid)
   - [Accounts & Financial Ledger](#3-accounts--financial-ledger-accounts)
   - [Commission & Referral Tracking](#4-commission--referral-tracking-commissions)
   - [Objections & Roadblocks Engine](#5-objections--roadblocks-engine-objections)
   - [Project Cockpit & Documents](#6-project-cockpit--documents-projectsid)
3. [Role-Based Access Control & Security](#-role-based-access-control--security)
4. [Database Schema & Entity Relations](#-database-schema--entity-relations)
5. [Server Actions & API Architecture](#-server-actions--api-architecture)
6. [Pre-Configured Credentials](#-pre-configured-credentials)
7. [Deployment & Verification](#-deployment--verification)

---

## 🧭 Application Map & Routes

| Route | Access Role | Description & Primary Capabilities |
| :--- | :--- | :--- |
| **`/`** | Both (Differentiated) | **Admin**: Financial KPIs, project cards, team stats, live activity feed.<br>**Worker**: Isolated workspace with assigned deliverables, status tabs & completion metrics. |
| **`/team`** | `SUPER_ADMIN` | Team roster, worker credentials, active tasks, "+ Add Team Member", and direct links to individual member profiles. |
| **`/team/[id]`** | `SUPER_ADMIN` | **Member Workspace**: Detailed deliverable breakdown for a worker, live progress sliders, status dropdowns, and **"+ Assign Work to Member"** modal. |
| **`/accounts`** | `SUPER_ADMIN` | **Financial Ledger**: Opened by clicking **"Total Pipeline"** card on Dashboard. Live client contract values, cash collected, pending receivables, full ledger CSV export, and quick payment recording. |
| **`/accounts/[projectId]`** | `SUPER_ADMIN` | **Project Account Workspace**: Itemized payment history table, payment deletion with auto-resync, "+ Record Payment" form, and invoice manager. |
| **`/invoices/[id]`** | `SUPER_ADMIN` | **Print-Ready Invoice**: Clean, isolated layout with sequential numbering (`INV-0001`), `@media print` formatting, and browser-native "Print / Save as PDF" button. |
| **`/commissions`** | `SUPER_ADMIN` | **Commission System**: Track referral cuts, sales percentages, beneficiary names, linked projects, and 1-click **"Mark as Paid"** disbursements. |
| **`/objections`** | `SUPER_ADMIN` | **Roadblocks Inbox**: Real-time worker blockers across all projects with 1-click resolution and auto-status unblocking. |
| **`/projects/new`** | `SUPER_ADMIN` | Onboard new clients & projects: deliverables, client contacts, categories, duration calculator, and financial milestones. |
| **`/projects/[id]`** | `SUPER_ADMIN` | Deep-dive project cockpit: financial health, task breakdown with assignments, cloud file attachments & photo receipts. |
| **`/tasks/[id]`** | Both (Authorized Only) | Detailed deliverable view: interactive progress slider, timestamped work logs, and objection raising/resolving. |
| **`/issues`** | Both | **Bug & Issue Tracker**: Report quality defects against projects & members, filter by priority/assignee, update resolution status, and track bug fixes in real-time. |
| **`/login`** | Public | Secure authentication portal with bcrypt password verification and session cookie management. |

---

## 🌟 Core Feature Modules

### 1. Universal Back Navigation (`BackButton`)
- A consistent `← Back` button is present across all subpages (`/team`, `/team/[id]`, `/accounts`, `/commissions`, `/objections`, `/projects/new`, `/projects/[id]`, `/tasks/[id]`).
- Supports smart browser history navigation (`router.back()`) with safe fallback routes (e.g. `/`, `/team`, `/projects/[id]`).
- Includes interactive hover micro-animations and breadcrumb-style text.

### 2. Team Member Workspaces & Direct Task Assignment (`/team` & `/team/[id]`)
- **Clickable Roster**: In `/team`, clicking any team member row or the **"View Work & Assign →"** button opens `/team/[id]`.
- **Member Cockpit**:
  - Worker header with avatar, name, email, role badge, and joined date.
  - KPI cards: Total Deliverables, In Progress, Completed, Overdue/Blocked.
  - Status filters (`All`, `In Progress`, `Done`, `Blocked`).
  - Real-time status dropdowns (`To Do`, `In Progress`, `In Review`, `Done`, `Blocked`) and progress sliders (0–100%) that Super Admin can adjust directly.
- **Direct Task Assignment**:
  - Super Admin can click **"+ Assign Work to [Member Name]"** directly from the member's profile.
  - Form selects from active projects, inputs task title, description, and target deadline.
  - Submits via `assignTaskToMemberAction` and instantly appears in the worker's workspace.

### 3. Accounts & Financial Ledger (`/accounts`)
- **Interactive Dashboard Integration**:
  - On the main dashboard, clicking the **"Total Pipeline"** card or **"View accounts →"** navigates directly to `/accounts`.
- **Financial Intelligence**:
  - Top KPI cards: Total Contracted Value, Cash Collected, Pending Receivables, and Settlement Ratio % progress bar.
  - Search & filter: Search by client or project name; filter by `All`, `Paid in Full`, `Partially Paid`, `Unpaid`.
  - Detailed ledger table displaying agreed value, received amount, remaining balance, collection status pill, and percentage bar.
- **Quick Payment Recording**:
  - Built-in **"Record Payment"** modal allowing the Super Admin to update collected amounts in real time via `recordPaymentAction`.

### 4. Commission & Referral Tracking (`/commissions`)
- **Dedicated Commission Section**:
  - Added directly to the primary navigation bar in the Super Admin suite.
- **Tracking & Capabilities**:
  - Record commissions for any person (deal finders, partners, sales agents, or team members).
  - Track beneficiary name, optional linked project, fixed amount (₹), percentage cut (%), notes, and payout status (`Pending` vs `Paid`).
  - Filter by `All`, `Pending Payout`, `Paid Out`.
  - 1-click **"Mark Paid ✓"** action with timestamp recording via `updateCommissionStatusAction`.

### 5. Objections & Roadblocks Engine (`/objections`)
- **Worker Blocker Reporting**:
  - When a worker encounters an obstacle, clicking "Raise an Objection" flags the deliverable as `Blocked` and notifies the admin.
- **Super Admin Resolution Inbox**:
  - `/objections` inbox allows Super Admin to review blockers and submit resolution notes.
  - Resolving an objection automatically restores the task from `Blocked` to `In Progress`.

### 6. Project Cockpit & Documents (`/projects/[id]`)
- Displays contracted value, advance received, pending balance, and live deadline countdowns.
- In-browser file uploader for quotations, invoices, receipts, and photos (up to 4.5MB).
- Cloud links for external deliverables (Figma, Notion, Google Drive, GitHub).

---

## 🔒 Role-Based Access Control & Security

- **Next.js 16 Proxy Architecture (`proxy.ts`)**:
  - Replaces deprecated Next.js middleware with Next.js 16 `proxy` convention.
  - Intercepts all requests before route execution.
  - Automatically redirects non-authenticated users to `/login`.
  - Workers (`MEMBER`) attempting to access `/team`, `/team/*`, `/accounts`, `/commissions`, `/objections`, or `/projects/*` are immediately redirected to `/`.
  - Automatically prunes invalid or corrupted session cookies to prevent redirect loops (`ERR_TOO_MANY_REDIRECTS`).
- **Cryptographic Security**:
  - All user passwords are encrypted using `bcryptjs` with salt rounds = 10.
  - Passwords are never returned to client components or exposed in logs.
- **Neon Cold-Start Resilience**:
  - Database queries use wrapped `try/catch` fallbacks, preventing 500 error crashes during Neon serverless cold starts.

---

## 🗄️ Database Schema & Entity Relations

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

generator client {
  provider = "prisma-client-js"
}

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
  commissions     Commission[]
  payments        Payment[]
  invoices        Invoice[]
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
}

model Task {
  id            String       @id @default(cuid())
  projectId     String
  project       Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  title         String
  description   String?
  assignedToId  String?
  assignedTo    User?        @relation("AssignedTasks", fields: [assignedToId], references: [id])
  status        String       @default("To Do")
  progress      Int          @default(0)
  deadline      DateTime?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  objections    Objection[]
  updates       TaskUpdate[]

  @@index([projectId])
  @@index([assignedToId])
}

model Commission {
  id          String    @id @default(cuid())
  projectId   String?
  project     Project?  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  beneficiary String
  amount      Float
  percentage  Float?
  status      String    @default("Pending") // Pending | Paid
  notes       String?
  paidAt      DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([projectId])
}

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

model TaskUpdate {
  id        String   @id @default(cuid())
  taskId    String
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  text      String
  createdAt DateTime @default(now())

  @@index([taskId])
}

model Attachment {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name        String
  category    String   @default("Quotation")
  mimeType    String
  size        Int      @default(0)
  fileData    String   @db.Text
  isLink      Boolean  @default(false)
  createdAt   DateTime @default(now())

  @@index([projectId])
}

model Payment {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  amount      Float
  method      String   @default("Bank Transfer") // Cash | Bank Transfer | UPI | Cheque | Other
  note        String?
  paidOn      DateTime @default(now())
  createdAt   DateTime @default(now())

  @@index([projectId])
}

model Invoice {
  id             String   @id @default(cuid())
  projectId      String
  project        Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  invoiceNumber  String   @unique   // e.g. INV-0001, auto-incremented
  issueDate      DateTime @default(now())
  dueDate        DateTime?
  amount         Float               // amount this invoice is for
  status         String   @default("Draft") // Draft | Sent | Paid
  notes          String?
  createdAt      DateTime @default(now())

  @@index([projectId])
}

model Issue {
  id           String    @id @default(cuid())
  projectId    String
  project      Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  title        String
  description  String?   @db.Text
  priority     String    @default("Medium") // Low | Medium | High | Critical
  status       String    @default("Open")   // Open | In Progress | Resolved | Closed
  resolution   String?   @db.Text
  raisedById   String
  raisedBy     User      @relation("IssuesRaised", fields: [raisedById], references: [id])
  assignedToId String?
  assignedTo   User?     @relation("IssuesAssigned", fields: [assignedToId], references: [id])
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  resolvedAt   DateTime?

  @@index([projectId])
  @@index([raisedById])
  @@index([assignedToId])
}
```

---

## ⚡ Server Actions & API Architecture

All database modifications are executed via secure Next.js Server Actions with role verification:

- **Authentication**: `loginAction`, `logoutAction`
- **Team**: `createTeamMemberAction`, `removeTeamMemberAction`
- **Projects**: `createProjectAction`, `updateProjectAction`, `deleteProjectAction`
- **Tasks**: `createTaskAction`, `updateTaskAction`, `deleteTaskAction`, `assignTaskToMemberAction`
- **Deliverable Updates & Objections**: `addTaskUpdateAction`, `deleteTaskUpdateAction` (accessible to assigned Member and Super Admin), `raiseObjectionAction`, `resolveObjectionAction`
- **Issues & Bug Tracker**: `createIssueAction`, `updateIssueStatusAction`, `reassignIssueAction`, `deleteIssueAction`
- **Accounts & Payments**: `recordPaymentAction`
- **Commissions**: `createCommissionAction`, `updateCommissionStatusAction`, `deleteCommissionAction`
- **Attachments**: `uploadAttachmentAction`, `deleteAttachmentAction`

### 🐛 Enhanced Member Bug Reporting UX
- **1-Click Teammate Cards & Avatars**: On the Member Dashboard (`/`), `/issues`, and Project pages (`/projects/[id]`), a quick-action teammate bar displays all members as visual chips with initials. Clicking any teammate immediately opens the bug report modal pre-targeted against them.
- **Direct Context from Task Cards**: Every task card (`TaskCard`) features a direct `🐛 Report Bug` button that pre-populates both the project and the assigned teammate automatically.
- **Smart Visual Modal (`ReportBugModal`)**: Step-by-step visual selector with member search, project selection, quick idea tags (e.g. *API 500 error*, *Mobile layout broken*), 1-click priority pills (Critical, High, Medium, Low), and clear target confirmation buttons.
- **Task Detail Integration**: Members viewing `/tasks/[id]` can click `🐛 Report Bug on this Task` from the top header or the roadblocks card to file bugs without leaving the task.

### ⚡ Super Admin Assigned Works & Bugs Monitoring Suite
- **Top Control Suite Switcher**: On the main Admin Panel (`/`), Super Admin can toggle between **📁 Projects & Pipeline**, **⚡ Assigned Works Monitor**, and **🐛 Assigned Bugs Monitor** with live badges and critical indicators.
- **Assigned Works Monitor (`AdminWorksMonitor.tsx`)**:
  - Live KPI strip (Total Works, In Progress, Overdue with pulsing badge, Roadblocks, To Do, Completed, Average Progress).
  - Worker filter bar with member avatars showing live task counts; clicking any worker isolates their workload.
  - Multi-dimensional filters (Status, Project, Search query).
  - Toggle between **Card Grid** and **Compact Monitoring Table** views.
  - Inline quick-actions: 1-click reassignment dropdown, quick status advance (`To Do` / `In Progress` / `Done`), quick progress jump buttons (0%, 25%, 50%, 75%, 100%), roadblock warnings, and latest worker update log.
- **Assigned Bugs Monitor (`AdminBugsMonitor.tsx`)**:
  - Quality KPI metrics (Total Bugs, Critical Blockers, Open, In Progress, Resolved).
  - Worker defect filter chips: see who is assigned which bugs at a glance.
  - Priority & Status filters, project dropdown, and live keyword search.
  - Direct 1-click status advances (`Start Work`, `Resolve Bug` with resolution explanation), inline reassignment dropdown, and delete action.
  - `+ Report New Bug` button opening `ReportBugModal` directly from the monitoring dashboard.

---

## 🔑 Pre-Configured Credentials

| Role | Full Name | Email / Login | Password | Access Scope |
| :--- | :--- | :--- | :--- | :--- |
| **`SUPER_ADMIN`** | Super Admin | `admin@workplan.dev` | `admin123` | Full agency access (Projects, Team, Accounts, Commissions, Objections) |
| **`MEMBER`** | Aslah | `aslah@workplan.dev` | `aslah123` | Personal deliverables workspace only |
| **`MEMBER`** | Jaseel | `jaseel@workplan.dev` | `jaseel123` | Personal deliverables workspace only |
| **`MEMBER`** | Praveen | `praveen@workplan.dev` | `praveen123` | Personal deliverables workspace only |
| **`MEMBER`** | Shahabas | `shahabas@workplan.dev` | `shahabas123` | Personal deliverables workspace only |
| **`MEMBER`** | Nadran | `nadran@workplan.dev` | `nadran123` | Personal deliverables workspace only |
| **`MEMBER`** | Ajith | `ajith@workplan.dev` | `ajith123` | Personal deliverables workspace only |
| **`MEMBER`** | Affan | `affan@workplan.dev` | `affan123` | Personal deliverables workspace only |

---

## 📦 Deployment & Verification

- **Production Build**: Verified with `npm run build` using Next.js 16 Turbopack (0 errors, exit code 0).
- **TypeScript**: `npx tsc --noEmit` passed with 0 errors.
- **Database Engine**: Live on Neon PostgreSQL Serverless (`ep-restless-breeze-ae56nf1t.c-2.us-east-2.aws.neon.tech`).
