import fs from 'fs';
import path from 'path';
import readline from 'readline';
import Papa from 'papaparse';

interface ReviewRow {
  csv_name: string;
  csv_neoid: string;
  suggested_regno: string;
  suggested_name: string;
  confidence: string;
  reason: string;
}

interface OutputRow {
  registration_number: string;
  neoid: string;
  db_name: string;
  csv_name: string;
  match_percentage: string;
  match_type: string;
}

async function runReview() {
  const reviewCsvPath = path.join(process.cwd(), 'csvs', 'unmatched_review.csv');
  const csvsRegNeoPath = path.join(process.cwd(), 'csvs', 'reg_neo_name.csv');

  if (!fs.existsSync(reviewCsvPath)) {
    console.log('No csvs/unmatched_review.csv found. Please run `npm run match:neoids` first.');
    return;
  }

  const reviewContent = fs.readFileSync(reviewCsvPath, 'utf-8');
  const parsed = Papa.parse<ReviewRow>(reviewContent, { header: true, skipEmptyLines: true });
  const items = parsed.data.filter(r => r.csv_name);

  if (items.length === 0) {
    console.log('🎉 No unmatched records to review! Everything was 100% matched.');
    return;
  }

  console.log('====================================================');
  console.log(`📋 Quick Interactive Reviewer (${items.length} records)`);
  console.log('====================================================');
  console.log('Instructions:');
  console.log('  - Press [Enter] or [y] to ACCEPT suggested registration number');
  console.log('  - Type a custom Registration Number (e.g. 23BCE1234) if different');
  console.log('  - Type [s] or [n] to SKIP this record');
  console.log('  - Type [q] to QUIT and save progress\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const prompt = (query: string): Promise<string> => {
    return new Promise(resolve => rl.question(query, resolve));
  };

  const newApprovedMatches: OutputRow[] = [];
  const remainingUnmatched: ReviewRow[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`----------------------------------------------------`);
    console.log(`[${i + 1}/${items.length}] CSV Name:  "${item.csv_name}"`);
    console.log(`       NeoID:     ${item.csv_neoid || 'None'}`);
    if (item.suggested_regno) {
      console.log(`       Suggested: ${item.suggested_name} [${item.suggested_regno}] (${(Number(item.confidence) * 100).toFixed(0)}% confidence)`);
      console.log(`       Reason:    ${item.reason}`);
    } else {
      console.log(`       Suggested: (No direct candidate found)`);
    }

    const answer = (await prompt(`Action (y / n / custom regno / q): `)).trim();

    if (answer.toLowerCase() === 'q') {
      console.log('\nExiting review early...');
      remainingUnmatched.push(...items.slice(i));
      break;
    }

    if (answer === '' || answer.toLowerCase() === 'y') {
      if (item.suggested_regno) {
        newApprovedMatches.push({
          registration_number: item.suggested_regno.toUpperCase(),
          neoid: item.csv_neoid,
          db_name: item.suggested_name || item.csv_name,
          csv_name: item.csv_name,
          match_percentage: `${Math.round((Number(item.confidence) || 0.9) * 100)}%`,
          match_type: 'manual_approved'
        });
        console.log(`✅ Accepted: ${item.suggested_regno}`);
      } else {
        console.log(`⚠️ No suggestion available to accept. Skipped.`);
        remainingUnmatched.push(item);
      }
    } else if (answer.toLowerCase() === 'n' || answer.toLowerCase() === 's') {
      console.log(`⏭️ Skipped.`);
      remainingUnmatched.push(item);
    } else if (/^[0-9]{2}[A-Za-z]{3}[0-9]{4,5}$/i.test(answer)) {
      newApprovedMatches.push({
        registration_number: answer.toUpperCase(),
        neoid: item.csv_neoid,
        db_name: item.csv_name,
        csv_name: item.csv_name,
        match_percentage: '100%',
        match_type: 'manual_override'
      });
      console.log(`✅ Added custom match: ${answer.toUpperCase()}`);
    } else {
      console.log(`⏭️ Skipped.`);
      remainingUnmatched.push(item);
    }
  }

  rl.close();

  if (newApprovedMatches.length > 0) {
    // Append to existing csvs/reg_neo_name.csv
    let existing: OutputRow[] = [];
    if (fs.existsSync(csvsRegNeoPath)) {
      const existingCsv = fs.readFileSync(csvsRegNeoPath, 'utf-8');
      existing = Papa.parse<OutputRow>(existingCsv, { header: true, skipEmptyLines: true }).data;
    }

    const combined = [...existing, ...newApprovedMatches];
    const outputCsv = Papa.unparse(combined, {
      columns: ['registration_number', 'neoid', 'db_name', 'csv_name', 'match_percentage', 'match_type'],
      header: true
    });
    fs.writeFileSync(csvsRegNeoPath, outputCsv, 'utf-8');

    console.log(`\n🎉 Added ${newApprovedMatches.length} newly approved matches to csvs/reg_neo_name.csv!`);
  }

  // Update csvs/unmatched_review.csv with remaining
  const updatedUnmatchedCsv = Papa.unparse(remainingUnmatched, {
    columns: ['csv_name', 'csv_neoid', 'suggested_regno', 'suggested_name', 'confidence', 'reason'],
    header: true
  });
  fs.writeFileSync(reviewCsvPath, updatedUnmatchedCsv, 'utf-8');
  console.log(`Remaining in unmatched queue: ${remainingUnmatched.length}\n`);
}

runReview().catch(err => {
  console.error('Error during review:', err);
  process.exit(1);
});
