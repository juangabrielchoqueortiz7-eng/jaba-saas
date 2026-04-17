'use client'

import { useMemo, useState, useTransition } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import FriendlyCreationStarter from '@/components/dashboard/FriendlyCreationStarter'
import { getSimpleCreationRecipes } from '@/lib/simple-creation-system'
import { createFlowFromTemplate } from '../actions'
import FlowWizard from '../FlowWizard'
import FlowTemplates, { FLOW_TEMPLATES } from '../FlowTemplates'

const RECIPE_TEMPLATE_MAP: Record<string, string> = {
  flow_welcome_menu: 'welcome_menu',
  flow_sales_assistant: 'sales_ai',
  flow_lead_capture: 'lead_capture',
}

export default function NewFlowPage() {
  const params = useParams()
  const router = useRouter()
  const assistantId = params?.assistantId as string
  const [mode, setMode] = useState<'starter' | 'gallery' | 'builder'>('starter')
  const [isPending, startTransition] = useTransition()

  const starterOptions = useMemo(() => (
    getSimpleCreationRecipes({ surface: 'flows', limit: 3 }).map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      summary: recipe.summary,
      helper: recipe.outcome,
      badge: recipe.difficulty,
    }))
  ), [])

  const handleRecipeSelect = (optionId: string) => {
    const templateId = RECIPE_TEMPLATE_MAP[optionId]
    const template = FLOW_TEMPLATES.find((item) => item.id === templateId)

    if (!template) {
      setMode('builder')
      return
    }

    startTransition(async () => {
      try {
        const flowId = await createFlowFromTemplate(
          template.name,
          template.description,
          template.nodes,
          template.edges,
        )

        if (flowId) {
          router.push(`/dashboard/assistants/${assistantId}/flows/${flowId}`)
        }
      } catch (error) {
        console.error(error)
        alert('No pudimos crear ese flujo. Intenta con el modo paso a paso.')
      }
    })
  }

  if (mode === 'starter') {
    return (
      <div className="min-h-screen bg-[#F7F8FA]">
        <div className="mx-auto max-w-6xl p-6 md:p-8">
          <FriendlyCreationStarter
            badge="Flujos mas faciles de arrancar"
            title="Nuevo flujo conversacional"
            description="La idea aqui es simple: escoger la base correcta primero, y recien despues editar detalles. Asi el cliente no se enfrenta a una pantalla llena de pasos sin contexto."
            steps={[
              'Empieza por lo que quieres que pase en la conversacion: bienvenida, venta o captura de datos.',
              'Usa una base corta para ver la estructura antes de editar textos o preguntas.',
              'Si necesitas algo distinto, entra al modo paso a paso y construyelo con calma.',
            ]}
            options={starterOptions}
            primaryLabel="Ver mas plantillas"
            secondaryLabel="Crear paso a paso"
            onSelectOption={handleRecipeSelect}
            onPrimaryAction={() => setMode('gallery')}
            onSecondaryAction={() => setMode('builder')}
          />
        </div>
      </div>
    )
  }

  if (mode === 'gallery') {
    return (
      <div className="min-h-screen bg-[#F7F8FA]">
        <div className="mx-auto max-w-7xl p-6 md:p-8">
          <button
            type="button"
            onClick={() => setMode('starter')}
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:text-[#0F172A]"
          >
            <ArrowLeft size={15} />
            Volver al inicio guiado
          </button>
          <FlowTemplates
            assistantId={assistantId}
            onStartBlank={() => setMode('builder')}
            onClose={() => setMode('starter')}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <div className="mx-auto max-w-7xl p-6 md:p-8">
        <button
          type="button"
          onClick={() => setMode('starter')}
          className="mb-4 inline-flex items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:text-[#0F172A]"
        >
          <ArrowLeft size={15} />
          Volver al inicio guiado
        </button>
        <FlowWizard assistantId={assistantId} />
      </div>
    </div>
  )
}
