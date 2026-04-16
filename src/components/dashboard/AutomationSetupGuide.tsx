'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowRight, CheckCircle2, FileText, GitBranch, MessageSquare, Timer, Zap, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

type AutomationSection = 'flows' | 'triggers' | 'templates'

type Props = {
  section: AutomationSection
  onCreateFlow?: () => void
  onCreateTemplate?: () => void
}

type DecisionCard = {
  id: AutomationSection | 'sequences'
  title: string
  useWhen: string
  example: string
  cta: string
  href: (assistantId: string) => string
  icon: LucideIcon
}

const SECTION_COPY: Record<AutomationSection, { eyebrow: string; title: string; body: string }> = {
  flows: {
    eyebrow: 'Estas en Flujos',
    title: 'Usa flujos cuando el bot debe guiar una conversacion paso a paso.',
    body: 'Primero define que palabra lo inicia, luego agrega mensajes, preguntas, botones o acciones en orden.',
  },
  triggers: {
    eyebrow: 'Estas en Disparadores',
    title: 'Usa disparadores cuando algo debe pasar automaticamente.',
    body: 'Define cuando se activa y que accion ejecuta. Para seguimientos largos, usa secuencias recomendadas.',
  },
  templates: {
    eyebrow: 'Estas en Plantillas',
    title: 'Usa plantillas cuando WhatsApp exige un mensaje aprobado por Meta.',
    body: 'Son necesarias para escribir fuera de la ventana de 24 horas o para avisos masivos y recordatorios.',
  },
}

const DECISION_CARDS: DecisionCard[] = [
  {
    id: 'flows',
    title: 'Guiar al cliente',
    useWhen: 'Quiero llevarlo por pasos.',
    example: 'Ej: elegir servicio, confirmar datos, terminar en pago o reserva.',
    cta: 'Crear flujo',
    href: assistantId => `/dashboard/assistants/${assistantId}/flows/new`,
    icon: GitBranch,
  },
  {
    id: 'triggers',
    title: 'Reaccionar a algo',
    useWhen: 'Quiero que pase algo cuando el cliente escriba o cumpla una regla.',
    example: 'Ej: si escribe precio, enviar info. Si no responde, avisar.',
    cta: 'Crear disparador',
    href: assistantId => `/dashboard/assistants/${assistantId}/triggers/new`,
    icon: Zap,
  },
  {
    id: 'sequences',
    title: 'Hacer seguimiento',
    useWhen: 'Quiero enviar 1 o 2 recordatorios sin perseguir manualmente.',
    example: 'Ej: 30 minutos despues, 1 dia despues, cancelar si responde.',
    cta: 'Ver secuencias',
    href: assistantId => `/dashboard/assistants/${assistantId}/triggers#seguimientos`,
    icon: Timer,
  },
  {
    id: 'templates',
    title: 'Mensaje aprobado por Meta',
    useWhen: 'Quiero escribir fuera de 24h, enviar avisos o usar campañas.',
    example: 'Ej: recordatorio de pago, confirmacion, renovacion o broadcast.',
    cta: 'Crear plantilla',
    href: assistantId => `/dashboard/assistants/${assistantId}/templates`,
    icon: FileText,
  },
]

export default function AutomationSetupGuide({ section, onCreateFlow, onCreateTemplate }: Props) {
  const params = useParams()
  const assistantId = params?.assistantId as string
  const copy = SECTION_COPY[section]

  const renderAction = (card: DecisionCard) => {
    if (card.id === 'flows' && section === 'flows' && onCreateFlow) {
      return (
        <button
          type="button"
          onClick={onCreateFlow}
          className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-cyan-700 hover:text-cyan-800"
        >
          {card.cta}
          <ArrowRight size={13} />
        </button>
      )
    }

    if (card.id === 'templates' && section === 'templates' && onCreateTemplate) {
      return (
        <button
          type="button"
          onClick={onCreateTemplate}
          className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
        >
          {card.cta}
          <ArrowRight size={13} />
        </button>
      )
    }

    return (
      <Link
        href={card.href(assistantId)}
        className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#0F172A] hover:text-cyan-700"
      >
        {card.cta}
        <ArrowRight size={13} />
      </Link>
    )
  }

  return (
    <section className="mb-6 overflow-hidden rounded-lg border border-black/[0.08] bg-white">
      <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1.6fr]">
        <div className="border-b border-black/[0.06] bg-[#F7F8FA] p-5 lg:border-b-0 lg:border-r">
          <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700">
            <MessageSquare size={13} />
            {copy.eyebrow}
          </div>
          <h2 className="text-lg font-bold leading-snug text-[#0F172A]">{copy.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{copy.body}</p>

          <div className="mt-5 space-y-2 rounded-lg border border-black/[0.07] bg-white p-3">
            {[
              'Elige el objetivo.',
              'Usa una recomendacion o plantilla.',
              'Prueba antes de activar.',
            ].map((step, index) => (
              <div key={step} className="flex items-center gap-2 text-xs text-slate-600">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-700">
                  {index + 1}
                </span>
                {step}
              </div>
            ))}
          </div>
        </div>

        <div className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">No sabes cual usar?</p>
              <p className="text-sm font-semibold text-[#0F172A]">Elige por lo que quieres lograr.</p>
            </div>
            <Button
              type="button"
              className="hidden h-8 rounded-lg border-slate-200 bg-white text-xs text-slate-600 hover:bg-slate-50 md:inline-flex"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              Ver desde arriba
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {DECISION_CARDS.map(card => {
              const Icon = card.icon
              const active = card.id === section

              return (
                <div
                  key={card.id}
                  className={`rounded-lg border p-4 transition-colors ${
                    active
                      ? 'border-cyan-300 bg-cyan-50/60'
                      : 'border-black/[0.07] bg-white hover:border-slate-300 hover:bg-[#F7F8FA]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`rounded-lg border p-2 ${active ? 'border-cyan-200 bg-white text-cyan-700' : 'border-slate-200 bg-[#F7F8FA] text-slate-500'}`}>
                      <Icon size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-[#0F172A]">{card.title}</h3>
                        {active && <CheckCircle2 size={14} className="text-cyan-700" />}
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-600">{card.useWhen}</p>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{card.example}</p>
                      {renderAction(card)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
