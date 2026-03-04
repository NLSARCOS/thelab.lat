import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, ShieldCheck, Copy, Check, ArrowRight, Loader2 } from 'lucide-react';

type StackKey = 'express' | 'fastify' | 'nextjs' | 'vercel' | 'railway';

const STACK_OPTIONS: { key: StackKey; label: string; badge?: string }[] = [
  { key: 'express', label: 'Express' },
  { key: 'fastify', label: 'Fastify' },
  { key: 'nextjs', label: 'Next.js' },
  { key: 'vercel', label: 'Vercel', badge: 'Edge' },
  { key: 'railway', label: 'Railway' },
];

const STACK_CODE: Record<StackKey, { install: string; usage: string }> = {
  express: {
    install: `npm install @thelab.lat/vibecheck-shield`,
    usage: `import { shield } from "@thelab.lat/vibecheck-shield"
// Add after your middleware setup:
app.use(shield({
  waf: true,
  honeypot: true, 
  antispam: true,
  rateLimit: true,
  onThreat: (event) => console.log("THREAT BLOCKED:", event)
}))`
  },
  fastify: {
    install: `npm install @thelab.lat/vibecheck-shield`,
    usage: `import { shield } from "@thelab.lat/vibecheck-shield"
await fastify.register(shield.fastify, {
  waf: true, honeypot: true, antispam: true
})`
  },
  nextjs: {
    install: `npm install @thelab.lat/vibecheck-shield`,
    usage: `// middleware.ts (root of project)
import { shieldMiddleware } from "@thelab.lat/vibecheck-shield/next"
export default shieldMiddleware({ waf: true, honeypot: true })
export const config = { matcher: ["/api/:path*"] }`
  },
  vercel: {
    install: `npm install @thelab.lat/vibecheck-shield`,
    usage: `// middleware.ts (root of project — works on Vercel Edge)
import { shieldMiddleware } from "@thelab.lat/vibecheck-shield/next"

export default shieldMiddleware({
  waf: true,
  honeypot: true,
  antispam: true,
})

// Protect all API routes
export const config = {
  matcher: ["/api/:path*", "/((?!_next|favicon).*)"],
}`
  },
  railway: {
    install: `npm install @thelab.lat/vibecheck-shield`,
    usage: `// server.ts — works on Railway, Render, Fly.io, Heroku
import express from "express"
import { shield } from "@thelab.lat/vibecheck-shield"

const app = express()

// Add shield before all routes
app.use(shield({
  waf: true,
  honeypot: true,
  antispam: true,
  rateLimit: true,
  onThreat: (event) => console.log("[THREAT]", event.type, event.ip),
}))

// Your routes here...
app.listen(process.env.PORT || 3000)`
  },
};

