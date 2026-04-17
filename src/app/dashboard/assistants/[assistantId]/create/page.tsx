import Link from 'next/link'
import { ArrowRight, BellRing, FileText, GitBranch, Settings2 } from 'lucide-react'
import SimpleCreationHub from '@/components/dashboard/SimpleCreationHub'

export default async function AssistantCreatePage({
  params,
}: {
  params: Promise<{ assistantId: string }>
}) {
  const { assistantId } = await params

  const sections = [
    {
      title: 'Conversaciones guiadas',
      description: 'Empieza desde recetas y luego ajusta el mensaje o los pasos que necesites.',
      href: `/dashboard/assistants/${assistantId}/flows/new`,
      icon: GitBranch,
      accent: 'text-cyan-700 bg-cyan-50 border-cyan-200',
    },
    {
      title: 'Automatizaciones',
      description: 'Crea reglas por evento, seguimiento o vencimiento sin bajar a condiciones tecnicas de entrada.',
      href: `/dashboard/assistants/${assistantId}/triggers/new`,
      icon: BellRing,
      accent: 'text-amber-700 bg-amber-50 border-amber-200',
    },
    {
      title: 'Plantillas',
      description: 'Usa el creador simple para dejar listas plantillas de bienvenida, renovacion y seguimiento.',
      href: `/dashboard/assistants/${assistantId}/templates/new`,
      icon: FileText,
      accent: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    },
  ]

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <div className="mx-auto max-w-6xl p-6 md:p-8">
        <div className="mb-6">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-700">
            Simplificado
          </div>
          <h1 className="text-2xl font-semibold text-[#0F172A]">Crea por objetivo</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Esta entrada junta conversaciones, automatizaciones y plantillas en un mismo lugar para que empieces por lo que quieres lograr, no por la configuracion tecnica.
          </p>
        </div>

        <SimpleCreationHub assistantId={assistantId} surface="assistant" />

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {sections.map((section) => {
            const Icon = section.icon
            return (
              <Link
                key={section.title}
                href={section.href}
                className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-sm transition-colors hover:border-slate-300"
              >
                <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${section.accent}`}>
                  <Icon size={12} />
                  Entrada simple
                </div>
                <h2 className="mt-3 text-base font-semibold text-[#0F172A]">{section.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{section.description}</p>
                <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600">
                  Abrir creador
                  <ArrowRight size={12} />
                </div>
              </Link>
            )
          })}
        </div>

        <div className="mt-6 rounded-2xl border border-black/[0.08] bg-white p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-black/[0.08] bg-[#F7F8FA] p-2 text-slate-600">
              <Settings2 size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">Modo avanzado sigue disponible</p>
              <p className="mt-1 text-sm text-slate-500">
                Cuando necesites tocar detalles internos, puedes entrar luego a las pantallas tradicionales de flujos, disparadores y plantillas sin perder este camino simplificado.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
