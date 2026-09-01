# 🎓 Placement Tracker Platform (2027 Batch)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Svelte](https://img.shields.io/badge/Svelte-5.0-orange.svg)](https://svelte.dev/)
[![Hono.js](https://img.shields.io/badge/Hono.js-4.0-firebrick.svg)](https://hono.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-v4.0-teal.svg)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/SQLite3-better--sqlite3-lightgrey.svg)](https://github.com/WiseLibs/better-sqlite3)
[![Docker](https://img.shields.io/badge/Docker-Supported-blue.svg)](https://www.docker.com/)

**Placement Tracker** is a high-performance placement management and statistical analytics platform engineered for the **2027 Batch** (VIT). It aggregates student records, tracks multi-round shortlists and final selection offers per company, calculates real-time academic cutoffs, and predicts candidate drive eligibility.

---

## 🌟 Key Features

- **📊 Analytics Dashboard**: Real-time placement rates, Master NeoID statistics, Chennai placement rate highlights, campus-wise breakdowns, and interactive pie charts for branch & salary distributions.
- **🎓 Candidate Directory**: Search 3,500+ student profiles with CGPA, 10th/12th percentages, Date of Birth (DOB), TopCoder flags, resume links, and shortlist history.
- **🔍 Neo ID Management**: Advanced batch Neo ID lookup, mapping, and campus assignment with search scoring.
- **🏢 Company Profiles**: Manage drive details with Category badges (🌟 Super Dream), Job Roles (💼), Stipends (💵), CTC (💰), Job Locations (📍), Eligible Branches, and Eligibility Criteria.
- **⚡ Email Quick Parser**: Paste raw placement cell drive emails to auto-fill company profiles instantly.
- **📝 Multi-Round Shortlists**: Bulk upload candidate lists (Registration Numbers or Neo IDs) into custom rounds (`Shortlist 1`, `Shortlist 2`, `Interview`). Delete rounds and view academic analytics.
- **✅ Selections & Offers**: Bulk track Full-Time placement offers and Internship selections with automatic status updates.
- **🔮 Eligibility Predictor**: Input CGPA, 10th %, and 12th % to return matching companies based on historical cutoff data.
- **🔒 Admin Security**: Admin password verification for all critical data modifications.
- **🌙 Dark Mode**: Full dark mode support with responsive, mobile-friendly UI layouts.

---

## 🏗️ Technology Stack

- **Backend Framework**: Hono.js (Node.js `@hono/node-server`)
- **Database Engine**: SQLite3 with `better-sqlite3` & `NOCASE` B-tree performance indexes
- **Frontend Engine**: Svelte 5 + TypeScript
- **Bundler & Dev Server**: Vite 5
- **UI Design System**: Tailwind CSS v4 + Plus Jakarta Sans typography with custom glassmorphism & dark mode
- **Deployment**: Docker & Docker Compose ready

---

## 🚀 Quick Setup & Installation

```bash
# 1. Install dependencies
npm install

# 2. Initialize SQLite database & migrations
npm run setup-db

# 3. Ingest master student CSV datasets
npm run import-data

# 4. Launch development server
npm run dev
```

- **Frontend App**: `http://localhost:5173`
- **Backend API**: `http://localhost:3001`

### Or Run with Docker 🐳 (Local Testing)

```bash
docker compose up -d --build
```
- App will be available at `http://localhost:3005` (mapped to container port 3001).

---

## 🐳 Production Deployment & Architecture

The application is deployed on a Google Cloud Compute Engine VM (`db-tracker`) using Docker and a centralized **Caddy Reverse Proxy** running in `~/caddy/` on a shared Docker bridge network (`web_net`).

```
                     [ Internet (your-domain.com) ]
                                    │
                                    ▼  (Ports 80 & 443)
                ┌───────────────────────────────────────┐
                │    ~/caddy/ (Dedicated Caddy Ingress) │
                └───────────────────┬───────────────────┘
                                    │
              ┌─────────────────────┴─────────────────────┐
              │         Shared Docker Network: web_net    │
              └───────────┬─────────────────┬─────────────┘
                          │                 │
                          ▼                 ▼
           ┌──────────────────────┐  ┌──────────────────────┐
           │     ~/app-data/      │  │     ~/app-two/       │
           │    (Placement App)   │  │    (Other Service)   │
           │  container: tracker-app│ │ container: other-app │
           │     Port 3001        │  │     Port 3000        │
           └──────────────────────┘  └──────────────────────┘
```

### 1. Central Caddy Configuration (`~/caddy/Caddyfile` on VM)
Reverse proxying and automatic SSL are handled globally by Caddy:
```caddyfile
# Placement Tracker
your-domain.com {
    reverse_proxy tracker-app:3001
}
```

### 2. One-Command Production Deployment
Run the automated deployment script locally:
```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

This script:
1. Builds the production Docker image locally.
2. Pushes the image to Google Artifact Registry: `us-west1-docker.pkg.dev/your-gcp-project-id/tracker-repo/tracker-app:latest`.
3. Sets up `~/app-data/` on the VM and uploads `vm-setup/docker-compose.yml` (attaches container `tracker-app` to `web_net`).
4. Pulls the latest image and restarts the container on the VM.

### 3. Database Sync Utilities
- **Push database to VM**:
  ```bash
  npm run push:db
  # or: bash ./scripts/push-db-to-vm.sh
  ```
- **Pull database from VM**:
  ```bash
  npm run pull:db
  # or: bash ./scripts/pull-db-from-vm.sh
  ```



---

## 📁 Repository Structure

```text
tracker/
├── src/
│   ├── backend/
│   │   ├── db/
│   │   │   └── index.ts            # SQLite database initialization & migrations
│   │   ├── scripts/
│   │   │   ├── setup-db.ts         # Database setup script
│   │   │   └── import-data.ts      # CSV ingestion script
│   │   ├── index.ts                # Hono REST API server endpoints
│   │   └── utils.ts                # Branch & campus detection utility functions
│   └── frontend/
│       ├── main.ts                 # Svelte 5 app entry
│       ├── App.svelte              # Glassmorphic header & navigation container
│       ├── app.css                 # Tailwind v4 & font configuration
│       └── components/
│           ├── Analytics.svelte    # Analytics dashboard
│           ├── StudentList.svelte  # Candidate management directory
│           ├── CompanyList.svelte  # Company profiles & email quick-parser
│           ├── AddShortlist.svelte # Bulk shortlisting
│           ├── AddSelection.svelte # Bulk placement & internship offers
│           └── PredictCompanies.svelte # Academic eligibility predictor
├── csvs/                           # Master CSV datasets (IOE, fidelity, placement_batch)
├── placement.db                    # SQLite database file
├── PROJECT_SUMMARY.md              # Detailed technical summary & DB schema documentation
├── QUICKSTART.md                   # Developer & user guide
└── README.md                       # Project overview
```

---

## 🔗 REST API Endpoints

### Candidate Endpoints
- `GET /api/students` — List candidates (supports search, campus filter, pagination, sorting)
- `GET /api/students/:id` — Get candidate details with all shortlists & selections
- `POST /api/students/recalculate-analytics` — Re-evaluate candidate status flags

### Company Endpoints
- `GET /api/companies` — List company profiles
- `GET /api/companies/:id` — Get detailed company profile with analytics & shortlist rounds
- `POST /api/companies` — Create company profile (supports email quick parser fields)
- `PUT /api/companies/:id` — Edit company profile
- `POST /api/companies/:id/shortlist` — Bulk add candidates to shortlist round
- `PUT /api/companies/:id/shortlist-round/:roundNumber` — Rename shortlist round
- `POST /api/companies/:id/selections` — Bulk add placement or internship offers
- `POST /api/companies/recalculate-analytics` — Recalculate cutoffs across all companies

### Analytics Endpoints
- `GET /api/analytics/summary` — Retrieve dashboard metrics & campus breakdowns
- `POST /api/predict-companies` — Predict candidate eligibility from academic marks

---

## 📄 License

MIT License
