import * as fs from 'fs';
import * as path from 'path';

export interface ScanIssue {
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    ruleId: string;
    description: string;
    file: string;
    line?: number;
    suggestion: string;
}

const SECURITY_RULES = [
    // CRITICAL
    {
        id: "LLM-001",
        pattern: "(sk-proj-[a-zA-Z0-9]{20,}|sk-[a-zA-Z0-9]{40,}|AIza[0-9A-Za-z-_]{35}|ghp_[a-zA-Z0-9]{36}|AKIA[0-9A-Z]{16})",
        severity: "CRITICAL" as const,
        description: "Hardcoded API key/credential detected (OpenAI, Google, GitHub, AWS).",
        suggestion: "Move credentials to environment variables or a secrets manager."
    },
    {
        id: "LLM-002",
        pattern: "eval\\(|new Function\\(|exec\\(.*\\+",
        severity: "CRITICAL" as const,
        description: "Dynamic code execution detected — potential Remote Code Execution via LLM output.",
        suggestion: "Never execute strings from LLM responses. Use structured outputs instead."
    },
    {
        id: "LLM-003",
        pattern: "(password|secret|token|api_key|apikey|private_key)\\s*[:=]\\s*['\"][^'\"]{8,}",
        severity: "CRITICAL" as const,
        description: "Hardcoded secret or password in source code.",
        suggestion: "Use environment variables or a vault service for secrets."
    },
    // HIGH
    {
        id: "LLM-004",
        pattern: "(prompt|message|input|query).*=.*(req\\.body|req\\.query|request\\.body|params\\[|request\\.form)",
        severity: "HIGH" as const,
        description: "Direct user input injection into LLM prompt without sanitization.",
        suggestion: "Implement input validation and use parameterized prompt templates."
    },
    {
        id: "LLM-005",
        pattern: "dangerouslySetInnerHTML|innerHTML.*=.*response|v-html.*=",
        severity: "HIGH" as const,
        description: "Unsafe rendering of AI output — XSS vulnerability.",
        suggestion: "Sanitize LLM responses before rendering in the DOM."
    },
    {
        id: "LLM-006",
        pattern: "system.*prompt.*=.*req\\.|systemMessage.*=.*user|role.*:.*system.*\\+.*input",
        severity: "HIGH" as const,
        description: "System prompt can be overridden by user input.",
        suggestion: "Keep system prompts server-side and immutable by users."
    },
    {
        id: "LLM-007",
        pattern: "console\\.log\\(.*prompt|console\\.log\\(.*message|logger\\..*(prompt|user_input|query)",
        severity: "HIGH" as const,
        description: "Sensitive prompts or user inputs being logged.",
        suggestion: "Avoid logging raw prompts — they may contain PII or sensitive data."
    },
    {
        id: "LLM-008",
        pattern: "fetch\\(.*openai|axios\\..*(openai|anthropic|cohere).*(?!.*auth)",
        severity: "HIGH" as const,
        description: "Direct AI API call without visible authentication middleware.",
        suggestion: "Ensure AI API calls go through authenticated endpoints with rate limiting."
    },
    // MEDIUM
    {
        id: "LLM-009",
        pattern: "max_tokens.*:\\s*(4096|8192|16384|32768|100000|\\-1)",
        severity: "MEDIUM" as const,
        description: "Excessively high or unlimited token limit — potential cost attack.",
        suggestion: "Set reasonable token limits to prevent abuse and cost overruns."
    },
    {
        id: "LLM-010",
        pattern: "model.*[:=].*['\"].*['\"].*//|model.*hardcoded|gpt-4|claude-3|gemini-pro",
        severity: "MEDIUM" as const,
        description: "Hardcoded model name — makes it difficult to rotate or update models.",
        suggestion: "Use environment variables for model selection."
    },
    {
        id: "LLM-011",
        pattern: "temperature.*[:=]\\s*(1\\.\\d|2|1\\.0)",
        severity: "MEDIUM" as const,
        description: "High temperature setting increases output unpredictability.",
        suggestion: "Use lower temperature (0.1-0.7) for production, especially security-sensitive contexts."
    },
    {
        id: "LLM-012",
        pattern: "(ssn|social.security|credit.card|\\bcvv\\b|\\bpin\\b).*=.*input|input.*(ssn|credit.card)",
        severity: "MEDIUM" as const,
        description: "Potential PII handling in AI pipeline without encryption.",
        suggestion: "Never pass PII directly to LLMs. Mask or tokenize sensitive data first."
    },
    {
        id: "LLM-013",
        pattern: "app\\.(post|get|put)\\(.*(chat|complete|generate|prompt).*(?!.*auth|.*middleware|.*verify)",
        severity: "MEDIUM" as const,
        description: "AI endpoint potentially missing authentication middleware.",
        suggestion: "Add authentication and rate limiting to all AI-facing endpoints."
    },
    // LOW
    {
        id: "LLM-014",
        pattern: "TODO.*security|FIXME.*auth|HACK.*prompt|XXX.*inject",
        severity: "LOW" as const,
        description: "Security-related TODO/FIXME comment found.",
        suggestion: "Address security TODOs before deploying to production."
    },
    {
        id: "LLM-015",
        pattern: "import.*langchain|from langchain|require.*langchain",
        severity: "LOW" as const,
        description: "LangChain dependency detected — check for known supply chain vulnerabilities.",
        suggestion: "Keep LangChain updated and audit chain configurations for injection risks."
    },
    {
        id: "LLM-016",
        pattern: "stream.*:.*true|streaming.*=.*true",
        severity: "LOW" as const,
        description: "Streaming mode enabled — ensure output validation still applies to streamed chunks.",
        suggestion: "Validate and sanitize streamed LLM output before displaying to users."
    },
    {
        id: "LLM-017",
        pattern: "websocket|ws://|wss://.*(?:ai|llm|chat|prompt)",
        severity: "MEDIUM" as const,
        description: "WebSocket connection for AI communication — ensure proper auth and input validation.",
        suggestion: "Add authentication, rate limiting, and input validation to WebSocket AI endpoints."
    },
    {
        id: "LLM-018",
        pattern: "pickle\\.load|yaml\\.load\\(.*(?!Loader)|deserialize|unserialize",
        severity: "HIGH" as const,
        description: "Unsafe deserialization detected — potential code execution via crafted payloads.",
        suggestion: "Use safe deserialization methods (yaml.safe_load, JSON) and validate input sources."
    },
    {
        id: "LLM-019",
        pattern: "\\.env\\.example|dotenv.*config|process\\.env\\.",
        severity: "LOW" as const,
        description: "Environment variable usage detected — verify .env files are gitignored.",
        suggestion: "Ensure .env files are in .gitignore and secrets are not committed."
    },
    {
        id: "LLM-020",
        pattern: "CORS.*origin.*\\*|cors\\(\\)|Access-Control-Allow-Origin.*\\*",
        severity: "MEDIUM" as const,
        description: "Permissive CORS configuration — any origin can access AI endpoints.",
        suggestion: "Restrict CORS to specific trusted domains in production."
    }
];

