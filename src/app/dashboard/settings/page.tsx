
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

import { checkWhatsAppStatus, getSystemConfig, requestWhatsAppCode, verifyWhatsAppCode, registerWhatsAppNumber, testWebhook, sendTestWhatsAppMessage } from './actions'
import { Smartphone, RefreshCw, X, Wifi, Send as SendIcon, FlaskConical } from "lucide-react"

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
                                <td className="p-4 p-4 font-medium text-slate-300">
                                    <div className="flex flex-col">
                                        <span>{status.verified_name || 'No verificado'}</span>
                                        {status.name_status && (
                                            <span className="text-[10px] uppercase text-slate-500">{status.name_status}</span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="bg-slate-800 px-3 py-1 rounded-full text-xs font-medium text-slate-300 border border-slate-700 w-fit">
                                            {status.status === 'VERIFIED' ? 'Conectado' : 'Pendiente'}
                                        </span>
                                        {status.health_status && (
                                            <span className="text-[10px] text-slate-500 uppercase">{status.health_status}</span>
                                        )}
                                    </div>
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

                {/* Registration Action if not connected */}
                {(status.status !== 'VERIFIED' || status.requires_registration) && (
                    <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
                        <div className="text-sm text-slate-400">
                            ¿Tu número está "Pendiente" o bloqueado? Necesitas completar el registro.
                        </div>
                        <RegistrationModal phoneNumberId={phoneNumberId} accessToken={accessToken} onSuccess={checkStatus} />
                    </div>
                )}
            </div>
        )
    }

    const RegistrationModal = ({ phoneNumberId, accessToken, onSuccess }: { phoneNumberId: string, accessToken: string, onSuccess: () => void }) => {
        const [open, setOpen] = useState(false)
        const [step, setStep] = useState<'request' | 'verify' | 'register'>('request')
        const [loading, setLoading] = useState(false)
        const [code, setCode] = useState('')
        const [pin, setPin] = useState('')
        const [error, setError] = useState('')

        const handleRequestCode = async () => {
            setLoading(true)
            setError('')
            const res = await requestWhatsAppCode(phoneNumberId, accessToken)
            setLoading(false)
            if (res.success) {
                setStep('verify')
            } else {
                setError(res.error || 'Error solicitando código')
            }
        }

        const handleVerifyCode = async () => {
            setLoading(true)
            setError('')
            const res = await verifyWhatsAppCode(phoneNumberId, accessToken, code)
            setLoading(false)
            if (res.success) {
                // Verification successful, move to register step with PIN
                setStep('register')
                // Pre-fill PIN with the verification code as fallback/convenience
                setPin(code)
            } else {
                setError(res.error || 'Error verificando código')
            }
        }

        const handleRegister = async () => {
            setLoading(true)
            setError('')
            const res = await registerWhatsAppNumber(phoneNumberId, accessToken, pin)
            setLoading(false)
            if (res.success) {
                setOpen(false)
                onSuccess()
                setStep('request')
                setCode('')
                setPin('')
            } else {
                setError(res.error || 'Error en el registro final')
            }
        }

        if (!open) return (
            <Button onClick={() => setOpen(true)} className="gap-2 bg-slate-800 hover:bg-slate-700 text-white">
                <Smartphone size={16} />
                Completar Registro
            </Button>
        )

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-lg w-full max-w-md overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
                    <button
                        onClick={() => setOpen(false)}
                        className="absolute right-4 top-4 text-slate-400 hover:text-white"
                    >
                        <X size={20} />
                    </button>

                    <div className="p-6 border-b border-slate-800">
                        <h2 className="text-lg font-semibold text-white">Registro de WhatsApp API</h2>
                        <p className="text-sm text-slate-400 mt-1">
                            {step === 'register' ? 'Paso Final: Activar Número' : 'Para activar tu número, Meta requiere verificarlo mediante un código SMS.'}
                        </p>
                    </div>

                    <div className="p-6 space-y-4">
                        {error && (
                            <div className="p-3 bg-red-900/20 border border-red-800/50 rounded-md text-red-400 text-sm flex items-center gap-2">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}

                        {step === 'request' && (
                            <div className="space-y-4">
                                <p className="text-sm text-slate-300">
                                    Al continuar, Meta enviará un SMS con un código de 6 dígitos a tu número. Asegúrate de tener señal.
                                </p>
                                <Button onClick={handleRequestCode} disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white">
                                    {loading ? <RefreshCw className="animate-spin mr-2 h-4 w-4" /> : null}
                                    Enviar SMS de Verificación
                                </Button>
                            </div>
                        )}

                        {step === 'verify' && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-white">Código de Verificación (SMS)</Label>
                                    <Input
                                        value={code}
                                        onChange={e => setCode(e.target.value)}
                                        placeholder="123456"
                                        className="bg-slate-950 border-slate-800 text-center text-lg tracking-widest text-white"
                                        maxLength={6}
                                    />
                                </div>
                                <Button onClick={handleVerifyCode} disabled={loading || code.length < 6} className="w-full bg-green-600 hover:bg-green-700 text-white">
                                    {loading ? <RefreshCw className="animate-spin mr-2 h-4 w-4" /> : null}
                                    Verificar Código
                                </Button>
                                <Button onClick={() => setStep('request')} className="w-full text-slate-400 hover:text-white bg-transparent hover:bg-slate-800">
                                    Volver / Reenviar SMS
                                </Button>
                            </div>
                        )}

                        {step === 'register' && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-white">PIN de Registro (2FA)</Label>
                                    <p className="text-xs text-slate-400 mb-2">
                                        Ingresa un PIN de 6 dígitos para proteger tu línea. Hemos prellenado el código SMS por defecto.
                                    </p>
                                    <Input
                                        value={pin}
                                        onChange={e => setPin(e.target.value)}
                                        placeholder="123456"
                                        className="bg-slate-950 border-slate-800 text-center text-lg tracking-widest text-white"
                                        maxLength={6}
                                    />
                                </div>
                                <Button onClick={handleRegister} disabled={loading || pin.length < 6} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                                    {loading ? <RefreshCw className="animate-spin mr-2 h-4 w-4" /> : null}
                                    Completar Registro Final
                                </Button>
                            </div>
                        )}
                    </div>
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
    const [serviceName, setServiceName] = useState('')
    const [serviceDescription, setServiceDescription] = useState('')
    const [promoImageUrl, setPromoImageUrl] = useState('')
    const [promoLocalPreview, setPromoLocalPreview] = useState('')
    const [promoUploading, setPromoUploading] = useState(false)
    const [promoDragging, setPromoDragging] = useState(false)

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

    // Test webhook state
    const [webhookTestLoading, setWebhookTestLoading] = useState(false)
    const [webhookTestResult, setWebhookTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

    // Test message state
    const [testPhone, setTestPhone] = useState('')
    const [testMsgLoading, setTestMsgLoading] = useState(false)
    const [testMsgResult, setTestMsgResult] = useState<{ ok: boolean; msg: string } | null>(null)

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
                setWabaId(data.waba_id || '')
                setAppId(data.app_id || '')
                setAccessToken(data.access_token || '')

                // General Config
                setBotName(data.bot_name || 'Mi Asistente')
                setPhoneDisplay(data.phone_number_display || '')
                setWelcomeMessage(data.welcome_message || '')
                setServiceName(data.service_name || '')
                setServiceDescription(data.service_description || '')
                setPromoImageUrl(data.promo_image_url || '')
                setPromoLocalPreview(data.promo_image_url || '')

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
                service_name: serviceName || null,
                service_description: serviceDescription || null,
                promo_image_url: promoImageUrl || null,

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

    // Subir imagen de precios — muestra preview local inmediata, sube en background
    const handlePromoUpload = async (file: File) => {
        // 1. Preview local inmediata
        const localUrl = URL.createObjectURL(file)
        setPromoLocalPreview(localUrl)
        setPromoUploading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            const ext = file.name.split('.').pop()
            const path = `promo/${user?.id}_${Date.now()}.${ext}`
            const { error: upErr } = await supabase.storage.from('assets').upload(path, file, { upsert: true })
            if (upErr) throw upErr
            const { data: pub } = supabase.storage.from('assets').getPublicUrl(path)
            setPromoImageUrl(pub.publicUrl)
            setPromoLocalPreview(pub.publicUrl)
            URL.revokeObjectURL(localUrl)
        } catch (err: any) {
            // Si falla el upload, mantener preview local pero avisar que no se guardó
            setMessage({ type: 'error', text: `No se pudo subir la imagen al servidor: ${err.message}. Asegúrate de haber creado el bucket "assets" en Supabase Storage (público).` })
            // Dejar la preview local visible para que el usuario vea su imagen
        } finally {
            setPromoUploading(false)
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
                    ? "border-[#6366f1] text-[#6366f1] bg-[rgba(99,102,241,0.1)]"
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
                    ? "border-[#6366f1] text-[#6366f1] bg-[rgba(99,102,241,0.1)]"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            )}
        >
            {label}
        </button>
    )

    const SettingRow = ({ label, description, children }: { label: string, description: string, children: React.ReactNode }) => (
        <div className="grid gap-4 p-5 border border-white/[0.06] rounded-lg bg-[#0f1120] hover:border-white/[0.1] transition-colors">
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
                <h1 className="text-3xl font-bold flex items-center gap-3 text-[#eef0ff]">
                    <Settings2 className="w-8 h-8 text-[#6366f1]" />
                    Panel de Administración
                </h1>
                <Button onClick={handleSave} disabled={loading} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white gap-2">
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
            <div className="bg-[#13152a] border border-white/[0.06] rounded-t-lg flex overflow-x-auto">
                <TabButton id="general" label="General" icon={Bot} />
                <TabButton id="ai" label="Inteligencia Artificial (IA)" icon={BrainCircuit} />
                <TabButton id="chat" label="Conexión (Chat)" icon={MessageSquare} />
            </div>

            {/* Tabs Content */}
            <div className="bg-[#13152a] border border-white/[0.06] border-t-0 rounded-b-lg p-6 min-h-[400px]">

                {/* --- GENERAL TAB --- */}
                {activeTab === 'general' && (
                    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-200">
                        <div className="grid gap-6">
                            {/* Bot Name */}
                            <div className="grid gap-3 p-4 border border-white/[0.06] rounded-lg hover:border-white/[0.1] transition-colors bg-[#0f1120]">
                                <Label htmlFor="botName" className="text-base font-semibold text-slate-200">Nombre del Asistente</Label>
                                <div className="grid md:grid-cols-[1fr_300px] gap-4 items-start">
                                    <Input
                                        id="botName"
                                        value={botName}
                                        onChange={e => setBotName(e.target.value)}
                                        placeholder="Ej: JabaBot"
                                        className="h-11 bg-[#0f1120] border-white/[0.08] text-[#eef0ff] placeholder:text-slate-500 focus-visible:ring-[#6366f1]"
                                    />
                                    <p className="text-sm text-slate-400 leading-relaxed">
                                        Este parámetro permite personalizar el nombre al asistente y brindarle una identificación única ante tus clientes.
                                    </p>
                                </div>
                            </div>

                            {/* Phone Display */}
                            <div className="grid gap-3 p-4 border border-white/[0.06] rounded-lg hover:border-white/[0.1] transition-colors bg-[#0f1120]">
                                <Label htmlFor="phoneDisplay" className="text-base font-semibold text-slate-200">Teléfono Visible</Label>
                                <div className="grid md:grid-cols-[1fr_300px] gap-4 items-start">
                                    <Input
                                        id="phoneDisplay"
                                        value={phoneDisplay}
                                        onChange={e => setPhoneDisplay(e.target.value)}
                                        placeholder="+591 00000000"
                                        className="h-11 bg-[#0f1120] border-white/[0.08] text-[#eef0ff] placeholder:text-slate-500 focus-visible:ring-[#6366f1]"
                                    />
                                    <p className="text-sm text-slate-400 leading-relaxed">
                                        Permite ingresar información de contacto o identificación telefónica visual del asistente.
                                    </p>
                                </div>
                            </div>

                            {/* Welcome Message */}
                            <div className="grid gap-3 p-4 border border-white/[0.06] rounded-lg hover:border-white/[0.1] transition-colors bg-[#0f1120]">
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

                            {/* Service Name */}
                            <div className="grid gap-3 p-4 border border-white/[0.06] rounded-lg hover:border-white/[0.1] transition-colors bg-[#0f1120]">
                                <Label htmlFor="serviceName" className="text-base font-semibold text-slate-200">Nombre del servicio</Label>
                                <div className="grid md:grid-cols-[1fr_300px] gap-4 items-start">
                                    <Input
                                        id="serviceName"
                                        value={serviceName}
                                        onChange={e => setServiceName(e.target.value)}
                                        placeholder="Ej: Canva Pro, Gym Premium, Academia Virtual"
                                        className="h-11 bg-[#0f1120] border-white/[0.08] text-[#eef0ff] placeholder:text-slate-500 focus-visible:ring-[#6366f1]"
                                    />
                                    <p className="text-sm text-slate-400 leading-relaxed">
                                        El nombre del servicio que vendes. Se usará en los mensajes del bot y recordatorios. Ej: "Canva Pro", "Netflix Premium".
                                    </p>
                                </div>
                            </div>

                            {/* Service Description */}
                            <div className="grid gap-3 p-4 border border-white/[0.06] rounded-lg hover:border-white/[0.1] transition-colors bg-[#0f1120]">
                                <Label htmlFor="serviceDescription" className="text-base font-semibold text-slate-200">Descripción del servicio</Label>
                                <div className="grid md:grid-cols-[1fr_300px] gap-4 items-start">
                                    <textarea
                                        id="serviceDescription"
                                        value={serviceDescription}
                                        onChange={e => setServiceDescription(e.target.value)}
                                        placeholder="Ej: acceso ilimitado a diseño profesional con plantillas premium, IA para diseños y más"
                                        className="min-h-[80px] w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm shadow-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-green-500"
                                    />
                                    <p className="text-sm text-slate-400 leading-relaxed">
                                        Descripción breve de lo que ofreces. Se usará en el saludo del bot cuando un nuevo cliente escribe.
                                    </p>
                                </div>
                            </div>

                            {/* Promo Image - Drag & Drop Upload */}
                            <div className="grid gap-3 p-4 border border-white/[0.06] rounded-lg hover:border-white/[0.1] transition-colors bg-[#0f1120]">
                                <Label className="text-base font-semibold text-slate-200">Imagen de precios</Label>
                                <div className="grid md:grid-cols-[1fr_300px] gap-4 items-start">
                                    <div className="space-y-3">
                                        {(promoImageUrl || promoLocalPreview) ? (
                                            /* Vista previa con botón eliminar */
                                            <div className="space-y-2">
                                                <div className="relative inline-block">
                                                    <img
                                                        src={promoLocalPreview || promoImageUrl}
                                                        alt="Imagen de precios"
                                                        className="max-h-56 w-full rounded-xl border border-slate-700 object-contain bg-slate-900"
                                                    />
                                                    {promoUploading && (
                                                        <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center gap-2">
                                                            <RefreshCw className="w-6 h-6 text-green-400 animate-spin" />
                                                            <span className="text-xs text-slate-300">Guardando imagen...</span>
                                                        </div>
                                                    )}
                                                    {!promoUploading && (
                                                        <button
                                                            type="button"
                                                            onClick={() => { setPromoImageUrl(''); setPromoLocalPreview('') }}
                                                            className="absolute -top-2 -right-2 w-7 h-7 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-xl transition-colors z-10"
                                                            title="Eliminar imagen"
                                                        >
                                                            ✕
                                                        </button>
                                                    )}
                                                </div>
                                                {promoImageUrl && (
                                                    <p className="text-xs text-green-500 flex items-center gap-1">
                                                        <CheckCircle2 className="w-3 h-3" /> Imagen guardada correctamente
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            /* Zona drag & drop */
                                            <label
                                                htmlFor="promoImageFile"
                                                className={`flex flex-col items-center justify-center gap-3 p-10 border-2 border-dashed rounded-xl cursor-pointer transition-all ${promoDragging
                                                    ? 'border-green-500 bg-green-500/10 scale-[1.01]'
                                                    : 'border-slate-700 hover:border-green-600/50 hover:bg-slate-900 bg-slate-950'
                                                    }`}
                                                onDragOver={e => { e.preventDefault(); setPromoDragging(true) }}
                                                onDragLeave={() => setPromoDragging(false)}
                                                onDrop={async e => {
                                                    e.preventDefault()
                                                    setPromoDragging(false)
                                                    const file = e.dataTransfer.files?.[0]
                                                    if (!file || !file.type.startsWith('image/')) return
                                                    await handlePromoUpload(file)
                                                }}
                                            >
                                                <input
                                                    id="promoImageFile"
                                                    type="file"
                                                    accept="image/*"
                                                    className="sr-only"
                                                    onChange={async e => {
                                                        const file = e.target.files?.[0]
                                                        if (!file) return
                                                        await handlePromoUpload(file)
                                                        e.target.value = ''
                                                    }}
                                                />
                                                <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-3xl">
                                                    🖼️
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-sm font-semibold text-slate-200">Arrastra tu imagen aquí</p>
                                                    <p className="text-xs text-slate-500 mt-1">o haz clic para seleccionar</p>
                                                    <p className="text-xs text-slate-600 mt-2">JPG · PNG · WEBP</p>
                                                </div>
                                            </label>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-400 leading-relaxed">
                                        Imagen con tus precios que se envía automáticamente al cliente cuando solicita información. Usa JPG o PNG de buena calidad. Puedes eliminarla y cambiarla cuando quieras.
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
                        <div className="grid gap-4 p-5 border border-white/[0.06] rounded-lg bg-[#0f1120] hover:border-white/[0.1] transition-colors">
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
                        <div className="grid gap-4 p-5 border border-white/[0.06] rounded-lg bg-[#0f1120] hover:border-white/[0.1] transition-colors">
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
                        <div className="grid gap-4 p-5 border border-white/[0.06] rounded-lg bg-[#0f1120] hover:border-white/[0.1] transition-colors">
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
                        <div className="grid gap-4 p-5 border border-white/[0.06] rounded-lg bg-[#0f1120] hover:border-white/[0.1] transition-colors">
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
                        <div className="grid gap-4 p-5 border border-white/[0.06] rounded-lg bg-[#0f1120] hover:border-white/[0.1] transition-colors">
                            <div className="flex items-center justify-between">
                                <Label className="text-base font-semibold text-slate-200">Configuración de Webhook</Label>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        setWebhookTestLoading(true)
                                        setWebhookTestResult(null)
                                        const res = await testWebhook(webhookUrl, webhookToken)
                                        setWebhookTestResult({ ok: res.success, msg: res.success ? '✅ Webhook responde correctamente' : `❌ ${res.error}` })
                                        setWebhookTestLoading(false)
                                    }}
                                    disabled={webhookTestLoading || webhookToken === 'Cargando...'}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 transition-colors disabled:opacity-40"
                                >
                                    {webhookTestLoading
                                        ? <RefreshCw size={13} className="animate-spin" />
                                        : <Wifi size={13} />
                                    }
                                    Probar Webhook
                                </button>
                            </div>

                            {webhookTestResult && (
                                <div className={cn(
                                    'px-3 py-2 rounded-lg text-sm font-medium border',
                                    webhookTestResult.ok
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                        : 'bg-red-500/10 border-red-500/30 text-red-400'
                                )}>
                                    {webhookTestResult.msg}
                                </div>
                            )}

                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">URL del Webhook</p>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-300 truncate font-mono">
                                            {webhookUrl}
                                        </div>
                                        <CopyButton text={webhookUrl} />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Token de verificación</p>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-300 truncate font-mono">
                                            {webhookToken}
                                        </div>
                                        <CopyButton text={webhookToken} />
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                Copia estos valores en el Panel de Desarrolladores de Meta → WhatsApp → Configuración → Webhooks.
                            </p>
                        </div>

                        {/* Enviar mensaje de prueba */}
                        <div className="grid gap-4 p-5 border border-white/[0.06] rounded-lg bg-[#0f1120] hover:border-white/[0.1] transition-colors">
                            <div className="flex items-center gap-2">
                                <FlaskConical size={16} className="text-amber-400" />
                                <Label className="text-base font-semibold text-slate-200">Enviar mensaje de prueba</Label>
                            </div>
                            <p className="text-sm text-slate-400">
                                Verifica que tu token y número estén funcionando enviando un WhatsApp de prueba.
                            </p>
                            <div className="flex gap-3 items-start">
                                <div className="flex-1">
                                    <Input
                                        placeholder="Ej: 59170000000"
                                        value={testPhone}
                                        onChange={e => setTestPhone(e.target.value)}
                                        className="font-mono bg-slate-900 border-slate-700 text-white placeholder:text-slate-600"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">Número con código de país (sin + ni espacios)</p>
                                </div>
                                <Button
                                    type="button"
                                    disabled={testMsgLoading || !phoneNumberId || !accessToken || !testPhone.trim()}
                                    onClick={async () => {
                                        setTestMsgLoading(true)
                                        setTestMsgResult(null)
                                        const res = await sendTestWhatsAppMessage(phoneNumberId, accessToken, testPhone.trim())
                                        setTestMsgResult({
                                            ok: res.success,
                                            msg: res.success
                                                ? `✅ Mensaje enviado (ID: ${(res as any).messageId || 'ok'})`
                                                : `❌ ${(res as any).error}`
                                        })
                                        setTestMsgLoading(false)
                                    }}
                                    className="bg-amber-600 hover:bg-amber-700 text-white gap-2 shrink-0"
                                >
                                    {testMsgLoading
                                        ? <RefreshCw size={14} className="animate-spin" />
                                        : <SendIcon size={14} />
                                    }
                                    Enviar prueba
                                </Button>
                            </div>
                            {testMsgResult && (
                                <div className={cn(
                                    'px-3 py-2 rounded-lg text-sm font-medium border',
                                    testMsgResult.ok
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                        : 'bg-red-500/10 border-red-500/30 text-red-400'
                                )}>
                                    {testMsgResult.msg}
                                </div>
                            )}
                            {(!phoneNumberId || !accessToken) && (
                                <p className="text-xs text-amber-500/70">⚠️ Guarda primero las credenciales (Phone ID + Token) para habilitar esta función.</p>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div >
    )
}
