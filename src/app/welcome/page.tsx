import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowRight,
    Bot,
    CheckCircle2,
    MessageSquare,
    Sparkles,
    Zap,
} from 'lucide-react'
import {
    BUSINESS_TYPE_OPTIONS,
    getModulesForBusinessType,
    isBusinessType,
} from '@/lib/business-config'
import { getDefaultGoalsForBusinessType } from '@/lib/business-goals'
import { seedStarterTemplatesForBusinessType } from '@/lib/business-starter-seed'

async function completeBusinessOnboarding(formData: FormData) {
    'use server'

    const businessType = formData.get('business_type')
    if (!isBusinessType(businessType)) {
        redirect('/welcome?message=Selecciona un tipo de negocio')
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const serviceKey = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey!)
    const defaultGoals = getDefaultGoalsForBusinessType(businessType)
    const { error } = await admin
        .from('user_profiles')
        .update({
            business_type: businessType,
            enabled_modules: getModulesForBusinessType(businessType),
            onboarding_completed: true,
            business_profile: {
                goals: defaultGoals,
                configured_at: new Date().toISOString(),
                source: 'welcome_onboarding',
            },
        })
        .eq('id', user.id)

    if (error) {
        redirect('/welcome?message=No se pudo guardar la configuracion')
    }

    try {
        await seedStarterTemplatesForBusinessType(admin, user.id, businessType, defaultGoals)
    } catch (seedError) {
        console.error('[Welcome] Error seeding starter templates:', seedError)
        redirect('/welcome?message=Se guardo el rubro, pero no se pudieron crear las plantillas')
    }

    redirect('/dashboard/settings')
}

function PageShell({ children }: { children: React.ReactNode }) {
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
            <div style={{
                position: 'fixed',
                top: '-10%',
                right: '-5%',
                width: 600,
                height: 600,
                background: 'radial-gradient(ellipse, rgba(37,211,102,0.07) 0%, transparent 65%)',
                pointerEvents: 'none',
            }} />
            {children}
        </div>
    )
}

function LogoMark() {
    return (
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
    )
}

function StatusPill({ label }: { label: string }) {
    return (
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
                {label}
            </span>
        </div>
    )
}

function BusinessTypeSelector({ firstName, businessName, message }: { firstName: string; businessName: string; message?: string }) {
    return (
        <PageShell>
            <div style={{ width: '100%', maxWidth: 920, position: 'relative', zIndex: 10 }}>
                <LogoMark />

                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <StatusPill label="CONFIGURACION INICIAL" />
                    <h1 style={{
                        fontSize: 'clamp(1.75rem, 5vw, 2.5rem)',
                        fontWeight: 900,
                        color: '#fff',
                        letterSpacing: '-0.03em',
                        margin: '0 0 0.75rem',
                        lineHeight: 1.1,
                    }}>
                        Hola, {firstName}. Que tipo de negocio es {businessName}?
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.48)', fontSize: '1rem', margin: 0, lineHeight: 1.6 }}>
                        Elegiremos los modulos y primeras automatizaciones segun tu rubro.
                    </p>
                </div>

                <form action={completeBusinessOnboarding}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                        gap: '0.85rem',
                        marginBottom: '1.25rem',
                    }}>
                        {BUSINESS_TYPE_OPTIONS.map((option, index) => (
                            <label
                                key={option.id}
                                style={{
                                    display: 'block',
                                    background: '#111',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '0.5rem',
                                    padding: '1rem',
                                    cursor: 'pointer',
                                }}
                            >
                                <input
                                    type="radio"
                                    name="business_type"
                                    value={option.id}
                                    defaultChecked={index === 0}
                                    style={{ accentColor: '#25D366', marginRight: 8 }}
                                />
                                <span style={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem' }}>
                                    {option.title}
                                </span>
                                <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: '0.78rem', lineHeight: 1.5, margin: '0.55rem 0 0' }}>
                                    {option.description}
                                </p>
                            </label>
                        ))}
                    </div>

                    {message && (
                        <p style={{ color: '#fb7185', textAlign: 'center', fontSize: '0.85rem', margin: '0 0 1rem' }}>
                            {message}
                        </p>
                    )}

                    <button
                        type="submit"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            width: '100%',
                            background: '#25D366',
                            color: '#000',
                            border: 0,
                            borderRadius: '9999px',
                            padding: '1rem 2rem',
                            fontWeight: 900,
                            fontSize: '1rem',
                            cursor: 'pointer',
                            boxShadow: '0 4px 24px rgba(37,211,102,0.3)',
                        }}
                    >
                        Configurar mi dashboard
                        <ArrowRight size={18} />
                    </button>
                </form>
            </div>
        </PageShell>
    )
}

