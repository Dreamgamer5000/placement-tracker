import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import Papa from 'papaparse';
import Database from 'better-sqlite3';
import { StudentsService } from '../services/students.service.js';
import { CompaniesService } from '../services/companies.service.js';

interface RegNeoRow {
  registration_number: string;
  neoid: string;
  db_name?: string;
  csv_name?: string;
  [key: string]: string | undefined;
}

async function syncMatchedNeoIds() {
  console.log('====================================================');
  console.log('🔄 Syncing Matched NeoIDs to temp_neoid_table & temp_students');
  console.log('====================================================\n');

  const csvPath = path.join(process.cwd(), 'csvs', 'reg_neo_name.csv');
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Error: ${csvPath} not found. Please run match:neoids first.`);
    process.exit(1);
  }

  const dbPath = path.join(process.cwd(), 'placement.db');
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Error: placement.db not found at ${dbPath}`);
    process.exit(1);
  }

  const db = new Database(dbPath);

  // Read reg_neo_name.csv
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const parsed = Papa.parse<RegNeoRow>(csvContent, {
    header: true,
    skipEmptyLines: true
  });

  console.log(`📄 Read ${parsed.data.length} mapped records from csvs/reg_neo_name.csv.`);

  // Prepare SQLite statements
  const upsertNeoStmt = db.prepare(`
    INSERT INTO temp_neoid_table (neoid, campus, regno)
    VALUES (?, 'Chennai', ?)
    ON CONFLICT(neoid) DO UPDATE SET
      regno = excluded.regno,
      campus = 'Chennai'
  `);

  const updateTempStudentStmt = db.prepare(`
    UPDATE temp_students
    SET neo_id = ?
    WHERE UPPER(regno) = ?
  `);

  let neoTableUpdated = 0;
  let studentsUpdated = 0;

  const insertMany = db.transaction((rows: RegNeoRow[]) => {
    for (const row of rows) {
      const regno = (row.registration_number || '').trim().toUpperCase();
      const neoid = (row.neoid || '').trim().toUpperCase();

      if (!regno || !neoid) continue;

      upsertNeoStmt.run(neoid, regno);
      neoTableUpdated++;

      const res = updateTempStudentStmt.run(neoid, regno);
      if (res.changes > 0) {
        studentsUpdated++;
      }
    }
  });

  // 1.5 Remove masters batch status for students who have a NeoID (since they are in the placement pool)
  const removeMasters = db.prepare(`
    UPDATE temp_students
    SET masters = 0,
        status = CASE WHEN status = 'masters' THEN 'not_placed' ELSE status END
    WHERE neo_id IS NOT NULL AND TRIM(neo_id) != '' AND (masters = 1 OR status = 'masters')
  `).run();

  console.log(`🎓 Cleared Masters status for ${removeMasters.changes} students who have a NeoID.\n`);

  // 2. Recalculate Student Analytics & Sync All Placement Statuses
  console.log('🔄 Recalculating student analytics and cross-referencing shortlists/selections...');
  const studentRecalc = StudentsService.recalculateStudentAnalytics();
  console.log(`   - Synced NeoIDs in temp_students: ${studentRecalc.updatedNeoIds}`);
  console.log(`   - Final placements synced:       ${studentRecalc.updatedFinalPlacements}`);
  console.log(`   - Intern selections synced:     ${studentRecalc.updatedInterns}`);
  console.log(`   - Stale candidates reset:       ${studentRecalc.resetStaleCandidates}`);

  // 3. Recalculate Company Analytics
  console.log('🔄 Recalculating company analytics across all companies...');
  const companyRecalc = CompaniesService.recalculateAllCompanyAnalytics();
  console.log(`   - Recalculated analytics for ${companyRecalc.successCount} companies.\n`);

  // 4. Dump updated database to backup.sql
  console.log('💾 Dumping updated database to backup.sql...');
  try {
    execSync('sqlite3 placement.db .dump > backup.sql', { stdio: 'inherit' });
    console.log('✅ Successfully created backup.sql!');
  } catch (err: any) {
    console.error('⚠️ Could not run sqlite3 command directly, performing fallback export:', err.message);
  }

  console.log('\n====================================================');
  console.log('🎉 Sync, Recalculation & SQL Dump Completed Successfully!');
  console.log('====================================================\n');
}

syncMatchedNeoIds().catch(err => {
  console.error('Fatal error during sync:', err);
  process.exit(1);
});
