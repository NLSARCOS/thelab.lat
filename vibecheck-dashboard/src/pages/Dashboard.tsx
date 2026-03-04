import { useEffect, useState } from 'react';
import axios from 'axios';
import { Activity, History, Key, LogOut, RefreshCw, Loader2, TerminalSquare, ShieldCheck, Copy, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const api = axios.create();
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vb_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Shield Tab Component ─────────────────────────────────────────────────────
function ShieldTab({ plan, handleUpgrade, upgrading }: { plan: string; handleUpgrade: (p: string) => void; upgrading: string | null }) {
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [shieldKey, setShieldKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [snippetCopied, setSnippetCopied] = useState(false);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const r = await api.get('/api/shield/stats');
      setStats(r.data);
    } catch {
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (plan === 'shield') fetchStats();
  }, [plan]);

  const handleGenerateKey = async () => {
    setGeneratingKey(true);
    try {
      const r = await api.post('/api/shield/key');
      setShieldKey(r.data?.key ?? null);
      await fetchStats();
    } catch { } finally {
      setGeneratingKey(false);
    }
  };

  const copyToClipboard = (text: string, setCopiedFn: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopiedFn(true);
    setTimeout(() => setCopiedFn(false), 2000);
  };

  // ── UPSELL: free / pro ────────────────────────────────────────────────────
  if (plan !== 'shield') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ background: '#09090B', borderRadius: '1.5rem', padding: '3rem', color: '#fff', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: '1rem' }}>🛡️</div>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-.04em', margin: '0 0 1rem' }}>VibeCheck Shield</h2>
          <p style={{ color: '#71717A', fontSize: 15, lineHeight: 1.7, maxWidth: 480, margin: '0 auto 2rem' }}>
            Real-time WAF, Honeypot, Anti-spam and Rate Limiting for your Node.js app — activated with one line of code.
            Block SQL injection, XSS, bot attacks and credential stuffing before they hit your database.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem', maxWidth: 600, margin: '0 auto 2rem' }}>
            {['WAF — 50+ rules', 'Honeypot traps', 'Anti-spam engine', 'Rate limiter', 'IP blocklist', '1-line install'].map(f => (
              <div key={f} style={{ background: '#111113', borderRadius: '1rem', padding: '.75rem 1rem', fontSize: 12, fontWeight: 700, color: '#4ADE80', textAlign: 'center' }}>{f}</div>
            ))}
          </div>
          <button
            onClick={() => handleUpgrade('shield')}
            disabled={!!upgrading}
            style={{
              background: '#4ADE80', color: '#09090B', border: 'none', borderRadius: '100px',
              padding: '1rem 2.5rem', fontSize: 14, fontWeight: 900, textTransform: 'uppercase',
              letterSpacing: '.1em', cursor: upgrading ? 'not-allowed' : 'pointer',
              opacity: upgrading === 'shield' ? .6 : 1, display: 'inline-flex', alignItems: 'center', gap: '.5rem'
            }}
          >
            {upgrading === 'shield' ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <ShieldCheck size={16} />}
            {upgrading === 'shield' ? 'Redirecting...' : 'Activate Shield $29/mo →'}
          </button>
        </div>
      </div>
    );
  }

  // ── SHIELD PLAN: real data ────────────────────────────────────────────────
  const isActive = stats?.shieldActive === true;
  const installKey = shieldKey || 'shld_live_your_key_here';
  const snippet = `app.use(shield({ apiKey: '${installKey}' }))`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header card */}
      <div style={{ background: '#09090B', borderRadius: '1.5rem', padding: '2.5rem', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              {loadingStats ? (
                <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.2em', color: '#71717A' }}>Loading...</span>
              ) : isActive ? (
                <>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#4ADE80', boxShadow: '0 0 12px #4ADE80', animation: 'pulse 2s infinite', flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.2em', color: '#4ADE80' }}>Shield Active</span>
                </>
              ) : (
                <>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#71717A', flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.2em', color: '#71717A' }}>Not Connected</span>
                </>
              )}
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-.04em', margin: '0 0 .5rem' }}>
              {isActive ? 'Your App is Protected' : 'Connect Shield to your app'}
            </h2>
            <p style={{ color: '#71717A', fontSize: 14, margin: 0 }}>
              {isActive
                ? `Last event: ${stats?.shieldKeyLastUsed ? new Date(stats.shieldKeyLastUsed).toLocaleString() : 'N/A'}`
                : 'Generate an API key and install the middleware to activate Shield.'}
            </p>
          </div>
          <button
            onClick={fetchStats}
            style={{ background: 'none', border: '1px solid #27272A', borderRadius: 100, padding: '.5rem 1.2rem', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.1em', color: '#71717A', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '.5rem' }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
        {[
          { label: 'Total Events', val: stats?.stats?.total ?? '—', color: '#09090B' },
          { label: 'Blocked', val: stats?.stats?.blocked ?? '—', color: '#EF4444' },
          { label: 'Allowed', val: stats?.stats?.allowed ?? '—', color: '#4ADE80' },
        ].map(s => (
          <div key={s.label} style={{ background: '#09090B', border: '1px solid #1F1F23', borderRadius: '1.5rem', padding: '1.5rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: s.color, letterSpacing: '-.04em', lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.15em', color: '#71717A', marginTop: 6 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Generate API Key */}
      <div style={{ background: '#09090B', border: '1px solid #1F1F23', borderRadius: '1.5rem', padding: '2rem' }}>
        <div style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.2em', color: '#71717A', marginBottom: '1.5rem' }}>API Key</div>
        <button
          onClick={handleGenerateKey}
          disabled={generatingKey}
          style={{
            background: '#4ADE80', color: '#09090B', border: 'none', borderRadius: '100px',
            padding: '.9rem 2rem', fontWeight: 900, fontSize: 11, textTransform: 'uppercase',
            letterSpacing: '.1em', cursor: generatingKey ? 'not-allowed' : 'pointer',
            opacity: generatingKey ? .6 : 1, display: 'inline-flex', alignItems: 'center', gap: '.5rem'
          }}
        >
          {generatingKey ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Key size={14} />}
          {generatingKey ? 'Generating...' : 'Generate API Key'}
        </button>

        {shieldKey && (
          <div style={{ marginTop: '1.5rem', background: '#111113', borderRadius: '1rem', padding: '1.25rem 1.5rem' }}>
            <div style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.2em', color: '#4ADE80', marginBottom: '.75rem' }}>
              ✓ Save this key — shown only once
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <code style={{ fontFamily: 'monospace', fontSize: 13, color: '#fff', flex: 1, wordBreak: 'break-all' }}>{shieldKey}</code>
              <button
                onClick={() => copyToClipboard(shieldKey, setCopied)}
                style={{ background: 'none', border: '1px solid #27272A', borderRadius: 8, padding: '.4rem .6rem', cursor: 'pointer', color: copied ? '#4ADE80' : '#71717A', flexShrink: 0 }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Install snippet */}
      <div style={{ background: '#09090B', border: '1px solid #1F1F23', borderRadius: '1.5rem', padding: '2rem' }}>
        <div style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.2em', color: '#71717A', marginBottom: '1rem' }}>Installation</div>
        <div style={{ background: '#111113', borderRadius: '1rem', padding: '1.2rem 1.5rem', fontFamily: 'monospace', fontSize: 13, color: '#4ADE80', lineHeight: 1.8, position: 'relative' }}>
          <div style={{ color: '#52525B' }}>npm install @thelab.lat/vibecheck-shield</div>
          <div style={{ color: '#52525B', marginTop: '.25rem' }}>// in your server file:</div>
          <div style={{ color: '#4ADE80', marginTop: '.25rem' }}>{`import { shield } from '@thelab.lat/vibecheck-shield';`}</div>
          <div style={{ color: '#fff' }}>{snippet}</div>
          <button
            onClick={() => copyToClipboard(snippet, setSnippetCopied)}
            style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: '1px solid #27272A', borderRadius: 8, padding: '.4rem .6rem', cursor: 'pointer', color: snippetCopied ? '#4ADE80' : '#71717A' }}
          >
            {snippetCopied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      {/* Recent events table */}
      <div style={{ background: '#09090B', border: '1px solid #1F1F23', borderRadius: '1.5rem', padding: '2rem' }}>
        <div style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.2em', color: '#71717A', marginBottom: '1.5rem' }}>Recent Events</div>
        {(!stats?.recent || stats.recent.length === 0) ? (
          <div style={{ color: '#52525B', fontSize: 13, textAlign: 'center', padding: '2rem' }}>
            {isActive ? 'No events yet.' : 'Connect Shield to start seeing events.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Type', 'Path', 'Score', 'Status', 'Timestamp'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '.5rem .75rem', fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.15em', color: '#3F3F46', borderBottom: '1px solid #1F1F23' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((ev: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid #111113' }}>
                    <td style={{ padding: '.75rem', color: '#fff', fontWeight: 700 }}>{ev.type ?? '—'}</td>
                    <td style={{ padding: '.75rem', color: '#71717A', fontFamily: 'monospace', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.path ?? '—'}</td>
                    <td style={{ padding: '.75rem', color: '#fff' }}>{ev.score ?? '—'}</td>
                    <td style={{ padding: '.75rem' }}>
                      <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.1em', padding: '.25rem .6rem', borderRadius: 100, background: ev.status === 'blocked' ? '#450a0a' : '#052e16', color: ev.status === 'blocked' ? '#EF4444' : '#4ADE80' }}>
                        {ev.status ?? '—'}
                      </span>
                    </td>
                    <td style={{ padding: '.75rem', color: '#52525B', whiteSpace: 'nowrap' }}>
                      {ev.timestamp ? new Date(ev.timestamp).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('vb_user') || '{}');
  const [scanTarget, setScanTarget] = useState('');
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scans, setScans] = useState<any[]>([]);
  const [keys, setKeys] = useState<any[]>([]);
  const [keyLabel, setKeyLabel] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState(false);
  const [activeTab, setActiveTab] = useState<'scan'|'history'|'keys'|'shield'>('scan');
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const handleUpgrade = async (planId: string) => {
    setUpgrading(planId);
    try {
      const res = await api.post('/api/payments/checkout', { packageId: planId });
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not start checkout. Try again.');
    } finally {
      setUpgrading(null);
    }
  };

  useEffect(() => {
    api.get('/api/auth/me').then(res => {
      localStorage.setItem('vb_user', JSON.stringify(res.data.user));
      refreshAll();
    }).catch(() => {
      localStorage.removeItem('vb_token');
      localStorage.removeItem('vb_user');
      navigate('/login');
    });
  }, []);

  const refreshAll = () => Promise.all([fetchScans(), fetchKeys()]);
  const fetchScans = async () => { try { const r = await api.get('/api/scans'); setScans(r.data?.scans ?? []); } catch { setScans([]); } };
  const fetchKeys = async () => { try { const r = await api.get('/api/keys'); setKeys(r.data?.keys ?? []); } catch { setKeys([]); } };

  const handleScan = async () => {
    if (!scanTarget) { setScanError('Enter a GitHub repository URL'); return; }
    setScanError(''); setScanLoading(true);
    try {
      await api.post('/api/scan', { repoUrl: scanTarget });
      setScanTarget('');
      await fetchScans();
      setActiveTab('history');
    } catch (e: any) {
      setScanError(e?.response?.data?.error || 'Scan failed. Try again.');
    } finally { setScanLoading(false); }
  };

  const handleCreateKey = async () => {
    setCreatingKey(true); setNewKey(null);
    try {
      const r = await api.post('/api/keys', { name: keyLabel || 'Default' });
      setNewKey(r.data?.key ?? null); setKeyLabel(''); await fetchKeys();
    } catch { } finally { setCreatingKey(false); }
  };

  const handleRevokeKey = async (id: string) => { await api.delete(`/api/keys/${id}`); await fetchKeys(); };
  const handleLogout = () => { localStorage.removeItem('vb_token'); localStorage.removeItem('vb_user'); navigate('/login'); };

  const navItems = [
    { id: 'scan', icon: TerminalSquare, label: 'New Scan' },
    { id: 'history', icon: History, label: 'Audit History' },
    { id: 'keys', icon: Key, label: 'API Keys' },
    { id: 'shield', icon: ShieldCheck, label: 'Shield' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#FCFCFD', color: '#09090B', display: 'flex', fontFamily: "'Space Grotesk', sans-serif" }}>

      {/* Sidebar */}
      <nav style={{ width: 260, background: '#09090B', display: 'flex', flexDirection: 'column', padding: '2rem 1.5rem', gap: '2rem', position: 'sticky', top: 0, height: '100vh', flexShrink: 0 }}>
        {/* Logo */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.3em', color: '#fff' }}>
            VibeCheck<span style={{ opacity: .3 }}> Security</span>
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.2em', color: '#4ADE80', marginTop: 4 }}>Shield Active</div>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          <div style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.2em', color: '#3F3F46', marginBottom: '.5rem' }}>Main</div>
          {navItems.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setActiveTab(id as any)} style={{
              display: 'flex', alignItems: 'center', gap: '.75rem',
              padding: '.75rem 1rem', borderRadius: '.75rem', border: 'none', cursor: 'pointer',
              background: activeTab === id ? '#4ADE80' : 'transparent',
              color: activeTab === id ? '#09090B' : '#71717A',
              fontWeight: 900, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em',
              transition: 'all .2s', textAlign: 'left',
            }}>
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* User + plan */}
        <div style={{ borderTop: '1px solid #1F1F23', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: '#111113', borderRadius: '1rem', padding: '1rem' }}>
            <div style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.2em', color: '#3F3F46', marginBottom: 8 }}>Current Plan</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.15em', padding: '.35rem .9rem', borderRadius: 100, background: user.plan === 'shield' ? '#4ADE80' : user.plan === 'pro' ? '#3B82F6' : '#27272A', color: user.plan === 'free' ? '#A1A1AA' : '#09090B' }}>
                {user.plan || 'Free'}
              </span>
            </div>
            {(!user.plan || user.plan === 'free') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', marginTop: '.75rem' }}>
                <button onClick={() => handleUpgrade('pro')} disabled={!!upgrading} style={{ background: '#4ADE80', color: '#09090B', border: 'none', borderRadius: 100, padding: '.4rem 1rem', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.1em', cursor: upgrading ? 'not-allowed' : 'pointer', width: '100%', opacity: upgrading === 'pro' ? .6 : 1 }}>
                  {upgrading === 'pro' ? '...' : 'Pro $9/mo →'}
                </button>
                <button onClick={() => handleUpgrade('shield')} disabled={!!upgrading} style={{ background: 'transparent', color: '#4ADE80', border: '1px solid #4ADE80', borderRadius: 100, padding: '.4rem 1rem', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.1em', cursor: upgrading ? 'not-allowed' : 'pointer', width: '100%', opacity: upgrading === 'shield' ? .6 : 1 }}>
                  {upgrading === 'shield' ? '...' : 'Shield $29/mo →'}
                </button>
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#52525B', fontWeight: 700 }}>{user.email}</div>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', background: 'none', border: 'none', color: '#52525B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em', cursor: 'pointer', padding: '.5rem 0' }}>
            <LogOut size={14} /> Logout
          </button>
        </div>
      </nav>

      {/* Main */}
      <main style={{ flex: 1, padding: '3rem', maxWidth: 900 }}>

        {/* Header */}
        <header style={{ marginBottom: '3rem' }}>
          <div style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.25em', color: '#71717A', marginBottom: '.5rem' }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#4ADE80', marginRight: 6, verticalAlign: 'middle' }} />
            Shield Active · Encrypted
          </div>
          <h1 style={{ fontSize: 'clamp(2rem,5vw,3.5rem)', fontWeight: 900, letterSpacing: '-.04em', lineHeight: .92, margin: 0 }}>
            {activeTab === 'scan' && 'New Scan'}
            {activeTab === 'history' && 'Audit History'}
            {activeTab === 'keys' && 'API Keys'}
            {activeTab === 'shield' && 'Shield Config'}
          </h1>
        </header>

        {/* TAB: NEW SCAN */}
        {activeTab === 'scan' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ background: '#fff', border: '1px solid #E4E4E7', borderRadius: '1.5rem', padding: '2rem' }}>
              <div style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.2em', color: '#71717A', marginBottom: '1.5rem' }}>GitHub Repository URL</div>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <input
                  placeholder="https://github.com/user/repo"
                  value={scanTarget}
                  onChange={e => setScanTarget(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleScan()}
                  style={{ flex: 1, minWidth: 260, background: '#F4F4F5', border: '1px solid #E4E4E7', borderRadius: '100px', padding: '.9rem 1.5rem', fontSize: 14, fontFamily: "'Space Grotesk', monospace", outline: 'none', color: '#09090B' }}
                />
                <button onClick={handleScan} disabled={scanLoading} style={{
                  background: '#09090B', color: '#fff', border: 'none', borderRadius: '100px',
                  padding: '.9rem 2rem', fontWeight: 900, fontSize: 11, textTransform: 'uppercase',
                  letterSpacing: '.1em', cursor: scanLoading ? 'not-allowed' : 'pointer',
                  opacity: scanLoading ? .5 : 1, display: 'flex', alignItems: 'center', gap: '.5rem'
                }}>
                  {scanLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Activity size={16} />}
                  {scanLoading ? 'Scanning...' : 'Run Scan'}
                </button>
              </div>
              {scanError && (
                <div style={{ marginTop: '1rem', padding: '1rem 1.5rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '1rem', fontSize: 13, color: '#EF4444', fontWeight: 700 }}>
                  {scanError}
                </div>
              )}
            </div>

            {/* Stats rápidos */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
              {[
                { label: 'Total Scans', val: scans.length, color: '#09090B' },
                { label: 'Critical Found', val: scans.filter(s => s.criticalFound > 0).length, color: '#EF4444' },
                { label: 'Clean Scans', val: scans.filter(s => s.criticalFound === 0).length, color: '#4ADE80' },
                { label: 'API Keys', val: keys.length, color: '#3B82F6' },
              ].map(s => (
                <div key={s.label} style={{ background: '#fff', border: '1px solid #E4E4E7', borderRadius: '1.5rem', padding: '1.5rem' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: s.color, letterSpacing: '-.04em', lineHeight: 1 }}>{s.val}</div>
                  <div style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.15em', color: '#71717A', marginTop: 6 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: HISTORY */}
        {activeTab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={fetchScans} style={{ background: 'none', border: '1px solid #E4E4E7', borderRadius: 100, padding: '.5rem 1.2rem', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.1em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
            {scans.length === 0 ? (
              <div style={{ background: '#fff', border: '1px solid #E4E4E7', borderRadius: '1.5rem', padding: '4rem', textAlign: 'center', color: '#71717A', fontSize: 14 }}>
                No scans yet. Run your first audit.
              </div>
            ) : scans.map(s => (
              <button key={s.id} onClick={() => navigate(`/dashboard/scan/${s.id}`)} style={{
                background: '#fff', border: '1px solid #E4E4E7', borderRadius: '1.5rem', padding: '1.5rem 2rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                cursor: 'pointer', transition: 'all .2s', textAlign: 'left', width: '100%'
              }}
                onMouseOver={e => (e.currentTarget.style.borderColor = '#09090B')}
                onMouseOut={e => (e.currentTarget.style.borderColor = '#E4E4E7')}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#09090B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.repoUrl}</div>
                  <div style={{ fontSize: 11, color: '#71717A', marginTop: 4 }}>{new Date(s.createdAt).toLocaleString()}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.1em', padding: '.3rem .8rem', borderRadius: 100, background: s.criticalFound > 0 ? '#FEF2F2' : '#F0FDF4', color: s.criticalFound > 0 ? '#EF4444' : '#4ADE80' }}>
                    {s.criticalFound > 0 ? `${s.criticalFound} CRITICAL` : 'SECURE'}
                  </span>
                  <span style={{ fontSize: 12, color: '#71717A', fontWeight: 700 }}>{s.issuesFound} issues</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* TAB: API KEYS */}
        {activeTab === 'keys' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ background: '#fff', border: '1px solid #E4E4E7', borderRadius: '1.5rem', padding: '2rem' }}>
              <div style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.2em', color: '#71717A', marginBottom: '1.5rem' }}>Generate New Key</div>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <input placeholder="Key label (e.g. CI/CD)" value={keyLabel} onChange={e => setKeyLabel(e.target.value)}
                  style={{ flex: 1, minWidth: 200, background: '#F4F4F5', border: '1px solid #E4E4E7', borderRadius: '100px', padding: '.9rem 1.5rem', fontSize: 14, fontFamily: "'Space Grotesk'", outline: 'none', color: '#09090B' }} />
                <button onClick={handleCreateKey} disabled={creatingKey} style={{ background: '#09090B', color: '#fff', border: 'none', borderRadius: '100px', padding: '.9rem 2rem', fontWeight: 900, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                  <Key size={14} /> Generate
                </button>
              </div>
              {newKey && (
                <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '1rem' }}>
                  <div style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.2em', color: '#4ADE80', marginBottom: '.5rem' }}>Save this key — shown only once</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#09090B', wordBreak: 'break-all', userSelect: 'all' }}>{newKey}</div>
                </div>
              )}
            </div>
            {keys.map(k => (
              <div key={k.id} style={{ background: '#fff', border: '1px solid #E4E4E7', borderRadius: '1.5rem', padding: '1.5rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#09090B' }}>{k.name}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#71717A', marginTop: 4 }}>{k.key}</div>
                  {k.createdAt && <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 4 }}>{new Date(k.createdAt).toLocaleDateString()}</div>}
                </div>
                <button onClick={() => handleRevokeKey(k.id)} style={{ background: 'none', border: '1px solid #FECACA', borderRadius: 100, padding: '.5rem 1.2rem', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.1em', color: '#EF4444', cursor: 'pointer' }}>
                  Revoke
                </button>
              </div>
            ))}
            {keys.length === 0 && <div style={{ color: '#71717A', fontSize: 14, textAlign: 'center', padding: '3rem' }}>No API keys yet.</div>}
          </div>
        )}

        {/* TAB: SHIELD */}
        {activeTab === 'shield' && <ShieldTab plan={user.plan} handleUpgrade={handleUpgrade} upgrading={upgrading} />}
      </main>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.4} }`}</style>
    </div>
  );
}
