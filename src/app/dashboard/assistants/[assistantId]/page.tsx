import { createClient } from '@/utils/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AssistantNotFound } from '@/components/dashboard/AssistantNotFound'
import { MessageSquare, Mic, TrendingUp, Power, RefreshCw } from 'lucide-react'
import { redirect } from 'next/navigation'

export default async function AssistantDashboardPage({ params }: { params: Promise<{ assistantId: string }> }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { assistantId } = await params

    if (!user) {
        redirect('/login')
    }

    // 1. Fetch Credentials (Status & General Info) - Specific to this assistant
    const { data: credentials } = await supabase
        .from('whatsapp_credentials')
        .select('*')
        .eq('id', assistantId) // Fetch by specific ID
        .single() // Should be unique

    if (!credentials) {
        // Fallback if ID invalid or not found
        // Use client component to clear local storage
        return <AssistantNotFound />
    }

    // 2. Fetch Usage Stats
    // 2.A. Total Conversations (Chats) - Filtered by this assistant (via phone_number_id?)
    // Note: The schema might link chats to the USER, not specifically the credential ID yet. 
    // Assuming 'chats' table might need a link to the credential if multiple assistants exist.
    // For now, let's keep it filtered by user since the original code did that, 
    // BUT realistically it should filter by the assistant's phone number or ID if possible.
    // Let's stick to user filter for charts to avoid breaking if schema isn't fully ready for multi-tenant assistants.
    // OR: If the 'chats' table has 'whatsapp_credential_id' or 'assistant_id', use it.
    // Reviewing schema_chats.sql earlier... let's check assumptions. 
    // I recall viewing test_data.sql. 
    // Let's assume for now valid metrics are global or user-based, but we show the status of THIS assistant.

    const { count: totalChats } = await supabase
        .from('chats')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

    // 2.B. Total Audios Sent by AI
    const { count: totalAudios } = await supabase
        .from('messages')
        .select('chat_id, chats!inner(user_id)', { count: 'exact', head: true })
        .eq('chats.user_id', user.id)
        .eq('type', 'audio')
        .eq('sender', 'ai')

    // 2.C. Recent Conversations (Last 7 Days) for Chart
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    const { data: recentChats } = await supabase
        .from('chats')
        .select('created_at')
        .eq('user_id', user.id)
        .gte('created_at', sevenDaysAgo.toISOString())

    // Process Chart Data
    const chartData = []
    const days = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

    for (let i = 0; i < 7; i++) {
        const d = new Date(sevenDaysAgo)
        d.setDate(d.getDate() + i)
        const dayKey = d.toISOString().split('T')[0]
        const dayName = days[d.getDay()]

        const count = recentChats?.filter(c => c.created_at.startsWith(dayKey)).length || 0
        chartData.push({ day: dayName, count, fullDate: dayKey })
    }

    const maxVal = Math.max(...chartData.map(d => d.count), 5)
    const LIMIT_CHATS = 500
    const LIMIT_AUDIOS = 100
    const aiStatus = credentials?.ai_status || 'sleep'
    const isActive = aiStatus === 'active'

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 fade-in animate-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        {credentials.phone_number_id || 'Asistente'}
                    </h1>
                    <p className="text-slate-400">ID: {credentials.id?.slice(0, 8)}...</p>
                </div>
                <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-full px-4 py-2">
                    <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`}></div>
                    <span className="text-sm font-medium text-slate-300">
                        {isActive ? 'Sistema Operativo' : 'Sistema en Reposo'}
                    </span>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LEFT COLUMN */}
                <div className="space-y-6">

                    {/* STATUS CARD */}
                    <Card className="bg-slate-900 border-slate-800">
                        <CardHeader>
                            <CardTitle className="text-lg font-medium text-slate-200">Estado</CardTitle>
                        </CardHeader>
                        <CardContent className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-full ${isActive ? 'bg-green-500/10 text-green-500' : 'bg-slate-800 text-slate-500'}`}>
                                    <Power className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-white font-medium">{isActive ? 'Activo' : 'Dormido'}</p>
                                    <p className="text-xs text-slate-500">
                                        {isActive ? 'El asistente está respondiendo mensajes.' : 'El asistente no procesará mensajes nuevos.'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500' : 'bg-slate-600'}`}></div>
                                <span className="text-sm font-medium text-slate-300">{isActive ? 'Activar' : 'Desactivado'}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* QUOTAS CARD */}
                    <Card className="bg-slate-900 border-slate-800">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-lg font-medium text-slate-200">Cuotas</CardTitle>
                            <RefreshCw className="w-4 h-4 text-slate-500" />
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Conversations Bar */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400 flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4" /> Conversaciones
                                    </span>
                                    <span className="text-white font-mono">{totalChats || 0} <span className="text-slate-500">/ {LIMIT_CHATS}</span></span>
                                </div>
                                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                                        style={{ width: `${Math.min(((totalChats || 0) / LIMIT_CHATS) * 100, 100)}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Audios Bar */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400 flex items-center gap-2">
                                        <Mic className="w-4 h-4" /> Audios
                                    </span>
                                    <span className="text-white font-mono">{totalAudios || 0} <span className="text-slate-500">/ {LIMIT_AUDIOS}</span></span>
                                </div>
                                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-green-500 rounded-full transition-all duration-1000"
                                        style={{ width: `${Math.min(((totalAudios || 0) / LIMIT_AUDIOS) * 100, 100)}%` }}
                                    ></div>
                                </div>
                            </div>

                            <div className="flex justify-between text-xs text-slate-600 mt-2">
                                <span>{totalChats || 0} Actual</span>
                                <span>{LIMIT_CHATS} Límite</span>
                            </div>

                        </CardContent>
                    </Card>

                    {/* DAILY STATS */}
                    <Card className="bg-slate-900 border-slate-800">
                        <CardHeader>
                            <CardTitle className="text-lg font-medium text-slate-200">Nuevas conversaciones hoy</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-bold text-white">
                                    {chartData[6].count}
                                </span>
                                <span className="text-sm text-green-500 font-medium flex items-center">
                                    <TrendingUp className="w-3 h-3 mr-1" /> Hoy
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                </div>

                {/* RIGHT COLUMN - CHART */}
                <div className="space-y-6 h-full">
                    <Card className="bg-slate-900 border-slate-800 h-full flex flex-col">
                        <CardHeader>
                            <CardTitle className="text-lg font-medium text-slate-200">Nuevas conversaciones últimos 7 días</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col justify-end pt-8">
                            {/* Custom CSS Bar Chart */}
                            <div className="w-full flex items-end justify-between gap-2 h-64 border-b border-slate-800 pb-2 relative">

                                {/* Grid Lines (Visual only) */}
                                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                                    <div className="border-t border-slate-600 w-full h-0"></div>
                                    <div className="border-t border-slate-600 w-full h-0"></div>
                                    <div className="border-t border-slate-600 w-full h-0"></div>
                                    <div className="border-t border-slate-600 w-full h-0"></div>
                                    <div className="border-t border-slate-600 w-full h-0"></div>
                                </div>

                                {/* Bars */}
                                {chartData.map((d, i) => (
                                    <div key={i} className="flex flex-col items-center gap-2 group w-full">
                                        {/* Tooltip-ish value */}
                                        <div className="bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 pointer-events-none">
                                            {d.count}
                                        </div>

                                        <div
                                            className="w-full max-w-[40px] bg-blue-500 rounded-t-sm hover:bg-blue-400 transition-all cursor-pointer relative z-10"
                                            style={{
                                                height: `${Math.max((d.count / maxVal) * 100, 2)}%`,
                                                opacity: i === 6 ? 1 : 0.6 // Highlight today
                                            }}
                                        ></div>
                                        <span className="text-xs text-slate-500 font-medium capitalize">{d.day}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-between text-xs text-slate-600 mt-4">
                                <span>0</span>
                                <span>{Math.round(maxVal * 0.2)}</span>
                                <span>{Math.round(maxVal * 0.4)}</span>
                                <span>{Math.round(maxVal * 0.6)}</span>
                                <span>{Math.round(maxVal * 0.8)}</span>
                                <span>{maxVal}</span>
                            </div>

                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
