
import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

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
            return redirect('/login?message=Could not authenticate user')
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
            return redirect('/login?message=Could not authenticate user')
        }

        return redirect('/login?message=Check email to continue sign in process')
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 py-2">
            <div className="w-full max-w-md px-8 py-10 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
                <div className="flex justify-center mb-8">
                    <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-lg flex items-center justify-center">
                        <span className="font-bold text-white text-xl">J</span>
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-center text-white mb-8">
                    Bienvenido a JABA
                </h2>

                <form className="animate-in flex-1 flex flex-col w-full justify-center gap-4 text-slate-300">

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium" htmlFor="email">
                            Correo Electrónico
                        </label>
                        <input
                            className="rounded-lg px-4 py-3 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none transition-colors"
                            name="email"
                            placeholder="tu@empresa.com"
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium" htmlFor="password">
                            Contraseña
                        </label>
                        <input
                            className="rounded-lg px-4 py-3 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none transition-colors"
                            type="password"
                            name="password"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        formAction={signIn}
                        className="bg-indigo-600 rounded-lg px-4 py-3 text-white font-bold hover:bg-indigo-700 transition-colors mt-4"
                    >
                        Iniciar Sesión
                    </button>

                    <button
                        formAction={signUp}
                        className="border border-slate-700 rounded-lg px-4 py-3 text-white hover:bg-slate-800 transition-colors"
                    >
                        Registrarse
                    </button>

                    {searchParams?.message && (
                        <p className="mt-4 p-4 bg-slate-800/50 text-center rounded-lg text-rose-400 border border-rose-900/50">
                            {searchParams.message}
                        </p>
                    )}
                </form>

                <div className="mt-8 text-center">
                    <Link href="/" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                        ← Volver al inicio
                    </Link>
                </div>
            </div>
        </div>
    )
}
