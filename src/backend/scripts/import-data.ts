import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import db from '../db/index.js';
import { extractBranch, extractCampus, normalizeRegNo, parseMarks } from '../utils.js';

interface IOERow {
  regno: string;
  name: string;
  email: string;
  phone: string;
}

interface FidelityRow {
  'Reg..no': string;
  'Name': string;
  'Email id (personal id)': string;
  'Phone no': string;
  'Gender': string;
  'CGPA': string;
  '10th': string;
  '12th': string;
  'Resume link': string;
}

async function importIOEData() {
  console.log('Importing IOE.csv...');
  
  const csvPath = path.join(process.cwd(), 'IOE.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  
  const results = Papa.parse<IOERow>(csvContent, {
    header: true,
    skipEmptyLines: true
  });
  
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO students (regno, name, email, phone, branch, campus)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  let count = 0;
  for (const row of results.data) {
    if (!row.regno || !row.name) continue;
    
    const regno = normalizeRegNo(row.regno);
    const branch = extractBranch(regno);
    const campus = extractCampus(regno);
    
    insertStmt.run(regno, row.name, row.email, row.phone || null, branch, campus);
    count++;
  }
  
  console.log(`Imported ${count} students from IOE.csv`);
}

async function importFidelityData() {
  console.log('Importing fidelity.csv...');
  
  const csvPath = path.join(process.cwd(), 'fidelity.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  
  const results = Papa.parse<FidelityRow>(csvContent, {
    header: true,
    skipEmptyLines: true
  });
  
  const updateStmt = db.prepare(`
    UPDATE students
    SET personal_email = ?, gender = ?, cgpa = ?, tenth_marks = ?, twelfth_marks = ?, resume_link = ?
    WHERE regno = ?
  `);
  
  let count = 0;
  let notFound = 0;
  
  for (const row of results.data) {
    if (!row['Reg..no']) continue;
    
    const regno = normalizeRegNo(row['Reg..no']);
    const student = db.prepare('SELECT id FROM students WHERE regno = ?').get(regno);
    
    if (!student) {
      notFound++;
      continue;
    }
    
    const cgpa = parseMarks(row['CGPA']);
    const tenth = parseMarks(row['10th']);
    const twelfth = parseMarks(row['12th']);
    
    updateStmt.run(
      row['Email id (personal id)'] || null,
      row['Gender'] || null,
      cgpa || null,
      tenth || null,
      twelfth || null,
      row['Resume link'] || null,
      regno
    );
    count++;
  }
  
  console.log(`Updated ${count} students from fidelity.csv`);
  console.log(`${notFound} students not found in IOE data`);
}

async function main() {
  try {
    await importIOEData();
    await importFidelityData();
    console.log('Data import complete!');
  } catch (error) {
    console.error('Error importing data:', error);
    process.exit(1);
  }
}

main();
