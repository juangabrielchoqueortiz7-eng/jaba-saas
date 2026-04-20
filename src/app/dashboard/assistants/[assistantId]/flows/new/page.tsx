'use client'

import { useState } from 'react'
import { ArrowLeft, LayoutTemplate } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import FlowWizard from '../FlowWizard'
import FlowTemplates from '../FlowTemplates'

export default function NewFlowPage() {
  const params = useParams()
  const router = useRouter()
  const assistantId = params?.assistantId as string
  const [view, setView] = useState<'wizard' | 'templates'>('wizard')

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <div className="mx-auto max-w-7xl p-6 md:p-8">
        {/* Header row */}
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => view === 'templates' ? setView('wizard') : router.push(`/dashboard/assistants/${assistantId}/flows`)}
            className="inline-flex items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:text-[#0F172A]"
          >
            <ArrowLeft size={15} />
            {view === 'templates' ? 'Volver al asistente guiado' : 'Volver a flujos'}
          </button>

          {view === 'wizard' && (
            <button
              type="button"
              onClick={() => setView('templates')}
              className="inline-flex items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:text-[#0F172A]"
            >
              <LayoutTemplate size={15} />
              Ver plantillas con nodos
            </button>
          )}
        </div>

        {view === 'wizard' ? (
          <FlowWizard assistantId={assistantId} />
        ) : (
          <FlowTemplates
            assistantId={assistantId}
            onStartBlank={() => setView('wizard')}
            onClose={() => router.push(`/dashboard/assistants/${assistantId}/flows`)}
          />
        )}
      </div>
    </div>
  )
}
