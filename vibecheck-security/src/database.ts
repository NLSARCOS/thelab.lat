import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

/**
 * VIBECHECK SECURITY - DATABASE CORE
 */

export async function initDB(): Promise<Database> {
    const db = await open({
        filename: './data/vibecheck_security.db',
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS audit_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target TEXT NOT NULL,
            issues_found INTEGER,
            critical_level BOOLEAN,
            full_report JSON,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS shield_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prompt_hash TEXT,
            score INTEGER,
            risk_level TEXT,
            matched_heuristics JSON,
            blocked BOOLEAN,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    return db;
}
