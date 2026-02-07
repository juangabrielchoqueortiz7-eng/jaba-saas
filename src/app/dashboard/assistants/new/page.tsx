'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Save, Bot, MessageSquare, Settings, ChevronDown, Layers, Trash2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createAssistant } from './actions'
import { useRouter } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

export default function NewAssistantPage() {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState('general')
    const [activeAiTab, setActiveAiTab] = useState('general')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    // Separate states for phone composition
    const [countryCode, setCountryCode] = useState('+591')
    const [phoneBody, setPhoneBody] = useState('')

    // Update formData when parts change
    useEffect(() => {
        handleChange('phone_number_display', `${countryCode} ${phoneBody}`)
    }, [countryCode, phoneBody])

    // Form data state
    const [formData, setFormData] = useState({
        // General
        bot_name: '',
        phone_number_display: '',
        welcome_message: '',
        // AI - General
        ai_status: 'active',
        response_delay_seconds: 5,
        audio_probability: 0,
        // AI - Text
        message_delivery_mode: 'complete',
        use_emojis: true,
        use_text_styles: true,
        // AI - Audio
        audio_voice_id: '',
        max_audio_count: 0,
        reply_audio_with_audio: false,
        // Chat
        phone_number_id: '',
        waba_id: '',
        app_id: '',
        access_token: ''
    })

    const handleChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleSave = async () => {
        setLoading(true)
        setMessage(null)

        // Validate General Tab
        if (!formData.bot_name) {
            setMessage({ type: 'error', text: 'El nombre del asistente es obligatorio. Por favor, completa el campo en la pestaña General.' })
            setActiveTab('general')
            setLoading(false)
            return
        }

        // Validate Chat Tab
        if (!formData.phone_number_id || !formData.access_token) {
            setMessage({ type: 'error', text: 'El ID de Teléfono y el Token son obligatorios. Por favor, completa los campos en la pestaña Chat.' })
            setActiveTab('chat')
            setLoading(false)
            return
        }

        const data = new FormData()
        Object.entries(formData).forEach(([key, value]) => {
            data.append(key, String(value))
        })

        const res = await createAssistant(data)

        if (res.success) {
            setMessage({ type: 'success', text: '¡Asistente creado correctamente! Redirigiendo...' })
            setTimeout(() => {
                router.push('/dashboard/assistants')
            }, 1500)
        } else {
            setMessage({ type: 'error', text: res.error || 'Error al guardar el asistente' })
            setLoading(false)
        }
    }

    return (
        <div className="p-8 max-w-6xl mx-auto animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/assistants" className="text-slate-400 hover:text-white transition-colors">
                        <ArrowLeft size={24} />
                    </Link>
                    <h1 className="text-3xl font-bold text-white">Nuevo asistente</h1>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={loading}
                    className="bg-green-500 hover:bg-green-600 text-white font-medium px-6 gap-2"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {loading ? 'Guardando...' : 'Guardar'}
                </Button>
            </div>

            {message && (
                <Alert variant={message.type === 'error' ? 'destructive' : 'default'} className={cn(
                    "mb-6 border-0",
                    message.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-red-500/20 text-red-400 border border-red-500/50'
                )}>
                    {message.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    <AlertTitle>{message.type === 'error' ? 'Error' : 'Éxito'}</AlertTitle>
                    <AlertDescription>{message.text}</AlertDescription>
                </Alert>
            )}

            {/* Tabs */}
            <div className="flex border-b border-slate-800 mb-8">
                <button
                    onClick={() => setActiveTab('general')}
                    className={`flex items-center gap-2 px-8 py-3 font-medium transition-colors border-b-2 ${activeTab === 'general'
                        ? 'border-indigo-500 text-indigo-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                >
                    <Settings size={18} />
                    General
                </button>
                <button
                    onClick={() => setActiveTab('ia')}
                    className={`flex items-center gap-2 px-8 py-3 font-medium transition-colors border-b-2 ${activeTab === 'ia'
                        ? 'border-indigo-500 text-indigo-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                >
                    <Bot size={18} />
                    IA
                </button>
                <button
                    onClick={() => setActiveTab('chat')}
                    className={`flex items-center gap-2 px-8 py-3 font-medium transition-colors border-b-2 ${activeTab === 'chat'
                        ? 'border-indigo-500 text-indigo-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                >
                    <MessageSquare size={18} />
                    Chat
                </button>
            </div>

            {/* Content */}
            <div className="bg-white rounded-xl p-8 shadow-sm text-slate-900 min-h-[600px]">
                {activeTab === 'general' && (
                    <div className="space-y-10 max-w-4xl">

                        {/* Name Field */}
                        <div className="grid grid-cols-[200px_1fr] gap-12 items-start">
                            <div>
                                <Label htmlFor="name" className="text-base font-bold text-slate-900">Nombre *</Label>
                            </div>
                            <div className="space-y-2">
                                <Input
                                    id="name"
                                    value={formData.bot_name}
                                    onChange={(e) => handleChange('bot_name', e.target.value)}
                                    placeholder="Ej: JabaBot"
                                    className="bg-slate-50 border-slate-200 focus-visible:ring-indigo-500"
                                />
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    Este parámetro permite personalizar el nombre al asistente y brindarle una identificación única.
                                </p>
                            </div>
                        </div>

                        <div className="border-t border-slate-100"></div>

                        {/* Phone Field */}
                        <div className="grid grid-cols-[200px_1fr] gap-12 items-start">
                            <div>
                                <Label htmlFor="phone" className="text-base font-bold text-slate-900">Teléfono Visible</Label>
                            </div>
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <div className="w-[110px]">
                                        <Select value={countryCode} onValueChange={setCountryCode}>
                                            <SelectTrigger className="bg-slate-50 border-slate-200">
                                                <SelectValue placeholder="Código" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="+54">🇦🇷 +54</SelectItem>
                                                <SelectItem value="+591">🇧🇴 +591</SelectItem>
                                                <SelectItem value="+55">🇧🇷 +55</SelectItem>
                                                <SelectItem value="+56">🇨🇱 +56</SelectItem>
                                                <SelectItem value="+57">🇨🇴 +57</SelectItem>
                                                <SelectItem value="+593">🇪🇨 +593</SelectItem>
                                                <SelectItem value="+52">🇲🇽 +52</SelectItem>
                                                <SelectItem value="+51">🇵🇪 +51</SelectItem>
                                                <SelectItem value="+1">🇺🇸 +1</SelectItem>
                                                <SelectItem value="+34">🇪🇸 +34</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Input
                                        id="phone"
                                        value={phoneBody}
                                        onChange={(e) => setPhoneBody(e.target.value)}
                                        placeholder="Ej: 693..."
                                        className="bg-slate-50 border-slate-200 flex-1 focus-visible:ring-indigo-500"
                                    />
                                </div>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    Permite ingresar información de contacto o identificación telefónica al asistente.
                                </p>
                            </div>
                        </div>

                        <div className="border-t border-slate-100"></div>

                        {/* Welcome Message */}
                        <div className="grid grid-cols-[200px_1fr] gap-12 items-start">
                            <div>
                                <Label htmlFor="welcome" className="text-base font-bold text-slate-900">Mensaje de bienvenida</Label>
                            </div>
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <Input
                                        id="welcome"
                                        value={formData.welcome_message}
                                        onChange={(e) => handleChange('welcome_message', e.target.value)}
                                        placeholder="Hola, ¿en qué puedo ayudarte?"
                                        className="bg-slate-50 border-slate-200 flex-1 focus-visible:ring-indigo-500"
                                    />
                                    <button className="px-3 border border-slate-200 bg-slate-100 rounded-md text-slate-500 hover:bg-slate-200 transition-colors">
                                        <Layers size={18} />
                                    </button>
                                </div>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    Permite personalizar el mensaje inicial que se muestra a los usuarios al iniciar una conversación.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'ia' && (
                    <div className="flex flex-col md:flex-row gap-8 min-h-[500px]">
                        {/* Sub-tabs Sidebar */}
                        <div className="w-full md:w-48 flex flex-row md:flex-col border-b md:border-b-0 md:border-r border-slate-100 shrink-0 gap-2">
                            {['General', 'Texto', 'Audio'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveAiTab(tab.toLowerCase())}
                                    className={`px-4 py-2 text-sm font-medium transition-colors rounded-md text-left ${activeAiTab === tab.toLowerCase()
                                        ? "bg-green-50 text-green-600"
                                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                                        }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 space-y-6">
                            {/* AI > General */}
                            {activeAiTab === 'general' && (
                                <div className="space-y-6">
                                    {/* Estado */}
                                    <div className="grid grid-cols-[1fr_1.5fr] gap-8 p-6 border border-slate-200 rounded-lg">
                                        <div className="space-y-4">
                                            <Label className="text-base font-bold text-slate-900">Estado</Label>
                                            <select
                                                value={formData.ai_status}
                                                onChange={(e) => handleChange('ai_status', e.target.value)}
                                                className="w-full h-10 rounded-md border border-slate-200 bg-white text-slate-800 px-3 py-2 text-sm focus-visible:ring-indigo-500"
                                            >
                                                <option value="active">Activar</option>
                                                <option value="sleep">Dormir</option>
                                            </select>
                                        </div>
                                        <p className="text-sm text-slate-500 leading-relaxed pt-1">
                                            Establece el estado del asistente, si está activo el asistente responderá todos los mensajes automáticamente.
                                        </p>
                                    </div>

                                    {/* Tiempo de respuesta */}
                                    <div className="grid grid-cols-[1fr_1.5fr] gap-8 p-6 border border-slate-200 rounded-lg">
                                        <div className="space-y-4">
                                            <Label className="text-base font-bold text-slate-900">Tiempo de respuesta</Label>
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => handleChange('response_delay_seconds', Math.max(0, formData.response_delay_seconds - 1))} className="w-8 h-8 flex items-center justify-center bg-green-500 hover:bg-green-600 text-white rounded font-bold transition-colors">-</button>
                                                <span className="text-slate-700 font-medium">{formData.response_delay_seconds}s</span>
                                                <button onClick={() => handleChange('response_delay_seconds', formData.response_delay_seconds + 1)} className="w-8 h-8 flex items-center justify-center bg-green-500 hover:bg-green-600 text-white rounded font-bold transition-colors">+</button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Respuesta del asistente */}
                                    <div className="grid grid-cols-[1fr_1.5fr] gap-8 p-6 border border-slate-200 rounded-lg">
                                        <div className="space-y-4">
                                            <Label className="text-base font-bold text-slate-900">Respuesta del asistente</Label>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs text-slate-600 font-medium">
                                                    <span>Texto</span>
                                                    <span>Audio</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0" max="100"
                                                    value={formData.audio_probability}
                                                    onChange={(e) => handleChange('audio_probability', parseInt(e.target.value))}
                                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                />
                                                <div className="flex justify-between text-xs font-bold text-slate-800">
                                                    <span>{100 - formData.audio_probability}%</span>
                                                    <span>{formData.audio_probability}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* AI > Texto */}
                            {activeAiTab === 'texto' && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-[1fr_1.5fr] gap-8 p-6 border border-slate-200 rounded-lg">
                                        <div className="space-y-4">
                                            <Label className="text-base font-bold text-slate-900">Envio de mensajes</Label>
                                            <select
                                                value={formData.message_delivery_mode}
                                                onChange={(e) => handleChange('message_delivery_mode', e.target.value)}
                                                className="w-full h-10 rounded-md border border-slate-200 bg-white text-slate-800 px-3 py-2 text-sm focus-visible:ring-indigo-500"
                                            >
                                                <option value="complete">Completo</option>
                                                <option value="parts">Por partes</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* AI > Audio */}
                            {activeAiTab === 'audio' && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-[1fr_1.5fr] gap-8 p-6 border border-slate-200 rounded-lg">
                                        <div className="space-y-4">
                                            <Label className="text-base font-bold text-slate-900">Voz del audio</Label>
                                            <select
                                                value={formData.audio_voice_id}
                                                onChange={(e) => handleChange('audio_voice_id', e.target.value)}
                                                className="w-full h-10 rounded-md border border-slate-200 bg-white text-slate-800 px-3 py-2 text-sm focus-visible:ring-indigo-500"
                                            >
                                                <option value="">No seleccionado aún</option>
                                                <option value="es-US-Journey-D">Journey D (Hombre - Google)</option>
                                                <option value="es-US-Journey-F">Journey F (Mujer - Google)</option>
                                                <option value="es-US-Neural2-A">Neural A (Hombre - Google)</option>
                                                <option value="es-US-Neural2-B">Neural B (Hombre - Google)</option>
                                                <option value="es-US-Neural2-C">Neural C (Mujer - Google)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                )}

                {activeTab === 'chat' && (
                    <div className="flex flex-col md:flex-row gap-8 min-h-[500px]">
                        {/* Sub-tabs Sidebar (Connection Types) */}
                        <div className="w-full md:w-48 flex flex-row md:flex-col border-b md:border-b-0 md:border-r border-slate-100 shrink-0 gap-2">
                            <button
                                className="px-4 py-2 text-sm font-medium transition-colors rounded-md text-left bg-green-500 text-white shadow-sm flex items-center gap-2"
                            >
                                <MessageSquare size={16} />
                                WhatsApp
                            </button>
                        </div>

                        <div className="flex-1 space-y-6">

                            {/* Phone Number ID */}
                            <div className="p-6 border border-slate-200 rounded-lg grid grid-cols-[200px_300px_1fr] gap-8 items-start">
                                <Label htmlFor="phoneId" className="text-sm font-bold text-slate-900 pt-2">Id. Número de teléfono *</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="phoneId"
                                        value={formData.phone_number_id}
                                        onChange={(e) => handleChange('phone_number_id', e.target.value)}
                                        placeholder="Ej: 10046..."
                                        className="bg-white border-slate-200"
                                    />
                                    <button className="p-2 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-500 transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 leading-relaxed text-justify">
                                    Valor único asignado a cada número de teléfono registrado en la plataforma de WhatsApp Business API Cloud.
                                </p>
                            </div>

                            {/* WABA ID */}
                            <div className="p-6 border border-slate-200 rounded-lg grid grid-cols-[200px_300px_1fr] gap-8 items-start">
                                <Label htmlFor="wabaId" className="text-sm font-bold text-slate-900 pt-2">Id. cuenta de WhatsApp Business</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="wabaId"
                                        value={formData.waba_id}
                                        onChange={(e) => handleChange('waba_id', e.target.value)}
                                        placeholder=""
                                        className="bg-white border-slate-200"
                                    />
                                    <button className="p-2 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-500 transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 leading-relaxed text-justify">
                                    Identificador de la cuenta de WhatsApp Business.
                                </p>
                            </div>

                            {/* App ID */}
                            <div className="p-6 border border-slate-200 rounded-lg grid grid-cols-[200px_300px_1fr] gap-8 items-start">
                                <Label htmlFor="appId" className="text-sm font-bold text-slate-900 pt-2">Id. de la aplicación de Meta</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="appId"
                                        value={formData.app_id}
                                        onChange={(e) => handleChange('app_id', e.target.value)}
                                        placeholder=""
                                        className="bg-white border-slate-200"
                                    />
                                    <button className="p-2 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-500 transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 leading-relaxed text-justify">
                                    Identificador de la aplicación de Meta.
                                </p>
                            </div>

                            {/* Token */}
                            <div className="p-6 border border-slate-200 rounded-lg grid grid-cols-[200px_300px_1fr] gap-8 items-start">
                                <Label htmlFor="token" className="text-sm font-bold text-slate-900 pt-2">Token permanente *</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="token"
                                        type="password"
                                        value={formData.access_token}
                                        onChange={(e) => handleChange('access_token', e.target.value)}
                                        placeholder="EAAG..."
                                        className="bg-white border-slate-200"
                                    />
                                    <button className="p-2 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-500 transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 leading-relaxed text-justify">
                                    Token permanente de acceso.
                                </p>
                            </div>

                            {/* Webhook - Static Info */}
                            <div className="p-6 border border-slate-200 rounded-lg">
                                <Label className="text-sm font-bold text-slate-900 mb-4 block">Configuración de Webhook</Label>

                                <div className="flex gap-4 mb-4">
                                    <div className="flex-1 flex gap-2">
                                        <Input value="https://jaba-saas.vercel.app/api/webhook" readOnly className="bg-slate-50 border-slate-200 text-slate-600 font-mono text-xs" />
                                    </div>
                                    <div className="w-1/3 flex gap-2">
                                        <Input value="jaba_verify_token" readOnly className="bg-slate-50 border-slate-200 text-slate-600 font-mono text-xs" />
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
