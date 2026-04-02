import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Bot, Lock, Mail, ArrowRight } from 'lucide-react'

export default async function Login({
    searchParams,
}: {
    searchParams: { message: string }
}) {
    const signIn = async (formData: FormData) => {
        'use server'
        const email = formData.get('email') as string
        const password = formData.get('password') as string
        const supabase = await createClient()
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) return redirect('/login?message=Error de autenticación: Credenciales inválidas')
        return redirect('/dashboard')
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
            padding: '1.5rem',
        }}>
            {/* Ambient verde superior */}
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
                maxWidth: 400,
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
                        JABA
                    </h2>
                    <p style={{ color: 'rgba(15,23,42,0.45)', fontSize: '0.85rem', marginTop: '0.4rem', marginBottom: 0 }}>
                        Tu asistente de ventas por WhatsApp
                    </p>
                </div>

                <form style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                    {/* Email */}
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: 'rgba(15,23,42,0.45)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            marginBottom: '0.4rem',
                            marginLeft: '0.25rem',
                        }}>
                            Correo Electrónico
                        </label>
                        <div style={{ position: 'relative' }}>
                            <div style={{
                                position: 'absolute',
                                left: '0.875rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'rgba(15,23,42,0.30)',
                                display: 'flex',
                                alignItems: 'center',
                                pointerEvents: 'none',
                            }}>
                                <Mail size={17} />
                            </div>
                            <input
                                name="email"
                                type="email"
                                placeholder="usuario@empresa.com"
                                required
                                className="login-input"
                                style={{
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
                                    boxSizing: 'border-box',
                                }}
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: 'rgba(15,23,42,0.45)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            marginBottom: '0.4rem',
                            marginLeft: '0.25rem',
                        }}>
                            Contraseña
                        </label>
                        <div style={{ position: 'relative' }}>
                            <div style={{
                                position: 'absolute',
                                left: '0.875rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'rgba(15,23,42,0.30)',
                                display: 'flex',
                                alignItems: 'center',
                                pointerEvents: 'none',
                            }}>
                                <Lock size={17} />
                            </div>
                            <input
                                type="password"
                                name="password"
                                placeholder="••••••••"
                                required
                                className="login-input"
                                style={{
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
                                    boxSizing: 'border-box',
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.4rem' }}>
                            <Link href="#" style={{ fontSize: '0.75rem', color: '#128C7E', textDecoration: 'none', fontWeight: 600 }}>
                                ¿Olvidaste tu contraseña?
                            </Link>
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        formAction={signIn}
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
                        Iniciar Sesión
                        <ArrowRight size={17} />
                    </button>

                    {/* Divider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.08)' }} />
                        <span style={{
                            fontSize: '0.65rem',
                            color: 'rgba(15,23,42,0.30)',
                            fontWeight: 600,
                            letterSpacing: '0.05em',
                            whiteSpace: 'nowrap',
                        }}>
                            ¿NO TIENES CUENTA?
                        </span>
                        <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.08)' }} />
                    </div>

                    <Link
                        href="/register"
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
                        Crear una cuenta gratis
                    </Link>

                    {/* Error message */}
                    {searchParams?.message && (
                        <div style={{
                            marginTop: '0.25rem',
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
                    <span style={{ color: 'rgba(0,0,0,0.15)' }}>|</span>
                    <Link href="/privacy" style={{ color: '#128C7E', textDecoration: 'none', fontSize: '0.75rem', fontWeight: 600 }}>
                        Política de Privacidad
                    </Link>
                </div>
            </div>

            <style>{`
                .login-input:focus {
                    border-color: rgba(37,211,102,0.50) !important;
                    background: #fff !important;
                    box-shadow: 0 0 0 3px rgba(37,211,102,0.10);
                }
                .login-input::placeholder {
                    color: rgba(15,23,42,0.30);
                }
            `}</style>
        </div>
    )
}
