'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Clock, Globe, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { upsertSchedulingConfig, getUserSchedulingConfig } from '@/lib/db/scheduling'
import { COMMON_TIMEZONES, getLocalTime } from '@/lib/timezone-utils'
import { SchedulingConfig } from '@/lib/db/scheduling'

export default function SchedulingPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [userId, setUserId] = useState<string>('')

  const [config, setConfig] = useState<SchedulingConfig | null>(null)
  const [formData, setFormData] = useState({
    timezone: 'America/La_Paz',
    reminder_hour: 9,
    followup_hour: 18,
    urgency_hour: 9,
  })

  // Cargar configuración inicial
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setError('No se pudo identificar al usuario')
          setLoading(false)
          return
        }

        setUserId(user.id)

        const existingConfig = await getUserSchedulingConfig(supabase, user.id)
        if (existingConfig) {
          setConfig(existingConfig)
          setFormData({
            timezone: existingConfig.timezone || 'America/La_Paz',
            reminder_hour: existingConfig.reminder_hour ?? 9,
            followup_hour: existingConfig.followup_hour ?? 18,
            urgency_hour: existingConfig.urgency_hour ?? 9,
          })
        }
      } catch (err) {
        console.error('Error loading config:', err)
        setError('Error al cargar la configuración')
      } finally {
        setLoading(false)
      }
    }

    loadConfig()
  }, [supabase])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess(false)

    try {
      if (!userId) {
        throw new Error('Usuario no identificado')
      }

      // Validar horas
      if (
        formData.reminder_hour < 0 ||
        formData.reminder_hour > 23 ||
        formData.followup_hour < 0 ||
        formData.followup_hour > 23 ||
        formData.urgency_hour < 0 ||
        formData.urgency_hour > 23
      ) {
        throw new Error('Las horas deben estar entre 0 y 23')
      }

      await upsertSchedulingConfig(supabase, userId, formData)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error('Error saving config:', err)
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  // Calcular horas locales para preview
  const getLocalTimeDisplay = (hour: number): string => {
    const date = new Date()
    date.setHours(hour, 0, 0, 0)

    try {
      const localTime = getLocalTime(formData.timezone, date)
      return `${localTime.hour.toString().padStart(2, '0')}:00`
    } catch {
      return `${hour.toString().padStart(2, '0')}:00`
    }
  }

  const getTimezoneLabel = (): string => {
    const tz = COMMON_TIMEZONES.find((t) => t.value === formData.timezone)
    return tz ? tz.label : formData.timezone
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4"
          >
            <ArrowLeft size={16} />
            Volver a Configuración
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">Programación de Notificaciones</h1>
          <p className="text-slate-600 mt-2">
            Personaliza los horarios de envío de recordatorios y remarketing según tu zona horaria
          </p>
        </div>

        {/* Alert de éxito */}
        {success && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-900">Configuración guardada</AlertTitle>
            <AlertDescription className="text-green-800">
              Los horarios han sido actualizados correctamente. Los próximos crons respetarán tu zona horaria.
            </AlertDescription>
          </Alert>
        )}

        {/* Alert de error */}
        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-900">Error</AlertTitle>
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Main Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe size={20} />
              Zona Horaria y Horarios de Envío
            </CardTitle>
            <CardDescription>
              Configura tu zona horaria y los horarios en que deseas recibir recordatorios de
              renovación de suscripciones
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-8">
            {/* Timezone Selection */}
            <div className="space-y-3">
              <Label htmlFor="timezone" className="text-base font-semibold">
                Zona Horaria
              </Label>
              <Select value={formData.timezone} onValueChange={(value) => setFormData({ ...formData, timezone: value })}>
                <SelectTrigger id="timezone" className="h-10">
                  <SelectValue placeholder="Selecciona tu zona horaria" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-slate-500">
                Actualmente en: <span className="font-semibold">{getTimezoneLabel()}</span>
              </p>
            </div>

            {/* Scheduling Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Reminder */}
              <div className="border border-slate-200 rounded-lg p-4 bg-blue-50/30">
                <div className="flex items-center gap-2 mb-4">
                  <Clock size={18} className="text-blue-600" />
                  <h3 className="font-semibold text-slate-900">Recordatorio</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="reminder_hour" className="text-sm">
                      Hora de envío
                    </Label>
                    <Input
                      id="reminder_hour"
                      type="number"
                      min="0"
                      max="23"
                      value={formData.reminder_hour}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          reminder_hour: parseInt(e.target.value, 10),
                        })
                      }
                      className="mt-1 h-9"
                    />
                  </div>
                  <div className="pt-2 border-t border-blue-200">
                    <p className="text-xs text-slate-500 mb-1">Hora local:</p>
                    <p className="text-lg font-bold text-blue-600">{getLocalTimeDisplay(formData.reminder_hour)}</p>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Primer envío cuando una suscripción está próxima a vencer
                  </p>
                </div>
              </div>

              {/* Follow-up */}
              <div className="border border-slate-200 rounded-lg p-4 bg-amber-50/30">
                <div className="flex items-center gap-2 mb-4">
                  <Clock size={18} className="text-amber-600" />
                  <h3 className="font-semibold text-slate-900">Remarketing</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="followup_hour" className="text-sm">
                      Hora de envío
                    </Label>
                    <Input
                      id="followup_hour"
                      type="number"
                      min="0"
                      max="23"
                      value={formData.followup_hour}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          followup_hour: parseInt(e.target.value, 10),
                        })
                      }
                      className="mt-1 h-9"
                    />
                  </div>
                  <div className="pt-2 border-t border-amber-200">
                    <p className="text-xs text-slate-500 mb-1">Hora local:</p>
                    <p className="text-lg font-bold text-amber-600">{getLocalTimeDisplay(formData.followup_hour)}</p>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Segundo envío (~9 horas después del recordatorio)
                  </p>
                </div>
              </div>

              {/* Urgency */}
              <div className="border border-slate-200 rounded-lg p-4 bg-red-50/30">
                <div className="flex items-center gap-2 mb-4">
                  <Clock size={18} className="text-red-600" />
                  <h3 className="font-semibold text-slate-900">Último Aviso</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="urgency_hour" className="text-sm">
                      Hora de envío
                    </Label>
                    <Input
                      id="urgency_hour"
                      type="number"
                      min="0"
                      max="23"
                      value={formData.urgency_hour}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          urgency_hour: parseInt(e.target.value, 10),
                        })
                      }
                      className="mt-1 h-9"
                    />
                  </div>
                  <div className="pt-2 border-t border-red-200">
                    <p className="text-xs text-slate-500 mb-1">Hora local:</p>
                    <p className="text-lg font-bold text-red-600">{getLocalTimeDisplay(formData.urgency_hour)}</p>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Último aviso (~48 horas después del recordatorio)
                  </p>
                </div>
              </div>
            </div>

            {/* Info box */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                <span className="font-semibold">📝 Nota:</span> Los horarios se aplican en tu zona horaria local.
                Independientemente de dónde estés, los envíos ocurrirán a las horas que especifiques. Los cron jobs
                se ejecutan cada día en UTC, pero solo procesan usuarios cuya hora local coincide con su configuración.
              </p>
            </div>

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-11 bg-slate-900 hover:bg-slate-800"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar Configuración'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
