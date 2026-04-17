'use client'

import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import FriendlyCreationStarter from '@/components/dashboard/FriendlyCreationStarter'
import { getSimpleCreationRecipes } from '@/lib/simple-creation-system'
import TriggerBuilder from '../TriggerBuilder'
import TriggerTemplates, { TRIGGER_TEMPLATES, type TriggerTemplate } from '../TriggerTemplates'

const RECIPE_TEMPLATE_MAP: Record<string, string> = {
  trigger_keyword_reply: 'price_inquiry',
  trigger_inactivity_followup: 'inactivity_reminder',
  trigger_renewal_push: 'expiration_3days',
}

export default function NewTriggerPage() {
  const params = useParams()
  const assistantId = params?.assistantId as string
  const [view, setView] = useState<'starter' | 'gallery'>('starter')
  const [selectedTemplate, setSelectedTemplate] = useState<TriggerTemplate | null | 'blank'>(null)

  const starterOptions = useMemo(() => (
    getSimpleCreationRecipes({ surface: 'triggers', limit: 3 }).map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      summary: recipe.summary,
      helper: recipe.outcome,
      badge: recipe.difficulty,
    }))
  ), [])

  const handleRecipeSelect = (optionId: string) => {
    const templateId = RECIPE_TEMPLATE_MAP[optionId]
    const template = TRIGGER_TEMPLATES.find((item) => item.id === templateId)
    setSelectedTemplate(template ?? 'blank')
  }

  if (selectedTemplate === null) {
    return (
      <div className="min-h-screen bg-[#F7F8FA]">
        <div className="mx-auto max-w-6xl p-6 md:p-8">
          {view === 'starter' ? (
            <FriendlyCreationStarter
              badge="Disparadores con guia clara"
              title="Nuevo disparador"
              description="Aqui deberias poder empezar sin adivinar. Elige el caso que mas se parece a lo que quieres lograr y luego ajustamos solo lo necesario."
              steps={[
                'Piensa en una sola situacion real: consulta de precio, seguimiento o renovacion.',
                'Elige la base mas cercana y revisa el primer mensaje antes de tocar reglas avanzadas.',
                'Activalo solo cuando la respuesta y la condicion de corte sean faciles de entender.',
              ]}
              options={starterOptions}
              primaryLabel="Ver mas plantillas"
              secondaryLabel="Empezar paso a paso"
              onSelectOption={handleRecipeSelect}
              onPrimaryAction={() => setView('gallery')}
              onSecondaryAction={() => setSelectedTemplate('blank')}
            />
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setView('starter')}
                className="inline-flex items-center rounded-xl border border-black/[0.08] bg-white px-4 py-2 text-sm font-medium text-slate-600"
              >
                Volver al inicio guiado
              </button>
              <TriggerTemplates
                onSelectTemplate={(template) => setSelectedTemplate(template)}
                onStartBlank={() => setSelectedTemplate('blank')}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <TriggerBuilder
      assistantId={assistantId}
      initialTemplate={selectedTemplate === 'blank' ? undefined : selectedTemplate}
    />
  )
}
