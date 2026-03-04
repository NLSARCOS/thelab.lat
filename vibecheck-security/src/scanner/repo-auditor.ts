import * as fs from 'fs';
import * as path from 'path';

export interface ScanIssue {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  ruleId: string;
  category: string;
  description: string;
  file: string;
  line?: number;
  suggestion: string;
  affectedFiles?: number;
  cwe?: string;
  owasp?: string;
}

export interface ScanResult {
  issues: ScanIssue[];
  score: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  summary: { critical: number; high: number; medium: number; low: number };
  categories: Record<string, number>;
  filesScanned: number;
  topRisks: string[];
  verdict: string;
}

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

type RuleScanMode = 'line' | 'file' | 'path';

interface RuleContext {
  content: string;
  lines: string[];
  relativePath: string;
}

interface SecurityRule {
  id: string;
  category: string;
  severity: Severity;
  description: string;
  suggestion: string;
  pattern?: string;
  flags?: string;
  scan?: RuleScanMode;
  pathPattern?: string;
  fileExtensions?: string[];
  cwe?: string;
  owasp?: string;
  test?: (ctx: RuleContext) => boolean;
  linePattern?: string;
}

const SECURITY_RULES: SecurityRule[] = [
  // ─── LLM (LLM-001~020) ─────────────────────────────────────
  {
    id: 'LLM-001',
    category: 'LLM',
    severity: 'CRITICAL',
    pattern: '(sk-proj-[a-zA-Z0-9]{20,}|sk-[a-zA-Z0-9]{40,}|AIza[0-9A-Za-z-_]{35}|ghp_[a-zA-Z0-9]{36}|AKIA[0-9A-Z]{16})',
    description: 'Hardcoded API key/credential detected (OpenAI, Google, GitHub, AWS).',
    suggestion: 'Move credentials to environment variables or a secrets manager.',
    cwe: 'CWE-798',
    owasp: 'A07:2021'
  },
  {
    id: 'LLM-002',
    category: 'LLM',
    severity: 'CRITICAL',
    pattern: 'eval\\(|new Function\\(',
    description: 'Dynamic code execution detected — potential Remote Code Execution via LLM output.',
    suggestion: 'Never execute strings from LLM responses. Use structured outputs instead.',
    cwe: 'CWE-94',
    owasp: 'A03:2021'
  },
  {
    id: 'LLM-003',
    category: 'LLM',
    severity: 'CRITICAL',
    pattern: '(password|secret|token|api_key|apikey|private_key)\\s*[:=]\\s*[\'\"][^\'\"]{8,}[\'\"]',
    description: 'Hardcoded secret or password in source code.',
    suggestion: 'Use environment variables or a vault service for secrets.',
    cwe: 'CWE-798',
    owasp: 'A07:2021'
  },
  {
    id: 'LLM-004',
    category: 'LLM',
    severity: 'HIGH',
    pattern: '(prompt|message|input|query)\\s*=\\s*.*(req\\.body|req\\.query|request\\.body|request\\.form)',
    description: 'Direct user input injected into LLM prompt without sanitization.',
    suggestion: 'Implement input validation and use parameterized prompt templates.',
    cwe: 'CWE-20',
    owasp: 'A03:2021'
  },
  {
    id: 'LLM-005',
    category: 'LLM',
    severity: 'HIGH',
    pattern: 'dangerouslySetInnerHTML|innerHTML\\s*=\\s*.*response|v-html\\s*=',
    description: 'Unsafe rendering of AI output — XSS vulnerability.',
    suggestion: 'Sanitize LLM responses before rendering in the DOM.',
    cwe: 'CWE-79',
    owasp: 'A03:2021'
  },
  {
    id: 'LLM-006',
    category: 'LLM',
    severity: 'HIGH',
    pattern: 'system.*prompt\\s*=\\s*req\\.|systemMessage\\s*=\\s*user|role.*:\\s*system.*\\+.*input',
    description: 'System prompt can be overridden by user input.',
    suggestion: 'Keep system prompts server-side and immutable by users.',
    cwe: 'CWE-20',
    owasp: 'A03:2021'
  },
  {
    id: 'LLM-007',
    category: 'LLM',
    severity: 'HIGH',
    pattern: 'console\\.log\\(.*prompt|console\\.log\\(.*message|logger\\..*user_input',
    description: 'Sensitive prompts or user inputs being logged.',
    suggestion: 'Avoid logging raw prompts — they may contain PII or sensitive data.',
    cwe: 'CWE-532',
    owasp: 'A09:2021'
  },
  {
    id: 'LLM-008',
    category: 'LLM',
    severity: 'HIGH',
    pattern: 'pickle\\.load|yaml\\.load\\([^)]*(?!safe)|unserialize\\(',
    description: 'Unsafe deserialization detected — potential code execution.',
    suggestion: 'Use safe deserialization methods (yaml.safe_load, JSON).',
    cwe: 'CWE-502',
    owasp: 'A08:2021'
  },
  {
    id: 'LLM-009',
    category: 'LLM',
    severity: 'MEDIUM',
    pattern: 'max_tokens\\s*:\\s*(8192|16384|32768|100000)',
    description: 'Excessively high token limit — potential cost attack vector.',
    suggestion: 'Set reasonable token limits to prevent abuse and cost overruns.'
  },
  {
    id: 'LLM-010',
    category: 'LLM',
    severity: 'MEDIUM',
    pattern: 'model\\s*[:=]\\s*[\'\"]gpt-4|model\\s*[:=]\\s*[\'\"]claude-3|model\\s*[:=]\\s*[\'\"]gemini-pro',
    description: 'Hardcoded model name — makes rotation and updates difficult.',
    suggestion: 'Use environment variables for model selection.'
  },
  {
    id: 'LLM-011',
    category: 'LLM',
    severity: 'MEDIUM',
    pattern: 'temperature\\s*[:=]\\s*(1\\.[5-9]|2\\.0?)',
    description: 'Very high temperature — unpredictable outputs in production.',
    suggestion: 'Use temperature 0.1–0.7 for production environments.'
  },
  {
    id: 'LLM-012',
    category: 'LLM',
    severity: 'MEDIUM',
    pattern: '(ssn|social_security|credit_card|\\bcvv\\b)\\s*=\\s*input',
    description: 'PII passed directly into AI pipeline without masking.',
    suggestion: 'Mask or tokenize sensitive data before sending to LLMs.',
    cwe: 'CWE-359',
    owasp: 'A02:2021'
  },
  {
    id: 'LLM-013',
    category: 'LLM',
    severity: 'MEDIUM',
    pattern: 'app\\.(post|get|put)\\([\'\"].*(chat|complete|generate|prompt)[\'\"](?!.*auth|.*middleware|.*verify)',
    description: 'AI endpoint potentially missing authentication middleware.',
    suggestion: 'Add authentication and rate limiting to all AI-facing endpoints.',
    cwe: 'CWE-306',
    owasp: 'A07:2021'
  },
  {
    id: 'LLM-014',
    category: 'LLM',
    severity: 'LOW',
    pattern: 'TODO.*security|FIXME.*auth|HACK.*prompt|XXX.*inject',
    description: 'Security-related TODO/FIXME comment found in code.',
    suggestion: 'Address security TODOs before deploying to production.'
  },
  {
    id: 'LLM-015',
    category: 'LLM',
    severity: 'LOW',
    pattern: 'from langchain|require.*langchain|import.*langchain',
    description: 'LangChain dependency — check for supply chain vulnerabilities.',
    suggestion: 'Keep LangChain updated and audit chain configurations.',
    cwe: 'CWE-829',
    owasp: 'A08:2021'
  },
  {
    id: 'LLM-016',
    category: 'LLM',
    severity: 'LOW',
    pattern: 'streaming\\s*:\\s*true|stream\\s*:\\s*true',
    description: 'Streaming mode enabled — ensure output validation applies to chunks.',
    suggestion: 'Validate streamed LLM output before displaying to users.'
  },
  {
    id: 'LLM-017',
    category: 'LLM',
    severity: 'MEDIUM',
    pattern: 'new WebSocket\\(|wss?://.*(?:ai|llm|chat|prompt)',
    description: 'WebSocket for AI communication — verify auth and input validation.',
    suggestion: 'Add authentication and rate limiting to WebSocket AI endpoints.',
    cwe: 'CWE-306',
    owasp: 'A07:2021'
  },
  {
    id: 'LLM-018',
    category: 'LLM',
    severity: 'MEDIUM',
    pattern: 'Access-Control-Allow-Origin:\\s*\\*|cors\\(\\{\\s*origin:\\s*[\'\"]\\*[\'\"]',
    description: 'Wildcard CORS — any origin can access your AI endpoints.',
    suggestion: 'Restrict CORS to specific trusted domains in production.',
    cwe: 'CWE-942',
    owasp: 'A05:2021'
  },
  {
    id: 'LLM-019',
    category: 'LLM',
    severity: 'MEDIUM',
    pattern: 'process\\.env\\.OPENAI_API_KEY\\s*\\|\\||process\\.env\\.API_KEY\\s*\\|\\|\\s*[\'\"][^\'\"]{4,}',
    description: 'Hardcoded fallback for API key env variable.',
    suggestion: 'Never use a hardcoded fallback for secret keys. Fail loudly instead.',
    cwe: 'CWE-798',
    owasp: 'A07:2021'
  },
  {
    id: 'LLM-020',
    category: 'LLM',
    severity: 'HIGH',
    pattern: 'shell_exec\\(|subprocess\\.call\\(|child_process\\.exec\\(',
    description: 'Shell execution found — dangerous if fed LLM output.',
    suggestion: 'Never pass LLM output to shell commands. Use safe APIs instead.',
    cwe: 'CWE-78',
    owasp: 'A03:2021'
  },

  // ─── FIREWALL (WALL-001~010) ─────────────────────────────
  {
    id: 'WALL-001',
    category: 'FIREWALL',
    severity: 'CRITICAL',
    scan: 'file',
    pattern: 'app\\.(post|put)\\([\'\"]/(login|register|reset-password)[\'\"]',
    description: 'Rate limiting missing on /login, /register, or /reset-password endpoints.',
    suggestion: 'Add rate limiting middleware to all auth endpoints.',
    cwe: 'CWE-307',
    owasp: 'A07:2021'
  },
  {
    id: 'WALL-002',
    category: 'FIREWALL',
    severity: 'HIGH',
    scan: 'file',
    test: (ctx) => /express\s*\(/i.test(ctx.content) && !/helmet\s*\(/i.test(ctx.content),
    description: 'Express app detected without helmet() configured.',
    suggestion: 'Add helmet() to set secure HTTP headers.',
    cwe: 'CWE-693',
    owasp: 'A05:2021'
  },
  {
    id: 'WALL-003',
    category: 'FIREWALL',
    severity: 'HIGH',
    scan: 'file',
    test: (ctx) => /body-parser|bodyParser|express\.json\(/i.test(ctx.content) && !/limit\s*:/i.test(ctx.content),
    description: 'body-parser/express.json used without a size limit.',
    suggestion: 'Set a reasonable body size limit (e.g., 1mb) to prevent abuse.',
    cwe: 'CWE-770',
    owasp: 'A05:2021'
  },
  {
    id: 'WALL-004',
    category: 'FIREWALL',
    severity: 'HIGH',
    pattern: 'cors\\(\\{\\s*origin:\\s*[\'\"]\\*[\'\"]|Access-Control-Allow-Origin:\\s*\\*',
    description: 'CORS wildcard "*" configured in production.',
    suggestion: 'Restrict CORS origins to trusted domains.',
    cwe: 'CWE-942',
    owasp: 'A05:2021'
  },
  {
    id: 'WALL-005',
    category: 'FIREWALL',
    severity: 'HIGH',
    scan: 'file',
    pattern: 'app\\.(get|post|put|delete)\\([\'\"]/(admin|admin/.*)[\'\"]',
    description: 'Admin routes detected without authentication middleware.',
    suggestion: 'Require authentication/authorization on all admin routes.',
    cwe: 'CWE-306',
    owasp: 'A01:2021'
  },
  {
    id: 'WALL-006',
    category: 'FIREWALL',
    severity: 'MEDIUM',
    scan: 'file',
    test: (ctx) => /(fetch\(|axios\.|request\()/i.test(ctx.content) && !/timeout\s*:/i.test(ctx.content),
    description: 'External fetch/axios calls without timeout.',
    suggestion: 'Set timeouts to prevent resource exhaustion and hanging requests.',
    cwe: 'CWE-400',
    owasp: 'A05:2021'
  },
  {
    id: 'WALL-007',
    category: 'FIREWALL',
    severity: 'MEDIUM',
    scan: 'file',
    test: (ctx) => /app\.(post|put|patch)\(/i.test(ctx.content) && !/content-type|Content-Type/i.test(ctx.content),
    description: 'POST/PUT/PATCH endpoints without Content-Type validation.',
    suggestion: 'Validate Content-Type headers to avoid unsafe payload parsing.',
    cwe: 'CWE-20',
    owasp: 'A05:2021'
  },
  {
    id: 'WALL-008',
    category: 'FIREWALL',
    severity: 'MEDIUM',
    pattern: 'app\\.(get|post)\\([\'\"]/(health|status|metrics)[\'\"]',
    description: 'Health/status endpoints exposed without authentication.',
    suggestion: 'Protect internal health endpoints or restrict network access.',
    cwe: 'CWE-200',
    owasp: 'A05:2021'
  },
  {
    id: 'WALL-009',
    category: 'FIREWALL',
    severity: 'LOW',
    scan: 'file',
    test: (ctx) => /helmet\s*\(/i.test(ctx.content) && !/contentSecurityPolicy/i.test(ctx.content),
    description: 'No CSP header configured.',
    suggestion: 'Enable Content Security Policy to reduce XSS risk.',
    cwe: 'CWE-1021',
    owasp: 'A05:2021'
  },
  {
    id: 'WALL-010',
    category: 'FIREWALL',
    severity: 'LOW',
    scan: 'file',
    test: (ctx) => /<form|app\.(post|put)\(/i.test(ctx.content) && !/csrf|csurf/i.test(ctx.content),
    description: 'CSRF protection missing for forms.',
    suggestion: 'Add CSRF tokens for state-changing requests.',
    cwe: 'CWE-352',
    owasp: 'A01:2021'
  },

  // ─── HONEYPOT (HONEY-001~005) ────────────────────────────
  {
    id: 'HONEY-001',
    category: 'HONEYPOT',
    severity: 'CRITICAL',
    scan: 'path',
    pathPattern: '(?:^|/)(admin|phpmyadmin|wp-admin)(?:/|$)',
    description: 'Sensitive admin paths exposed publicly (/admin, /phpmyadmin, /wp-admin).',
    suggestion: 'Remove public exposure or protect with strong authentication.',
    cwe: 'CWE-284',
    owasp: 'A01:2021'
  },
  {
    id: 'HONEY-002',
    category: 'HONEYPOT',
    severity: 'HIGH',
    scan: 'path',
    pathPattern: '(?:^|/)(__debug__|debug|env|config)(?:/|$)',
    description: 'Debug/config endpoints detected without auth.',
    suggestion: 'Disable debug endpoints or restrict access in production.',
    cwe: 'CWE-200',
    owasp: 'A05:2021'
  },
  {
    id: 'HONEY-003',
    category: 'HONEYPOT',
    severity: 'HIGH',
    pattern: 'res\\.status\\([^)]*\\)\\.send\\([^)]*err\\.stack|err\\.stack\s*\+|stack:\\s*err\\.stack',
    description: 'Stack traces exposed in error responses.',
    suggestion: 'Return generic errors and log stack traces server-side only.',
    cwe: 'CWE-209',
    owasp: 'A05:2021'
  },
  {
    id: 'HONEY-004',
    category: 'HONEYPOT',
    severity: 'HIGH',
    pattern: 'process\\.env\\.[A-Z0-9_]+',
    description: 'Environment variables referenced in frontend/client code.',
    suggestion: 'Never expose server secrets to client-side bundles.',
    cwe: 'CWE-200',
    owasp: 'A02:2021'
  },
  {
    id: 'HONEY-005',
    category: 'HONEYPOT',
    severity: 'MEDIUM',
    pattern: '(password|secret|token|api_key)\\s*[:=].*//',
    description: 'Credentials found in client-side comments (browser-visible).',
    suggestion: 'Remove secrets from code comments and client bundles.',
    cwe: 'CWE-200',
    owasp: 'A02:2021'
  },

  // ─── ANTI-SPAM (SPAM-001~005) ────────────────────────────
  {
    id: 'SPAM-001',
    category: 'ANTI-SPAM',
    severity: 'HIGH',
    scan: 'file',
    pattern: 'app\\.(post|put)\\([\'\"]/(register|contact)[\'\"]',
    description: 'Registration/contact endpoints without captcha or verification.',
    suggestion: 'Add CAPTCHA or bot verification for public forms.',
    cwe: 'CWE-307',
    owasp: 'A07:2021'
  },
  {
    id: 'SPAM-002',
    category: 'ANTI-SPAM',
    severity: 'HIGH',
    scan: 'file',
    test: (ctx) => /register|signup/i.test(ctx.content) && !/verifyEmail|emailVerification/i.test(ctx.content),
    description: 'Email verification missing on user registration.',
    suggestion: 'Require email verification before activating accounts.',
    cwe: 'CWE-287',
    owasp: 'A07:2021'
  },
  {
    id: 'SPAM-003',
    category: 'ANTI-SPAM',
    severity: 'HIGH',
    scan: 'file',
    pattern: 'reset-password|forgot-password',
    description: 'Password reset endpoints without rate limiting.',
    suggestion: 'Limit password reset attempts per user and IP.',
    cwe: 'CWE-307',
    owasp: 'A07:2021'
  },
  {
    id: 'SPAM-004',
    category: 'ANTI-SPAM',
    severity: 'MEDIUM',
    pattern: '/email/send|sendEmail\\(|mailer\\.send',
    description: 'Email sending endpoint detected without authentication.',
    suggestion: 'Require authentication or signed tokens for email send endpoints.',
    cwe: 'CWE-306',
    owasp: 'A01:2021'
  },
  {
    id: 'SPAM-005',
    category: 'ANTI-SPAM',
    severity: 'MEDIUM',
    scan: 'file',
    test: (ctx) => /webhook/i.test(ctx.content) && !/verify|signature|hmac/i.test(ctx.content),
    description: 'Incoming webhooks without origin validation.',
    suggestion: 'Verify webhook signatures and allow-list origins.',
    cwe: 'CWE-345',
    owasp: 'A01:2021'
  },

  // ─── INJECTION (INJ-001~010) ─────────────────────────────
  {
    id: 'INJ-001',
    category: 'INJECTION',
    severity: 'CRITICAL',
    pattern: 'SELECT\\s+.*\\+\\s*req\\.|INSERT\\s+.*\\+\\s*req\\.|UPDATE\\s+.*\\+\\s*req\\.|DELETE\\s+.*\\+\\s*req\\.',
    description: 'SQL injection — direct concatenation in queries.',
    suggestion: 'Use parameterized queries or ORM placeholders.',
    cwe: 'CWE-89',
    owasp: 'A03:2021'
  },
  {
    id: 'INJ-002',
    category: 'INJECTION',
    severity: 'CRITICAL',
    pattern: '\\$where|\\$regex\\s*:\\s*req\\.|new RegExp\\(.*req\\.',
    description: 'NoSQL injection — MongoDB operators with unsanitized input.',
    suggestion: 'Sanitize query objects and disallow $where/$regex from user input.',
    cwe: 'CWE-943',
    owasp: 'A03:2021'
  },
  {
    id: 'INJ-003',
    category: 'INJECTION',
    severity: 'CRITICAL',
    pattern: 'exec\\(|execSync\\(|spawn\\(|spawnSync\\(|child_process',
    description: 'Command injection risk — exec/spawn used with user input.',
    suggestion: 'Avoid shell execution or strictly validate/allow-list inputs.',
    cwe: 'CWE-78',
    owasp: 'A03:2021'
  },
  {
    id: 'INJ-004',
    category: 'INJECTION',
    severity: 'CRITICAL',
    pattern: '__dirname\\s*\\+\\s*req\\.(params|query)|path\\.join\\([^,]+,\\s*req\\.(params|query)',
    description: 'Path traversal — user input combined with filesystem paths.',
    suggestion: 'Normalize and validate paths; use allow-lists.',
    cwe: 'CWE-22',
    owasp: 'A01:2021'
  },
  {
    id: 'INJ-005',
    category: 'INJECTION',
    severity: 'HIGH',
    pattern: 'res\\.render\\([^,]+,\\s*req\\.(body|query|params)',
    description: 'Template injection — user input passed into template renderer.',
    suggestion: 'Sanitize inputs and use safe templating with auto-escaping.',
    cwe: 'CWE-94',
    owasp: 'A03:2021'
  },
  {
    id: 'INJ-006',
    category: 'INJECTION',
    severity: 'HIGH',
    pattern: '(fetch|axios)\\([^)]*req\\.(body|query|params)',
    description: 'SSRF — external request uses user-provided URL.',
    suggestion: 'Validate and allow-list outbound URLs; block internal IPs.',
    cwe: 'CWE-918',
    owasp: 'A10:2021'
  },
  {
    id: 'INJ-007',
    category: 'INJECTION',
    severity: 'HIGH',
    pattern: 'xml2js\\.parseString|libxmljs|DOMParser\\(',
    description: 'Potential XXE — XML parsing without disabling external entities.',
    suggestion: 'Disable external entities and DTDs when parsing XML.',
    cwe: 'CWE-611',
    owasp: 'A05:2021'
  },
  {
    id: 'INJ-008',
    category: 'INJECTION',
    severity: 'HIGH',
    scan: 'file',
    test: (ctx) => /graphql/i.test(ctx.content) && /introspection|__schema|__type/i.test(ctx.content),
    description: 'GraphQL introspection appears enabled in production code.',
    suggestion: 'Disable introspection and GraphiQL in production environments.',
    cwe: 'CWE-200',
    owasp: 'A05:2021'
  },
  {
    id: 'INJ-009',
    category: 'INJECTION',
    severity: 'MEDIUM',
    pattern: 'new RegExp\\([^)]*\\+[\'\"]\\)|/\\(.+\\)\\+/g',
    description: 'Potential ReDoS — complex regex with user input.',
    suggestion: 'Use safe regex patterns and add input length limits.',
    cwe: 'CWE-400',
    owasp: 'A03:2021'
  },
  {
    id: 'INJ-010',
    category: 'INJECTION',
    severity: 'MEDIUM',
    pattern: 'res\\.redirect\\(req\\.(query|body|params)',
    description: 'Open redirect — redirect URL derived from user input.',
    suggestion: 'Validate redirect targets with allow-lists.',
    cwe: 'CWE-601',
    owasp: 'A01:2021'
  },

  // ─── AUTH (AUTH-001~010) ────────────────────────────────
  {
    id: 'AUTH-001',
    category: 'AUTH',
    severity: 'CRITICAL',
    pattern: 'jwt\\.sign\\([^,]+,\\s*[^,]+\\s*\\)',
    description: 'JWT issued without expiration (no expiresIn).',
    suggestion: 'Set expiresIn for all JWTs.',
    cwe: 'CWE-613',
    owasp: 'A07:2021'
  },
  {
    id: 'AUTH-002',
    category: 'AUTH',
    severity: 'CRITICAL',
    pattern: 'md5\\(|sha1\\(|crypto\\.createHash\\([\'\"]sha1[\'\"]',
    description: 'Passwords hashed with MD5 or SHA1.',
    suggestion: 'Use bcrypt/argon2 with strong parameters.',
    cwe: 'CWE-916',
    owasp: 'A02:2021'
  },
  {
    id: 'AUTH-003',
    category: 'AUTH',
    severity: 'HIGH',
    pattern: 'localStorage\\.setItem\\([\'\"](jwt|token|apiKey)[\'\"]|localStorage\\.getItem\\([\'\"](jwt|token|apiKey)[\'\"]',
    description: 'JWT or API keys stored in localStorage.',
    suggestion: 'Use httpOnly secure cookies for tokens.',
    cwe: 'CWE-922',
    owasp: 'A07:2021'
  },
  {
    id: 'AUTH-004',
    category: 'AUTH',
    severity: 'HIGH',
    pattern: 'res\\.cookie\\([^,]+,\\s*[^,]+\\s*,\\s*\\{[^}]*\\}',
    description: 'Cookies set without httpOnly and secure flags.',
    suggestion: 'Always set httpOnly, secure, and sameSite flags.',
    cwe: 'CWE-614',
    owasp: 'A07:2021'
  },
  {
    id: 'AUTH-005',
    category: 'AUTH',
    severity: 'HIGH',
    scan: 'file',
    test: (ctx) => /oauth/i.test(ctx.content) && !/state/i.test(ctx.content),
    description: 'OAuth flow missing state parameter verification.',
    suggestion: 'Use state parameter to prevent CSRF in OAuth flows.',
    cwe: 'CWE-352',
    owasp: 'A01:2021'
  },
  {
    id: 'AUTH-006',
    category: 'AUTH',
    severity: 'HIGH',
    pattern: 'bcrypt\\.hash\\([^,]+,\\s*(\d|[1-9])\b',
    description: 'bcrypt rounds < 10 (too weak).',
    suggestion: 'Use bcrypt salt rounds >= 10 (prefer 12+).',
    cwe: 'CWE-916',
    owasp: 'A02:2021'
  },
  {
    id: 'AUTH-007',
    category: 'AUTH',
    severity: 'MEDIUM',
    pattern: 'expiresIn\\s*:\\s*[\'\"](8d|9d|10d|14d|30d|60d)[\'\"]',
    description: 'JWT expiration longer than 7 days.',
    suggestion: 'Use shorter token lifetimes and refresh tokens.',
    cwe: 'CWE-613',
    owasp: 'A07:2021'
  },
  {
    id: 'AUTH-008',
    category: 'AUTH',
    severity: 'MEDIUM',
    scan: 'file',
    test: (ctx) => /logout/i.test(ctx.content) && !/revoke|invalidate|blacklist/i.test(ctx.content),
    description: 'Logout endpoint without server-side token invalidation.',
    suggestion: 'Invalidate tokens server-side on logout.',
    cwe: 'CWE-613',
    owasp: 'A07:2021'
  },
  {
    id: 'AUTH-009',
    category: 'AUTH',
    severity: 'MEDIUM',
    pattern: 'if\\s*\\(\\s*token\\s*==|if\\s*\\(\\s*token\\s*===',
    description: 'Token comparison using == or === (timing attack risk).',
    suggestion: 'Use crypto.timingSafeEqual for token comparison.',
    cwe: 'CWE-208',
    owasp: 'A07:2021'
  },
  {
    id: 'AUTH-010',
    category: 'AUTH',
    severity: 'LOW',
    scan: 'file',
    test: (ctx) => /refresh token/i.test(ctx.content) && !/rotate|rotation/i.test(ctx.content),
    description: 'Refresh token rotation missing.',
    suggestion: 'Rotate refresh tokens on every use.',
    cwe: 'CWE-613',
    owasp: 'A07:2021'
  },

  // ─── DATA EXPOSURE (DATA-001~008) ───────────────────────
  {
    id: 'DATA-001',
    category: 'DATA EXPOSURE',
    severity: 'CRITICAL',
    scan: 'file',
    pathPattern: '\\.env$',
    pattern: '^[A-Z0-9_]+\\s*=',
    description: 'Committed .env file containing secrets (KEY=).',
    suggestion: 'Remove .env from repo and add to .gitignore.',
    cwe: 'CWE-200',
    owasp: 'A02:2021'
  },
  {
    id: 'DATA-002',
    category: 'DATA EXPOSURE',
    severity: 'CRITICAL',
    pattern: 'BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY',
    description: 'Private keys (RSA/SSH) detected in repository.',
    suggestion: 'Remove private keys immediately and rotate compromised keys.',
    cwe: 'CWE-312',
    owasp: 'A02:2021'
  },
  {
    id: 'DATA-003',
    category: 'DATA EXPOSURE',
    severity: 'HIGH',
    pattern: 'SELECT\\s+\\*\\s+FROM\\s+\\w+|password_hash|hashed_password',
    description: 'Password hash exposure in API response or query.',
    suggestion: 'Avoid selecting/returning password hashes to clients.',
    cwe: 'CWE-200',
    owasp: 'A02:2021'
  },
  {
    id: 'DATA-004',
    category: 'DATA EXPOSURE',
    severity: 'HIGH',
    pattern: 'console\\.log\\(.*(email|phone|ssn)|logger\\..*email',
    description: 'PII logged in plaintext.',
    suggestion: 'Redact or avoid logging PII.',
    cwe: 'CWE-532',
    owasp: 'A09:2021'
  },
  {
    id: 'DATA-005',
    category: 'DATA EXPOSURE',
    severity: 'HIGH',
    pattern: 'stack trace|/usr/|/var/|node\\s*v\\d+|express\\s*v\\d+',
    description: 'Error messages reveal internal paths or versions.',
    suggestion: 'Return generic error messages and log details server-side.',
    cwe: 'CWE-209',
    owasp: 'A05:2021'
  },
  {
    id: 'DATA-006',
    category: 'DATA EXPOSURE',
    severity: 'MEDIUM',
    scan: 'file',
    test: (ctx) => /app\.get\(/i.test(ctx.content) && /find\(\)|SELECT\s+\*/i.test(ctx.content) && !/limit|pagination|pageSize/i.test(ctx.content),
    description: 'Endpoints without pagination — potential full data dumps.',
    suggestion: 'Add pagination and limit query results.',
    cwe: 'CWE-200',
    owasp: 'A01:2021'
  },
  {
    id: 'DATA-007',
    category: 'DATA EXPOSURE',
    severity: 'MEDIUM',
    scan: 'path',
    pathPattern: '(?:^|/)(public|static|www)(?:/).*\\.(sql|bak|backup|dump)$',
    description: 'SQL/backup files exposed in public directory.',
    suggestion: 'Remove backups from public directories and protect access.',
    cwe: 'CWE-200',
    owasp: 'A05:2021'
  },
  {
    id: 'DATA-008',
    category: 'DATA EXPOSURE',
    severity: 'LOW',
    pattern: 'if\\s*\\(\\s*secret\\s*===|if\\s*\\(\\s*token\\s*===',
    description: 'Timing attack risk when comparing secrets using ===.',
    suggestion: 'Use constant-time comparisons for secrets.',
    cwe: 'CWE-208',
    owasp: 'A07:2021'
  },

  // ─── DEPENDENCIES (DEP-001~005) ─────────────────────────
  {
    id: 'DEP-001',
    category: 'DEPENDENCIES',
    severity: 'HIGH',
    pattern: 'require\\([^\)]*\$\{|require\\(.*req\\.|import\\([^\)]*\$\{',
    description: 'Dynamic require/import detected — supply chain risk.',
    suggestion: 'Use static imports and validate module names.',
    cwe: 'CWE-829',
    owasp: 'A08:2021'
  },
  {
    id: 'DEP-002',
    category: 'DEPENDENCIES',
    severity: 'HIGH',
    scan: 'file',
    pathPattern: 'package\\.json$',
    description: 'Missing lockfile (package-lock.json/yarn.lock/pnpm-lock.yaml).',
    suggestion: 'Commit a lockfile to ensure reproducible installs.',
    cwe: 'CWE-829',
    owasp: 'A08:2021'
  },
  {
    id: 'DEP-003',
    category: 'DEPENDENCIES',
    severity: 'MEDIUM',
    pattern: 'eval\\([^\)]*require\\(|eval\\([^\)]*import\\(',
    description: 'eval() used with dynamically loaded modules.',
    suggestion: 'Avoid eval and use static imports.',
    cwe: 'CWE-95',
    owasp: 'A03:2021'
  },
  {
    id: 'DEP-004',
    category: 'DEPENDENCIES',
    severity: 'MEDIUM',
    scan: 'file',
    pathPattern: 'package\\.json$',
    pattern: '"(request|node-uuid|left-pad|event-stream)"\\s*:',
    description: 'Deprecated/insecure packages detected.',
    suggestion: 'Replace deprecated packages with maintained alternatives.',
    cwe: 'CWE-829',
    owasp: 'A08:2021'
  },
  {
    id: 'DEP-005',
    category: 'DEPENDENCIES',
    severity: 'LOW',
    scan: 'file',
    pathPattern: 'package\\.json$',
    pattern: '"(dependencies|devDependencies)"[\\s\\S]*"[^"]+"\\s*:\\s*"(\\*|latest)"',
    description: 'Dependencies without pinned versions.',
    suggestion: 'Pin dependency versions for stability and security.',
    cwe: 'CWE-829',
    owasp: 'A08:2021'
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
  '.vue', '.svelte', '.env', '.json', '.sql'
]);

const severityOrder: Record<Severity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3
};

const regexCache = new Map<string, RegExp>();

function getRegex(rule: SecurityRule): RegExp | null {
  if (!rule.pattern) return null;
  const key = `${rule.id}:${rule.pattern}:${rule.flags || 'i'}`;
  const existing = regexCache.get(key);
  if (existing) return existing;
  const compiled = new RegExp(rule.pattern, rule.flags || 'i');
  regexCache.set(key, compiled);
  return compiled;
}

function findLineOf(lines: string[], regex: RegExp): number | undefined {
  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) return i + 1;
  }
  return undefined;
}

function addHit(
  ruleHits: Map<string, { file: string; line: number; count: number }>,
  rule: SecurityRule,
  file: string,
  line: number | undefined
): void {
  const lineNum = line ?? 1;
  const existing = ruleHits.get(rule.id);
  if (!existing) {
    ruleHits.set(rule.id, { file, line: lineNum, count: 1 });
  } else {
    existing.count++;
  }
}

function calculateScore(summary: { critical: number; high: number; medium: number; low: number }): number {
  const base = 100 - (summary.critical * 20) - (summary.high * 10) - (summary.medium * 4) - (summary.low * 1);
  let score = Math.max(0, base);
  if (score >= 90 && summary.critical === 0 && summary.high === 0) {
    score = Math.min(100, score + 10);
  }
  return score;
}

function getGrade(score: number): ScanResult['grade'] {
  if (score >= 95) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

function getVerdict(score: number, summary: { critical: number; high: number }): string {
  let verdict: string;
  if (score >= 90) verdict = 'Fort Knox level security. Ship it.';
  else if (score >= 70) verdict = 'Solid foundation. A few cracks to patch.';
  else if (score >= 50) verdict = 'Moderate risk. Fix the highs before launch.';
  else if (score >= 30) verdict = 'Vibe-coded danger zone. Multiple attack vectors open.';
  else verdict = 'Your app is a honeypot waiting to happen. Do not ship.';

  if (summary.critical > 0) verdict = `🚨 ${verdict}`;
  if (summary.critical === 0 && summary.high === 0) verdict = `${verdict} ✅`;
  return verdict;
}

export class RepoScanner {
  private fileCount = 0;

  public async scanDirectory(targetPath: string): Promise<ScanResult> {
    this.fileCount = 0;

    const allFiles: string[] = [];
    await this.walkDir(targetPath, allFiles);

    const ruleHits = new Map<string, { file: string; line: number; count: number }>();

    const lockfiles = {
      'package-lock.json': false,
      'yarn.lock': false,
      'pnpm-lock.yaml': false
    };

    for (const filePath of allFiles) {
      const relativePath = filePath.replace(/.*\/repo\//, '');
      if (relativePath.endsWith('package-lock.json')) lockfiles['package-lock.json'] = true;
      if (relativePath.endsWith('yarn.lock')) lockfiles['yarn.lock'] = true;
      if (relativePath.endsWith('pnpm-lock.yaml')) lockfiles['pnpm-lock.yaml'] = true;

      await this.analyzeFile(filePath, relativePath, ruleHits);
      this.fileCount++;
    }

    // DEP-002: only emit if package.json exists and no lockfile found
    const packageJsonFound = allFiles.some(f => f.endsWith('package.json'));
    if (packageJsonFound && !lockfiles['package-lock.json'] && !lockfiles['yarn.lock'] && !lockfiles['pnpm-lock.yaml']) {
      const depRule = SECURITY_RULES.find(r => r.id === 'DEP-002');
      if (depRule) addHit(ruleHits, depRule, 'package.json', 1);
    }

    console.log(`[VibeCheck] Scanned ${this.fileCount} files, ${ruleHits.size} rules triggered`);

    const issues: ScanIssue[] = Array.from(ruleHits.entries())
      .map(([ruleId, hit]) => {
        const rule = SECURITY_RULES.find(r => r.id === ruleId)!;
        return {
          severity: rule.severity,
          ruleId: rule.id,
          category: rule.category,
          description: rule.description,
          file: hit.file,
          line: hit.line,
          suggestion: rule.suggestion,
          affectedFiles: hit.count,
          cwe: rule.cwe,
          owasp: rule.owasp
        };
      })
      .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const summary = {
      critical: issues.filter(i => i.severity === 'CRITICAL').length,
      high: issues.filter(i => i.severity === 'HIGH').length,
      medium: issues.filter(i => i.severity === 'MEDIUM').length,
      low: issues.filter(i => i.severity === 'LOW').length
    };

    const categories: Record<string, number> = {};
    for (const issue of issues) {
      categories[issue.category] = (categories[issue.category] || 0) + 1;
    }

    const score = calculateScore(summary);
    const grade = getGrade(score);
    const topRisks = issues
      .filter(i => i.severity === 'CRITICAL' || i.severity === 'HIGH')
      .slice(0, 3)
      .map(i => i.description);

    const verdict = getVerdict(score, { critical: summary.critical, high: summary.high });

    return {
      issues,
      score,
      grade,
      summary,
      categories,
      filesScanned: this.fileCount,
      topRisks,
      verdict
    };
  }

  private async walkDir(dir: string, files: string[]): Promise<void> {
    let entries: string[];
    try { entries = await fs.promises.readdir(dir); } catch { return; }

    for (const entry of entries) {
      if (SKIP_FILES.has(entry)) continue;
      const fullPath = path.join(dir, entry);
      let stat;
      try { stat = await fs.promises.stat(fullPath); } catch { continue; }

      if (stat.isDirectory()) {
        if (!SKIP_DIRS.has(entry)) await this.walkDir(fullPath, files);
      } else {
        const ext = path.extname(entry).toLowerCase();
        if (ANALYZABLE_EXTS.has(ext) && stat.size < 300000) {
          files.push(fullPath);
        }
      }
    }
  }

  private async analyzeFile(
    filePath: string,
    relativePath: string,
    ruleHits: Map<string, { file: string; line: number; count: number }>
  ): Promise<void> {
    let content: string;
    try { content = await fs.promises.readFile(filePath, 'utf-8'); } catch { return; }

    const lines = content.split('\n');
    const ctx: RuleContext = { content, lines, relativePath };

    for (const rule of SECURITY_RULES) {
      if (rule.scan === 'path') {
        if (rule.pathPattern && new RegExp(rule.pathPattern, 'i').test(relativePath)) {
          addHit(ruleHits, rule, relativePath, 1);
        }
        continue;
      }

      if (rule.fileExtensions && !rule.fileExtensions.some(ext => relativePath.endsWith(ext))) continue;
      if (rule.pathPattern && !new RegExp(rule.pathPattern, 'i').test(relativePath)) continue;

      if (rule.test) {
        if (rule.test(ctx)) {
          const lineHint = rule.linePattern ? findLineOf(lines, new RegExp(rule.linePattern, 'i')) : 1;
          addHit(ruleHits, rule, relativePath, lineHint);
        }
        continue;
      }

      const regex = getRegex(rule);
      if (!regex) continue;

      if (rule.scan === 'file') {
        if (regex.test(content)) {
          const lineHint = findLineOf(lines, regex) ?? 1;
          addHit(ruleHits, rule, relativePath, lineHint);
        }
        continue;
      }

      // Default: line scan
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('//') || trimmed.startsWith('#') ||
          trimmed.startsWith('*') || trimmed.startsWith('/*') ||
          trimmed.startsWith('<!--')) continue;

        if (regex.test(lines[i])) {
          addHit(ruleHits, rule, relativePath, i + 1);
        }
      }
    }
  }
}
