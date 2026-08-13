# 🎓 Placement Tracker (2027 Batch) - Comprehensive Technical Summary

## 📌 Executive Overview

**Placement Tracker** is a high-performance, full-stack enterprise platform engineered for managing placement drives, student shortlists, final placement offers, internship selections, academic cutoffs, and statistical predictions for the **2027 Batch** (VIT). 

The platform aggregates multi-source student records (master registration data, Neo IDs, academic CGPA/10th/12th percentages, TopCoder ratings, and resume links), tracks multi-round shortlists per recruiting company, and computes real-time selection analytics and eligibility predictions.

---

## 🏗️ Architecture & Technology Stack

```
                               ┌────────────────────────────────────────┐
                               │           Svelte 5 + Vite 5            │
                               │      (Tailwind CSS v4 + Jakarta)       │
                               └──────────────────┬─────────────────────┘
                                                  │ HTTP / REST APIs
                                                  ▼
                               ┌────────────────────────────────────────┐
                               │             Hono.js Server             │
                               │        (Node.js @hono/node-server)     │
                               └──────────────────┬─────────────────────┘
                                                  │ Direct SQL Prepared Statements
                                                  ▼
                               ┌────────────────────────────────────────┐
                               │         SQLite Database Engine         │
                               │      (better-sqlite3 + NOCASE Index)   │
                               └────────────────────────────────────────┘
```

| Component | Technology | Description |
|---|---|---|
| **Backend API** | Hono.js | Fast TypeScript web framework running on Node.js |
| **Database** | SQLite3 (`better-sqlite3`) | High-concurrency relational database with synchronous WAL mode & NOCASE indexes |
| **Frontend Framework** | Svelte 5 + TypeScript | Reactive component architecture with zero virtual DOM overhead |
| **Bundler / Dev Server**| Vite 5 | Instant HMR development server & production builder |
| **Styling & UI** | Tailwind CSS v4 + Plus Jakarta Sans | Custom glassmorphic design system, smooth scrollbars, dark mode, and vibrant gradients |
| **Deployment** | Docker & Docker Compose | Containerized dual-service deployment with multi-stage builds |

---

## 🗄️ Database Architecture & Full Schema

The SQLite database (`placement.db`) contains 7 core tables designed for high-performance candidate matching and aggregation.

```mermaid
erDiagram
    temp_students ||--o{ temp_neoid_table : "maps via regno/neo_id"
    temp_students ||--o{ temp_shortlists : "shortlisted for"
    temp_students ||--o{ temp_final_selection : "selected for"
    temp_students ||--o{ temp_interns_selected : "interned at"
    companies ||--o{ temp_shortlists : "shortlists candidates"
    companies ||--o{ temp_final_selection : "hires candidates"
    companies ||--o{ temp_interns_selected : "recruits interns"
    companies ||--|| company_analytics : "computes cutoffs"
```

### 1. `temp_students` (Master Candidate Directory)
Stores all candidates across campuses with academic history and placement statuses.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Internal candidate ID |
| `regno` | `TEXT` | `UNIQUE NOT NULL` | Candidate Registration Number (e.g. `23BCE1087`) |
| `name` | `TEXT` | `NOT NULL` | Full Name |
| `email` | `TEXT` | — | Institutional VIT Email |
| `phone` | `TEXT` | — | Primary Phone Number |
| `personal_email` | `TEXT` | — | Personal Email Address |
| `gender` | `TEXT` | — | Male / Female |
| `cgpa` | `REAL` | — | Cumulative Grade Point Average (0.00 - 10.00) |
| `tenth_marks` | `REAL` | — | 10th Standard Percentage (%) |
| `twelfth_marks`| `REAL` | — | 12th Standard Percentage (%) |
| `dob` | `TEXT` | — | Candidate Date of Birth |
| `resume_link` | `TEXT` | — | Direct link to Google Drive/PDF resume |
| `branch` | `TEXT` | — | Extracted Branch Code (e.g. `BCE`, `BAI`, `BPS`) |
| `campus` | `TEXT` | `DEFAULT 'Unknown'` | Campus Location (`Chennai`, `Vellore`, `Bhopal`, `AP`) |
| `placed` | `BOOLEAN`| `DEFAULT 0` | Full-time Placement Offer Flag (1 = Placed) |
| `final_company_id` | `INTEGER` | `FOREIGN KEY -> companies(id)` | ID of company candidate accepted offer from |
| `neo_id` | `TEXT` | — | Unique Institutional Neo ID (e.g. `B6B1O8G8`) |
| `masters` | `BOOLEAN`| `DEFAULT 0` | Higher Studies / Masters Status Flag |
| `status` | `TEXT` | `DEFAULT 'not_placed'`| Status: `placed`, `intern`, `masters`, `not_placed` |
| `topcoder` | `BOOLEAN`| `DEFAULT 0` | TopCoder Competitive Programmer Flag |

