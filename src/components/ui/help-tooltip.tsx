'use client'

import { useState, useRef, useEffect } from 'react'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HelpTooltipProps {
    text: string
    example?: string
    size?: number
    className?: string
}

export function HelpTooltip({ text, example, size = 13, className }: HelpTooltipProps) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open])

    return (
        <div className={cn("relative inline-flex", className)} ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                className="text-slate-300 hover:text-slate-500 transition-colors focus:outline-none"
                aria-label="Ayuda"
            >
                <HelpCircle size={size} />
            </button>
            {open && (
                <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-[#0F172A] text-white text-[11px] leading-relaxed rounded-lg shadow-xl p-3 pointer-events-none animate-in fade-in duration-150">
                    <p>{text}</p>
                    {example && (
                        <p className="mt-1.5 text-white/60 italic">Ej: {example}</p>
                    )}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-[#0F172A]" />
                </div>
            )}
        </div>
    )
}
