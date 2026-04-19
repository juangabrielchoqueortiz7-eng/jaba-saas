'use client'

import { useRef, useState } from 'react'
import { UploadCloud, X, CheckCircle, FileText, Video, Music, ImageIcon } from 'lucide-react'

type MediaKind = 'image' | 'video' | 'audio' | 'document'

const ACCEPT: Record<MediaKind, string> = {
    image: 'image/jpeg,image/png,image/webp,image/gif',
    video: 'video/mp4,video/3gpp,video/quicktime',
    audio: 'audio/mpeg,audio/ogg,audio/wav,audio/aac,audio/mp4',
    document: 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.doc,.docx,.xls,.xlsx,.txt',
}

const KIND_ICON: Record<MediaKind, React.ReactNode> = {
    image: <ImageIcon size={16} />,
    video: <Video size={16} />,
    audio: <Music size={16} />,
    document: <FileText size={16} />,
}

const KIND_LABEL: Record<MediaKind, string> = {
    image: 'imagen',
    video: 'video',
    audio: 'audio',
    document: 'documento',
}

interface MediaUploadFieldProps {
    kind: MediaKind
    value: string          // URL actual guardada
    onChange: (url: string) => void
    placeholder?: string
}

export default function MediaUploadField({ kind, value, onChange, placeholder }: MediaUploadFieldProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [error, setError] = useState<string | null>(null)

    const filename = value ? value.split('/').pop()?.split('?')[0] || value : null

    async function handleFile(file: File) {
        setError(null)
        setUploading(true)
        setProgress(10)

        try {
            const form = new FormData()
            form.append('file', file)

            // Simulate progress while uploading
            const ticker = setInterval(() => {
                setProgress(p => Math.min(p + 15, 85))
            }, 300)

            const res = await fetch('/api/flow-media/upload', {
                method: 'POST',
                body: form,
            })

            clearInterval(ticker)
            setProgress(100)

            const data = await res.json()
            if (!res.ok) {
                setError(data.error || 'Error al subir el archivo')
                return
            }

            onChange(data.url)
        } catch {
            setError('Error de conexión al subir el archivo')
        } finally {
            setUploading(false)
            setTimeout(() => setProgress(0), 800)
        }
    }

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (file) handleFile(file)
        // Reset so same file can be re-selected
        e.target.value = ''
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault()
        const file = e.dataTransfer.files?.[0]
        if (file) handleFile(file)
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Drop zone / upload button */}
            {!value && (
                <div
                    onDrop={handleDrop}
                    onDragOver={e => e.preventDefault()}
                    onClick={() => !uploading && inputRef.current?.click()}
                    style={{
                        border: '2px dashed rgba(15,23,42,0.15)',
                        borderRadius: 10,
                        padding: '18px 12px',
                        textAlign: 'center',
                        cursor: uploading ? 'wait' : 'pointer',
                        background: uploading ? 'rgba(34,197,94,0.04)' : '#FAFAFA',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { if (!uploading) (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.06)' }}
                    onMouseLeave={e => { if (!uploading) (e.currentTarget as HTMLElement).style.background = '#FAFAFA' }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        {uploading ? (
                            <>
                                <div style={{
                                    width: '100%', height: 4, background: 'rgba(15,23,42,0.08)',
                                    borderRadius: 4, overflow: 'hidden',
                                }}>
                                    <div style={{
                                        height: '100%', width: `${progress}%`,
                                        background: '#22c55e', borderRadius: 4,
                                        transition: 'width 0.3s ease',
                                    }} />
                                </div>
                                <span style={{ color: '#475569', fontSize: '0.78rem' }}>Subiendo... {progress}%</span>
                            </>
                        ) : (
                            <>
                                <UploadCloud size={22} color="#94a3b8" />
                                <span style={{ color: '#475569', fontSize: '0.78rem', fontWeight: 600 }}>
                                    Haz clic o arrastra un {KIND_LABEL[kind]} aquí
                                </span>
                                <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                                    {placeholder || `Sube el archivo directamente`}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Archivo ya subido — mostrar nombre + botón de quitar */}
            {value && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'rgba(34,197,94,0.08)',
                    border: '1px solid rgba(34,197,94,0.25)',
                    borderRadius: 8, padding: '8px 12px',
                }}>
                    <span style={{ color: '#16a34a' }}>{KIND_ICON[kind]}</span>
                    <span style={{
                        flex: 1, color: '#0F172A', fontSize: '0.78rem', fontWeight: 500,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                        {filename}
                    </span>
                    <CheckCircle size={14} color="#16a34a" style={{ flexShrink: 0 }} />
                    <button
                        type="button"
                        onClick={() => { onChange(''); setError(null) }}
                        title="Quitar archivo"
                        style={{
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: '#94a3b8', padding: 2, flexShrink: 0,
                        }}
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Cambiar archivo si ya hay uno */}
            {value && (
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                    style={{
                        background: 'transparent', border: '1px solid rgba(15,23,42,0.1)',
                        borderRadius: 6, padding: '5px 10px', fontSize: '0.72rem',
                        color: '#475569', cursor: 'pointer', alignSelf: 'flex-start',
                    }}
                >
                    {uploading ? 'Subiendo...' : `Cambiar ${KIND_LABEL[kind]}`}
                </button>
            )}

            {/* Error */}
            {error && (
                <p style={{ color: '#ef4444', fontSize: '0.72rem', margin: 0 }}>
                    ⚠ {error}
                </p>
            )}

            <input
                ref={inputRef}
                type="file"
                accept={ACCEPT[kind]}
                onChange={handleInputChange}
                style={{ display: 'none' }}
            />
        </div>
    )
}
