'use client'

import { useState, useEffect, Suspense, lazy } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
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

    useEffect(() => { setSidebarOpen(false) }, [pathname])

    useEffect(() => {
        document.body.style.overflow = sidebarOpen ? 'hidden' : ''
        return () => { document.body.style.overflow = '' }
    }, [sidebarOpen])

    return (
        <ChatProvider>
            <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>

                {/* ── Mobile top bar ── */}
                <div className="fixed top-0 left-0 right-0 z-40 md:hidden flex items-center h-14 px-4"
                    style={{
                        background: 'rgba(11,13,23,0.96)',
                        backdropFilter: 'blur(16px)',
                        borderBottom: '1px solid rgba(255,255,255,0.07)',
                    }}>
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
                        style={{
                            background: 'rgba(99,102,241,0.12)',
                            color: '#818cf8',
                            border: '1px solid rgba(99,102,241,0.25)',
                        }}
                        aria-label="Abrir menú"
                    >
                        <Menu size={20} />
                    </button>
                    <div className="flex-1 flex justify-center">
                        <img src="/logo.png" alt="JABA" className="h-8 w-auto" />
                    </div>
                    <div className="w-10" />
                </div>

                {/* ── Mobile backdrop ── */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 z-50 md:hidden"
                        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* ── Sidebar ── */}
                <aside className={`
                    fixed inset-y-0 left-0 z-50 flex flex-col
                    transform transition-transform duration-300 ease-in-out
                    md:relative md:translate-x-0
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                `} style={{
                    width: 256,
                    background: 'linear-gradient(180deg, #090c1a 0%, #0b0e1e 60%, #090c1a 100%)',
                    borderRight: '1px solid rgba(255,255,255,0.06)',
                    boxShadow: '4px 0 32px rgba(0,0,0,0.5)',
                }}>

                    {/* Logo header */}
                    <div className="flex items-center justify-between px-5 py-4"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', minHeight: 68 }}>
                        <div className="flex items-center gap-3">
                            <img src="/logo.png" alt="JABA" className="h-9 w-auto" />
                            <div>
                                <p className="text-xs font-bold tracking-widest uppercase"
                                    style={{ color: '#818cf8', letterSpacing: '0.15em' }}>JABA</p>
                                <p className="text-[10px]" style={{ color: 'rgba(129,140,248,0.45)' }}>
                                    Marketing Digital
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ color: 'rgba(129,140,248,0.6)', background: 'rgba(99,102,241,0.1)' }}
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Nav */}
                    <SidebarNav onNavigate={() => setSidebarOpen(false)} />

                    {/* User footer */}
                    <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="flex items-center gap-3 px-3 py-2 mb-2 rounded-xl"
                            style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                style={{
                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    color: '#fff',
                                    boxShadow: '0 0 12px rgba(99,102,241,0.4)',
                                }}>
                                {userEmail?.charAt(0).toUpperCase()}
                            </div>
                            <div className="overflow-hidden flex-1 min-w-0">
                                <p className="text-xs font-medium truncate"
                                    style={{ color: 'rgba(238,240,255,0.6)' }}>{userEmail}</p>
                            </div>
                        </div>
                        <form action={signOutAction}>
                            <button
                                className="flex w-full items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                                style={{ color: 'rgba(238,240,255,0.35)' }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLButtonElement).style.color = '#fb7185'
                                    ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(244,63,94,0.08)'
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLButtonElement).style.color = 'rgba(238,240,255,0.35)'
                                    ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                                }}
                            >
                                <span>🚪</span>
                                Cerrar sesión
                            </button>
                        </form>
                    </div>
                </aside>

                {/* ── Main content ── */}
                <main className="flex-1 overflow-y-auto pt-14 md:pt-0"
                    style={{ position: 'relative', zIndex: 1 }}>
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