### 2. `temp_neoid_table` (Neo ID Mapping)
Maintains historical mapping between Neo IDs and candidate Registration Numbers.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `neoid` | `TEXT` | `PRIMARY KEY` | Neo ID Identifier |
| `regno` | `TEXT` | — | Associated Registration Number |
| `name` | `TEXT` | — | Candidate Name |
| `campus` | `TEXT` | — | Associated Campus Location |

### 3. `companies` (Company Profile Directory)
Stores recruiting company profiles, requirements, and job drive criteria.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Internal Company ID |
| `name` | `TEXT` | `UNIQUE NOT NULL` | Company Name (e.g. `Saviynt`) |
| `category` | `TEXT` | — | Hiring Category (e.g. `Super Dream Internship/ Placement`) |
| `role` | `TEXT` | — | Job Profile / Role (e.g. `Associate Engineer / SRE`) |
| `ctc` | `TEXT` | — | CTC Package (e.g. `21,00,000 (21 LPA)`) |
| `stipend` | `TEXT` | — | Monthly Internship Stipend (e.g. `50,000 / month`) |
| `job_location` | `TEXT` | — | Job Location (e.g. `Bengaluru`, `Remote`) |
| `eligible_branches`| `TEXT` | — | Eligible Degree Branches (e.g. `B.Tech CSE, IT & ECE`) |
| `eligibility_criteria`| `TEXT` | — | Academic Criteria (e.g. `90% in 10th/12th, 9.0 CGPA`) |
| `website` | `TEXT` | — | Official Corporate Website (e.g. `saviynt.com`) |
| `total_rounds` | `INTEGER` | — | Total Interview / Selection Rounds |
| `experience_required`| `TEXT` | — | Target Batch / Experience (e.g. `Freshers (2027 batch)`) |
| `notes` | `TEXT` | — | General Drive Notes |
| `round_details` | `TEXT` | — | Round-by-round interview process instructions |

### 4. `temp_shortlists` (Multi-Round Shortlists)
Tracks candidate shortlists across multiple rounds (`Shortlist 1`, `Shortlist 2`, `Technical Interview`, etc.).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Shortlist Record ID |
| `regno` | `TEXT` | — | Candidate Registration Number |
| `neo_id` | `TEXT` | — | Candidate Neo ID |
| `company_id` | `INTEGER` | `FOREIGN KEY -> companies(id)` | Associated Company ID |
| `round_number` | `INTEGER` | `DEFAULT 1` | Shortlist Round Index (1, 2, 3...) |
| `round_name` | `TEXT` | `DEFAULT 'Shortlist 1'` | Display Round Title |
| `shortlisted_at`| `TEXT` | `DEFAULT CURRENT_TIMESTAMP` | Shortlist Upload Timestamp |

### 5. `temp_final_selection` (Full-Time Placements)
Stores candidates who received final full-time placement offers.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Selection ID |
| `regno` | `TEXT` | — | Candidate Registration Number |
| `neo_id` | `TEXT` | — | Candidate Neo ID |
| `company_id` | `INTEGER` | `FOREIGN KEY -> companies(id)` | Hiring Company ID |
| `selected_at` | `TEXT` | `DEFAULT CURRENT_TIMESTAMP` | Offer Confirmation Timestamp |

