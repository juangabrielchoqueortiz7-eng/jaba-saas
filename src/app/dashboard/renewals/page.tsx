'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
    Search,
    RefreshCcw,
    CheckCircle2,
    Clock,
    Mail,
    Phone,
    MessageSquare,
    Image,
    XCircle,
    ArrowRight,
    TrendingUp,
    DollarSign,
    BarChart3,
    Filter
} from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

dayjs.locale('es')

type Renewal = {
    id: string
    created_at: string
    phone_number: string
    customer_email: string
    plan_name: string
    amount: number
    old_expiration: string
    new_expiration: string
    receipt_url: string | null
    chat_id: string | null
    triggered_by: string
    status: 'pending_review' | 'approved' | 'rejected'
}

export default function RenewalsPage() {
    const [renewals, setRenewals] = useState<Renewal[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<string>('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [receiptModal, setReceiptModal] = useState<string | null>(null)
    const supabase = createClient()
    const router = useRouter()

    const fetchRenewals = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('subscription_renewals')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setRenewals(data || [])
        } catch (err) {
            console.error('Error fetching renewals:', err)
        } finally {
            setLoading(false)
        }
    }, [supabase])

    useEffect(() => {
        fetchRenewals()

        const channel = supabase
            .channel('renewals-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'subscription_renewals' }, () => {
                fetchRenewals()
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [fetchRenewals, supabase])

    const updateStatus = async (id: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from('subscription_renewals')
                .update({ status: newStatus })
                .eq('id', id)

            if (error) throw error
            toast.success(newStatus === 'approved' ? 'Renovación aprobada' : 'Renovación rechazada')
        } catch (err) {
            console.error('Error:', err)
            toast.error('Error al actualizar')
        }
    }

    // Stats
    const totalRenewals = renewals.length
    const pendingCount = renewals.filter(r => r.status === 'pending_review').length
    const approvedCount = renewals.filter(r => r.status === 'approved').length

    const thisMonth = dayjs().startOf('month')
    const monthlyRevenue = renewals
        .filter(r => dayjs(r.created_at).isAfter(thisMonth) && r.status !== 'rejected')
        .reduce((sum, r) => sum + (r.amount || 0), 0)

    // Fetch notification logs for conversion metrics
    const [notifCount, setNotifCount] = useState(0)
    const [reminderConversions, setReminderConversions] = useState(0)
    const [followupConversions, setFollowupConversions] = useState(0)

    useEffect(() => {
        const fetchStats = async () => {
            const { count } = await supabase
                .from('subscription_notification_logs')
                .select('*', { count: 'exact', head: true })
                .eq('message_type', 'reminder')
                .eq('status', 'sent')
            setNotifCount(count || 0)
        }
        fetchStats()

        setReminderConversions(renewals.filter(r => r.triggered_by === 'reminder').length)
        setFollowupConversions(renewals.filter(r => r.triggered_by === 'followup').length)
    }, [renewals, supabase])

    const conversionRate = notifCount > 0 ? ((totalRenewals / notifCount) * 100).toFixed(1) : '0'

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            case 'pending_review': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            case 'rejected': return 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            default: return 'bg-slate-500/10 text-slate-400'
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'approved': return 'Aprobada'
            case 'pending_review': return 'Pendiente'
            case 'rejected': return 'Rechazada'
            default: return status
        }
    }

    const filteredRenewals = renewals.filter(r => {
        const matchesFilter = filter === 'all' || r.status === filter
        const matchesSearch =
            r.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.phone_number?.includes(searchTerm) ||
            r.plan_name?.toLowerCase().includes(searchTerm.toLowerCase())
        return matchesFilter && matchesSearch
    })

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen">
            <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <RefreshCcw className="text-emerald-500" />
                        Renovaciones
                    </h1>
                    <p className="text-slate-400 mt-1">Control de renovaciones de suscripciones Canva Pro</p>
                </div>
                <button
                    onClick={() => { setLoading(true); fetchRenewals(); }}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm font-medium hover:bg-slate-800 transition-all active:scale-95"
                >
                    <RefreshCcw size={16} className={cn(loading && "animate-spin text-emerald-500")} />
                    Actualizar
                </button>
            </header>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
                <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
                    <p className="text-slate-400 text-sm font-medium mb-1">Total</p>
                    <p className="text-2xl font-bold text-white">{totalRenewals}</p>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
                    <p className="text-amber-400 text-sm font-medium mb-1">Pendientes</p>
                    <p className="text-2xl font-bold text-white">{pendingCount}</p>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
                    <p className="text-emerald-400 text-sm font-medium mb-1">Aprobadas</p>
                    <p className="text-2xl font-bold text-white">{approvedCount}</p>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
                    <div className="flex items-center gap-1.5">
                        <DollarSign size={14} className="text-indigo-400" />
                        <p className="text-indigo-400 text-sm font-medium">Ingresos Mes</p>
                    </div>
                    <p className="text-2xl font-bold text-white mt-1">Bs {monthlyRevenue}</p>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
                    <div className="flex items-center gap-1.5">
                        <TrendingUp size={14} className="text-teal-400" />
                        <p className="text-teal-400 text-sm font-medium">Conversión</p>
                    </div>
                    <p className="text-2xl font-bold text-white mt-1">{conversionRate}%</p>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
                    <div className="flex items-center gap-1.5">
                        <BarChart3 size={14} className="text-violet-400" />
                        <p className="text-violet-400 text-sm font-medium">1er vs 2do Msg</p>
                    </div>
                    <p className="text-lg font-bold text-white mt-1">{reminderConversions} / {followupConversions}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl mb-6 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por email, teléfono o plan..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Filter size={18} className="text-slate-500" />
                    <select
                        className="bg-slate-950 border border-slate-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    >
                        <option value="all">Todos</option>
                        <option value="pending_review">Pendientes</option>
                        <option value="approved">Aprobadas</option>
                        <option value="rejected">Rechazadas</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-800 bg-slate-800/20">
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha / Cliente</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Plan / Monto</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha Anterior → Nueva</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Origen</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {filteredRenewals.length > 0 ? filteredRenewals.map((renewal) => (
                                <tr key={renewal.id} className="hover:bg-slate-800/30 transition-colors group">
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1.5 text-sm text-slate-300">
                                                <Mail size={14} className="text-indigo-500" />
                                                <span>{renewal.customer_email || 'N/A'}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                                                <Phone size={12} />
                                                <span>{renewal.phone_number}</span>
                                            </div>
                                            <span className="text-[10px] text-slate-600 mt-1">
                                                {dayjs(renewal.created_at).format("D [de] MMMM, HH:mm")}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-white">{renewal.plan_name}</span>
                                            <span className="text-sm text-emerald-400 font-medium">Bs {renewal.amount}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-red-400">{renewal.old_expiration}</span>
                                            <ArrowRight size={14} className="text-slate-600" />
                                            <span className="text-emerald-400 font-bold">{renewal.new_expiration}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className={cn(
                                            "px-2 py-1 rounded text-[10px] font-bold uppercase",
                                            renewal.triggered_by === 'reminder' ? 'bg-blue-500/10 text-blue-400' : 'bg-violet-500/10 text-violet-400'
                                        )}>
                                            {renewal.triggered_by === 'reminder' ? '1er Msg' : '2do Msg'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className={cn(
                                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border",
                                            getStatusColor(renewal.status)
                                        )}>
                                            {renewal.status === 'pending_review' && <Clock size={12} />}
                                            {renewal.status === 'approved' && <CheckCircle2 size={12} />}
                                            {renewal.status === 'rejected' && <XCircle size={12} />}
                                            {getStatusLabel(renewal.status)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2">
                                            {renewal.status === 'pending_review' && (
                                                <>
                                                    <button
                                                        onClick={() => updateStatus(renewal.id, 'approved')}
                                                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center gap-1.5"
                                                    >
                                                        <CheckCircle2 size={14} />
                                                        Aprobar
                                                    </button>
                                                    <button
                                                        onClick={() => updateStatus(renewal.id, 'rejected')}
                                                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-lg text-xs font-bold border border-slate-700 transition-all active:scale-95"
                                                    >
                                                        Rechazar
                                                    </button>
                                                </>
                                            )}
                                            {renewal.receipt_url && (
                                                <button
                                                    onClick={() => setReceiptModal(renewal.receipt_url)}
                                                    className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-colors border border-transparent hover:border-amber-500/20"
                                                    title="Ver comprobante"
                                                >
                                                    <Image size={16} />
                                                </button>
                                            )}
                                            {renewal.chat_id && (
                                                <button
                                                    onClick={() => router.push(`/dashboard/chats?chatId=${renewal.chat_id}`)}
                                                    className="p-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors border border-transparent hover:border-indigo-500/20"
                                                    title="Ir al chat"
                                                >
                                                    <MessageSquare size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <RefreshCcw size={48} className="text-slate-800" />
                                            <p className="text-slate-500 font-medium">No se encontraron renovaciones.</p>
                                            <p className="text-slate-600 text-sm">Las renovaciones aparecerán aquí cuando los clientes renueven sus suscripciones.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Receipt Modal */}
            {receiptModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setReceiptModal(null)}>
                    <div className="max-w-lg w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-700" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                            <h3 className="text-white font-bold">Comprobante de Pago</h3>
                            <button onClick={() => setReceiptModal(null)} className="text-slate-400 hover:text-white">✕</button>
                        </div>
                        <div className="p-4">
                            <img src={receiptModal} alt="Comprobante" className="w-full rounded-lg" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
