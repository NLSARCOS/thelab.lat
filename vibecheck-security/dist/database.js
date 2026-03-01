"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDB = initDB;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
/**
 * VIBECHECK SECURITY - DATABASE CORE
 */
async function initDB() {
    const db = await (0, sqlite_1.open)({
        filename: './data/vibecheck_security.db',
        driver: sqlite3_1.default.Database
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
