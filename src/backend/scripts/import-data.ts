import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import db from '../db/index.js';
import { extractBranch, normalizeRegNo, parseMarks } from '../utils.js';

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

interface Mapping1Row {
  'Register number': string;
  'Name': string;
  'NeoID': string;
  'Phone number': string;
  'Gender': string;
}

interface Mapping2Row {
  'Neo id': string;
  'Reg No': string;
  'Campus': string;
}

interface Mapping3Row {
  "S.No"?: string;
  "Candidate's Name"?: string;
  "Reg. No."?: string;
  "NEO ID"?: string;
}

function isValidNeoId(str: any): boolean {
  if (!str || typeof str !== 'string') return false;
  const clean = str.trim();
  if (!clean || clean.toLowerCase() === 'null' || clean.toLowerCase() === 'undefined' || clean.includes('@')) return false;
  return /^[A-Za-z0-9]{8}$/.test(clean);
}

function getCsvPath(filename: string): string {
  const inCsvs = path.join(process.cwd(), 'csvs', filename);
  if (fs.existsSync(inCsvs)) return inCsvs;
  return path.join(process.cwd(), filename);
}

// ---------------------------------------------------------------------------
// 1. IOE.csv -> temp_students (all students belong to Chennai campus)
// ---------------------------------------------------------------------------
async function importIOEData() {
  console.log('Importing IOE.csv into temp_students...');
  const csvPath = getCsvPath('IOE.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('IOE.csv not found, skipping');
    return;
  }
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const results = Papa.parse<IOERow>(csvContent, { header: true, skipEmptyLines: true });
  
  const insertTempStmt = db.prepare(`
    INSERT INTO temp_students (regno, name, email, phone, branch, campus)
    VALUES (?, ?, ?, ?, ?, 'Chennai')
    ON CONFLICT(regno) DO UPDATE SET
      name = excluded.name,
      email = excluded.email,
      phone = COALESCE(excluded.phone, temp_students.phone),
      branch = excluded.branch,
      campus = 'Chennai'
  `);
  
  let count = 0;
  for (const row of results.data) {
    if (!row.regno || !row.name) continue;
    const regno = normalizeRegNo(row.regno);
    const branch = extractBranch(regno);
    
    if (branch === 'MIS' || branch === 'MIA' || regno.includes('MIS') || regno.includes('MIA')) {
      continue;
    }
    
    insertTempStmt.run(regno, row.name, row.email, row.phone || null, branch);
    count++;
  }
  
  console.log(`Imported ${count} students into temp_students (campus = Chennai)`);
}

// ---------------------------------------------------------------------------
// 2. fidelity.csv -> update temp_students details
// ---------------------------------------------------------------------------
async function importFidelityData() {
  console.log('Importing fidelity.csv into temp_students...');
  const csvPath = getCsvPath('fidelity.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('fidelity.csv not found, skipping');
    return;
  }
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const results = Papa.parse<FidelityRow>(csvContent, { header: true, skipEmptyLines: true });
  
  const updateTempStmt = db.prepare(`
    UPDATE temp_students
    SET personal_email = ?, gender = ?, cgpa = ?, tenth_marks = ?, twelfth_marks = ?, resume_link = ?
    WHERE regno = ?
  `);
  
  let count = 0;
  for (const row of results.data) {
    if (!row['Reg..no']) continue;
    const regno = normalizeRegNo(row['Reg..no']);
    const cgpa = parseMarks(row['CGPA']);
    const tenth = parseMarks(row['10th']);
    const twelfth = parseMarks(row['12th']);

    const res = updateTempStmt.run(
      row['Email id (personal id)'] || null,
      row['Gender'] || null,
      cgpa || null,
      tenth || null,
      twelfth || null,
      row['Resume link'] || null,
      regno
    );
    if (res.changes > 0) count++;
  }
  
  console.log(`Updated academic details for ${count} students in temp_students`);
}

// ---------------------------------------------------------------------------
// 3. all_neoids.csv -> temp_neoid_table (default campus = 'Unknown')
// ---------------------------------------------------------------------------
async function importAllNeoIdsData() {
  console.log('Importing all_neoids.csv into temp_neoid_table...');
  const csvPath = getCsvPath('all_neoids.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('all_neoids.csv not found, skipping');
    return;
  }
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const results = Papa.parse<{ 'Neo ID': string }>(csvContent, { header: true, skipEmptyLines: true });

  // Reset existing campus values in temp_neoid_table to 'Unknown'
  db.prepare(`UPDATE temp_neoid_table SET campus = 'Unknown'`).run();

  const insertTempStmt = db.prepare(`
    INSERT INTO temp_neoid_table (neoid, campus)
    VALUES (?, 'Unknown')
    ON CONFLICT(neoid) DO UPDATE SET campus = 'Unknown'
  `);

  let count = 0;
  for (const row of results.data) {
    const rawNeo = row['Neo ID'] || Object.values(row)[0];
    if (!rawNeo) continue;
    const neoid = String(rawNeo).trim().toUpperCase();
    if (!isValidNeoId(neoid)) continue;

    insertTempStmt.run(neoid);
    count++;
  }

  console.log(`Processed ${count} NeoIDs from all_neoids.csv into temp_neoid_table`);
}

