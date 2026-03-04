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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepoScanner = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const SECURITY_RULES = [
    {
        id: "LLM-001",
        pattern: "(sk-proj-[a-zA-Z0-9]{20,}|sk-[a-zA-Z0-9]{40,}|AIza[0-9A-Za-z-_]{35}|ghp_[a-zA-Z0-9]{36}|AKIA[0-9A-Z]{16})",
        severity: "CRITICAL",
        description: "Hardcoded API key/credential detected (OpenAI, Google, GitHub, AWS).",
        suggestion: "Move credentials to environment variables or a secrets manager."
    },
    {
        id: "LLM-002",
        pattern: "eval\\(|new Function\\(",
        severity: "CRITICAL",
        description: "Dynamic code execution detected — potential Remote Code Execution via LLM output.",
        suggestion: "Never execute strings from LLM responses. Use structured outputs instead."
    },
    {
        id: "LLM-003",
        pattern: "(password|secret|token|api_key|apikey|private_key)\\s*[:=]\\s*['\"][^'\"]{8,}['\"]",
        severity: "CRITICAL",
        description: "Hardcoded secret or password in source code.",
        suggestion: "Use environment variables or a vault service for secrets."
    },
    {
        id: "LLM-004",
        pattern: "(prompt|message|input|query)\\s*=\\s*.*(req\\.body|req\\.query|request\\.body|request\\.form)",
        severity: "HIGH",
        description: "Direct user input injected into LLM prompt without sanitization.",
        suggestion: "Implement input validation and use parameterized prompt templates."
    },
    {
        id: "LLM-005",
        pattern: "dangerouslySetInnerHTML|innerHTML\\s*=\\s*.*response|v-html\\s*=",
        severity: "HIGH",
        description: "Unsafe rendering of AI output — XSS vulnerability.",
        suggestion: "Sanitize LLM responses before rendering in the DOM."
    },
    {
        id: "LLM-006",
        pattern: "system.*prompt\\s*=\\s*req\\.|systemMessage\\s*=\\s*user|role.*:\\s*system.*\\+.*input",
        severity: "HIGH",
        description: "System prompt can be overridden by user input.",
        suggestion: "Keep system prompts server-side and immutable by users."
    },
    {
        id: "LLM-007",
        pattern: "console\\.log\\(.*prompt|console\\.log\\(.*message|logger\\..*user_input",
        severity: "HIGH",
        description: "Sensitive prompts or user inputs being logged.",
        suggestion: "Avoid logging raw prompts — they may contain PII or sensitive data."
    },
    {
        id: "LLM-008",
        pattern: "pickle\\.load|yaml\\.load\\([^)]*(?!safe)|unserialize\\(",
        severity: "HIGH",
        description: "Unsafe deserialization detected — potential code execution.",
        suggestion: "Use safe deserialization methods (yaml.safe_load, JSON)."
    },
    {
        id: "LLM-009",
        pattern: "max_tokens\\s*:\\s*(8192|16384|32768|100000)",
        severity: "MEDIUM",
        description: "Excessively high token limit — potential cost attack vector.",
        suggestion: "Set reasonable token limits to prevent abuse and cost overruns."
    },
    {
        id: "LLM-010",
        pattern: "model\\s*[:=]\\s*['\"]gpt-4|model\\s*[:=]\\s*['\"]claude-3|model\\s*[:=]\\s*['\"]gemini-pro",
        severity: "MEDIUM",
        description: "Hardcoded model name — makes rotation and updates difficult.",
        suggestion: "Use environment variables for model selection."
    },
    {
        id: "LLM-011",
        pattern: "temperature\\s*[:=]\\s*(1\\.[5-9]|2\\.0?)",
        severity: "MEDIUM",
        description: "Very high temperature — unpredictable outputs in production.",
        suggestion: "Use temperature 0.1–0.7 for production environments."
    },
    {
        id: "LLM-012",
        pattern: "(ssn|social_security|credit_card|\\bcvv\\b)\\s*=\\s*input",
        severity: "MEDIUM",
        description: "PII passed directly into AI pipeline without masking.",
        suggestion: "Mask or tokenize sensitive data before sending to LLMs."
    },
    {
        id: "LLM-013",
        pattern: "app\\.(post|get|put)\\(['\"].*(chat|complete|generate|prompt)['\"](?!.*auth|.*middleware|.*verify)",
        severity: "MEDIUM",
        description: "AI endpoint potentially missing authentication middleware.",
        suggestion: "Add authentication and rate limiting to all AI-facing endpoints."
    },
    {
        id: "LLM-014",
        pattern: "TODO.*security|FIXME.*auth|HACK.*prompt|XXX.*inject",
        severity: "LOW",
        description: "Security-related TODO/FIXME comment found in code.",
        suggestion: "Address security TODOs before deploying to production."
    },
    {
        id: "LLM-015",
        pattern: "from langchain|require.*langchain|import.*langchain",
        severity: "LOW",
        description: "LangChain dependency — check for supply chain vulnerabilities.",
        suggestion: "Keep LangChain updated and audit chain configurations."
    },
    {
        id: "LLM-016",
        pattern: "streaming\\s*:\\s*true|stream\\s*:\\s*true",
        severity: "LOW",
        description: "Streaming mode enabled — ensure output validation applies to chunks.",
        suggestion: "Validate streamed LLM output before displaying to users."
    },
    {
        id: "LLM-017",
        pattern: "new WebSocket\\(|wss?://.*(?:ai|llm|chat|prompt)",
        severity: "MEDIUM",
        description: "WebSocket for AI communication — verify auth and input validation.",
        suggestion: "Add authentication and rate limiting to WebSocket AI endpoints."
    },
    {
        id: "LLM-018",
        pattern: "Access-Control-Allow-Origin:\\s*\\*|cors\\(\\{\\s*origin:\\s*['\"]\\*['\"]",
        severity: "MEDIUM",
        description: "Wildcard CORS — any origin can access your AI endpoints.",
        suggestion: "Restrict CORS to specific trusted domains in production."
    },
    {
        id: "LLM-019",
        pattern: "process\\.env\\.OPENAI_API_KEY\\s*\\|\\||process\\.env\\.API_KEY\\s*\\|\\|\\s*['\"][^'\"]{4,}",
        severity: "MEDIUM",
        description: "Hardcoded fallback for API key env variable.",
        suggestion: "Never use a hardcoded fallback for secret keys. Fail loudly instead."
    },
    {
        id: "LLM-020",
        pattern: "shell_exec\\(|subprocess\\.call\\(|child_process\\.exec\\(",
        severity: "HIGH",
        description: "Shell execution found — dangerous if fed LLM output.",
        suggestion: "Never pass LLM output to shell commands. Use safe APIs instead."
    }
];
// Files to always skip
const SKIP_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', 'out', '__pycache__',
    '.next', 'vendor', '.venv', 'venv', 'env',
    'test', 'tests', '__tests__', 'spec', 'specs',
    'docs', 'doc', 'examples', 'example', 'fixtures',
    'mocks', 'mock', 'stubs', 'coverage', '.nyc_output'
]);
const SKIP_FILES = new Set([
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
    'CHANGELOG.md', 'CHANGELOG.txt', 'LICENSE', 'README.md'
]);
const ANALYZABLE_EXTS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.py', '.php', '.rb', '.go', '.rs', '.java', '.cs',
    '.vue', '.svelte', '.env'
]);
class RepoScanner {
    fileCount = 0;
    async scanDirectory(targetPath) {
        this.fileCount = 0;
        // Collect all files first
        const allFiles = [];
        await this.walkDir(targetPath, allFiles);
        // Group hits: ruleId → { firstFile, firstLine, count }
        const ruleHits = new Map();
        for (const filePath of allFiles) {
            const relativePath = filePath.replace(/.*\/repo\//, '');
            await this.analyzeFile(filePath, relativePath, ruleHits);
            this.fileCount++;
        }
        console.log(`[VibeCheck] Scanned ${this.fileCount} files, ${ruleHits.size} rules triggered`);
        // Build final issues list — one per rule, sorted by severity
        const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        const issues = Array.from(ruleHits.entries()).map(([ruleId, hit]) => {
            const rule = SECURITY_RULES.find(r => r.id === ruleId);
            return {
                severity: rule.severity,
                ruleId: rule.id,
                description: rule.description,
                file: hit.file,
                line: hit.line,
                suggestion: rule.suggestion,
                affectedFiles: hit.count
            };
        }).sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
        return issues;
    }
    async walkDir(dir, files) {
        let entries;
        try {
            entries = await fs.promises.readdir(dir);
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (SKIP_FILES.has(entry))
                continue;
            const fullPath = path.join(dir, entry);
            let stat;
            try {
                stat = await fs.promises.stat(fullPath);
            }
            catch {
                continue;
            }
            if (stat.isDirectory()) {
                if (!SKIP_DIRS.has(entry))
                    await this.walkDir(fullPath, files);
            }
            else {
                const ext = path.extname(entry).toLowerCase();
                if (ANALYZABLE_EXTS.has(ext) && stat.size < 300000) {
                    files.push(fullPath);
                }
            }
        }
    }
    async analyzeFile(filePath, relativePath, ruleHits) {
        let content;
        try {
            content = await fs.promises.readFile(filePath, 'utf-8');
        }
        catch {
            return;
        }
        const lines = content.split('\n');
        lines.forEach((line, index) => {
            const trimmed = line.trim();
            // Skip blank lines, pure comments
            if (!trimmed)
                return;
            if (trimmed.startsWith('//') || trimmed.startsWith('#') ||
                trimmed.startsWith('*') || trimmed.startsWith('/*') ||
                trimmed.startsWith('<!--'))
                return;
            for (const rule of SECURITY_RULES) {
                try {
                    const regex = new RegExp(rule.pattern, 'i');
                    if (regex.test(line)) {
                        const existing = ruleHits.get(rule.id);
                        if (!existing) {
                            // First hit — record it
                            ruleHits.set(rule.id, { file: relativePath, line: index + 1, count: 1 });
                        }
                        else {
                            // Already seen — just increment counter, keep first occurrence
                            existing.count++;
                        }
                        break; // one rule match per line is enough
                    }
                }
                catch { }
            }
        });
    }
}
exports.RepoScanner = RepoScanner;
