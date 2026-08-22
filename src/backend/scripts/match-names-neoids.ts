import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import Database from 'better-sqlite3';
import { jaroWinkler } from '../utils/fuzzy.utils.js';

interface StudentProfile {
  regno: string;
  name: string;
  source: 'temp_students' | 'placement_batch.csv';
  email?: string;
  emailAliases: string[];
  
  // Normalized tokens
  normalized: string;
  compact: string; // space-free
  sortedTokens: string;
  mainTokens: string[];
  initials: string[];
  wordsSet: Set<string>;
}

interface CsvRow {
  'Full Name'?: string;
  'Neo ID'?: string;
  [key: string]: string | undefined;
}

interface PlacementBatchRow {
  'REG NO'?: string;
  'STUDENT NAME'?: string;
  [key: string]: string | undefined;
}

interface MatchResult {
  registration_number: string;
  neoid: string;
  db_name: string;
  csv_name: string;
  match_percentage: string;
  match_type: string;
  matched_source: string;
  reason?: string;
}

interface UnmatchedRecord {
  csv_name: string;
  csv_neoid: string;
  suggested_regno: string;
  suggested_name: string;
  confidence: string;
  reason: string;
}

const NOISE_WORDS = new Set(['official', 'student', 'vit', 'chennai', 'vellore', 'dr', 'mr', 'ms']);

