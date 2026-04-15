'use client'

import { useEffect, useState } from 'react'
import { X, Phone, Mail, Calendar, Package, ShoppingBag, User, Users, Database, Check, Pencil } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { cn } from '@/lib/utils'
import { CRM_TAGS } from './ConversationList'

interface Subscription {
    id: string
    correo: string
    numero: string
    vencimiento: string
    estado: string
    servicio: string
    equipo?: string
}

interface Order {
    id: string
    created_at: string
    plan_name: string
    amount: number
    customer_email?: string
    status: string
}

type CustomFieldValue = string | number | boolean | null

interface ContactInfoSidebarProps {
    phoneNumber: string
    chatId: string
    contactName: string
    tags?: string[]
    onClose: () => void
}

const ORDER_STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    pending_email: { label: 'Pendiente email', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    pending_payment: { label: 'Pago pendiente', color: 'text-orange-400', bg: 'bg-orange-500/10' },
    pending_delivery: { label: 'Por entregar', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    delivered: { label: 'Entregado', color: 'text-[#25D366]', bg: 'bg-[#25D366]/10' },
    cancelled: { label: 'Cancelado', color: 'text-red-400', bg: 'bg-red-500/10' },
}

const SUB_STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    activo: { label: 'Activo', color: 'text-[#25D366]', bg: 'bg-[#25D366]/10' },
    vencido: { label: 'Vencido', color: 'text-red-400', bg: 'bg-red-500/10' },
    suspendido: { label: 'Suspendido', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
}

function formatDate(dateStr: string) {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function ContactInfoSidebar({ phoneNumber, chatId, contactName, tags, onClose }: ContactInfoSidebarProps) {
    const [supabase] = useState(() => createClient())
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [customFields, setCustomFields] = useState<Record<string, CustomFieldValue>>({})
    const [fieldDefs, setFieldDefs] = useState<{ id: string; field_name: string; field_type: string; description: string | null }[]>([])
    const [editingField, setEditingField] = useState<string | null>(null)
    const [editValue, setEditValue] = useState('')

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            const [subsRes, ordersRes, chatRes, fieldsRes] = await Promise.all([
                supabase
                    .from('subscriptions')
                    .select('id, correo, numero, vencimiento, estado, servicio, equipo')
                    .eq('numero', phoneNumber),
                supabase
                    .from('orders')
                    .select('id, created_at, plan_name, amount, customer_email, status')
                    .eq('chat_id', chatId)
                    .order('created_at', { ascending: false })
                    .limit(10),
                supabase
                    .from('chats')
                    .select('custom_fields')
                    .eq('id', chatId)
                    .single(),
                fetch('/api/custom-fields').then(r => r.json()).catch(() => ({ fields: [] }))
            ])
            if (subsRes.data) setSubscriptions(subsRes.data)
            if (ordersRes.data) setOrders(ordersRes.data)
            if (chatRes.data?.custom_fields) setCustomFields(chatRes.data.custom_fields)
            setFieldDefs(fieldsRes.fields || [])
            setLoading(false)
        }
        fetchData()
    }, [phoneNumber, chatId, supabase])

    const saveFieldValue = async (fieldName: string, value: string) => {
        const updated = { ...customFields, [fieldName]: value }
        setCustomFields(updated)
        setEditingField(null)
        await supabase.from('chats').update({ custom_fields: updated }).eq('id', chatId)
    }

    return (
        <div className="w-72 border-l border-black/[0.08] bg-[#F7F8FA] flex flex-col h-full overflow-y-auto shrink-0">
            {/* Header */}
            <div className="p-4 border-b border-black/[0.08] bg-white flex items-center justify-between shrink-0">
                <h3 className="text-[#0F172A] font-semibold text-sm flex items-center gap-2">
                    <User size={14} className="text-[#25D366]" />
                    Info del contacto
                </h3>
                <button onClick={onClose} className="text-[#0F172A]/35 hover:text-[#0F172A] transition-colors">
                    <X size={16} />
                </button>
            </div>

            {/* Contact header */}
            <div className="p-4 border-b border-black/[0.08]">
                <div className="flex flex-col items-center gap-3 text-center">
                    <div className="w-16 h-16 rounded-full bg-[#25D366] flex items-center justify-center text-black font-bold text-2xl">
                        {contactName ? contactName.charAt(0).toUpperCase() : '#'}
                    </div>
                    <div>
                        <p className="text-[#0F172A] font-semibold text-base">{contactName}</p>
                        <p className="text-[#0F172A]/35 text-xs flex items-center justify-center gap-1 mt-0.5">
                            <Phone size={11} /> {phoneNumber}
                        </p>
                    </div>
                    {tags && tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-center">
                            {tags.map(tag => {
                                const tc = CRM_TAGS[tag]
                                if (!tc) return null
                                return (
                                    <span key={tag} className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", tc.bg, tc.color)}>
                                        {tc.icon} {tc.label}
                                    </span>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="flex-1 p-3 space-y-3">
                    {/* Suscripciones */}
                    <div>
                        <p className="text-[10px] font-bold text-[#0F172A]/35 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Package size={10} /> Suscripciones ({subscriptions.length})
                        </p>
                        {subscriptions.length === 0 ? (
                            <p className="text-[#0F172A]/25 text-xs text-center py-3 bg-black/[0.02] rounded-xl border border-black/[0.04]">
                                Sin suscripciones
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {subscriptions.map(sub => {
                                    const statusInfo = SUB_STATUS_LABELS[sub.estado?.toLowerCase()] || { label: sub.estado, color: 'text-[#0F172A]/55', bg: 'bg-black/[0.05]' }
                                    return (
                                        <div key={sub.id} className="bg-white border border-black/[0.08] rounded-xl p-3 space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <p className="text-[#0F172A] font-semibold text-xs truncate flex-1">{sub.servicio || '—'}</p>
                                                <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium ml-2", statusInfo.bg, statusInfo.color)}>
                                                    {statusInfo.label}
                                                </span>
                                            </div>
                                            {sub.vencimiento && (
                                                <p className="text-[#0F172A]/35 text-[11px] flex items-center gap-1">
                                                    <Calendar size={10} /> Vence: {formatDate(sub.vencimiento)}
                                                </p>
                                            )}
                                            {sub.correo && (
                                                <p className="text-[#0F172A]/35 text-[11px] flex items-center gap-1 truncate">
                                                    <Mail size={10} /> {sub.correo}
                                                </p>
                                            )}
                                            {sub.equipo && (
                                                <p className="text-[#0F172A]/35 text-[11px] flex items-center gap-1">
                                                    <Users size={10} /> {sub.equipo}
                                                </p>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Campos personalizados */}
                    {fieldDefs.length > 0 && (
                        <div>
                            <p className="text-[10px] font-bold text-[#0F172A]/35 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Database size={10} /> Datos del contacto ({fieldDefs.length})
                            </p>
                            <div className="space-y-1">
                                {fieldDefs.map(fd => {
                                    const val = customFields[fd.field_name]
                                    const isEditing = editingField === fd.field_name
                                    return (
                                        <div key={fd.id} className="bg-white border border-black/[0.08] rounded-lg px-3 py-2 flex items-center justify-between gap-2 group">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] text-[#0F172A]/35 font-medium">{fd.description || fd.field_name}</p>
                                                {isEditing ? (
                                                    <div className="flex items-center gap-1 mt-0.5">
                                                        <input
                                                            type={fd.field_type === 'number' ? 'number' : fd.field_type === 'date' ? 'date' : 'text'}
                                                            className="text-xs text-[#0F172A] bg-[#F7F8FA] border border-black/[0.1] rounded px-1.5 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-[#25D366]"
                                                            value={editValue}
                                                            onChange={e => setEditValue(e.target.value)}
                                                            onKeyDown={e => { if (e.key === 'Enter') saveFieldValue(fd.field_name, editValue); if (e.key === 'Escape') setEditingField(null) }}
                                                            autoFocus
                                                        />
                                                        <button onClick={() => saveFieldValue(fd.field_name, editValue)} className="text-[#25D366] hover:text-emerald-700 shrink-0">
                                                            <Check size={12} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-[#0F172A] truncate mt-0.5">
                                                        {val || <span className="text-[#0F172A]/20 italic">Sin dato</span>}
                                                    </p>
                                                )}
                                            </div>
                                            {!isEditing && (
                                                <button
                                                    onClick={() => { setEditingField(fd.field_name); setEditValue(String(val ?? '')) }}
                                                    className="text-[#0F172A]/15 hover:text-[#25D366] transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                                                >
                                                    <Pencil size={11} />
                                                </button>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Pedidos */}
                    <div>
                        <p className="text-[10px] font-bold text-[#0F172A]/35 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <ShoppingBag size={10} /> Pedidos ({orders.length})
                        </p>
                        {orders.length === 0 ? (
                            <p className="text-[#0F172A]/25 text-xs text-center py-3 bg-black/[0.02] rounded-xl border border-black/[0.04]">
                                Sin pedidos
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {orders.map(order => {
                                    const statusInfo = ORDER_STATUS_LABELS[order.status] || { label: order.status, color: 'text-[#0F172A]/55', bg: 'bg-black/[0.05]' }
                                    return (
                                        <div key={order.id} className="bg-white border border-black/[0.08] rounded-xl p-3 space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <p className="text-[#0F172A] font-semibold text-xs truncate flex-1">{order.plan_name || '—'}</p>
                                                {order.amount != null && (
                                                    <span className="text-[#25D366] text-xs font-bold ml-2 shrink-0">
                                                        Bs {order.amount}
                                                    </span>
                                                )}
                                            </div>
                                            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium inline-block", statusInfo.bg, statusInfo.color)}>
                                                {statusInfo.label}
                                            </span>
                                            <p className="text-[#0F172A]/35 text-[11px] flex items-center gap-1">
                                                <Calendar size={10} /> {formatDate(order.created_at)}
                                            </p>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
