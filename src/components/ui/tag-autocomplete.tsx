'use client'

import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { X, Tag } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { cn } from '@/lib/utils'

interface TagAutocompleteProps {
    value: string[]
    onChange: (tags: string[]) => void
    placeholder?: string
    className?: string
    singleValue?: boolean  // if true, returns comma-string style (for legacy fields)
}

export function TagAutocomplete({ value, onChange, placeholder = 'Escribe una etiqueta...', className }: TagAutocompleteProps) {
    const [input, setInput] = useState('')
    const [allTags, setAllTags] = useState<string[]>([])
    const [open, setOpen] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const deferredInput = useDeferredValue(input)

    useEffect(() => {
        const supabase = createClient()
        supabase.from('chats').select('tags').then(({ data }) => {
            if (!data) return
            const tagSet = new Set<string>()
            data.forEach(row => (row.tags || []).forEach((t: string) => tagSet.add(t)))
            setAllTags([...tagSet].sort())
        })
    }, [])

    const suggestions = (!deferredInput.trim()
        ? allTags.filter(tag => !value.includes(tag))
        : allTags.filter(tag => tag.toLowerCase().includes(deferredInput.toLowerCase()) && !value.includes(tag))
    ).slice(0, 8)

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const addTag = (tag: string) => {
        const clean = tag.trim().toLowerCase().replace(/\s+/g, '-')
        if (!clean || value.includes(clean)) return
        onChange([...value, clean])
        setInput('')
        setOpen(false)
        inputRef.current?.focus()
    }

    const removeTag = (tag: string) => {
        onChange(value.filter(t => t !== tag))
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
            e.preventDefault()
            addTag(input)
        }
        if (e.key === 'Backspace' && !input && value.length > 0) {
            removeTag(value[value.length - 1])
        }
    }

    return (
        <div ref={containerRef} className={cn("relative", className)}>
            <div
                className="flex flex-wrap gap-1.5 p-2 min-h-[40px] bg-[#F7F8FA] border border-black/[0.08] rounded-lg cursor-text"
                onClick={() => { inputRef.current?.focus(); setOpen(true) }}
            >
                {value.map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 text-xs px-2 py-0.5 rounded-full font-medium">
                        <Tag size={9} />
                        {tag}
                        <button
                            type="button"
                            onClick={e => { e.stopPropagation(); removeTag(tag) }}
                            className="text-[#25D366]/60 hover:text-[#25D366] ml-0.5"
                        >
                            <X size={10} />
                        </button>
                    </span>
                ))}
                <input
                    ref={inputRef}
                    value={input}
                    onChange={e => { setInput(e.target.value); setOpen(true) }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={value.length === 0 ? placeholder : ''}
                    className="flex-1 min-w-[120px] bg-transparent text-xs text-[#0F172A] placeholder:text-slate-300 outline-none"
                />
            </div>

            {open && suggestions.length > 0 && (
                <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-black/[0.08] rounded-xl shadow-lg overflow-hidden">
                    <p className="text-[10px] text-slate-400 px-3 pt-2 pb-1 font-semibold uppercase tracking-wider">Etiquetas existentes</p>
                    {suggestions.map(tag => (
                        <button
                            key={tag}
                            type="button"
                            onMouseDown={e => { e.preventDefault(); addTag(tag) }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[#0F172A] hover:bg-[#F7F8FA] transition-colors text-left"
                        >
                            <Tag size={10} className="text-slate-400 shrink-0" />
                            {tag}
                        </button>
                    ))}
                    {input.trim() && !allTags.some(t => t.toLowerCase() === input.trim().toLowerCase()) && (
                        <button
                            type="button"
                            onMouseDown={e => { e.preventDefault(); addTag(input) }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[#25D366] hover:bg-emerald-50 transition-colors border-t border-black/[0.04]"
                        >
                            <span className="font-semibold">+ Crear etiqueta</span>
                            <span className="font-medium">&quot;{input.trim()}&quot;</span>
                        </button>
                    )}
                </div>
            )}
            <p className="text-[10px] text-slate-400 mt-1">Presiona Enter o coma para agregar. Haz clic en la ✕ para quitar.</p>
        </div>
    )
}
