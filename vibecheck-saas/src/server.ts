// VibeCheck Security SaaS - PRODUCTION ENGINE
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import crypto from 'crypto';

dotenv.config();

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 8000;
const JWT_SECRET = process.env.JWT_SECRET || 'vibecheck_vault_2026_thelab';
const SCANNER_URL = process.env.SCANNER_URL || 'http://localhost:8080';
const DODO_API_KEY = process.env.DODO_API_KEY;

app.use(cors());
app.use(express.json());

// ─── AUTH MIDDLEWARE ─────────────────────────────────────────
interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as any;
    req.userId = payload.userId;
    req.userRole = payload.role;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// API Key auth (for programmatic access)
async function apiKeyMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const key = req.headers['x-api-key'] as string;
  if (!key) return authMiddleware(req, res, next); // fallback to JWT
  const apiKey = await prisma.apiKey.findUnique({ where: { key } });
  if (!apiKey || !apiKey.active) return res.status(401).json({ error: 'Invalid API key' });
  await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsed: new Date() } });
  req.userId = apiKey.userId;
  next();
}

// ─── AUTH ROUTES ────────────────────────────────────────────
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role: 'USER', credits: 5 }
    });
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role, credits: user.credits } });
  } catch (e) {
    res.status(400).json({ error: 'Email already exists' });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && await bcrypt.compare(password, user.passwordHash)) {
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role, credits: user.credits } });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/api/auth/me', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, name: true, email: true, role: true, credits: true, createdAt: true } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// ─── CREDITS ────────────────────────────────────────────────
app.get('/api/credits/balance', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { credits: true } });
  res.json({ credits: user?.credits || 0 });
});

// ─── SCAN (CORE PRODUCT) ───────────────────────────────────
app.post('/api/scan', apiKeyMiddleware as any, async (req: AuthRequest, res: Response) => {
  const { repoUrl } = req.body;
  if (!repoUrl) return res.status(400).json({ error: 'repoUrl required' });

  // Check credits
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user || user.credits <= 0) return res.status(402).json({ error: 'No credits remaining. Purchase more at /pricing' });

  try {
    // Call the scanner engine
    const scanResult = await axios.post(`${SCANNER_URL}/v1/scanner/audit`, { repoUrl }, { timeout: 120000 });
    const result = scanResult.data;

    // Deduct credit and save report
    await prisma.user.update({ where: { id: req.userId }, data: { credits: { decrement: 1 } } });

    const report = await prisma.auditReport.create({
      data: {
        userId: req.userId!,
        repoUrl,
        issuesFound: result.totalIssues || result.issues?.length || 0,
        criticalFound: result.criticalIssues || result.issues?.filter((i: any) => i.severity === 'CRITICAL')?.length || 0,
        fullJson: JSON.stringify(result)
      }
    });

    res.json({
      success: true,
      reportId: report.id,
      summary: {
        issuesFound: report.issuesFound,
        criticalFound: report.criticalFound,
        creditsRemaining: user.credits - 1
      },
      details: result
    });
  } catch (e: any) {
    console.error('[SCAN ERROR]', e.message);
    res.status(500).json({ error: 'Scanner engine unavailable. Try again later.' });
  }
});

// ─── SHIELD (PROMPT FIREWALL) ──────────────────────────────
app.post('/api/shield/validate', apiKeyMiddleware as any, async (req: AuthRequest, res: Response) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  try {
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

    res.json(result.data);
  } catch (e: any) {
    res.status(500).json({ error: 'Shield engine unavailable' });
  }
});

// ─── SCAN HISTORY ──────────────────────────────────────────
app.get('/api/scans', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const scans = await prisma.auditReport.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, repoUrl: true, issuesFound: true, criticalFound: true, createdAt: true }
  });
  res.json({ scans });
});

app.get('/api/scans/:id', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const scanId = req.params.id as string;
  const scan = await prisma.auditReport.findFirst({
    where: { id: scanId, userId: req.userId as string }
  });
  if (!scan) return res.status(404).json({ error: 'Scan not found' });
  res.json({ scan: { ...scan, fullJson: JSON.parse(scan.fullJson) } });
});

