'use client';

import { Subscription } from '@/types/subscription';
import { Copy, MessageCircle, Trash2, CheckCircle, XCircle } from 'lucide-react';

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
    return (
        <div className={`p-4 rounded-xl border shadow-sm ${sub.estado === 'ACTIVO' ? 'bg-slate-900 border-slate-800' : 'bg-slate-900 border-slate-800 opacity-75'}`}>
            {/* Header: Number and Status */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                    <label className="text-xs text-slate-500 font-semibold uppercase">WhatsApp</label>
                    <input
                        className="block w-full font-mono text-slate-200 font-medium bg-transparent focus:bg-slate-800 focus:ring-1 focus:ring-indigo-500 rounded px-1 -ml-1"
                        defaultValue={sub.numero}
                        onBlur={(e) => onUpdate(sub.id, 'numero', e.target.value)}
                    />
                </div>
                <button
                    onClick={() => onToggleStatus(sub)}
                    className={`ml-2 px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors flex items-center gap-1 ${sub.estado === 'ACTIVO' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800' : 'bg-slate-800 text-slate-500 border-slate-700'}`}
                >
                    {sub.estado === 'ACTIVO' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                    {sub.estado}
                </button>
            </div>

            {/* Email */}
            <div className="mb-4">
                <label className="text-xs text-slate-500 font-semibold uppercase">Correo</label>
                <div className="flex items-center gap-2">
                    <input
                        className="block w-full text-sm text-slate-300 bg-transparent focus:bg-slate-800 focus:ring-1 focus:ring-indigo-500 rounded px-1 -ml-1 truncate"
                        defaultValue={sub.correo}
                        onBlur={(e) => onUpdate(sub.id, 'correo', e.target.value)}
                    />
                    <button onClick={() => onCopy(sub.correo)} className="text-slate-500 hover:text-indigo-400">
                        <Copy size={16} />
                    </button>
                </div>
            </div>

            {/* Date & Team */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="text-xs text-slate-500 font-semibold uppercase">Vencimiento</label>
                    <input
                        className={`block w-full text-sm font-medium rounded px-1 -ml-1 ${dateInfo.className.replace('text-slate-700', 'text-slate-300').replace('bg-red-50', 'bg-red-900/20 text-red-400').replace('bg-amber-50', 'bg-amber-900/20 text-amber-400').replace('text-indigo-600', 'text-indigo-400').replace('text-red-600', 'text-red-400').replace('text-amber-600', 'text-amber-400')}`}
                        defaultValue={sub.vencimiento}
                        onBlur={(e) => onUpdate(sub.id, 'vencimiento', e.target.value)}
                    />
                </div>
                <div>
                    <label className="text-xs text-slate-500 font-semibold uppercase">Equipo</label>
                    <input
                        className="block w-full text-sm text-slate-300 bg-transparent focus:bg-slate-800 focus:ring-1 focus:ring-indigo-500 rounded px-1 -ml-1"
                        defaultValue={sub.equipo}
                        onBlur={(e) => onUpdate(sub.id, 'equipo', e.target.value)}
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                <button onClick={() => onWhatsApp(sub)} className="flex-1 bg-emerald-900/20 text-emerald-400 border border-emerald-900/50 py-2 rounded-lg flex justify-center items-center gap-2 text-sm font-medium active:scale-95 transition-transform hover:bg-emerald-900/30">
                    <MessageCircle size={18} /> WhatsApp
                </button>
                <button onClick={() => onDelete(sub.id)} className="px-4 py-2 bg-slate-800 text-slate-500 border border-slate-700 rounded-lg hover:text-red-400 hover:border-red-900/50 hover:bg-red-900/20 transition-colors">
                    <Trash2 size={18} />
                </button>
            </div>
        </div>
    );
}
