import db from '../db/database.js';
import type { RoleRecord } from '../models/types.js';

export class RolesService {
  static ensureRolesTableReady(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL COLLATE NOCASE,
        category TEXT DEFAULT 'Engineering',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  static ensureRoleExists(roleName?: string | null, category: string = 'Engineering'): string | null {
    if (!roleName || !roleName.trim()) return null;
    const clean = roleName.trim();
    this.ensureRolesTableReady();
    db.prepare('INSERT OR IGNORE INTO roles (name, category) VALUES (?, ?)').run(clean, category);
    return clean;
  }

  static getRoles(): RoleRecord[] {
    this.ensureRolesTableReady();
    return db.prepare('SELECT * FROM roles ORDER BY category ASC, name ASC').all() as RoleRecord[];
  }

  static createRole(name: string, category: string = 'Engineering'): RoleRecord {
    this.ensureRolesTableReady();
    const cleanName = name.trim();
    const cleanCat = category.trim() || 'Engineering';
    db.prepare('INSERT OR IGNORE INTO roles (name, category) VALUES (?, ?)').run(cleanName, cleanCat);
    return db.prepare('SELECT * FROM roles WHERE name = ? COLLATE NOCASE').get(cleanName) as RoleRecord;
  }
}
