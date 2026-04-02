'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import {
    LayoutDashboard, MessageSquare, Bot, Home, BrainCircuit,
    ShoppingCart, Package, RefreshCcw, GitBranch, Zap,
    FileText, Settings, Users, Trophy, CreditCard, ChevronRight, Building2, Bell
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

// ── NavItem ──────────────────────────────────────────────────
interface NavItemProps {
    href: string
    icon: React.ReactNode
    label: string
    active: boolean
    badge?: number
    onNavigate?: () => void
    disabled?: boolean
    accentColor?: string
}

function NavItem({ href, icon, label, active, badge, onNavigate, disabled, accentColor = '#25D366' }: NavItemProps) {
    if (disabled) {
        return (
            <div
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium opacity-30 cursor-not-allowed select-none"
                style={{ color: 'rgba(15,23,42,0.40)' }}
            >
                {icon}
                <span className="flex-1">{label}</span>
            </div>
        )
    }

    const hexToRgb = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        return `${r},${g},${b}`
    }
    const rgb = hexToRgb(accentColor)

    return (
        <Link
            href={href}
            onClick={onNavigate}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative"
            style={active ? {
                background: `rgba(${rgb},0.10)`,
                color: accentColor,
                borderLeft: `3px solid ${accentColor}`,
                paddingLeft: 13,
            } : {
                color: 'rgba(15,23,42,0.50)',
                borderLeft: '3px solid transparent',
            }}
            onMouseEnter={e => {
                if (!active) {
                    (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(37,211,102,0.07)'
                    ;(e.currentTarget as HTMLAnchorElement).style.color = 'rgba(15,23,42,0.85)'
                }
            }}
            onMouseLeave={e => {
                if (!active) {
                    (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLAnchorElement).style.color = 'rgba(15,23,42,0.50)'
                }
            }}
        >
            <span
                className="transition-transform duration-150 group-hover:scale-110 flex-shrink-0"
                style={{ color: active ? accentColor : 'inherit' }}
            >
                {icon}
            </span>
            <span className="flex-1 truncate">{label}</span>
            {badge !== undefined && badge > 0 && (
                <span
                    className="min-w-5 h-5 px-1.5 text-black text-[10px] font-bold rounded-full flex items-center justify-center"
                    style={{ background: '#25D366', boxShadow: '0 0 8px rgba(37,211,102,0.4)' }}
                >
                    {badge > 99 ? '99+' : badge}
                </span>
            )}
        </Link>
    )
}

// ── SectionLabel ─────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
    return (
        <div className="px-4 pt-5 pb-1">
            <p
                className="text-[9px] font-bold uppercase tracking-[0.2em]"
                style={{ color: 'rgba(37,211,102,0.65)' }}
            >
                {label}
            </p>
        </div>
    )
}

