import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { Building2, Bot, Phone, Calendar, Zap, ZapOff, ShieldCheck, Users, User } from 'lucide-react'

export default async function AdminAccountsPage() {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: myCredentials } = await supabase
        .from('whatsapp_credentials').select('is_platform_admin').eq('user_id', user.id).maybeSingle()
    if (!myCredentials?.is_platform_admin) redirect('/dashboard/home')

    const adminSupabase = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: { users: authUsers } } = await adminSupabase.auth.admin.listUsers({ perPage: 1000 })
    const { data: allCredentials } = await adminSupabase
        .from('whatsapp_credentials')
        .select('id, user_id, bot_name, phone_number_id, phone_number_display, ai_status, created_at, is_platform_admin')
        .order('created_at', { ascending: false })

    const accounts = (allCredentials || []).map(cred => {
        const authUser = authUsers?.find(u => u.id === cred.user_id)
        return { ...cred, email: authUser?.email || 'Sin email', registered_at: authUser?.created_at || cred.created_at, last_sign_in: authUser?.last_sign_in_at || null }
    })

    const credentialUserIds = new Set((allCredentials || []).map(c => c.user_id))
    const usersWithoutBot = (authUsers || []).filter(u => !credentialUserIds.has(u.id))
    const activeAccounts = accounts.filter(a => a.ai_status === 'active').length

    const fmt = (d: string) => new Date(d).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })

    return (
        <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Building2 size={22} style={{ color: '#F97316' }} />
                </div>
                <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#eef0ff', margin: 0 }}>Cuentas en la Plataforma</h1>
                    <p style={{ fontSize: '0.82rem', color: 'rgba(238,240,255,0.4)', margin: 0 }}>Usuarios registrados en JABA</p>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
                {[
                    { label: 'Total cuentas', value: accounts.length, Icon: Bot, color: '#3b82f6' },
                    { label: 'Bots activos', value: activeAccounts, Icon: Zap, color: '#10b981' },
                    { label: 'Sin bot aún', value: usersWithoutBot.length, Icon: User, color: '#94a3b8' },
                    { label: 'Admins', value: accounts.filter(a => a.is_platform_admin).length, Icon: ShieldCheck, color: '#f43f5e' },
                ].map((s, i) => (
                    <div key={i} style={{ background: '#13152a', border: '1px solid rgba(255,255,255,0.06)', borderTop: `2px solid ${s.color}`, borderRadius: 12, padding: '18px 20px' }}>
                        <s.Icon size={16} style={{ color: s.color, marginBottom: 8 }} />
                        <div style={{ fontSize: '1.7rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                        <div style={{ fontSize: '0.75rem', color: 'rgba(148,163,184,0.5)', marginTop: 4 }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Tabla principal */}
            <div style={{ background: '#13152a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, overflow: 'hidden', marginBottom: 24 }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Users size={16} style={{ color: '#10b981' }} />
                    <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#eef0ff', margin: 0 }}>Cuentas con asistente</h2>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(37,211,102,0.2)', color: '#10b981', padding: '2px 8px', borderRadius: 6, marginLeft: 4 }}>{accounts.length}</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                {['Usuario', 'Bot / Teléfono', 'Estado AI', 'Último acceso', 'Registrado', 'Rol'].map(h => (
                                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: 'rgba(99,102,241,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {accounts.length === 0 && (
                                <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'rgba(148,163,184,0.4)' }}>No hay cuentas aún.</td></tr>
                            )}
                            {accounts.map(acc => (
                                <tr key={acc.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.15s' }}>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#818cf8', flexShrink: 0 }}>
                                                {acc.email?.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p style={{ color: '#eef0ff', fontWeight: 600, margin: 0, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.email}</p>
                                                <p style={{ color: 'rgba(148,163,184,0.3)', fontSize: '0.68rem', fontFamily: 'monospace', margin: 0 }}>{acc.user_id.slice(0, 8)}...</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <p style={{ color: '#eef0ff', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <Bot size={12} style={{ color: 'rgba(148,163,184,0.4)' }} />{acc.bot_name || 'Sin nombre'}
                                        </p>
                                        <p style={{ color: 'rgba(148,163,184,0.4)', fontSize: '0.72rem', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Phone size={10} />{acc.phone_number_display || acc.phone_number_id || '—'}
                                        </p>
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
                                            background: acc.ai_status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)',
                                            border: acc.ai_status === 'active' ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(100,116,139,0.15)',
                                            color: acc.ai_status === 'active' ? '#10b981' : '#64748b',
                                        }}>
                                            {acc.ai_status === 'active' ? <Zap size={11} /> : <ZapOff size={11} />}
                                            {acc.ai_status === 'active' ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 16px', color: 'rgba(148,163,184,0.5)', fontSize: '0.78rem' }}>{acc.last_sign_in ? fmt(acc.last_sign_in) : '—'}</td>
                                    <td style={{ padding: '12px 16px', color: 'rgba(148,163,184,0.5)', fontSize: '0.78rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Calendar size={11} />{fmt(acc.registered_at)}</div>
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        {acc.is_platform_admin
                                            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', fontWeight: 700, color: '#F97316', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', padding: '3px 8px', borderRadius: 6 }}><ShieldCheck size={11} /> Admin</span>
                                            : <span style={{ fontSize: '0.75rem', color: 'rgba(148,163,184,0.35)' }}>Cliente</span>
                                        }
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Sin bot */}
            {usersWithoutBot.length > 0 && (
                <div style={{ background: '#13152a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#eef0ff', margin: 0 }}>
                            Registrados sin asistente <span style={{ color: 'rgba(148,163,184,0.4)', fontWeight: 400 }}>({usersWithoutBot.length})</span>
                        </h2>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    {['Email', 'Registrado', 'Último acceso'].map(h => (
                                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: 'rgba(99,102,241,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {usersWithoutBot.map(u => (
                                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(100,116,139,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>
                                                    {u.email?.charAt(0).toUpperCase()}
                                                </div>
                                                <span style={{ color: 'rgba(240,253,244,0.7)' }}>{u.email}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 16px', color: 'rgba(148,163,184,0.5)', fontSize: '0.78rem' }}>{fmt(u.created_at)}</td>
                                        <td style={{ padding: '12px 16px', color: 'rgba(148,163,184,0.5)', fontSize: '0.78rem' }}>{u.last_sign_in_at ? fmt(u.last_sign_in_at) : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
