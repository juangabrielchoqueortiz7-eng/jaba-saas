import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Bot, Lock, Mail, ArrowRight, User, Building2, Phone } from 'lucide-react'
import { DEFAULT_NEW_BUSINESS_MODULES } from '@/lib/business-config'

export default async function Register({
    searchParams,
}: {
    searchParams: { message?: string }
}) {
    // Redirect already-authenticated users
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) redirect('/dashboard')

    const signUp = async (formData: FormData) => {
        'use server'
        const origin = (await headers()).get('origin')
        const fullName = (formData.get('full_name') as string)?.trim()
        const businessName = (formData.get('business_name') as string)?.trim()
        const phone = (formData.get('phone') as string)?.trim()
        const email = (formData.get('email') as string)?.trim()
        const password = formData.get('password') as string

        if (!fullName || !businessName || !phone || !email || !password) {
            return redirect('/register?message=Todos los campos son obligatorios')
        }
        if (password.length < 8) {
            return redirect('/register?message=La contraseña debe tener al menos 8 caracteres')
        }

        const supabase = await createClient()
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${origin}/auth/callback?next=/welcome`,
                data: { full_name: fullName },
            },
        })

        if (error) {
            if (error.message.toLowerCase().includes('already registered')) {
                return redirect('/register?message=Este correo ya está registrado. Intenta iniciar sesión.')
            }
            return redirect('/register?message=Error al crear la cuenta. Intenta nuevamente.')
        }

        // Save extended profile via service role (bypasses RLS)
        if (data.user?.id) {
            const serviceKey = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
            const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey!)
            await admin.from('user_profiles').upsert({
                id: data.user.id,
                full_name: fullName,
                business_name: businessName,
                phone,
                business_type: null,
                enabled_modules: DEFAULT_NEW_BUSINESS_MODULES,
                onboarding_completed: false,
                business_profile: {},
            })
        }

        return redirect('/login?message=¡Cuenta creada! Revisa tu correo para confirmar y comenzar.')
    }

    const inputStyle = {
        width: '100%',
        paddingLeft: '2.75rem',
        paddingRight: '1rem',
        paddingTop: '0.75rem',
        paddingBottom: '0.75rem',
        background: '#F7F8FA',
        border: '1px solid rgba(0,0,0,0.10)',
        borderRadius: '0.75rem',
        color: '#0F172A',
        fontSize: '0.9rem',
        outline: 'none',
        boxSizing: 'border-box' as const,
    }

    const labelStyle = {
        display: 'block',
        fontSize: '0.7rem',
        fontWeight: 700,
        color: 'rgba(15,23,42,0.45)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.1em',
        marginBottom: '0.4rem',
        marginLeft: '0.25rem',
    }

    const iconWrapStyle = {
        position: 'absolute' as const,
        left: '0.875rem',
        top: '50%',
        transform: 'translateY(-50%)',
        color: 'rgba(15,23,42,0.30)',
        display: 'flex',
        alignItems: 'center',
        pointerEvents: 'none' as const,
    }

    return (
        <div style={{
            display: 'flex',
            minHeight: '100vh',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#F7F8FA',
            position: 'relative',
            overflow: 'hidden',
            padding: '2rem 1.5rem',
        }}>
            {/* Ambient verde */}
            <div style={{
                position: 'fixed',
                top: '-10%',
                right: '-5%',
                width: 500,
                height: 500,
                background: 'radial-gradient(ellipse, rgba(37,211,102,0.10) 0%, transparent 70%)',
                pointerEvents: 'none',
                zIndex: 0,
            }} />
            <div style={{
                position: 'fixed',
                bottom: '-10%',
                left: '-5%',
                width: 400,
                height: 400,
                background: 'radial-gradient(ellipse, rgba(18,140,126,0.06) 0%, transparent 70%)',
                pointerEvents: 'none',
                zIndex: 0,
            }} />

            {/* Card */}
            <div style={{
                width: '100%',
                maxWidth: 440,
                padding: '2.5rem 2rem',
                background: '#fff',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: '1.5rem',
                position: 'relative',
                zIndex: 10,
                boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
            }}>
                {/* Branding */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: 56,
                        height: 56,
                        background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                        borderRadius: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '1rem',
                        boxShadow: '0 4px 20px rgba(37,211,102,0.30)',
                    }}>
                        <Bot style={{ color: '#fff', width: 30, height: 30 }} />
                    </div>
                    <h2 style={{
                        fontSize: '1.375rem',
                        fontWeight: 800,
                        color: '#0F172A',
                        letterSpacing: '-0.02em',
                        margin: 0,
                    }}>
                        Crear cuenta en JABA
                    </h2>
                    <p style={{ color: 'rgba(15,23,42,0.45)', fontSize: '0.85rem', marginTop: '0.4rem', marginBottom: 0 }}>
                        Tu asistente de ventas por WhatsApp
                    </p>
                </div>

                <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Nombre completo */}
                    <div>
                        <label style={labelStyle}>Nombre completo</label>
                        <div style={{ position: 'relative' }}>
                            <div style={iconWrapStyle}><User size={17} /></div>
                            <input
                                name="full_name"
                                type="text"
                                placeholder="Juan García"
                                required
                                autoComplete="name"
                                className="reg-input"
                                style={inputStyle}
                            />
                        </div>
                    </div>

                    {/* Nombre del negocio */}
                    <div>
                        <label style={labelStyle}>Nombre del negocio</label>
                        <div style={{ position: 'relative' }}>
                            <div style={iconWrapStyle}><Building2 size={17} /></div>
                            <input
                                name="business_name"
                                type="text"
                                placeholder="Mi Tienda Online"
                                required
                                autoComplete="organization"
                                className="reg-input"
                                style={inputStyle}
                            />
                        </div>
                    </div>

                    {/* Teléfono personal */}
                    <div>
                        <label style={labelStyle}>Teléfono personal (WhatsApp)</label>
                        <div style={{ position: 'relative' }}>
                            <div style={iconWrapStyle}><Phone size={17} /></div>
                            <input
                                name="phone"
                                type="tel"
                                placeholder="591XXXXXXXXX"
                                required
                                autoComplete="tel"
                                className="reg-input"
                                style={inputStyle}
                            />
                        </div>
                        <p style={{ fontSize: '0.72rem', color: 'rgba(15,23,42,0.30)', marginTop: '0.35rem', marginLeft: '0.25rem' }}>
                            Incluye el código de país. Ej: 591XXXXXXXX
                        </p>
                    </div>

                    {/* Email */}
                    <div>
                        <label style={labelStyle}>Correo electrónico</label>
                        <div style={{ position: 'relative' }}>
                            <div style={iconWrapStyle}><Mail size={17} /></div>
                            <input
                                name="email"
                                type="email"
                                placeholder="usuario@empresa.com"
                                required
                                autoComplete="email"
                                className="reg-input"
                                style={inputStyle}
                            />
                        </div>
                    </div>

                    {/* Contraseña */}
                    <div>
                        <label style={labelStyle}>Contraseña</label>
                        <div style={{ position: 'relative' }}>
                            <div style={iconWrapStyle}><Lock size={17} /></div>
                            <input
                                name="password"
                                type="password"
                                placeholder="Mínimo 8 caracteres"
                                required
                                minLength={8}
                                autoComplete="new-password"
                                className="reg-input"
                                style={inputStyle}
                            />
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        formAction={signUp}
                        style={{
                            width: '100%',
                            background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '9999px',
                            padding: '0.875rem 1.5rem',
                            fontWeight: 800,
                            fontSize: '0.95rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            marginTop: '0.5rem',
                            boxShadow: '0 4px 16px rgba(37,211,102,0.30)',
                        }}
                    >
                        Crear mi cuenta
                        <ArrowRight size={17} />
                    </button>

                    {/* Error / success message */}
                    {searchParams?.message && (
                        <div style={{
                            padding: '0.75rem 1rem',
                            background: searchParams.message.includes('creada')
                                ? 'rgba(37,211,102,0.08)'
                                : 'rgba(220,38,38,0.07)',
                            border: `1px solid ${searchParams.message.includes('creada') ? 'rgba(37,211,102,0.25)' : 'rgba(220,38,38,0.20)'}`,
                            color: searchParams.message.includes('creada') ? '#128C7E' : '#dc2626',
                            fontSize: '0.85rem',
                            borderRadius: '0.75rem',
                            textAlign: 'center',
                        }}>
                            {searchParams.message}
                        </div>
                    )}

                    {/* Divider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                        <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.08)' }} />
                        <span style={{ fontSize: '0.65rem', color: 'rgba(15,23,42,0.30)', fontWeight: 600, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                            ¿YA TIENES CUENTA?
                        </span>
                        <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.08)' }} />
                    </div>

                    <Link
                        href="/login"
                        style={{
                            width: '100%',
                            display: 'block',
                            textAlign: 'center',
                            background: 'transparent',
                            color: '#128C7E',
                            border: '1.5px solid rgba(37,211,102,0.35)',
                            borderRadius: '9999px',
                            padding: '0.75rem 1.5rem',
                            fontWeight: 700,
                            fontSize: '0.875rem',
                            textDecoration: 'none',
                        }}
                    >
                        Iniciar sesión
                    </Link>
                </form>
            </div>

            {/* Footer */}
            <div style={{
                marginTop: '1.5rem',
                textAlign: 'center',
                color: 'rgba(15,23,42,0.30)',
                fontSize: '0.8rem',
                position: 'relative',
                zIndex: 10,
            }}>
                <p style={{ marginBottom: '0.5rem', marginTop: 0 }}>
                    &copy; {new Date().getFullYear()} JABA. Todos los derechos reservados.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                    <Link href="/terms" style={{ color: '#128C7E', textDecoration: 'none', fontSize: '0.75rem', fontWeight: 600 }}>
                        Términos y Condiciones
                    </Link>
                    <span style={{ color: 'rgba(0,0,0,0.12)' }}>|</span>
                    <Link href="/privacy" style={{ color: '#128C7E', textDecoration: 'none', fontSize: '0.75rem', fontWeight: 600 }}>
                        Política de Privacidad
                    </Link>
                </div>
            </div>

            <style>{`
                .reg-input:focus {
                    border-color: rgba(37,211,102,0.50) !important;
                    background: #fff !important;
                    box-shadow: 0 0 0 3px rgba(37,211,102,0.10);
                }
                .reg-input::placeholder {
                    color: rgba(15,23,42,0.30);
                }
            `}</style>
        </div>
    )
}
