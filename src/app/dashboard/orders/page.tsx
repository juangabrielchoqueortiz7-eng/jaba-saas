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
    ShoppingBag,
    AlertCircle,
    MessageSquare,
    Copy,
    Check,
    Trash2,
    Image as ImageIcon,
    Undo2,
    Eye,
    X,
    Zap
} from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

dayjs.locale('es')

type Order = {
    id: string
    created_at: string
    updated_at?: string
    phone_number: string
    contact_name: string
    plan_name: string
    amount: number
    customer_email: string
    equipo?: string
    chat_id?: string
    payment_proof_url?: string
    status: 'pending_email' | 'pending_payment' | 'pending_delivery' | 'delivered' | 'completed' | 'cancelled'
}

type ChatMessage = {
    id: string
    content: string
    is_from_me: boolean
    created_at: string
    media_url?: string
    media_type?: string
}

export default function OrdersPage() {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<string>('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [loadingChat, setLoadingChat] = useState(false)
    const [proofModal, setProofModal] = useState<string | null>(null)
    const [copiedEmail, setCopiedEmail] = useState<string | null>(null)
    const supabase = createClient()
    const router = useRouter()

    const fetchOrders = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false })
            if (error) throw error
            setOrders(data || [])
        } catch (err) {
            console.error('Error fetching orders:', err)
        } finally {
            setLoading(false)
        }
    }, [supabase])

    const fetchChatMessages = useCallback(async (chatId: string) => {
        setLoadingChat(true)
        try {
            const { data } = await supabase
                .from('messages')
                .select('id, content, is_from_me, created_at, media_url, media_type')
                .eq('chat_id', chatId)
                .order('created_at', { ascending: false })
                .limit(15)
            setChatMessages((data || []).reverse())
        } catch (err) {
            console.error('Error fetching chat:', err)
        } finally {
            setLoadingChat(false)
        }
    }, [supabase])

    useEffect(() => {
        fetchOrders()
        const channel = supabase
            .channel('orders-audit')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [fetchOrders, supabase])

    useEffect(() => {
        if (selectedOrder?.chat_id) {
            fetchChatMessages(selectedOrder.chat_id)
        }
    }, [selectedOrder, fetchChatMessages])

    const updateOrderStatus = async (id: string, newStatus: string) => {
        try {
            await supabase.from('orders').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id)
            toast.success(newStatus === 'cancelled' ? 'Pedido revertido' : 'Estado actualizado')
            if (selectedOrder?.id === id) setSelectedOrder(prev => prev ? { ...prev, status: newStatus as any } : null)
        } catch (err) {
            toast.error('Error al actualizar')
        }
    }

    const deleteOrder = async (id: string) => {
        if (!confirm('¿Eliminar este pedido permanentemente?')) return
        try {
            await supabase.from('orders').delete().eq('id', id)
            toast.success('Pedido eliminado')
            setOrders(prev => prev.filter(o => o.id !== id))
            if (selectedOrder?.id === id) setSelectedOrder(null)
        } catch (err) {
            toast.error('Error al eliminar')
        }
    }

    const handleCopyEmail = (email: string) => {
        navigator.clipboard.writeText(email)
        setCopiedEmail(email)
        toast.success('Correo copiado')
        setTimeout(() => setCopiedEmail(null), 2000)
    }

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'completed': return { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: '✅ Auto-Aprobado', icon: <Zap size={12} /> }
            case 'delivered': return { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'Entregado', icon: <CheckCircle2 size={12} /> }
            case 'pending_delivery': return { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'Pendiente Envío', icon: <Clock size={12} /> }
            case 'pending_payment': return { color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', label: 'Esperando Pago', icon: <Clock size={12} /> }
            case 'pending_email': return { color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', label: 'Sin Email', icon: <AlertCircle size={12} /> }
            case 'cancelled': return { color: 'bg-rose-500/10 text-rose-400 border-rose-500/20', label: '❌ Revertido', icon: <Undo2 size={12} /> }
            default: return { color: 'bg-slate-500/10 text-slate-400', label: status, icon: null }
        }
    }

    const filteredOrders = orders.filter(order => {
        const matchesFilter = filter === 'all' || order.status === filter
        const matchesSearch =
            order.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.phone_number?.includes(searchTerm) ||
            order.customer_email?.toLowerCase().includes(searchTerm.toLowerCase())
        return matchesFilter && matchesSearch
    })

    const stats = {
        total: orders.length,
        autoApproved: orders.filter(o => o.status === 'completed').length,
        pendingPayment: orders.filter(o => o.status === 'pending_payment').length,
        reverted: orders.filter(o => o.status === 'cancelled').length,
    }

    return (
        <div className="p-6 max-w-[1600px] mx-auto min-h-screen">
            {/* Header */}
            <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <ShoppingBag className="text-indigo-500" />
                        Auditoría de Pedidos
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Las renovaciones se procesan automáticamente. Aquí verificas los comprobantes.</p>
                </div>
                <button
                    onClick={() => { setLoading(true); fetchOrders() }}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm font-medium hover:bg-slate-800 transition-all active:scale-95"
                >
                    <RefreshCcw size={16} className={cn(loading && "animate-spin text-indigo-500")} />
                    Actualizar
                </button>
            </header>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
                    <p className="text-slate-400 text-xs font-medium">Total</p>
                    <p className="text-xl font-bold text-white">{stats.total}</p>
                </div>
                <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl">
                    <p className="text-emerald-400 text-xs font-medium">✅ Auto-Aprobados</p>
                    <p className="text-xl font-bold text-emerald-400">{stats.autoApproved}</p>
                </div>
                <div className="bg-indigo-500/5 border border-indigo-500/20 p-4 rounded-xl">
                    <p className="text-indigo-400 text-xs font-medium">⏳ Esperando Pago</p>
                    <p className="text-xl font-bold text-indigo-400">{stats.pendingPayment}</p>
                </div>
                <div className="bg-rose-500/5 border border-rose-500/20 p-4 rounded-xl">
                    <p className="text-rose-400 text-xs font-medium">❌ Revertidos</p>
                    <p className="text-xl font-bold text-rose-400">{stats.reverted}</p>
                </div>
            </div>

            {/* Search & Filter */}
            <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-xl mb-4 flex gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, teléfono o email..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    className="bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                >
                    <option value="all">Todos</option>
                    <option value="completed">✅ Auto-Aprobados</option>
                    <option value="pending_payment">⏳ Esperando Pago</option>
                    <option value="delivered">Entregados</option>
                    <option value="cancelled">❌ Revertidos</option>
                </select>
            </div>

            {/* Main Layout: List + Detail Panel */}
            <div className="flex gap-4" style={{ height: 'calc(100vh - 350px)', minHeight: '500px' }}>
                {/* Left: Orders List */}
                <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
                    <div className="overflow-y-auto flex-1">
                        {filteredOrders.length > 0 ? filteredOrders.map((order) => {
                            const sc = getStatusConfig(order.status)
                            const isSelected = selectedOrder?.id === order.id
                            return (
                                <div
                                    key={order.id}
                                    onClick={() => setSelectedOrder(order)}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 border-b border-slate-800/50 cursor-pointer transition-colors hover:bg-slate-800/30",
                                        isSelected && "bg-indigo-500/10 border-l-2 border-l-indigo-500"
                                    )}
                                >
                                    {/* Payment proof thumbnail */}
                                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0 border border-slate-700">
                                        {order.payment_proof_url ? (
                                            <img
                                                src={order.payment_proof_url}
                                                alt="Comprobante"
                                                className="w-full h-full object-cover"
                                                onClick={(e) => { e.stopPropagation(); setProofModal(order.payment_proof_url!) }}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <ImageIcon size={16} className="text-slate-600" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Order info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-white truncate">{order.contact_name || 'Sin nombre'}</span>
                                            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border", sc.color)}>
                                                {sc.icon} {sc.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                                            <span className="font-medium text-indigo-400">{order.plan_name} — Bs {order.amount}</span>
                                            <span>·</span>
                                            <span>{dayjs(order.created_at).format("D MMM, HH:mm")}</span>
                                        </div>
                                        {order.customer_email && (
                                            <div className="text-[11px] text-slate-500 truncate mt-0.5">📧 {order.customer_email}</div>
                                        )}
                                    </div>
                                </div>
                            )
                        }) : (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                                <ShoppingBag size={40} className="text-slate-700 mb-3" />
                                <p className="text-sm">No se encontraron pedidos.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Detail Panel */}
                <div className="w-[420px] bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden flex flex-col flex-shrink-0">
                    {selectedOrder ? (
                        <>
                            {/* Header */}
                            <div className="p-4 border-b border-slate-800 bg-slate-800/20">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-bold text-white">{selectedOrder.contact_name}</h3>
                                    <button onClick={() => setSelectedOrder(null)} className="p-1 text-slate-500 hover:text-white">
                                        <X size={16} />
                                    </button>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-400">
                                    <span className="flex items-center gap-1"><Phone size={11} /> {selectedOrder.phone_number}</span>
                                    {selectedOrder.customer_email && (
                                        <button onClick={() => handleCopyEmail(selectedOrder.customer_email)} className="flex items-center gap-1 hover:text-indigo-400 transition-colors">
                                            <Mail size={11} /> {selectedOrder.customer_email}
                                            {copiedEmail === selectedOrder.customer_email ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-xs font-bold text-indigo-400">{selectedOrder.plan_name} — Bs {selectedOrder.amount}</span>
                                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border", getStatusConfig(selectedOrder.status).color)}>
                                        {getStatusConfig(selectedOrder.status).label}
                                    </span>
                                </div>
                            </div>

                            {/* Payment proof */}
                            <div className="p-4 border-b border-slate-800">
                                <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Comprobante de Pago</p>
                                {selectedOrder.payment_proof_url ? (
                                    <div
                                        className="relative rounded-lg overflow-hidden cursor-pointer group border border-slate-700"
                                        onClick={() => setProofModal(selectedOrder.payment_proof_url!)}
                                    >
                                        <img src={selectedOrder.payment_proof_url} alt="Comprobante" className="w-full max-h-48 object-contain bg-slate-950" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Eye size={24} className="text-white" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-6 text-center">
                                        <ImageIcon size={24} className="text-slate-600 mx-auto mb-2" />
                                        <p className="text-xs text-slate-500">Sin comprobante</p>
                                    </div>
                                )}
                            </div>

                            {/* Chat context */}
                            <div className="flex-1 overflow-y-auto p-4">
                                <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Conversación</p>
                                {loadingChat ? (
                                    <div className="flex items-center justify-center py-8">
                                        <RefreshCcw size={16} className="animate-spin text-slate-500" />
                                    </div>
                                ) : chatMessages.length > 0 ? (
                                    <div className="space-y-2">
                                        {chatMessages.map(msg => (
                                            <div key={msg.id} className={cn("max-w-[90%] rounded-lg p-2", msg.is_from_me ? "ml-auto bg-indigo-500/20 border border-indigo-500/30" : "bg-slate-800 border border-slate-700")}>
                                                {msg.media_url && msg.media_type === 'image' && (
                                                    <img src={msg.media_url} alt="" className="w-full rounded mb-1 max-h-24 object-cover cursor-pointer" onClick={() => setProofModal(msg.media_url!)} />
                                                )}
                                                <p className="text-[11px] text-slate-300 whitespace-pre-wrap break-words">{msg.content}</p>
                                                <p className="text-[9px] text-slate-500 mt-1">{dayjs(msg.created_at).format("HH:mm")}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-500 text-center py-4">No hay mensajes</p>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="p-3 border-t border-slate-800 bg-slate-800/20 flex gap-2">
                                {selectedOrder.status === 'completed' && (
                                    <button
                                        onClick={() => updateOrderStatus(selectedOrder.id, 'cancelled')}
                                        className="flex-1 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs font-bold border border-rose-500/20 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                    >
                                        <Undo2 size={14} />
                                        Revertir
                                    </button>
                                )}
                                {selectedOrder.status === 'pending_payment' && (
                                    <button
                                        onClick={() => updateOrderStatus(selectedOrder.id, 'completed')}
                                        className="flex-1 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold border border-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                    >
                                        <CheckCircle2 size={14} />
                                        Aprobar Manual
                                    </button>
                                )}
                                {selectedOrder.chat_id && (
                                    <button
                                        onClick={() => router.push(`/dashboard/chats?chatId=${selectedOrder.chat_id}`)}
                                        className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold border border-slate-700 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                    >
                                        <MessageSquare size={14} />
                                        Ver Chat
                                    </button>
                                )}
                                <button
                                    onClick={() => deleteOrder(selectedOrder.id)}
                                    className="px-3 py-2 bg-slate-800 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-lg text-xs border border-slate-700 transition-all active:scale-95"
                                    title="Eliminar"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <Eye size={40} className="text-slate-700 mb-3" />
                            <p className="text-sm font-medium">Selecciona un pedido</p>
                            <p className="text-xs text-slate-600 mt-1">para ver el comprobante y la conversación</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Image Modal */}
            {proofModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8" onClick={() => setProofModal(null)}>
                    <div className="relative max-w-3xl max-h-[90vh]">
                        <button onClick={() => setProofModal(null)} className="absolute -top-3 -right-3 bg-slate-800 text-white rounded-full p-2 hover:bg-slate-700 z-10 border border-slate-600">
                            <X size={18} />
                        </button>
                        <img src={proofModal} alt="Comprobante" className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain" />
                    </div>
                </div>
            )}
        </div>
    )
}