// ---------------------------------------------------------------------------
// 4. Chennai_neoids.csv -> set campus = 'Chennai' in temp_neoid_table
// ---------------------------------------------------------------------------
async function importChennaiNeoIdsData() {
  console.log('Importing Chennai_neoids.csv into temp_neoid_table...');
  const csvPath = getCsvPath('Chennai_neoids.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('Chennai_neoids.csv not found, skipping');
    return;
  }
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const results = Papa.parse<{ 'neoids': string }>(csvContent, { header: true, skipEmptyLines: true });

  const updateTempNeoStmt = db.prepare(`
    INSERT INTO temp_neoid_table (neoid, campus)
    VALUES (?, 'Chennai')
    ON CONFLICT(neoid) DO UPDATE SET campus = 'Chennai'
  `);

  let count = 0;
  for (const row of results.data) {
    const rawNeo = row['neoids'] || Object.values(row)[0];
    if (!rawNeo) continue;
    const neoid = String(rawNeo).trim().toUpperCase();
    if (!isValidNeoId(neoid)) continue;

    updateTempNeoStmt.run(neoid);
    count++;
  }

  console.log(`Marked ${count} NeoIDs as campus Chennai in temp_neoid_table`);
}

// ---------------------------------------------------------------------------
// 5. Vellore_Neoids.csv -> set campus = 'Vellore' in temp_neoid_table
// ---------------------------------------------------------------------------
async function importVelloreNeoIdsData() {
  console.log('Importing Vellore_Neoids.csv into temp_neoid_table...');
  const csvPath = getCsvPath('Vellore_Neoids.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('Vellore_Neoids.csv not found, skipping');
    return;
  }
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const results = Papa.parse<{ 'vellore_neoids': string }>(csvContent, { header: true, skipEmptyLines: true });

  const updateTempNeoStmt = db.prepare(`
    INSERT INTO temp_neoid_table (neoid, campus)
    VALUES (?, 'Vellore')
    ON CONFLICT(neoid) DO UPDATE SET campus = 'Vellore'
  `);

  let count = 0;
  for (const row of results.data) {
    const rawNeo = row['vellore_neoids'] || Object.values(row)[0];
    if (!rawNeo) continue;
    const neoid = String(rawNeo).trim().toUpperCase();
    if (!isValidNeoId(neoid)) continue;

    updateTempNeoStmt.run(neoid);
    count++;
  }

  console.log(`Marked ${count} NeoIDs as campus Vellore in temp_neoid_table`);
}

// ---------------------------------------------------------------------------
// 6. Mappings -> map regno <-> neoid in temp_neoid_table & temp_students
// ---------------------------------------------------------------------------
async function importMapping1Data() {
  console.log('Importing mapping1.csv...');
  const csvPath = getCsvPath('mapping1.csv');
  if (!fs.existsSync(csvPath)) return;
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const results = Papa.parse<Mapping1Row>(csvContent, { header: true, skipEmptyLines: true });

  const insertTempNeoStmt = db.prepare(`
    INSERT INTO temp_neoid_table (neoid, campus, regno)
    VALUES (?, 'Unknown', ?)
    ON CONFLICT(neoid) DO UPDATE SET regno = COALESCE(excluded.regno, temp_neoid_table.regno)
  `);

  const updateTempStudentStmt = db.prepare(`
    UPDATE temp_students
    SET neo_id = ?, gender = COALESCE(gender, ?), phone = COALESCE(phone, ?)
    WHERE UPPER(regno) = ?
  `);

  let count = 0;
  for (const row of results.data) {
    const rawRegno = row['Register number'];
    const neoId = row['NeoID']?.trim().toUpperCase();
    if (!rawRegno || !neoId || !isValidNeoId(neoId)) continue;

    const regno = normalizeRegNo(rawRegno);
    insertTempNeoStmt.run(neoId, regno);
    const res = updateTempStudentStmt.run(neoId, row['Gender'] || null, row['Phone number'] || null, regno.toUpperCase());
    if (res.changes > 0) count++;
  }

  console.log(`Mapped NeoID for ${count} students from mapping1.csv`);
}

