'use client'

import { ArrowLeft } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import FlowWizard from '../FlowWizard'

export default function NewFlowPage() {
  const params = useParams()
  const router = useRouter()
  const assistantId = params?.assistantId as string

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <div className="mx-auto max-w-7xl p-6 md:p-8">
        <button
          type="button"
          onClick={() => router.push(`/dashboard/assistants/${assistantId}/flows`)}
          className="mb-4 inline-flex items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:text-[#0F172A]"
        >
          <ArrowLeft size={15} />
          Volver a flujos
        </button>
        <FlowWizard assistantId={assistantId} />
      </div>
    </div>
  )
}
