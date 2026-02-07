
import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Bot, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react'

export default function Login({
    searchParams,
}: {
    searchParams: { message: string }
}) {
    const signIn = async (formData: FormData) => {
        'use server'

        const email = formData.get('email') as string
        const password = formData.get('password') as string
        const supabase = await createClient()

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            return redirect('/login?message=Error de autenticación: Credenciales inválidas')
        }

        return redirect('/dashboard')
    }

    const signUp = async (formData: FormData) => {
        'use server'

        const origin = (await headers()).get('origin')
        const email = formData.get('email') as string
        const password = formData.get('password') as string
        const supabase = await createClient()

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${origin}/auth/callback`,
            },
        })

        if (error) {
            return redirect('/login?message=Error creando cuenta. Intenta nuevamente.')
        }

        return redirect('/login?message=¡Cuenta creada! Revisa tu correo para confirmar.')
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#F3F4F6] relative overflow-hidden">
            {/* Background Pattern (Robot Watermark) */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex flex-wrap gap-12 p-8 justify-center items-center">
                {/* Repeating pattern of bots for effect */}
                {Array.from({ length: 20 }).map((_, i) => (
                    <Bot key={i} size={120} strokeWidth={1} />
                ))}
            </div>

            <div className="w-full max-w-[420px] px-8 py-10 bg-white border border-slate-100 rounded-3xl shadow-2xl relative z-10">
                {/* Branding Header */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3 mb-4">
                        <Bot className="text-white w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                        Jaba SaaS
                    </h2>
                    <p className="text-slate-500 text-sm mt-2">
                        Tu asistente de ventas por WhatsApp
                    </p>
                </div>

                <form className="flex flex-col gap-5">

                    {/* Email Input */}
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1" htmlFor="email">
                            Correo Electrónico
                        </label>
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                <Mail size={18} />
                            </div>
                            <input
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 focus:outline-none transition-all"
                                name="email"
                                type="email"
                                placeholder="usuario@empresa.com"
                                required
                            />
                        </div>
                    </div>

                    {/* Password Input */}
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1" htmlFor="password">
                            Contraseña
                        </label>
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                <Lock size={18} />
                            </div>
                            <input
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 focus:outline-none transition-all"
                                type="password"
                                name="password"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                        <div className="flex justify-end pt-1">
                            <Link href="#" className="text-xs text-indigo-500 hover:text-indigo-600 hover:underline">
                                ¿Olvidaste tu contraseña?
                            </Link>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        formAction={signIn}
                        className="group w-full bg-slate-900 text-white rounded-xl py-3.5 font-semibold shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:scale-[0.99] active:scale-[0.97] transition-all flex items-center justify-center gap-2 mt-2"
                    >
                        Iniciar Sesión
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>

                    {/* Separator */}
                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-slate-100"></div>
                        <span className="flex-shrink px-4 text-slate-400 text-xs text-center">O SI NO TIENES CUENTA</span>
                        <div className="flex-grow border-t border-slate-100"></div>
                    </div>

                    {/* Register Button */}
                    <button
                        formAction={signUp}
                        className="w-full bg-white text-slate-700 border border-slate-200 rounded-xl py-3 font-medium hover:bg-slate-50 hover:border-slate-300 transition-all text-sm"
                    >
                        Registrarse como nuevo cliente
                    </button>

                    {/* Error Message */}
                    {searchParams?.message && (
                        <div className="mt-2 p-3 bg-rose-50 border border-rose-100 text-rose-600 text-sm rounded-lg text-center animate-in fade-in slide-in-from-bottom-2">
                            {searchParams.message}
                        </div>
                    )}
                </form>
            </div>

            <div className="mt-8 text-center text-slate-400 text-sm flex flex-col gap-2">
                <span>&copy; {new Date().getFullYear()} Jaba SaaS Inc.</span>
                <div className="flex justify-center gap-4">
                    <Link href="/terms" className="text-indigo-500 hover:text-indigo-600 hover:underline text-xs">
                        Términos y Condiciones
                    </Link>
                    <span className="text-slate-300">|</span>
                    <Link href="/privacy" className="text-indigo-500 hover:text-indigo-600 hover:underline text-xs">
                        Política de Privacidad
                    </Link>
                </div>
            </div>
        </div>
    )
}
