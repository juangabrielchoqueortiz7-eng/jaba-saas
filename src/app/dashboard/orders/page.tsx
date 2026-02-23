'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
    Search,
    Filter,
    RefreshCcw,
    CheckCircle2,
    Clock,
    Mail,
    Phone,
    MoreHorizontal,
    ShoppingBag,
    AlertCircle,
    MessageSquare,
    PlayCircle,
    Copy,
    Check,
    Trash2
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
    phone_number: string
    contact_name: string
    plan_name: string
    amount: number
    customer_email: string
    equipo?: string
    chat_id?: string
    status: 'pending_email' | 'pending_payment' | 'pending_delivery' | 'delivered' | 'cancelled'
}

export default function OrdersPage() {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [sendingVideoId, setSendingVideoId] = useState<string | null>(null)
    const [openDropdown, setOpenDropdown] = useState<string | null>(null)
    const [copiedEmail, setCopiedEmail] = useState<string | null>(null)
    const [filter, setFilter] = useState<string>('all')
    const [searchTerm, setSearchTerm] = useState('')
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

    useEffect(() => {
        fetchOrders()

        // Realtime subscription
        const channel = supabase
            .channel('orders-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchOrders()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [fetchOrders, supabase])

    const updateOrderStatus = async (id: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from('orders')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', id)

            if (error) throw error
            if (newStatus === 'delivered') toast.success('Pedido marcado como entregado')
        } catch (err) {
            console.error('Error updating order status:', err)
            toast.error('Error al actualizar el estado')
        }
    }

    const deleteOrder = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar permanentemente este pedido?')) return;
        try {
            const { error } = await supabase.from('orders').delete().eq('id', id);
            if (error) throw error;
            toast.success("Pedido eliminado correctamente");
            setOrders(prev => prev.filter(o => o.id !== id));
        } catch (err) {
            console.error('Error deleting order:', err);
            toast.error("Error al eliminar el pedido");
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'delivered':
                return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            case 'pending_delivery':
                return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            case 'pending_payment':
                return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
            case 'pending_email':
                return 'bg-slate-500/10 text-slate-400 border-slate-500/20'
            case 'cancelled':
                return 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            default:
                return 'bg-slate-500/10 text-slate-400'
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'delivered': return 'Entregado'
            case 'pending_delivery': return 'Pendiente Envío'
            case 'pending_payment': return 'Esperando Pago'
            case 'pending_email': return 'Sin Email'
            case 'cancelled': return 'Cancelado'
            default: return status
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

    const handleCopyEmail = (email: string) => {
        navigator.clipboard.writeText(email)
        setCopiedEmail(email)
        toast.success("Correo copiado al portapapeles")
        setTimeout(() => setCopiedEmail(null), 2000)
    }

    const handleSendTutorial = async (chatId: string, orderId: string) => {
        if (!chatId) {
            toast.error("No se encontró el chat para este cliente")
            return
        }

        setSendingVideoId(orderId)

        try {
            const response = await fetch('/api/chat/send-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: chatId,
                    videoUrl: '/tutorial.mp4',
                    caption: '🎬 *¡Bienvenido a Canva Pro!*\n\nAquí tienes el video tutorial de activación. Sigue los pasos y cualquier duda me avisas por aquí. 👇'
                })
            })

            const result = await response.json()

            if (response.ok) {
                toast.success("Video tutorial enviado con éxito")
            } else {
                toast.error(result.error || "Hubo un error al enviar el video")
            }
        } catch (error) {
            console.error("Error al enviar video:", error)
            toast.error("Error de conexión al intentar enviar el video")
        } finally {
            setSendingVideoId(null)
        }
    }

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen">
            <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <ShoppingBag className="text-indigo-500" />
                        Gestión de Pedidos
                    </h1>
                    <p className="text-slate-400 mt-1">Control de ventas de Canva Pro y suscripciones.</p>
                </div>
                <button
                    onClick={() => { setLoading(true); fetchOrders(); }}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm font-medium hover:bg-slate-800 transition-all active:scale-95"
                >
                    <RefreshCcw size={16} className={cn(loading && "animate-spin text-indigo-500")} />
                    Actualizar
                </button>
            </header>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
                    <p className="text-slate-400 text-sm font-medium mb-1">Total Pedidos</p>
                    <p className="text-2xl font-bold text-white">{orders.length}</p>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
                    <p className="text-amber-400 text-sm font-medium mb-1">Pendientes de Envío</p>
                    <p className="text-2xl font-bold text-white">
                        {orders.filter(o => o.status === 'pending_delivery').length}
                    </p>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
                    <p className="text-indigo-400 text-sm font-medium mb-1">Esperando Pago</p>
                    <p className="text-2xl font-bold text-white">
                        {orders.filter(o => o.status === 'pending_payment').length}
                    </p>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
                    <p className="text-emerald-400 text-sm font-medium mb-1">Completados</p>
                    <p className="text-2xl font-bold text-white">
                        {orders.filter(o => o.status === 'delivered').length}
                    </p>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl mb-6 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, teléfono o email..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Filter size={18} className="text-slate-500" />
                    <select
                        className="bg-slate-950 border border-slate-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    >
                        <option value="all">Todos los estados</option>
                        <option value="pending_email">Sin Email</option>
                        <option value="pending_payment">Esperando Pago</option>
                        <option value="pending_delivery">Pendiente Envío</option>
                        <option value="delivered">Entregados</option>
                        <option value="cancelled">Cancelados</option>
                    </select>
                </div>
            </div>

            {/* Orders Table */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-800 bg-slate-800/20">
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha / Cliente</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Plan / Monto</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acceso / Equipo</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {filteredOrders.length > 0 ? filteredOrders.map((order) => (
                                <tr key={order.id} className="hover:bg-slate-800/30 transition-colors group">
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold text-white">{order.contact_name || 'Sin nombre'}</span>
                                            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                                                <Phone size={12} />
                                                <span>{order.phone_number}</span>
                                            </div>
                                            <span className="text-[10px] text-slate-600 mt-1">
                                                {dayjs(order.created_at).format("D [de] MMMM, HH:mm")}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-white">{order.plan_name}</span>
                                            <span className="text-sm text-indigo-400 font-medium">Bs {order.amount}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col gap-1.5">
                                            {order.customer_email ? (
                                                <div className="flex items-center gap-2 group/email">
                                                    <Mail size={14} className="text-indigo-500" />
                                                    <span className="text-sm text-slate-300">{order.customer_email}</span>
                                                    <button
                                                        onClick={() => handleCopyEmail(order.customer_email)}
                                                        className="p-1 opacity-0 group-hover/email:opacity-100 transition-opacity bg-slate-800 hover:bg-slate-700 text-slate-400 rounded cursor-pointer"
                                                        title="Copiar correo"
                                                    >
                                                        {copiedEmail === order.customer_email ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-600 italic">Email no proporcionado</span>
                                            )}
                                            {order.equipo && (
                                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                                    <span className="px-1.5 py-0.5 bg-slate-800 rounded text-indigo-400 font-bold border border-slate-700">
                                                        EQ {order.equipo}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className={cn(
                                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border",
                                            getStatusColor(order.status)
                                        )}>
                                            {order.status === 'pending_delivery' && <Clock size={12} />}
                                            {order.status === 'delivered' && <CheckCircle2 size={12} />}
                                            {order.status === 'pending_email' && <AlertCircle size={12} />}
                                            {getStatusLabel(order.status)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <div className="flex items-center gap-2">
                                            {order.status === 'pending_delivery' && (
                                                <button
                                                    onClick={() => updateOrderStatus(order.id, 'delivered')}
                                                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center gap-1.5"
                                                >
                                                    <CheckCircle2 size={14} />
                                                    Entregar
                                                </button>
                                            )}
                                            {order.status === 'pending_payment' && (
                                                <button
                                                    onClick={() => updateOrderStatus(order.id, 'pending_delivery')}
                                                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all active:scale-95"
                                                >
                                                    Pago Recibido
                                                </button>
                                            )}
                                            {order.chat_id && (
                                                <button
                                                    onClick={() => handleSendTutorial(order.chat_id!, order.id)}
                                                    disabled={sendingVideoId === order.id}
                                                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold border border-slate-700 transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                                                    title="Enviar Video Tutorial a WhatsApp"
                                                >
                                                    {sendingVideoId === order.id ? (
                                                        <RefreshCcw size={14} className="animate-spin text-slate-400" />
                                                    ) : (
                                                        <PlayCircle size={14} className="text-indigo-400" />
                                                    )}
                                                    Video
                                                </button>
                                            )}
                                            {order.chat_id && (
                                                <button
                                                    onClick={() => router.push(`/dashboard/chats?chatId=${order.chat_id}`)}
                                                    className="p-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors border border-transparent hover:border-indigo-500/20"
                                                    title="Ver conversación"
                                                >
                                                    <MessageSquare size={16} />
                                                </button>
                                            )}
                                            <div className="relative">
                                                <button
                                                    onClick={() => setOpenDropdown(openDropdown === order.id ? null : order.id)}
                                                    className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                                                >
                                                    <MoreHorizontal size={18} />
                                                </button>

                                                {openDropdown === order.id && (
                                                    <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-10 py-1 overflow-hidden">
                                                        {order.status !== 'delivered' && (
                                                            <button
                                                                onClick={() => { updateOrderStatus(order.id, 'delivered'); setOpenDropdown(null); }}
                                                                className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2 transition-colors"
                                                            >
                                                                <CheckCircle2 size={16} className="text-emerald-400" />
                                                                Marcar Entregado
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => { deleteOrder(order.id); setOpenDropdown(null); }}
                                                            className="w-full text-left px-4 py-2.5 text-sm text-rose-400 hover:bg-slate-700 flex items-center gap-2 transition-colors"
                                                        >
                                                            <Trash2 size={16} />
                                                            Eliminar Pedido
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <ShoppingBag size={48} className="text-slate-800" />
                                            <p className="text-slate-500 font-medium">No se encontraron pedidos.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
