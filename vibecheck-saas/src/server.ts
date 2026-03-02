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
const DODO_API_BASE_URL = process.env.DODO_API_BASE_URL || 'https://api.dodopayments.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://vibecheck.thelab.lat';
const resend = new Resend(process.env.RESEND_API_KEY);
const MAIL_FROM = 'VibeCheck Security <security@thelab.lat>';

app.use(cors());
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

function welcomeEmailTemplate(nameOrEmail: string) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#0f172a;">
      <h2 style="margin-bottom:8px;">Welcome to VibeCheck Security</h2>
      <p style="margin-top:0;">Hi ${nameOrEmail},</p>
      <p>Your account is active and ready for production scanning.</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 8px;"><strong>What you can do now</strong></p>
        <ul style="padding-left:20px;margin:0;">
          <li>Run repository security scans</li>
          <li>Track findings by severity and risk</li>
          <li>Use API keys for CI/CD automation</li>
        </ul>
      </div>
      <p>Open your dashboard: <a href="${FRONTEND_URL}/dashboard">${FRONTEND_URL}/dashboard</a></p>
      <p style="color:#475569;">VibeCheck Security Team</p>
    </div>
  `;
}

function resetPasswordEmailTemplate(resetUrl: string) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#0f172a;">
      <h2 style="margin-bottom:8px;">Reset your VibeCheck password</h2>
      <p>We received a request to reset your password.</p>
      <p>
        <a href="${resetUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;">
          Reset Password
        </a>
      </p>
      <p>If you did not request this, you can safely ignore this email.</p>
      <p style="color:#475569;">This link expires in 1 hour.</p>
    </div>
  `;
}

