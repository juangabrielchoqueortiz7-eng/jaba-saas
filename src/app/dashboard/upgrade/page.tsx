import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Zap, CheckCircle2, ArrowLeft, Sparkles, TrendingUp, Star } from 'lucide-react'
import { PLANS, isOverLimit, isNearLimit } from '@/lib/plans'

export default async function UpgradePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const serviceKey = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey!)
    const { data: profile } = await admin
        .from('user_profiles')
        .select('plan_id, conversations_balance, conversations_total')
        .eq('id', user.id)
        .single()

    const balance = profile?.conversations_balance ?? 500
    const total = profile?.conversations_total ?? 500
    const currentPlanId = profile?.plan_id ?? 'free'
    const used = Math.max(0, total - balance)
    const pct = total > 0 ? Math.round((used / total) * 100) : 0
    const overLimit = isOverLimit(balance)
    const nearLimit = isNearLimit(balance, total)

    const GREEN = '#25D366'

    return (
        <div style={{ padding: '2rem 1.5rem', maxWidth: 900, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <Link href="/dashboard" style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                    color: 'rgba(15,23,42,0.45)', fontSize: '0.8rem', textDecoration: 'none',
                    marginBottom: '1.25rem',
                }}>
                    <ArrowLeft size={14} /> Volver al dashboard
                </Link>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0F172A', margin: '0 0 0.4rem', letterSpacing: '-0.03em' }}>
                            Planes de conversaciones
                        </h1>
                        <p style={{ color: 'rgba(15,23,42,0.45)', margin: 0, fontSize: '0.9rem' }}>
                            Recarga cuando quieras, sin compromisos mensuales.
                        </p>
                    </div>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                        background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.15)',
                        borderRadius: '9999px', padding: '0.35rem 0.9rem',
                    }}>
                        <Sparkles size={13} style={{ color: GREEN }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: GREEN }}>SIN SUSCRIPCIÓN</span>
                    </div>
                </div>
            </div>

            {/* Usage card */}
            <div style={{
                background: overLimit ? 'rgba(244,63,94,0.06)' : nearLimit ? 'rgba(251,191,36,0.06)' : '#ffffff',
                border: `1px solid ${overLimit ? 'rgba(244,63,94,0.2)' : nearLimit ? 'rgba(251,191,36,0.2)' : 'rgba(0,0,0,0.08)'}`,
                borderRadius: 16,
                padding: '1.5rem',
                marginBottom: '2rem',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                        <p style={{ margin: '0 0 0.2rem', fontSize: '0.75rem', fontWeight: 700, color: 'rgba(15,23,42,0.40)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Uso actual
                        </p>
                        <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: overLimit ? '#fb7185' : nearLimit ? '#fbbf24' : '#0F172A', letterSpacing: '-0.02em' }}>
                            {balance.toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'rgba(15,23,42,0.35)' }}>conversaciones restantes</span>
                        </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: '0 0 0.2rem', fontSize: '0.75rem', color: 'rgba(15,23,42,0.35)' }}>Usadas</p>
                        <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'rgba(15,23,42,0.65)' }}>
                            {used.toLocaleString()} / {total.toLocaleString()}
                        </p>
                    </div>
                </div>
                {/* Progress bar */}
                <div style={{ height: 8, background: 'rgba(0,0,0,0.06)', borderRadius: 9999, overflow: 'hidden' }}>
                    <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: overLimit ? '#fb7185' : nearLimit ? '#fbbf24' : GREEN,
                        borderRadius: 9999,
                        transition: 'width 0.3s ease',
                    }} />
                </div>
                {overLimit && (
                    <p style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', color: '#fb7185', fontWeight: 600 }}>
                        ⚠️ Sin conversaciones — el bot no está respondiendo. Recarga para reactivarlo.
                    </p>
                )}
                {nearLimit && !overLimit && (
                    <p style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', color: '#fbbf24', fontWeight: 600 }}>
                        ⚡ Te quedan pocas conversaciones. Recarga pronto para no interrumpir el servicio.
                    </p>
                )}
            </div>

            {/* Plans grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '1rem',
                marginBottom: '2rem',
            }}>
                {PLANS.map(plan => {
                    const isCurrent = plan.id === currentPlanId
                    const isHighlight = plan.highlight
                    const pricePerConv = plan.price_usd === 0
                        ? ((plan.recharge_price ?? 9.99) / plan.conversations * 100).toFixed(2)
                        : (plan.price_usd / plan.conversations * 100).toFixed(2)

                    return (
                        <div key={plan.id} style={{
                            background: isHighlight ? 'rgba(37,211,102,0.05)' : '#ffffff',
                            border: `1px solid ${isHighlight ? 'rgba(37,211,102,0.25)' : isCurrent ? 'rgba(37,211,102,0.15)' : 'rgba(0,0,0,0.08)'}`,
                            borderRadius: 16,
                            padding: '1.5rem',
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem',
                        }}>
                            {/* Badges */}
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {isHighlight && (
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                        background: GREEN, color: '#000', fontSize: '0.65rem', fontWeight: 800,
                                        padding: '0.2rem 0.6rem', borderRadius: '9999px', letterSpacing: '0.05em',
                                    }}>
                                        <Star size={10} fill="#000" /> MÁS POPULAR
                                    </span>
                                )}
                                {isCurrent && (
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                        background: 'rgba(37,211,102,0.12)', color: GREEN, fontSize: '0.65rem', fontWeight: 800,
                                        padding: '0.2rem 0.6rem', borderRadius: '9999px', letterSpacing: '0.05em',
                                        border: '1px solid rgba(37,211,102,0.2)',
                                    }}>
                                        <CheckCircle2 size={10} /> PLAN ACTUAL
                                    </span>
                                )}
                            </div>

                            {/* Conversations count */}
                            <div>
                                <p style={{ margin: '0 0 0.2rem', fontSize: '1.75rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.03em' }}>
                                    {plan.conversations.toLocaleString()}
                                </p>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(15,23,42,0.45)', fontWeight: 600 }}>
                                    conversaciones
                                </p>
                            </div>

                            {/* Price */}
                            <div>
                                {plan.price_usd === 0 ? (
                                    <>
                                        <p style={{ margin: '0 0 0.15rem', fontSize: '1.5rem', fontWeight: 900, color: GREEN, letterSpacing: '-0.02em' }}>
                                            GRATIS
                                        </p>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(15,23,42,0.40)' }}>
                                            Recarga: ${plan.recharge_price} USD / 500
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p style={{ margin: '0 0 0.15rem', fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
                                            ${plan.price_usd.toFixed(2)} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'rgba(15,23,42,0.40)' }}>USD</span>
                                        </p>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(15,23,42,0.40)' }}>
                                            ${pricePerConv} centavos / conv.
                                        </p>
                                    </>
                                )}
                            </div>

                            {/* Savings */}
                            {plan.savings_usd && plan.savings_usd > 0 && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                                    background: 'rgba(37,211,102,0.07)', border: '1px solid rgba(37,211,102,0.12)',
                                    borderRadius: '0.625rem', padding: '0.4rem 0.75rem',
                                }}>
                                    <TrendingUp size={13} style={{ color: GREEN, flexShrink: 0 }} />
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: GREEN, fontWeight: 700 }}>
                                        Ahorras ${plan.savings_usd.toFixed(2)} USD
                                    </p>
                                </div>
                            )}

                            {/* CTA */}
                            <button
                                disabled
                                style={{
                                    marginTop: 'auto',
                                    width: '100%',
                                    background: isHighlight ? GREEN : 'rgba(0,0,0,0.04)',
                                    color: isHighlight ? '#000' : 'rgba(15,23,42,0.45)',
                                    border: `1px solid ${isHighlight ? 'transparent' : 'rgba(0,0,0,0.08)'}`,
                                    borderRadius: '9999px',
                                    padding: '0.7rem 1rem',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    cursor: 'not-allowed',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.4rem',
                                }}
                            >
                                <Zap size={14} />
                                {plan.price_usd === 0 ? 'Recargar 500 conv.' : `Comprar ${plan.conversations.toLocaleString()} conv.`}
                                <span style={{ fontSize: '0.65rem', opacity: 0.6, marginLeft: 2 }}>(próximamente)</span>
                            </button>
                        </div>
                    )
                })}
            </div>

            {/* Note */}
            <div style={{
                background: 'rgba(37,211,102,0.04)',
                border: '1px solid rgba(37,211,102,0.12)',
                borderRadius: '1rem',
                padding: '1.25rem 1.5rem',
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'flex-start',
            }}>
                <CheckCircle2 size={18} style={{ color: GREEN, flexShrink: 0, marginTop: 1 }} />
                <div>
                    <p style={{ margin: '0 0 0.3rem', fontSize: '0.875rem', fontWeight: 700, color: '#0F172A' }}>
                        ¿Cómo funcionan las conversaciones?
                    </p>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(15,23,42,0.45)', lineHeight: 1.6 }}>
                        Cada mensaje que tu bot procesa y responde consume 1 conversación de tu saldo. Las conversaciones no expiran — se acumulan hasta usarlas. Cuando el saldo llega a 0, el bot deja de responder hasta que recargues.
                    </p>
                </div>
            </div>
        </div>
    )
}
