import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { CheckCircle2, Bot, BookOpen, Zap, ShoppingBag, MessageSquare, Sparkles, TrendingUp, ArrowRight, Bell, AlertTriangle, Calendar, Users, Activity, Send, FileText } from 'lucide-react'
import Link from 'next/link'
import { isOverLimit, isNearLimit } from '@/lib/plans'

// Parsear fecha DD/MM/YYYY o YYYY-MM-DD
function parseDate(dateStr: string): Date | null {
    if (!dateStr) return null
    const ddmm = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (ddmm) return new Date(parseInt(ddmm[3]), parseInt(ddmm[2]) - 1, parseInt(ddmm[1]))
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? null : d
}

function formatDate(dateStr: string): string {
    const d = parseDate(dateStr)
    if (!d) return dateStr
    return d.toLocaleDateString('es-BO', { day: 'numeric', month: 'short' })
}

function diffDays(dateStr: string): number {
    const d = parseDate(dateStr)
    if (!d) return 999
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    d.setHours(0, 0, 0, 0)
    return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export default async function HomePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return redirect('/login')

    const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario'

    // Fetch plan usage
    const serviceKey = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey!)
    const { data: planProfile } = await admin
        .from('user_profiles')
        .select('conversations_balance, conversations_total')
        .eq('id', user.id)
        .maybeSingle()
    const convBalance = planProfile?.conversations_balance ?? null
    const convTotal = planProfile?.conversations_total ?? 500
    const planOverLimit = convBalance !== null && isOverLimit(convBalance)
    const planNearLimit = convBalance !== null && !planOverLimit && isNearLimit(convBalance, convTotal)

    const now = new Date()
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const last7d  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [
        { data: assistants },
        { data: products },
        { data: flowsData },
        { count: totalChats },
        { count: activeChatsToday },
        { data: activeSubs },
        { count: activeTriggers },
        { data: recentNotifs },
        { data: recentMessages },
        { count: totalSubsCount },
    ] = await Promise.all([
        supabase.from('whatsapp_credentials').select('id, bot_name, training_prompt').eq('user_id', user.id),
        supabase.from('products').select('id').eq('user_id', user.id).limit(1),
        supabase.from('flows').select('id').eq('user_id', user.id).limit(1),
        supabase.from('chats').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('chats').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('last_message_time', last24h),
        supabase.from('subscriptions').select('id, correo, numero, vencimiento, estado, servicio, equipo').eq('user_id', user.id).eq('estado', 'activo'),
        supabase.from('triggers').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_active', true),
        supabase.from('subscription_notification_logs').select('message_type, status, created_at, phone_number').eq('user_id', user.id).gte('created_at', last7d).order('created_at', { ascending: false }).limit(20),
        supabase.from('chats').select('last_message, last_message_time, contact_name, phone_number').eq('user_id', user.id).gte('last_message_time', last24h).order('last_message_time', { ascending: false }).limit(5),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ])

    // ── Cálculo de métricas ──────────────────────────────────────
    const hasAssistant     = (assistants?.length ?? 0) > 0
    const hasTraining      = assistants?.some(a => a.training_prompt && a.training_prompt.trim().length > 50)
    const hasProducts      = (products?.length ?? 0) > 0
    const hasFlows         = (flowsData?.length ?? 0) > 0
    const hasChats         = (totalChats ?? 0) > 0
    const hasSubscriptions = (totalSubsCount ?? 0) > 0

    const totalActivas  = activeSubs?.length ?? 0
    const vencenHoy     = activeSubs?.filter(s => diffDays(s.vencimiento) === 0) ?? []
    const vencen7d      = activeSubs?.filter(s => { const d = diffDays(s.vencimiento); return d >= 0 && d <= 7 }) ?? []
    const vencidas      = activeSubs?.filter(s => diffDays(s.vencimiento) < 0) ?? []

    const porServicio: Record<string, { total: number; vencen7: number }> = {}
    for (const sub of activeSubs ?? []) {
        const svc = sub.servicio || 'Servicio'
        if (!porServicio[svc]) porServicio[svc] = { total: 0, vencen7: 0 }
        porServicio[svc].total++
        if (diffDays(sub.vencimiento) <= 7 && diffDays(sub.vencimiento) >= 0) porServicio[svc].vencen7++
    }

    const notifsEnviadas = recentNotifs?.filter(n => n.status === 'sent').length ?? 0
    const notifsFallidas = recentNotifs?.filter(n => n.status === 'failed').length ?? 0

    // ── Pasos de onboarding ──────────────────────────────────────
    const GREEN = '#25D366'
    const GREEN_RGB = '37,211,102'

    const steps = [
        { done: hasAssistant,     title: 'Conecta tu WhatsApp',      description: 'Vincula tu número Business.',                  icon: Bot,           href: '/dashboard/settings',                                                                          cta: 'Configurar', color: GREEN, rgb: GREEN_RGB },
        { done: hasTraining,      title: 'Entrena tu asistente IA',  description: 'Cuéntale a tu bot sobre tu negocio.',           icon: BookOpen,      href: hasAssistant ? `/dashboard/assistants/${assistants![0].id}/training` : '/dashboard/assistants',  cta: 'Entrenar',   color: GREEN, rgb: GREEN_RGB },
        { done: hasProducts,      title: 'Agrega tu catálogo',       description: 'Define productos con precios.',                 icon: ShoppingBag,   href: '/dashboard/products',                                                                          cta: 'Agregar',    color: GREEN, rgb: GREEN_RGB },
        { done: hasSubscriptions || hasChats, title: 'Registra tus clientes',       description: 'Importa clientes o espera el primer mensaje.',  icon: Users,         href: '/dashboard/subscriptions',                                                                     cta: 'Agregar',    color: GREEN, rgb: GREEN_RGB },
        { done: hasFlows,         title: 'Crea tu primer flujo',     description: 'Diseña el árbol de conversación.',              icon: Zap,           href: hasAssistant ? `/dashboard/assistants/${assistants![0].id}/flows` : '/dashboard/assistants',    cta: 'Crear',      color: GREEN, rgb: GREEN_RGB },
        { done: hasChats,         title: 'Recibe tu primer mensaje', description: 'Cuando un cliente escriba, aparecerá aquí.',    icon: MessageSquare, href: '/dashboard/chats',                                                                             cta: 'Ver Chats',  color: GREEN, rgb: GREEN_RGB },
    ]

    const completedSteps = steps.filter(s => s.done).length
    const allDone = completedSteps === steps.length
    const progressPct = Math.round((completedSteps / steps.length) * 100)

    const SVC_COLOR = { color: GREEN, rgb: GREEN_RGB, bg: 'rgba(37,211,102,0.10)' }

    const NOTIF_LABEL: Record<string, string> = { reminder: 'Recordatorio', followup: 'Remarketing', urgency: 'Último aviso' }

    return (
        <div style={{ minHeight: '100vh', padding: '32px', maxWidth: 1400, margin: '0 auto' }}>

            {/* ── PLAN USAGE BANNER ── */}
            {planOverLimit && (
                <div style={{
                    background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.25)',
                    borderRadius: 12, padding: '14px 20px', marginBottom: 20,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <AlertTriangle size={18} style={{ color: '#fb7185', flexShrink: 0 }} />
                        <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#fb7185' }}>
                            Sin conversaciones — el bot no está respondiendo
                        </p>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(15,23,42,0.40)' }}>
                            Recarga tu saldo para reactivarlo.
                        </p>
                    </div>
                    <Link href="/dashboard/upgrade" style={{
                        background: '#fb7185', color: '#fff', borderRadius: '9999px',
                        padding: '0.5rem 1.25rem', fontWeight: 800, fontSize: '0.8rem', textDecoration: 'none',
                        whiteSpace: 'nowrap',
                    }}>
                        Recargar ahora →
                    </Link>
                </div>
            )}
            {planNearLimit && (
                <div style={{
                    background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)',
                    borderRadius: 12, padding: '14px 20px', marginBottom: 20,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Zap size={16} style={{ color: '#fbbf24', flexShrink: 0 }} />
                        <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#fbbf24' }}>
                            Te quedan {convBalance} conversaciones
                        </p>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(15,23,42,0.40)' }}>
                            Recarga pronto para no interrumpir el servicio.
                        </p>
                    </div>
                    <Link href="/dashboard/upgrade" style={{
                        background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)',
                        borderRadius: '9999px', padding: '0.5rem 1.25rem', fontWeight: 800, fontSize: '0.8rem', textDecoration: 'none',
                        whiteSpace: 'nowrap',
                    }}>
                        Ver planes →
                    </Link>
                </div>
            )}

            {/* ── HERO ── */}
            <div style={{
                background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
                border: '1px solid rgba(37,211,102,0.20)',
                borderRadius: 16, padding: '32px 36px', marginBottom: 28, position: 'relative', overflow: 'hidden',
                borderTop: '2px solid rgba(37,211,102,0.45)',
            }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <div style={{ padding: '5px 14px', borderRadius: 20, background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.25)', fontSize: 11, fontWeight: 700, color: GREEN, letterSpacing: '0.05em' }}>
                            ● EN LÍNEA
                        </div>
                        {allDone && (
                            <div style={{ padding: '5px 14px', borderRadius: 20, background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.25)', fontSize: 11, fontWeight: 700, color: GREEN }}>
                                ✅ Todo configurado
                            </div>
                        )}
                        {hasSubscriptions && vencenHoy.length > 0 && (
                            <div style={{ padding: '5px 14px', borderRadius: 20, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', fontSize: 11, fontWeight: 700, color: '#f87171' }}>
                                ⚠️ {vencenHoy.length} suscripción{vencenHoy.length > 1 ? 'es vencen' : ' vence'} hoy
                            </div>
                        )}
                    </div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#0F172A', marginBottom: 10, lineHeight: 1.2 }}>
                        Hola, <span style={{ color: GREEN }}>{userName}</span>
                    </h1>
                    <p style={{ color: 'rgba(15,23,42,0.55)', fontSize: '1rem', maxWidth: 520, lineHeight: 1.6 }}>
                        {allDone
                            ? '¡Tu asistente está listo! Tus clientes están siendo atendidos automáticamente.'
                            : `Completa ${steps.length - completedSteps} paso${steps.length - completedSteps > 1 ? 's' : ''} más para tener tu bot completamente operativo.`}
                    </p>
                    {!allDone && (
                        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ flex: 1, maxWidth: 280, height: 5, background: 'rgba(0,0,0,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${progressPct}%`, background: GREEN, borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: GREEN }}>{progressPct}% listo</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── KPI CARDS ROW — dinámico según tipo de negocio ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5 mb-7">
                {[
                    { Icon: MessageSquare, label: 'Chats hoy',            value: activeChatsToday ?? 0, sub: `de ${totalChats ?? 0} totales`,           color: GREEN },
                    ...(hasSubscriptions ? [
                        { Icon: Users,         label: 'Clientes activos',    value: totalActivas,          sub: `${vencidas.length} vencidas sin renovar`,  color: GREEN },
                        { Icon: AlertTriangle, label: 'Vencen esta semana',  value: vencen7d.length,       sub: `${vencenHoy.length} vencen hoy`,           color: vencen7d.length > 0 ? '#d97706' : 'rgba(15,23,42,0.30)' },
                    ] : [
                        { Icon: Users,         label: 'Contactos totales',   value: totalChats ?? 0,       sub: `${activeChatsToday ?? 0} activos hoy`,     color: GREEN },
                    ]),
                    { Icon: Zap,           label: 'Disparadores activos',  value: activeTriggers ?? 0,   sub: 'reglas automáticas funcionando',                  color: GREEN },
                    { Icon: Send,          label: 'Notificaciones (7d)',   value: notifsEnviadas,        sub: `${notifsFallidas} fallidas`,               color: GREEN },
                    { Icon: Bot,           label: 'Asistente IA',          value: hasAssistant ? '✓' : '—', sub: hasTraining ? 'Entrenado' : 'Sin entrenar', color: hasTraining ? GREEN : 'rgba(15,23,42,0.30)' },
                ].map((stat, i) => (
                    <div key={i} style={{
                        padding: '16px 18px', borderRadius: 12, background: '#ffffff',
                        border: '1px solid rgba(0,0,0,0.07)',
                        borderTop: `2px solid ${stat.color}`,
                        position: 'relative', overflow: 'hidden',
                    }}>
                        <stat.Icon size={18} style={{ color: stat.color, marginBottom: 8 }} />
                        <div style={{ fontSize: '1.7rem', fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(15,23,42,0.65)', marginTop: 5 }}>{stat.label}</div>
                        <div style={{ fontSize: '0.65rem', color: 'rgba(15,23,42,0.35)', marginTop: 3 }}>{stat.sub}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-7 items-start">

                {/* ── COLUMNA IZQUIERDA ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                    {/* Clientes por servicio (solo si usa suscripciones) */}
                    {hasSubscriptions && totalActivas > 0 && (
                        <div>
                            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Users size={16} style={{ color: GREEN }} />
                                <span style={{ color: '#0F172A' }}>Clientes por servicio</span>
                                <Link href="/dashboard/subscriptions" style={{ marginLeft: 'auto', fontSize: '0.75rem', color: GREEN, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    Ver todas <ArrowRight size={12} />
                                </Link>
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {Object.entries(porServicio).map(([svc, data]) => {
                                    return (
                                        <div key={svc} style={{ padding: '16px 18px', borderRadius: 12, background: '#ffffff', border: '1px solid rgba(0,0,0,0.07)', borderTop: `2px solid ${GREEN}`, position: 'relative', overflow: 'hidden' }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: GREEN, letterSpacing: '0.08em', marginBottom: 8 }}>{svc}</div>
                                            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{data.total}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'rgba(15,23,42,0.40)', marginTop: 4 }}>activas</div>
                                            {data.vencen7 > 0 && (
                                                <div style={{ marginTop: 10, padding: '4px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.10)', fontSize: '0.65rem', fontWeight: 700, color: 'rgba(15,23,42,0.65)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                    ⚠️ {data.vencen7} vencen pronto
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Vencimientos próximos (solo si usa suscripciones) */}
                    {hasSubscriptions && vencen7d.length > 0 && (
                        <div>
                            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Calendar size={16} style={{ color: 'rgba(15,23,42,0.55)' }} />
                                <span style={{ color: '#0F172A' }}>Vencimientos próximos</span>
                                <span style={{ marginLeft: 8, fontSize: '0.7rem', padding: '2px 8px', borderRadius: 10, background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.10)', color: 'rgba(15,23,42,0.65)', fontWeight: 700 }}>
                                    {vencen7d.length} esta semana
                                </span>
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {vencen7d.slice(0, 8).map((sub) => {
                                    const days = diffDays(sub.vencimiento)
                                    const urgent = days <= 1
                                    return (
                                        <div key={sub.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            padding: '10px 14px', borderRadius: 12,
                                            background: urgent ? 'rgba(220,38,38,0.04)' : '#ffffff',
                                            border: urgent ? '1px solid rgba(220,38,38,0.25)' : '1px solid rgba(0,0,0,0.07)',
                                        }}>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: SVC_COLOR.bg, color: SVC_COLOR.color }}>
                                                {sub.servicio || 'Servicio'}
                                            </span>
                                            <span style={{ fontSize: '0.8rem', color: '#0F172A', flex: 1, fontFamily: 'monospace' }}>
                                                {sub.correo || sub.numero}
                                            </span>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: urgent ? '#dc2626' : 'rgba(15,23,42,0.55)', whiteSpace: 'nowrap' }}>
                                                {days === 0 ? '¡Hoy!' : days === 1 ? 'Mañana' : `${days}d · ${formatDate(sub.vencimiento)}`}
                                            </span>
                                        </div>
                                    )
                                })}
                                {vencen7d.length > 8 && (
                                    <Link href="/dashboard/subscriptions" style={{ textAlign: 'center', padding: '8px', fontSize: '0.75rem', color: GREEN, textDecoration: 'none' }}>
                                        Ver {vencen7d.length - 8} más →
                                    </Link>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Pasos de configuración — siempre visible */}
                    <div>
                        <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Sparkles size={16} style={{ color: GREEN }} />
                            <span style={{ color: '#0F172A' }}>{allDone ? '¡Configuración completa! 🎉' : `Primeros pasos — ${completedSteps}/${steps.length}`}</span>
                        </h2>
                        {allDone ? (() => {
                            // Determinar próxima acción prioritaria
                            const nextAction = planOverLimit
                                ? { color: '#ef4444', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.22)', icon: '🚨', title: 'Plan agotado — el bot no puede responder', desc: 'Recarga tu saldo ahora para reactivar la atención automática a tus clientes.', href: '/dashboard/recharges', cta: 'Recargar ahora' }
                                : planNearLimit
                                ? { color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.22)', icon: '⚡', title: `Te quedan pocas conversaciones (${convBalance} restantes)`, desc: 'Considera recargar para no interrumpir el servicio a tus clientes.', href: '/dashboard/recharges', cta: 'Ver recargas' }
                                : hasSubscriptions && vencenHoy.length > 0
                                ? { color: '#ef4444', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.22)', icon: '⚠️', title: `${vencenHoy.length} cliente${vencenHoy.length > 1 ? 's vencen' : ' vence'} hoy`, desc: 'Revisa los vencimientos del día.', href: '/dashboard/subscriptions', cta: 'Ver clientes' }
                                : hasSubscriptions && vencen7d.length > 0
                                ? { color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.22)', icon: '📅', title: `${vencen7d.length} vencimiento${vencen7d.length > 1 ? 's' : ''} esta semana`, desc: 'Avisa a tus clientes o gestiona las renovaciones.', href: '/dashboard/subscriptions', cta: 'Ver vencimientos' }
                                : notifsFallidas > 0
                                ? { color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.22)', icon: '📩', title: `${notifsFallidas} notificación${notifsFallidas > 1 ? 'es fallaron' : ' falló'} esta semana`, desc: 'Algunos clientes no recibieron sus recordatorios. Revisa los detalles.', href: '/dashboard/home', cta: 'Revisar' }
                                : { color: GREEN, bg: 'rgba(37,211,102,0.06)', border: 'rgba(37,211,102,0.20)', icon: '🎉', title: 'Todo al día', desc: 'Tu bot está activo y atendiendo clientes automáticamente. Sigue monitoreando desde aquí.', href: null, cta: null }

                            return (
                                <div style={{ padding: '20px 24px', borderRadius: 16, background: nextAction.bg, border: `1px solid ${nextAction.border}`, display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <span style={{ fontSize: 28, flexShrink: 0 }}>{nextAction.icon}</span>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontWeight: 700, color: nextAction.color, fontSize: '0.9rem', margin: 0 }}>{nextAction.title}</p>
                                        <p style={{ fontSize: '0.78rem', color: 'rgba(15,23,42,0.50)', marginTop: 4, margin: '4px 0 0' }}>{nextAction.desc}</p>
                                    </div>
                                    {nextAction.href && nextAction.cta && (
                                        <Link href={nextAction.href} style={{ flexShrink: 0, padding: '7px 16px', borderRadius: 20, background: nextAction.color, color: '#fff', fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                                            {nextAction.cta} →
                                        </Link>
                                    )}
                                </div>
                            )
                        })() : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {steps.map((step, i) => (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 14,
                                        border: step.done ? '1px solid rgba(37,211,102,0.15)' : '1px solid rgba(37,211,102,0.10)',
                                        background: step.done ? 'rgba(37,211,102,0.04)' : 'rgba(37,211,102,0.02)',
                                        opacity: step.done ? 0.6 : 1,
                                        transition: 'opacity 0.2s',
                                    }}>
                                        <div style={{
                                            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                                            background: step.done ? 'rgba(37,211,102,0.12)' : 'rgba(37,211,102,0.08)',
                                            border: `2px solid ${step.done ? 'rgba(37,211,102,0.30)' : 'rgba(37,211,102,0.18)'}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {step.done
                                                ? <CheckCircle2 size={15} style={{ color: GREEN }} />
                                                : <step.icon size={15} style={{ color: GREEN }} />
                                            }
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0F172A', textDecoration: step.done ? 'line-through' : 'none', textDecorationColor: 'rgba(37,211,102,0.4)' }}>
                                                {step.title}
                                            </p>
                                            <p style={{ fontSize: '0.72rem', color: 'rgba(15,23,42,0.45)', marginTop: 1 }}>{step.description}</p>
                                        </div>
                                        {step.done ? (
                                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: GREEN, whiteSpace: 'nowrap' }}>✓ Listo</span>
                                        ) : (
                                            <Link href={step.href} style={{
                                                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
                                                fontSize: '0.73rem', fontWeight: 700, color: GREEN, padding: '5px 11px',
                                                borderRadius: 8, background: 'rgba(37,211,102,0.10)', border: '1px solid rgba(37,211,102,0.25)',
                                                textDecoration: 'none', whiteSpace: 'nowrap',
                                            }}>
                                                {step.cta} <ArrowRight size={10} />
                                            </Link>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── COLUMNA DERECHA ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* Actividad reciente de chats */}
                    {(recentMessages?.length ?? 0) > 0 && (
                        <div>
                            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Activity size={16} style={{ color: GREEN }} />
                                <span style={{ color: '#0F172A' }}>Actividad reciente</span>
                                <Link href="/dashboard/chats" style={{ marginLeft: 'auto', fontSize: '0.72rem', color: GREEN, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                                    Ver chats <ArrowRight size={11} />
                                </Link>
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {recentMessages!.map((chat, i) => {
                                    const time = chat.last_message_time
                                        ? new Date(chat.last_message_time).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
                                        : ''
                                    return (
                                        <Link key={i} href="/dashboard/chats" style={{
                                            display: 'flex', alignItems: 'flex-start', gap: 10,
                                            padding: '10px 12px', borderRadius: 12, background: '#ffffff',
                                            border: '1px solid rgba(0,0,0,0.07)', textDecoration: 'none',
                                        }}>
                                            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(37,211,102,0.10)', border: '1px solid rgba(37,211,102,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <MessageSquare size={15} style={{ color: GREEN }} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0F172A', marginBottom: 2 }}>
                                                    {chat.contact_name || chat.phone_number}
                                                </p>
                                                <p style={{ fontSize: '0.7rem', color: 'rgba(15,23,42,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {chat.last_message || '—'}
                                                </p>
                                            </div>
                                            <span style={{ fontSize: '0.65rem', color: 'rgba(15,23,42,0.25)', flexShrink: 0 }}>{time}</span>
                                        </Link>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Notificaciones enviadas esta semana */}
                    {(recentNotifs?.length ?? 0) > 0 && (
                        <div>
                            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Bell size={16} style={{ color: GREEN }} />
                                <span style={{ color: '#0F172A' }}>Notificaciones enviadas (7d)</span>
                            </h2>
                            <div style={{ padding: '14px 16px', borderRadius: 16, background: '#ffffff', border: '1px solid rgba(37,211,102,0.15)' }}>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                    {[
                                        { label: 'Enviadas', val: notifsEnviadas, color: GREEN,     bg: 'rgba(37,211,102,0.08)' },
                                        { label: 'Fallidas', val: notifsFallidas, color: '#f87171', bg: 'rgba(239,68,68,0.08)'  },
                                    ].map((s, i) => (
                                        <div key={i} style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: 10, background: s.bg }}>
                                            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: s.color }}>{s.val}</div>
                                            <div style={{ fontSize: '0.65rem', color: 'rgba(15,23,42,0.35)', marginTop: 2 }}>{s.label}</div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    {recentNotifs!.slice(0, 5).map((n, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: i < 4 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
                                            <span style={{
                                                fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: 5,
                                                background: n.status === 'sent' ? 'rgba(37,211,102,0.10)' : 'rgba(239,68,68,0.10)',
                                                color: n.status === 'sent' ? GREEN : '#f87171'
                                            }}>
                                                {n.status === 'sent' ? '✓' : '✗'}
                                            </span>
                                            <span style={{ fontSize: '0.72rem', color: 'rgba(15,23,42,0.50)', flex: 1 }}>
                                                {NOTIF_LABEL[n.message_type] || n.message_type}
                                            </span>
                                            <span style={{ fontSize: '0.65rem', color: 'rgba(15,23,42,0.25)', fontFamily: 'monospace' }}>
                                                {n.phone_number?.slice(-8)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Accesos rápidos */}
                    <div>
                        <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <TrendingUp size={16} style={{ color: GREEN }} />
                            <span style={{ color: '#0F172A' }}>Accesos rápidos</span>
                        </h2>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { Icon: MessageSquare, label: 'Chats',          href: '/dashboard/chats' },
                                { Icon: Zap,           label: 'Flujos',         href: hasAssistant ? `/dashboard/assistants/${assistants![0].id}/flows` : '/dashboard/assistants' },
                                { Icon: FileText,      label: 'Plantillas',     href: hasAssistant ? `/dashboard/assistants/${assistants![0].id}/templates` : '/dashboard/assistants' },
                                { Icon: Users,         label: 'Clientes',       href: '/dashboard/subscriptions' },
                            ].map((item, i) => (
                                <Link key={i} href={item.href} style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '11px 14px', borderRadius: 10, background: '#ffffff',
                                    border: '1px solid rgba(0,0,0,0.07)', textDecoration: 'none',
                                    fontSize: '0.82rem', fontWeight: 600, color: 'rgba(15,23,42,0.75)',
                                }}>
                                    <item.Icon size={16} style={{ color: GREEN, flexShrink: 0 }} />
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
