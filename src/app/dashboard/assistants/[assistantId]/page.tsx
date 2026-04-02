import { createClient } from '@/utils/supabase/server'
import { AssistantNotFound } from '@/components/dashboard/AssistantNotFound'
import { redirect } from 'next/navigation'
import { MessageSquare, Mic, Calendar, BarChart2 } from 'lucide-react'

export default async function AssistantDashboardPage({ params }: { params: Promise<{ assistantId: string }> }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { assistantId } = await params
    if (!user) redirect('/login')

    const { data: credentials } = await supabase
        .from('whatsapp_credentials')
        .select('*')
        .eq('id', assistantId)
        .single()

    if (!credentials) return <AssistantNotFound />

    const { count: totalChats } = await supabase
        .from('chats').select('*', { count: 'exact', head: true }).eq('user_id', user.id)

    const { count: totalAudios } = await supabase
        .from('messages')
        .select('chat_id, chats!inner(user_id)', { count: 'exact', head: true })
        .eq('chats.user_id', user.id).eq('type', 'audio').eq('sender', 'ai')

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    const { data: recentChats } = await supabase
        .from('chats').select('created_at').eq('user_id', user.id)
        .gte('created_at', sevenDaysAgo.toISOString())

    const days = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
    const chartData = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(sevenDaysAgo)
        d.setDate(d.getDate() + i)
        const dayKey = d.toISOString().split('T')[0]
        return { day: days[d.getDay()], count: recentChats?.filter(c => c.created_at.startsWith(dayKey)).length || 0, isToday: i === 6 }
    })

    const maxVal = Math.max(...chartData.map(d => d.count), 5)
    const LIMIT_CHATS = 500
    const LIMIT_AUDIOS = 100
    const isActive = credentials?.ai_status === 'active'

    const stats = [
        { label: 'Conversaciones', value: totalChats || 0, limit: LIMIT_CHATS, Icon: MessageSquare, color: '#10b981', rgb: '16,185,129', pct: Math.min(((totalChats || 0) / LIMIT_CHATS) * 100, 100) },
        { label: 'Audios IA', value: totalAudios || 0, limit: LIMIT_AUDIOS, Icon: Mic, color: '#25D366', rgb: '139,92,246', pct: Math.min(((totalAudios || 0) / LIMIT_AUDIOS) * 100, 100) },
        { label: 'Hoy', value: chartData[6].count, Icon: Calendar, color: '#f59e0b', rgb: '245,158,11', pct: null },
        { label: 'Esta semana', value: chartData.reduce((a, b) => a + b.count, 0), Icon: BarChart2, color: '#25D366', rgb: '99,102,241', pct: null },
    ]

    return (
        <div style={{ padding: '28px 32px', maxWidth: 1300, margin: '0 auto' }}>

            {/* ── HEADER ── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>
                        {credentials.bot_name || 'Mi Asistente'}
                    </h1>
                    <p style={{ color: 'rgba(15,23,42,0.50)', fontSize: '0.85rem' }}>
                        {credentials.phone_number_display || credentials.phone_number_id || 'Sin número configurado'}
                    </p>
                </div>

                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 18px', borderRadius: 50,
                    background: isActive ? 'rgba(16,185,129,0.08)' : 'rgba(15,23,42,0.04)',
                    border: isActive ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(0,0,0,0.10)',
                }}>
                    <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: isActive ? '#10b981' : '#64748b',
                        boxShadow: isActive ? '0 0 8px rgba(16,185,129,0.7)' : 'none',
                    }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: isActive ? '#10b981' : '#64748b' }}>
                        {isActive ? 'Asistente activo' : 'Asistente inactivo'}
                    </span>
                </div>
            </div>

            {/* ── STAT CARDS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
                {stats.map((stat, i) => (
                    <div key={i} style={{
                        background: '#ffffff',
                        border: '1px solid rgba(0,0,0,0.08)',
                        borderTop: `2px solid ${stat.color}`,
                        borderRadius: 12,
                        padding: '18px 20px',
                        position: 'relative',
                        overflow: 'hidden',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                    }}>
                        <stat.Icon size={16} style={{ color: stat.color, marginBottom: 10 }} />
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', lineHeight: 1, marginBottom: 4 }}>
                            {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'rgba(15,23,42,0.55)', fontWeight: 500, marginBottom: stat.pct !== null ? 10 : 0 }}>
                            {stat.label}
                            {stat.limit && <span style={{ color: 'rgba(15,23,42,0.35)' }}> / {stat.limit}</span>}
                        </div>
                        {stat.pct !== null && (
                            <div style={{ height: 3, background: 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${stat.pct}%`, background: stat.color, borderRadius: 2 }} />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* ── MAIN GRID ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>

                {/* CHART */}
                <div style={{
                    background: '#ffffff',
                    border: '1px solid rgba(0,0,0,0.08)',
                    borderRadius: 20,
                    padding: '24px 28px',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <div>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A' }}>Conversaciones — últimos 7 días</h3>
                            <p style={{ fontSize: '0.75rem', color: 'rgba(15,23,42,0.45)', marginTop: 2 }}>Nuevos chats iniciados por día</p>
                        </div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#25D366', background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.22)', padding: '4px 10px', borderRadius: 6 }}>
                            {chartData.reduce((a, b) => a + b.count, 0)} total
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 180, borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: 12 }}>
                        {chartData.map((d, i) => (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                                <span style={{ fontSize: '0.65rem', color: d.count > 0 ? (d.isToday ? '#25D366' : 'rgba(15,23,42,0.40)') : 'transparent' }}>{d.count}</span>
                                <div style={{
                                    width: '100%', maxWidth: 32, borderRadius: '4px 4px 0 0',
                                    height: `${Math.max((d.count / maxVal) * 140, d.count > 0 ? 4 : 2)}px`,
                                    background: d.isToday
                                        ? 'linear-gradient(180deg, #25D366, #25D366)'
                                        : 'rgba(37,211,102,0.2)',
                                    boxShadow: d.isToday ? '0 0 14px rgba(37,211,102,0.5)' : 'none',
                                    transition: 'all 0.3s ease',
                                }} />
                                <span style={{ fontSize: '0.68rem', color: d.isToday ? '#25D366' : 'rgba(15,23,42,0.35)', fontWeight: d.isToday ? 700 : 400, textTransform: 'capitalize' }}>{d.day}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* STATUS + QUICK INFO */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {/* Estado del bot */}
                    <div style={{
                        background: '#ffffff',
                        border: `1px solid ${isActive ? 'rgba(16,185,129,0.22)' : 'rgba(0,0,0,0.08)'}`,
                        borderRadius: 16, padding: '20px 22px',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                    }}>
                        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(15,23,42,0.40)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Estado del bot</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: 12,
                                background: isActive ? 'rgba(16,185,129,0.12)' : 'rgba(15,23,42,0.04)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: isActive ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(0,0,0,0.08)',
                                fontSize: 20,
                            }}>
                                {isActive ? '🟢' : '⚫'}
                            </div>
                            <div>
                                <p style={{ fontWeight: 700, color: isActive ? '#10b981' : '#64748b', fontSize: '0.95rem' }}>
                                    {isActive ? 'Activo' : 'Inactivo'}
                                </p>
                                <p style={{ fontSize: '0.73rem', color: 'rgba(15,23,42,0.45)', marginTop: 1 }}>
                                    {isActive ? 'Respondiendo mensajes' : 'No procesa mensajes'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Cuotas */}
                    <div style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 18, padding: '20px 22px', flex: 1, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(15,23,42,0.40)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Cuotas del plan</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {[
                                { label: 'Conversaciones', value: totalChats || 0, limit: LIMIT_CHATS, color: '#10b981', rgb: '16,185,129' },
                                { label: 'Audios IA', value: totalAudios || 0, limit: LIMIT_AUDIOS, color: '#25D366', rgb: '139,92,246' },
                            ].map((q, i) => (
                                <div key={i}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <span style={{ fontSize: '0.78rem', color: 'rgba(15,23,42,0.55)' }}>{q.label}</span>
                                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>
                                            {q.value} <span style={{ color: 'rgba(15,23,42,0.35)' }}>/ {q.limit}</span>
                                        </span>
                                    </div>
                                    <div style={{ height: 5, background: 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${Math.min((q.value / q.limit) * 100, 100)}%`, background: q.color, borderRadius: 3, boxShadow: `0 0 6px rgba(${q.rgb},0.5)` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Hoy */}
                    <div style={{
                        background: '#ffffff',
                        border: '1px solid rgba(37,211,102,0.2)',
                        borderTop: '2px solid #25D366',
                        borderRadius: 12, padding: '18px 20px',
                        display: 'flex', alignItems: 'center', gap: 14,
                        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                    }}>
                        <MessageSquare size={24} style={{ color: '#25D366', flexShrink: 0 }} />
                        <div>
                            <p style={{ fontSize: '2rem', fontWeight: 800, color: '#25D366', lineHeight: 1 }}>{chartData[6].count}</p>
                            <p style={{ fontSize: '0.75rem', color: 'rgba(15,23,42,0.50)', marginTop: 2 }}>Conversaciones hoy</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
