'use client'

import { ArrowRight, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react'

export type FriendlyCreationOption = {
  id: string
  title: string
  summary: string
  helper: string
  badge?: string
}

type FriendlyCreationStarterProps = {
  badge: string
  title: string
  description: string
  steps: string[]
  options: FriendlyCreationOption[]
  primaryLabel: string
  secondaryLabel: string
  onSelectOption: (optionId: string) => void
  onPrimaryAction: () => void
  onSecondaryAction: () => void
}

export default function FriendlyCreationStarter({
  badge,
  title,
  description,
  steps,
  options,
  primaryLabel,
  secondaryLabel,
  onSelectOption,
  onPrimaryAction,
  onSecondaryAction,
}: FriendlyCreationStarterProps) {
  return (
    <section className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-sm">
      <div className="max-w-3xl">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-700">
          <Sparkles size={12} />
          {badge}
        </div>
        <h1 className="text-2xl font-semibold text-[#0F172A]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr,1.35fr]">
        <div className="rounded-2xl border border-black/[0.08] bg-[#F7F8FA] p-4">
          <p className="text-sm font-semibold text-[#0F172A]">Como empezar sin perderte</p>
          <div className="mt-4 grid gap-3">
            {steps.map((step, index) => (
              <div key={step} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-[#0F172A] ring-1 ring-black/[0.08]">
                  {index + 1}
                </div>
                <p className="text-sm leading-relaxed text-slate-600">{step}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
            <div className="flex items-start gap-2 text-xs text-slate-700">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
              <span>Empieza por el resultado que quieres lograr. Los detalles tecnicos pueden venir despues.</span>
            </div>
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-[#0F172A]">Elige el punto de partida</p>
          <div className="grid gap-3 md:grid-cols-2">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelectOption(option.id)}
                className="rounded-2xl border border-black/[0.08] bg-white p-4 text-left transition-colors hover:border-[#25D366]/35 hover:bg-[#25D366]/[0.03]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {option.badge && (
                      <span className="inline-flex rounded-full border border-[#25D366]/20 bg-[#25D366]/10 px-2 py-1 text-[10px] font-semibold text-[#128C7E]">
                        {option.badge}
                      </span>
                    )}
                    <h2 className="mt-2 text-sm font-semibold text-[#0F172A]">{option.title}</h2>
                  </div>
                  <ArrowRight size={15} className="shrink-0 text-slate-300" />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">{option.summary}</p>
                <p className="mt-3 text-xs font-medium text-slate-600">{option.helper}</p>
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onPrimaryAction}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0F172A] px-4 py-2.5 text-sm font-semibold text-white"
            >
              {primaryLabel}
              <ChevronRight size={15} />
            </button>
            <button
              type="button"
              onClick={onSecondaryAction}
              className="inline-flex items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-4 py-2.5 text-sm font-semibold text-slate-600"
            >
              {secondaryLabel}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
