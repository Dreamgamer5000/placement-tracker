import fs from 'fs';
import path from 'path';
import db from '../db/database.js';

interface ParsedCompany {
  name: string;
  category: string | null;
  role: string | null;
  ctc: string | null;
  stipend: string | null;
  job_location: string | null;
  website: string | null;
  eligible_branches: string | null;
  eligibility_criteria: string | null;
  total_rounds: number | null;
  rounds: number | null;
  experience_required: string | null;
  notes: string | null;
  round_details: string | null;
}

function normalizeName(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function parseCompanyDetailsMd(filePath: string): ParsedCompany[] {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const sections = fileContent.split(/^## \d+\.\s+/m).slice(1);

  const parsedCompanies: ParsedCompany[] = [];

  for (const sec of sections) {
    const lines = sec.split('\n');
    const sectionHeader = lines[0].trim();

    let name = sectionHeader;
    let category: string | null = null;
    let role: string | null = null;
    let ctc: string | null = null;
    let stipend: string | null = null;
    let job_location: string | null = null;
    let website: string | null = null;
    let eligible_branches: string | null = null;
    let eligibility_criteria: string | null = null;
    let total_rounds_str: string | null = null;
    let experience_required: string | null = null;
    let notes: string | null = null;
    let round_lines: string[] = [];

    let inRounds = false;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line === '---') continue;

      if (line.startsWith('- **') && line.includes('**:')) {
        inRounds = false;
        const colonIdx = line.indexOf('**:');
        const key = line.substring(4, colonIdx).trim();
        const val = line.substring(colonIdx + 3).trim();

        switch (key) {
          case 'COMPANY NAME':
            if (val) name = val;
            break;
          case 'CATEGORY':
            if (val) category = val;
            break;
          case 'JOB PROFILE / ROLE':
            if (val) role = val;
            break;
          case 'CTC PACKAGE':
            if (val) ctc = val;
            break;
          case 'STIPEND':
            if (val) stipend = val;
            break;
          case 'JOB LOCATION':
            if (val) job_location = val;
            break;
          case 'WEBSITE':
            if (val) website = val;
            break;
          case 'ELIGIBLE BRANCHES':
            if (val) eligible_branches = val;
            break;
          case 'ELIGIBILITY CRITERIA':
            if (val) eligibility_criteria = val;
            break;
          case 'TOTAL ROUNDS':
            if (val) total_rounds_str = val;
            break;
          case 'EXPERIENCE REQUIRED':
            if (val) experience_required = val;
            break;
          case 'GENERAL NOTES':
            if (val) notes = val;
            break;
          case 'ROUND-BY-ROUND DETAILS / INSTRUCTIONS':
            inRounds = true;
            if (val) round_lines.push(val);
            break;
        }
      } else if (inRounds && line.startsWith('- ')) {
        round_lines.push(line.substring(2).trim());
      } else if (inRounds && line.length > 0) {
        round_lines.push(line);
      }
    }

    let roundsNum: number | null = null;
    if (total_rounds_str) {
      const m = total_rounds_str.match(/(\d+)/);
      if (m) roundsNum = parseInt(m[1], 10);
    }

    const round_details = round_lines.length > 0 ? round_lines.join('\n') : null;

    parsedCompanies.push({
      name,
      category,
      role,
      ctc,
      stipend,
      job_location,
      website,
      eligible_branches,
      eligibility_criteria,
      total_rounds: roundsNum,
      rounds: roundsNum,
      experience_required,
      notes,
      round_details,
    });
  }

  return parsedCompanies;
}

export async function importOrUpdateCompanyDetails() {
  const docsPath = path.join(process.cwd(), 'docs', 'company_details.md');
  const rootPath = path.join(process.cwd(), 'company_details.md');
  const mdPath = fs.existsSync(docsPath) ? docsPath : rootPath;
  if (!fs.existsSync(mdPath)) {
    console.error(`File not found: ${mdPath}`);
    return;
  }

  const companiesFromMd = parseCompanyDetailsMd(mdPath);
  console.log(`Parsed ${companiesFromMd.length} companies from company_details.md`);

  const existingCompanies = db.prepare('SELECT * FROM companies').all() as any[];

  let updatedCount = 0;
  let insertedCount = 0;

  const updateStmt = db.prepare(`
    UPDATE companies SET
      category = COALESCE(?, category),
      role = COALESCE(?, role),
      ctc = COALESCE(?, ctc),
      stipend = COALESCE(?, stipend),
      job_location = COALESCE(?, job_location),
      website = COALESCE(?, website),
      eligible_branches = COALESCE(?, eligible_branches),
      eligibility_criteria = COALESCE(?, eligibility_criteria),
      total_rounds = COALESCE(?, total_rounds),
      rounds = COALESCE(?, rounds),
      experience_required = COALESCE(?, experience_required),
      notes = COALESCE(?, notes),
      round_details = COALESCE(?, round_details)
    WHERE id = ?
  `);

  const insertStmt = db.prepare(`
    INSERT INTO companies (
      name, category, role, ctc, stipend, job_location, website,
      eligible_branches, eligibility_criteria, total_rounds, rounds,
      experience_required, notes, round_details
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const checkAnalyticsStmt = db.prepare('SELECT id FROM company_analytics WHERE company_id = ?');
  const insertAnalyticsStmt = db.prepare('INSERT INTO company_analytics (company_id) VALUES (?)');

  for (const comp of companiesFromMd) {
    const normMd = normalizeName(comp.name);
    const existing = existingCompanies.find((c) => {
      const normDb = normalizeName(c.name);
      if (normDb === normMd) return true;
      if (normDb.length > 3 && normMd.length > 3 && (normDb.includes(normMd) || normMd.includes(normDb))) {
        return true;
      }
      return false;
    });

    if (existing) {
      // Existing company -> Update
      updateStmt.run(
        comp.category,
        comp.role,
        comp.ctc,
        comp.stipend,
        comp.job_location,
        comp.website,
        comp.eligible_branches,
        comp.eligibility_criteria,
        comp.total_rounds,
        comp.rounds,
        comp.experience_required,
        comp.notes,
        comp.round_details,
        existing.id
      );

      // Ensure analytics record exists
      const analytics = checkAnalyticsStmt.get(existing.id);
      if (!analytics) {
        insertAnalyticsStmt.run(existing.id);
      }

      console.log(`[UPDATED] ID ${existing.id}: "${existing.name}" (MD: "${comp.name}")`);
      updatedCount++;
    } else {
      // New company -> Insert
      const res = insertStmt.run(
        comp.name,
        comp.category,
        comp.role,
        comp.ctc,
        comp.stipend,
        comp.job_location,
        comp.website,
        comp.eligible_branches,
        comp.eligibility_criteria,
        comp.total_rounds,
        comp.rounds,
        comp.experience_required,
        comp.notes,
        comp.round_details
      );

      const newId = res.lastInsertRowid;
      insertAnalyticsStmt.run(newId);

      console.log(`[INSERTED] ID ${newId}: "${comp.name}"`);
      insertedCount++;
    }
  }

  console.log(`\nImport Summary: ${insertedCount} inserted, ${updatedCount} updated.`);
}

importOrUpdateCompanyDetails().catch(console.error);
