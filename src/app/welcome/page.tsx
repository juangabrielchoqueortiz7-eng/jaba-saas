import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Bot, Zap, MessageSquare, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react'

export default async function WelcomePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    // Fetch profile to show business name
    const serviceKey = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey!)
    const { data: profile } = await admin
        .from('user_profiles')
        .select('full_name, business_name')
        .eq('id', user.id)
        .single()

    const firstName = profile?.full_name?.split(' ')[0] || 'bienvenido'
    const businessName = profile?.business_name || 'tu negocio'

    const steps = [
        {
            num: '01',
            title: 'Conecta tu WhatsApp Business',
            desc: 'Vincula el número de WhatsApp de tu negocio para empezar a recibir y responder mensajes.',
            href: '/dashboard/settings',
            cta: 'Ir a configuración',
        },
        {
            num: '02',
            title: 'Configura tu asistente IA',
            desc: 'Entrena a JABA con la información de tu negocio para que responda como tú.',
            href: '/dashboard',
            cta: 'Configurar IA',
        },
        {
            num: '03',
            title: 'Agrega tus primeros clientes',
            desc: 'Importa tus contactos o agrega suscriptores manualmente.',
            href: '/dashboard/subscriptions',
            cta: 'Ver suscriptores',
        },
    ]

    return (
        <div style={{
            minHeight: '100vh',
            background: '#000',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem 1.5rem',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Ambient glow */}
            <div style={{
                position: 'fixed',
                top: '-10%',
                right: '-5%',
                width: 600,
                height: 600,
                background: 'radial-gradient(ellipse, rgba(37,211,102,0.07) 0%, transparent 65%)',
                pointerEvents: 'none',
            }} />

            <div style={{ width: '100%', maxWidth: 560, position: 'relative', zIndex: 10 }}>
                {/* Logo */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2.5rem' }}>
                    <div style={{
                        width: 64,
                        height: 64,
                        background: '#25D366',
                        borderRadius: '1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 40px rgba(37,211,102,0.35)',
                    }}>
                        <Bot style={{ color: '#000', width: 34, height: 34 }} />
                    </div>
                </div>

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        background: 'rgba(37,211,102,0.08)',
                        border: '1px solid rgba(37,211,102,0.15)',
                        borderRadius: '9999px',
                        padding: '0.35rem 0.9rem',
                        marginBottom: '1.25rem',
                    }}>
                        <Sparkles size={13} style={{ color: '#25D366' }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#25D366', letterSpacing: '0.05em' }}>
                            CUENTA ACTIVADA
                        </span>
                    </div>

                    <h1 style={{
                        fontSize: 'clamp(1.75rem, 5vw, 2.5rem)',
                        fontWeight: 900,
                        color: '#fff',
                        letterSpacing: '-0.03em',
                        margin: '0 0 0.75rem',
                        lineHeight: 1.1,
                    }}>
                        ¡Hola, {firstName}! 👋
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '1rem', margin: 0, lineHeight: 1.6 }}>
                        {businessName} está a punto de tener su propio<br />
                        <strong style={{ color: 'rgba(255,255,255,0.75)' }}>asistente de ventas por WhatsApp.</strong>
                    </p>
                </div>

                {/* Steps */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
                    {steps.map((step, i) => (
                        <div key={i} style={{
                            background: '#111',
                            border: '1px solid rgba(255,255,255,0.07)',
                            borderRadius: '1.25rem',
                            padding: '1.25rem 1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1.25rem',
                        }}>
                            <div style={{
                                width: 44,
                                height: 44,
                                borderRadius: '0.875rem',
                                background: i === 0 ? '#25D366' : 'rgba(255,255,255,0.04)',
                                border: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.08)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                <span style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 800,
                                    color: i === 0 ? '#000' : 'rgba(255,255,255,0.3)',
                                    letterSpacing: '0.05em',
                                }}>
                                    {step.num}
                                </span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{
                                    fontSize: '0.9rem',
                                    fontWeight: 700,
                                    color: '#fff',
                                    margin: '0 0 0.2rem',
                                }}>
                                    {step.title}
                                </p>
                                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.5 }}>
                                    {step.desc}
                                </p>
                            </div>
                            {i === 0 && (
                                <CheckCircle2 size={18} style={{ color: '#25D366', flexShrink: 0 }} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Primary CTA */}
                <Link
                    href="/dashboard/settings"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        width: '100%',
                        background: '#25D366',
                        color: '#000',
                        borderRadius: '9999px',
                        padding: '1rem 2rem',
                        fontWeight: 800,
                        fontSize: '1rem',
                        textDecoration: 'none',
                        boxShadow: '0 4px 24px rgba(37,211,102,0.3)',
                        marginBottom: '1rem',
                    }}
                >
                    <Zap size={18} />
                    Conectar mi WhatsApp ahora
                    <ArrowRight size={18} />
                </Link>

                {/* Secondary CTA */}
                <Link
                    href="/dashboard"
                    style={{
                        display: 'block',
                        textAlign: 'center',
                        color: 'rgba(255,255,255,0.35)',
                        fontSize: '0.85rem',
                        textDecoration: 'none',
                        padding: '0.5rem',
                    }}
                >
                    Explorar el dashboard primero →
                </Link>

                {/* Stats strip */}
                <div style={{
                    marginTop: '2.5rem',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.75rem',
                }}>
                    {[
                        { icon: <MessageSquare size={16} />, label: 'Chats en tiempo real' },
                        { icon: <Zap size={16} />, label: 'IA con Gemini' },
                        { icon: <CheckCircle2 size={16} />, label: 'Flujos automatizados' },
                    ].map((item, i) => (
                        <div key={i} style={{
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            borderRadius: '0.875rem',
                            padding: '0.875rem',
                            textAlign: 'center',
                        }}>
                            <div style={{ color: '#25D366', display: 'flex', justifyContent: 'center', marginBottom: '0.4rem' }}>
                                {item.icon}
                            </div>
                            <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', margin: 0, lineHeight: 1.4, fontWeight: 600 }}>
                                {item.label}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
