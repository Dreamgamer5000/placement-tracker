# Placement Tracker Platform

A comprehensive placement tracking system built with Hono.js, Svelte, and SQLite to manage student placements, company analytics, and shortlisting processes.

## Features

### 📊 Analytics Dashboard
- Real-time placement statistics
- Branch-wise and campus-wise analytics
- Top companies by placement count
- Overall placement rate tracking

### 👥 Student Management
- Complete student profiles with academic details
- Track shortlisted companies for each student
- Monitor final placement status
- Resume links and contact information
- Search and filter capabilities

### 🏢 Company Profiles
- Company details and notes
- Shortlisting analytics (cutoffs, gender ratio, etc.)
- List of shortlisted and placed students
- Resume access for shortlisted candidates

### 📝 Shortlisting System
- Bulk add students to company shortlists
- Automatic analytics calculation
- Track multiple shortlists per student

### 🔮 Company Prediction
- Predict eligible companies based on academic marks
- Historical cutoff analysis
- Smart recommendations based on past data

## Tech Stack

- **Backend**: Hono.js (Node.js framework)
- **Frontend**: Svelte
- **Database**: SQLite with better-sqlite3
- **Build Tool**: Vite

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up the database:
```bash
npm run setup:db
```

3. Import student data from CSV files:
```bash
npm run import:data
```

## Usage

### Development Mode

Run both backend and frontend in development mode:
```bash
npm run dev
```

Or run them separately:
```bash
# Backend only (runs on http://localhost:3000)
npm run dev:backend

# Frontend only (runs on http://localhost:5173)
npm run dev:frontend
```

### Production Build

```bash
npm run build
```

## Data Format

### IOE.csv
Contains basic student information:
- `regno`: Registration number
- `name`: Student name
- `email`: VIT email
- `phone`: Phone number

### fidelity.csv
Contains detailed student information:
- `Reg..no`: Registration number
- `Name`: Student name
- `Email id (personal id)`: Personal email
- `Phone no`: Phone number
- `Gender`: Male/Female
- `CGPA`: Current CGPA
- `10th`: 10th marks (percentage)
- `12th`: 12th marks (percentage)
- `Resume link`: Google Drive or other resume link

## Branch Detection

The system automatically detects student branches from registration numbers:
- `XX**BCE**XXXX` → Computer Engineering
- `XX**BAI**XXXX` → Artificial Intelligence
- `XX**BPS**XXXX` → Physical Sciences
- etc.

## Campus Detection

Campus is detected from the 6th digit of the registration number:
- **Vellore**: XXXXX0XXX or XXXXX5XXX
- **Chennai**: XXXXX1XXX or XXXXX6XXX
- **AP**: XXXXX7XXX
- **Bhopal**: XXXXX1XXXX (10 digits)

## API Endpoints

### Students
- `GET /api/students` - Get all students
- `GET /api/students/:id` - Get student details with shortlists
- `GET /api/students/search/:regno` - Search student by registration number
- `POST /api/students/:id/place` - Mark student as placed

### Companies
- `GET /api/companies` - Get all companies
- `GET /api/companies/:id` - Get company details with analytics
- `POST /api/companies` - Create new company
- `PUT /api/companies/:id` - Update company details
- `POST /api/companies/:id/shortlist` - Add students to shortlist

### Analytics
- `GET /api/analytics/summary` - Get overall analytics summary
- `POST /api/predict-companies` - Predict eligible companies for given marks

## Database Schema

### students
- Basic info (regno, name, email, phone, etc.)
- Academic details (cgpa, 10th, 12th)
- Branch and campus (auto-detected)
- Placement status and final company

### companies
- Company name and details
- Notes and metadata (rounds, experience requirements)

### shortlists
- Many-to-many relationship between students and companies
- Timestamp of shortlisting

### company_analytics
- Automatically calculated cutoffs
- Min/max/avg CGPA, 10th, 12th marks
- Gender ratio
- Total shortlisted count

## License

MIT