async function importMapping2Data() {
  console.log('Importing mapping2.csv...');
  const csvPath = getCsvPath('mapping2.csv');
  if (!fs.existsSync(csvPath)) return;
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const results = Papa.parse<Mapping2Row>(csvContent, { header: true, skipEmptyLines: true });

  const insertTempNeoStmt = db.prepare(`
    INSERT INTO temp_neoid_table (neoid, campus, regno)
    VALUES (?, 'Unknown', ?)
    ON CONFLICT(neoid) DO UPDATE SET regno = COALESCE(excluded.regno, temp_neoid_table.regno)
  `);

  const updateTempStudentStmt = db.prepare(`
    UPDATE temp_students SET neo_id = ? WHERE UPPER(regno) = ?
  `);

  let count = 0;
  for (const row of results.data) {
    const rawRegno = row['Reg No'];
    const neoId = row['Neo id']?.trim().toUpperCase();
    if (!rawRegno || !neoId || !isValidNeoId(neoId)) continue;

    const regno = normalizeRegNo(rawRegno);
    insertTempNeoStmt.run(neoId, regno);
    const res = updateTempStudentStmt.run(neoId, regno.toUpperCase());
    if (res.changes > 0) count++;
  }

  console.log(`Mapped NeoID for ${count} students from mapping2.csv`);
}

async function importMapping3Data() {
  console.log('Importing mapping3.csv...');
  const csvPath = getCsvPath('mapping3.csv');
  if (!fs.existsSync(csvPath)) return;
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const results = Papa.parse<Mapping3Row>(csvContent, { header: true, skipEmptyLines: true });

  const insertTempNeoStmt = db.prepare(`
    INSERT INTO temp_neoid_table (neoid, campus, regno)
    VALUES (?, 'Unknown', ?)
    ON CONFLICT(neoid) DO UPDATE SET regno = COALESCE(excluded.regno, temp_neoid_table.regno)
  `);

  const updateTempStudentStmt = db.prepare(`
    UPDATE temp_students SET neo_id = ? WHERE UPPER(regno) = ?
  `);

  let count = 0;
  for (const row of results.data) {
    const rawRegno = row['Reg. No.'];
    const neoId = row['NEO ID']?.trim().toUpperCase();
    if (!rawRegno || !neoId || !isValidNeoId(neoId)) continue;

    const regno = normalizeRegNo(rawRegno);
    insertTempNeoStmt.run(neoId, regno);
    const res = updateTempStudentStmt.run(neoId, regno.toUpperCase());
    if (res.changes > 0) count++;
  }

  console.log(`Mapped NeoID for ${count} students from mapping3.csv`);
}

// ---------------------------------------------------------------------------
// 7. topcoder.csv -> mark topcoder = 1 in temp_neoid_table & temp_students
// ---------------------------------------------------------------------------
async function importTopcoderData() {
  console.log('Importing topcoder.csv into temp tables...');
  const csvPath = getCsvPath('topcoder.csv');
  if (!fs.existsSync(csvPath)) return;
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split(/\r?\n/);

  const updateTempNeoStmt = db.prepare(`
    INSERT INTO temp_neoid_table (neoid, topcoder)
    VALUES (?, 1)
    ON CONFLICT(neoid) DO UPDATE SET topcoder = 1
  `);

  let neoCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const neoId = lines[i].trim().toUpperCase();
    if (!neoId || neoId === 'NEO ID' || !isValidNeoId(neoId)) continue;

    updateTempNeoStmt.run(neoId);
    neoCount++;
  }

  const updateTempStudentsStmt = db.prepare(`
    UPDATE temp_students
    SET topcoder = 1
    WHERE UPPER(neo_id) IN (SELECT UPPER(neoid) FROM temp_neoid_table WHERE topcoder = 1)
       OR UPPER(regno) IN (SELECT UPPER(regno) FROM temp_neoid_table WHERE topcoder = 1 AND regno IS NOT NULL)
  `);

  const tempResult = updateTempStudentsStmt.run();

  console.log(`Marked ${neoCount} Neo IDs as Topcoder in temp_neoid_table`);
  console.log(`Marked ${tempResult.changes} students as Topcoder in temp_students table`);
}

async function main() {
  try {
    await importIOEData();
    await importFidelityData();
    await importAllNeoIdsData();
    await importChennaiNeoIdsData();
    await importVelloreNeoIdsData();
    await importMapping1Data();
    await importMapping2Data();
    await importMapping3Data();
    await importTopcoderData();

    // Ensure all temp_students are set directly to Chennai campus
    db.prepare(`UPDATE temp_students SET campus = 'Chennai'`).run();

    // Ensure empty/null campus values in temp_neoid_table default to Unknown
    db.prepare(`UPDATE temp_neoid_table SET campus = 'Unknown' WHERE campus IS NULL OR campus = ''`).run();

    console.log('Temp tables imported and synced successfully!');
  } catch (error) {
    console.error('Error importing CSV data into temp tables:', error);
    process.exit(1);
  }
}

main();
