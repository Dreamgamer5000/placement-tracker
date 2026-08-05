import { initDatabase } from '../db/index.js';
import db from '../db/index.js';

// Check and add neo_id column to students table if missing
const studentTableInfo = db.pragma('table_info(students)') as { name: string }[];
const hasNeoIdColumn = studentTableInfo.some((col) => col.name === 'neo_id');
if (!hasNeoIdColumn && studentTableInfo.length > 0) {
  console.log('Adding neo_id column to students table...');
  db.exec('ALTER TABLE students ADD COLUMN neo_id TEXT');
}

const hasMastersColumn = studentTableInfo.some((col) => col.name === 'masters');
if (!hasMastersColumn && studentTableInfo.length > 0) {
  console.log('Adding masters column to students table...');
  db.exec('ALTER TABLE students ADD COLUMN masters BOOLEAN DEFAULT 0');
}

const hasStatusColumn = studentTableInfo.some((col) => col.name === 'status');
if (!hasStatusColumn && studentTableInfo.length > 0) {
  console.log('Adding status column to students table...');
  db.exec("ALTER TABLE students ADD COLUMN status TEXT DEFAULT 'not_placed'");
}

const hasTopcoderStudent = studentTableInfo.some((col) => col.name === 'topcoder');
if (!hasTopcoderStudent && studentTableInfo.length > 0) {
  console.log('Adding topcoder column to students table...');
  db.exec('ALTER TABLE students ADD COLUMN topcoder BOOLEAN DEFAULT 0');
}

// Data Conversion: convert all currently placed values to 'intern' as requested
console.log("Migrating student statuses (converting placed -> 'intern')...");
db.exec("UPDATE students SET status = 'intern' WHERE placed = 1 OR placed = '1' OR placed = 'true'");
db.exec("UPDATE students SET status = 'masters' WHERE masters = 1 OR masters = '1' OR masters = 'true'");
db.exec("UPDATE students SET status = 'not_placed' WHERE status IS NULL OR status = '' OR status = '0'");

// Check and add student_id and regno columns to neo_ids table if missing
const neoIdTableInfo = db.pragma('table_info(neo_ids)') as { name: string }[];
const hasStudentId = neoIdTableInfo.some((col) => col.name === 'student_id');
if (!hasStudentId && neoIdTableInfo.length > 0) {
  console.log('Adding student_id column to neo_ids table...');
  db.exec('ALTER TABLE neo_ids ADD COLUMN student_id INTEGER REFERENCES students(id) ON DELETE SET NULL');
}

const hasRegNo = neoIdTableInfo.some((col) => col.name === 'regno');
if (!hasRegNo && neoIdTableInfo.length > 0) {
  console.log('Adding regno column to neo_ids table...');
  db.exec('ALTER TABLE neo_ids ADD COLUMN regno TEXT');
}

const hasTopcoderNeoId = neoIdTableInfo.some((col) => col.name === 'topcoder');
if (!hasTopcoderNeoId && neoIdTableInfo.length > 0) {
  console.log('Adding topcoder column to neo_ids table...');
  db.exec('ALTER TABLE neo_ids ADD COLUMN topcoder BOOLEAN DEFAULT 0');
}

// Check and add ctc, total_rounds, and round_details columns to companies table if missing
const companyTableInfo = db.pragma('table_info(companies)') as { name: string }[];
const hasCtc = companyTableInfo.some((col) => col.name === 'ctc');
if (!hasCtc && companyTableInfo.length > 0) {
  console.log('Adding ctc column to companies table...');
  db.exec('ALTER TABLE companies ADD COLUMN ctc TEXT');
}

const hasTotalRounds = companyTableInfo.some((col) => col.name === 'total_rounds');
if (!hasTotalRounds && companyTableInfo.length > 0) {
  console.log('Adding total_rounds column to companies table...');
  db.exec('ALTER TABLE companies ADD COLUMN total_rounds INTEGER');
}

const hasRoundDetails = companyTableInfo.some((col) => col.name === 'round_details');
if (!hasRoundDetails && companyTableInfo.length > 0) {
  console.log('Adding round_details column to companies table...');
  db.exec('ALTER TABLE companies ADD COLUMN round_details TEXT');
}

const extraCols = ['role', 'category', 'stipend', 'job_location', 'eligible_branches', 'eligibility_criteria', 'website'];
for (const colName of extraCols) {
  if (!companyTableInfo.some((col) => col.name === colName) && companyTableInfo.length > 0) {
    console.log(`Adding ${colName} column to companies table...`);
    db.exec(`ALTER TABLE companies ADD COLUMN ${colName} TEXT`);
  }
}

// Recreate shortlists table if missing round_number or to update unique index
const shortlistTableInfo = db.pragma('table_info(shortlists)') as { name: string }[];
const hasRoundNumber = shortlistTableInfo.some((col) => col.name === 'round_number');
if (!hasRoundNumber && shortlistTableInfo.length > 0) {
  console.log('Migrating shortlists table for multi-round support...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS shortlists_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      company_id INTEGER NOT NULL,
      round_number INTEGER NOT NULL DEFAULT 1,
      round_name TEXT NOT NULL DEFAULT 'Shortlist 1',
      shortlisted_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      UNIQUE(student_id, company_id, round_number)
    );
    INSERT OR IGNORE INTO shortlists_new (id, student_id, company_id, shortlisted_at)
    SELECT id, student_id, company_id, shortlisted_at FROM shortlists;
    DROP TABLE shortlists;
    ALTER TABLE shortlists_new RENAME TO shortlists;
  `);
}

// Drop and recreate company_analytics table to apply new schema
console.log('Migrating company_analytics table...');
db.exec('DROP TABLE IF EXISTS company_analytics');

initDatabase();
console.log('Database setup complete!');
