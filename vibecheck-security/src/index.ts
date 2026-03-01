import Fastify, { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import * as dotenv from 'dotenv';
import { RepoScanner } from './scanner/repo-auditor';
import { initDB } from './database';

dotenv.config();

/**
 * VIBECHECK SECURITY - CORE ENGINE V1.2 (Persistent Edition)
 */

let db: any;

const fastify: FastifyInstance = Fastify({ 
    logger: true,
    trustProxy: true 
});

// 1. HARDENING
fastify.register(helmet, { contentSecurityPolicy: false });
fastify.register(cors, { origin: "*" });
fastify.register(rateLimit, { max: 100, timeWindow: '1 minute' });

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
    const { prompt } = request.body as { prompt: string };
    if (!prompt) return reply.status(400).send({ error: "Empty prompt detected." });

    const threats = MALICIOUS_PATTERNS.filter(pattern => pattern.test(prompt));
    let score = 100 - (threats.length * 25);
    if (score < 0) score = 0;
    const isSafe = score >= 75;

    await db.run(
        'INSERT INTO shield_logs (prompt_hash, score, risk_level, matched_heuristics, blocked) VALUES (?, ?, ?, ?, ?)',
        ["sha256_mock", score, isSafe ? "LOW" : "CRITICAL", JSON.stringify(threats.map(t => t.source)), !isSafe]
    );

    return { timestamp: new Date().toISOString(), score, status: isSafe ? "CLEAN" : "BLOCKED" };
});

// REPO AUDIT
fastify.post('/v1/scanner/audit', async (request, reply) => {
    const { repoPath } = request.body as { repoPath: string };
    if (!repoPath) return reply.status(400).send({ error: "Target repository path required." });

    const scanner = new RepoScanner();
    try {
        const issues = await scanner.scanDirectory(repoPath);
        const criticalCount = issues.filter(i => i.severity === 'CRITICAL').length;

        await db.run(
            'INSERT INTO audit_reports (target, issues_found, critical_level, full_report) VALUES (?, ?, ?, ?)',
            [repoPath, issues.length, criticalCount > 0, JSON.stringify(issues)]
        );

        return { timestamp: new Date().toISOString(), status: "AUDIT_COMPLETED", target: repoPath, issuesFound: issues.length, issues };
    } catch (error) {
        return reply.status(500).send({ error: "Failed to scan." });
    }
});

// 5. HISTORY ENDPOINT
fastify.get('/v1/scanner/history', async () => {
    return await db.all('SELECT * FROM audit_reports ORDER BY created_at DESC LIMIT 20');
});

fastify.get('/v1/shield/logs', async () => {
    return await db.all('SELECT * FROM shield_logs ORDER BY created_at DESC LIMIT 20');
});

fastify.get('/health', async () => {
    return { status: 'FULLY_OPERATIONAL', db: !!db };
});

const start = async () => {
    try {
        db = await initDB();
        const port = Number(process.env.CORE_PORT) || 8080;
        await fastify.listen({ port, host: '0.0.0.0' });
        console.log(`[VIBE_SECURITY] Heartbeat established at port ${port}`);
    } catch (err) {
        process.exit(1);
    }
};

start();
