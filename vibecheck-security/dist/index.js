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
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
dotenv.config();
let db;
const fastify = (0, fastify_1.default)({
    logger: true,
    trustProxy: true
});
fastify.register(helmet_1.default, { contentSecurityPolicy: false });
fastify.register(cors_1.default, { origin: "*" });
fastify.register(rate_limit_1.default, { max: 100, timeWindow: '1 minute' });
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
    const { prompt } = request.body;
    if (!prompt)
        return reply.status(400).send({ error: "Empty prompt detected." });
    const threats = MALICIOUS_PATTERNS.filter(pattern => pattern.test(prompt));
    let score = 100 - (threats.length * 20);
    if (score < 0)
        score = 0;
    const isSafe = score >= 60;
    await db.run('INSERT INTO shield_logs (prompt_hash, score, risk_level, matched_heuristics, blocked) VALUES (?, ?, ?, ?, ?)', ["sha256_" + Date.now(), score, isSafe ? "LOW" : "CRITICAL", JSON.stringify(threats.map(t => t.source)), !isSafe]);
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
    const body = request.body;
    const target = body.repoUrl || body.repoPath;
    if (!target)
        return reply.status(400).send({ error: "Target repository path or URL required." });
    const scanner = new repo_auditor_1.RepoScanner();
    let scanPath = target;
    let tempDir = null;
    try {
        // If it's a URL, clone it first
        if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('git@')) {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibecheck-'));
            console.log(`[VibeCheck] Cloning ${target} to ${tempDir}`);
            try {
                (0, child_process_1.execSync)(`git clone --depth 1 --single-branch "${target}" "${tempDir}/repo"`, {
                    timeout: 60000,
                    stdio: 'pipe'
                });
                scanPath = path.join(tempDir, 'repo');
            }
            catch (cloneError) {
                // If clone fails, try adding .git
                const gitUrl = target.endsWith('.git') ? target : target + '.git';
                try {
                    (0, child_process_1.execSync)(`git clone --depth 1 --single-branch "${gitUrl}" "${tempDir}/repo"`, {
                        timeout: 60000,
                        stdio: 'pipe'
                    });
                    scanPath = path.join(tempDir, 'repo');
                }
                catch {
                    return reply.status(400).send({
                        error: "Failed to clone repository. Make sure it's a valid public repository URL.",
                        details: cloneError.message?.substring(0, 200)
                    });
                }
            }
        }
        const issues = await scanner.scanDirectory(scanPath);
        const criticalCount = issues.filter(i => i.severity === 'CRITICAL').length;
        const highCount = issues.filter(i => i.severity === 'HIGH').length;
        await db.run('INSERT INTO audit_reports (target, issues_found, critical_level, full_report) VALUES (?, ?, ?, ?)', [target, issues.length, criticalCount > 0, JSON.stringify(issues)]);
        // Score basado en reglas únicas disparadas, no en número de archivos afectados
        const totalRules = 20;
        const criticalWeight = 20;
        const highWeight = 10;
        const mediumWeight = 4;
        const lowWeight = 1;
        const mediumCount = issues.filter(i => i.severity === 'MEDIUM').length;
        const lowCount = issues.filter(i => i.severity === 'LOW').length;
        const penalty = (criticalCount * criticalWeight) + (highCount * highWeight) + (mediumCount * mediumWeight) + (lowCount * lowWeight);
        const score = Math.max(0, Math.min(100, 100 - penalty));
        return {
            timestamp: new Date().toISOString(),
            status: "AUDIT_COMPLETED",
            target,
            securityScore: score,
            totalIssues: issues.length,
            criticalIssues: criticalCount,
            highIssues: highCount,
            summary: {
                critical: criticalCount,
                high: highCount,
                medium: issues.filter(i => i.severity === 'MEDIUM').length,
                low: issues.filter(i => i.severity === 'LOW').length
            },
            issues
        };
    }
    catch (error) {
        console.error('[VibeCheck] Scan error:', error.message);
        return reply.status(500).send({ error: "Failed to scan repository.", details: error.message?.substring(0, 200) });
    }
    finally {
        // Cleanup temp directory
        if (tempDir) {
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
            catch { }
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