function normalize(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/['’`.]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toCompact(str: string): string {
  return normalize(str).replace(/\s+/g, '');
}

function extractEmailAliases(email?: string | null): string[] {
  if (!email) return [];
  const username = email.split('@')[0] || '';
  const cleaned = username
    .toLowerCase()
    .replace(/[0-9]/g, '')
    .replace(/[._\-+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < 3) return [];
  return [cleaned, cleaned.replace(/\s+/g, '')];
}

function getTokens(normalized: string): { tokens: string[]; mainTokens: string[]; initials: string[]; wordsSet: Set<string> } {
  const parts = normalized.split(' ').filter(p => p && !NOISE_WORDS.has(p));
  const mainTokens: string[] = [];
  const initials: string[] = [];
  const wordsSet = new Set<string>();

  for (const part of parts) {
    wordsSet.add(part);
    if (part.length === 1) {
      initials.push(part);
    } else {
      mainTokens.push(part);
    }
  }

  return {
    tokens: parts,
    mainTokens: mainTokens.sort(),
    initials: initials.sort(),
    wordsSet
  };
}

function getSortedTokens(normalized: string): string {
  const parts = normalized.split(' ').filter(p => p && !NOISE_WORDS.has(p));
  return parts.sort().join(' ');
}

function countExactShared(tokensA: string[], wordsSetB: Set<string>): number {
  let count = 0;
  for (const t of tokensA) {
    if (t.length >= 2 && wordsSetB.has(t)) {
      count++;
    }
  }
  return count;
}

function createProfile(regno: string, name: string, source: 'temp_students' | 'placement_batch.csv', email?: string, personalEmail?: string): StudentProfile {
  const norm = normalize(name);
  const compact = toCompact(name);
  const { tokens, mainTokens, initials, wordsSet } = getTokens(norm);
  const emailAliases = [
    ...extractEmailAliases(email),
    ...extractEmailAliases(personalEmail)
  ];

  return {
    regno: regno.trim().toUpperCase(),
    name: name.trim(),
    source,
    email: email || '',
    emailAliases,
    normalized: norm,
    compact,
    sortedTokens: getSortedTokens(norm),
    mainTokens,
    initials,
    wordsSet
  };
}

async function runMatching() {
  console.log('====================================================');
  console.log('🔍 Pure Name Matcher (Registration from Matched Source)');
  console.log('   (Primary: temp_students | Fallback: placement_batch.csv)');
  console.log('====================================================\n');

  const dbPath = path.join(process.cwd(), 'placement.db');
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Error: placement.db not found at ${dbPath}`);
    process.exit(1);
  }

  const db = new Database(dbPath);

  // 1. Fetch temp_students profiles
  const tempRows = db.prepare(`
    SELECT regno, name, email, personal_email 
    FROM temp_students 
    WHERE name IS NOT NULL AND name != ''
  `).all() as {
    regno: string;
    name: string;
    email: string;
    personal_email: string | null;
  }[];

  const tempProfiles: StudentProfile[] = tempRows.map(r => 
    createProfile(r.regno, r.name, 'temp_students', r.email, r.personal_email || undefined)
  );
  console.log(`📦 Loaded ${tempProfiles.length} profiles from temp_students.`);

  // 2. Fetch placement_batch.csv profiles
  const pbProfiles: StudentProfile[] = [];
  const pbCsvPath = path.join(process.cwd(), 'csvs', 'placement_batch.csv');
  if (fs.existsSync(pbCsvPath)) {
    const pbContent = fs.readFileSync(pbCsvPath, 'utf-8');
    const pbParsed = Papa.parse<PlacementBatchRow>(pbContent, { header: true, skipEmptyLines: true });
    for (const r of pbParsed.data) {
      const regno = (r['REG NO'] || '').trim().toUpperCase();
      const name = (r['STUDENT NAME'] || '').trim();
      if (regno && name) {
        pbProfiles.push(createProfile(regno, name, 'placement_batch.csv'));
      }
    }
    console.log(`📋 Loaded ${pbProfiles.length} profiles from placement_batch.csv.`);
  }

  // Combine profiles (temp_students first, then placement_batch)
  const allProfiles = [...tempProfiles, ...pbProfiles];
  console.log(`⚡ Indexed ${allProfiles.length} total name candidates across both sources.\n`);

  // Build Fast Lookup Maps
  const exactTempMap = new Map<string, StudentProfile[]>();
  const exactPbMap = new Map<string, StudentProfile[]>();
  const sortedTempMap = new Map<string, StudentProfile[]>();
  const sortedPbMap = new Map<string, StudentProfile[]>();
  const compactTempMap = new Map<string, StudentProfile[]>();
  const compactPbMap = new Map<string, StudentProfile[]>();

  for (const p of tempProfiles) {
    if (!exactTempMap.has(p.normalized)) exactTempMap.set(p.normalized, []);
    exactTempMap.get(p.normalized)!.push(p);

    if (!sortedTempMap.has(p.sortedTokens)) sortedTempMap.set(p.sortedTokens, []);
    sortedTempMap.get(p.sortedTokens)!.push(p);

    if (!compactTempMap.has(p.compact)) compactTempMap.set(p.compact, []);
    compactTempMap.get(p.compact)!.push(p);
  }

  for (const p of pbProfiles) {
    if (!exactPbMap.has(p.normalized)) exactPbMap.set(p.normalized, []);
    exactPbMap.get(p.normalized)!.push(p);

    if (!sortedPbMap.has(p.sortedTokens)) sortedPbMap.set(p.sortedTokens, []);
    sortedPbMap.get(p.sortedTokens)!.push(p);

    if (!compactPbMap.has(p.compact)) compactPbMap.set(p.compact, []);
    compactPbMap.get(p.compact)!.push(p);
  }

  // 3. Read input CSV
  const csvPath = path.join(process.cwd(), 'csvs', 'name_neoid_map_chennai.csv');
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Error: ${csvPath} not found.`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const parsed = Papa.parse<CsvRow>(csvContent, {
    header: true,
    skipEmptyLines: true
  });

  console.log(`📄 Matching ${parsed.data.length} records from name_neoid_map_chennai.csv...\n`);

  const matches: MatchResult[] = [];
  const unmatched: UnmatchedRecord[] = [];

  let exactTempCount = 0;
  let exactPbCount = 0;
  let reorderTempCount = 0;
  let reorderPbCount = 0;
  let compactCount = 0;
  let initialCount = 0;
  let twoTokenExactCount = 0;
  let emailAliasCount = 0;

  for (let idx = 0; idx < parsed.data.length; idx++) {
    const row = parsed.data[idx];
    const rawName = (row['Full Name'] || row['name'] || Object.values(row)[0] || '').trim();
    const rawNeoId = (row['Neo ID'] || row['neoid'] || Object.values(row)[1] || '').trim().toUpperCase();

    if (!rawName) continue;

    const normInput = normalize(rawName);
    const compactInput = toCompact(rawName);
    const sortedInput = getSortedTokens(normInput);
    const { mainTokens: inputMainTokens, initials: inputInitials } = getTokens(normInput);

    let matched: StudentProfile | null = null;
    let matchType = 'exact';
    let matchPercentage = '100%';
    let matchReason = '';

    // =========================================================================
    // PASS 1: Exact Match in temp_students (100%)
    // =========================================================================
    if (!matched && exactTempMap.has(normInput)) {
      matched = exactTempMap.get(normInput)![0];
      matchType = 'exact';
      matchPercentage = '100%';
      matchReason = '100% exact match in temp_students';
      exactTempCount++;
    }

    // =========================================================================
    // PASS 2: Exact Match in placement_batch.csv (100%)
    // =========================================================================
    if (!matched && exactPbMap.has(normInput)) {
      matched = exactPbMap.get(normInput)![0];
      matchType = 'placement_batch_exact';
      matchPercentage = '100%';
      matchReason = '100% exact match in placement_batch.csv';
      exactPbCount++;
    }

    // =========================================================================
    // PASS 3: Token-Order Match in temp_students (99%)
    // =========================================================================
    if (!matched && sortedTempMap.has(sortedInput)) {
      matched = sortedTempMap.get(sortedInput)![0];
      matchType = 'token_reorder';
      matchPercentage = '99%';
      matchReason = 'All name words match in swapped order (temp_students)';
      reorderTempCount++;
    }

    // =========================================================================
    // PASS 4: Token-Order Match in placement_batch.csv (99%)
    // =========================================================================
    if (!matched && sortedPbMap.has(sortedInput)) {
      matched = sortedPbMap.get(sortedInput)![0];
      matchType = 'placement_batch_token_reorder';
      matchPercentage = '99%';
      matchReason = 'All name words match in swapped order (placement_batch.csv)';
      reorderPbCount++;
    }

    // =========================================================================
    // PASS 5: Compound Space Merge Match (99% - Full string without spaces, len >= 5)
    // =========================================================================
    if (!matched && compactInput.length >= 5) {
      if (compactTempMap.has(compactInput)) {
        matched = compactTempMap.get(compactInput)![0];
        matchType = 'compound_merge';
        matchPercentage = '99%';
        matchReason = 'Full name matches with spaces merged (temp_students)';
        compactCount++;
      } else if (compactPbMap.has(compactInput)) {
        matched = compactPbMap.get(compactInput)![0];
        matchType = 'placement_batch_compound_merge';
        matchPercentage = '99%';
        matchReason = 'Full name matches with spaces merged (placement_batch.csv)';
        compactCount++;
      }
    }

    // =========================================================================
    // PASS 6: Initials + Main Names Match (98% - ALL multi-letter words match + initials align)
    // =========================================================================
    if (!matched && inputMainTokens.length >= 1) {
      const mainStr = inputMainTokens.join(' ');
      
      // Try temp_students first
      const tempInitMatches = tempProfiles.filter(p => {
        return p.mainTokens.join(' ') === mainStr &&
          (inputInitials.length === 0 || p.initials.length === 0 ||
           inputInitials.every(init => p.initials.includes(init)) ||
           p.initials.every(init => inputInitials.includes(init)));
      });

      if (tempInitMatches.length === 1) {
        matched = tempInitMatches[0];
        matchType = 'initial_match';
        matchPercentage = '98%';
        matchReason = 'All main name words match with initials alignment (temp_students)';
        initialCount++;
      } else if (tempInitMatches.length === 0) {
        // Try placement_batch.csv
        const pbInitMatches = pbProfiles.filter(p => {
          return p.mainTokens.join(' ') === mainStr &&
            (inputInitials.length === 0 || p.initials.length === 0 ||
             inputInitials.every(init => p.initials.includes(init)) ||
             p.initials.every(init => inputInitials.includes(init)));
        });

        if (pbInitMatches.length === 1) {
          matched = pbInitMatches[0];
          matchType = 'placement_batch_initial_match';
          matchPercentage = '98%';
          matchReason = 'All main name words match with initials alignment (placement_batch.csv)';
          initialCount++;
        }
      }
    }

    // =========================================================================
    // PASS 7: Strict 2-Token Exact Subset Match (95% - MUST match >= 2 multi-letter words)
    // =========================================================================
    if (!matched && inputMainTokens.length >= 2) {
      // Check temp_students
      const temp2Token = tempProfiles.filter(p => countExactShared(inputMainTokens, p.wordsSet) >= 2);
      if (temp2Token.length === 1) {
        matched = temp2Token[0];
        matchType = 'two_token_exact_subset';
        matchPercentage = '95%';
        matchReason = `Matched >= 2 exact name words in temp_students (${matched.name})`;
        twoTokenExactCount++;
      } else if (temp2Token.length === 0) {
        // Check placement_batch
        const pb2Token = pbProfiles.filter(p => countExactShared(inputMainTokens, p.wordsSet) >= 2);
        if (pb2Token.length === 1) {
          matched = pb2Token[0];
          matchType = 'placement_batch_two_token_subset';
          matchPercentage = '95%';
          matchReason = `Matched >= 2 exact name words in placement_batch.csv (${matched.name})`;
          twoTokenExactCount++;
        }
      }
    }

    // =========================================================================
    // PASS 8: Strict Email Alias Match (92% - MUST match >= 2 multi-letter words)
    // =========================================================================
    if (!matched && inputMainTokens.length >= 2) {
      const emailMatches = tempProfiles.filter(p => {
        return p.emailAliases.some(alias => {
          const aliasToks = alias.split(' ').filter(t => t.length >= 2);
          return countExactShared(inputMainTokens, new Set(aliasToks)) >= 2;
        });
      });

      if (emailMatches.length === 1) {
        matched = emailMatches[0];
        matchType = 'email_alias_verified';
        matchPercentage = '92%';
        matchReason = `University email verified with >= 2 exact name words (${matched.email})`;
        emailAliasCount++;
      }
    }

    // =========================================================================
    // Record Match OR Send to Unmatched Review Queue
    // =========================================================================
    if (matched) {
      matches.push({
        registration_number: matched.regno, // Takes REG NO directly from the matched profile!
        neoid: rawNeoId,
        db_name: matched.name, // Takes name directly from the matched profile!
        csv_name: rawName,
        match_percentage: matchPercentage,
        match_type: matchType,
        matched_source: matched.source,
        reason: matchReason
      });
    } else {
      // Find top candidate for manual review
      let topScore = 0;
      let topCandidate: StudentProfile | null = null;
      for (const p of allProfiles) {
        const sc = jaroWinkler(normInput, p.normalized);
        if (sc > topScore) {
          topScore = sc;
          topCandidate = p;
        }
      }

      unmatched.push({
        csv_name: rawName,
        csv_neoid: rawNeoId,
        suggested_regno: topCandidate ? topCandidate.regno : '',
        suggested_name: topCandidate ? `${topCandidate.name} [${topCandidate.source}]` : '',
        confidence: topScore > 0 ? `${Math.round(topScore * 100)}%` : '',
        reason: topCandidate ? `Failed 2-token exact rule (similarity: ${(topScore * 100).toFixed(0)}%)` : 'No candidate found'
      });
    }
  }

  // 4. Export exclusively to csvs/reg_neo_name.csv
  const outputCsv = Papa.unparse(matches.map(m => ({
    registration_number: m.registration_number,
    neoid: m.neoid,
    db_name: m.db_name,
    csv_name: m.csv_name,
    match_percentage: m.match_percentage,
    match_type: m.match_type,
    matched_source: m.matched_source
  })), {
    columns: ['registration_number', 'neoid', 'db_name', 'csv_name', 'match_percentage', 'match_type', 'matched_source'],
    header: true
  });

  const csvsOutputPath = path.join(process.cwd(), 'csvs', 'reg_neo_name.csv');
  fs.writeFileSync(csvsOutputPath, outputCsv, 'utf-8');

  // 5. Export unmatched records exclusively to csvs/unmatched_review.csv
  const unmatchedCsv = Papa.unparse(unmatched, {
    columns: ['csv_name', 'csv_neoid', 'suggested_regno', 'suggested_name', 'confidence', 'reason'],
    header: true
  });

  const unmatchedPath = path.join(process.cwd(), 'csvs', 'unmatched_review.csv');
  fs.writeFileSync(unmatchedPath, unmatchedCsv, 'utf-8');

  // 6. Print comprehensive statistics
  const totalProcessed = parsed.data.length;
  const totalMatched = matches.length;
  const matchRate = ((totalMatched / totalProcessed) * 100).toFixed(2);

  console.log('====================================================');
  console.log('📊 PURE NAME MATCHING RESULTS (NO PRE-MAPPED SHORTCUTS)');
  console.log('====================================================');
  console.log(`Total Input CSV Rows:            ${totalProcessed}`);
  console.log(`Successfully Matched (Verified): ${totalMatched} (${matchRate}%)`);
  console.log(`  - Exact (temp_students):        ${exactTempCount}`);
  console.log(`  - Exact (placement_batch.csv):  ${exactPbCount}`);
  console.log(`  - Reorder (temp_students):      ${reorderTempCount}`);
  console.log(`  - Reorder (placement_batch.csv):${reorderPbCount}`);
  console.log(`  - Compound Space-Merges:        ${compactCount}`);
  console.log(`  - Initials & Main Names Match:  ${initialCount}`);
  console.log(`  - >=2 Exact Tokens Match:       ${twoTokenExactCount}`);
  console.log(`  - >=2 Exact Tokens Email Alias: ${emailAliasCount}`);
  console.log(`Unmatched (Sent to Review):       ${unmatched.length}`);
  console.log('====================================================');
  console.log(`📁 Files Updated:`);
  console.log(`  - ${csvsOutputPath}`);
  console.log(`  - ${unmatchedPath}`);
  console.log('====================================================\n');
}

runMatching().catch(err => {
  console.error('Fatal error during matching:', err);
  process.exit(1);
});
