# 🚀 Quick Start Guide - Placement Tracker (2027 Batch)

Welcome to the **Placement Tracker** for the **2027 Batch**. Follow this guide to set up, run, and manage your placement tracking platform.

---

## ⚡ Prerequisites & Setup

Ensure you have **Node.js 18+** installed.

### 1. Installation

```bash
# Clone repository or enter directory
cd "placement tracker/tracker"

# Install dependencies
npm install
```

### 2. Initialize Database & Import CSV Data

```bash
# Initialize SQLite database schema
npm run setup:db

# Ingest student CSV datasets (IOE.csv, fidelity.csv, placement_batch.csv, etc.)
npm run import:data
```

### 3. Launch Server in Development Mode

```bash
# Runs backend API (port 3001) and Vite dev server (port 5173) concurrently
npm run dev
```

### Or Run with Docker 🐳

```bash
docker compose up -d --build
```

Open your browser to:
- 🌐 **Frontend App**: `http://localhost:5173` (or `http://localhost:3005` for local Docker)
- ⚙️ **Backend API**: `http://localhost:3001`


---

## 🧭 How to Use Each View

### 📊 1. Analytics Dashboard
- View Master NeoID student placement percentages and total placed statistics.
- Monitor the **Chennai NeoID Placement Rate** highlight metric card.
- Inspect campus-wise breakdown tables (`Chennai`, `Vellore`, `Unknown`).
- Interact with **Pie Charts** for branch and salary distribution analytics.
- Search company placement & internship breakdown statistics in real-time.

### 🎓 2. Student Directory
- Search candidates by Name, Registration Number (e.g., `23BCE1087`), or Neo ID (e.g., `B6B1O8G8`).
- Filter candidates by **Unmapped Chennai Students** or **Higher Studies / Masters Status**.
- Click **View Details** to open a student modal displaying CGPA, 10th/12th marks, branch, campus, resume link, TopCoder badge, and all shortlists/selections.
- Click **Sync Candidate Data** to re-evaluate placement statuses across database tables.

### 🏢 3. Company Profiles & Drive Management
- View recruiting company cards formatted with Category badges (🌟 Super Dream), Job Role (💼), Location (📍), Monthly Stipend (💵), and CTC (💰).
- Click **+ Add Company** to register new drive profiles.
- **⚡ Email Quick Parser**: Paste raw placement cell email announcements into the quick-fill box and click **Parse & Fill Fields** to instantly populate all company details!
- Click any company card to open the detailed modal:
  - View corporate website link (`saviynt.com ↗`).
  - Read **Eligible Branches** and **Eligibility Criteria** card boxes.
  - Review round-by-round candidate shortlists deterministically ranked by **Campus (Chennai ➔ Vellore ➔ Others)**, **TopCoder Status**, and **CGPA** (with secondary sorting by name).
  - You can now **Delete** specific shortlist rounds and view **Academic Analytics** (min/avg CGPA) for each round.
  - Inspect final full-time placements and internship selection lists.

### 📝 4. Add Shortlists
- Select a recruiting company from the auto-complete dropdown menu.
- Choose a Shortlist Round (`Shortlist 1`, `Shortlist 2`, `Technical Interview`, or custom round name).
- Paste a bulk list of candidate Registration Numbers or Neo IDs (one per line or separated by spaces/tabs).
- The system automatically sanitizes headers, validates candidate identifiers, updates multi-round tables, and recalculates company cutoff analytics.

### ✅ 5. Add Final Selections & Internships
- Select a recruiting company.
- Toggle between **Full-Time Final Placement** and **Internship Selection**.
- Paste candidate Registration Numbers or Neo IDs.
- Submitting updates candidate placement status flags (`placed`, `intern`, `final_company_id`) and recalculates statistics automatically.

### 🎯 6. Predict Eligible Companies
- Input a candidate's **CGPA** (e.g. `8.75`), **10th Percentage** (e.g. `92%`), and **12th Percentage** (e.g. `89%`).
- Click **⚡ Calculate Eligible Companies**.
- View all companies where the candidate meets or exceeds historical minimum shortlisting cutoffs.

---

## 💻 NPM Commands Reference

| Command | Action |
|---|---|
| `npm run dev` | Launch both backend API and Vite dev server concurrently |
| `npm run setup-db` | Execute database initialization & schema migrations |
| `npm run import-data` | Import master CSV student & Neo ID datasets into SQLite |
| `npm run import-company-details`| Bulk parse & import company profiles from `company_details.md` |
| `npm run build` | Compile frontend Vite app & TypeScript backend for production |
| `npm run start` | Start production Node.js server |

---

## 📧 Email Quick-Parser Example

When a new placement email arrives:

```text
Saviynt
Super Dream Internship/ Placement
B.Tech (CSE, IT & ECE related courses)
Eligibility Criteria: % in X and XII – 90% or 9.0 CGPA, in Pursuing Degree – 90% or 9.0 CGPA, No Standing Arrears
CTC: 21,00,000 (If converted)
Stipend: 50000 per month
Website: saviynt.com
Job location: Bengaluru
Job profile: Associate Engineer / Associate Engineer (SRE)
```

1. Navigate to **Companies** ➔ **+ Add Company**.
2. Paste the text into **Clipboard Quick Auto-Fill from Placement Email**.
3. Click **⚡ Parse & Fill Fields**.
4. Click **💾 Save Company Profile**.
