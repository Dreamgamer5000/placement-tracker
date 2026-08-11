import Database from 'better-sqlite3';
import { join } from 'path';
import z from 'zod';

const Student = z.object({
  id: z.number().optional(),
  regno: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  personal_email: z.string().optional(),
  gender: z.string().optional(),
  cgpa: z.number().optional(),
  tenth_marks: z.number().optional(),
  twelfth_marks: z.number().optional(),
  resume_link: z.string().optional(),
  branch: z.string(),
  campus: z.string(),
  neo_id: z.string().optional(),
  placed: z.boolean(),
  masters: z.boolean().optional(),
  status: z.enum(['placed', 'intern', 'masters', 'not_placed']).default('not_placed'),
  topcoder: z.boolean().optional(),
  final_company_id: z.number().optional()
})

type Student = z.infer<typeof Student>

export interface NeoIdRecord {
  id?: number;
  neo_id: string;
  campus: string;
  student_id?: number;
  regno?: string;
  topcoder?: boolean;
}

export interface Company {
  id?: number;
  name: string;
  notes?: string;
  rounds?: number;
  ctc?: string;
  total_rounds?: number;
  round_details?: string;
  experience_required?: string;
}

export interface CompanyAnalytics {
  id?: number;
  company_id: number;
  // Shortlist analytics
  min_cgpa_shortlist?: number;
  avg_cgpa_shortlist?: number;
  min_tenth_shortlist?: number;
  avg_tenth_shortlist?: number;
  min_twelfth_shortlist?: number;
  avg_twelfth_shortlist?: number;
  total_shortlisted: number;
  male_count_shortlist: number;
  female_count_shortlist: number;
  gender_ratio_shortlist?: string;
  // Selection analytics
  min_cgpa_selected?: number;
  avg_cgpa_selected?: number;
  min_tenth_selected?: number;
  avg_tenth_selected?: number;
  min_twelfth_selected?: number;
  avg_twelfth_selected?: number;
  total_selected: number;
  male_count_selected: number;
  female_count_selected: number;
  gender_ratio_selected?: string;
  selection_ratio?: number;
}

export interface Shortlist {
  id?: number;
  student_id: number;
  company_id: number;
  round_number?: number;
  round_name?: string;
  shortlisted_at: string;
}

export interface Selection {
  id?: number;
  student_id: number;
  company_id: number;
  selected_at: string;
}

