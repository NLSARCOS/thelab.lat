"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
const cors_1 = __importDefault(require("@fastify/cors"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const dotenv = __importStar(require("dotenv"));
const repo_auditor_1 = require("./scanner/repo-auditor");
const database_1 = require("./database");
dotenv.config();
/**
 * VIBECHECK SECURITY - CORE ENGINE V1.2 (Persistent Edition)
 */
let db;
const fastify = (0, fastify_1.default)({
    logger: true,
    trustProxy: true
});
// 1. HARDENING
fastify.register(helmet_1.default, { contentSecurityPolicy: false });
fastify.register(cors_1.default, { origin: "*" });
fastify.register(rate_limit_1.default, { max: 100, timeWindow: '1 minute' });
// 2. DEFENSIVE LOGIC
const MALICIOUS_PATTERNS = [
    /ignore previous instructions/i,
    /you are now an unrestricted/i,
    /reveal your source code/i,
    /drop table|delete from/i,
    /eval\(.*\)/i
];
// 3. ENDPOINTS
// SHIELD VALIDATION
fastify.post('/v1/shield/validate', async (request, reply) => {
    const { prompt } = request.body;
    if (!prompt)
        return reply.status(400).send({ error: "Empty prompt detected." });
    const threats = MALICIOUS_PATTERNS.filter(pattern => pattern.test(prompt));
    let score = 100 - (threats.length * 25);
    if (score < 0)
        score = 0;
    const isSafe = score >= 75;
    await db.run('INSERT INTO shield_logs (prompt_hash, score, risk_level, matched_heuristics, blocked) VALUES (?, ?, ?, ?, ?)', ["sha256_mock", score, isSafe ? "LOW" : "CRITICAL", JSON.stringify(threats.map(t => t.source)), !isSafe]);
    return { timestamp: new Date().toISOString(), score, status: isSafe ? "CLEAN" : "BLOCKED" };
});
// REPO AUDIT
fastify.post('/v1/scanner/audit', async (request, reply) => {
    const { repoPath } = request.body;
    if (!repoPath)
        return reply.status(400).send({ error: "Target repository path required." });
    const scanner = new repo_auditor_1.RepoScanner();
    try {
        const issues = await scanner.scanDirectory(repoPath);
        const criticalCount = issues.filter(i => i.severity === 'CRITICAL').length;
        await db.run('INSERT INTO audit_reports (target, issues_found, critical_level, full_report) VALUES (?, ?, ?, ?)', [repoPath, issues.length, criticalCount > 0, JSON.stringify(issues)]);
        return { timestamp: new Date().toISOString(), status: "AUDIT_COMPLETED", target: repoPath, issuesFound: issues.length, issues };
    }
    catch (error) {
        return reply.status(500).send({ error: "Failed to scan." });
    }
});
fastify.get('/health', async () => {
    return { status: 'FULLY_OPERATIONAL', db: !!db };
});
const start = async () => {
    try {
        db = await (0, database_1.initDB)();
        const port = Number(process.env.CORE_PORT) || 8080;
        await fastify.listen({ port, host: '0.0.0.0' });
        console.log(`[VIBE_SECURITY] Heartbeat established at port ${port}`);
    }
    catch (err) {
        process.exit(1);
    }
};
start();