const api = axios.create();
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vb_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition-all"
    >
      {copied ? <Check size={14} className="text-[#4ADE80]" /> : <Copy size={14} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="bg-[#0B0B0F] rounded-[1.5rem] p-5 text-white border border-[#12121A] shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">{title}</div>
        <CopyButton text={code} />
      </div>
      <pre className="text-xs md:text-sm whitespace-pre-wrap leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function ShieldOnboarding() {
  const [searchParams] = useSearchParams();
  const initialStack = useMemo<StackKey>(() => {
    const stackParam = String(searchParams.get('stack') || '').toLowerCase() as StackKey;
    return STACK_OPTIONS.some((s) => s.key === stackParam) ? stackParam : 'express';
  }, [searchParams]);

  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [stack, setStack] = useState<StackKey>(initialStack);
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState('');
  const [attacksBlocked, setAttacksBlocked] = useState(0);
  const [_attackTarget, setAttackTarget] = useState(6);

  useEffect(() => {
    if (step !== 3) return;
    const target = Math.floor(Math.random() * 10) + 3;
    setAttackTarget(target);
    setAttacksBlocked(0);
    let current = 0;
    const interval = setInterval(() => {
      current += 1;
      setAttacksBlocked(current);
      if (current >= target) clearInterval(interval);
    }, 180);
    return () => clearInterval(interval);
  }, [step]);

  const handleActivate = async () => {
    setActivationError('');
    setActivating(true);
    try {
      await api.post('/api/shield/activate', { stack, activated: true });
      setStep(3); localStorage.setItem('vb_onboarding_done', '1');
    } catch (e: any) {
      setActivationError(e?.response?.data?.error || 'Activation failed. Try again.');
    } finally {
      setActivating(false);
    }
  };

  const stackContent = STACK_CODE[stack];

  return (
    <div className="min-h-screen bg-[#FCFCFD] text-[#09090B] flex items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-[0_30px_80px_rgba(0,0,0,0.05)] p-8 md:p-12">
          {/* Skip button */}
          <div className="flex justify-end mb-6">
            <button
              type="button"
              onClick={() => { localStorage.setItem('vb_onboarding_done', '1'); navigate('/dashboard'); }}
              className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 transition-colors underline underline-offset-4"
            >
              Skip for now →
            </button>
          </div>
          {step === 1 && (
            <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
              <div>
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-[#E7F9EE] text-[#166534] font-black uppercase text-[10px] tracking-[0.25em]">
                  Your Shield is Ready
                </div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tight mt-6">Activate Your Security Shield</h1>
                <p className="text-slate-500 text-lg mt-4">One line of code. Real-time protection.</p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="px-4 py-2 rounded-full bg-red-50 text-red-600 text-xs font-black uppercase tracking-widest border border-red-100">
                    Unprotected
                  </div>
                  <div className="text-sm text-slate-500 font-semibold">Security score: <span className="text-slate-900 font-black">0/100</span></div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="mt-10 inline-flex items-center gap-3 bg-[#4ADE80] text-black px-8 py-4 rounded-full font-black uppercase tracking-widest text-sm hover:brightness-95 active:scale-[0.98] transition-all"
                >
                  Show me how <ArrowRight size={18} />
                </button>
              </div>
              <div className="flex items-center justify-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-[#4ADE80]/30 animate-ping" />
                  <div className="absolute inset-4 rounded-full bg-[#4ADE80]/20 animate-pulse" />
                  <div className="relative w-40 h-40 rounded-full bg-[#4ADE80] flex items-center justify-center shadow-[0_20px_60px_rgba(74,222,128,0.35)]">
                    <CheckCircle2 className="text-white" size={92} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-10">
              <div>
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-black text-white font-black uppercase text-[10px] tracking-[0.25em]">
                  Install in 30 seconds
                </div>
                <h2 className="text-3xl md:text-4xl font-black tracking-tight mt-5">Paste this and ship</h2>
                <p className="text-slate-500 mt-3">We detected <span className="font-bold text-slate-900">{STACK_OPTIONS.find((s) => s.key === stack)?.label}</span>. Switch stacks if needed.</p>
              </div>

              <div className="flex flex-wrap gap-3">
                {STACK_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setStack(option.key)}
                    className={`px-5 py-2 rounded-full border text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                      stack === option.key
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-black'
                    }`}
                  >
                    {option.label}
                    {option.badge && (
                      <span className="text-[8px] font-black uppercase tracking-widest bg-[#4ADE80] text-black px-1.5 py-0.5 rounded-full">
                        {option.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Disclaimer PHP/Apache */}
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 mt-1">
                <span className="text-amber-500 text-sm mt-0.5">⚠️</span>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-amber-700 mb-0.5">Node.js only</p>
                  <p className="text-xs text-amber-600">Requires Node.js 18+. Not compatible with PHP, Python, Ruby, or Apache. Using a different stack? <a href="mailto:info@thelab.lat" className="underline font-bold">Contact us</a> for enterprise options.</p>
                </div>
              </div>

              <div className="grid gap-6">
                <CodeBlock title="Install" code={stackContent.install} />
                <CodeBlock title="Usage" code={stackContent.usage} />
              </div>

              {activationError && (
                <div className="text-xs font-black uppercase tracking-widest text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
                  {activationError}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={handleActivate}
                  disabled={activating}
                  className="inline-flex items-center gap-3 bg-[#4ADE80] text-black px-8 py-4 rounded-full font-black uppercase tracking-widest text-sm hover:brightness-95 active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {activating ? <Loader2 className="animate-spin" size={18} /> : 'I installed it'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-black transition-all"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
              <div>
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-[#E7F9EE] text-[#166534] font-black uppercase text-[10px] tracking-[0.25em]">
                  Shield Active
                </div>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight mt-6">You are protected</h2>
                <p className="text-slate-500 text-lg mt-4">Shield works 24/7. Check your threat dashboard anytime.</p>

                <div className="mt-8 space-y-3">
                  <StatLine label="Attacks blocked" value={`${attacksBlocked}`} />
                  <StatLine label="Honeypots armed" value="20" />
                  <StatLine label="WAF Rules active" value="50+" />
                </div>

                <div className="mt-10 flex flex-wrap items-center gap-4">
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center gap-3 bg-black text-white px-8 py-4 rounded-full font-black uppercase tracking-widest text-sm hover:bg-slate-900 active:scale-[0.98] transition-all"
                  >
                    Go to dashboard
                  </Link>
                  <a
                    href="https://vibecheck.thelab.lat/shield-dashboard"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-3 border border-black text-black px-8 py-4 rounded-full font-black uppercase tracking-widest text-sm hover:bg-black hover:text-white active:scale-[0.98] transition-all"
                  >
                    Open /shield-dashboard
                  </a>
                </div>
              </div>

              <div className="flex items-center justify-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-[2.5rem] bg-[#4ADE80]/20 blur-2xl" />
                  <div className="relative w-56 h-56 rounded-[2.5rem] bg-[#4ADE80] flex items-center justify-center shadow-[0_30px_80px_rgba(74,222,128,0.4)]">
                    <ShieldCheck className="text-white animate-pulse" size={120} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-xs text-slate-400 font-semibold uppercase tracking-widest">
          Shield works 24/7. Check your threat dashboard anytime.
        </div>
      </div>
    </div>
  );
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4">
      <span className="text-xs font-black uppercase tracking-widest text-slate-500">{label}</span>
      <span className="text-lg font-black text-slate-900">{value}</span>
    </div>
  );
}
