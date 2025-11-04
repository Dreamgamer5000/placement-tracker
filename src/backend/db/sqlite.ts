// import Database from "better-sqlite3";
// import { join } from 'path';
// import { DB } from "./types";

// class SQLite implements DB {

//     private db!: Database.Database;

//     async connect(): Promise<void> {
//         this.db = new Database(join(process.cwd(), 'placement.db'))
//         return Promise.resolve()
//     }

//     async query(sql: string, ...params: any[]): Promise<any> {
//         return Promise.resolve(this.db.prepare(sql).all(...params))
//     }

//     async execute(sql: string, ...params: any[]): Promise<any> {
//         return Promise.resolve(this.db.prepare(sql).run(...params))
//     }
// }