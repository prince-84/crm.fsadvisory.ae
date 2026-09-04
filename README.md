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

### Enterprise Access, Governance & Distribution
- **36 — Enterprise User Management & Granular Permission Matrix (`/users`)**:
  - `users` and `roles` table schema with departments, phone numbers, active status, and custom JSON granular permissions.
  - Granular permissions system (`leads.view`, `leads.create`, `leads.edit`, `owner_data.view`, `queue.view`, `deals.view`, `calls.make`, `whatsapp.view`, `reports.view`, `users.manage`, `settings.view`, etc.).
  - Granular Interactive Permission Matrix Drawer on `/users` allowing Super Admin to assign and override permissions per user.
  - Self-registration approval workflow: pending registration notice, admin activation modal with department and role assignment, and automated HTML email notifications (`AccountActivatedMail`, `AccountInReviewMail`).
  - Dynamic navigation and action guarding via `hasPermission()` in `Sidebar.tsx` and across application routes.

- **37 — Dubai Title Deed Owner Data Master Registry (`/owner-data`)**:
  - Dedicated `/owner-data` workspace for Dubai property owners and title deed records (`owner_records` table).
  - High-density columns for Property Type, Master Developer, Project Name, Unit/Villa #, Area / Community, Owner Full Name, Primary Phone, Secondary Phone, Email, Nationality, Current Status, and Assigned Advisor.
  - Live KPI Cards: *Total Records*, *Verified Owners*, *Active Units*, *Off-Plan Portfolio*.
  - Comprehensive filter bar with live search, property type, bedrooms, area, and status dropdowns.
  - Bulk Excel/CSV Import Wizard with column auto-mapping and progress reporting.
  - Bulk delete and single record edit/delete with SweetAlert2 modal confirmation.

- **38 — Intelligent Lead Distribution Engine & Round-Robin Rotation (`LeadDistributionService`)**:
  - Automated intelligent lead distribution engine (`LeadDistributionService.php`) handling inbound ad webhooks, portal leads, and unassigned records.
  - Dedicated database tables: `lead_distribution_settings`, `lead_distribution_agents`, and `lead_distribution_logs`.
  - Settings UI card on `/settings` featuring:
    - Master On/Off switch, Scope toggles (*Apply to Lead Pool*, *Apply to Owner Data*).
    - Distribution Algorithm selector (*Round-Robin (Equal Count)* vs *Weighted Ratio*).
    - Active Rotation Agent management with daily lead caps, active/idle toggles, and real-time counter tracking.
    - Strict daily cap enforcement preventing over-allocation past agent capacity with designated Fallback Assignee routing.
    - Interactive **[ 🔄 Reset Counts ]** button with SweetAlert2 confirmation dialog.
    - Complete Activity Audit Trail with **[ 🗑️ Clear Logs ]** truncation feature.

- **39 — Dynamic Sliding Window Pagination**:
  - Advanced sliding window pagination algorithm supporting arbitrary page ranges without hardcoded limits.
  - Includes jump controls (`...` advance 5 pages) and quick first/last page shortcuts across Settings audit logs and data tables.