### 6. `temp_interns_selected` (Internship Selections)
Stores candidates who secured internship offers.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Internship Record ID |
| `regno` | `TEXT` | — | Candidate Registration Number |
| `neo_id` | `TEXT` | — | Candidate Neo ID |
| `company_id` | `INTEGER` | `FOREIGN KEY -> companies(id)` | Internship Company ID |
| `selected_at` | `TEXT` | `DEFAULT CURRENT_TIMESTAMP` | Selection Timestamp |

### 7. `company_analytics` (Automated Cutoffs & Statistical Summary)
Automatically updated statistics table aggregated from candidate shortlist and selection datasets.

| Column | Type | Description |
|---|---|---|
| `company_id` | `INTEGER` | `PRIMARY KEY (FOREIGN KEY -> companies(id))` |
| `min_cgpa_shortlist` | `REAL` | Minimum CGPA among shortlisted candidates |
| `avg_cgpa_shortlist` | `REAL` | Average CGPA of shortlisted candidates |
| `min_tenth_shortlist` | `REAL` | Minimum 10th % among shortlisted candidates |
| `avg_tenth_shortlist` | `REAL` | Average 10th % of shortlisted candidates |
| `min_twelfth_shortlist` | `REAL` | Minimum 12th % among shortlisted candidates |
| `avg_twelfth_shortlist` | `REAL` | Average 12th % of shortlisted candidates |
| `total_shortlisted` | `INTEGER` | Total unique candidates shortlisted |
| `male_count_shortlist` | `INTEGER` | Male candidate count in shortlists |
| `female_count_shortlist` | `INTEGER` | Female candidate count in shortlists |
| `gender_ratio_shortlist` | `TEXT` | Formatted male-to-female ratio (e.g. `2.5:1`) |
| `min_cgpa_selected` | `REAL` | Minimum CGPA among finally selected candidates |
| `avg_cgpa_selected` | `REAL` | Average CGPA of finally selected candidates |
| `min_tenth_selected` | `REAL` | Minimum 10th % among selected candidates |
| `avg_tenth_selected` | `REAL` | Average 10th % of selected candidates |
| `min_twelfth_selected` | `REAL` | Minimum 12th % among selected candidates |
| `avg_twelfth_selected` | `REAL` | Average 12th % of selected candidates |
| `total_selected` | `INTEGER` | Total candidates finally selected |
| `male_count_selected` | `INTEGER` | Male count among selected |
| `female_count_selected` | `INTEGER` | Female count among selected |
| `gender_ratio_selected` | `TEXT` | Formatted male-to-female selection ratio |
| `selection_ratio` | `REAL` | Selection percentage (`total_selected / total_shortlisted * 100`) |

---

## 🔗 How Database Records Are Joined

1. **Candidate Matching (COALESCE Fallback Join)**:
   When candidate lists (shortlists or selections) contain either a Registration Number or a Neo ID, records are joined against `temp_students` and `temp_neoid_table` using case-insensitive `NOCASE` SQLite indexes:
   ```sql
   LEFT JOIN temp_students s ON 
     (ts.regno IS NOT NULL AND LOWER(s.regno) = LOWER(ts.regno)) OR
     (ts.neo_id IS NOT NULL AND LOWER(s.neo_id) = LOWER(ts.neo_id))
   LEFT JOIN temp_neoid_table n ON 
     (ts.neo_id IS NOT NULL AND LOWER(n.neoid) = LOWER(ts.neo_id)) OR
     (ts.regno IS NOT NULL AND LOWER(n.regno) = LOWER(ts.regno))
   ```

2. **Campus & Merit Candidate Ranking**:
   When viewing shortlisted or selected candidates for any company, candidate profiles are deterministically sorted using a 3-tier priority rule:
   - **Tier 1 (Campus Priority)**: `Chennai` (Rank 1) ➔ `Vellore` (Rank 2) ➔ `Unknown / Others` (Rank 3)
   - **Tier 2 (Competitive Flag)**: `TopCoder = 1` candidates first
   - **Tier 3 (Academic Merit)**: `CGPA` descending

