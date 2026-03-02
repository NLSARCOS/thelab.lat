"use client";

import { useState } from "react";
import { X, Database, Zap, Sparkles, Loader2, CreditCard } from "lucide-react";
import axios from "axios";

interface TokenPurchaseProps {
    isOpen: boolean;
    onClose: () => void;
    currentPlan?: string;
}

const PACKAGES = [
    { id: "pkg_1", name: "Boost Pack", tokens: 500000, actions: 500, price: 19 },
    { id: "pkg_2", name: "Pro Stack", tokens: 2000000, actions: 2000, price: 59, popular: true },
    { id: "pkg_3", name: "Neural Overdrive", tokens: 10000000, actions: 10000, price: 199 }
];

export default function TokenPurchaseModal({ isOpen, onClose }: TokenPurchaseProps) {
    const [selectedPkg, setSelectedPkg] = useState<string>("pkg_2");
    const [isProcessing, setIsProcessing] = useState(false);

    if (!isOpen) return null;

    const handlePurchase = async () => {
        setIsProcessing(true);
        try {
            // PRODUCCIÓN REAL: Crear checkout en DodoPayments
            const res = await axios.post('/api/payments/create-checkout', {
                packageId: selectedPkg,
                userId: "current-user-id" // Esto saldrá del auth context
            });
            
            if (res.data.url) {
                window.location.href = res.data.url; // Redirección al checkout real
            }
        } catch (e) {
            alert("[!] Error de pasarela. ¿Están las llaves configuradas?");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 overflow-y-auto">
            <div className="bg-white w-full max-w-2xl rounded-[3rem] p-10 relative shadow-2xl animate-fade-in border border-slate-100">
                <button onClick={onClose} className="absolute top-8 right-8 text-zinc-400 hover:text-zinc-900 transition-colors">
                    <X size={24} />
                </button>

                <div className="text-center mb-12">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Database className="text-blue-600" size={32} />
                    </div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-zinc-900">Neural Refill Station</h2>
                    <p className="text-zinc-500 font-light mt-2">Expande tu capacidad de defensa y auditoría instantáneamente.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mb-10">
                    {PACKAGES.map((pkg) => (
                        <div 
                            key={pkg.id} onClick={() => setSelectedPkg(pkg.id)}
                            className={`p-6 rounded-3xl border-2 transition-all cursor-pointer ${selectedPkg === pkg.id ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-100 hover:border-zinc-300'}`}
                        >
                            <h3 className="text-xs font-black uppercase text-zinc-400 mb-1">{pkg.name}</h3>
                            <div className="text-2xl font-black text-zinc-900 mb-6">${pkg.price}</div>
                            <ul className="space-y-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                <li className="flex items-center gap-2"><Sparkles size={12} className="text-blue-500"/> {pkg.tokens/1000}K Tokens</li>
                                <li className="flex items-center gap-2"><Zap size={12} className="text-emerald-500"/> {pkg.actions} Actions</li>
                            </ul>
                        </div>
                    ))}
                </div>

                <button 
                  onClick={handlePurchase} disabled={isProcessing}
                  className="w-full bg-zinc-900 hover:bg-black text-white py-6 rounded-3xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-zinc-200"
                >
                    {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <CreditCard size={20} />}
                    {isProcessing ? "Connecting to DodoPayments..." : "Initialize Secured Checkout"}
                </button>
                
                <p className="text-center text-[9px] font-black text-zinc-300 uppercase tracking-[0.3em] mt-8">Secure encryption protocol v3 // Dodopayments Verified</p>
            </div>
        </div>
    );
}
