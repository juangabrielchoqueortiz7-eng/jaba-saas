'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  FileText,
  GitBranch,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import type { BusinessType } from '@/lib/business-config'
import {
  normalizeBusinessGoalsForBusinessType,
  type BusinessGoal,
} from '@/lib/business-goals'
import {
  getBusinessTypeTitle,
  getGoalSummary,
  getSimpleCreationChecklist,
  getSimpleCreationRecipes,
  getSimpleCreationResourceCards,
  type SimpleCreationArea,
  type SimpleCreationRecipe,
  type SimpleCreationSurface,
} from '@/lib/simple-creation-system'

type BusinessProfileRecord = {
  business_type?: string | null
  business_profile?: unknown
}

type SimpleCreationHubProps = {
  assistantId: string
  surface?: SimpleCreationSurface
  businessType?: BusinessType | null
  goals?: BusinessGoal[]
  onRecipeSelect?: (recipe: SimpleCreationRecipe) => void
}

function getAreaMeta(area: SimpleCreationArea) {
  switch (area) {
    case 'flows':
      return {
        label: 'Conversacion',
        icon: GitBranch,
        accent: 'text-cyan-700 bg-cyan-50 border-cyan-200',
      }
    case 'triggers':
      return {
        label: 'Automatizacion',
        icon: BellRing,
        accent: 'text-amber-700 bg-amber-50 border-amber-200',
      }
    default:
      return {
        label: 'Plantilla',
        icon: FileText,
        accent: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      }
  }
}

function getSurfaceCopy(surface: SimpleCreationSurface) {
  switch (surface) {
    case 'flows':
      return {
        title: 'Conversaciones faciles de crear',
        description: 'Empieza con una receta y luego ajusta solo lo que de verdad importa para conversar mejor.',
      }
    case 'triggers':
      return {
        title: 'Automatizaciones menos tecnicas',
        description: 'Piensa en evento, mensaje y corte. El resto debe quedar resuelto por el sistema.',
      }
    case 'templates':
      return {
        title: 'Plantillas listas sin hablar en Meta',
        description: 'Crea por objetivo, completa ejemplos y deja el modo avanzado solo como respaldo.',
      }
    default:
      return {
        title: 'Creador simple',
        description: 'Elige lo que quieres lograr y entra por una receta funcional, no por una configuracion tecnica.',
      }
  }
}

function buildRecipeHref(area: SimpleCreationArea, assistantId: string) {
  if (area === 'templates') {
    return `/dashboard/assistants/${assistantId}/templates/new`
  }

  return `/dashboard/assistants/${assistantId}/${area}/new`
}

export function SimpleCreationHub({
  assistantId,
  surface = 'assistant',
  businessType,
  goals,
  onRecipeSelect,
}: SimpleCreationHubProps) {
  const [derivedBusinessType, setDerivedBusinessType] = useState<BusinessType | null>(businessType ?? null)
  const [derivedGoals, setDerivedGoals] = useState<BusinessGoal[]>(goals ?? [])

  useEffect(() => {
    if (businessType && goals) return

    let cancelled = false

    const loadProfile = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('business_type, business_profile')
        .eq('id', user.id)
        .maybeSingle()

      if (cancelled || !profile) return

      const record = profile as BusinessProfileRecord
      const nextBusinessType = typeof record.business_type === 'string'
        ? record.business_type as BusinessType
        : 'subscriptions'
      const nextProfile = record.business_profile && typeof record.business_profile === 'object' && !Array.isArray(record.business_profile)
        ? record.business_profile as { goals?: unknown }
        : {}

      setDerivedBusinessType(nextBusinessType)
      setDerivedGoals(normalizeBusinessGoalsForBusinessType(nextBusinessType, nextProfile.goals))
    }

    void loadProfile()

    return () => {
      cancelled = true
    }
  }, [businessType, goals])

  const copy = getSurfaceCopy(surface)
  const recipes = useMemo(() => getSimpleCreationRecipes({
    surface,
    businessType: derivedBusinessType,
    goals: derivedGoals,
  }), [surface, derivedBusinessType, derivedGoals])
  const resources = useMemo(() => getSimpleCreationResourceCards(surface), [surface])
  const checklist = useMemo(() => getSimpleCreationChecklist(surface), [surface])

  return (
    <section className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-700">
            <Sparkles size={12} />
            Menos tecnico, mas funcional
          </div>
          <h2 className="text-xl font-semibold text-[#0F172A]">{copy.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{copy.description}</p>
        </div>
        <div className="grid gap-2 text-xs text-slate-500">
          <div className="rounded-xl border border-black/[0.06] bg-[#F7F8FA] px-3 py-2">
            <span className="font-semibold text-[#0F172A]">Rubro:</span> {getBusinessTypeTitle(derivedBusinessType)}
          </div>
          <div className="rounded-xl border border-black/[0.06] bg-[#F7F8FA] px-3 py-2">
            <span className="font-semibold text-[#0F172A]">Foco:</span> {getGoalSummary(derivedGoals)}
          </div>
        </div>
      </div>

      <div className={`mt-5 grid gap-3 ${surface === 'assistant' ? 'lg:grid-cols-3' : 'md:grid-cols-2'}`}>
        {recipes.map((recipe) => {
          const meta = getAreaMeta(recipe.area)
          const Icon = meta.icon
          const card = (
            <div className="h-full rounded-2xl border border-black/[0.08] bg-[#FCFCFD] p-4 transition-colors hover:border-slate-300">
              <div className="flex items-start justify-between gap-3">
                <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.accent}`}>
                  <Icon size={12} />
                  {meta.label}
                </div>
                <span className="text-[11px] font-medium text-slate-400">{recipe.difficulty}</span>
              </div>

              <div className="mt-3">
                <h3 className="text-sm font-semibold text-[#0F172A]">{recipe.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{recipe.summary}</p>
              </div>

              <div className="mt-3 rounded-xl border border-black/[0.05] bg-white px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Resultado</p>
                <p className="mt-1 text-xs text-slate-600">{recipe.outcome}</p>
              </div>

              <div className="mt-3 grid gap-2 text-xs text-slate-500">
                <div>
                  <p className="font-semibold text-[#0F172A]">Necesita</p>
                  <p className="mt-1">{recipe.needs.join(' · ')}</p>
                </div>
                <div>
                  <p className="font-semibold text-[#0F172A]">Chequeo rapido</p>
                  <p className="mt-1">{recipe.checks.join(' · ')}</p>
                </div>
              </div>

              <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600">
                {recipe.launchLabel}
                <ArrowRight size={12} />
              </div>
            </div>
          )

          if (onRecipeSelect && recipe.area === surface) {
            return (
              <button
                key={recipe.id}
                type="button"
                onClick={() => onRecipeSelect(recipe)}
                className="text-left"
              >
                {card}
              </button>
            )
          }

          return (
            <Link key={recipe.id} href={buildRecipeHref(recipe.area, assistantId)}>
              {card}
            </Link>
          )
        })}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {resources.map((resource) => (
          <div key={resource.title} className="rounded-2xl border border-black/[0.08] bg-[#F7F8FA] p-4">
            <p className="text-sm font-semibold text-[#0F172A]">{resource.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{resource.description}</p>
            <div className="mt-3 grid gap-2">
              {resource.items.map((item) => (
                <div key={item} className="flex items-start gap-2 text-xs text-slate-600">
                  <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-500" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={15} className="text-emerald-600" />
          <p className="text-sm font-semibold text-[#0F172A]">Antes de activar</p>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {checklist.map((item) => (
            <div key={item} className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs text-slate-600">
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default SimpleCreationHub
