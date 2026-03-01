import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Shield, Users, Globe, History, 
  ArrowLeft 
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const user = JSON.parse(localStorage.getItem('vb_user') || '{}');
  const navigate = useNavigate();

  useEffect(() => {
    if (user.role !== 'ADMIN') navigate('/dashboard');
    fetchStats();
  }, [user.role, navigate]);

  const fetchStats = async () => {
    try {
        const res = await axios.get('https://security.thelab.lat/api/admin/stats');
        setStats(res.data);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="min-h-screen bg-black text-white flex">
      <nav className="w-72 border-r border-white/5 flex flex-col p-8 gap-10 bg-[#050505]">
        <div className="flex items-center gap-3">
          <Shield className="text-[#00f2fe]" size={24} />
          <span className="text-xl font-black uppercase tracking-tighter">VibeAdmin</span>
        </div>
        <div className="flex-1 space-y-2">
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mb-4">Master View</p>
            <NavItem label="Global Overview" active />
            <NavItem label="User Registry" />
            <NavItem label="Security Nodes" />
        </div>
        <Link to="/dashboard" className="flex items-center gap-2 text-xs font-bold text-white/50 hover:text-white uppercase tracking-widest">
            <ArrowLeft size={14} /> Exit Admin
        </Link>
      </nav>

      <main className="flex-1 p-12 overflow-auto">
        <header className="mb-16">
            <h1 className="text-4xl font-black uppercase tracking-tighter">Platform Control</h1>
            <p className="text-white/40 text-xs font-mono uppercase mt-2 italic">authorized: {user.name} // level: supreme_admin</p>
        </header>

        <div className="grid grid-cols-4 gap-6 mb-12">
            <StatCard label="Total Users" value={stats?.users || 0} icon={Users} color="text-blue-500" />
            <StatCard label="Active Repos" value={stats?.repos || 0} icon={Globe} color="text-purple-500" />
            <StatCard label="Audit Cycles" value={stats?.audits || 0} icon={History} color="text-emerald-500" />
            <StatCard label="Shield Blocks" value={stats?.shields || 0} icon={Shield} color="text-red-500" />
        </div>
      </main>
    </div>
  );
}

function NavItem({ label, active = false }: any) {
  return (
    <div className={`px-4 py-3 rounded-xl cursor-pointer text-xs font-bold uppercase tracking-widest ${active ? 'bg-white/10 text-white border border-white/10' : 'text-white/40 hover:text-white'}`}>
        {label}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
    return (
        <div className="bg-white/5 border border-white/5 p-8 rounded-3xl">
            <Icon className={`${color} mb-4`} size={20} />
            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">{label}</p>
            <p className="text-3xl font-black tracking-tighter">{value}</p>
        </div>
    );
}
