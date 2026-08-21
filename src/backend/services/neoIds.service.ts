import db from '../db/database.js';

export interface ResolvedTokenResult {
  success: boolean;
  regno?: string | null;
  neo_id?: string | null;
  token: string;
  studentName?: string;
  foundIn?: string;
  error?: string;
}

export class NeoIdsService {
  static getAll() {
    return db.prepare('SELECT * FROM temp_neoid_table ORDER BY neoid').all();
  }

  static search(neoidParam: string) {
    const neoid = neoidParam.trim().toUpperCase();

    const record = db.prepare(
      `SELECT * FROM temp_neoid_table WHERE UPPER(neoid) = ?`
    ).get(neoid) as { neoid: string; campus: string; regno: string | null; topcoder: number } | undefined;

    if (!record) {
      return { found: false, neoid };
    }

    // Try to find the student name from temp_students if regno is available
    let studentName: string | null = null;
    if (record.regno) {
      const student = db.prepare(
        `SELECT name FROM temp_students WHERE UPPER(regno) = ?`
      ).get(record.regno.toUpperCase()) as { name: string } | undefined;
      if (student) studentName = student.name;
    }

    return {
      found: true,
      neoid: record.neoid,
      campus: record.campus,
      regno: record.regno,
      topcoder: !!record.topcoder,
      studentName
    };
  }

  static batchLookup(neoids: string[]) {
    const uniqueNeoids = [...new Set(neoids.map((n: string) => n.trim().toUpperCase()).filter(Boolean))];
    const results = [];

    const stmt = db.prepare(`
      SELECT n.*, s.name as studentName 
      FROM temp_neoid_table n 
      LEFT JOIN temp_students s ON UPPER(n.regno) = UPPER(s.regno) 
      WHERE UPPER(n.neoid) = ?
    `);

    for (const id of uniqueNeoids) {
      const record = stmt.get(id) as {
        neoid: string;
        campus: string;
        regno: string | null;
        topcoder: number;
        studentName: string | null;
      } | undefined;

      if (record) {
        results.push({
          found: true,
          neoid: record.neoid,
          campus: record.campus,
          regno: record.regno,
          topcoder: !!record.topcoder,
          studentName: record.studentName
        });
      } else {
        results.push({
          found: false,
          neoid: id
        });
      }
    }

    return results;
  }

  static batchMapRegno(mappings: { neoid: string; regno: string }[]) {
    const upsertNeoStmt = db.prepare(`
      INSERT INTO temp_neoid_table (neoid, campus, regno)
      VALUES (?, 'Unknown', ?)
      ON CONFLICT(neoid) DO UPDATE SET regno = excluded.regno
    `);

    const updateStudentStmt = db.prepare(`
      UPDATE temp_students SET neo_id = ? WHERE UPPER(regno) = ?
    `);

    const batchUpdate = db.transaction((items: { neoid: string; regno: string }[]) => {
      let neoCount = 0;
      let studentCount = 0;
      for (const item of items) {
        const neoid = item.neoid.trim().toUpperCase();
        const regno = item.regno.trim().toUpperCase();
        if (!neoid || !regno) continue;

        upsertNeoStmt.run(neoid, regno);
        neoCount++;

        const res = updateStudentStmt.run(neoid, regno);
        if (res.changes > 0) studentCount++;
      }
      return { neoCount, studentCount };
    });

    return batchUpdate(mappings);
  }

  static batchSetCampus(neoids: string[], campus: string) {
    const upsertStmt = db.prepare(`
      INSERT INTO temp_neoid_table (neoid, campus)
      VALUES (?, ?)
      ON CONFLICT(neoid) DO UPDATE SET campus = excluded.campus
    `);

    const batchSet = db.transaction((ids: string[], campusVal: string) => {
      let count = 0;
      for (const id of ids) {
        const neoid = id.trim().toUpperCase();
        if (!neoid) continue;
        upsertStmt.run(neoid, campusVal);
        count++;
      }
      return count;
    });

    return batchSet(neoids, campus);
  }

  static resolveTempToken(token: string): ResolvedTokenResult {
    const clean = token.trim();
    if (!clean) {
      return { success: false, token, error: 'Empty identifier.' };
    }
    const upper = clean.toUpperCase();

    // 1. Direct match on temp_students (by regno or neo_id)
    let student = db.prepare(`
      SELECT regno, neo_id, name, branch, campus, placed, status, final_company_id
      FROM temp_students
      WHERE regno = ? COLLATE NOCASE OR neo_id = ? COLLATE NOCASE
    `).get(upper, upper) as any;

    if (student) {
      let neo_id = student.neo_id || null;
      if (!neo_id) {
        const neoRec = db.prepare('SELECT neoid FROM temp_neoid_table WHERE regno = ? COLLATE NOCASE').get(student.regno.toUpperCase()) as any;
        if (neoRec) neo_id = neoRec.neoid;
      }
      return {
        success: true,
        regno: student.regno,
        neo_id: neo_id,
        token: upper,
        studentName: student.name,
        foundIn: 'temp_students'
      };
    }

    // 2. Direct match on temp_neoid_table (by neoid or regno)
    const neoRecord = db.prepare(`
      SELECT neoid, regno, campus
      FROM temp_neoid_table
      WHERE neoid = ? COLLATE NOCASE OR regno = ? COLLATE NOCASE
    `).get(upper, upper) as any;

    if (neoRecord) {
      let regno = neoRecord.regno || null;
      if (regno) {
        const validStudent = db.prepare('SELECT regno FROM temp_students WHERE regno = ? COLLATE NOCASE').get(regno.toUpperCase());
        if (!validStudent) regno = null;
      } else {
        const studentRec = db.prepare('SELECT regno FROM temp_students WHERE neo_id = ? COLLATE NOCASE').get(neoRecord.neoid.toUpperCase()) as any;
        if (studentRec) regno = studentRec.regno;
      }
      return {
        success: true,
        regno: regno,
        neo_id: neoRecord.neoid,
        token: upper,
        foundIn: 'temp_neoid_table'
      };
    }

    // 3. Auto-insert unmatched NeoID into temp_neoid_table with campus = 'Unknown'
    if (/^[A-Z0-9_-]{4,25}$/i.test(upper)) {
      try {
        db.prepare(`
          INSERT INTO temp_neoid_table (neoid, campus)
          VALUES (?, 'Unknown')
          ON CONFLICT(neoid) DO NOTHING
        `).run(upper);

        return {
          success: true,
          regno: null,
          neo_id: upper,
          token: upper,
          foundIn: 'auto_registered_neoid'
        };
      } catch (_) {
        // Fallthrough to error response below if insert fails
      }
    }

    // 4. Not found in temp_students or temp_neoid_table -> Error
    return {
      success: false,
      token: upper,
      error: `Identifier '${upper}' not found in database (temp_students or temp_neoid_table).`
    };
  }
}
