"use client";

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Shield,
  Sparkles,
  Scan,
  GitBranch,
  KeyRound,
  Zap,
  Check,
  Quote,
} from "lucide-react";

type Issue = {
  severity: string;
  ruleId: string;
  description: string;
};

type HistoryItem = {
  id: string | number;
  created_at: string;
  critical_level: boolean;
  target: string;
};

export default function App() {
  const [auditOutput, setAuditOutput] = useState<string[]>([
    "/ VIBECHECK_CLI v1.2.0",
    "> Neural Bridge Established.",
    "> Waiting for project source...",
  ]);
  const [repoPath, setRepoPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/scanner/history");
      const data = await res.json();
      setHistory(data);
    } catch (e) {
      console.error(e);
    }
  };

  const runAudit = async () => {
    if (!repoPath) return alert("Please enter a GitHub URL");
    setLoading(true);
    setAuditOutput([
      "> Initializing VFS_BRIDGE...",
      `> Accessing: ${repoPath}`,
    ]);

    try {
      const response = await fetch("/api/scanner/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: repoPath }),
      });
      const data = await response.json();

      const logs = [
        `> Found ${data.issuesFound} vulnerabilities.`,
        ...data.issues.map(
          (i: Issue) => `> [${i.severity}] ${i.ruleId}: ${i.description}`
        ),
      ];

      if (data.issuesFound === 0) logs.push("> Status: SECURE_ENVIRONMENT");
      setAuditOutput((prev) => [...prev, ...logs]);
      fetchHistory();
    } catch (e) {
      setAuditOutput((prev) => [
        ...prev,
        "> CONNECTION_FAILURE: Core Engine unreachable.",
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#0A0A0A] font-['Space_Grotesk']">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.12),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,_rgba(0,0,0,0.02),_transparent_30%)]" />
      </div>

      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-black/5">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-black text-white grid place-items-center">
              <Shield size={18} />
            </div>
            <div className="text-sm leading-tight">
              <div className="font-semibold tracking-tight">VibeCheck Security</div>
              <div className="text-[11px] text-black/50">AI-powered scanner</div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm">
            <a href="#features" className="hover:text-[#2563EB]">Features</a>
            <a href="#demo" className="hover:text-[#2563EB]">Demo</a>
            <a href="#pricing" className="hover:text-[#2563EB]">Pricing</a>
            <a href="#faq" className="hover:text-[#2563EB]">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden sm:inline-flex text-sm px-3 py-2 rounded-lg border border-black/10 hover:border-black"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-[#2563EB] text-white hover:bg-[#1E4FD6]"
            >
              Start free
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 pt-20 pb-16">
          <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest border border-black/10 rounded-full px-3 py-1 mb-6">
                <Sparkles size={14} className="text-[#2563EB]" />
                AI security for vibe-coded projects
              </div>
              <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">
                Your AI Code Has Blind Spots. We Find Them.
              </h1>
              <p className="mt-5 text-lg text-black/60">
                VibeCheck Security scans your repositories with 20 AI security rules,
                detects prompt injection risk, and delivers real-time reports before
                vulnerabilities ship.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#2563EB] text-white text-sm hover:bg-[#1E4FD6]"
                >
                  Start scanning free
                  <ArrowRight size={16} />
                </Link>
                <a
                  href="#demo"
                  className="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-black/15 text-sm hover:border-black"
                >
                  Try the live demo
                </a>
              </div>
              <div className="mt-6 flex items-center gap-6 text-xs text-black/50">
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-[#2563EB]" />
                  No credit card required
                </div>
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-[#2563EB]" />
                  2-minute setup
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white shadow-[0_20px_60px_-40px_rgba(0,0,0,0.6)] p-6">
              <div className="text-xs text-black/50 mb-4">Live Security Snapshot</div>
              <div className="space-y-3">
                {[
                  { label: "Injection Shield", value: "Protected" },
                  { label: "Secrets Leakage", value: "2 flagged" },
                  { label: "Supply Chain Risk", value: "Low" },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-3 text-sm"
                  >
                    <span>{row.label}</span>
                    <span className="font-medium text-[#2563EB]">{row.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-lg bg-black text-white px-4 py-3 text-xs font-mono">
                &gt; Running 20 AI rules...<br />
                &gt; 3 critical prompts intercepted
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex items-end justify-between gap-6 mb-10">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Security that ships with your vibe</h2>
              <p className="text-black/60 mt-2">
                Purpose-built for AI-first repos with modern threat models and instant insights.
              </p>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "20 AI security rules",
                desc: "Coverage for jailbreaks, secret exfiltration, data poisoning, and more.",
                icon: Shield,
              },
              {
                title: "GitHub URL scanning",
                desc: "Paste a repo URL and run an audit in seconds.",
                icon: GitBranch,
              },
              {
                title: "API key authentication",
                desc: "Secure workspace-level keys for automated scans.",
                icon: KeyRound,
              },
              {
                title: "Prompt injection shield",
                desc: "Block malicious prompts before they hit production.",
                icon: Scan,
              },
              {
                title: "Real-time reports",
                desc: "Actionable findings with severity and remediation steps.",
                icon: Zap,
              },
              {
                title: "Audit history",
                desc: "Track every scan for compliance and verification.",
                icon: Sparkles,
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-black/10 bg-white p-6 hover:border-black/30 transition"
              >
                <div className="h-10 w-10 rounded-lg bg-[#2563EB]/10 text-[#2563EB] grid place-items-center mb-4">
                  <f.icon size={18} />
                </div>
                <div className="font-medium mb-2">{f.title}</div>
                <p className="text-sm text-black/60">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="demo" className="mx-auto max-w-6xl px-6 py-16">
          <div className="rounded-3xl border border-black/10 bg-white p-8 md:p-12">
            <div className="flex items-start justify-between gap-6 flex-col md:flex-row">
              <div>
                <div className="text-xs uppercase tracking-widest text-black/50">Free scanner demo</div>
                <h2 className="text-3xl font-semibold tracking-tight mt-3">Run a live scan on any public repo</h2>
                <p className="text-black/60 mt-2 max-w-xl">
                  Paste a GitHub URL and watch VibeCheck analyze it in real time. This is the
                  same engine paid teams use, with a limited free run.
                </p>
              </div>
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white text-sm hover:bg-[#2563EB]"
              >
                Unlock full scans
                <ArrowRight size={16} />
              </Link>
            </div>

            <div className="mt-8 grid lg:grid-cols-[1.2fr_0.8fr] gap-8">
              <div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    placeholder="Paste GitHub repo URL"
                    value={repoPath}
                    onChange={(e) => setRepoPath(e.target.value)}
                    className="flex-1 bg-[#F7F7F8] border border-black/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#2563EB]"
                  />
                  <button
                    onClick={runAudit}
                    disabled={loading}
                    className="bg-[#2563EB] text-white px-5 py-3 rounded-xl text-sm font-medium hover:bg-[#1E4FD6] disabled:opacity-50"
                  >
                    {loading ? "Scanning..." : "Run scan"}
                  </button>
                </div>
                <div className="mt-4 bg-black text-white rounded-xl p-5 font-mono text-xs h-64 overflow-y-auto">
                  {auditOutput.map((log, i) => (
                    <p
                      key={i}
                      className={
                        log.includes("CRITICAL") || log.includes("HIGH")
                          ? "text-red-400"
                          : "text-white/90"
                      }
                    >
                      {log}
                    </p>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-black/10 bg-[#F9FAFB] p-6">
                <div className="text-sm font-medium mb-4">Recent scans</div>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg bg-white border border-black/5 px-4 py-3"
                    >
                      <div className="flex items-center justify-between text-xs text-black/50 mb-2">
                        <span>{item.created_at.split(" ")[0]}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            item.critical_level
                              ? "bg-red-50 text-red-600"
                              : "bg-emerald-50 text-emerald-600"
                          }`}
                        >
                          {item.critical_level ? "CRITICAL" : "SECURE"}
                        </span>
                      </div>
                      <div className="text-sm font-medium truncate">
                        {item.target.split("/").pop()}
                      </div>
                    </div>
                  ))}
                  {history.length === 0 && (
                    <p className="text-xs text-black/50">No scans yet. Run the demo to start.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="rounded-2xl border border-black/10 bg-[#F5F7FF] p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
              <p className="text-black/60 mt-2">Scan, mitigate, and ship with confidence.</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-4 w-full md:w-auto">
              {[
                { step: "01", label: "Paste URL" },
                { step: "02", label: "AI Scans" },
                { step: "03", label: "Get Report" },
              ].map((s) => (
                <div
                  key={s.step}
                  className="rounded-xl bg-white border border-black/10 px-5 py-4 text-center"
                >
                  <div className="text-xs text-black/40">{s.step}</div>
                  <div className="font-medium mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-6 py-16">
          <div className="text-center">
            <h2 className="text-3xl font-semibold tracking-tight">Pricing that scales with your scans</h2>
            <p className="text-black/60 mt-2">Start free, upgrade when you need deeper coverage.</p>
          </div>
          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {[
              {
                name: "Free",
                price: "$0",
                desc: "Perfect for testing a repo before you ship.",
                features: ["5 scans", "Basic report", "Community support"],
                cta: "/signup?plan=free",
              },
              {
                name: "Pro",
                price: "$9/mo",
                desc: "For indie teams shipping AI features weekly.",
                features: [
                  "100 scans/mo",
                  "Detailed reports",
                  "API access",
                  "Email alerts",
                ],
                cta: "/signup?plan=pro",
                highlight: true,
              },
              {
                name: "Enterprise",
                price: "$29/mo",
                desc: "Security coverage for serious scale.",
                features: [
                  "Unlimited scans",
                  "Priority support",
                  "Team access",
                  "Webhooks",
                ],
                cta: "/signup?plan=enterprise",
              },
            ].map((tier) => (
              <div
                key={tier.name}
                className={`rounded-2xl border p-6 bg-white ${
                  tier.highlight
                    ? "border-[#2563EB] shadow-[0_20px_60px_-40px_rgba(37,99,235,0.7)]"
                    : "border-black/10"
                }`}
              >
                <div className="text-sm uppercase tracking-widest text-black/50">{tier.name}</div>
                <div className="text-3xl font-semibold mt-2">{tier.price}</div>
                <p className="text-sm text-black/60 mt-2">{tier.desc}</p>
                <ul className="mt-5 space-y-2 text-sm">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check size={14} className="text-[#2563EB]" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to={tier.cta}
                  className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm ${
                    tier.highlight
                      ? "bg-[#2563EB] text-white hover:bg-[#1E4FD6]"
                      : "border border-black/15 hover:border-black"
                  }`}
                >
                  Choose {tier.name}
                  <ArrowRight size={16} />
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote:
                  "We caught prompt injection attacks that our appsec tooling missed. VibeCheck paid for itself in a week.",
                name: "Ari P.",
                title: "CTO, LatticeForge",
              },
              {
                quote:
                  "The scanner fits our CI pipeline perfectly. The reports are crisp and executive-ready.",
                name: "Dana K.",
                title: "Head of DevOps, Brightloop",
              },
              {
                quote:
                  "We ship AI features fast. VibeCheck is the safety net that keeps our users safe.",
                name: "Miguel R.",
                title: "VP Engineering, AlloyLabs",
              },
            ].map((t) => (
              <div
                key={t.name}
                className="rounded-2xl border border-black/10 bg-white p-6"
              >
                <Quote size={18} className="text-[#2563EB]" />
                <p className="mt-4 text-sm text-black/70">{t.quote}</p>
                <div className="mt-4 text-sm font-medium">{t.name}</div>
                <div className="text-xs text-black/50">{t.title}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid md:grid-cols-[0.9fr_1.1fr] gap-10">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">FAQ</h2>
              <p className="text-black/60 mt-2">
                Everything teams ask before they launch their first scan.
              </p>
            </div>
            <div className="space-y-4">
              {[
                {
                  q: "Does VibeCheck access private repositories?",
                  a: "Not in the public demo. Paid plans include API keys and secure access for private repos.",
                },
                {
                  q: "What languages do you support?",
                  a: "We scan JavaScript, TypeScript, Python, Go, and Java today, with more on the way.",
                },
                {
                  q: "How fast are reports?",
                  a: "Most scans complete in under two minutes depending on repo size.",
                },
                {
                  q: "Can I integrate this in CI?",
                  a: "Yes. Pro and Enterprise include API access for CI and webhooks.",
                },
              ].map((item) => (
                <div
                  key={item.q}
                  className="rounded-2xl border border-black/10 bg-white p-5"
                >
                  <div className="font-medium">{item.q}</div>
                  <div className="text-sm text-black/60 mt-2">{item.a}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="rounded-3xl border border-black/10 bg-black text-white p-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <div className="text-sm uppercase tracking-widest text-white/60">Ready to secure your AI stack?</div>
              <h2 className="text-3xl font-semibold mt-2">Start scanning with VibeCheck today</h2>
            </div>
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white text-black text-sm hover:bg-[#E8EDFF]"
            >
              Create your free account
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/10">
        <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-sm">
          <div>
            <div className="font-semibold">VibeCheck Security</div>
            <div className="text-black/50 text-xs">AI security scanner for vibe-coded projects.</div>
          </div>
          <div className="flex flex-wrap gap-4 text-black/60">
            <Link to="/signup" className="hover:text-[#2563EB]">Get started</Link>
            <a href="#features" className="hover:text-[#2563EB]">Features</a>
            <a href="#pricing" className="hover:text-[#2563EB]">Pricing</a>
            <a href="#faq" className="hover:text-[#2563EB]">FAQ</a>
          </div>
          <div className="text-black/40 text-xs">© 2026 VibeCheck Security</div>
        </div>
      </footer>
    </div>
  );
}
