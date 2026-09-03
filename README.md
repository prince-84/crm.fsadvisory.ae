# FS Advisory CRM — Real Estate Enterprise System

An enterprise-grade, high-density Real Estate CRM built for **FS Advisory (Dubai)**. The system features a **Laravel 11 RESTful API** backed by a **MySQL RDBMS** and a **Next.js 14+ SPA** styled with custom **Tailwind CSS** following the FS Advisory brand identity.

![FS Advisory CRM](https://img.shields.io/badge/Stack-Next.js%20%7C%20Laravel%20%7C%20MySQL%20%7C%20Tailwind-blue)
![Phases Complete](https://img.shields.io/badge/Status-All%20Modules%20Complete-emerald)
![RDBMS](https://img.shields.io/badge/Database-MySQL%20RDBMS-orange)
![WhatsApp Gateway](https://img.shields.io/badge/WhatsApp-Baileys%20Multi--Device-25D366)
![Telephony](https://img.shields.io/badge/PBX-3CX%20Live%20Integration-blueviolet)

---

## 🏛️ Business Domain & Non-Negotiable Rules

1. **Permanent Contacts vs Transactional Opportunities**: A `Contact` in the Lead Bank is permanent and never removed when an `Opportunity` is created. One Contact can maintain multiple past or active Opportunities over time.
2. **Single Ownership**: Each active Opportunity has exactly **ONE** `current_owner_name` at any given time.
3. **Originating Agent Retention**: The `originating_agent_name` is permanently retained across all ownership transitions.
4. **Opportunity-Level Temperature**: Temperature (`Hot`, `Warm`, `Cold`, `Unqualified`) belongs exclusively to the `Opportunity`, not the Contact.
5. **Mandatory Next Action & SLA Engine**: Every active Opportunity requires a `next_action` and `next_action_due_at`. Missing fields trigger an **ORPHANED OPPORTUNITY** warning.
6. **Controlled Sales Handover**: Handover from Telesales to Sales is a validated, controlled action enforcing mandatory qualification criteria.
7. **SLA Grace Period & Auto-Escalation**: Overdue leads exceeding the 15-minute grace period trigger automatic manager reassignment and audit log breaches.
8. **Real Estate Portals Auto-Ingestion**: Ingests leads from **Property Finder**, **Bayut**, and **Dubizzle** webhooks into the Lead Bank.
9. **Zero-Touch 3CX PBX Telephony Integration**: Auto-matches incoming/outgoing calls by number, creates unknown callers as CRM leads, and logs call histories.
10. **WhatsApp Multi-Device Mirroring & Isolation**: Direct Baileys gateway connection without third-party recurring SaaS dependencies, supporting on-demand avatar caching and persistent LID-to-phone attribution.

---

## 🚀 Implemented Modules & System Features

### Core CRM & Lead Management
- **01 — Lead Pool (`/`)**: High-density master contacts table with 5 KPI summary cards, brand source icons, state badges, and multi-filters.
- **02 — Contact Profile Slide-Over Drawer**: Contact details, active opportunity score bar (84/100), current owner actions, SLA countdown, and interaction timeline.
- **03 — Create Opportunity Modal**: Controlled opportunity creation flow.
- **04 — My Queue Module (`/queue`)**: Daily telesales desk sorted by SLA priority (*Overdue*, *Due Now*, *Hot*, *Upcoming*) with quick `[ CALL NOW ]` actions and simulated portal lead ingestion.
- **05 — Opportunity Workspace (`/opportunities/[id]`)**: Full workspace with tabs for *Buyer Qualification*, *Seller Listing & CMA Valuation*, *Activity Logs*, *Ownership History*, **AI Lead Intent Predictor**, and right-side SLA Action Panel.
- **06 — Sales Handover Validation Modal**: Controlled checklist verifying qualification criteria before transferring ownership from Telesales (*Mako*) to Sales (*Faraz*).
- **07 — Sales Pipeline Kanban (`/pipeline`)**: Stage progression Kanban board.
- **08 — Executive Overview & Analytics (`/overview`)**: Real-time SLA compliance %, handover conversion rates, agent performance leaderboard, and SLA breach audit logs.
- **09 — Administration & Settings Portal (`/settings`)**: Configures portal API keys, webhook URLs, and SLA threshold limits.
- **10 — Duplicate Contact Merger Wizard**: Consolidates duplicate contact profiles into a primary master record.
- **11 — Batch CSV Lead Importer**: Batch CSV lead bank upload wizard.

### Forms, Validation & Catalogs
- **12 — Searchable Select Component & Developer Selection**: Reusable live-searchable dropdowns (`SearchableSelect`) across all forms, Developer dropdown (Emaar, Nakheel, DAMAC, Sobha, etc.) in lead forms, high contrast CTA buttons, and backend persistence.
- **13 — International Country Code & World Nationalities Integration**: Standard `react-international-phone` package in [`PhoneInput.tsx`](file:///d:/FSadvisory-crm/frontend/src/components/PhoneInput.tsx) for automatic international country flags, dial codes (defaulting to UAE `+971`), live search, and auto-formatting. Dataset of ~200 world nationalities across all creation forms.
- **14 — Dynamic Sub-Source Dropdown Integration**: Dynamic `Sub-Source` dropdown (`SearchableSelect`) adapting based on selected Lead Source Channel (Website, Meta Ads, Google Ads, Property Finder, Bayut, Dubizzle, Referral, Walk-in, Database).
- **15 — Lead Sources & Sub-Sources Database CRUD Manager**: Database-backed Lead Sources and Sub-Sources CRUD Management system on [`/settings`](file:///d:/FSadvisory-crm/frontend/src/app/settings/page.tsx) with inline option addition (`+ Add "${search}"`).
- **16 — Tabbed Settings Page & Independent Master Catalogs CRUD Module**: 7-tabbed navigation system on [`/settings`](file:///d:/FSadvisory-crm/frontend/src/app/settings/page.tsx) (Lead Sources, Developers, Projects, Property / Unit Types, Communities, Portal Sync, SLA Governance) backed by independent database tables and REST APIs.
- **17 — 3 Mandatory Fields & Default Unselected Dropdowns**: Strict enforcement of **3 mandatory fields** (*Client Full Name*, *Primary Phone Number*, and *Email Address*) with clean default empty states across dropdowns.
- **18 — Dual Frontend & Backend Validation with Inline Red Field Errors**: Real-time frontend validation and Laravel 422 API error parsing rendering red inline error messages and border highlights.
- **19 — Live Database KPI Summary Cards on Lead Pool**: Direct connection of all 5 summary metric cards (*Total Contacts*, *Available*, *Active Opportunities*, *Reactivation*, *Duplicates*) to `/api/contacts` live database stats.
- **20 — Server-Side Database Pagination**: Dynamic server-side pagination for Lead Pool backed by Laravel's Eloquent Paginator with customizable page size (10, 20, 50, 100).
- **21 — Restored Multi-Filter Bar on Lead Pool**: Comprehensive filter toolbar with live search, lifecycle state filter, availability filter, lead source channel filter, and one-click reset.
- **22 — Lead Pool View Tabs & Soft Delete Management**: Top horizontal tab navigation (*All Leads*, *Unassigned*, *Duplicate*, *Deleted*) with dynamic badge counts. Laravel Eloquent `SoftDeletes` allowing agents to soft-delete to Trash, restore, or permanently purge.
- **23 — Permanent Removal of Merge Feature**: Cleanly removed Merge action in favor of single-lead lifecycle integrity.
- **24 — SweetAlert2 Integration for Lead Actions**: Modal confirmation popups on *Move to Trash*, *Restore Lead*, and *Permanent Purge* actions.
- **25 — Interactive Database Column Sorting**: Multi-column sorting (*Client Contact Profile*, *Source Channel*, *Lifecycle State*) backed by Laravel dynamic `orderBy`.
- **26 — Phone Number Password Masking & Eye Toggle**: Default bullet-style masking (`+971 •••• 567`) in the side Contact Drawer with interactive Eye / Eye-off unmasking toggle.
- **27 — Dedicated Separate Full Lead Edit Page**: Full page editor (`/leads/[id]/edit`) pre-populating client personal details, origin sources, and opportunity qualifications.
- **28 — Balanced Form Field Grid Layout**: Balanced 2-column and 3-column responsive grid layout across Create Lead and Edit Lead pages.

### Telephony & Marketing Integrations
- **29 — Campaigns & Marketing Module (`/campaigns`)**: Comprehensive marketing campaign management system with budget analytics, status toggles, platform attribution, and performance charts.
- **30 — HRMS Architecture & Scope Specifications**: Foundation and structural specifications for HR and employee attendance management.
- **31 — 3CX PBX Telephony Integration**:
  - Direct 3CX CRM Server Integration template generation.
  - Live call lookup & webhook ingestion (`/api/calls/lookup`, `/api/calls/3cx-webhook`).
  - Automatic lead creation on incoming call from unknown numbers.
  - Interactive live call popup toast with direct contact profile drawer trigger.

### WhatsApp Multi-Device & Live Chat Suite (`/whatsapp`)
- **32 — WhatsApp Node.js Baileys Gateway Daemon**:
  - Independent Node.js service running on port `5001` (`whatsapp-gateway/server.js`).
  - Native multi-device QR code generation, pairing, and automatic reconnection.
  - Outbound message sending (`POST /api/send`) and inbound webhook forwarder to Laravel.
  - Dedicated WhatsApp Web interface (`/whatsapp`) with channel selector, search, unread filters, and live chat thread.
  - Direct CRM context sidebar displaying linked contact profile and quick opportunity details.
- **33 — Persistent LID-to-Phone Resolution & Number Attribution**:
  - Solved WhatsApp Linked Identity (`@lid`) privacy format masking.
  - Automatic contact book sniffing on `contacts.upsert` and `messaging-history.set`.
  - Persistent disk-backed mapping storage (`contacts_map.json`) preventing memory loss during daemon restarts.
  - Automatic conversion of raw LIDs to real international phone numbers (`+971...`, `+92...`).
  - Manual "Edit Phone Number" override tool in the client context panel.
- **34 — Chat History Chronological Sorting & Performance Optimization**:
  - Extracted and preserved genuine mobile conversation timestamps (`conversationTimestamp`) during history sync, matching exact mobile chat recency.
  - Server-side search & display query optimization (`take(250)`) resolving browser memory freeze on large message syncs (1,400+ chats).
  - Global database text search across all indexed chats before result slicing.
- **35 — On-Demand Profile Picture (Avatar) Caching & Safe Ingestion**:
  - Added `avatar_url` column to `whatsapp_chats` table.
  - On-demand single contact avatar resolution (`GET /api/avatar/:jid`) triggered only when a chat is opened.
  - Avoids bulk-fetch rate limits and prevents WhatsApp spam/bot account bans.
  - Automatic database caching in Laravel and instant frontend UI rendering with initial fallback badges.

---

## ⚙️ Installation & Running Instructions

### 1. Database (MySQL RDBMS)
Ensure MySQL is running on `127.0.0.1:3306` with database `fsadvisory_crm`.

### 2. Backend (Laravel API)
```bash
cd backend
php artisan migrate
php artisan serve --port=8000
```
API active at `http://127.0.0.1:8000`

### 3. WhatsApp Gateway Daemon (Node.js Baileys)
```bash
cd whatsapp-gateway
npm install
node server.js
```
Gateway active at `http://127.0.0.1:5001`

### 4. Frontend (Next.js App)
```bash
cd frontend
npm install
npm run dev
```
Frontend active at `http://localhost:3000` (or `http://localhost:3001`)

---

## 📁 Repository Structure

```
FSadvisory-crm/
├── backend/                  # Laravel 11 REST API
│   ├── app/
│   │   ├── Http/Controllers/Api/
│   │   │   ├── ContactController.php
│   │   │   ├── OpportunityController.php
│   │   │   ├── WhatsAppController.php
│   │   │   ├── CallController.php
│   │   │   └── ...
│   │   └── Models/
│   ├── database/migrations/  # MySQL schema migrations
│   └── routes/api.php        # REST endpoints
├── frontend/                 # Next.js 14+ SPA
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx               # Lead Pool
│   │   │   ├── whatsapp/page.tsx      # WhatsApp Chat Suite
│   │   │   ├── opportunities/         # Opportunity Workspace
│   │   │   ├── pipeline/page.tsx      # Kanban Board
│   │   │   ├── campaigns/page.tsx     # Marketing Campaigns
│   │   │   ├── settings/page.tsx      # Settings & Master Catalogs
│   │   │   └── ...
│   │   └── components/       # Reusable UI components
├── whatsapp-gateway/         # Baileys WhatsApp Multi-Device Gateway
│   ├── server.js             # Gateway Express server & Baileys socket
│   ├── auth_sessions/        # Multi-device session credentials
│   └── contacts_map.json     # Persistent LID-to-phone mapping store
└── README.md
```
