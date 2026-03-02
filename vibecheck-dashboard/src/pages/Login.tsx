import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Shield, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      if (res.data.success) {
        localStorage.setItem('vb_token', res.data.token);
        localStorage.setItem('vb_user', JSON.stringify(res.data.user));
        
        if (res.data.user.role === 'ADMIN') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to authenticate. Access Denied.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FCFCFD] flex items-center justify-center p-6 border-t-8 border-black">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="mb-10 text-center">
          <div className="p-4 bg-black rounded-[2rem] inline-block shadow-2xl mb-4">
             <Shield className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-black tracking-tighter uppercase text-zinc-900">VibeCheck <span className="text-[#2563EB]">Access</span></h1>
        </div>
        <div className="w-full bg-white border border-slate-200 p-10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.03)]">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold animate-pulse text-center">
                &gt; INVALID_CREDENTIALS: {error}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2">Neural Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="email" required placeholder="name@company.com" 
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-6 py-4 outline-none focus:border-black focus:ring-4 focus:ring-slate-100 transition-all font-medium text-sm text-zinc-900"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2">Encrypted Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="password" required placeholder="••••••••" 
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-6 py-4 outline-none focus:border-black focus:ring-4 focus:ring-slate-100 transition-all font-medium text-sm text-zinc-900"
                />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-black text-white py-5 rounded-3xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 hover:bg-[#111] active:scale-95 transition-all shadow-xl shadow-slate-200">
              {loading ? <Loader2 className="animate-spin" size={18} /> : <>Initialize Session <ArrowRight size={18} /></>}
            </button>
          </form>
          <div className="mt-8 text-center pt-6 border-t border-slate-50">
             <p className="text-zinc-400 text-xs">Not a member yet? <Link to="/signup" className="text-black font-black hover:underline uppercase tracking-tighter">Register protocol</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}
