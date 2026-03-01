"use client";

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Terminal, Bug, BarChart3, LogIn } from 'lucide-react';

export default function Landing() {
  const [auditOutput, setAuditOutput] = useState<string[]>(["/ VIBECHECK_CLI v1.2.0", "> Neural Bridge Established.", "> Waiting for project source..."]);
  const [repoPath, setRepoPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
        const res = await fetch("http://localhost:8080/v1/scanner/history");
        const data = await res.json();
        setHistory(data);
    } catch (e) { console.error(e); }
  };

  const runAudit = async () => {
    if (!repoPath) return alert("Please enter a path");
    setLoading(true);
    setAuditOutput(["> Initializing VFS_BRIDGE...", `> Accessing: ${repoPath}`]);
    
    try {
        const response = await fetch("http://localhost:8080/v1/scanner/audit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ repoPath: repoPath })
        });
        const data = await response.json();
        
        const logs = [
            `> Found ${data.issuesFound} vulnerabilities.`,
            ...data.issues.map((i: any) => `> [${i.severity}] ${i.ruleId}: ${i.description}`)
        ];
        
        if (data.issuesFound === 0) logs.push("> Status: SECURE_ENVIRONMENT");
        setAuditOutput(prev => [...prev, ...logs]);
        fetchHistory(); // Refresh history
    } catch (e) {
        setAuditOutput(prev => [...prev, "> CONNECTION_FAILURE: Core Engine unreachable."]);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FCFCFD] text-[#09090B]">
      {/* Sidebar minimalista */}
      <nav className="fixed top-0 left-0 h-full w-20 bg-white border-r border-slate-100 flex flex-col items-center py-10 gap-10">
        <Link to="/" className="p-3 bg-black rounded-2xl shadow-xl">
           <Shield className="text-white" size={24} />
        </Link>
        <div className="flex flex-col gap-8">
           <BarChart3 className="text-slate-400 hover:text-black cursor-pointer" size={20} />
           <Bug className="text-slate-400 hover:text-black cursor-pointer" size={20} />
           <Link to="/login" className="text-slate-400 hover:text-black cursor-pointer">
              <LogIn size={20} />
           </Link>
        </div>
      </nav>

      {/* Header Central */}
      <main className="pl-28 pr-10 py-12">
        <header className="mb-16 flex justify-between items-end">
          <div>
            <h1 className="text-5xl font-black tracking-tighter uppercase mb-2">VIBECHECK <span className="text-[#2563EB]">SECURITY</span></h1>
            <p className="text-slate-500 font-light text-xl italic">Gurkha Defensive Engine // Public Instance</p>
          </div>
          <div className="flex gap-4">
             <Link to="/login" className="btn-primary">
                SaaS Dashboard Access
             </Link>
             <div className="glass-card px-8 py-4 text-center">
                <span className="block text-[10px] font-black text-slate-400 uppercase mb-1">Status</span>
                <span className="text-emerald-500 font-bold flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/> FULLY_SHIELDED</span>
             </div>
          </div>
        </header>

        {/* Grid Principal */}
        <div className="grid grid-cols-12 gap-8">
          
          {/* Card 1: Scanner de Repos */}
          <section className="col-span-8 glass-card p-10 relative overflow-hidden group">
            <div className="relative z-10">
              <h2 className="text-2xl font-black uppercase tracking-tighter mb-6 flex items-center gap-3">
                 <Terminal size={24} className="text-blue-600" /> Public Repo Scanner
              </h2>
              <div className="flex gap-4 mb-10">
                 <input 
                   placeholder="Enter directory path for local audit..." 
                   value={repoPath}
                   onChange={(e) => setRepoPath(e.target.value)}
                   className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-6 py-4 text-sm outline-none focus:border-blue-600 transition-all font-mono"
                 />
                 <button 
                   onClick={runAudit}
                   disabled={loading}
                   className="bg-black text-white px-10 py-4 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-[#2563EB] transition-all active:scale-95 disabled:opacity-30">
                    {loading ? "Running..." : "Execute Audit"}
                 </button>
              </div>

              <div className="bg-[#09090B] p-6 rounded-xl font-mono text-emerald-400 text-xs shadow-2xl h-64 overflow-y-auto text-left">
                 {auditOutput.map((log, i) => (
                     <p key={i} className={log.includes("CRITICAL") || log.includes("HIGH") ? "text-red-500" : "text-white"}>{log}</p>
                 ))}
              </div>
            </div>
          </section>

          {/* Card 2: History */}
          <section className="col-span-4 space-y-8">
            <div className="glass-card p-10 bg-slate-50/50 border-dashed">
              <h2 className="text-xl font-black uppercase mb-8">Audits History</h2>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {history.map((item) => (
                    <div key={item.id} className="p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-mono text-slate-400">{item.created_at.split(' ')[0]}</span>
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${item.critical_level ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                                {item.critical_level ? 'CRITICAL' : 'SECURE'}
                            </span>
                        </div>
                        <p className="text-xs font-bold truncate text-slate-800">{item.target.split('/').pop()}</p>
                    </div>
                  ))}
                  {history.length === 0 && <p className="text-center text-xs text-slate-400 italic">Initializing history link...</p>}
              </div>
            </div>

            <div className="glass-card p-8">
                <h3 className="text-sm font-black uppercase mb-4">Security Scoring</h3>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[94%]" />
                </div>
                <div className="flex justify-between mt-2 font-mono text-[10px] font-bold">
                    <span>TRUST_INDEX</span>
                    <span>94%</span>
                </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
