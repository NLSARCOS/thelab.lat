// VibeCheck Security SaaS - PRODUCTION ENGINE
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import crypto from 'crypto';
import { Resend } from 'resend';

dotenv.config();

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 8000;
const JWT_SECRET = process.env.JWT_SECRET || 'vibecheck_vault_2026_thelab';
const SCANNER_URL = process.env.SCANNER_URL || 'http://localhost:8080';
const DODO_API_KEY = process.env.DODO_API_KEY;
const DODO_API_BASE_URL = process.env.DODO_API_BASE_URL || 'https://live.dodopayments.com';
const DODO_WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET || '';
const DODO_PRODUCT_PRO = process.env.DODO_PRODUCT_ID_PRO || 'pdt_0NZj2DutZn8PUCeM0aki0';
const DODO_PRODUCT_SHIELD = process.env.DODO_PRODUCT_ID_SHIELD || 'pdt_0NZj2Dy10bTfszHYGCQ1v';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://vibecheck.thelab.lat';
const resend = new Resend(process.env.RESEND_API_KEY || 'placeholder_key_not_configured');
const MAIL_FROM = 'VibeCheck Security <security@thelab.lat>';

app.use(cors());

// ─── RATE LIMITING (in-memory) ────────────────────────────
const rateLimits = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimits.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

function getClientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

app.use(express.json());

// ─── AUTH MIDDLEWARE ─────────────────────────────────────────
interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

type JsonRecord = Record<string, any>;

function sendError(res: Response, status: number, message: string, details?: unknown) {
  return res.status(status).json({
    success: false,
    error: message,
    ...(details ? { details } : {})
  });
}

