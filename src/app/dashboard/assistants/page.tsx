import { createClient } from '@/utils/supabase/server'
import { Plus, Bot, Phone, Zap } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DeleteAssistantButton } from './DeleteAssistantButton'
import { AssistantActions } from './AssistantActions'

export default async function AssistantsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return redirect('/login')

    const { data: assistants } = await supabase
        .from('whatsapp_credentials').select('*').eq('user_id', user.id)

    return (
        <div style={{ padding: '32px', maxWidth: 900, margin: '0 auto' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
                <div>
                    <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>Mis Asistentes</h1>
                    <p style={{ fontSize: '0.85rem', color: 'rgba(15,23,42,0.45)' }}>Gestiona los bots de WhatsApp conectados</p>
                </div>
                <Link href="/dashboard/assistants/new" style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10,
                    background: '#25D366', color: '#fff', fontWeight: 600,
                    fontSize: '0.85rem', textDecoration: 'none',
                }}>
                    <Plus size={16} /> Nuevo asistente
                </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {assistants?.map((asst) => {
                    const isActive = asst.ai_status === 'active'
                    return (
                        <div key={asst.id} style={{
                            display: 'flex', alignItems: 'center', gap: 18,
                            background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)',
                            borderRadius: 20, padding: '18px 22px', position: 'relative', overflow: 'hidden',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                        }}>
                            <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: isActive ? 'radial-gradient(circle, rgba(37,211,102,0.12) 0%, transparent 70%)' : 'none', pointerEvents: 'none' }} />
                            <div style={{
                                width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                                background: isActive ? 'rgba(37,211,102,0.1)' : 'rgba(100,116,139,0.08)',
                                border: isActive ? '1px solid rgba(37,211,102,0.25)' : '1px solid rgba(100,116,139,0.15)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Bot size={24} style={{ color: isActive ? '#25D366' : '#64748b' }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                    <h3 style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A', margin: 0 }}>
                                        {asst.bot_name || 'Asistente sin nombre'}
                                    </h3>
                                    <span style={{
                                        fontSize: '0.68rem', fontWeight: 700, padding: '2px 9px', borderRadius: 6,
                                        background: isActive ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.10)',
                                        color: isActive ? '#10b981' : '#64748b',
                                        border: isActive ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(100,116,139,0.15)',
                                    }}>
                                        {isActive ? '● Activo' : '○ Inactivo'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(15,23,42,0.45)', fontSize: '0.78rem' }}>
                                    <Phone size={12} />
                                    <span>{asst.phone_number_display || asst.phone_number_id || 'Sin número'}</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative', zIndex: 1 }}>
                                <AssistantActions asst={asst} />
                                <div style={{ width: 1, height: 28, background: 'rgba(0,0,0,0.08)' }} />
                                <DeleteAssistantButton id={asst.id} />
                                <Link href={`/dashboard/assistants/${asst.id}`} style={{
                                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10,
                                    background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)',
                                    color: '#128C7E', fontWeight: 700, fontSize: '0.82rem', textDecoration: 'none',
                                }}>
                                    <Zap size={14} /> Ver panel
                                </Link>
                            </div>
                        </div>
                    )
                })}

                {(!assistants || assistants.length === 0) && (
                    <div style={{ textAlign: 'center', padding: '60px 24px', background: '#ffffff', border: '2px dashed rgba(37,211,102,0.25)', borderRadius: 20 }}>
                        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(37,211,102,0.10)', border: '1px solid rgba(37,211,102,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <Bot size={28} style={{ color: '#25D366' }} />
                        </div>
                        <p style={{ color: 'rgba(15,23,42,0.45)', marginBottom: 20, fontSize: '0.95rem' }}>No tienes asistentes configurados aún.</p>
                        <Link href="/dashboard/assistants/new" style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 10,
                            background: '#25D366', color: '#fff', fontWeight: 600,
                            textDecoration: 'none', fontSize: '0.88rem',
                        }}>
                            <Plus size={16} /> Crear primer asistente
                        </Link>
                    </div>
                )}
            </div>
        </div>
    )
}
