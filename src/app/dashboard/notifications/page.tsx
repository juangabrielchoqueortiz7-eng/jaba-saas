'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Search, Filter, RefreshCcw, Bell, CheckCircle2, XCircle, TrendingUp, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.locale('es')
dayjs.extend(relativeTime)

type NotifLog = {
    id: string
    created_at: string
    phone_number: string | null
    message_type: string
    status: string
    error_message: string | null
    subscription_id: string | null
    subscriptions: { correo: string | null; plan_name: string | null } | null
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    reminder:     { label: 'Recordatorio',  color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',   icon: '🔔' },
    followup:     { label: 'Remarketing',   color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', icon: '📩' },
    urgency:      { label: 'Último aviso',  color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', icon: '⚠️' },
    auto_renewed: { label: 'Auto-renovado', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: '♻️' },
}

export default function NotificationsPage() {
    const [logs, setLogs] = useState<NotifLog[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')
    const [page, setPage] = useState(0)
    const PAGE_SIZE = 50
    const supabase = createClient()

    const fetchLogs = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('subscription_notification_logs')
            .select('*, subscriptions(correo, plan_name)')
            .order('created_at', { ascending: false })
            .limit(1000)
        setLogs((data as NotifLog[]) || [])
        setLoading(false)
    }

    useEffect(() => { fetchLogs() }, [])

    // ── Stats ──────────────────────────────────────────────────
    const stats = useMemo(() => {
        const total    = logs.length
        const sent     = logs.filter(l => l.status === 'sent').length
        const failed   = logs.filter(l => l.status === 'failed').length
        const rate     = total > 0 ? Math.round((sent / total) * 100) : 0
        const byType   = Object.keys(TYPE_CONFIG).reduce((acc, t) => {
            acc[t] = logs.filter(l => l.message_type === t).length
            return acc
        }, {} as Record<string, number>)
        return { total, sent, failed, rate, byType }
    }, [logs])

    // ── Filtrado ───────────────────────────────────────────────
    const filtered = useMemo(() => {
        return logs.filter(l => {
            const matchesType   = typeFilter === 'all' || l.message_type === typeFilter
            const matchesStatus = statusFilter === 'all' || l.status === statusFilter
            const term = search.toLowerCase()
            const matchesSearch = !term ||
                (l.phone_number || '').includes(term) ||
                (l.subscriptions?.correo || '').toLowerCase().includes(term) ||
                (l.subscriptions?.plan_name || '').toLowerCase().includes(term)
            return matchesType && matchesStatus && matchesSearch
        })
    }, [logs, typeFilter, statusFilter, search])

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
    const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

    // Reset página al filtrar
    useEffect(() => { setPage(0) }, [search, typeFilter, statusFilter])

    return (
        <div className="p-6 max-w-7xl mx-auto min-h-screen">
            {/* Header */}
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[#eef0ff] flex items-center gap-3">
                        <Bell className="text-[#6366f1]" size={24} />
                        Historial de Notificaciones
                    </h1>
                    <p className="text-[rgba(238,240,255,0.45)] text-sm mt-1">
                        Registro de todos los mensajes automáticos enviados a tus suscriptores
                    </p>
                </div>
                <button
                    onClick={() => { setLoading(true); fetchLogs() }}
                    className="flex items-center gap-2 px-4 py-2 bg-[#13152a] border border-white/[0.06] rounded-xl text-sm font-medium hover:bg-white/[0.05] text-slate-300 transition-all active:scale-95 self-start md:self-auto"
                >
                    <RefreshCcw size={15} className={cn(loading && 'animate-spin text-[#6366f1]')} />
                    Actualizar
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                    { icon: <Send size={18} />, label: 'Total enviados', value: stats.total, color: '#6366f1', rgb: '99,102,241' },
                    { icon: <CheckCircle2 size={18} />, label: 'Exitosos', value: stats.sent, color: '#10b981', rgb: '16,185,129' },
                    { icon: <XCircle size={18} />, label: 'Fallidos', value: stats.failed, color: '#f87171', rgb: '248,113,113' },
                    { icon: <TrendingUp size={18} />, label: 'Tasa de éxito', value: `${stats.rate}%`, color: stats.rate >= 80 ? '#10b981' : stats.rate >= 50 ? '#f59e0b' : '#f87171', rgb: '99,102,241' },
                ].map((s, i) => (
                    <div key={i} className="bg-[#13152a] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: s.color }} />
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-slate-400" style={{ color: s.color }}>{s.icon}</span>
                        </div>
                        <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                        <div className="text-xs text-slate-400 mt-1">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Chips por tipo */}
            <div className="flex flex-wrap gap-2 mb-5">
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                    <div key={key} className={cn('px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5', cfg.bg, cfg.color)}>
                        <span>{cfg.icon}</span>
                        {cfg.label}
                        <span className="ml-1 opacity-70">{stats.byType[key] ?? 0}</span>
                    </div>
                ))}
            </div>

            {/* Filtros */}
            <div className="bg-[#13152a] border border-white/[0.06] rounded-2xl p-4 mb-5 flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar por teléfono, email o plan..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-[#0f1120] border border-white/[0.06] rounded-xl py-2 pl-9 pr-4 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/40 placeholder:text-slate-600"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter size={15} className="text-slate-500 shrink-0" />
                    <select
                        value={typeFilter}
                        onChange={e => setTypeFilter(e.target.value)}
                        className="bg-[#0f1120] border border-white/[0.06] rounded-xl py-2 px-3 text-sm text-slate-300 focus:outline-none cursor-pointer"
                    >
                        <option value="all">Todos los tipos</option>
                        {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                            <option key={k} value={k}>{v.icon} {v.label}</option>
                        ))}
                    </select>
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="bg-[#0f1120] border border-white/[0.06] rounded-xl py-2 px-3 text-sm text-slate-300 focus:outline-none cursor-pointer"
                    >
                        <option value="all">Todos los estados</option>
                        <option value="sent">✓ Exitosos</option>
                        <option value="failed">✗ Fallidos</option>
                    </select>
                </div>
                {(search || typeFilter !== 'all' || statusFilter !== 'all') && (
                    <button
                        onClick={() => { setSearch(''); setTypeFilter('all'); setStatusFilter('all') }}
                        className="text-xs text-slate-400 hover:text-slate-200 transition-colors px-3 py-2 rounded-xl hover:bg-white/[0.05] shrink-0"
                    >
                        Limpiar filtros
                    </button>
                )}
            </div>

            {/* Tabla */}
            <div className="bg-[#13152a] border border-white/[0.06] rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/[0.05] bg-white/[0.02]">
                                <th className="px-5 py-3.5 text-xs font-semibold text-[rgba(99,102,241,0.55)] uppercase tracking-wider">Fecha</th>
                                <th className="px-5 py-3.5 text-xs font-semibold text-[rgba(99,102,241,0.55)] uppercase tracking-wider">Contacto</th>
                                <th className="px-5 py-3.5 text-xs font-semibold text-[rgba(99,102,241,0.55)] uppercase tracking-wider">Plan</th>
                                <th className="px-5 py-3.5 text-xs font-semibold text-[rgba(99,102,241,0.55)] uppercase tracking-wider">Tipo</th>
                                <th className="px-5 py-3.5 text-xs font-semibold text-[rgba(99,102,241,0.55)] uppercase tracking-wider">Estado</th>
                                <th className="px-5 py-3.5 text-xs font-semibold text-[rgba(99,102,241,0.55)] uppercase tracking-wider">Detalle</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03]">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-5 py-16 text-center text-slate-500">
                                        <RefreshCcw size={28} className="animate-spin mx-auto mb-3 text-[#6366f1]" />
                                        Cargando...
                                    </td>
                                </tr>
                            ) : paged.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-5 py-16 text-center">
                                        <Bell size={40} className="mx-auto mb-3 text-slate-700" />
                                        <p className="text-slate-500 font-medium">No hay notificaciones.</p>
                                        <p className="text-slate-600 text-sm mt-1">Los mensajes automáticos aparecerán aquí cuando se envíen.</p>
                                    </td>
                                </tr>
                            ) : paged.map((log) => {
                                const typeCfg = TYPE_CONFIG[log.message_type] || { label: log.message_type, color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20', icon: '📨' }
                                const isSent = log.status === 'sent'
                                const date = dayjs(log.created_at)
                                return (
                                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-5 py-4">
                                            <div className="text-sm text-slate-300">{date.format('DD/MM/YY')}</div>
                                            <div className="text-xs text-slate-500">{date.format('HH:mm')}</div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="text-sm text-slate-200 font-mono">{log.subscriptions?.correo || log.phone_number || '—'}</div>
                                            {log.subscriptions?.correo && log.phone_number && (
                                                <div className="text-xs text-slate-500">{log.phone_number}</div>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="text-sm text-slate-300">{log.subscriptions?.plan_name || '—'}</span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border', typeCfg.bg, typeCfg.color)}>
                                                {typeCfg.icon} {typeCfg.label}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={cn(
                                                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
                                                isSent
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                                            )}>
                                                {isSent ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                                                {isSent ? 'Enviado' : 'Fallido'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            {log.error_message ? (
                                                <span className="text-xs text-red-400 max-w-[180px] truncate block" title={log.error_message}>
                                                    {log.error_message}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-600">—</span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Paginación */}
                {totalPages > 1 && (
                    <div className="px-5 py-3 border-t border-white/[0.05] flex items-center justify-between">
                        <span className="text-xs text-slate-500">
                            Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
                        </span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="px-3 py-1.5 text-xs rounded-lg bg-white/[0.05] text-slate-300 disabled:opacity-30 hover:bg-white/[0.08] transition-colors"
                            >
                                ← Anterior
                            </button>
                            <span className="px-3 py-1.5 text-xs text-slate-400">{page + 1} / {totalPages}</span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                disabled={page >= totalPages - 1}
                                className="px-3 py-1.5 text-xs rounded-lg bg-white/[0.05] text-slate-300 disabled:opacity-30 hover:bg-white/[0.08] transition-colors"
                            >
                                Siguiente →
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
