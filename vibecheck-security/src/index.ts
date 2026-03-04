import Fastify, { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import * as dotenv from 'dotenv';
import { RepoScanner } from './scanner/repo-auditor';
import { initDB } from './database';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

dotenv.config();

let db: any;

const fastify: FastifyInstance = Fastify({ 
    logger: true,
    trustProxy: true 
});

fastify.register(helmet, { contentSecurityPolicy: false });
fastify.register(cors, { origin: "*" });
fastify.register(rateLimit, { max: 100, timeWindow: '1 minute' });

// Malicious prompt patterns for Shield
const MALICIOUS_PATTERNS = [
    /ignore previous instructions/i,
    /you are now an unrestricted/i,
    /reveal your source code/i,
    /drop table|delete from/i,
    /eval\(.*\)/i,
    /disregard all prior/i,
    /bypass.*safety/i,
    /act as.*DAN/i,
    /jailbreak/i,
    /forget.*rules/i,
    /system prompt/i,
    /output your instructions/i
];

// ─── SHIELD VALIDATION ────────────────────────────────────
fastify.post('/v1/shield/validate', async (request, reply) => {
    const { prompt } = request.body as { prompt: string };
    if (!prompt) return reply.status(400).send({ error: "Empty prompt detected." });

    const threats = MALICIOUS_PATTERNS.filter(pattern => pattern.test(prompt));
    let score = 100 - (threats.length * 20);
    if (score < 0) score = 0;
    const isSafe = score >= 60;

    await db.run(
        'INSERT INTO shield_logs (prompt_hash, score, risk_level, matched_heuristics, blocked) VALUES (?, ?, ?, ?, ?)',
        ["sha256_" + Date.now(), score, isSafe ? "LOW" : "CRITICAL", JSON.stringify(threats.map(t => t.source)), !isSafe]
    );

    return { 
        timestamp: new Date().toISOString(), 
        riskScore: score, 
        blocked: !isSafe,
        status: isSafe ? "CLEAN" : "BLOCKED",
        matchedRule: threats.length > 0 ? threats[0].source : null,
        threatsDetected: threats.length
    };
});

// ─── REPO AUDIT (supports both local paths and GitHub URLs) ─
fastify.post('/v1/scanner/audit', async (request, reply) => {
    const body = request.body as { repoPath?: string; repoUrl?: string };
    const target = body.repoUrl || body.repoPath;
    
    if (!target) return reply.status(400).send({ error: "Target repository path or URL required." });

    const scanner = new RepoScanner();
    let scanPath = target;
    let tempDir: string | null = null;

    try {
        // If it's a URL, clone it first
        if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('git@')) {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibecheck-'));
            console.log(`[VibeCheck] Cloning ${target} to ${tempDir}`);
            
            try {
                execSync(`git clone --depth 1 --single-branch "${target}" "${tempDir}/repo"`, {
                    timeout: 60000,
                    stdio: 'pipe'
                });
                scanPath = path.join(tempDir, 'repo');
            } catch (cloneError: any) {
                // If clone fails, try adding .git
                const gitUrl = target.endsWith('.git') ? target : target + '.git';
                try {
                    execSync(`git clone --depth 1 --single-branch "${gitUrl}" "${tempDir}/repo"`, {
                        timeout: 60000,
                        stdio: 'pipe'
                    });
                    scanPath = path.join(tempDir, 'repo');
                } catch {
                    return reply.status(400).send({ 
                        error: "Failed to clone repository. Make sure it's a valid public repository URL.",
                        details: cloneError.message?.substring(0, 200) 
                    });
                }
            }
        }

        const result = await scanner.scanDirectory(scanPath);
        const { issues } = result;
        const criticalCount = result.summary.critical;
        const highCount = result.summary.high;

        await db.run(
            'INSERT INTO audit_reports (target, issues_found, critical_level, full_report) VALUES (?, ?, ?, ?)',
            [target, issues.length, criticalCount > 0, JSON.stringify(result)]
        );

        return { 
            timestamp: new Date().toISOString(), 
            status: "AUDIT_COMPLETED", 
            target,
            securityScore: result.score,
            grade: result.grade,
            totalIssues: issues.length,
            criticalIssues: criticalCount,
            highIssues: highCount,
            summary: result.summary,
            categories: result.categories,
            filesScanned: result.filesScanned,
            topRisks: result.topRisks,
            verdict: result.verdict,
            issues
        };
    } catch (error: any) {
        console.error('[VibeCheck] Scan error:', error.message);
        return reply.status(500).send({ error: "Failed to scan repository.", details: error.message?.substring(0, 200) });
    } finally {
        // Cleanup temp directory
        if (tempDir) {
            try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
        }
    }
});

// ─── HISTORY ──────────────────────────────────────────────
fastify.get('/v1/scanner/history', async () => {
    return await db.all('SELECT * FROM audit_reports ORDER BY created_at DESC LIMIT 20');
});

fastify.get('/v1/shield/logs', async () => {
    return await db.all('SELECT * FROM shield_logs ORDER BY created_at DESC LIMIT 20');
});

fastify.get('/health', async () => {
    return { status: 'FULLY_OPERATIONAL', version: '1.3.0', db: !!db };
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
