'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BellRing,
  FileText,
  GitBranch,
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
  getSimpleCreationRecipes,
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
        title: 'Crear conversaciones sin enredarte',
        description: 'Empieza por el resultado que quieres en el chat y deja la configuracion detallada para despues.',
        steps: [
          'Elige una base simple, como bienvenida, venta o captura de datos.',
          'Ajusta solo el mensaje principal y las opciones que vera el cliente.',
          'Revisa la vista previa y publica cuando la ruta sea clara.',
        ],
      }
    case 'triggers':
      return {
        title: 'Crear disparadores mas claros',
        description: 'Primero piensa en que activa la automatizacion, que responde y cuando debe detenerse.',
        steps: [
          'Empieza por una situacion real: precio, seguimiento o renovacion.',
          'Define un solo mensaje o accion para ese caso.',
          'Asegura una condicion de corte para no insistir de mas.',
        ],
      }
    case 'templates':
      return {
        title: 'Plantillas utiles antes que tecnicas',
        description: 'Crea mensajes por objetivo, con ejemplos reales y variables entendibles.',
        steps: [
          'Elige para que servira la plantilla.',
          'Completa variables con ejemplos que el equipo si usara.',
          'Dejala lista para usar en automatizaciones o envios manuales.',
        ],
      }
    default:
      return {
        title: 'Menos tecnico, mas claro',
        description: 'La idea es que puedas empezar por una receta funcional y no por una pared de configuraciones.',
        steps: [
          'Define que quieres lograr.',
          'Elige una base simple.',
          'Edita solo lo importante al comienzo.',
        ],
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
    limit: surface === 'assistant' ? 3 : 2,
  }), [surface, derivedBusinessType, derivedGoals])

  return (
    <section className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-700">
            <Sparkles size={12} />
            Creacion guiada
          </div>
          <h2 className="text-xl font-semibold text-[#0F172A]">{copy.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">{copy.description}</p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          <div className="rounded-xl border border-black/[0.06] bg-[#F7F8FA] px-3 py-2">
            <span className="font-semibold text-[#0F172A]">Rubro:</span> {getBusinessTypeTitle(derivedBusinessType)}
          </div>
          <div className="rounded-xl border border-black/[0.06] bg-[#F7F8FA] px-3 py-2">
            <span className="font-semibold text-[#0F172A]">Foco:</span> {getGoalSummary(derivedGoals)}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr,1.35fr]">
        <div className="rounded-2xl border border-black/[0.08] bg-[#F7F8FA] p-4">
          <p className="text-sm font-semibold text-[#0F172A]">Por donde empezar</p>
          <div className="mt-4 grid gap-3">
            {copy.steps.map((step, index) => (
              <div key={step} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-[#0F172A] ring-1 ring-black/[0.08]">
                  {index + 1}
                </div>
                <p className="text-sm leading-relaxed text-slate-600">{step}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-[#0F172A]">Recetas recomendadas</p>
          <div className={`grid gap-3 ${surface === 'assistant' ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
            {recipes.map((recipe) => {
              const meta = getAreaMeta(recipe.area)
              const Icon = meta.icon
              const card = (
                <div className="h-full rounded-2xl border border-black/[0.08] bg-white p-4 transition-colors hover:border-slate-300">
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

                  <div className="mt-3 rounded-xl bg-[#F7F8FA] px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Te ayuda a</p>
                    <p className="mt-1 text-xs text-slate-600">{recipe.outcome}</p>
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
        </div>
      </div>
    </section>
  )
}

export default SimpleCreationHub