export class RepoScanner {
    private issues: ScanIssue[] = [];
    private fileCount = 0;

    public async scanDirectory(targetPath: string): Promise<ScanIssue[]> {
        console.log(`[VibeCheck Scanner] Starting audit on: ${targetPath}`);
        this.issues = [];
        this.fileCount = 0;
        await this.walkDir(targetPath);
        console.log(`[VibeCheck Scanner] Scanned ${this.fileCount} files, found ${this.issues.length} issues`);
        return this.issues;
    }

    private async walkDir(dir: string): Promise<void> {
        let files: string[];
        try {
            files = await fs.promises.readdir(dir);
        } catch {
            return;
        }

        for (const file of files) {
            const filePath = path.join(dir, file);
            let stat;
            try {
                stat = await fs.promises.stat(filePath);
            } catch {
                continue;
            }

            if (stat.isDirectory()) {
                const skip = ['node_modules', '.git', 'dist', 'build', '__pycache__', '.next', 'vendor', '.venv', 'venv'];
                if (!skip.includes(file)) {
                    await this.walkDir(filePath);
                }
            } else {
                if (this.isAnalyzableFile(file) && stat.size < 500000) {
                    await this.analyzeFile(filePath);
                    this.fileCount++;
                }
            }
        }
    }

    private isAnalyzableFile(filename: string): boolean {
        const ext = path.extname(filename).toLowerCase();
        return ['.ts', '.tsx', '.js', '.jsx', '.py', '.php', '.rb', '.go', '.rs', '.java', '.cs', '.vue', '.svelte'].includes(ext);
    }

    private async analyzeFile(filePath: string): Promise<void> {
        let content: string;
        try {
            content = await fs.promises.readFile(filePath, 'utf-8');
        } catch {
            return;
        }
        const lines = content.split('\n');
        const relativePath = filePath.replace(/.*\/repo\//, '');

        lines.forEach((line, index) => {
            SECURITY_RULES.forEach(rule => {
                try {
                    const regex = new RegExp(rule.pattern, 'i');
                    if (regex.test(line)) {
                        // Avoid duplicate issues for the same rule in the same file
                        const exists = this.issues.some(i => i.ruleId === rule.id && i.file === relativePath && i.line === index + 1);
                        if (!exists) {
                            this.issues.push({
                                severity: rule.severity,
                                ruleId: rule.id,
                                description: rule.description,
                                file: relativePath,
                                line: index + 1,
                                suggestion: rule.suggestion
                            });
                        }
                    }
                } catch {}
            });
        });
    }
}