- **40 — Marketing & UTM Campaign Attribution Tracking**:
  - Full-stack UTM marketing attribution added to database `contacts` table:
    - `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, and `landing_page_url` (Complete Campaign / Referral URL).
  - Seamless ingestion via portal/ad webhooks (`PortalController::ingest`), Contact API (`ContactController`), and all manual lead creation/editing forms.
  - Rendered with clickable link and **[Open ↗]** button in the Contact Drawer campaign attribution card.

- **41 — Client Personal Details Schema Optimization (Removal of Mobile Phone)**:
  - Permanently dropped obsolete `mobile_phone` column from database schema (`2026_09_03_110001_drop_mobile_phone_from_contacts_table.php`).
  - Removed `mobile_phone` from all backend controllers (`ContactController`, `CallRecordingController`) and frontend forms.
  - Streamlined client telephone management strictly to **Primary Phone Number** and **Secondary Phone Number**.

- **42 — Symmetrical 3-Column Responsive Grid Architecture**:
  - Reorganized form layouts into balanced, clean 3-columns-per-row grids:
    - **Client Personal Details**: Row 1 (Name `*`, Primary Phone `*`, Secondary Phone) | Row 2 (Email `*`, Nationality, Emirates ID / Passport #) — placing Primary & Secondary phone side-by-side.
    - **Marketing & UTM Parameters**: Row 1 (UTM Source, UTM Medium, UTM Campaign) | Row 2 (UTM Term, UTM Content, Complete Campaign URL).
  - Applied consistently across Full Create Page (`/leads/create`), Full Edit Page (`/leads/[id]/edit`), and modal dialogs (`CreateLeadModal`, `CreateContactModal`, `EditContactModal`).

- **43 — Dynamic Database-Driven User & Advisor Dropdowns**:
  - Replaced static/mock values with live API queries to `/api/users`.
  - "Assigned Agent / Owner" in lead forms dynamically populates all active advisors from the database with unassigned rotation fallback.
  - "TARGET SALES ADVISOR" in Sales Handover Validation Modal (`SalesHandoverModal.tsx`) dynamically loads from database with intelligent default matching for sales consultants.
  - Team filters in `/opportunities` and `/queue` updated to parse API responses dynamically.

- **44 — Vector Branding & Official SVG Logo Integration**:
  - Converted official vector `logo.svg` to clean UTF-8.
  - Integrated official gold-and-white `logo.svg` in:
    - Main CRM Sidebar header (`Sidebar.tsx`)
    - Login and Registration page desktop hero & mobile header (`login/page.tsx`)
    - Next.js root layout metadata & browser tab favicons (`layout.tsx`).

- **45 — Cloud Deployment & Vercel-Ready Architecture**:
  - Live Laravel API configured on production subdomain (`https://api.fsadvisory.ae`).
  - Published and configured Laravel CORS policy (`config/cors.php`) to allow cross-origin requests.
  - Refactored entire frontend to eliminate hardcoded `127.0.0.1:8000` URLs in favor of dynamic `NEXT_PUBLIC_API_URL`.
  - Complete fullstack codebase pushed to GitHub repository: `https://github.com/prince-84/crm.fsadvisory.ae.git` on branch `main`.

- **46 — TeleSales Department & Dedicated Telesales Agent Workforce**:
  - Established the dedicated **TeleSales Department** and **Telesales Agent** role (`telesales-agent`) within the Enterprise User Management & RBAC system.
  - Tailored granular permission matrix configured specifically for high-velocity lead outreach and qualification:
    - **Leads & Bank**: `leads.view`, `leads.create`, `leads.edit`
    - **Follow-ups & Queue**: `queue.view`, `queue.update_status`, `queue.calendar`
    - **Deals & Pipeline**: `deals.view`, `deals.create`
    - **Telephony (3CX PBX)**: `calls.make`, `calls.view_logs`, `calls.listen_recordings`
    - **WhatsApp Web Multi-Device**: `whatsapp.view`, `whatsapp.send_messages`, `whatsapp.send_voice`
  - Seeded 5 dedicated Telesales Agents with official FS Advisory email accounts, UAE mobile numbers, and active CRM access:
    - **Hiba Aslam** (`hiba@fsadvisory.ae` | `+971 58 441 2233`) — Telesales Agent
    - **Shafiuddin** (`shafiuddin@fsadvisory.ae` | `+971 55 597 7700`) — Telesales Agent
    - **Rayyan** (`rayyan@fsadvisory.ae` | `+971 56 946 8277`) — Telesales Agent
    - **Saad** (`saad@fsadvisory.ae` | `+971 54 330 1035`) — Telesales Agent
    - **Mako** (`mako@fsadvisory.ae` | `+971 52 987 6543`) — Telesales Agent
  - Frontend integration on User Management (`/users`):
    - Added `TeleSales` option across Department dropdowns (Create User Modal, Edit User Modal, and Self-Registration Approval Dialog).
    - Added `Telesales Agent` role option across Role assignment selectors.
    - Custom UI badge styling: rich purple-indigo badge for `TeleSales` department and amber badge for `Telesales Agent` role.
  - Integration with Round-Robin Lead Distribution Engine (`LeadDistributionService`), Lead Pool dynamic owner dropdowns, and My Queue rotation.
  - Database Seeder persistence: permanently codified in `RoleAndPermissionSeeder.php` for one-command remote server synchronization (`php artisan db:seed --class=RoleAndPermissionSeeder --force`).

---

## ⚙️ Installation & Running Instructions

### 1. Database (MySQL RDBMS)
Ensure MySQL is running with database `fsadvisory_crm` (or configured database in `.env`):
```bash
cd backend
php artisan migrate --force
php artisan db:seed --class=RoleAndPermissionSeeder --force
```

