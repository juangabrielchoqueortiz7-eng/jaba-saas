import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Trophy, Star, MessageSquare, Mic, Users } from 'lucide-react'

export default async function AchievementsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return redirect('/login')

    const [{ count: totalChats }, { count: totalMessages }] = await Promise.all([
        supabase.from('chats').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('messages').select('id', { count: 'exact', head: true })
            .in('chat_id', (await supabase.from('chats').select('id').eq('user_id', user.id)).data?.map(c => c.id) || []),
    ])

    const { count: totalAudios } = await supabase.from('messages')
        .select('id', { count: 'exact', head: true }).eq('type', 'audio').eq('is_from_me', true)
        .in('chat_id', (await supabase.from('chats').select('id').eq('user_id', user.id)).data?.map(c => c.id) || [])

    const ACHIEVEMENTS = [
        {
            id: 'conversations', title: 'Maestro de la Charla', emoji: '💬',
            icon: MessageSquare, description: 'Mantén flujo constante de conversación con tus clientes.',
            milestone: '1,000 mensajes', reward: '100 Créditos',
            current: totalMessages || 0, target: 1000,
            gradient: 'linear-gradient(135deg, #25D366, #1da851)',
            glow: 'rgba(37,211,102,0.2)', border: 'rgba(37,211,102,0.2)',
            bg: 'rgba(37,211,102,0.06)', iconColor: '#25D366',
        },
        {
            id: 'audios', title: 'Voz del Futuro', emoji: '🎤',
            icon: Mic, description: 'Usa audios generados por IA para respuestas más humanas.',
            milestone: '30 audios enviados', reward: '3 min gratis',
            current: totalAudios || 0, target: 30,
            gradient: 'linear-gradient(135deg, #F97316, #ea6a0a)',
            glow: 'rgba(249,115,22,0.2)', border: 'rgba(249,115,22,0.2)',
            bg: 'rgba(249,115,22,0.06)', iconColor: '#F97316',
        },
        {
            id: 'chats', title: 'Comunidad Activa', emoji: '👥',
            icon: Users, description: 'Crece tu base de clientes con conversaciones activas.',
            milestone: '100 contactos', reward: '100 Créditos',
            current: totalChats || 0, target: 100,
            gradient: 'linear-gradient(135deg, #FBBF24, #f59e0b)',
            glow: 'rgba(251,191,36,0.2)', border: 'rgba(251,191,36,0.2)',
            bg: 'rgba(251,191,36,0.06)', iconColor: '#FBBF24',
        },
    ]

    const totalCompleted = ACHIEVEMENTS.filter(a => a.current >= a.target).length

    return (
        <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto' }}>

            {/* Header */}
            <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trophy size={22} style={{ color: '#FBBF24' }} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: '#eef0ff', margin: 0 }}>Logros y Recompensas</h1>
                        <p style={{ fontSize: '0.82rem', color: 'rgba(238,240,255,0.45)', margin: 0 }}>
                            {totalCompleted} de {ACHIEVEMENTS.length} logros completados
                        </p>
                    </div>
                </div>
            </div>

            {/* Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                {ACHIEVEMENTS.map((a) => {
                    const progress = Math.min(100, (a.current / a.target) * 100)
                    const completed = progress >= 100
                    return (
                        <div key={a.id} style={{
                            background: '#13152a',
                            border: `1px solid ${completed ? a.border : 'rgba(255,255,255,0.06)'}`,
                            borderRadius: 22,
                            padding: '28px 24px',
                            position: 'relative', overflow: 'hidden',
                            transition: 'all 0.3s ease',
                        }}>
                            {/* Glow de fondo */}
                            <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: `radial-gradient(circle, ${a.glow} 0%, transparent 70%)`, opacity: completed ? 1 : 0.4, pointerEvents: 'none' }} />

                            {/* Badge completado */}
                            {completed && (
                                <div style={{ position: 'absolute', top: 16, right: 16, background: '#FBBF24', color: '#000', fontSize: '0.68rem', fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>
                                    ✓ Completado
                                </div>
                            )}

                            <div style={{ position: 'relative', zIndex: 1 }}>
                                {/* Icono + reward */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                                    <div style={{ width: 52, height: 52, borderRadius: 14, background: a.bg, border: `1px solid ${a.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <a.icon size={26} style={{ color: a.iconColor }} />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', padding: '5px 10px', borderRadius: 8 }}>
                                        <Star size={11} style={{ color: '#FBBF24' }} />
                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#FBBF24' }}>{a.reward}</span>
                                    </div>
                                </div>

                                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#eef0ff', marginBottom: 6 }}>{a.title}</h2>
                                <p style={{ fontSize: '0.8rem', color: 'rgba(148,163,184,0.6)', lineHeight: 1.5, marginBottom: 22 }}>{a.description}</p>

                                {/* Progress */}
                                <div style={{ marginBottom: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: a.iconColor }}>{progress.toFixed(0)}%</span>
                                        <span style={{ fontSize: '0.75rem', color: 'rgba(148,163,184,0.4)', fontFamily: 'monospace' }}>
                                            {a.current.toLocaleString()} / {a.target.toLocaleString()}
                                        </span>
                                    </div>
                                    <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${progress}%`, background: a.gradient, borderRadius: 3, boxShadow: `0 0 8px ${a.glow}`, transition: 'width 1s ease' }} />
                                    </div>
                                </div>
                                <p style={{ fontSize: '0.72rem', color: 'rgba(148,163,184,0.35)', fontFamily: 'monospace', textAlign: 'center', marginTop: 10 }}>
                                    Meta: {a.milestone}
                                </p>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
