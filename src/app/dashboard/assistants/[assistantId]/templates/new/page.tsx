'use client'

import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import SimpleCreationHub from '@/components/dashboard/SimpleCreationHub'
import type { SimpleCreationRecipe } from '@/lib/simple-creation-system'
import SimpleTemplateWizard from '../SimpleTemplateWizard'
import MetaTemplateBuilder from '../MetaTemplateBuilder'

const TEMPLATE_BODIES: Record<string, string> = {
  template_welcome: 'Hola {{1}}. Tu acceso a {{2}} ya esta listo.\n\nSi necesitas ayuda para empezar, responde este mensaje y te acompanamos.',
  template_renewal: 'Hola {{1}}.\n\nTu acceso a {{2}} vence en {{3}} dias.\n\nSi quieres renovarlo hoy, responde este mensaje y te ayudamos enseguida.',
  template_followup: 'Hola {{1}}.\n\nSeguimos pendientes con {{2}}.\n\nSi todavia quieres avanzar, responde este mensaje y retomamos desde donde quedamos.',
}

export default function NewTemplatePage() {
  const params = useParams()
  const router = useRouter()
  const assistantId = params?.assistantId as string
  const [advanced, setAdvanced] = useState(false)
  const [initialBody, setInitialBody] = useState<string | undefined>(undefined)

  const handleRecipeSelect = (recipe: SimpleCreationRecipe) => {
    setAdvanced(false)
    setInitialBody(TEMPLATE_BODIES[recipe.id])
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <div className="mx-auto max-w-6xl p-6 md:p-8">
        <button
          type="button"
          onClick={() => router.push(`/dashboard/assistants/${assistantId}/templates`)}
          className="mb-4 inline-flex items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:text-[#0F172A]"
        >
          <ArrowLeft size={15} />
          Volver a plantillas
        </button>

        <div className="mb-6">
          <SimpleCreationHub
            assistantId={assistantId}
            surface="templates"
            onRecipeSelect={handleRecipeSelect}
          />
        </div>

        {!advanced ? (
          <SimpleTemplateWizard
            onSuccess={() => router.push(`/dashboard/assistants/${assistantId}/templates`)}
            onCancel={() => router.push(`/dashboard/assistants/${assistantId}/templates`)}
            onAdvancedMode={() => setAdvanced(true)}
            initialBody={initialBody}
          />
        ) : (
          <MetaTemplateBuilder
            onSuccess={() => router.push(`/dashboard/assistants/${assistantId}/templates`)}
            onCancel={() => router.push(`/dashboard/assistants/${assistantId}/templates`)}
          />
        )}
      </div>
    </div>
  )
}
