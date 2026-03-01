'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { SidebarNav } from './SidebarNav'

interface DashboardShellProps {
    children: React.ReactNode
    userEmail: string
    signOutAction: () => Promise<void>
}

export function DashboardShell({ children, userEmail, signOutAction }: DashboardShellProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const pathname = usePathname()

    // Auto-close sidebar on route change (mobile)
    useEffect(() => {
        setSidebarOpen(false)
    }, [pathname])

    // Prevent body scroll when sidebar is open on mobile
    useEffect(() => {
        if (sidebarOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => { document.body.style.overflow = '' }
    }, [sidebarOpen])

    return (
        <div className="flex h-screen bg-slate-950 text-white selection:bg-indigo-500 selection:text-white">

            {/* Mobile Header Bar */}
            <div className="fixed top-0 left-0 right-0 z-40 md:hidden flex items-center h-14 px-4 bg-slate-900/95 backdrop-blur-lg border-b border-slate-800">
                <button
                    onClick={() => setSidebarOpen(true)}
                    className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                    aria-label="Abrir menú"
                >
                    <Menu size={22} />
                </button>
                <div className="flex-1 flex justify-center">
                    <img src="/logo.png" alt="JABA" className="h-8 w-auto" />
                </div>
                <div className="w-10" /> {/* Spacer for visual centering */}
            </div>

            {/* Mobile Overlay Backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800 flex flex-col
                transform transition-transform duration-300 ease-in-out
                md:relative md:translate-x-0 md:w-64
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {/* Sidebar Header */}
                <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                        <img src="/logo.png" alt="JABA" className="h-10 w-auto" />
                    </div>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        aria-label="Cerrar menú"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Nav Links */}
                <SidebarNav onNavigate={() => setSidebarOpen(false)} />

                {/* User Info + Sign Out */}
                <div className="p-4 border-t border-slate-800">
                    <div className="flex items-center gap-3 px-3 py-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {userEmail?.charAt(0).toUpperCase()}
                        </div>
                        <div className="overflow-hidden flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{userEmail}</p>
                        </div>
                    </div>
                    <form action={signOutAction}>
                        <button className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors text-sm font-medium">
                            <span className="text-base">🚪</span>
                            Cerrar Sesión
                        </button>
                    </form>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
                {children}
            </main>
        </div>
    )
}
