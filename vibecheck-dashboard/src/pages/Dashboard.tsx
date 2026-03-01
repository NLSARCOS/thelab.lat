import { 
  Shield, Plus, 
  Settings, History, Activity,
  Globe, Github
} from 'lucide-react';

export default function Dashboard() {
  const user = JSON.parse(localStorage.getItem('vb_user') || '{}');

  return (
    <div className="min-h-screen bg-[#FCFCFD] text-[#09090B] flex">
      
      {/* Sidebar Command Center */}
      <nav className="w-72 bg-white border-r border-slate-100 flex flex-col p-8 gap-10 sticky top-0 h-screen shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-black rounded-xl border border-slate-800 shadow-xl">
            <Shield className="text-white" size={20} />
          </div>
          <span className="text-xl font-black tracking-tighter uppercase">VibeCheck</span>
        </div>

        <div className="flex-1 space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4 block">Main Ops</label>
          <NavItem icon={Activity} label="Monitoring" active />
          <NavItem icon={History} label="Audit Journals" />
          <NavItem icon={Github} label="Repo Connect" />
        </div>

        <div className="pt-6 border-t border-slate-50 space-y-4">
           <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 italic text-[11px] text-slate-500 leading-relaxed font-mono">
              Signed in as:<br/>
              <strong className="text-black not-italic">{user.name || 'VibeTester'}</strong>
           </div>
           <NavItem icon={Settings} label="System Config" />
        </div>
      </nav>

      {/* Main Control Console */}
      <main className="flex-1 p-12">
        <header className="flex justify-between items-end mb-16">
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase mb-1">Asset Control</h1>
            <p className="text-slate-400 font-light flex items-center gap-2 uppercase text-[10px] tracking-widest leading-none mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>
                Connection: fully_encrypted // Secure_Protocol: ACTIVE
            </p>
          </div>
          <button className="bg-black text-white px-8 py-3.5 rounded-xl font-black uppercase text-[11px] tracking-widest hover:bg-[#2563EB] shadow-xl shadow-blue-100 transition-all active:scale-95 flex items-center gap-2">
            <Plus size={16} /> New Asset Hub
          </button>
        </header>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           
           {/* Repos Card */}
           <section className="col-span-3 bg-white border border-slate-100 rounded-3xl p-10 flex flex-col items-center justify-center border-dashed min-h-[300px] hover:border-black/20 transition-colors">
              <div className="p-6 bg-slate-50 rounded-full mb-6 italic text-slate-400">
                 <Globe size={48} strokeWidth={1} />
              </div>
              <h3 className="text-lg font-black uppercase">No Active Repositories</h3>
              <p className="text-slate-400 text-sm text-center max-w-xs mt-2 font-light">
                 Conecta tu primer repositorio de GitHub o despliega el script de protección universal.
              </p>
              <button className="mt-8 px-10 py-3 border-2 border-black rounded-xl font-black uppercase text-xs hover:bg-black hover:text-white transition-all tracking-widest">
                 Connect Repository
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
