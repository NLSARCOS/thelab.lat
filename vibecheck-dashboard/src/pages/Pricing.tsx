import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Check, CreditCard, Loader2 } from 'lucide-react';

type Tier = {
  name: string;
  priceLabel: string;
  packageId?: string;
  cta: string;
  features: string[];
  highlighted?: boolean;
};

const TIERS: Tier[] = [
  {
    name: 'Free',
    priceLabel: '$0',
    cta: 'Get Started',
    features: ['5 scans / month', 'Basic issue summaries', 'Community support'],
  },
  {
    name: 'Pro',
    priceLabel: '$9',
    packageId: 'pro_monthly',
    cta: 'Start Pro',
    highlighted: true,
    features: ['150 scans / month', 'Full vulnerability insights', 'Priority email support', 'CI/CD API access'],
  },
  {
    name: 'Enterprise',
    priceLabel: '$29',
    packageId: 'enterprise_monthly',
    cta: 'Start Enterprise',
    features: ['Unlimited scans', 'Advanced policy controls', 'Team management', 'Dedicated support channel'],
  },
];

export default function Pricing() {
  const [loadingPackage, setLoadingPackage] = useState<string | null>(null);
  const [error, setError] = useState('');

  const startCheckout = async (packageId: string) => {
    setLoadingPackage(packageId);
    setError('');
    try {
      const token = localStorage.getItem('vb_token');
      const res = await axios.post(
        '/api/payments/checkout',
        { packageId },
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
      );
      if (res.data?.url) {
        window.location.href = res.data.url as string;
      }
    } catch (err: unknown) {
      const fallback = 'Unable to start checkout right now.';
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error ?? fallback);
      } else {
        setError(fallback);
      }
    } finally {
      setLoadingPackage(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2563EB]">Pricing</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-900">Simple plans for secure shipping</h1>
          <p className="mt-3 text-sm text-slate-500">Choose your plan and scale VibeCheck as your repos and teams grow.</p>
        </header>

        {error && (
          <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-600">
            {error}
          </div>
        )}

        <section className="mt-12 grid gap-6 lg:grid-cols-3">
          {TIERS.map((tier) => {
            const isLoading = loadingPackage === tier.packageId;
            return (
              <article
                key={tier.name}
                className={`rounded-3xl border bg-white p-8 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${
                  tier.highlighted ? 'border-[#2563EB] ring-1 ring-[#2563EB]/20' : 'border-slate-200'
                }`}
              >
                <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">{tier.name}</h2>
                <div className="mt-4 flex items-end gap-2">
                  <p className="text-4xl font-black text-slate-900">{tier.priceLabel}</p>
                  <span className="pb-1 text-sm text-slate-400">/month</span>
                </div>

                <ul className="mt-8 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                      <Check className="mt-0.5 text-[#2563EB]" size={16} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-10">
                  {tier.packageId ? (
                    <button
                      onClick={() => startCheckout(tier.packageId!)}
                      disabled={isLoading}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLoading ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
                      {isLoading ? 'Starting checkout...' : tier.cta}
                    </button>
                  ) : (
                    <Link
                      to="/signup?plan=free"
                      className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-bold text-slate-700 transition-colors hover:border-[#2563EB] hover:text-[#2563EB]"
                    >
                      {tier.cta}
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