// ─── API KEYS ──────────────────────────────────────────────
app.get('/api/keys', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const keys = await prisma.apiKey.findMany({
    where: { userId: req.userId },
    select: { id: true, name: true, key: true, active: true, lastUsed: true, createdAt: true }
  });
  // Mask keys for security
  const masked = keys.map(k => ({ ...k, key: k.key.substring(0, 8) + '...' + k.key.substring(k.key.length - 4) }));
  res.json({ keys: masked });
});

app.post('/api/keys', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  
  const key = 'vck_' + crypto.randomBytes(32).toString('hex');
  const apiKey = await prisma.apiKey.create({
    data: { userId: req.userId!, name, key }
  });
  // Return full key only on creation
  res.json({ id: apiKey.id, name: apiKey.name, key: apiKey.key, message: 'Save this key - it won\'t be shown again' });
});

app.delete('/api/keys/:id', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const keyId = req.params.id as string;
  await prisma.apiKey.deleteMany({ where: { id: keyId, userId: req.userId as string } });
  res.json({ success: true });
});

// ─── PAYMENTS (DodoPayments) ───────────────────────────────
const PACKAGES: Record<string, { price: number; name: string; credits: number }> = {
  'starter': { price: 900, name: 'Starter Pack', credits: 25 },
  'pro': { price: 2900, name: 'Pro Pack', credits: 100 },
  'enterprise': { price: 9900, name: 'Enterprise Pack', credits: 500 }
};

app.get('/api/pricing', (_req: Request, res: Response) => {
  res.json({
    packages: Object.entries(PACKAGES).map(([id, pkg]) => ({
      id, ...pkg, priceFormatted: `$${(pkg.price / 100).toFixed(2)}`
    }))
  });
});

app.post('/api/payments/checkout', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const { packageId } = req.body;
  const pkg = PACKAGES[packageId];
  if (!pkg) return res.status(400).json({ error: 'Invalid package' });

  if (!DODO_API_KEY) return res.status(500).json({ error: 'Payment not configured' });

  try {
    const response = await axios.post('https://api.dodopayments.com/v1/checkouts', {
      amount: pkg.price, currency: 'USD', name: pkg.name,
      customer_id: req.userId,
      metadata: { packageId, credits: pkg.credits },
      redirect_url: 'https://vibecheck.thelab.lat/dashboard?payment=success'
    }, { headers: { 'Authorization': `Bearer ${DODO_API_KEY}` } });
    res.json({ url: response.data.checkout_url });
  } catch (e) {
    res.status(500).json({ error: 'Payment gateway error' });
  }
});

app.post('/api/webhooks/payment', async (req: Request, res: Response) => {
  const event = req.body;
  if (event.type === 'payment.succeeded') {
    const userId = event.data.customer_id;
    const credits = event.data.metadata?.credits || 25;
    await prisma.user.update({ where: { id: userId }, data: { credits: { increment: credits } } });
    console.log(`[PAYMENT] +${credits} credits for ${userId}`);
  }
  res.json({ received: true });
});

// ─── SCANNER PROXY (public landing page) ───────────────────
app.post('/api/scanner/audit', async (req: Request, res: Response) => {
  try {
    const result = await axios.post(`${SCANNER_URL}/v1/scanner/audit`, req.body, { timeout: 120000 });
    res.json(result.data);
  } catch (e: any) {
    res.status(500).json({ error: 'Scanner unavailable' });
  }
});

app.get('/api/scanner/history', async (_req: Request, res: Response) => {
  try {
    const result = await axios.get(`${SCANNER_URL}/v1/scanner/history`, { timeout: 10000 });
    res.json(result.data);
  } catch {
    res.json([]);
  }
});

// ─── HEALTH ────────────────────────────────────────────────
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'vibecheck-saas', version: '1.0.0', time: new Date().toISOString() });
});

// ─── STATS (admin) ─────────────────────────────────────────
app.get('/api/admin/stats', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  if (req.userRole !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
  const [users, scans, shields] = await Promise.all([
    prisma.user.count(),
    prisma.auditReport.count(),
    prisma.shieldLog.count()
  ]);
  res.json({ users, scans, shields });
});

// ─── START ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[VIBECHECK] Security SaaS running on port ${PORT}`);
});
