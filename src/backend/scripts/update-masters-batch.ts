import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import Database from 'better-sqlite3';
import { StudentsService } from '../services/students.service.js';
import { CompaniesService } from '../services/companies.service.js';

async function updateMastersBatch() {
  console.log('====================================================');
  console.log('🎓 Updating Masters Batch (Removing for students with NeoID)');
  console.log('====================================================\n');

  const dbPath = path.join(process.cwd(), 'placement.db');
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Error: placement.db not found at ${dbPath}`);
    process.exit(1);
  }

  const db = new Database(dbPath);

  // 1. Check affected students before update
  const affected = db.prepare(`
    SELECT regno, name, neo_id, status, masters
    FROM temp_students
    WHERE neo_id IS NOT NULL AND TRIM(neo_id) != '' 
      AND (masters = 1 OR status = 'masters')
  `).all() as { regno: string; name: string; neo_id: string; status: string; masters: number }[];

  console.log(`Found ${affected.length} students currently marked as Masters who have a NeoID.`);
  if (affected.length > 0) {
    console.log('Sample of students being transitioned from Masters to Placement Pool:');
    affected.slice(0, 10).forEach((s, idx) => {
      console.log(`  ${idx + 1}. [${s.regno}] ${s.name} (NeoID: ${s.neo_id}) - Status: ${s.status}`);
    });
    if (affected.length > 10) {
      console.log(`  ... and ${affected.length - 10} more.`);
    }
  }

  // 2. Perform the update
  const updateResult = db.prepare(`
    UPDATE temp_students
    SET masters = 0,
        status = CASE WHEN status = 'masters' THEN 'not_placed' ELSE status END
    WHERE neo_id IS NOT NULL AND TRIM(neo_id) != '' 
      AND (masters = 1 OR status = 'masters')
  `).run();

  console.log(`\n✅ Successfully cleared Masters status for ${updateResult.changes} students.\n`);

  // 3. Recalculate Student & Company Analytics
  console.log('🔄 Recalculating student and company analytics...');
  const studentRecalc = StudentsService.recalculateStudentAnalytics();
  console.log(`   - Synced NeoIDs in temp_students: ${studentRecalc.updatedNeoIds}`);
  console.log(`   - Final placements synced:       ${studentRecalc.updatedFinalPlacements}`);
  console.log(`   - Intern selections synced:     ${studentRecalc.updatedInterns}`);

  const companyRecalc = CompaniesService.recalculateAllCompanyAnalytics();
  console.log(`   - Recalculated analytics for ${companyRecalc.successCount} companies.\n`);

  // 4. Dump updated database to backup.sql
  console.log('💾 Dumping updated database to backup.sql...');
  try {
    execSync('sqlite3 placement.db .dump > backup.sql', { stdio: 'inherit' });
    console.log('✅ Successfully updated backup.sql!');
  } catch (err: any) {
    console.error('⚠️ Warning: sqlite3 CLI dump failed:', err.message);
  }

  console.log('\n====================================================');
  console.log('🎉 Masters Batch Update Completed Successfully!');
  console.log('====================================================\n');
}

updateMastersBatch().catch(err => {
  console.error('Fatal error during update-masters-batch:', err);
  process.exit(1);
});
