import { initDatabase } from '../db/index.js';
import db from '../db/index.js';

// Drop and recreate company_analytics table to apply new schema
console.log('Migrating company_analytics table...');
db.exec('DROP TABLE IF EXISTS company_analytics');

initDatabase();
console.log('Database setup complete!');
