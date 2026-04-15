'use client'

import { useState, useEffect, Suspense, lazy } from 'react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Menu, X, LogOut } from 'lucide-react'
import { SidebarNav } from './SidebarNav'
import { ChatProvider } from '@/context/ChatContext'
import { OnboardingWidget } from './OnboardingWidget'

const ChatPanel = lazy(() => import('@/components/chat/ChatPanel').then(m => ({ default: m.ChatPanel })))

interface DashboardShellProps {
    children: React.ReactNode
    userEmail: string
    signOutAction: () => Promise<void>
}

export function DashboardShell({ children, userEmail, signOutAction }: DashboardShellProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const pathname = usePathname()

    useEffect(() => {
        document.body.style.overflow = sidebarOpen ? 'hidden' : ''
        return () => { document.body.style.overflow = '' }
    }, [sidebarOpen])

    useEffect(() => {
        document.body.dataset.jabaPathname = pathname
        return () => { delete document.body.dataset.jabaPathname }
    }, [pathname])

    return (
        <ChatProvider>
            <div className="flex h-screen overflow-hidden" style={{ background: '#ffffff' }}>

                {/* ── Mobile top bar ── */}
                <div
                    className="fixed top-0 left-0 right-0 z-40 md:hidden flex items-center h-14 px-4"
                    style={{
                        background: 'rgba(255,255,255,0.95)',
                        backdropFilter: 'blur(16px)',
                        borderBottom: '1px solid rgba(0,0,0,0.08)',
                    }}
                >
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
                        style={{
                            background: 'rgba(37,211,102,0.08)',
                            color: '#128C7E',
                            border: '1px solid rgba(37,211,102,0.20)',
                        }}
                        aria-label="Abrir menú"
                    >
                        <Menu size={20} />
                    </button>
                    <div className="flex-1 flex justify-center">
                        <Image src="/logo.png" alt="JABA" width={120} height={32} className="h-8 w-auto" priority />
                    </div>
                    <div className="w-10" />
                </div>

                {/* ── Mobile backdrop ── */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 z-50 md:hidden"
                        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* ── Sidebar ── */}
                <aside
                    className={`
                        fixed inset-y-0 left-0 z-50 flex flex-col
                        transform transition-transform duration-300 ease-in-out
                        md:relative md:translate-x-0
                        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                    `}
                    style={{
                        width: 256,
                        background: '#F7F8FA',
                        borderRight: '1px solid rgba(0,0,0,0.08)',
                    }}
                >
                    {/* Logo header */}
                    <div
                        className="flex items-center justify-between px-5 py-4"
                        style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', minHeight: 68 }}
                    >
                        <div className="flex items-center gap-3">
                            <Image src="/logo.png" alt="JABA" width={128} height={36} className="h-9 w-auto" priority />
                            <div>
                                <p
                                    className="text-xs font-bold tracking-widest uppercase"
                                    style={{ color: '#25D366', letterSpacing: '0.15em' }}
                                >
                                    JABA
                                </p>
                                <p className="text-[10px]" style={{ color: 'rgba(37,211,102,0.4)' }}>
                                    Marketing Digital
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ color: '#128C7E', background: 'rgba(37,211,102,0.10)', border: '1px solid rgba(37,211,102,0.20)' }}
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Nav */}
                    <SidebarNav onNavigate={() => setSidebarOpen(false)} />

                    {/* User footer */}
                    <div className="p-4" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                        <div
                            className="flex items-center gap-3 px-3 py-2 mb-2 rounded-xl"
                            style={{ background: 'rgba(0,0,0,0.03)' }}
                        >
                            <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                                style={{
                                    background: 'rgba(37,211,102,0.15)',
                                    color: '#128C7E',
                                    border: '1px solid rgba(37,211,102,0.25)',
                                }}
                            >
                                {userEmail?.charAt(0).toUpperCase()}
                            </div>
                            <div className="overflow-hidden flex-1 min-w-0">
                                <p
                                    className="text-xs font-medium truncate"
                                    style={{ color: 'rgba(15,23,42,0.50)' }}
                                >
                                    {userEmail}
                                </p>
                            </div>
                        </div>
                        <form action={signOutAction}>
                            <button
                                className="flex w-full items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                                style={{ color: 'rgba(15,23,42,0.35)' }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLButtonElement).style.color = '#dc2626'
                                    ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(220,38,38,0.07)'
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLButtonElement).style.color = 'rgba(15,23,42,0.35)'
                                    ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                                }}
                            >
                                <LogOut size={15} />
                                Cerrar sesión
                            </button>
                        </form>
                    </div>
                </aside>

                {/* ── Main content ── */}
                <main className="flex-1 overflow-y-auto pt-14 md:pt-0" style={{ position: 'relative', zIndex: 1 }}>
                    {children}
                </main>

                {/* ── Floating Chat Panel ── */}
                <Suspense fallback={null}>
                    <ChatPanel />
                </Suspense>

                {/* ── Onboarding Widget ── */}
                <OnboardingWidget />
            </div>
        </ChatProvider>
    )
}
