import { execSync } from 'child_process';
import { StudentsService } from '../services/students.service.js';
import { CompaniesService } from '../services/companies.service.js';

async function main() {
  console.log('====================================================');
  console.log('🔄 Recalculating Placement & Student Analytics');
  console.log('====================================================\n');

  console.log('1. Standardizing branch codes & syncing student analytics...');
  const studentRecalc = StudentsService.recalculateStudentAnalytics();
  console.log(`   - Synced NeoIDs in temp_students: ${studentRecalc.updatedNeoIds}`);
  console.log(`   - Final placements synced:       ${studentRecalc.updatedFinalPlacements}`);
  console.log(`   - Intern selections synced:     ${studentRecalc.updatedInterns}`);
  console.log(`   - Stale candidates reset:       ${studentRecalc.resetStaleCandidates}\n`);

  console.log('2. Recalculating company analytics...');
  const companyRecalc = CompaniesService.recalculateAllCompanyAnalytics();
  console.log(`   - Recalculated analytics for ${companyRecalc.successCount} companies.\n`);

  console.log('3. Dumping updated state to backup.sql...');
  try {
    execSync('sqlite3 placement.db .dump > backup.sql', { stdio: 'inherit' });
    console.log('✅ Successfully created backup.sql!');
  } catch (err: any) {
    console.warn('⚠️ Could not run sqlite3 command directly:', err.message);
  }

  console.log('\n====================================================');
  console.log('🎉 Analytics Recalculation & SQL Dump Completed!');
  console.log('====================================================\n');
}

main().catch(err => {
  console.error('Fatal error during analytics recalculation:', err);
  process.exit(1);
});
