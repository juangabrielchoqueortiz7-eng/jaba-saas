import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { CheckCircle, CheckCircle2, Bot, BookOpen, Zap, ShoppingBag, MessageSquare, Sparkles, TrendingUp, ArrowRight, Bell, AlertTriangle, Calendar, Users, Activity } from 'lucide-react'
import Link from 'next/link'

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
        const svc = sub.servicio || 'CANVA'
        if (!porServicio[svc]) porServicio[svc] = { total: 0, vencen7: 0 }
        porServicio[svc].total++
        if (diffDays(sub.vencimiento) <= 7 && diffDays(sub.vencimiento) >= 0) porServicio[svc].vencen7++
    }

    const notifsEnviadas = recentNotifs?.filter(n => n.status === 'sent').length ?? 0
    const notifsFallidas = recentNotifs?.filter(n => n.status === 'failed').length ?? 0

    // ── Pasos de onboarding ──────────────────────────────────────
    const steps = [
        { done: hasAssistant,     title: 'Conecta tu WhatsApp',     description: 'Vincula tu número Business.',                  icon: Bot,         href: '/dashboard/settings',                                                                          cta: 'Configurar', color: '#10b981', rgb: '16,185,129'  },
        { done: hasTraining,      title: 'Entrena tu asistente IA', description: 'Cuéntale a tu bot sobre tu negocio.',           icon: BookOpen,    href: hasAssistant ? `/dashboard/assistants/${assistants![0].id}/training` : '/dashboard/assistants',  cta: 'Entrenar',   color: '#8b5cf6', rgb: '139,92,246' },
        { done: hasProducts,      title: 'Agrega tu catálogo',      description: 'Define productos con precios.',                 icon: ShoppingBag, href: '/dashboard/products',                                                                          cta: 'Agregar',    color: '#f97316', rgb: '249,115,22' },
        { done: hasSubscriptions, title: 'Agrega suscriptores',     description: 'Importa o crea tu primera suscripción.',        icon: Users,       href: '/dashboard/subscriptions',                                                                     cta: 'Agregar',    color: '#6366f1', rgb: '99,102,241' },
        { done: hasFlows,         title: 'Crea tu primer flujo',    description: 'Diseña el árbol de conversación.',              icon: Zap,         href: hasAssistant ? `/dashboard/assistants/${assistants![0].id}/flows` : '/dashboard/assistants',    cta: 'Crear',      color: '#06b6d4', rgb: '6,182,212'  },
        { done: hasChats,         title: 'Recibe tu primer mensaje', description: 'Cuando un cliente escriba, aparecerá aquí.',  icon: MessageSquare, href: '/dashboard/chats',                                                                           cta: 'Ver Chats',  color: '#a855f7', rgb: '168,85,247' },
    ]

    const completedSteps = steps.filter(s => s.done).length
    const allDone = completedSteps === steps.length
    const progressPct = Math.round((completedSteps / steps.length) * 100)

    const SVC_COLOR: Record<string, { color: string; rgb: string; bg: string }> = {
        CANVA:   { color: '#a78bfa', rgb: '167,139,250', bg: 'rgba(139,92,246,0.12)' },
        CHATGPT: { color: '#34d399', rgb: '52,211,153',  bg: 'rgba(16,185,129,0.12)' },
        GEMINI:  { color: '#60a5fa', rgb: '96,165,250',  bg: 'rgba(59,130,246,0.12)' },
    }

    const NOTIF_LABEL: Record<string, string> = { reminder: 'Recordatorio', followup: 'Remarketing', urgency: 'Último aviso' }

    return (
        <div style={{ minHeight: '100vh', padding: '32px', maxWidth: 1400, margin: '0 auto' }}>

            {/* ── HERO ── */}
            <div style={{
                background: '#13152a',
                border: '1px solid rgba(99,102,241,0.18)',
                borderRadius: 16, padding: '32px 36px', marginBottom: 28, position: 'relative', overflow: 'hidden',
                borderTop: '2px solid rgba(99,102,241,0.5)',
            }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <div style={{ padding: '5px 14px', borderRadius: 20, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', fontSize: 11, fontWeight: 700, color: '#10b981', letterSpacing: '0.05em' }}>
                            ● EN LÍNEA
                        </div>
                        {allDone && (
                            <div style={{ padding: '5px 14px', borderRadius: 20, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', fontSize: 11, fontWeight: 700, color: '#818cf8' }}>
                                ✅ Todo configurado
                            </div>
                        )}
                        {vencenHoy.length > 0 && (
                            <div style={{ padding: '5px 14px', borderRadius: 20, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 11, fontWeight: 700, color: '#f87171' }}>
                                ⚠️ {vencenHoy.length} suscripción{vencenHoy.length > 1 ? 'es vencen' : ' vence'} hoy
                            </div>
                        )}
                    </div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#eef0ff', marginBottom: 10, lineHeight: 1.2 }}>
                        Hola, <span style={{ color: '#818cf8' }}>{userName}</span>
                    </h1>
                    <p style={{ color: 'rgba(238,240,255,0.6)', fontSize: '1rem', maxWidth: 520, lineHeight: 1.6 }}>
                        {allDone
                            ? '¡Tu asistente está listo! Tus clientes están siendo atendidos automáticamente.'
                            : `Completa ${steps.length - completedSteps} paso${steps.length - completedSteps > 1 ? 's' : ''} más para tener tu bot completamente operativo.`}
                    </p>
                    {!allDone && (
                        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ flex: 1, maxWidth: 280, height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${progressPct}%`, background: '#6366f1', borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#818cf8' }}>{progressPct}% listo</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── KPI CARDS ROW ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginBottom: 28 }}>
                {[
                    { icon: '💬', label: 'Chats hoy', value: activeChatsToday ?? 0, sub: `de ${totalChats ?? 0} totales`, color: '#10b981', rgb: '16,185,129' },
                    { icon: '📋', label: 'Suscripciones activas', value: totalActivas, sub: `${vencidas.length} vencidas sin renovar`, color: '#8b5cf6', rgb: '139,92,246' },
                    { icon: '⚠️', label: 'Vencen esta semana', value: vencen7d.length, sub: `${vencenHoy.length} vencen hoy`, color: vencen7d.length > 0 ? '#f59e0b' : '#6b7280', rgb: vencen7d.length > 0 ? '245,158,11' : '107,114,128' },
                    { icon: '⚡', label: 'Disparadores activos', value: activeTriggers ?? 0, sub: 'en ejecución automática', color: '#06b6d4', rgb: '6,182,212' },
                    { icon: '📤', label: 'Notificaciones (7d)', value: notifsEnviadas, sub: `${notifsFallidas} fallidas`, color: '#6366f1', rgb: '99,102,241' },
                    { icon: '🤖', label: 'Asistente IA', value: hasAssistant ? '✓' : '—', sub: hasTraining ? 'Entrenado' : 'Sin entrenar', color: hasTraining ? '#10b981' : '#6b7280', rgb: hasTraining ? '16,185,129' : '107,114,128' },
                ].map((stat, i) => (
                    <div key={i} style={{
                        padding: '16px 18px', borderRadius: 12, background: '#13152a',
                        border: `1px solid rgba(255,255,255,0.06)`,
                        borderTop: `2px solid ${stat.color}`,
                        position: 'relative', overflow: 'hidden',
                    }}>
                        <div style={{ fontSize: 20, marginBottom: 8 }}>{stat.icon}</div>
                        <div style={{ fontSize: '1.7rem', fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(238,240,255,0.7)', marginTop: 5 }}>{stat.label}</div>
                        <div style={{ fontSize: '0.65rem', color: 'rgba(238,240,255,0.35)', marginTop: 3 }}>{stat.sub}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 28, alignItems: 'start' }}>

                {/* ── COLUMNA IZQUIERDA ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                    {/* Suscripciones por servicio */}
                    {totalActivas > 0 && (
                        <div>
                            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Users size={16} style={{ color: '#818cf8' }} />
                                <span style={{ color: '#eef0ff' }}>Suscripciones por servicio</span>
                                <Link href="/dashboard/subscriptions" style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#818cf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    Ver todas <ArrowRight size={12} />
                                </Link>
                            </h2>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                                {Object.entries(porServicio).map(([svc, data]) => {
                                    const c = SVC_COLOR[svc] || { color: '#94a3b8', rgb: '148,163,184', bg: 'rgba(148,163,184,0.1)' }
                                    return (
                                        <div key={svc} style={{ padding: '16px 18px', borderRadius: 12, background: '#13152a', border: '1px solid rgba(255,255,255,0.06)', borderTop: `2px solid ${c.color}`, position: 'relative', overflow: 'hidden' }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: c.color, letterSpacing: '0.08em', marginBottom: 8 }}>{svc}</div>
                                            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#eef0ff', lineHeight: 1 }}>{data.total}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'rgba(238,240,255,0.45)', marginTop: 4 }}>activas</div>
                                            {data.vencen7 > 0 && (
                                                <div style={{ marginTop: 10, padding: '4px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', fontSize: '0.65rem', fontWeight: 700, color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                    ⚠️ {data.vencen7} vencen pronto
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Vencimientos próximos */}
                    {vencen7d.length > 0 && (
                        <div>
                            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Calendar size={16} style={{ color: '#f59e0b' }} />
                                <span style={{ color: '#eef0ff' }}>Vencimientos próximos</span>
                                <span style={{ marginLeft: 8, fontSize: '0.7rem', padding: '2px 8px', borderRadius: 10, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', fontWeight: 700 }}>
                                    {vencen7d.length} esta semana
                                </span>
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {vencen7d.slice(0, 8).map((sub, i) => {
                                    const days = diffDays(sub.vencimiento)
                                    const c = SVC_COLOR[sub.servicio || 'CANVA'] || SVC_COLOR['CANVA']
                                    const urgent = days <= 1
                                    return (
                                        <div key={sub.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            padding: '10px 14px', borderRadius: 12, background: '#13152a',
                                            border: urgent ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.06)',
                                        }}>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: c.bg, color: c.color }}>
                                                {sub.servicio || 'CANVA'}
                                            </span>
                                            <span style={{ fontSize: '0.8rem', color: '#eef0ff', flex: 1, fontFamily: 'monospace' }}>
                                                {sub.correo || sub.numero}
                                            </span>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: urgent ? '#f87171' : '#f59e0b', whiteSpace: 'nowrap' }}>
                                                {days === 0 ? '¡Hoy!' : days === 1 ? 'Mañana' : `${days}d · ${formatDate(sub.vencimiento)}`}
                                            </span>
                                        </div>
                                    )
                                })}
                                {vencen7d.length > 8 && (
                                    <Link href="/dashboard/subscriptions" style={{ textAlign: 'center', padding: '8px', fontSize: '0.75rem', color: '#818cf8', textDecoration: 'none' }}>
                                        Ver {vencen7d.length - 8} más →
                                    </Link>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Pasos de configuración — siempre visible */}
                    <div>
                        <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Sparkles size={16} style={{ color: '#818cf8' }} />
                            <span style={{ color: '#eef0ff' }}>{allDone ? '¡Configuración completa! 🎉' : `Primeros pasos — ${completedSteps}/${steps.length}`}</span>
                        </h2>
                        {allDone ? (
                            <div style={{
                                padding: '20px 24px', borderRadius: 16, background: 'rgba(16,185,129,0.06)',
                                border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', gap: 16,
                            }}>
                                <div style={{ fontSize: 36 }}>🚀</div>
                                <div>
                                    <p style={{ fontWeight: 700, color: '#10b981', fontSize: '0.95rem' }}>¡Tu asistente está completamente operativo!</p>
                                    <p style={{ fontSize: '0.78rem', color: 'rgba(238,240,255,0.5)', marginTop: 4 }}>
                                        Tus clientes están siendo atendidos automáticamente. Revisa las métricas de arriba para monitorear tu desempeño.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {steps.map((step, i) => (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 14,
                                        border: step.done ? '1px solid rgba(16,185,129,0.12)' : `1px solid rgba(${step.rgb},0.18)`,
                                        background: step.done ? 'rgba(16,185,129,0.04)' : `rgba(${step.rgb},0.04)`,
                                        opacity: step.done ? 0.6 : 1,
                                        transition: 'opacity 0.2s',
                                    }}>
                                        <div style={{
                                            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                                            background: step.done ? 'rgba(16,185,129,0.15)' : `rgba(${step.rgb},0.12)`,
                                            border: `2px solid ${step.done ? 'rgba(16,185,129,0.35)' : `rgba(${step.rgb},0.25)`}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {step.done
                                                ? <CheckCircle2 size={15} style={{ color: '#10b981' }} />
                                                : <step.icon size={15} style={{ color: step.color }} />
                                            }
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontWeight: 600, fontSize: '0.85rem', color: '#eef0ff', textDecoration: step.done ? 'line-through' : 'none', textDecorationColor: 'rgba(16,185,129,0.4)' }}>
                                                {step.title}
                                            </p>
                                            <p style={{ fontSize: '0.72rem', color: 'rgba(238,240,255,0.45)', marginTop: 1 }}>{step.description}</p>
                                        </div>
                                        {step.done ? (
                                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981', whiteSpace: 'nowrap' }}>✓ Listo</span>
                                        ) : (
                                            <Link href={step.href} style={{
                                                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
                                                fontSize: '0.73rem', fontWeight: 700, color: step.color, padding: '5px 11px',
                                                borderRadius: 8, background: `rgba(${step.rgb},0.1)`, border: `1px solid rgba(${step.rgb},0.25)`,
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
                                <Activity size={16} style={{ color: '#10b981' }} />
                                <span style={{ color: '#eef0ff' }}>Actividad reciente</span>
                                <Link href="/dashboard/chats" style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#818cf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
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
                                            padding: '10px 12px', borderRadius: 12, background: '#13152a',
                                            border: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none',
                                        }}>
                                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>
                                                💬
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#eef0ff', marginBottom: 2 }}>
                                                    {chat.contact_name || chat.phone_number}
                                                </p>
                                                <p style={{ fontSize: '0.7rem', color: 'rgba(238,240,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {chat.last_message || '—'}
                                                </p>
                                            </div>
                                            <span style={{ fontSize: '0.65rem', color: 'rgba(238,240,255,0.3)', flexShrink: 0 }}>{time}</span>
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
                                <Bell size={16} style={{ color: '#6366f1' }} />
                                <span style={{ color: '#eef0ff' }}>Notificaciones enviadas (7d)</span>
                            </h2>
                            <div style={{ padding: '14px 16px', borderRadius: 16, background: '#13152a', border: '1px solid rgba(99,102,241,0.2)' }}>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                    {[
                                        { label: 'Enviadas', val: notifsEnviadas, color: '#10b981' },
                                        { label: 'Fallidas', val: notifsFallidas, color: '#ef4444' },
                                    ].map((s, i) => (
                                        <div key={i} style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: 10, background: `rgba(${s.color === '#10b981' ? '16,185,129' : '239,68,68'},0.08)` }}>
                                            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: s.color }}>{s.val}</div>
                                            <div style={{ fontSize: '0.65rem', color: 'rgba(238,240,255,0.4)', marginTop: 2 }}>{s.label}</div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    {recentNotifs!.slice(0, 5).map((n, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                                            <span style={{
                                                fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: 5,
                                                background: n.status === 'sent' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                                                color: n.status === 'sent' ? '#10b981' : '#f87171'
                                            }}>
                                                {n.status === 'sent' ? '✓' : '✗'}
                                            </span>
                                            <span style={{ fontSize: '0.72rem', color: 'rgba(238,240,255,0.55)', flex: 1 }}>
                                                {NOTIF_LABEL[n.message_type] || n.message_type}
                                            </span>
                                            <span style={{ fontSize: '0.65rem', color: 'rgba(238,240,255,0.3)', fontFamily: 'monospace' }}>
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
                            <TrendingUp size={16} style={{ color: '#818cf8' }} />
                            <span style={{ color: '#eef0ff' }}>Accesos rápidos</span>
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            {[
                                { emoji: '💬', label: 'Chats', href: '/dashboard/chats', color: '#10b981', rgb: '16,185,129' },
                                { emoji: '📋', label: 'Suscripciones', href: '/dashboard/subscriptions', color: '#8b5cf6', rgb: '139,92,246' },
                                { emoji: '⚡', label: 'Disparadores', href: hasAssistant ? `/dashboard/assistants/${assistants![0].id}/triggers` : '/dashboard/assistants', color: '#f59e0b', rgb: '245,158,11' },
                                { emoji: '📊', label: 'Plantillas Meta', href: hasAssistant ? `/dashboard/assistants/${assistants![0].id}/templates` : '/dashboard/assistants', color: '#06b6d4', rgb: '6,182,212' },
                            ].map((item, i) => (
                                <Link key={i} href={item.href} style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '11px 14px', borderRadius: 12, background: '#13152a',
                                    border: `1px solid rgba(${item.rgb},0.18)`, textDecoration: 'none',
                                    fontSize: '0.8rem', fontWeight: 600, color: '#eef0ff',
                                }}>
                                    <span style={{ fontSize: 18 }}>{item.emoji}</span>
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
