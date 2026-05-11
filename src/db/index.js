import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import config from '../config.js';
import schema from './schema.js';

let db;

export function getDb() {
  if (!db) {
    const dbPath = config.database.path;
    const dbDir = dirname(dbPath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema();
  }
  return db;
}

function initializeSchema() {
  const statements = schema.split(';').filter(s => s.trim().length > 0);
  for (const stmt of statements) {
    try {
      db.exec(stmt.trim() + ';');
    } catch (err) {
      console.error(`Schema error: ${err.message}`);
    }
  }
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
