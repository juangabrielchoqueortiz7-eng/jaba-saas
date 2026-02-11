
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, CheckCircle2, Bot, BrainCircuit, MessageSquare, Settings2, Save, Copy } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

import { checkWhatsAppStatus, getSystemConfig } from './actions'

export default function SettingsPage() {


    const WhatsAppStatusCard = ({ phoneNumberId, accessToken }: { phoneNumberId: string, accessToken: string }) => {
        const [status, setStatus] = useState<any>(null)
        const [loading, setLoading] = useState(false)
        const [error, setError] = useState('')

        const checkStatus = async () => {
            setLoading(true)
            setError('')
            const res = await checkWhatsAppStatus(phoneNumberId, accessToken)
            if (res.success) {
                setStatus(res.data)
            } else {
                setError(res.error || 'Error desconocido')
            }
            setLoading(false)
        }

        useEffect(() => {
            checkStatus()
        }, [])

        if (loading) return <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg text-slate-400">Verificando conexión...</div>
        if (error) return (
            <div className="p-4 bg-red-900/10 border border-red-800/50 rounded-lg flex items-center gap-3 text-red-400">
                <AlertCircle size={20} />
                <div>
                    <p className="font-semibold">Error de Conexión</p>
                    <p className="text-xs opacity-80">{error}</p>
                </div>
                <Button onClick={checkStatus} className="ml-auto border border-red-800 text-red-400 hover:bg-red-900/20 h-8 px-3 text-sm bg-transparent">Reintentar</Button>
            </div>
        )

        if (!status) return null

        return (
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="text-white font-medium flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        Conexión Establecida
                    </h3>
                    <Button onClick={checkStatus} className="h-8 px-3 text-sm bg-transparent text-slate-400 hover:text-white hover:bg-slate-800">
                        <Settings2 size={14} className="mr-2" /> Actualizar
                    </Button>
                </div>

                {/* Mimic the user's screenshot table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="bg-slate-950/50 text-slate-500 uppercase font-semibold text-xs">
                            <tr>
                                <th className="p-4">Número de teléfono</th>
                                <th className="p-4">Nombre</th>
                                <th className="p-4">Estado</th>
                                <th className="p-4">Calidad</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            <tr>
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                                            <MessageSquare size={16} />
                                        </div>
                                        <div>
                                            <p className="text-white font-medium">{status.display_phone_number}</p>
                                            <p className="text-xs text-slate-500">{status.status}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 font-medium text-slate-300">{status.verified_name || 'No verificado'}</td>
                                <td className="p-4">
                                    <span className="bg-slate-800 px-3 py-1 rounded-full text-xs font-medium text-slate-300 border border-slate-700">
                                        {status.status === 'VERIFIED' ? 'Conectado' : 'Pendiente'}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <span className={cn(
                                        "px-3 py-1 rounded-full text-xs font-bold border",
                                        status.quality_rating === 'GREEN' ? "bg-green-500/10 text-green-500 border-green-500/20" :
                                            status.quality_rating === 'YELLOW' ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                                                "bg-red-500/10 text-red-500 border-red-500/20"
                                    )}>
                                        {status.quality_rating || 'UNKNOWN'}
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        )
    }

    // Tabs state
    const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'chat'>('general')

    // Form Fields
    const [botName, setBotName] = useState('Mi Asistente')
    const [phoneDisplay, setPhoneDisplay] = useState('')
    const [welcomeMessage, setWelcomeMessage] = useState('')

    // Connection Fields
    const [phoneNumberId, setPhoneNumberId] = useState('')
    const [wabaId, setWabaId] = useState('')
    const [appId, setAppId] = useState('')
    const [accessToken, setAccessToken] = useState('')

    // System Config State
    const [webhookToken, setWebhookToken] = useState('Cargando...')
    const [webhookUrl, setWebhookUrl] = useState('Cargando...')
    const [googleApiKeyConfigured, setGoogleApiKeyConfigured] = useState(false)

    useEffect(() => {
        getSystemConfig().then(config => {
            setWebhookToken(config.webhookVerifyToken)
            setWebhookUrl(config.webhookUrl)
            setGoogleApiKeyConfigured(config.hasGoogleApiKey)
        })
    }, [])

    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    const supabase = createClient()



    // AI Sub-tabs state
    const [activeAiTab, setActiveAiTab] = useState<'general' | 'text' | 'audio'>('general')

    // AI Fields
    const [aiStatus, setAiStatus] = useState('active')
    const [responseDelay, setResponseDelay] = useState(5)
    const [audioProbability, setAudioProbability] = useState(0) // 0-100

    const [messageDeliveryMode, setMessageDeliveryMode] = useState('complete')
    const [useEmojis, setUseEmojis] = useState(true)
    const [useTextStyles, setUseTextStyles] = useState(true)

    const [audioVoiceId, setAudioVoiceId] = useState('')
    const [maxAudioCount, setMaxAudioCount] = useState(2)
    const [replyAudioWithAudio, setReplyAudioWithAudio] = useState(false)

    useEffect(() => {
        async function loadCredentials() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data, error } = await supabase
                .from('whatsapp_credentials')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle()

            if (data) {
                // Connection
                setPhoneNumberId(data.phone_number_id || '')
                setAccessToken(data.access_token || '')

                // General Config
                setBotName(data.bot_name || 'Mi Asistente')
                setPhoneDisplay(data.phone_number_display || '')
                setWelcomeMessage(data.welcome_message || '')

                // AI Config
                setAiStatus(data.ai_status || 'active')
                setResponseDelay(data.response_delay_seconds ?? 5)
                setAudioProbability(data.audio_probability ?? 0)

                setMessageDeliveryMode(data.message_delivery_mode || 'complete')
                setUseEmojis(data.use_emojis ?? true)
                setUseTextStyles(data.use_text_styles ?? true)

                setAudioVoiceId(data.audio_voice_id || '')
                setMaxAudioCount(data.max_audio_count ?? 2)
                setReplyAudioWithAudio(data.reply_audio_with_audio ?? false)
            }
        }
        loadCredentials()
    }, [])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('No usuario autenticado')

            const { data: existing } = await supabase
                .from('whatsapp_credentials')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle()

            const payload = {
                user_id: user.id,
                phone_number_id: phoneNumberId,
                waba_id: wabaId,
                app_id: appId,
                access_token: accessToken,
                bot_name: botName,
                phone_number_display: phoneDisplay,
                welcome_message: welcomeMessage,

                // New AI Fields
                ai_status: aiStatus,
                response_delay_seconds: responseDelay,
                audio_probability: audioProbability,
                message_delivery_mode: messageDeliveryMode,
                use_emojis: useEmojis,
                use_text_styles: useTextStyles,
                audio_voice_id: audioVoiceId,
                max_audio_count: maxAudioCount,
                reply_audio_with_audio: replyAudioWithAudio,

                updated_at: new Date().toISOString()
            }

            if (existing) {
                const { error } = await supabase
                    .from('whatsapp_credentials')
                    .update(payload)
                    .eq('id', existing.id)
                if (error) throw error
            } else {
                const { error } = await supabase.from('whatsapp_credentials').insert(payload)
                if (error) throw error
            }

            setMessage({ type: 'success', text: 'Configuración guardada correctamente' })
        } catch (error: any) {
            console.error(error)
            setMessage({ type: 'error', text: error.message || 'Error al guardar' })
        } finally {
            setLoading(false)
        }
    }

    // Reuse components
    const CopyButton = ({ text }: { text: string }) => {
        const [copied, setCopied] = useState(false)
        const handleCopy = () => {
            navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
        return (
            <Button onClick={handleCopy} className="h-9 w-9 border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-400 flex items-center justify-center p-0">
                {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
        )
    }

    const TabButton = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={cn(
                "flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2",
                activeTab === id
                    ? "border-green-500 text-green-400 bg-green-500/10"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            )}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    )

    const SubTabButton = ({ id, label }: { id: typeof activeAiTab, label: string }) => (
        <button
            onClick={() => setActiveAiTab(id)}
            className={cn(
                "px-4 py-2 text-sm font-medium transition-colors border-l-2 first:border-l-0 md:border-l-0 md:border-b-2",
                activeAiTab === id
                    ? "border-green-500 text-green-400 bg-green-500/10"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            )}
        >
            {label}
        </button>
    )

    const SettingRow = ({ label, description, children }: { label: string, description: string, children: React.ReactNode }) => (
        <div className="grid gap-4 p-5 border border-slate-800 rounded-lg bg-slate-950/40 hover:border-slate-700 transition-colors">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1 md:w-1/2">
                    <Label className="text-base font-semibold text-slate-200">{label}</Label>
                    <p className="text-xs text-slate-400 leading-relaxed text-justify">
                        {description}
                    </p>
                </div>
                <div className="md:w-1/2 flex justify-end items-center">
                    {children}
                </div>
            </div>
        </div>
    )

    const CustomSwitch = ({ checked, onCheckedChange, label }: { checked: boolean, onCheckedChange: (c: boolean) => void, label: string }) => (
        <label className="flex items-center cursor-pointer gap-3">
            <span className="text-sm text-slate-300 font-medium">{label}</span>
            <div className="relative">
                <input type="checkbox" className="sr-only" checked={checked} onChange={e => onCheckedChange(e.target.checked)} />
                <div className={cn("w-10 h-6 rounded-full shadow-inner transition-colors", checked ? "bg-green-600" : "bg-slate-700")}></div>
                <div className={cn("absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform", checked && "translate-x-4")}></div>
            </div>
        </label>
    )

    return (
        <div className="container mx-auto p-6 max-w-5xl space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold flex items-center gap-3 text-white">
                    <Settings2 className="w-8 h-8 text-green-500" />
                    Panel de Administración
                </h1>
                <Button onClick={handleSave} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white gap-2">
                    <Save className="w-4 h-4" />
                    {loading ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
            </div>

            {message && (
                <Alert variant={message.type === 'error' ? 'destructive' : 'default'} className={cn(
                    "border-0",
                    message.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-red-500/20 text-red-400 border border-red-500/50'
                )}>
                    {message.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    <AlertTitle>{message.type === 'error' ? 'Error' : 'Éxito'}</AlertTitle>
                    <AlertDescription>{message.text}</AlertDescription>
                </Alert>
            )}

            {/* Tabs Header */}
            <div className="bg-slate-900 border border-slate-800 rounded-t-lg flex overflow-x-auto">
                <TabButton id="general" label="General" icon={Bot} />
                <TabButton id="ai" label="Inteligencia Artificial (IA)" icon={BrainCircuit} />
                <TabButton id="chat" label="Conexión (Chat)" icon={MessageSquare} />
            </div>

            {/* Tabs Content */}
            <div className="bg-slate-900 border border-slate-800 border-t-0 rounded-b-lg p-6 min-h-[400px]">

                {/* --- GENERAL TAB --- */}
                {activeTab === 'general' && (
                    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-200">
                        <div className="grid gap-6">
                            {/* Bot Name */}
                            <div className="grid gap-3 p-4 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors bg-slate-950/50">
                                <Label htmlFor="botName" className="text-base font-semibold text-slate-200">Nombre del Asistente</Label>
                                <div className="grid md:grid-cols-[1fr_300px] gap-4 items-start">
                                    <Input
                                        id="botName"
                                        value={botName}
                                        onChange={e => setBotName(e.target.value)}
                                        placeholder="Ej: JabaBot"
                                        className="h-11 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-green-500"
                                    />
                                    <p className="text-sm text-slate-400 leading-relaxed">
                                        Este parámetro permite personalizar el nombre al asistente y brindarle una identificación única ante tus clientes.
                                    </p>
                                </div>
                            </div>

                            {/* Phone Display */}
                            <div className="grid gap-3 p-4 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors bg-slate-950/50">
                                <Label htmlFor="phoneDisplay" className="text-base font-semibold text-slate-200">Teléfono Visible</Label>
                                <div className="grid md:grid-cols-[1fr_300px] gap-4 items-start">
                                    <Input
                                        id="phoneDisplay"
                                        value={phoneDisplay}
                                        onChange={e => setPhoneDisplay(e.target.value)}
                                        placeholder="+591 00000000"
                                        className="h-11 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-green-500"
                                    />
                                    <p className="text-sm text-slate-400 leading-relaxed">
                                        Permite ingresar información de contacto o identificación telefónica visual del asistente.
                                    </p>
                                </div>
                            </div>

                            {/* Welcome Message */}
                            <div className="grid gap-3 p-4 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors bg-slate-950/50">
                                <Label htmlFor="welcomeMessage" className="text-base font-semibold text-slate-200">Mensaje de bienvenida</Label>
                                <div className="grid md:grid-cols-[1fr_300px] gap-4 items-start">
                                    <textarea
                                        id="welcomeMessage"
                                        value={welcomeMessage}
                                        onChange={e => setWelcomeMessage(e.target.value)}
                                        placeholder="Hola, ¿en qué puedo ayudarte hoy?"
                                        className="min-h-[100px] w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm shadow-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-green-500"
                                    />
                                    <p className="text-sm text-slate-400 leading-relaxed">
                                        Permite personalizar el mensaje inicial que se muestra a los usuarios al iniciar una conversación (si aplica).
                                    </p>
                                </div>
                            </div>

                            {/* Reference (Disabled) */}
                            <div className="grid gap-3 p-4 border border-slate-800 rounded-lg bg-slate-950/30 opacity-60">
                                <Label className="text-base font-semibold text-slate-500">Usar referencia (Opcional)</Label>
                                <div className="grid md:grid-cols-[1fr_300px] gap-4 items-center">
                                    <Input
                                        disabled
                                        placeholder="No seleccionado aún"
                                        className="bg-slate-900 border-slate-800 text-slate-500"
                                    />
                                    <p className="text-sm text-slate-500 leading-relaxed">
                                        Función en desarrollo: Clona configuraciones de otros bots.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- AI TAB --- */}
                {activeTab === 'ai' && (
                    <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-200">
                        {/* Sub-tabs Sidebar */}
                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="w-full md:w-48 flex flex-row md:flex-col border-b md:border-b-0 md:border-r border-slate-800 shrink-0">
                                <SubTabButton id="general" label="General" />
                                <SubTabButton id="text" label="Texto" />
                                <SubTabButton id="audio" label="Audio" />
                            </div>

                            <div className="flex-1 space-y-6">
                                {/* AI > General */}
                                {activeAiTab === 'general' && (
                                    <div className="space-y-4">
                                        <SettingRow label="Estado" description="Establece el estado del asistente. Si está activo, responderá automáticamente. Si está dormido, no procesará mensajes.">
                                            <select
                                                value={aiStatus}
                                                onChange={e => setAiStatus(e.target.value)}
                                                className="h-10 rounded-md border border-slate-700 bg-slate-900 text-white px-3 py-2 text-sm focus-visible:ring-green-500 w-full md:w-48"
                                            >
                                                <option value="active">Activar</option>
                                                <option value="sleep">Dormir</option>
                                            </select>
                                        </SettingRow>

                                        <SettingRow label="Tiempo de respuesta" description="Establece el intervalo de tiempo (segundos) en el que el asistente debe esperar antes de 'escribir' y responder.">
                                            <div className="flex items-center gap-2">
                                                <Button type="button" onClick={() => setResponseDelay(d => Math.max(0, d - 1))} className="h-8 w-8 bg-green-600 border-0 hover:bg-green-700 text-white flex items-center justify-center p-0">-</Button>
                                                <span className="w-8 text-center text-white font-mono">{responseDelay}s</span>
                                                <Button type="button" onClick={() => setResponseDelay(d => d + 1)} className="h-8 w-8 bg-green-600 border-0 hover:bg-green-700 text-white flex items-center justify-center p-0">+</Button>
                                            </div>
                                        </SettingRow>

                                        <SettingRow label="Respuesta del asistente" description="Establece la probabilidad de respuestas en audio vs texto. Más a la derecha = más audios.">
                                            <div className="w-full md:w-64 space-y-2">
                                                <div className="flex justify-between text-xs text-slate-400">
                                                    <span>Texto</span>
                                                    <span>Audio</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    value={audioProbability}
                                                    onChange={e => setAudioProbability(parseInt(e.target.value))}
                                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                                                />
                                                <div className="text-center text-xs text-green-400 font-mono">
                                                    {100 - audioProbability}% Texto / {audioProbability}% Audio
                                                </div>
                                            </div>
                                        </SettingRow>
                                    </div>
                                )}

                                {/* AI > Texto */}
                                {activeAiTab === 'text' && (
                                    <div className="space-y-4">
                                        <SettingRow label="Envío de mensajes" description="Si es 'Completo', se envía todo el bloque. Si es 'Por partes', simula escritura humana fragmentada.">
                                            <select
                                                value={messageDeliveryMode}
                                                onChange={e => setMessageDeliveryMode(e.target.value)}
                                                className="h-10 rounded-md border border-slate-700 bg-slate-900 text-white px-3 py-2 text-sm focus-visible:ring-green-500 w-full md:w-48"
                                            >
                                                <option value="complete">Completo</option>
                                                <option value="parts">Por partes</option>
                                            </select>
                                        </SettingRow>

                                        <SettingRow label="Uso de Emojis" description="Actívalo si deseas que el asistente use emojis en sus respuestas para ser más empático. 😊">
                                            <CustomSwitch label={useEmojis ? "Activado" : "Desactivado"} checked={useEmojis} onCheckedChange={setUseEmojis} />
                                        </SettingRow>

                                        <SettingRow label="Uso de estilos" description="Actívalo para permitir Negrita, Cursiva y Tachado en las respuestas de WhatsApp.">
                                            <CustomSwitch label={useTextStyles ? "Activado" : "Desactivado"} checked={useTextStyles} onCheckedChange={setUseTextStyles} />
                                        </SettingRow>
                                    </div>
                                )}

                                {/* AI > Audio */}
                                {activeAiTab === 'audio' && (
                                    <div className="space-y-4">
                                        <SettingRow label="Voz del audio" description="Selecciona la voz que usará el asistente para generar notas de voz (Google Gemini / TTS).">
                                            <select
                                                value={audioVoiceId}
                                                onChange={e => setAudioVoiceId(e.target.value)}
                                                className="h-10 rounded-md border border-slate-700 bg-slate-900 text-white px-3 py-2 text-sm focus-visible:ring-green-500 w-full md:w-48"
                                            >
                                                <option value="">No seleccionado aún</option>
                                                <option value="es-US-Journey-D">Journey D (Hombre - Google)</option>
                                                <option value="es-US-Journey-F">Journey F (Mujer - Google)</option>
                                                <option value="es-US-Neural2-A">Neural A (Hombre - Google)</option>
                                                <option value="es-US-Neural2-B">Neural B (Hombre - Google)</option>
                                                <option value="es-US-Neural2-C">Neural C (Mujer - Google)</option>
                                            </select>
                                        </SettingRow>

                                        <SettingRow label="Cantidad de audios" description="Límite máximo de audios consecutivos que el asistente puede enviar en una misma conversación.">
                                            <div className="flex items-center gap-2">
                                                <Button type="button" onClick={() => setMaxAudioCount(c => Math.max(0, c - 1))} className="h-8 w-8 bg-green-600 border-0 hover:bg-green-700 text-white flex items-center justify-center p-0">-</Button>
                                                <span className="w-8 text-center text-white font-mono">{maxAudioCount}</span>
                                                <Button type="button" onClick={() => setMaxAudioCount(c => c + 1)} className="h-8 w-8 bg-green-600 border-0 hover:bg-green-700 text-white flex items-center justify-center p-0">+</Button>
                                            </div>
                                        </SettingRow>

                                        <SettingRow label="Responder audio con audio" description="Si se activa, el asistente priorizará responder con notas de voz cuando el usuario le envíe un audio.">
                                            <CustomSwitch label={replyAudioWithAudio ? "Activado" : "Desactivado"} checked={replyAudioWithAudio} onCheckedChange={setReplyAudioWithAudio} />
                                        </SettingRow>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}


                {/* --- CHAT / CONNECTION TAB --- */}
                {activeTab === 'chat' && (
                    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">

                        {/* Connection Status Card */}
                        {(phoneNumberId && accessToken) && (
                            <WhatsAppStatusCard phoneNumberId={phoneNumberId} accessToken={accessToken} />
                        )}

                        {/* Phone Number ID */}
                        <div className="grid gap-4 p-5 border border-slate-800 rounded-lg bg-slate-950/40 hover:border-slate-700 transition-colors">
                            <div className="flex flex-col md:flex-row gap-6 items-start">
                                <div className="space-y-2 md:w-1/3">
                                    <Label htmlFor="phoneId" className="text-base font-semibold text-slate-200">Id. Número de teléfono</Label>
                                </div>
                                <div className="space-y-2 md:w-2/3">
                                    <Input
                                        id="phoneId"
                                        placeholder="Ej: 100468324..."
                                        value={phoneNumberId}
                                        onChange={(e) => setPhoneNumberId(e.target.value)}
                                        className="font-mono bg-slate-900 border-slate-700 text-white"
                                    />
                                    <p className="text-sm text-slate-400 leading-relaxed text-justify">
                                        Valor único asignado a cada número de teléfono registrado en la plataforma de WhatsApp Business API Cloud.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* WABA ID */}
                        <div className="grid gap-4 p-5 border border-slate-800 rounded-lg bg-slate-950/40 hover:border-slate-700 transition-colors">
                            <div className="flex flex-col md:flex-row gap-6 items-start">
                                <div className="space-y-2 md:w-1/3">
                                    <Label htmlFor="wabaId" className="text-base font-semibold text-slate-200">Id. cuenta de WhatsApp Business</Label>
                                </div>
                                <div className="space-y-2 md:w-2/3">
                                    <Input
                                        id="wabaId"
                                        placeholder="Ej: 139568..."
                                        value={wabaId}
                                        onChange={(e) => setWabaId(e.target.value)}
                                        className="font-mono bg-slate-900 border-slate-700 text-white"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* App ID */}
                        <div className="grid gap-4 p-5 border border-slate-800 rounded-lg bg-slate-950/40 hover:border-slate-700 transition-colors">
                            <div className="flex flex-col md:flex-row gap-6 items-start">
                                <div className="space-y-2 md:w-1/3">
                                    <Label htmlFor="appId" className="text-base font-semibold text-slate-200">Id. de la aplicación</Label>
                                </div>
                                <div className="space-y-2 md:w-2/3">
                                    <Input
                                        id="appId"
                                        placeholder="Ej: 64532..."
                                        value={appId}
                                        onChange={(e) => setAppId(e.target.value)}
                                        className="font-mono bg-slate-900 border-slate-700 text-white"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Access Token */}
                        <div className="grid gap-4 p-5 border border-slate-800 rounded-lg bg-slate-950/40 hover:border-slate-700 transition-colors">
                            <div className="flex flex-col md:flex-row gap-6 items-start">
                                <div className="space-y-2 md:w-1/3">
                                    <Label htmlFor="token" className="text-base font-semibold text-slate-200">Token permanente</Label>
                                </div>
                                <div className="space-y-2 md:w-2/3">
                                    <Input
                                        id="token"
                                        type="password"
                                        placeholder="EAAG..."
                                        value={accessToken}
                                        onChange={(e) => setAccessToken(e.target.value)}
                                        className="font-mono bg-slate-900 border-slate-700 text-white"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Webhook Configuration */}
                        <div className="grid gap-4 p-5 border border-slate-800 rounded-lg bg-slate-950/40 hover:border-slate-700 transition-colors">
                            <Label className="text-base font-semibold text-slate-200">Configuración de Webhook</Label>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-300 truncate font-mono">
                                        https://jaba-saas.vercel.app/api/webhook
                                    </div>
                                    <CopyButton text="https://jaba-saas.vercel.app/api/webhook" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-300 truncate font-mono">
                                        {webhookUrl}
                                    </div>
                                    <CopyButton text={webhookUrl} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-300 truncate font-mono">
                                        {webhookToken}
                                    </div>
                                    <CopyButton text={webhookToken} />
                                </div>
                            </div>
                            <p className="text-sm text-slate-400 leading-relaxed text-justify mt-2">
                                Copia estos valores en el Panel de Desarrolladores de Meta.
                            </p>
                        </div>
                    </div>
                )}

            </div>
        </div >
    )
}
