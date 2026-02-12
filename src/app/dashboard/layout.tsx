
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
    LayoutDashboard,
    MessageSquare,
    Users,
    Settings,
    LogOut
} from 'lucide-react'
import { SidebarNav } from '@/components/dashboard/SidebarNav'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return redirect('/login')
    }

    const signOut = async () => {
        'use server'
        const supabase = await createClient()
        await supabase.auth.signOut()
        return redirect('/login')
    }

    return (
        <div className="flex h-screen bg-slate-950 text-white selection:bg-indigo-500 selection:text-white">
            {/* Sidebar */}
            <aside className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col">
                <div className="h-24 flex items-center justify-center px-4 border-b border-slate-800">
                    <div className="w-full flex justify-center">
                        <img src="/logo.png" alt="JABA SaaS Logo" className="h-16 w-auto object-contain max-w-full" />
                    </div>
                </div>

                <SidebarNav />

                <div className="p-4 border-t border-slate-800">
                    <div className="flex items-center gap-3 px-4 py-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold">
                            {user.email?.charAt(0).toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium truncate">{user.email}</p>
                        </div>
                    </div>
                    <form action={signOut}>
                        <button className="flex w-full items-center gap-3 px-4 py-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors text-sm font-medium">
                            <LogOut size={16} />
                            Cerrar Sesión
                        </button>
                    </form>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
        </div>
    )
}