3. **Multi-Round Shortlists Join**:
   Company detail view groups shortlists by `round_number` and retrieves associated candidates:
   ```sql
   SELECT ts.round_number, ts.round_name,
          COALESCE(s.regno, n.regno, ts.regno) AS regno,
          COALESCE(s.neo_id, n.neoid, ts.neo_id) AS neo_id,
          COALESCE(s.name, n.name, 'Unknown Candidate') AS name,
          COALESCE(s.campus, n.campus, 'Unknown') AS campus,
          s.cgpa, s.gender, s.resume_link, s.topcoder
   FROM temp_shortlists ts
   LEFT JOIN temp_students s ON (LOWER(s.regno) = LOWER(ts.regno) OR LOWER(s.neo_id) = LOWER(ts.neo_id))
   LEFT JOIN temp_neoid_table n ON (LOWER(n.neoid) = LOWER(ts.neo_id) OR LOWER(n.regno) = LOWER(ts.regno))
   WHERE ts.company_id = ?
   ORDER BY ts.round_number ASC, campus_rank ASC, s.topcoder DESC, s.cgpa DESC
   ```

---

## 🛠️ Complete Functions & Endpoints Reference

### 1. Helper Utility Functions (`src/backend/utils.ts`)

- **`extractBranch(regno: string): string`**:
  Parses candidate registration numbers using regex `\d{2}([A-Z]{3})\d+` to extract the 3-letter branch code (e.g. `23BCE1087` ➔ `BCE`, `23BAI1403` ➔ `BAI`, `23BPS1146` ➔ `BPS`).
- **`extractCampus(regno: string): string`**:
  Inspects digit patterns in registration numbers:
  - 6th digit `0` ➔ `Vellore`
  - 6th digit `1` or `5` ➔ `Chennai`
  - 6th digit `7` or `8` ➔ `AP`
  - 10-digit regno with 6th digit `1` or `2` ➔ `Bhopal`
- **`normalizeRegNo(regno: string): string`**:
  Trims leading/trailing whitespace and converts strings to uppercase.
- **`parseMarks(marks: string | number): number | undefined`**:
  Safely converts string numeric inputs to float numbers; returns `undefined` for invalid/empty inputs.
- **`extractCleanTokens(input: string | string[]): string[]`**:
  Sanitizes bulk pasted text inputs by removing table header noise words (`REGNO`, `NEO`, `NAME`, `STATUS`, `SL.NO`, etc.), extracting unique candidate identifiers (`[A-Z0-9]{5,20}`).

### 2. Database Initializer & Migration Scripts

- **`src/backend/db/index.ts` (`initDatabase()`)**:
  Initializes SQLite connection with WAL mode, executes `CREATE TABLE IF NOT EXISTS` for all 7 tables, performs automatic column migration checks (`ALTER TABLE companies ADD COLUMN ...`), and constructs case-insensitive `NOCASE` B-tree performance indexes on `regno` and `neo_id`.
- **`src/backend/scripts/setup-db.ts`**:
  Standalone database setup script for fresh deployments or schema migrations.
- **`src/backend/scripts/import-data.ts`**:
  Data ingestion runner that loads master datasets from CSV files (`IOE.csv`, `fidelity.csv`, `mapping1/2/3.csv`, `topcoder.csv`, `placement_batch.csv`, `all_neoids.csv`) into SQLite tables.
- **`src/backend/scripts/import-company-details.ts`**:
  CLI script (`npm run import-company-details`) to automatically parse and seed detailed company profiles from a markdown file (`company_details.md`).

### 3. Backend REST API Endpoints (`src/backend/index.ts`)

#### 🎓 Student Endpoints
- **`GET /api/students`**: Retrieves paginated list of students with real-time debounced search, campus filter, and sorting (`shortlists`, `placed`, `default`).
- **`GET /api/students/:id`**: Returns candidate details including all shortlisted companies, final selection offers, and internship placements.
- **`POST /api/students/recalculate-analytics`**: Re-evaluates student status flags (`placed`, `intern`, `masters`) and updates Neo ID cross-references across all tables.