function parseJsonSafely(input: string) {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

async function sendEmailSafe(payload: { to: string; subject: string; html: string; text?: string }) {
  try {
    await resend.emails.send({
      from: MAIL_FROM,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text
    });
  } catch (error: any) {
    console.error('[EMAIL ERROR]', error?.message || error);
  }
}

// ─── EMAIL TEMPLATES (VibeCheck style: negro/verde, Space Grotesk) ─────────

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #09090B; font-family: 'Space Grotesk', Arial, sans-serif; color: #E4E4E7; }
    .container { max-width: 620px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #18181B; border: 1px solid #27272A; border-radius: 16px; padding: 40px; }
    .logo-bar { text-align: center; margin-bottom: 32px; }
    .logo-accent { color: #4ADE80; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
    .logo-sub { color: #52525B; font-size: 13px; margin-top: 4px; }
    h1 { font-size: 24px; font-weight: 700; color: #FAFAFA; margin-bottom: 16px; }
    h2 { font-size: 18px; font-weight: 600; color: #FAFAFA; margin-bottom: 12px; }
    p { color: #A1A1AA; line-height: 1.6; margin-bottom: 16px; }
    .highlight { color: #4ADE80; font-weight: 600; }
    .btn { display: inline-block; background: #4ADE80; color: #09090B; font-weight: 700;
           font-size: 15px; padding: 14px 28px; border-radius: 100px;
           text-decoration: none; margin: 8px 0; }
    .btn-outline { display: inline-block; background: transparent; color: #4ADE80;
                   border: 1px solid #4ADE80; font-weight: 600; font-size: 14px;
                   padding: 10px 20px; border-radius: 100px; text-decoration: none; }
    .box { background: #09090B; border: 1px solid #27272A; border-radius: 12px;
           padding: 20px 24px; margin: 20px 0; }
    .box-green { background: #052e16; border: 1px solid #166534; border-radius: 12px;
                 padding: 20px 24px; margin: 20px 0; }
    .box-red { background: #1c0202; border: 1px solid #7f1d1d; border-radius: 12px;
               padding: 20px 24px; margin: 20px 0; }
    .code-block { background: #09090B; border: 1px solid #3f3f46; border-radius: 8px;
                  padding: 12px 16px; font-family: monospace; font-size: 13px;
                  color: #4ADE80; margin: 12px 0; word-break: break-all; }
    .stat-row { display: flex; gap: 12px; margin: 16px 0; }
    .stat-box { flex: 1; background: #09090B; border: 1px solid #27272A;
                border-radius: 10px; padding: 16px; text-align: center; }
    .stat-num { font-size: 28px; font-weight: 700; color: #FAFAFA; }
    .stat-label { font-size: 12px; color: #71717A; margin-top: 4px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 100px; font-size: 12px; font-weight: 600; }
    .badge-green { background: #052e16; color: #4ADE80; border: 1px solid #166534; }
    .badge-red { background: #1c0202; color: #f87171; border: 1px solid #7f1d1d; }
    .badge-yellow { background: #1c1202; color: #fbbf24; border: 1px solid #78350f; }
    .divider { border: none; border-top: 1px solid #27272A; margin: 28px 0; }
    .footer { text-align: center; margin-top: 28px; }
    .footer p { font-size: 12px; color: #52525B; }
    .footer a { color: #4ADE80; text-decoration: none; }
    ul.feature-list { list-style: none; padding: 0; }
    ul.feature-list li { color: #A1A1AA; padding: 6px 0; padding-left: 20px; position: relative; }
    ul.feature-list li::before { content: "✓"; color: #4ADE80; position: absolute; left: 0; font-weight: 700; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo-bar">
      <div class="logo-accent">⚡ VibeCheck Security</div>
      <div class="logo-sub">by TheLab.lat</div>
    </div>
    <div class="card">
      ${content}
    </div>
    <div class="footer">
      <p>VibeCheck Security · <a href="mailto:security@thelab.lat">security@thelab.lat</a></p>
      <p style="margin-top:6px;">© 2026 TheLab.lat · All rights reserved</p>
    </div>
  </div>
</body>
</html>`;
}

function welcomeEmailTemplate(nameOrEmail: string) {
  return emailWrapper(`
    <h1>Welcome to VibeCheck 🎉</h1>
    <p>Hi <span class="highlight">${nameOrEmail}</span>,</p>
    <p>Your account is active and you're ready to start securing your repositories. Let's catch some vulnerabilities.</p>
    <div class="box-green">
      <h2>🚀 Run your first scan</h2>
      <p style="margin-bottom:8px;">Paste this in your terminal:</p>
      <div class="code-block">npx vibecheck scan https://github.com/your/repo</div>
      <p style="margin-bottom:0;font-size:13px;">Or use the dashboard to scan any public GitHub repository instantly.</p>
    </div>
    <div class="box">
      <h2>What you can do now</h2>
      <ul class="feature-list">
        <li>Run unlimited public repository scans</li>
        <li>Detect secrets, CVEs, misconfigurations &amp; more</li>
        <li>Get a security score + letter grade (A–F)</li>
        <li>Generate API keys for CI/CD pipelines</li>
      </ul>
    </div>
    <a href="${FRONTEND_URL}/dashboard" class="btn">Open Dashboard →</a>
    <hr class="divider">
    <p style="font-size:13px;color:#52525B;">Need help? Reply to this email or visit our docs.</p>
  `);
}

function resetPasswordEmailTemplate(resetUrl: string) {
  return emailWrapper(`
    <h1>Reset your password 🔐</h1>
    <p>We received a request to reset the password for your VibeCheck account.</p>
    <div class="box">
      <p style="margin-bottom:12px;">Click the button below to choose a new password. This link expires in <span class="highlight">1 hour</span>.</p>
      <a href="${resetUrl}" class="btn">Reset Password →</a>
    </div>
    <p style="font-size:13px;color:#52525B;">If you didn't request this, you can safely ignore this email. Your account is secure.</p>
  `);
}

function scanReportEmailTemplate(params: {
  repoUrl: string;
  issuesFound: number;
  criticalFound: number;
  reportId: string;
  score?: number;
  grade?: string;
}) {
  const score = params.score ?? Math.max(0, 100 - params.issuesFound * 3 - params.criticalFound * 10);
  const grade = params.grade ?? (score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 45 ? 'D' : 'F');
  const gradeColor = grade === 'A' ? '#4ADE80' : grade === 'B' ? '#86efac' : grade === 'C' ? '#fbbf24' : grade === 'D' ? '#f97316' : '#f87171';
  const statusBadge = params.criticalFound > 0
    ? `<span class="badge badge-red">⚠ ${params.criticalFound} Critical</span>`
    : `<span class="badge badge-green">✓ No Critical Issues</span>`;

  return emailWrapper(`
    <h1>Scan Complete 🔍</h1>
    <p>Your security scan finished. Here's the summary:</p>
    <div class="box" style="text-align:center;">
      <div style="font-size:64px;font-weight:700;color:${gradeColor};line-height:1;">${grade}</div>
      <div style="font-size:14px;color:#71717A;margin-top:4px;">Security Grade</div>
      <div style="font-size:28px;font-weight:700;color:#FAFAFA;margin-top:12px;">${score}<span style="font-size:16px;color:#71717A;">/100</span></div>
      <div style="font-size:13px;color:#71717A;margin-top:2px;">Security Score</div>
      <div style="margin-top:12px;">${statusBadge}</div>
    </div>
    <div class="box">
      <p style="font-size:13px;color:#71717A;margin-bottom:8px;">REPOSITORY</p>
      <div class="code-block" style="font-size:12px;">${params.repoUrl}</div>
      <div style="display:flex;gap:16px;margin-top:12px;">
        <div style="flex:1;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#FAFAFA;">${params.issuesFound}</div>
          <div style="font-size:12px;color:#71717A;">Total Issues</div>
        </div>
        <div style="flex:1;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:${params.criticalFound > 0 ? '#f87171' : '#4ADE80'};">${params.criticalFound}</div>
          <div style="font-size:12px;color:#71717A;">Critical</div>
        </div>
      </div>
    </div>
    <a href="${FRONTEND_URL}/dashboard/scans/${params.reportId}" class="btn">View Full Report →</a>
  `);
}

function cancellationEmailTemplate(name: string, cancelAt: Date) {
  const date = cancelAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return emailWrapper(`
    <h1>Subscription Cancelled 😢</h1>
    <p>Hi <span class="highlight">${name}</span>,</p>
    <p>We've received your cancellation request. Your subscription has been successfully cancelled.</p>
    <div class="box">
      <p style="font-size:13px;color:#71717A;margin-bottom:4px;">ACCESS ENDS ON</p>
      <p style="font-size:20px;font-weight:700;color:#FAFAFA;margin-bottom:0;">${date}</p>
      <p style="font-size:13px;color:#A1A1AA;margin-top:8px;margin-bottom:0;">You'll continue to have full access to your plan until this date.</p>
    </div>
    <div class="box-red">
      <h2 style="color:#f87171;">Before you go…</h2>
      <p style="margin-bottom:0;">After cancellation, your account will revert to the <span class="highlight">Free plan</span>. Your scan history will be preserved.</p>
    </div>
    <p>Changed your mind? You can resubscribe any time from your dashboard.</p>
    <a href="${FRONTEND_URL}/pricing" class="btn-outline">Resubscribe</a>
    <hr class="divider">
    <p style="font-size:13px;color:#52525B;">We'd love to know why you cancelled. Reply to this email — your feedback shapes our roadmap.</p>
  `);
}

function subscriptionRenewedTemplate(name: string, plan: string) {
  const planFeatures: Record<string, string[]> = {
    pro: ['Private repo scanning', 'GitHub Actions integration', 'Auto-fix suggestions', 'Email alerts', 'API access'],
    shield: ['All Pro features', 'WAF — blocks SQLi, XSS, LLM injection', 'Honeypot trap system', 'Anti-spam protection', 'IP Blocker — Tor + scanner ranges', 'Real-time threat dashboard']
  };
  const features = planFeatures[plan] || ['Unlimited scans', 'API access'];
  const featureItems = features.map(f => `<li>${f}</li>`).join('');

  return emailWrapper(`
    <h1>Subscription Renewed ✅</h1>
    <p>Hi <span class="highlight">${name}</span>,</p>
    <p>Your <span class="highlight">${plan.toUpperCase()}</span> subscription has been successfully renewed for another month.</p>
    <div class="box-green">
      <h2>🛡️ Your active features</h2>
      <ul class="feature-list">
        ${featureItems}
      </ul>
    </div>
    <a href="${FRONTEND_URL}/dashboard" class="btn">Go to Dashboard →</a>
    <hr class="divider">
    <p style="font-size:13px;color:#52525B;">Questions about your billing? Reply to this email and we'll sort it out.</p>
  `);
}

function formatScanReport(reportJson: JsonRecord) {
  const issues = Array.isArray(reportJson?.issues) ? reportJson.issues : [];
  const severityBuckets: Record<string, number> = issues.reduce((acc: Record<string, number>, issue: any) => {
    const key = String(issue?.severity || 'UNKNOWN').toUpperCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const groupedByType: Record<string, any[]> = issues.reduce((acc: Record<string, any[]>, issue: any) => {
    const key = String(issue?.type || issue?.category || 'GENERAL');
    if (!acc[key]) acc[key] = [];
    acc[key].push({
      severity: issue?.severity || 'UNKNOWN',
      title: issue?.title || issue?.rule || 'Unnamed issue',
      description: issue?.description || issue?.message || null,
      location: issue?.location || issue?.file || null,
      recommendation: issue?.recommendation || issue?.fix || null
    });
    return acc;
  }, {});

  return {
    summary: {
      totalIssues: reportJson?.totalIssues ?? issues.length,
      criticalIssues: reportJson?.criticalIssues ?? (severityBuckets.CRITICAL || 0),
      scannedAt: reportJson?.scannedAt || reportJson?.timestamp || null
    },
    severities: severityBuckets,
    sections: Object.entries(groupedByType).map(([section, items]) => ({ section, count: items.length, items })),
    raw: reportJson
  };
}

function getPackageFromMetadata(metadata: JsonRecord | undefined, fallbackPackageId?: string) {
  const packageId = metadata?.packageId || metadata?.package_id || fallbackPackageId;
  return packageId && PACKAGES[packageId] ? { id: packageId, ...PACKAGES[packageId] } : null;
}

async function createDodoCheckout(args: {
  userId: string;
  userEmail: string;
  userName?: string | null;
  packageId: string;
  successUrl: string;
}) {
  const selectedPackage = PACKAGES[args.packageId];
  if (!selectedPackage) {
    return { ok: false, status: 400, error: 'Invalid package' as const };
  }

  if (!DODO_API_KEY) {
    return { ok: false, status: 500, error: 'Payment not configured' as const };
  }

  const productMap: Record<string, string> = {
    pro: DODO_PRODUCT_PRO,
    shield: DODO_PRODUCT_SHIELD
  };

  const configuredProductId = productMap[args.packageId];
  const metadata = {
    userId: args.userId,
    packageId: args.packageId,
    plan: selectedPackage.plan
  };

  const headers = {
    Authorization: `Bearer ${DODO_API_KEY}`,
    'Content-Type': 'application/json'
  };

  if (configuredProductId) {
    let dodoCusId: string | null = null;
    try {
      const cusRes = await axios.post(`${DODO_API_BASE_URL}/customers`, {
        email: args.userEmail,
        name: args.userName || args.userEmail,
        metadata: { internal_user_id: args.userId }
      }, { headers, timeout: 10000 });
      dodoCusId = cusRes.data?.customer_id || null;
    } catch (e: any) {
      console.log('[CHECKOUT] Customer note:', e?.response?.data?.message || 'proceeding without customer_id');
    }

    const checkoutBody: Record<string, any> = {
      product_cart: [{ product_id: configuredProductId, quantity: 1 }],
      metadata,
      return_url: args.successUrl,
      brand_id: 'brnd_0NZj0uteGnPWKyJ1QO5I8'
    };

    if (dodoCusId) {
      checkoutBody.customer = { customer_id: dodoCusId };
    }

    const response = await axios.post(`${DODO_API_BASE_URL}/checkouts`, checkoutBody, { headers, timeout: 15000 });
    const checkoutUrl = response.data?.checkout_url || response.data?.payment_link || response.data?.url;
    if (!checkoutUrl) throw new Error('Dodo checkout URL missing in response');
    return { ok: true, checkoutUrl };
  }

  const fallbackResponse = await axios.post(
    `${DODO_API_BASE_URL}/v1/checkouts`,
    {
      amount: selectedPackage.price,
      currency: 'USD',
      name: selectedPackage.name,
      customer_id: args.userId,
      metadata,
      redirect_url: args.successUrl
    },
    { headers, timeout: 15000 }
  );

  const fallbackUrl = fallbackResponse.data?.checkout_url || fallbackResponse.data?.payment_link || fallbackResponse.data?.url;
  if (!fallbackUrl) throw new Error('Dodo fallback checkout URL missing in response');
  return { ok: true, checkoutUrl: fallbackUrl };
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return sendError(res, 401, 'No token');
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as any;
    req.userId = payload.userId;
    req.userRole = payload.role;
    next();
  } catch {
    return sendError(res, 401, 'Invalid token');
  }
}

function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'ADMIN') return sendError(res, 403, 'Forbidden');
  next();
}

// API Key auth (for programmatic access)
async function apiKeyMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const key = req.headers['x-api-key'] as string;
    if (!key) return authMiddleware(req, res, next);
    const apiKey = await prisma.apiKey.findUnique({ where: { key } });
    if (!apiKey || !apiKey.active) return sendError(res, 401, 'Invalid API key');
    await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsed: new Date() } });
    req.userId = apiKey.userId;
    next();
  } catch (error: any) {
    console.error('[API KEY ERROR]', error?.message || error);
    return sendError(res, 500, 'Authentication service error');
  }
}

// ─── RATE LIMIT MIDDLEWARE ───────────────────────────────────
function registerLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`register-mw:${ip}`, 5, 60 * 60 * 1000)) {
    return sendError(res, 429, 'Too many registration attempts. Try again in 1 hour.');
  }
  next();
}
function loginLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`login-mw:${ip}`, 10, 15 * 60 * 1000)) {
    return sendError(res, 429, 'Too many login attempts. Try again in 15 minutes.');
  }
  next();
}

// ─── AUTH ROUTES ────────────────────────────────────────────
app.post('/api/auth/register', registerLimiter, async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  if (!checkRateLimit(`register:${ip}`, 5, 60 * 60 * 1000)) {
    return sendError(res, 429, 'Too many registration attempts. Try again in 1 hour.');
  }
  const { email, password, name } = req.body;
  if (!email || !password) return sendError(res, 400, 'Email and password required');
  if (typeof password !== 'string' || password.length < 8) return sendError(res, 400, 'Password must be at least 8 characters');
  if (typeof email !== 'string' || !email.includes('@')) return sendError(res, 400, 'Invalid email format');
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role: 'USER', credits: 5, plan: 'free' }
    });
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    void sendEmailSafe({
      to: user.email,
      subject: 'Welcome to VibeCheck Security',
      html: welcomeEmailTemplate(user.name || user.email),
      text: `Welcome to VibeCheck Security, ${user.name || user.email}. Your account is ready.`
    });
    res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role, credits: user.credits } });
  } catch (e: any) {
    if (String(e?.code || '').includes('P2002')) return sendError(res, 400, 'Email already exists');
    return sendError(res, 500, 'Unable to register user');
  }
});

app.post('/api/auth/login', loginLimiter, async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  if (!checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000)) {
    return sendError(res, 429, 'Too many login attempts. Try again in 15 minutes.');
  }
  try {
    const { email, password } = req.body;
    if (!email || !password) return sendError(res, 400, 'Email and password required');
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && await bcrypt.compare(password, user.passwordHash)) {
      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role, credits: user.credits } });
    }
    return sendError(res, 401, 'Invalid credentials');
  } catch (error: any) {
    console.error('[LOGIN ERROR]', error?.message || error);
    return sendError(res, 500, 'Unable to login');
  }
});

app.get('/api/auth/me', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true, name: true, email: true, role: true, credits: true,
        plan: true, subscriptionStatus: true, cancelAt: true, trialEndsAt: true, createdAt: true
      }
    });
    if (!user) return sendError(res, 404, 'User not found');
    return res.json({ user });
  } catch (error: any) {
    console.error('[AUTH ME ERROR]', error?.message || error);
    return sendError(res, 500, 'Unable to fetch user profile');
  }
});

// 2B. Update name
app.put('/api/auth/me', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length < 1) {
      return sendError(res, 400, 'name is required');
    }
    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: { name: name.trim() },
      select: { id: true, name: true, email: true, role: true, credits: true, plan: true }
    });
    return res.json({ success: true, user });
  } catch (error: any) {
    console.error('[UPDATE ME ERROR]', error?.message || error);
    return sendError(res, 500, 'Unable to update profile');
  }
});

// 2B. Delete account (GDPR)
app.delete('/api/auth/me', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    // Delete in cascade order
    await prisma.apiKey.deleteMany({ where: { userId } });
    await prisma.shieldLog.deleteMany({ where: { userId } });
    await prisma.auditReport.deleteMany({ where: { userId } });
    await prisma.repository.deleteMany({ where: { ownerId: userId } });
    await prisma.organization.deleteMany({ where: { ownerId: userId } });
    await prisma.user.delete({ where: { id: userId } });
    return res.json({ success: true });
  } catch (error: any) {
    console.error('[DELETE ME ERROR]', error?.message || error);
    return sendError(res, 500, 'Unable to delete account');
  }
});

app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return sendError(res, 400, 'Email required');

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = jwt.sign(
        { userId: user.id, purpose: 'password_reset' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );
      const resetUrl = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
      void sendEmailSafe({
        to: user.email,
        subject: 'Reset your VibeCheck password',
        html: resetPasswordEmailTemplate(resetUrl),
        text: `Reset your password: ${resetUrl} (expires in 1 hour)`
      });
    }

    return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (error: any) {
    console.error('[FORGOT PASSWORD ERROR]', error?.message || error);
    return sendError(res, 500, 'Unable to process forgot password request');
  }
});

app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return sendError(res, 400, 'token and password required');
    if (String(password).length < 8) return sendError(res, 400, 'Password must be at least 8 characters');

    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload?.purpose !== 'password_reset' || !payload?.userId) return sendError(res, 400, 'Invalid reset token');

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: payload.userId as string },
      data: { passwordHash }
    });

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (error: any) {
    if (error?.name === 'TokenExpiredError') return sendError(res, 400, 'Reset token expired');
    console.error('[RESET PASSWORD ERROR]', error?.message || error);
    return sendError(res, 400, 'Invalid or expired reset token');
  }
});

// ─── CREDITS ────────────────────────────────────────────────
app.get('/api/credits/balance', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { credits: true } });
    return res.json({ credits: user?.credits ?? 0 });
  } catch (error: any) {
    console.error('[CREDITS ERROR]', error?.message || error);
    return sendError(res, 500, 'Unable to fetch credits');
  }
});

// ─── SCANS (2A) ───────────────────────────────────────────
app.get('/api/scans', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
    const skip = (page - 1) * limit;

    const [scans, total] = await Promise.all([
      prisma.auditReport.findMany({
        where: { userId: req.userId! },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true, repoUrl: true, issuesFound: true, criticalFound: true, createdAt: true
        }
      }),
      prisma.auditReport.count({ where: { userId: req.userId! } })
    ]);

    return res.json({
      scans,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error: any) {
    console.error('[SCANS LIST ERROR]', error?.message || error);
    return sendError(res, 500, 'Unable to fetch scans');
  }
});

app.get('/api/scans/:id', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const scanId = String(req.params.id);
    const scan = await prisma.auditReport.findFirst({
      where: { id: scanId, userId: req.userId! }
    });
    if (!scan) return sendError(res, 404, 'Scan not found');

    const parsedJson = parseJsonSafely(scan.fullJson);
    return res.json({
      scan: {
        ...scan,
        fullJson: undefined,
        result: parsedJson,
        formatted: parsedJson ? formatScanReport(parsedJson) : null
      }
    });
  } catch (error: any) {
    console.error('[SCAN DETAIL ERROR]', error?.message || error);
    return sendError(res, 500, 'Unable to fetch scan');
  }
});

app.delete('/api/scans/:id', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const scanId = String(req.params.id);
    const deleted = await prisma.auditReport.deleteMany({
      where: { id: scanId, userId: req.userId! }
    });
    if (deleted.count === 0) return sendError(res, 404, 'Scan not found');
    return res.json({ success: true });
  } catch (error: any) {
    console.error('[SCAN DELETE ERROR]', error?.message || error);
    return sendError(res, 500, 'Unable to delete scan');
  }
});

// ─── SCAN (CORE PRODUCT) ───────────────────────────────────
app.post('/api/scan', apiKeyMiddleware as any, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const dayKey = `scan:${userId}:${new Date().toISOString().slice(0, 10)}`;
  if (!checkRateLimit(dayKey, 20, 24 * 60 * 60 * 1000)) {
    return sendError(res, 429, 'Daily scan limit reached (20/day). Upgrade your plan for more.');
  }
  try {
    const { repoUrl } = req.body;
    if (!repoUrl) return sendError(res, 400, 'repoUrl required');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return sendError(res, 404, 'User not found');
    if (user.credits !== -1 && user.credits <= 0) {
      return sendError(res, 402, 'No credits remaining. Purchase more at /pricing');
    }

    const scanResult = await axios.post(`${SCANNER_URL}/v1/scanner/audit`, { repoUrl }, { timeout: 120000 });
    const result = scanResult.data;

    if (user.credits !== -1) {
      await prisma.user.update({ where: { id: userId }, data: { credits: { decrement: 1 } } });
    }

    const report = await prisma.auditReport.create({
      data: {
        userId,
        repoUrl,
        issuesFound: result.totalIssues || result.issues?.length || 0,
        criticalFound: result.criticalIssues || result.issues?.filter((i: any) => i.severity === 'CRITICAL')?.length || 0,
        fullJson: JSON.stringify(result)
      }
    });

    void sendEmailSafe({
      to: user.email,
      subject: 'VibeCheck scan report is ready',
      html: scanReportEmailTemplate({
        repoUrl,
        issuesFound: report.issuesFound,
        criticalFound: report.criticalFound,
        reportId: report.id
      }),
      text: `Scan complete for ${repoUrl}. Issues: ${report.issuesFound}. Critical: ${report.criticalFound}.`
    });

    const creditsRemaining = user.credits === -1 ? -1 : user.credits - 1;
    return res.json({
      success: true,
      reportId: report.id,
      summary: {
        issuesFound: report.issuesFound,
        criticalFound: report.criticalFound,
        plan: user?.plan || 'free',
        creditsRemaining
      },
      details: result
    });
  } catch (e: any) {
    console.error('[SCAN ERROR]', e.message);
    return sendError(res, 500, 'Scanner engine unavailable. Try again later.');
  }
});

// ─── SHIELD API ─────────────────────────────────────────────

app.post('/api/shield/key', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { plan: true, email: true } });
    if (!user) return sendError(res, 404, 'User not found');
    if (user.plan !== 'shield' && user.plan !== 'pro') {
      return sendError(res, 403, 'Shield plan required. Upgrade at /pricing-plans');
    }
    const raw = 'shld_live_' + crypto.randomBytes(24).toString('hex');
    const existing = await prisma.apiKey.findFirst({ where: { userId: req.userId!, name: 'Shield API Key' } });
    if (existing) {
      await prisma.apiKey.update({ where: { id: existing.id }, data: { key: raw } });
      return res.json({ success: true, key: raw, message: 'Key rotated' });
    }
    await prisma.apiKey.create({ data: { userId: req.userId!, name: 'Shield API Key', key: raw } });
    return res.json({ success: true, key: raw });
  } catch (e: any) {
    console.error('[SHIELD KEY ERROR]', e?.message);
    return sendError(res, 500, 'Cannot generate shield key');
  }
});

app.get('/api/shield/validate', async (req: Request, res: Response) => {
  try {
    const key = req.headers['x-shield-key'] as string || req.query.key as string;
    if (!key) return res.status(401).json({ valid: false, error: 'No key provided' });

    const apiKey = await prisma.apiKey.findUnique({ where: { key } });
    if (!apiKey || !apiKey.active) return res.status(401).json({ valid: false, error: 'Invalid key' });

    const user = await prisma.user.findUnique({ where: { id: apiKey.userId }, select: { plan: true, id: true } });
    if (!user) return res.status(401).json({ valid: false, error: 'User not found' });

    await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsed: new Date() } });

    const isShield = user.plan === 'shield';
    const isPro = user.plan === 'pro' || isShield;

    return res.json({
      valid: true,
      plan: user.plan || 'free',
      userId: user.id,
      features: {
        waf: isShield,
        honeypot: isShield,
        antispam: isShield,
        rateLimit: isPro || isShield,
        ipBlocker: isShield,
        metrics: isPro || isShield,
      }
    });
  } catch (e: any) {
    console.error('[SHIELD VALIDATE ERROR]', e?.message);
    return res.status(500).json({ valid: false, error: 'Validation service error' });
  }
});

app.post('/api/shield/events', async (req: Request, res: Response) => {
  try {
    const key = req.headers['x-shield-key'] as string;
    if (!key) return res.status(401).json({ error: 'No key' });

    const apiKey = await prisma.apiKey.findUnique({ where: { key } });
    if (!apiKey || !apiKey.active) return res.status(401).json({ error: 'Invalid key' });

    const events = Array.isArray(req.body) ? req.body : [req.body];
    for (const ev of events.slice(0, 100)) {
      await prisma.shieldLog.create({
        data: {
          userId: apiKey.userId,
          promptPreview: `${ev.type || 'unknown'} — ${ev.path || '/'}`,
          riskScore: ev.score || 0,
          status: ev.blocked ? 'BLOCKED' : 'ALLOWED',
          ruleMatched: ev.rule || ev.type || null,
        }
      }).catch(() => { });
    }
    return res.json({ received: events.length });
  } catch (e: any) {
    console.error('[SHIELD EVENTS ERROR]', e?.message);
    return res.status(500).json({ error: 'Events error' });
  }
});

app.get('/api/shield/stats', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const [total, blocked, recent] = await Promise.all([
      prisma.shieldLog.count({ where: { userId: req.userId! } }),
      prisma.shieldLog.count({ where: { userId: req.userId!, status: 'BLOCKED' } }),
      prisma.shieldLog.findMany({
        where: { userId: req.userId! },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { promptPreview: true, riskScore: true, status: true, ruleMatched: true, createdAt: true }
      })
    ]);

    const shieldKey = await prisma.apiKey.findFirst({
      where: { userId: req.userId!, name: 'Shield API Key', active: true },
      select: { key: true, lastUsed: true }
    });

    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { plan: true } });

    return res.json({
      plan: user?.plan || 'free',
      hasShieldKey: !!shieldKey,
      shieldKeyLastUsed: shieldKey?.lastUsed || null,
      shieldActive: !!shieldKey?.lastUsed,
      stats: { total, blocked, allowed: total - blocked },
      recent
    });
  } catch (e: any) {
    console.error('[SHIELD STATS ERROR]', e?.message);
    return sendError(res, 500, 'Cannot fetch shield stats');
  }
});

app.post('/api/shield/activate', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { plan: true } });
    if (!user) return sendError(res, 404, 'User not found');
    return res.json({ success: true, plan: user.plan });
  } catch (e: any) {
    return sendError(res, 500, 'Error');
  }
});

// ─── API KEYS ──────────────────────────────────────────────
app.get('/api/keys', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { userId: req.userId },
      select: { id: true, name: true, key: true, active: true, lastUsed: true, createdAt: true }
    });
    const masked = keys.map(k => ({ ...k, key: k.key.substring(0, 8) + '...' + k.key.substring(k.key.length - 4) }));
    return res.json({ keys: masked });
  } catch (error: any) {
    console.error('[KEY LIST ERROR]', error?.message || error);
    return sendError(res, 500, 'Unable to fetch API keys');
  }
});

app.post('/api/keys', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) return sendError(res, 400, 'name required');

    const key = 'vck_' + crypto.randomBytes(32).toString('hex');
    const apiKey = await prisma.apiKey.create({
      data: { userId: req.userId!, name, key }
    });
    return res.json({ id: apiKey.id, name: apiKey.name, key: apiKey.key, message: 'Save this key - it won\'t be shown again' });
  } catch (error: any) {
    console.error('[KEY CREATE ERROR]', error?.message || error);
    return sendError(res, 500, 'Unable to create API key');
  }
});

app.delete('/api/keys/:id', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const keyId = req.params.id as string;
    await prisma.apiKey.deleteMany({ where: { id: keyId, userId: req.userId as string } });
    return res.json({ success: true });
  } catch (error: any) {
    console.error('[KEY DELETE ERROR]', error?.message || error);
    return sendError(res, 500, 'Unable to delete API key');
  }
});

// ─── PAYMENTS (DodoPayments) ───────────────────────────────
const PACKAGES: Record<string, { price: number; name: string; plan: string; productId: string }> = {
  'pro': { price: 900, name: 'Pro Monthly', plan: 'pro', productId: DODO_PRODUCT_PRO },
  'shield': { price: 2900, name: 'Shield Monthly', plan: 'shield', productId: DODO_PRODUCT_SHIELD }
};

app.get('/api/pricing', (_req: Request, res: Response) => {
  try {
    const plans = [
      { id: 'free', name: 'Free', price: 0, priceFormatted: '$0', description: 'Public repos, unlimited scans', features: ['Unlimited public repo scans', '60+ security rules', 'Security score & grade', 'CLI tool'] },
      { id: 'pro', name: 'Pro', price: 900, priceFormatted: '$9/mo', description: 'Private repos + CI/CD', features: ['Everything in Free', 'Private repo scanning', 'GitHub Actions integration', 'Auto-fix suggestions', 'Email alerts', 'API access'] },
      { id: 'shield', name: 'Shield', price: 2900, priceFormatted: '$29/mo', description: 'Pro + active WAF protection', features: ['Everything in Pro', 'WAF — blocks SQLi, XSS, LLM injection', 'Honeypot — 20 bot traps', 'Anti-spam — 40+ bot fingerprints', 'IP Blocker — Tor + scanner ranges', 'Real-time threat dashboard'] },
    ];
    return res.json({ plans, packages: plans });
  } catch (error: any) {
    console.error('[PRICING ERROR]', error?.message || error);
    return sendError(res, 500, 'Unable to fetch pricing');
  }
});

app.post('/api/payments/checkout', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const ip = getClientIp(req);
  if (!checkRateLimit(`checkout:${ip}`, 3, 60 * 60 * 1000)) {
    return sendError(res, 429, 'Too many checkout attempts. Try again in 1 hour.');
  }
  try {
    const { packageId } = req.body;
    if (!packageId || !PACKAGES[packageId]) return sendError(res, 400, 'Invalid package');

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true }
    });
    if (!user) return sendError(res, 404, 'User not found');

    const checkout = await createDodoCheckout({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      packageId,
      successUrl: `${FRONTEND_URL}/dashboard?payment=success`
    });

    if (!checkout.ok) return sendError(res, checkout.status, checkout.error);
    return res.json({ success: true, url: checkout.checkoutUrl });
  } catch (e: any) {
    console.error('[CHECKOUT ERROR]', e?.response?.data || e?.message || e);
    return sendError(res, 500, 'Payment gateway error');
  }
});

// 2C. GET subscription state
app.get('/api/payments/subscription', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { plan: true, subscriptionStatus: true, cancelAt: true, trialEndsAt: true, subscriptionId: true }
    });
    if (!user) return sendError(res, 404, 'User not found');
    return res.json({
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      cancelAt: user.cancelAt,
      trialEndsAt: user.trialEndsAt,
      subscriptionId: user.subscriptionId
    });
  } catch (error: any) {
    console.error('[SUBSCRIPTION ERROR]', error?.message || error);
    return sendError(res, 500, 'Unable to fetch subscription');
  }
});

// 2C. Cancel subscription
app.post('/api/payments/cancel', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { id: true, email: true, name: true, plan: true, subscriptionStatus: true }
    });
    if (!user) return sendError(res, 404, 'User not found');
    if (user.plan === 'free') return sendError(res, 400, 'No active subscription to cancel');

    // Cancelación programada al final del periodo — baja efectiva via webhook
    const cancelAt = new Date();
    cancelAt.setMonth(cancelAt.getMonth() + 1); // fin del ciclo ~1 mes

    await prisma.user.update({
      where: { id: req.userId! },
      data: { subscriptionStatus: 'cancelled', cancelAt }
    });

    void sendEmailSafe({
      to: user.email,
      subject: 'Your VibeCheck subscription has been cancelled',
      html: cancellationEmailTemplate(user.name || user.email, cancelAt),
      text: `Your VibeCheck subscription has been cancelled. Access ends on ${cancelAt.toDateString()}.`
    });

    return res.json({ success: true, cancelAt });
  } catch (error: any) {
    console.error('[CANCEL ERROR]', error?.message || error);
    return sendError(res, 500, 'Unable to cancel subscription');
  }
});

// ─── DODO WEBHOOK (/api/webhooks/dodo) ─────────────────────
app.post('/api/webhooks/dodo', express.raw({ type: '*/*' }), async (req: Request, res: Response) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
    const signature = req.headers['webhook-signature'] as string || '';
    const timestamp = req.headers['webhook-timestamp'] as string || '';

    if (DODO_WEBHOOK_SECRET && signature) {
      const signedPayload = `${timestamp}.${rawBody.toString()}`;
      const expected = crypto
        .createHmac('sha256', DODO_WEBHOOK_SECRET)
        .update(signedPayload)
        .digest('hex');
      const provided = signature.split(',').find((s: string) => s.startsWith('v1='))?.replace('v1=', '') || signature;
      if (expected !== provided) {
        console.warn('[DODO WEBHOOK] Invalid signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const event = JSON.parse(rawBody.toString()) as JsonRecord;
    const eventType = String(event?.type || event?.event_type || '');
    console.log(`[DODO WEBHOOK] Event: ${eventType}`);

    const payload = (event?.data || {}) as JsonRecord;
    const metadata = (payload?.metadata || {}) as JsonRecord;
    const userId = metadata?.userId || payload?.customer?.customer_id || payload?.customer_id;
    const subscriptionId = payload?.subscription_id || payload?.id || null;

    // ── subscription.active / payment.succeeded / subscription.renewed ──
    if (['payment.succeeded', 'subscription.active', 'subscription.renewed'].includes(eventType)) {
      if (!userId) {
        console.warn('[DODO WEBHOOK] No userId in metadata', metadata);
        return res.status(400).json({ error: 'Missing userId' });
      }

      const productId = payload?.product_id || payload?.items?.[0]?.product_id;
      let planName = 'pro';
      if (productId === DODO_PRODUCT_SHIELD || metadata?.packageId === 'shield') {
        planName = 'shield';
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          plan: planName,
          credits: -1,
          subscriptionStatus: 'active',
          cancelAt: null,
          ...(subscriptionId ? { subscriptionId } : {})
        }
      });
      console.log(`[PAYMENT] ✅ Plan [${planName}] activated for ${userId}`);

      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
      if (user) {
        const isRenewal = eventType === 'subscription.renewed';
        void sendEmailSafe({
          to: user.email,
          subject: isRenewal
            ? `✅ VibeCheck ${planName} — Subscription renewed`
            : `✅ VibeCheck ${planName} — Payment confirmed`,
          html: isRenewal
            ? subscriptionRenewedTemplate(user.name || user.email, planName)
            : emailWrapper(`
                <h1>Payment confirmed ✅</h1>
                <p>Hi <span class="highlight">${user.name || user.email}</span>,</p>
                <p>Your <span class="highlight">${planName.toUpperCase()}</span> plan is now active. Unlimited scans enabled.</p>
                ${planName === 'shield' ? `<div class="box-green"><h2>🛡️ Install Shield</h2><div class="code-block">npm install @thelab.lat/vibecheck-shield</div></div>` : ''}
                <a href="${FRONTEND_URL}/dashboard" class="btn">Go to Dashboard →</a>
              `),
          text: `VibeCheck ${planName} activated. Dashboard: ${FRONTEND_URL}/dashboard`
        });
      }

      return res.json({ received: true, plan: planName, userId });
    }

    // ── subscription.cancelled ──
    if (eventType === 'subscription.cancelled') {
      if (!userId) return res.status(400).json({ error: 'Missing userId' });
      await prisma.user.update({
        where: { id: userId },
        data: { plan: 'free', subscriptionStatus: 'cancelled', credits: 0 }
      });
      console.log(`[PAYMENT] ❌ Subscription cancelled for ${userId}`);
      return res.json({ received: true, userId, action: 'downgraded_to_free' });
    }

    // ── subscription.past_due ──
    if (eventType === 'subscription.past_due') {
      if (!userId) return res.status(400).json({ error: 'Missing userId' });
      await prisma.user.update({
        where: { id: userId },
        data: { subscriptionStatus: 'past_due' }
      });
      console.log(`[PAYMENT] ⚠ Subscription past_due for ${userId}`);
      return res.json({ received: true, userId, action: 'marked_past_due' });
    }

    return res.json({ received: true, ignored: true, eventType });
  } catch (error: any) {
    console.error('[DODO WEBHOOK ERROR]', error?.message || error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Legacy alias
app.post('/api/webhooks/payment', async (_req: Request, res: Response) => {
  return res.json({ received: true, deprecated: true });
});

// ─── SCANNER PROXY (public landing page) ───────────────────
app.post('/api/scanner/audit', async (req: Request, res: Response) => {
  try {
    const result = await axios.post(`${SCANNER_URL}/v1/scanner/audit`, req.body, { timeout: 120000 });
    return res.json(result.data);
  } catch (e: any) {
    console.error('[SCANNER PROXY ERROR]', e?.message || e);
    return sendError(res, 500, 'Scanner unavailable');
  }
});

app.get('/api/scanner/history', async (_req: Request, res: Response) => {
  try {
    const result = await axios.get(`${SCANNER_URL}/v1/scanner/history`, { timeout: 10000 });
    return res.json(result.data);
  } catch {
    return res.json([]);
  }
});

// ─── HEALTH ────────────────────────────────────────────────
app.get('/api/health', (_req: Request, res: Response) => {
  try {
    return res.json({ status: 'ok', service: 'vibecheck-saas', version: '2.0.0', time: new Date().toISOString() });
  } catch {
    return sendError(res, 500, 'Health check failed');
  }
});

// ─── ADMIN ROUTES (2D) ─────────────────────────────────────

app.get('/api/admin/stats', authMiddleware as any, adminMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const [users, scans, shields] = await Promise.all([
      prisma.user.count(),
      prisma.auditReport.count(),
      prisma.shieldLog.count()
    ]);
    return res.json({ users, scans, shields });
  } catch (error: any) {
    console.error('[ADMIN STATS ERROR]', error?.message || error);
    return sendError(res, 500, 'Unable to fetch admin stats');
  }
});

// GET /api/admin/users — lista todos los usuarios
app.get('/api/admin/users', authMiddleware as any, adminMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10)));
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, name: true, role: true, plan: true,
          subscriptionStatus: true, credits: true, createdAt: true,
          _count: { select: { scanHistory: true } }
        }
      }),
      prisma.user.count()
    ]);

    return res.json({
      users: users.map(u => ({ ...u, scansCount: u._count.scanHistory, _count: undefined })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error: any) {
    console.error('[ADMIN USERS ERROR]', error?.message || error);
    return sendError(res, 500, 'Unable to fetch users');
  }
});

// GET /api/admin/users/:id — detalle usuario
app.get('/api/admin/users/:id', authMiddleware as any, adminMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: String(req.params.id) },
      select: {
        id: true, email: true, name: true, role: true, plan: true,
        subscriptionStatus: true, subscriptionId: true, cancelAt: true, trialEndsAt: true,
        credits: true, createdAt: true, updatedAt: true,
        _count: { select: { scanHistory: true, shieldLogs: true, apiKeys: true } }
      }
    });
    if (!user) return sendError(res, 404, 'User not found');
    return res.json({ user });
  } catch (error: any) {
    console.error('[ADMIN USER DETAIL ERROR]', error?.message || error);
    return sendError(res, 500, 'Unable to fetch user');
  }
});

// PUT /api/admin/users/:id/plan — cambiar plan manualmente
app.put('/api/admin/users/:id/plan', authMiddleware as any, adminMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const { plan } = req.body;
    if (!['free', 'pro', 'shield'].includes(plan)) {
      return sendError(res, 400, 'plan must be free, pro, or shield');
    }
    const user = await prisma.user.update({
      where: { id: String(req.params.id) },
      data: {
        plan,
        credits: plan === 'free' ? 0 : -1,
        subscriptionStatus: plan === 'free' ? 'inactive' : 'active'
      },
      select: { id: true, email: true, plan: true, subscriptionStatus: true }
    });
    console.log(`[ADMIN] Plan changed to ${plan} for ${user.email}`);
    return res.json({ success: true, user });
  } catch (error: any) {
    if (error?.code === 'P2025') return sendError(res, 404, 'User not found');
    console.error('[ADMIN PLAN ERROR]', error?.message || error);
    return sendError(res, 500, 'Unable to update plan');
  }
});

// GET /api/admin/revenue — MRR y stats
app.get('/api/admin/revenue', authMiddleware as any, adminMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [proCount, shieldCount, freeCount, scansToday, totalScans] = await Promise.all([
      prisma.user.count({ where: { plan: 'pro' } }),
      prisma.user.count({ where: { plan: 'shield' } }),
      prisma.user.count({ where: { plan: 'free' } }),
      prisma.auditReport.count({ where: { createdAt: { gte: today } } }),
      prisma.auditReport.count()
    ]);

    const mrrCents = (proCount * 900) + (shieldCount * 2900);
    const mrrFormatted = `$${(mrrCents / 100).toFixed(2)}`;

    return res.json({
      mrr: { cents: mrrCents, formatted: mrrFormatted },
      users: { total: proCount + shieldCount + freeCount, free: freeCount, pro: proCount, shield: shieldCount },
      scans: { today: scansToday, total: totalScans }
    });
  } catch (error: any) {
    console.error('[ADMIN REVENUE ERROR]', error?.message || error);
    return sendError(res, 500, 'Unable to fetch revenue stats');
  }
});

// DELETE /api/admin/users/:id — borrar usuario completo
app.delete('/api/admin/users/:id', authMiddleware as any, adminMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const userId = String(req.params.id);
    await prisma.apiKey.deleteMany({ where: { userId } });
    await prisma.shieldLog.deleteMany({ where: { userId } });
    await prisma.auditReport.deleteMany({ where: { userId } });
    await prisma.repository.deleteMany({ where: { ownerId: userId } });
    await prisma.organization.deleteMany({ where: { ownerId: userId } });
    await prisma.user.delete({ where: { id: userId } });
    return res.json({ success: true });
  } catch (error: any) {
    if (error?.code === 'P2025') return sendError(res, 404, 'User not found');
    console.error('[ADMIN DELETE USER ERROR]', error?.message || error);
    return sendError(res, 500, 'Unable to delete user');
  }
});

// ─── START ─────────────────────────────────────────────────

// Alias: reuse authMiddleware for routes that reference requireAuth
const requireAuth = authMiddleware as any;

// ==========================================
// SCANS (Missing endpoints)
// ==========================================

app.get('/api/scans', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const userId = (req as any).user.userId;
    const scans = await prisma.auditReport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    // Parse JSON
    const mapped = scans.map(s => {
      let data = {};
      try { data = JSON.parse(s.fullJson); } catch (e) { }
      return { id: s.id, repoUrl: s.repoUrl, issuesFound: s.issuesFound, criticalFound: s.criticalFound, createdAt: s.createdAt, data };
    });
    res.json(mapped);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch scans' });
  }
});

app.get('/api/scans/:id', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const userId = (req as any).user.userId;
    const scan = await prisma.auditReport.findFirst({
      where: { id: req.params.id, userId }
    });
    if (!scan) return res.status(404).json({ error: 'Scan not found' });

    let fullJson = {};
    try { fullJson = JSON.parse(scan.fullJson); } catch (e) { }
    res.json({ ...scan, fullJson });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch scan' });
  }
});

app.delete('/api/scans/:id', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const userId = (req as any).user.userId;
    const scan = await prisma.auditReport.findFirst({ where: { id: req.params.id, userId } });
    if (!scan) return res.status(404).json({ error: 'Not found' });
    await prisma.auditReport.delete({ where: { id: scan.id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Deletion failed' });
  }
});

// ==========================================
// PROFILE & GDPR
// ==========================================

app.put('/api/auth/me', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const userId = (req as any).user.userId;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const user = await prisma.user.update({ where: { id: userId }, data: { name } });
    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) {
    res.status(500).json({ error: 'Update failed' });
  }
});

app.delete('/api/auth/me', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const userId = (req as any).user.userId;
    await prisma.apiKey.deleteMany({ where: { userId } });
    await prisma.shieldLog.deleteMany({ where: { userId } });
    await prisma.auditReport.deleteMany({ where: { userId } });
    await prisma.repository.deleteMany({ where: { ownerId: userId } });
    await prisma.user.delete({ where: { id: userId } });
    res.json({ success: true, message: 'Account permanently deleted' });
  } catch (e) {
    res.status(500).json({ error: 'Deletion failed. Contact support.' });
  }
});

// ==========================================
// SUBSCRIPTION
// ==========================================

app.get('/api/payments/subscription', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const userId = (req as any).user.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      cancelAt: user.cancelAt,
      trialEndsAt: user.trialEndsAt
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/payments/cancel', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const userId = (req as any).user.userId;
    // Puesto para cancelar al final del mes
    const cancelAt = new Date();
    cancelAt.setDate(cancelAt.getDate() + 30);

    await prisma.user.update({
      where: { id: userId },
      data: { cancelAt, subscriptionStatus: 'cancelled_pending' }
    });

    res.json({ success: true, cancelAt });
  } catch (e) {
    res.status(500).json({ error: 'Cancellation failed' });
  }
});

// ==========================================
// ADMIN DASHBOARD
// ==========================================

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  requireAuth(req, res, async () => {
    const userId = (req as any).user.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
    next();
  });
}

app.get('/api/admin/users', requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, plan: true, role: true, createdAt: true, _count: { select: { scanHistory: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.put('/api/admin/users/:id/plan', requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const { plan } = req.body;
    await prisma.user.update({ where: { id: req.params.id }, data: { plan, subscriptionStatus: 'active' } });
    res.json({ success: true, plan });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.listen(PORT, () => {
  console.log(`[VIBECHECK] Security SaaS v2.0 running on port ${PORT}`);
});
