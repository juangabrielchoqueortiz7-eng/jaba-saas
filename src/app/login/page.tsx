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
            background: '#000',
            position: 'relative',
            overflow: 'hidden',
            padding: '1.5rem',
        }}>
            {/* Ambient verde */}
            <div style={{
                position: 'fixed',
                bottom: '-10%',
                left: '-5%',
                width: 500,
                height: 500,
                background: 'radial-gradient(ellipse, rgba(37,211,102,0.06) 0%, transparent 70%)',
                pointerEvents: 'none',
                zIndex: 0,
            }} />

            {/* Card */}
            <div style={{
                width: '100%',
                maxWidth: 400,
                padding: '2.5rem 2rem',
                background: '#111',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '1.5rem',
                position: 'relative',
                zIndex: 10,
            }}>
                {/* Branding */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: 56,
                        height: 56,
                        background: '#25D366',
                        borderRadius: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '1rem',
                        boxShadow: '0 4px 20px rgba(37,211,102,0.3)',
                    }}>
                        <Bot style={{ color: '#000', width: 30, height: 30 }} />
                    </div>
                    <h2 style={{
                        fontSize: '1.375rem',
                        fontWeight: 800,
                        color: '#fff',
                        letterSpacing: '-0.02em',
                        margin: 0,
                    }}>
                        JABA
                    </h2>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', marginTop: '0.4rem', marginBottom: 0 }}>
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
                            color: 'rgba(255,255,255,0.35)',
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
                                color: 'rgba(255,255,255,0.25)',
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
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '0.75rem',
                                    color: '#fff',
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
                            color: 'rgba(255,255,255,0.35)',
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
                                color: 'rgba(255,255,255,0.25)',
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
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '0.75rem',
                                    color: '#fff',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.4rem' }}>
                            <Link href="#" style={{ fontSize: '0.75rem', color: '#25D366', textDecoration: 'none' }}>
                                ¿Olvidaste tu contraseña?
                            </Link>
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        formAction={signIn}
                        style={{
                            width: '100%',
                            background: '#25D366',
                            color: '#000',
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
                            boxShadow: '0 4px 16px rgba(37,211,102,0.25)',
                        }}
                    >
                        Iniciar Sesión
                        <ArrowRight size={17} />
                    </button>

                    {/* Divider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                        <span style={{
                            fontSize: '0.65rem',
                            color: 'rgba(255,255,255,0.25)',
                            fontWeight: 600,
                            letterSpacing: '0.05em',
                            whiteSpace: 'nowrap',
                        }}>
                            ¿NO TIENES CUENTA?
                        </span>
                        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                    </div>

                    <Link
                        href="/register"
                        style={{
                            width: '100%',
                            display: 'block',
                            textAlign: 'center',
                            background: 'transparent',
                            color: 'rgba(255,255,255,0.55)',
                            border: '1px solid rgba(255,255,255,0.10)',
                            borderRadius: '9999px',
                            padding: '0.75rem 1.5rem',
                            fontWeight: 600,
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
                            background: 'rgba(244,63,94,0.08)',
                            border: '1px solid rgba(244,63,94,0.2)',
                            color: '#fb7185',
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
                color: 'rgba(255,255,255,0.2)',
                fontSize: '0.8rem',
                position: 'relative',
                zIndex: 10,
            }}>
                <p style={{ marginBottom: '0.5rem', marginTop: 0 }}>
                    &copy; {new Date().getFullYear()} JABA. Todos los derechos reservados.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                    <Link href="/terms" style={{ color: '#25D366', textDecoration: 'none', fontSize: '0.75rem' }}>
                        Términos y Condiciones
                    </Link>
                    <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
                    <Link href="/privacy" style={{ color: '#25D366', textDecoration: 'none', fontSize: '0.75rem' }}>
                        Política de Privacidad
                    </Link>
                </div>
            </div>

            <style>{`
                .login-input:focus {
                    border-color: rgba(37,211,102,0.4) !important;
                }
                .login-input::placeholder {
                    color: rgba(255,255,255,0.2);
                }
            `}</style>
        </div>
    )
}