// ── SidebarNav ────────────────────────────────────────────────
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
    const pathname = usePathname()
    const params = useParams()
    const paramId = params?.assistantId as string | undefined

    const [activeId, setActiveId] = useState<string | undefined>(paramId)
    const [assistantName, setAssistantName] = useState<string>('')
    const [isAdmin, setIsAdmin] = useState(false)
    const [pendingRenewals, setPendingRenewals] = useState(0)

    useEffect(() => {
        if (paramId) {
            setActiveId(paramId)
            localStorage.setItem('jaba_active_assistant', paramId)
        } else {
            const savedId = localStorage.getItem('jaba_active_assistant')
            if (savedId) setActiveId(savedId)
        }
    }, [paramId])

    useEffect(() => {
        async function loadData() {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: creds } = await supabase
                .from('whatsapp_credentials')
                .select('id, bot_name, is_platform_admin')
                .eq('user_id', user.id)

            if (creds && creds.length > 0) {
                setIsAdmin(creds.some(c => c.is_platform_admin === true))
                const targetId = activeId || localStorage.getItem('jaba_active_assistant')
                const active = creds.find(c => c.id === targetId) || creds[0]
                if (active) setAssistantName(active.bot_name || 'Mi Asistente')
            }
        }
        loadData()
    }, [activeId])

    useEffect(() => {
        if (!isAdmin) return
        const supabase = createClient()
        const fetchPending = async () => {
            const { count } = await supabase
                .from('subscription_renewals')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending_review')
            setPendingRenewals(count || 0)
        }
        fetchPending()
        const channel = supabase
            .channel('sidebar-renewals')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'subscription_renewals' }, fetchPending)
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [isAdmin])

    const hasAssistant = !!activeId
    const nav = () => { if (onNavigate) onNavigate() }
    const is = (path: string) => pathname === path
    const startsWith = (path: string) => pathname.startsWith(path)
    const includes = (path: string) => pathname.includes(path)

    return (
        <nav
            className="flex-1 overflow-y-auto py-2 space-y-0.5"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(37,211,102,0.2) transparent' }}
        >
            {/* ── GENERAL ── */}
            <div className="px-3">
                <NavItem href="/dashboard/home"
                    icon={<Home size={17} />} label="Inicio"
                    active={is('/dashboard/home')} onNavigate={nav}
                    accentColor="#25D366" />
                <NavItem
                    href={hasAssistant ? `/dashboard/assistants/${activeId}` : '/dashboard'}
                    icon={<LayoutDashboard size={17} />} label="Dashboard"
                    active={is('/dashboard') || is(`/dashboard/assistants/${activeId}`)}
                    onNavigate={nav} accentColor="#25D366" />
                <NavItem href="/dashboard/assistants"
                    icon={<Bot size={17} />} label="Asistentes"
                    active={is('/dashboard/assistants') || is('/dashboard/assistants/new')}
                    onNavigate={nav} accentColor="#25D366" />
            </div>

            {/* ── COMUNICACIÓN ── */}
            <div className="px-3">
                <SectionLabel label="Comunicación" />
                <NavItem href="/dashboard/chats"
                    icon={<MessageSquare size={17} />} label="Conversaciones"
                    active={startsWith('/dashboard/chats')} onNavigate={nav}
                    disabled={!hasAssistant} accentColor="#25D366" />
                <NavItem href="/dashboard/orders"
                    icon={<ShoppingCart size={17} />} label="Pedidos"
                    active={startsWith('/dashboard/orders')} onNavigate={nav}
                    disabled={!hasAssistant} accentColor="#25D366" />
                <NavItem href="/dashboard/products"
                    icon={<Package size={17} />} label="Catálogo"
                    active={startsWith('/dashboard/products')} onNavigate={nav}
                    disabled={!hasAssistant} accentColor="#25D366" />
            </div>

            {/* ── AUTOMATIZACIÓN ── */}
            <div className="px-3">
                <SectionLabel label="Automatización" />
                <NavItem
                    href={hasAssistant ? `/dashboard/assistants/${activeId}/training` : '#'}
                    icon={<BrainCircuit size={17} />} label="Entrenamiento IA"
                    active={includes('/training')} onNavigate={nav}
                    disabled={!hasAssistant} accentColor="#25D366" />
                <NavItem
                    href={hasAssistant ? `/dashboard/assistants/${activeId}/flows` : '#'}
                    icon={<GitBranch size={17} />} label="Flujos"
                    active={includes('/flows')} onNavigate={nav}
                    disabled={!hasAssistant} accentColor="#25D366" />
                <NavItem
                    href={hasAssistant ? `/dashboard/assistants/${activeId}/triggers` : '#'}
                    icon={<Zap size={17} />} label="Disparadores"
                    active={includes('/triggers')} onNavigate={nav}
                    disabled={!hasAssistant} accentColor="#25D366" />
                <NavItem
                    href={hasAssistant ? `/dashboard/assistants/${activeId}/templates` : '#'}
                    icon={<FileText size={17} />} label="Plantillas"
                    active={includes('/templates')} onNavigate={nav}
                    disabled={!hasAssistant} accentColor="#25D366" />
            </div>

            {/* ── GESTIÓN (admin) ── */}
            {isAdmin && (
                <div className="px-3">
                    <SectionLabel label="Gestión" />
                    <NavItem href="/dashboard/subscriptions"
                        icon={<Users size={17} />} label="Suscripciones"
                        active={is('/dashboard/subscriptions')} onNavigate={nav}
                        accentColor="#25D366" />
                    <NavItem href="/dashboard/renewals"
                        icon={<RefreshCcw size={17} />} label="Renovaciones"
                        active={is('/dashboard/renewals')} badge={pendingRenewals}
                        onNavigate={nav} accentColor="#25D366" />
                    <NavItem href="/dashboard/notifications"
                        icon={<Bell size={17} />} label="Notificaciones"
                        active={is('/dashboard/notifications')} onNavigate={nav}
                        accentColor="#25D366" />
                    <NavItem href="/dashboard/admin-accounts"
                        icon={<Building2 size={17} />} label="Cuentas"
                        active={startsWith('/dashboard/admin-accounts')} onNavigate={nav}
                        accentColor="#25D366" />
                </div>
            )}

            {/* ── MI CUENTA (no-admin) ── */}
            {!isAdmin && (
                <div className="px-3">
                    <SectionLabel label="Mi cuenta" />
                    <NavItem href="/dashboard/recharges"
                        icon={<CreditCard size={17} />} label="Recargas"
                        active={includes('/recharges')} onNavigate={nav}
                        accentColor="#25D366" />
                    <NavItem href="/dashboard/achievements"
                        icon={<Trophy size={17} />} label="Logros"
                        active={includes('/achievements')} onNavigate={nav}
                        accentColor="#25D366" />
                </div>
            )}

            {/* ── CONFIGURACIÓN ── */}
            <div className="px-3 pt-2">
                <NavItem href="/dashboard/settings"
                    icon={<Settings size={17} />} label="Configuración"
                    active={startsWith('/dashboard/settings')} onNavigate={nav}
                    disabled={!hasAssistant} accentColor="#25D366" />
            </div>

            {/* ── Asistente activo ── */}
            {hasAssistant && assistantName && (
                <div
                    className="mx-3 mt-4 p-3 rounded-xl"
                    style={{
                        background: 'rgba(37,211,102,0.06)',
                        border: '1px solid rgba(37,211,102,0.15)',
                    }}
                >
                    <p
                        className="text-[9px] font-bold uppercase tracking-widest mb-2"
                        style={{ color: 'rgba(37,211,102,0.50)' }}
                    >
                        Asistente activo
                    </p>
                    <div className="flex items-center gap-2">
                        <div
                            className="w-2 h-2 rounded-full flex-shrink-0 pulse-green"
                            style={{ background: '#25D366' }}
                        />
                        <p
                            className="text-sm font-semibold truncate"
                            style={{ color: '#0F172A' }}
                        >
                            {assistantName}
                        </p>
                    </div>
                    {activeId && (
                        <Link
                            href="/dashboard/assistants"
                            className="flex items-center gap-1 mt-2 text-[11px] font-medium transition-colors"
                            style={{ color: 'rgba(37,211,102,0.45)' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#25D366')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(37,211,102,0.45)')}
                        >
                            Cambiar asistente <ChevronRight size={10} />
                        </Link>
                    )}
                </div>
            )}
        </nav>
    )
}
