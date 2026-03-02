import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Shield, Settings, History, Activity, Github, RefreshCw,
  Key, TerminalSquare, CreditCard, Loader2, LogOut
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const api = axios.create();
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vb_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default function Dashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('vb_user') || '{}');
  const [credits, setCredits] = useState<number | null>(null);
  const [scanTarget, setScanTarget] = useState('');
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scans, setScans] = useState<any[]>([]);
  const [keys, setKeys] = useState<any[]>([]);
  const [keyLabel, setKeyLabel] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState(false);

  useEffect(() => {
    // Verify token is valid on mount
    api.get('/api/auth/me').then(res => {
      localStorage.setItem('vb_user', JSON.stringify(res.data.user));
      refreshAll();
    }).catch(() => {
      localStorage.removeItem('vb_token');
      localStorage.removeItem('vb_user');
      navigate('/login');
    });
  }, []);

  const refreshAll = () => Promise.all([fetchCredits(), fetchScans(), fetchKeys()]);

  const fetchCredits = async () => {
    try {
      const res = await api.get('/api/credits/balance');
      setCredits(res.data?.credits ?? 0);
    } catch { setCredits(null); }
  };

  const fetchScans = async () => {
    try {
      const res = await api.get('/api/scans');
      setScans(res.data?.scans ?? []);
    } catch { setScans([]); }
  };

  const fetchKeys = async () => {
    try {
      const res = await api.get('/api/keys');
      setKeys(res.data?.keys ?? []);
    } catch { setKeys([]); }
  };

  const handleScan = async () => {
    if (!scanTarget) { setScanError('Enter a repository URL'); return; }
    setScanError('');
    setScanLoading(true);
    try {
      await api.post('/api/scan', { repoUrl: scanTarget });
      setScanTarget('');
      await Promise.all([fetchScans(), fetchCredits()]);
    } catch (e: any) {
      setScanError(e?.response?.data?.error || 'Scan failed');
    } finally { setScanLoading(false); }
  };

  const handleCreateKey = async () => {
    setCreatingKey(true);
    setNewKey(null);
    try {
      const res = await api.post('/api/keys', { name: keyLabel || 'Default' });
      setNewKey(res.data?.key ?? null);
      setKeyLabel('');
      await fetchKeys();
    } catch { /* */ }
    finally { setCreatingKey(false); }
  };

  const handleRevokeKey = async (id: string) => {
    await api.delete(`/api/keys/${id}`);
    await fetchKeys();
  };

  const handleLogout = () => {
    localStorage.removeItem('vb_token');
    localStorage.removeItem('vb_user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#FCFCFD] text-[#09090B] flex">
      {/* Sidebar */}
      <nav className="w-72 bg-white border-r border-slate-100 flex flex-col p-8 gap-10 sticky top-0 h-screen shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-black rounded-xl shadow-xl">
            <Shield className="text-white" size={20} />
          </div>
          <span className="text-xl font-black tracking-tighter uppercase">VibeCheck</span>
        </div>

        <div className="flex-1 space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4 block">Main Ops</label>
          <NavItem icon={Activity} label="Monitoring" active />
          <NavItem icon={History} label="Audit History" />
          <NavItem icon={Github} label="Repo Connect" />
        </div>

        <div className="pt-6 border-t border-slate-50 space-y-4">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] text-slate-500 font-mono">
            Signed in as:<br />
            <strong className="text-black">{user.name || 'Operator'}</strong>
          </div>
          <NavItem icon={Settings} label="Settings" />
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all w-full">
            <LogOut size={18} />
            <span className="text-[12px] font-bold uppercase tracking-tight">Logout</span>
          </button>
        </div>
      </nav>

      {/* Main */}
      <main className="flex-1 p-12">
        <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-8 mb-12">
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase mb-1">Asset Control</h1>
            <p className="text-slate-400 font-light flex items-center gap-2 uppercase text-[10px] tracking-widest mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Connection: encrypted // Protocol: ACTIVE
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl px-6 py-4 min-w-[240px]">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operator</div>
              <div className="text-sm font-black uppercase tracking-tight mt-1">{user.name || 'Operator'}</div>
              <div className="text-[11px] text-slate-400 font-mono mt-1 truncate">{user.email || ''}</div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Credits</span>
                <span className="text-sm font-black text-black">{credits ?? '...'}</span>
              </div>
            </div>
            <button onClick={() => refreshAll()} className="bg-black text-white px-6 py-3 rounded-xl font-black uppercase text-[11px] tracking-widest hover:bg-[#2563EB] shadow-xl transition-all active:scale-95 flex items-center gap-2">
              <RefreshCw size={16} /> Sync
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Scan Form */}
          <section className="lg:col-span-7 bg-white border border-slate-200 shadow-sm rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <TerminalSquare size={18} className="text-blue-600" />
              <h2 className="text-lg font-black uppercase tracking-tight">Repository Scan</h2>
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              <input
                placeholder="https://github.com/user/repo"
                value={scanTarget}
                onChange={(e) => setScanTarget(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-6 py-4 text-sm outline-none focus:border-blue-600 transition-all font-mono"
              />
              <button
                onClick={handleScan}
                disabled={scanLoading}
                className="bg-black text-white px-8 py-4 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-[#2563EB] transition-all active:scale-95 disabled:opacity-30 flex items-center justify-center gap-2"
              >
                {scanLoading ? <Loader2 className="animate-spin" size={16} /> : <Activity size={16} />}
                {scanLoading ? 'Scanning...' : 'Run Scan'}
              </button>
            </div>
            {scanError && (
              <div className="mt-4 p-4 border border-red-100 bg-red-50 rounded-xl text-xs font-bold text-red-600">
                &gt; {scanError}
              </div>
            )}
          </section>

          {/* Scan History */}
          <section className="lg:col-span-5 bg-white border border-slate-200 shadow-sm rounded-2xl p-8 border-dashed">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black uppercase tracking-tight">Scan History</h2>
              <button onClick={fetchScans} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-black">Refresh</button>
            </div>
            <div className="space-y-4 max-h-[360px] overflow-y-auto pr-2">
              {scans.map((item) => (
                <div key={item.id} className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-mono text-slate-400">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${item.criticalFound > 0 ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                      {item.criticalFound > 0 ? 'CRITICAL' : 'SECURE'}
                    </span>
                  </div>
                  <p className="text-xs font-bold truncate text-slate-800">{item.repoUrl}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-1">Issues: {item.issuesFound}</p>
                </div>
              ))}
              {scans.length === 0 && <p className="text-center text-xs text-slate-400 italic">No scans yet. Run the first audit.</p>}
            </div>
          </section>

          {/* API Keys */}
          <section className="lg:col-span-12 bg-white border border-slate-200 shadow-sm rounded-2xl p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight">API Keys</h2>
                <p className="text-xs text-slate-400 font-mono">Use keys to authenticate automated pipelines.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  placeholder="Key label"
                  value={keyLabel}
                  onChange={(e) => setKeyLabel(e.target.value)}
                  className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs outline-none focus:border-blue-600 transition-all font-mono"
                />
                <button
                  onClick={handleCreateKey}
                  disabled={creatingKey}
                  className="bg-black text-white px-6 py-3 rounded-xl font-black uppercase text-[11px] tracking-widest hover:bg-[#2563EB] transition-all active:scale-95 flex items-center gap-2 disabled:opacity-30"
                >
                  {creatingKey ? <Loader2 className="animate-spin" size={14} /> : <Key size={14} />}
                  Generate Key
                </button>
              </div>
            </div>

            {newKey && (
              <div className="mb-6 p-4 border border-emerald-100 bg-emerald-50 rounded-xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">New Key (save it now!)</p>
                <p className="mt-2 font-mono text-xs text-emerald-800 break-all select-all">{newKey}</p>
              </div>
            )}

            <div className="space-y-3">
              {keys.length === 0 && (
                <div className="text-xs text-slate-400 italic">No keys yet. Generate one to enable API access.</div>
              )}
              {keys.map((k) => (
                <div key={k.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <div className="text-xs font-black uppercase tracking-widest text-slate-600">{k.name}</div>
                    <div className="text-[11px] font-mono text-slate-400 mt-1 break-all">{k.key}</div>
                    {k.createdAt && <div className="text-[10px] text-slate-400 mt-2 font-mono">Created: {new Date(k.createdAt).toLocaleDateString()}</div>}
                  </div>
                  <button
                    onClick={() => handleRevokeKey(k.id)}
                    className="text-[10px] font-black uppercase tracking-widest text-red-500 border border-red-100 px-4 py-2 rounded-lg hover:bg-red-50"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Credits Bar */}
          <section className="lg:col-span-12 bg-white border border-slate-200 shadow-sm rounded-2xl p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard size={18} className="text-blue-600" />
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Credits Balance</p>
                <p className="text-sm font-black text-zinc-900">{credits ?? '...'} available</p>
              </div>
            </div>
            <button className="border-2 border-black px-6 py-2 rounded-xl font-black uppercase text-[11px] tracking-widest hover:bg-black hover:text-white transition-all">
              Add Credits
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon: Icon, label, active = false }: any) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all ${active ? 'bg-black text-white shadow-xl' : 'text-slate-500 hover:bg-slate-50 hover:text-black'}`}>
      <Icon size={18} />
      <span className="text-[12px] font-bold uppercase tracking-tight">{label}</span>
    </div>
  );
}