const db = new Database(join(process.cwd(), 'placement.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

export function initDatabase() {
  // Students table
  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      regno TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      personal_email TEXT,
      gender TEXT,
      cgpa REAL,
      tenth_marks REAL,
      twelfth_marks REAL,
      resume_link TEXT,
      branch TEXT NOT NULL,
      campus TEXT NOT NULL,
      neo_id TEXT,
      placed BOOLEAN DEFAULT 0,
      masters BOOLEAN DEFAULT 0,
      status TEXT DEFAULT 'not_placed',
      topcoder BOOLEAN DEFAULT 0,
      final_company_id INTEGER,
      FOREIGN KEY (final_company_id) REFERENCES companies(id)
    )
  `);

  // Neo IDs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS neo_ids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      neo_id TEXT UNIQUE NOT NULL,
      campus TEXT NOT NULL DEFAULT 'Unknown',
      student_id INTEGER,
      regno TEXT,
      topcoder BOOLEAN DEFAULT 0,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
    )
  `);

  // Companies table
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      notes TEXT,
      rounds INTEGER,
      ctc TEXT,
      total_rounds INTEGER,
      round_details TEXT,
      experience_required TEXT,
      role TEXT,
      category TEXT,
      stipend TEXT,
      job_location TEXT,
      eligible_branches TEXT,
      eligibility_criteria TEXT,
      website TEXT
    )
  `);

  // Ensure new columns exist on companies table if database was created earlier
  const companyCols = (db.pragma('table_info(companies)') as { name: string }[]).map(c => c.name);
  const newCols: [string, string][] = [
    ['role', 'TEXT'],
    ['category', 'TEXT'],
    ['stipend', 'TEXT'],
    ['job_location', 'TEXT'],
    ['eligible_branches', 'TEXT'],
    ['eligibility_criteria', 'TEXT'],
    ['website', 'TEXT']
  ];
  for (const [colName, colType] of newCols) {
    if (!companyCols.includes(colName)) {
      db.exec(`ALTER TABLE companies ADD COLUMN ${colName} ${colType}`);
    }
  }

  // Shortlists table (many-to-many relationship supporting multi-round shortlists)
  db.exec(`
    CREATE TABLE IF NOT EXISTS shortlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      company_id INTEGER NOT NULL,
      round_number INTEGER NOT NULL DEFAULT 1,
      round_name TEXT NOT NULL DEFAULT 'Shortlist 1',
      shortlisted_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      UNIQUE(student_id, company_id, round_number)
    )
  `);

  // Selections table (many-to-many relationship for final selections)
  db.exec(`
    CREATE TABLE IF NOT EXISTS selections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      company_id INTEGER NOT NULL,
      selected_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      UNIQUE(student_id, company_id)
    )
  `);

  // Company analytics table
  db.exec(`
    CREATE TABLE IF NOT EXISTS company_analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER UNIQUE NOT NULL,
      min_cgpa_shortlist REAL,
      avg_cgpa_shortlist REAL,
      min_tenth_shortlist REAL,
      avg_tenth_shortlist REAL,
      min_twelfth_shortlist REAL,
      avg_twelfth_shortlist REAL,
      total_shortlisted INTEGER DEFAULT 0,
      male_count_shortlist INTEGER DEFAULT 0,
      female_count_shortlist INTEGER DEFAULT 0,
      gender_ratio_shortlist TEXT,
      min_cgpa_selected REAL,
      avg_cgpa_selected REAL,
      min_tenth_selected REAL,
      avg_tenth_selected REAL,
      min_twelfth_selected REAL,
      avg_twelfth_selected REAL,
      total_selected INTEGER DEFAULT 0,
      male_count_selected INTEGER DEFAULT 0,
      female_count_selected INTEGER DEFAULT 0,
      gender_ratio_selected TEXT,
      selection_ratio REAL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    )
  `);

  // Temp interns selected table
  db.exec(`
    CREATE TABLE IF NOT EXISTS temp_students (
      regno TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      personal_email TEXT,
      gender TEXT,
      cgpa REAL,
      tenth_marks REAL,
      twelfth_marks REAL,
      resume_link TEXT,
      branch TEXT NOT NULL,
      campus TEXT NOT NULL,
      placed BOOLEAN DEFAULT 0,
      final_company_id INTEGER,
      neo_id TEXT,
      dob TEXT,
      masters BOOLEAN DEFAULT 0,
      status TEXT DEFAULT 'not_placed',
      topcoder BOOLEAN DEFAULT 0
    )
  `);

  // Ensure dob column exists in temp_students if DB was created earlier
  const tempStudentCols = (db.pragma('table_info(temp_students)') as { name: string }[]).map(c => c.name);
  if (!tempStudentCols.includes('dob')) {
    db.exec(`ALTER TABLE temp_students ADD COLUMN dob TEXT`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS temp_neoid_table (
      neoid TEXT PRIMARY KEY NOT NULL,
      campus TEXT DEFAULT 'Unknown',
      regno TEXT NULL,
      topcoder INTEGER DEFAULT 0
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS temp_shortlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      regno TEXT NULL,
      neo_id TEXT NULL,
      company_id INTEGER NOT NULL,
      round_number INTEGER DEFAULT 1,
      round_name TEXT DEFAULT 'Shortlist 1',
      shortlisted_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS temp_interns_selected (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      regno TEXT,
      neo_id TEXT,
      company_id INTEGER NOT NULL,
      selected_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(regno, company_id),
      UNIQUE(neo_id, company_id),
      FOREIGN KEY (company_id) REFERENCES companies(id)
    )
  `);

  // Temp final selection table
  db.exec(`
    CREATE TABLE IF NOT EXISTS temp_final_selection (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      regno TEXT,
      neo_id TEXT,
      company_id INTEGER NOT NULL,
      selected_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(regno, company_id),
      UNIQUE(neo_id, company_id),
      FOREIGN KEY (company_id) REFERENCES companies(id)
    )
  `);

  // Performance Indexes for instant shortlist/selection queries (400x speedup)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_temp_shortlists_company ON temp_shortlists(company_id);
    CREATE INDEX IF NOT EXISTS idx_temp_shortlists_regno ON temp_shortlists(regno);
    CREATE INDEX IF NOT EXISTS idx_temp_shortlists_neoid ON temp_shortlists(neo_id);
    CREATE INDEX IF NOT EXISTS idx_temp_interns_company ON temp_interns_selected(company_id);
    CREATE INDEX IF NOT EXISTS idx_temp_interns_regno ON temp_interns_selected(regno);
    CREATE INDEX IF NOT EXISTS idx_temp_interns_neoid ON temp_interns_selected(neo_id);
    CREATE INDEX IF NOT EXISTS idx_temp_finals_company ON temp_final_selection(company_id);
    CREATE INDEX IF NOT EXISTS idx_temp_finals_regno ON temp_final_selection(regno);
    CREATE INDEX IF NOT EXISTS idx_temp_finals_neoid ON temp_final_selection(neo_id);
    CREATE INDEX IF NOT EXISTS idx_temp_students_regno ON temp_students(regno);
    CREATE INDEX IF NOT EXISTS idx_temp_students_neoid ON temp_students(neo_id);
    CREATE INDEX IF NOT EXISTS idx_temp_neoid_neoid ON temp_neoid_table(neoid);
    CREATE INDEX IF NOT EXISTS idx_temp_neoid_regno ON temp_neoid_table(regno);

    -- Case-insensitive (NOCASE) indexes for instant O(log N) lookups without full table scans
    CREATE INDEX IF NOT EXISTS idx_temp_students_regno_nocase ON temp_students (regno COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_temp_students_neoid_nocase ON temp_students (neo_id COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_temp_neoid_neoid_nocase ON temp_neoid_table (neoid COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_temp_neoid_regno_nocase ON temp_neoid_table (regno COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_temp_shortlists_regno_nocase ON temp_shortlists (regno COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_temp_shortlists_neoid_nocase ON temp_shortlists (neo_id COLLATE NOCASE);
  `);

  console.log('Database initialized successfully');
}

export function getDb() {
  return db;
}

export default db;
