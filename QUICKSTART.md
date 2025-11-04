# 🚀 Quick Start Guide

## What We Built

A comprehensive placement tracking platform with the following features:

### ✅ Core Features Implemented

1. **Student Profiles**
   - 3,572 students imported from IOE.csv
   - 949 students enriched with Fidelity data (CGPA, marks, resumes)
   - Auto-detected branch and campus from registration numbers
   - Search and filter capabilities

2. **Company Management**
   - Create and manage company profiles
   - Add notes, rounds info, and experience requirements
   - View shortlisted and placed students

3. **Shortlisting System**
   - Bulk add students to company shortlists
   - Track multiple shortlists per student
   - Automatic analytics calculation

4. **Analytics Dashboard**
   - Real-time placement statistics
   - Branch-wise and campus-wise breakdowns
   - Company cutoff analysis (min/avg CGPA, 10th, 12th)
   - Gender ratio tracking

5. **Company Prediction**
   - Enter student marks to predict eligible companies
   - Based on historical cutoff data
   - Shows min/max/avg requirements per company

## 🌐 Access the Application

The application is now running at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000

## 📊 How to Use

### 1. View Analytics
- Navigate to the Analytics tab (default view)
- See overall statistics, branch-wise data, and campus-wise data

### 2. Browse Students
- Click "Students" in the navigation
- Search by name, registration number, or branch
- Click "View Details" to see full profile including shortlists

### 3. Manage Companies
- Click "Companies" in the navigation
- Click "+ Add Company" to create new companies
- Click on a company card to view:
  - Cutoff analytics
  - Shortlisted students with their marks and resumes
  - Final placements

### 4. Add Shortlists
- Click "Add Shortlist" in the navigation
- Select a company from the dropdown
- Enter registration numbers (one per line)
- System automatically calculates cutoffs and analytics

### 5. Predict Eligible Companies
- Click "Predict Companies" in the navigation
- Enter CGPA, 10th marks, and 12th marks
- System shows companies where the student meets minimum requirements

## 🎯 Example Workflow

1. **Add a Company**
   - Go to Companies → Add Company
   - Enter: "Google", Notes: "Software Engineering Internship", Rounds: "3"

2. **Add Students to Shortlist**
   - Go to Add Shortlist
   - Select "Google"
   - Enter registration numbers of shortlisted students

3. **View Analytics**
   - Go back to Companies
   - Click on "Google"
   - See minimum CGPA, gender ratio, and all shortlisted students

4. **Check Eligibility**
   - Go to Predict Companies
   - Enter marks: CGPA 8.5, 10th: 90, 12th: 85
   - See which companies this student is eligible for

## 📁 Data Structure

### Branch Detection
Registration numbers like `23BAI1001` are automatically parsed:
- `23` = Batch year
- `BAI` = Branch (Artificial Intelligence)
- `1001` = Roll number with campus code

### Campus Detection (6th digit)
- `0` or `5` = Vellore
- `1` or `6` = Chennai
- `7` = AP
- `1` in 10-digit regno = Bhopal

## 🔧 Development Commands

```bash
# Start both servers
pnpm run dev

# Backend only
pnpm run dev:backend

# Frontend only
pnpm run dev:frontend

# Setup database
pnpm run setup:db

# Import data
pnpm run import:data

# Build for production
pnpm run build
```

## 📝 Next Steps

To make the platform more useful:

1. **Add more companies** through the Companies interface
2. **Update shortlists** as students get selected
3. **Mark students as placed** when they accept offers
4. **View analytics** to understand placement trends

## 🎨 Features Highlight

- **Real-time search**: Instantly filter students and companies
- **Responsive design**: Works on desktop and mobile
- **Auto-calculated analytics**: Cutoffs update automatically
- **Resume links**: Direct access to student resumes
- **Bulk operations**: Add multiple students at once
- **Smart predictions**: AI-powered company recommendations

Enjoy using your placement tracker! 🎓