### 2. Backend (Laravel API)
```bash
cd backend
cp .env.example .env
# Configure DB credentials in .env
php artisan key:generate
php artisan optimize:clear
php artisan serve --port=8000
```
API active locally at `http://127.0.0.1:8000` (Production live at `https://api.fsadvisory.ae/api`).

### 3. WhatsApp Gateway Daemon (Node.js Baileys)
```bash
cd whatsapp-gateway
npm install
node server.js
```
Gateway active at `http://127.0.0.1:5001`.

### 4. Frontend (Next.js App)
```bash
cd frontend
npm install
# Local development:
npm run dev
```
Frontend active locally at `http://localhost:3000`.

### 5. Vercel Production Deployment
- **Git Repository:** `https://github.com/prince-84/crm.fsadvisory.ae.git` (branch `main`)
- **Root Directory:** `frontend`
- **Environment Variables:**
  - `NEXT_PUBLIC_API_URL`: `https://api.fsadvisory.ae/api`
  - `NEXT_PUBLIC_WHATSAPP_GATEWAY_URL`: (Optional, if WhatsApp gateway is hosted on a VPS/domain)

### 6. Production Maintenance & Cache Management
To ensure newly registered routes, configuration updates, and permission changes reflect immediately in production:
```bash
cd backend
php artisan optimize:clear
# Or clear components individually:
# php artisan route:clear
# php artisan config:clear
# php artisan cache:clear
# php artisan view:clear
```

---

## 📁 Repository Structure

```
FSadvisory-crm/
├── backend/                  # Laravel 11 REST API
│   ├── app/
│   │   ├── Http/Controllers/Api/
│   │   │   ├── ContactController.php          # Contact CRUD & UTM Attribution
│   │   │   ├── OpportunityController.php      # Opportunity Lifecycle & SLA
│   │   │   ├── LeadDistributionController.php # Round-Robin Engine & Audit Logs
│   │   │   ├── OwnerDataController.php        # Dubai Title Deed Registry
│   │   │   ├── UserController.php             # User Management & Permissions
│   │   │   ├── WhatsAppController.php         # WhatsApp Web Suite & Sync
│   │   │   ├── CallRecordingController.php    # 3CX PBX Telephony Integration
│   │   │   └── ...
│   │   ├── Models/
│   │   └── Services/
│   │       └── LeadDistributionService.php    # Auto-Distribution Logic & Rotation
│   ├── config/cors.php                        # CORS configuration for Vercel
│   ├── database/migrations/                   # MySQL schema migrations
│   └── routes/api.php                         # REST API endpoints
├── frontend/                 # Next.js 15+ App Router SPA
│   ├── public/
│   │   └── logo.svg                           # Official FS Advisory vector logo
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                       # Lead Pool master table
│   │   │   ├── leads/create/page.tsx          # Full Create Lead Page
│   │   │   ├── leads/[id]/edit/page.tsx       # Full Edit Lead Page
│   │   │   ├── owner-data/page.tsx            # Title Deed Owner Registry
│   │   │   ├── queue/page.tsx                 # Daily Telesales Desk
│   │   │   ├── opportunities/                 # Opportunity Workspace
│   │   │   ├── pipeline/page.tsx              # Sales Pipeline Kanban
│   │   │   ├── call-activity/page.tsx         # 3CX Call Logs & Telephony
│   │   │   ├── recordings/page.tsx            # Audio Recordings Player
│   │   │   ├── whatsapp/page.tsx              # WhatsApp Multi-Device Suite
│   │   │   ├── users/page.tsx                 # User Management & Matrix
│   │   │   ├── settings/page.tsx              # Settings & Distribution Engine
│   │   │   └── login/page.tsx                 # Authentication & Approval Notice
│   │   ├── components/                        # Reusable UI & Modal components
│   │   └── lib/
│   │       ├── api.ts                         # Dynamic fetchApi with NEXT_PUBLIC_API_URL
│   │       └── permissions.ts                 # Granular RBAC permission checks
│   └── next.config.ts
├── whatsapp-gateway/         # Baileys WhatsApp Multi-Device Gateway
│   ├── server.js             # Gateway Express server & Baileys socket
│   ├── auth_sessions/        # Multi-device session credentials
│   └── contacts_map.json     # Persistent LID-to-phone mapping store
├── logo.svg                  # Official vector logo asset
├── README.md                 # Full project technical documentation
└── SCOPE.md                  # Project scope and business specifications
```
