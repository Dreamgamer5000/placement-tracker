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
  placed: z.boolean(),
  final_company_id: z.number().optional()
})

type Student = z.infer<typeof Student>

export interface Company {
  id?: number;
  name: string;
  notes?: string;
  rounds?: number;
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
      placed BOOLEAN DEFAULT 0,
      final_company_id INTEGER,
      FOREIGN KEY (final_company_id) REFERENCES companies(id)
    )
  `);

  // Companies table
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      notes TEXT,
      rounds INTEGER,
      experience_required TEXT
    )
  `);

  // Shortlists table (many-to-many relationship)
  db.exec(`
    CREATE TABLE IF NOT EXISTS shortlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      company_id INTEGER NOT NULL,
      shortlisted_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      UNIQUE(student_id, company_id)
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

  console.log('Database initialized successfully');
}

export function getDb() {
  return db;
}

export default db;
