'use client';

import { useState } from 'react';
import { Subscription } from '@/types/subscription';
import { Copy, MessageCircle, Trash2, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';

const getServicioBadge = (servicio: string) => {
    switch ((servicio || 'Servicio').toUpperCase()) {
        case 'CHATGPT': return { label: 'ChatGPT', className: 'bg-teal-900/40 text-teal-400 border-teal-800/60' };
        case 'GEMINI': return { label: 'Gemini', className: 'bg-blue-900/40 text-blue-400 border-blue-800/60' };
        default: return { label: servicio || 'Servicio', className: 'bg-violet-900/40 text-[#4ade80] border-violet-800/60' };
    }
};

interface SubscriptionCardProps {
    sub: Subscription;
    onUpdate: (id: string, field: keyof Subscription, value: any) => void;
    onToggleStatus: (sub: Subscription) => void;
    onDelete: (id: string) => void;
    onWhatsApp: (sub: Subscription) => void;
    onCopy: (text: string) => void;
    dateInfo: { className: string; label: string; days: number };
}

export default function SubscriptionCard({
    sub,
    onUpdate,
    onToggleStatus,
    onDelete,
    onWhatsApp,
    onCopy,
    dateInfo
}: SubscriptionCardProps) {
    const [showPassword, setShowPassword] = useState(false);
    const badge = getServicioBadge(sub.servicio);

    return (
        <div className={`p-4 rounded-xl border shadow-sm ${sub.estado === 'ACTIVO' ? 'bg-white border-black/[0.08]' : 'bg-white border-black/[0.08] opacity-75'}`}>
            {/* Header: Number, Service badge and Status */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.className}`}>
                            {badge.label}
                        </span>
                    </div>
                    <label className="text-xs text-[#0F172A]/35 font-semibold uppercase">WhatsApp</label>
                    <input
                        className="block w-full font-mono text-[#0F172A] font-medium bg-transparent focus:bg-[#F7F8FA] focus:ring-1 focus:ring-[#25D366] rounded px-1 -ml-1"
                        defaultValue={sub.numero}
                        onBlur={(e) => onUpdate(sub.id, 'numero', e.target.value)}
                    />
                </div>
                <button
                    onClick={() => onToggleStatus(sub)}
                    className={`ml-2 px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors flex items-center gap-1 ${sub.estado === 'ACTIVO' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-[#111] text-[#0F172A]/35 border-black/[0.08]'}`}
                >
                    {sub.estado === 'ACTIVO' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                    {sub.estado}
                </button>
            </div>

            {/* Email */}
            <div className="mb-3">
                <label className="text-xs text-[#0F172A]/35 font-semibold uppercase">
                    Correo de la Cuenta
                </label>
                <div className="flex items-center gap-2">
                    <input
                        className="block w-full text-sm text-[#0F172A]/65 bg-transparent focus:bg-[#F7F8FA] focus:ring-1 focus:ring-[#25D366] rounded px-1 -ml-1 truncate"
                        defaultValue={sub.correo}
                        onBlur={(e) => onUpdate(sub.id, 'correo', e.target.value)}
                    />
                    <button
                        onClick={() => onCopy(sub.correo)}
                        className="p-2 text-[#0F172A]/40 hover:text-[#25D366] hover:bg-[#F7F8FA] rounded-lg transition-colors"
                        title="Copiar correo"
                    >
                        <Copy size={20} />
                    </button>
                </div>
            </div>

            {/* Password (only for ChatGPT/Gemini) */}
            {sub.password && (
                <div className="mb-4 p-3 bg-[#F7F8FA] rounded-lg border border-black/[0.08]/50">
                    <label className="text-xs text-[#0F172A]/35 font-semibold uppercase">Contraseña</label>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="flex-1 text-sm font-mono text-[#0F172A]/65">
                            {showPassword ? sub.password : '••••••••'}
                        </span>
                        <button
                            onClick={() => setShowPassword(p => !p)}
                            className="p-1.5 text-[#0F172A]/40 hover:text-[#0F172A] transition-colors"
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        <button
                            onClick={() => onCopy(sub.password!)}
                            className="p-1.5 text-[#0F172A]/40 hover:text-[#25D366] transition-colors"
                            title="Copiar contraseña"
                        >
                            <Copy size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Date & Team */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="text-xs text-[#0F172A]/35 font-semibold uppercase">Vencimiento</label>
                    <input
                        className={`block w-full text-sm font-medium rounded px-1 -ml-1 ${dateInfo.className.replace('text-slate-700', 'text-[#0F172A]/65').replace('bg-red-50', 'bg-red-900/20 text-red-400').replace('bg-amber-50', 'bg-amber-900/20 text-amber-400').replace('text-[#25D366]', 'text-[#4ade80]').replace('text-red-600', 'text-red-400').replace('text-amber-600', 'text-amber-400')}`}
                        defaultValue={sub.vencimiento}
                        onBlur={(e) => onUpdate(sub.id, 'vencimiento', e.target.value)}
                    />
                </div>
                <div>
                    <label className="text-xs text-[#0F172A]/35 font-semibold uppercase">Equipo</label>
                    <input
                        className="block w-full text-sm text-[#0F172A]/65 bg-transparent focus:bg-[#F7F8FA] focus:ring-1 focus:ring-[#25D366] rounded px-1 -ml-1"
                        defaultValue={sub.equipo}
                        onBlur={(e) => onUpdate(sub.id, 'equipo', e.target.value)}
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-black/[0.06] flex justify-end gap-2">
                <button onClick={() => onWhatsApp(sub)} className="flex-1 bg-emerald-900/20 text-emerald-400 border border-emerald-900/50 py-2 rounded-lg flex justify-center items-center gap-2 text-sm font-medium active:scale-95 transition-transform hover:bg-emerald-900/30">
                    <MessageCircle size={18} /> WhatsApp
                </button>
                <button onClick={() => onDelete(sub.id)} className="px-4 py-2 bg-[#F7F8FA] text-[#0F172A]/35 border border-black/[0.08] rounded-lg hover:text-red-400 hover:border-red-900/50 hover:bg-red-900/20 transition-colors">
                    <Trash2 size={18} />
                </button>
            </div>
        </div>
    );
}