function scanReportEmailTemplate(params: { repoUrl: string; issuesFound: number; criticalFound: number; reportId: string }) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#0f172a;">
      <h2 style="margin-bottom:8px;">Security scan completed</h2>
      <p>Your repository scan has finished.</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 8px;"><strong>Scan Summary</strong></p>
        <p style="margin:0;">Repository: ${params.repoUrl}</p>
        <p style="margin:4px 0 0;">Issues found: ${params.issuesFound}</p>
        <p style="margin:4px 0 0;">Critical issues: ${params.criticalFound}</p>
      </div>
      <p>Open report: <a href="${FRONTEND_URL}/dashboard/scans/${params.reportId}">${FRONTEND_URL}/dashboard/scans/${params.reportId}</a></p>
      <p style="color:#475569;">VibeCheck Security Team</p>
    </div>
  `;
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

  const productMap: Record<string, string | undefined> = {
    pro: process.env.DODO_PRODUCT_ID_PRO,
    enterprise: process.env.DODO_PRODUCT_ID_ENTERPRISE
  };

  const configuredProductId = productMap[args.packageId];
  const metadata = {
    userId: args.userId,
    packageId: args.packageId,
    credits: String(selectedPackage.credits)
  };

  const headers = {
    Authorization: `Bearer ${DODO_API_KEY}`,
    'Content-Type': 'application/json'
  };

  if (configuredProductId) {
    const checkoutBody = {
      customer: {
        customer_id: args.userId,
        email: args.userEmail,
        name: args.userName || args.userEmail
      },
      product_cart: [{ product_id: configuredProductId, quantity: 1 }],
      metadata,
      return_url: args.successUrl
    };

    const response = await axios.post(`${DODO_API_BASE_URL}/checkouts`, checkoutBody, { headers, timeout: 15000 });
    const checkoutUrl = response.data?.checkout_url || response.data?.payment_link || response.data?.url;
    if (!checkoutUrl) throw new Error('Dodo checkout URL missing in response');
    return { ok: true, checkoutUrl };
  }

  // Fallback payload for compatibility if product IDs are not configured yet.
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

// API Key auth (for programmatic access)
async function apiKeyMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const key = req.headers['x-api-key'] as string;
    if (!key) return authMiddleware(req, res, next); // fallback to JWT
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

// ─── AUTH ROUTES ────────────────────────────────────────────
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { email, password, name } = req.body;
  if (!email || !password) return sendError(res, 400, 'Email and password required');
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role: 'USER', credits: 5 }
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

app.post('/api/auth/login', async (req: Request, res: Response) => {
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
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, name: true, email: true, role: true, credits: true, createdAt: true } });
    if (!user) return sendError(res, 404, 'User not found');
    return res.json({ user });
  } catch (error: any) {
    console.error('[AUTH ME ERROR]', error?.message || error);
    return sendError(res, 500, 'Unable to fetch user profile');
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

// ─── SCAN (CORE PRODUCT) ───────────────────────────────────
app.post('/api/scan', apiKeyMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const { repoUrl } = req.body;
    if (!repoUrl) return sendError(res, 400, 'repoUrl required');

    // Check credits (-1 means unlimited)
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return sendError(res, 404, 'User not found');
    if (user.credits !== -1 && user.credits <= 0) {
      return sendError(res, 402, 'No credits remaining. Purchase more at /pricing');
    }

    // Call the scanner engine
    const scanResult = await axios.post(`${SCANNER_URL}/v1/scanner/audit`, { repoUrl }, { timeout: 120000 });
    const result = scanResult.data;

    // Deduct credit and save report
    if (user.credits !== -1) {
      await prisma.user.update({ where: { id: req.userId }, data: { credits: { decrement: 1 } } });
    }

    const report = await prisma.auditReport.create({
      data: {
        userId: req.userId!,
        repoUrl,
        issuesFound: result.totalIssues || result.issues?.length || 0,
        criticalFound: result.criticalIssues || result.issues?.filter((i: any) => i.severity === 'CRITICAL')?.length || 0,
        fullJson: JSON.stringify(result)
      }
    });

    const creditsRemaining = user.credits === -1 ? -1 : user.credits - 1;
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

    return res.json({
      success: true,
      reportId: report.id,
      summary: {
        issuesFound: report.issuesFound,
        criticalFound: report.criticalFound,
        creditsRemaining
      },
      details: result
    });
  } catch (e: any) {
    console.error('[SCAN ERROR]', e.message);
    return sendError(res, 500, 'Scanner engine unavailable. Try again later.');
  }
});

// ─── SHIELD (PROMPT FIREWALL) ──────────────────────────────
app.post('/api/shield/validate', apiKeyMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return sendError(res, 400, 'prompt required');

    const result = await axios.post(`${SCANNER_URL}/v1/shield/validate`, { prompt }, { timeout: 10000 });
    
    // Log the shield check
    await prisma.shieldLog.create({
      data: {
        userId: req.userId!,
        promptPreview: prompt.substring(0, 200),
        riskScore: result.data.riskScore || 0,
        status: result.data.blocked ? 'BLOCKED' : 'CLEAN',
        ruleMatched: result.data.matchedRule || null
      }
    });

    return res.json(result.data);
  } catch (e: any) {
    console.error('[SHIELD ERROR]', e?.message || e);
    return sendError(res, 500, 'Shield engine unavailable');
  }
});

// ─── SCAN HISTORY ──────────────────────────────────────────
app.get('/api/scans', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const scans = await prisma.auditReport.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, repoUrl: true, issuesFound: true, criticalFound: true, createdAt: true }
    });
    return res.json({ scans });
  } catch (error: any) {
    console.error('[SCANS ERROR]', error?.message || error);
    return sendError(res, 500, 'Unable to fetch scans');
  }
});

app.get('/api/scans/:id', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const scanId = req.params.id as string;
    const scan = await prisma.auditReport.findFirst({
      where: { id: scanId, userId: req.userId as string }
    });
    if (!scan) return sendError(res, 404, 'Scan not found');
    return res.json({ scan: { ...scan, fullJson: parseJsonSafely(scan.fullJson) } });
  } catch (error: any) {
    console.error('[SCAN DETAIL ERROR]', error?.message || error);
    return sendError(res, 500, 'Unable to fetch scan');
  }
});

app.get('/api/scans/:id/report', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const scanId = req.params.id as string;
    const scan = await prisma.auditReport.findFirst({
      where: { id: scanId, userId: req.userId as string }
    });
    if (!scan) return sendError(res, 404, 'Scan not found');

    const parsed = parseJsonSafely(scan.fullJson);
    if (!parsed) return sendError(res, 500, 'Scan report JSON is invalid');

    return res.json({
      success: true,
      report: {
        id: scan.id,
        repoUrl: scan.repoUrl,
        createdAt: scan.createdAt,
        formatted: formatScanReport(parsed)
      }
    });
  } catch (error: any) {
    console.error('[SCAN REPORT ERROR]', error?.message || error);
    return sendError(res, 500, 'Unable to fetch scan report');
  }
});

// ─── API KEYS ──────────────────────────────────────────────
app.get('/api/keys', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { userId: req.userId },
      select: { id: true, name: true, key: true, active: true, lastUsed: true, createdAt: true }
    });
    // Mask keys for security
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
    // Return full key only on creation
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
const PACKAGES: Record<string, { price: number; name: string; credits: number }> = {
  'pro': { price: 900, name: 'Pro Monthly', credits: 100 },
  'enterprise': { price: 2900, name: 'Enterprise Monthly', credits: -1 }
};

app.get('/api/pricing', (_req: Request, res: Response) => {
  try {
    const plans = Object.entries(PACKAGES).map(([id, pkg]) => ({
      id,
      ...pkg,
      unlimited: pkg.credits === -1,
      priceFormatted: `$${(pkg.price / 100).toFixed(2)}`
    }));
    return res.json({ plans, packages: plans });
  } catch (error: any) {
    console.error('[PRICING ERROR]', error?.message || error);
    return sendError(res, 500, 'Unable to fetch pricing');
  }
});

app.post('/api/payments/checkout', authMiddleware as any, async (req: AuthRequest, res: Response) => {
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

app.post('/api/webhooks/payment', async (req: Request, res: Response) => {
  try {
    const event = req.body as JsonRecord;
    const eventType = String(event?.type || '');
    const payload = (event?.data?.object || event?.data || {}) as JsonRecord;
    const metadata = (payload?.metadata || event?.metadata || {}) as JsonRecord;

    const isPaymentSuccess = ['payment.succeeded', 'checkout.completed', 'checkout.session.completed', 'payment_success'].includes(eventType);
    if (!isPaymentSuccess) return res.json({ received: true, ignored: true });

    const userId = payload?.customer_id || payload?.customer?.customer_id || metadata?.userId;
    if (!userId) return sendError(res, 400, 'Missing user in webhook payload');

    const pkg = getPackageFromMetadata(metadata);
    const rawCredits = Number(metadata?.credits);
    const credits = pkg?.credits ?? (Number.isFinite(rawCredits) ? rawCredits : 0);

    if (credits === -1) {
      await prisma.user.update({ where: { id: userId }, data: { credits: -1 } });
      console.log(`[PAYMENT] Unlimited credits set for ${userId}`);
    } else if (credits > 0) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { credits: true } });
      if (user && user.credits !== -1) {
        await prisma.user.update({ where: { id: userId }, data: { credits: { increment: credits } } });
        console.log(`[PAYMENT] +${credits} credits for ${userId}`);
      }
    }

    return res.json({ received: true });
  } catch (error: any) {
    console.error('[PAYMENT WEBHOOK ERROR]', error?.message || error);
    return sendError(res, 500, 'Webhook processing failed');
  }
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
    return res.json({ status: 'ok', service: 'vibecheck-saas', version: '1.0.0', time: new Date().toISOString() });
  } catch {
    return sendError(res, 500, 'Health check failed');
  }
});

// ─── STATS (admin) ─────────────────────────────────────────
app.get('/api/admin/stats', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'ADMIN') return sendError(res, 403, 'Forbidden');
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

// ─── START ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[VIBECHECK] Security SaaS running on port ${PORT}`);
});