function CompletedWelcome({ firstName, businessName }: { firstName: string; businessName: string }) {
    const steps = [
        {
            num: '01',
            title: 'Conecta tu WhatsApp Business',
            desc: 'Vincula el numero de WhatsApp de tu negocio para empezar a recibir y responder mensajes.',
        },
        {
            num: '02',
            title: 'Configura tu asistente IA',
            desc: 'Entrena a JABA con la informacion de tu negocio para que responda como tu equipo.',
        },
        {
            num: '03',
            title: 'Activa tus automatizaciones',
            desc: 'Usa plantillas, flujos y disparadores para atender segun tu tipo de negocio.',
        },
    ]

    return (
        <PageShell>
            <div style={{ width: '100%', maxWidth: 560, position: 'relative', zIndex: 10 }}>
                <LogoMark />

                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <StatusPill label="CUENTA ACTIVADA" />
                    <h1 style={{
                        fontSize: 'clamp(1.75rem, 5vw, 2.5rem)',
                        fontWeight: 900,
                        color: '#fff',
                        letterSpacing: '-0.03em',
                        margin: '0 0 0.75rem',
                        lineHeight: 1.1,
                    }}>
                        Hola, {firstName}
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '1rem', margin: 0, lineHeight: 1.6 }}>
                        {businessName} esta listo para configurar su asistente por WhatsApp.
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
                    {steps.map((step, index) => (
                        <div key={step.num} style={{
                            background: '#111',
                            border: '1px solid rgba(255,255,255,0.07)',
                            borderRadius: '0.5rem',
                            padding: '1.25rem 1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1.25rem',
                        }}>
                            <div style={{
                                width: 44,
                                height: 44,
                                borderRadius: '0.5rem',
                                background: index === 0 ? '#25D366' : 'rgba(255,255,255,0.04)',
                                border: index === 0 ? 'none' : '1px solid rgba(255,255,255,0.08)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                <span style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 800,
                                    color: index === 0 ? '#000' : 'rgba(255,255,255,0.3)',
                                    letterSpacing: '0.05em',
                                }}>
                                    {step.num}
                                </span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', margin: '0 0 0.2rem' }}>
                                    {step.title}
                                </p>
                                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.5 }}>
                                    {step.desc}
                                </p>
                            </div>
                            {index === 0 && (
                                <CheckCircle2 size={18} style={{ color: '#25D366', flexShrink: 0 }} />
                            )}
                        </div>
                    ))}
                </div>

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
                    Explorar el dashboard primero
                </Link>

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
                    ].map(item => (
                        <div key={item.label} style={{
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            borderRadius: '0.5rem',
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
        </PageShell>
    )
}

export default async function WelcomePage({
    searchParams,
}: {
    searchParams?: { message?: string }
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const serviceKey = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey!)
    const { data: profile } = await admin
        .from('user_profiles')
        .select('full_name, business_name, business_type, onboarding_completed')
        .eq('id', user.id)
        .maybeSingle()

    const firstName = profile?.full_name?.split(' ')[0] || 'bienvenido'
    const businessName = profile?.business_name || 'tu negocio'
    const isComplete = Boolean(profile?.business_type && profile?.onboarding_completed)

    if (!isComplete) {
        return (
            <BusinessTypeSelector
                firstName={firstName}
                businessName={businessName}
                message={searchParams?.message}
            />
        )
    }

    return <CompletedWelcome firstName={firstName} businessName={businessName} />
}