#### 🏢 Company Endpoints
- **`GET /api/companies`**: Lists all registered recruiting company profiles.
- **`GET /api/companies/:id`**: Returns full company profile, analytics cutoffs, round-by-round shortlists, final placements, and intern lists.
- **`POST /api/companies`**: Creates a new company profile supporting custom email quick-fill parameters (`role`, `category`, `stipend`, `job_location`, `eligible_branches`, `eligibility_criteria`, `website`).
- **`PUT /api/companies/:id`**: Updates an existing company's attributes and requirements.
- **`POST /api/companies/:id/shortlist`**: Accepts bulk list of registration numbers / Neo IDs and adds candidates to specified round number and round name. Recalculates company analytics cutoffs automatically.
- **`PUT /api/companies/:id/shortlist-round/:roundNumber`**: Renames a shortlist round.
- **`POST /api/companies/:id/selections`**: Bulk adds final placement or internship offers for a company and updates candidate placement status flags.
- **`POST /api/companies/recalculate-analytics`**: Recalculates analytics cutoffs (min/avg CGPA, 10th, 12th, gender ratio, selection ratio) for all companies.

#### 📊 Analytics & Prediction Endpoints
- **`GET /api/analytics/summary`**: Generates overall placement dashboard metrics, campus breakdowns, and top recruiting company lists.
- **`POST /api/predict-companies`**: Accepts candidate CGPA, 10th %, and 12th % to return a list of companies where the candidate meets or exceeds historical minimum cutoffs.

---

## 📊 Detailed Metrics & Dashboard Analytics

The platform exposes comprehensive analytics across multiple dimensions:

1. **Master NeoID Statistics**:
   - Total Master NeoID count
   - Total Placed NeoIDs
   - Overall NeoID Placement Rate (%)
2. **Chennai NeoID Highlighted Placement Rate**:
   - Highlighted metric card displaying Chennai NeoID candidate placement percentage (`Placed / Total Chennai NeoIDs`).
3. **Selection & Conversion Ratio**:
   - Company-level selection percentage calculated as:
     $$\text{Selection Ratio} = \left(\frac{\text{Total Finally Selected Candidates}}{\text{Total Shortlisted Candidates}}\right) \times 100\%$$
4. **Academic Cutoff Thresholds**:
   - Shortlist Min CGPA & Avg CGPA
   - Selected Min CGPA & Avg CGPA
   - 10th Standard Minimum Percentage Cutoff (%)
   - 12th Standard Minimum Percentage Cutoff (%)
5. **Gender Distribution Metrics**:
   - Male / Female candidate counts in shortlists and selections
   - Formatted Gender Ratio (e.g. `2.4 : 1`)
6. **Campus-wise Placement Breakdown**:
   - Total candidates, placed count, and placement percentage broken down across `Chennai`, `Vellore`, and `Unknown / Others`.

---

## 📋 Placement Email Quick-Parser Feature

The **Company Profiles** section includes an intelligent client-side parser box that allows placement coordinators to paste raw placement cell notification emails (e.g. Saviynt email drive announcements):

```text
Name of the Company: Saviynt
Category: Super Dream Internship/ Placement
Eligible Branches: B.Tech (CSE, IT & ECE related courses)
Eligibility Criteria: % in X and XII – 90% or 9.0 CGPA, in Pursuing Degree – 90% or 9.0 CGPA, No Standing Arrears
CTC: 21,00,000 (If converted)
Stipend: 50000 per month
Website: saviynt.com
Job location: Bengaluru
Job profile: Associate Engineer / Associate Engineer (SRE)
```

Clicking **⚡ Parse & Fill Fields** automatically extracts and populates:
- **Company Name**: `Saviynt`
- **Category**: `Super Dream Internship/ Placement`
- **Job Profile / Role**: `Associate Engineer / Associate Engineer (SRE)`
- **Eligible Branches**: `B.Tech (CSE, IT & ECE related courses)`
- **Eligibility Criteria**: `90% or 9.0 CGPA in X, XII & Degree, No Standing Arrears`
- **CTC Package**: `21,00,000 (If converted)`
- **Stipend**: `50000 per month`
- **Website**: `saviynt.com`
- **Job Location**: `Bengaluru`
