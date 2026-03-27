'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
    Bot, BookOpen, ShoppingBag, Zap, MessageSquare, Users,
    CheckCircle2, ChevronUp, ChevronDown, Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Step = {
    id: string
    done: boolean
    title: string
    href: string
    icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
    color: string
    rgb: string
}

export function OnboardingWidget() {
    const [steps, setSteps] = useState<Step[]>([])
    const [loading, setLoading] = useState(true)
    const [isOpen, setIsOpen] = useState(false)
    const [dismissed, setDismissed] = useState(false)
    const pathname = usePathname()
    const supabase = createClient()

    useEffect(() => {
        const isDismissed = localStorage.getItem('jaba_onboarding_dismissed') === 'true'
        if (isDismissed) setDismissed(true)
    }, [])

    useEffect(() => {
        const fetchStatus = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const [
                { data: assistants },
                { data: products },
                { data: flows },
                { count: chatsCount },
                { count: subsCount },
            ] = await Promise.all([
                supabase.from('whatsapp_credentials').select('id, training_prompt').eq('user_id', user.id),
                supabase.from('products').select('id').eq('user_id', user.id).limit(1),
                supabase.from('flows').select('id').eq('user_id', user.id).limit(1),
                supabase.from('chats').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
                supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
            ])

            const hasAssistant = (assistants?.length ?? 0) > 0
            const hasTraining = assistants?.some(a => a.training_prompt && a.training_prompt.trim().length > 50) ?? false
            const assistantId = assistants?.[0]?.id

            setSteps([
                { id: 'assistant',     done: hasAssistant,              title: 'Conecta tu WhatsApp',     href: '/dashboard/settings',                                                                       icon: Bot,           color: '#25D366', rgb: '37,211,102' },
                { id: 'training',      done: hasTraining,               title: 'Entrena tu asistente IA', href: hasAssistant ? `/dashboard/assistants/${assistantId}/training` : '/dashboard/assistants',   icon: BookOpen,      color: '#25D366', rgb: '37,211,102' },
                { id: 'products',      done: (products?.length ?? 0) > 0, title: 'Agrega tu catálogo',   href: '/dashboard/products',                                                                       icon: ShoppingBag,   color: '#25D366', rgb: '37,211,102' },
                { id: 'subscriptions', done: (subsCount ?? 0) > 0,      title: 'Agrega suscriptores',    href: '/dashboard/subscriptions',                                                                  icon: Users,         color: '#25D366', rgb: '37,211,102' },
                { id: 'flows',         done: (flows?.length ?? 0) > 0,  title: 'Crea tu primer flujo',   href: hasAssistant ? `/dashboard/assistants/${assistantId}/flows` : '/dashboard/assistants',      icon: Zap,           color: '#25D366', rgb: '37,211,102' },
                { id: 'chats',         done: (chatsCount ?? 0) > 0,     title: 'Recibe tu primer mensaje', href: '/dashboard/chats',                                                                        icon: MessageSquare, color: '#25D366', rgb: '37,211,102' },
            ])
            setLoading(false)
        }
        fetchStatus()
    }, [])

    const completedCount = steps.filter(s => s.done).length
    const totalCount = steps.length
    const allDone = completedCount === totalCount
    const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

    // Solo visible fuera de la home, mientras no esté completo ni descartado
    if (loading || pathname === '/dashboard/home' || dismissed || allDone) return null

    const handleDismiss = () => {
        localStorage.setItem('jaba_onboarding_dismissed', 'true')
        setDismissed(true)
    }

    return (
        <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-2">
            {isOpen && (
                <div
                    className="bg-[#111111] border border-white/[0.08] rounded-2xl shadow-2xl w-72 overflow-hidden"
                    style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(37,211,102,0.15)', animation: 'slideUpFade 0.2s ease-out' }}
                >
                    <div className="p-4 border-b border-white/[0.06] flex items-center justify-between"
                        style={{ background: 'rgba(37,211,102,0.04)' }}>
                        <div>
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Sparkles size={14} style={{ color: '#25D366' }} />
                                Configuración inicial
                            </h3>
                            <p className="text-xs text-white/40 mt-0.5">{completedCount} de {totalCount} completados</p>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-white/35 hover:text-white/65 p-1 transition-colors">
                            <ChevronDown size={16} />
                        </button>
                    </div>

                    <div className="px-4 py-2.5 border-b border-white/[0.04]">
                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500"
                                    style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #25D366, #25D366)' }} />
                            </div>
                            <span className="text-xs font-bold" style={{ color: '#25D366' }}>{pct}%</span>
                        </div>
                    </div>

                    <div className="p-3 space-y-1 max-h-72 overflow-y-auto">
                        {steps.map((step) => (
                            <div key={step.id} className={cn("flex items-center gap-3 p-2.5 rounded-xl transition-opacity", step.done ? "opacity-45" : "")}>
                                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                                    style={{ background: 'rgba(37,211,102,0.10)', border: '1.5px solid rgba(37,211,102,0.25)' }}>
                                    {step.done
                                        ? <CheckCircle2 size={14} style={{ color: '#25D366' }} />
                                        : <step.icon size={14} style={{ color: '#25D366' }} />
                                    }
                                </div>
                                <p className="flex-1 text-xs font-medium text-white truncate">{step.title}</p>
                                {!step.done && (
                                    <Link
                                        href={step.href}
                                        onClick={() => setIsOpen(false)}
                                        className="text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap transition-opacity hover:opacity-80"
                                        style={{ color: step.color, background: `rgba(${step.rgb},0.12)`, border: `1px solid rgba(${step.rgb},0.2)` }}
                                    >
                                        Ir →
                                    </Link>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="px-4 py-3 border-t border-white/[0.04]">
                        <button onClick={handleDismiss} className="w-full text-[11px] text-white/35 hover:text-white/40 transition-colors">
                            Ocultar esta guía
                        </button>
                    </div>
                </div>
            )}

            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold shadow-lg transition-all active:scale-95 hover:opacity-90"
                style={{ background: '#25D366', boxShadow: '0 4px 24px rgba(37,211,102,0.35)', color: '#000' }}
            >
                <Sparkles size={15} />
                Setup {pct}%
                {isOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            </button>
        </div>
    )
}
