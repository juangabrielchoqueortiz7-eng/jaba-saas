'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { LayoutDashboard, MessageSquare, Bot, Home, BrainCircuit, Users, ShoppingCart, Package, RefreshCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
    const pathname = usePathname()
    const params = useParams()
    // Explicitly cast params to handle the possibility of it being empty or different type
    const paramId = params?.assistantId as string | undefined

    const [activeId, setActiveId] = useState<string | undefined>(paramId)
    const [isAdmin, setIsAdmin] = useState(false)

    useEffect(() => {
        // If we have an ID in params, update state and save to local storage
        if (paramId) {
            setActiveId(paramId)
            localStorage.setItem('jaba_active_assistant', paramId)
        } else {
            // If no ID in params (e.g. /dashboard/chats), try to recover from storage
            const savedId = localStorage.getItem('jaba_active_assistant')
            if (savedId) {
                setActiveId(savedId)
            }
        }
    }, [paramId])

    // Cargar flag is_platform_admin
    useEffect(() => {
        async function checkAdmin() {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data } = await supabase
                .from('whatsapp_credentials')
                .select('is_platform_admin')
                .eq('user_id', user.id)
                .single()
            setIsAdmin(data?.is_platform_admin === true)
        }
        checkAdmin()
    }, [])

    // Logic: If we are not in 'home' or 'assistants' root, we assume an assistant is active.
    // Enhanced logic: If we have an assistantId param OR a saved activeId, we are in assistant context.
    const isAssistantActive = pathname === '/dashboard' || pathname.startsWith('/dashboard/chats') || pathname.startsWith('/dashboard/settings') || !!activeId

    return (
        <nav className="flex-1 p-4 space-y-2">
            <Link
                href="/dashboard/home"
                className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium",
                    pathname === '/dashboard/home'
                        ? "bg-indigo-500/10 text-indigo-400"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                )}
            >
                <Home size={20} />
                Inicio
            </Link>

            <Link
                href="/dashboard/assistants"
                className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium",
                    pathname === '/dashboard/assistants' || pathname === '/dashboard/assistants/new'
                        ? "bg-indigo-500/10 text-indigo-400"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                )}
            >
                <Bot size={20} />
                Asistentes
            </Link>

            {/* Suscripciones: Solo visible para el Admin/Dueño */}
            {isAdmin && (
                <Link
                    href="/dashboard/subscriptions"
                    className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium",
                        pathname === '/dashboard/subscriptions'
                            ? "bg-indigo-500/10 text-indigo-400"
                            : "text-slate-400 hover:text-white hover:bg-slate-800"
                    )}
                >
                    <Users size={20} />
                    Suscripciones
                </Link>
            )}

            {/* Renovaciones: Solo visible para el Admin/Dueño */}
            {isAdmin && (
                <Link
                    href="/dashboard/renewals"
                    className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium",
                        pathname === '/dashboard/renewals'
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "text-slate-400 hover:text-white hover:bg-slate-800"
                    )}
                >
                    <RefreshCcw size={20} />
                    Renovaciones
                </Link>
            )}

            {/* Assistant Specific Tools (Conditional) */}
            {isAssistantActive && (
                <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                    <div className="px-4 pt-4 pb-2">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Asistente Activo
                        </p>
                    </div>

                    <div className="ml-2 border-l border-slate-800 pl-2 space-y-1">
                        <Link
                            href={activeId ? `/dashboard/assistants/${activeId}` : "/dashboard"}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium",
                                pathname === (activeId ? `/dashboard/assistants/${activeId}` : '/dashboard')
                                    ? "text-white bg-slate-800/50"
                                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                            )}
                        >
                            <span className="text-lg">📄</span>
                            Descripción
                        </Link>
                        <Link
                            href="/dashboard/chats"
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium",
                                pathname.startsWith('/dashboard/chats')
                                    ? "text-white bg-slate-800/50"
                                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                            )}
                        >
                            <MessageSquare size={20} />
                            Chat
                        </Link>

                        <Link
                            href="/dashboard/orders"
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium",
                                pathname.startsWith('/dashboard/orders')
                                    ? "text-white bg-slate-800/50"
                                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                            )}
                        >
                            <ShoppingCart size={20} />
                            Pedidos
                        </Link>

                        {/* Products/Catalog Link */}
                        <Link
                            href="/dashboard/products"
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium",
                                pathname.startsWith('/dashboard/products')
                                    ? "text-white bg-slate-800/50"
                                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                            )}
                        >
                            <Package size={20} />
                            Productos
                        </Link>

                        {/* Training Link - Only shows if we have an ID or if we are in training page */}
                        <Link
                            href={activeId ? `/dashboard/assistants/${activeId}/training` : "#"}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium",
                                pathname.endsWith('/training')
                                    ? "text-white bg-slate-800/50"
                                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                            )}
                        >
                            <BrainCircuit size={20} />
                            Entrenamiento
                        </Link>

                        {/* Templates Link */}
                        <Link
                            href={activeId ? `/dashboard/assistants/${activeId}/templates` : "#"}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium",
                                pathname.includes('/templates')
                                    ? "text-white bg-slate-800/50"
                                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                            )}
                        >
                            <span className="text-lg">📋</span>
                            Plantillas
                        </Link>

                        {/* Triggers Link */}
                        <Link
                            href={activeId ? `/dashboard/assistants/${activeId}/triggers` : "#"}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium",
                                pathname.includes('/triggers')
                                    ? "text-white bg-slate-800/50"
                                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                            )}
                        >
                            <span className="text-lg">⚡</span>
                            Disparadores
                        </Link>

                        {/* Recargas y Logros: Solo para clientes (NO admin) */}
                        {!isAdmin && (
                            <>
                                <Link
                                    href="/dashboard/recharges"
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium",
                                        pathname.includes('/recharges')
                                            ? "text-white bg-slate-800/50"
                                            : "text-slate-400 hover:text-white hover:bg-slate-800"
                                    )}
                                >
                                    <span className="text-lg">💳</span>
                                    Recargas
                                </Link>

                                <Link
                                    href="/dashboard/achievements"
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium",
                                        pathname.includes('/achievements')
                                            ? "text-white bg-slate-800/50"
                                            : "text-slate-400 hover:text-white hover:bg-slate-800"
                                    )}
                                >
                                    <span className="text-lg">🏆</span>
                                    Logros
                                </Link>
                            </>
                        )}

                        {/* Settings Link */}
                        <Link
                            href="/dashboard/settings"
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium",
                                pathname.startsWith('/dashboard/settings')
                                    ? "text-white bg-slate-800/50"
                                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                            )}
                        >
                            <span className="text-lg">⚙️</span>
                            Configuración
                        </Link>
                    </div>
                </div>
            )}
        </nav>
    )
}
