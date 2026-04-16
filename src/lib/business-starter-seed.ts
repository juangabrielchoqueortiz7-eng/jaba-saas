import type { SupabaseClient } from '@supabase/supabase-js'
import type { BusinessType } from './business-config'
import type { BusinessGoal } from './business-goals'
import {
  getStarterTemplatePack,
  type StarterFlowTemplate,
  type StarterTriggerTemplate,
} from './business-starter-templates'

async function seedFlow(
  supabase: SupabaseClient,
  userId: string,
  template: StarterFlowTemplate,
) {
  const { data: existing } = await supabase
    .from('conversation_flows')
    .select('id')
    .eq('user_id', userId)
    .eq('name', template.name)
    .maybeSingle()

  if (existing?.id) {
    return existing.id as string
  }

  const { data: flow, error: flowError } = await supabase
    .from('conversation_flows')
    .insert({
      user_id: userId,
      name: template.name,
      description: template.description,
      is_active: false,
      priority: template.priority,
    })
    .select('id')
    .single()

  if (flowError || !flow) {
    throw flowError || new Error(`No se pudo crear el flujo ${template.name}`)
  }

  const nodeIds = template.nodes.map(() => crypto.randomUUID())
  const nodes = template.nodes.map((node, index) => ({
    id: nodeIds[index],
    flow_id: flow.id,
    type: node.type,
    label: node.label,
    position_x: node.position_x,
    position_y: node.position_y,
    config: node.config,
  }))

  if (nodes.length > 0) {
    const { error } = await supabase.from('flow_nodes').insert(nodes)
    if (error) throw error
  }

  const edges = template.edges.map(edge => ({
    id: crypto.randomUUID(),
    flow_id: flow.id,
    source_node_id: nodeIds[edge.sourceIndex],
    target_node_id: nodeIds[edge.targetIndex],
    source_handle: edge.source_handle,
    label: edge.label,
  }))

  if (edges.length > 0) {
    const { error } = await supabase.from('flow_edges').insert(edges)
    if (error) throw error
  }

  return flow.id as string
}

async function insertTriggerConditions(
  supabase: SupabaseClient,
  triggerId: string,
  template: StarterTriggerTemplate,
) {
  if (template.conditions.length === 0) {
    return
  }

  const { data: group, error: groupError } = await supabase
    .from('trigger_condition_groups')
    .insert({
      trigger_id: triggerId,
      operator: template.conditionsLogic || 'AND',
      group_order: 0,
    })
    .select('id')
    .single()

  const conditions = template.conditions.map(condition => ({
    trigger_id: triggerId,
    ...(group?.id && !groupError ? { group_id: group.id } : {}),
    type: condition.condition_type,
    condition_type: condition.condition_type,
    operator: condition.operator,
    value: condition.value,
    payload: condition.payload || {},
  }))

  const { error } = await supabase.from('trigger_conditions').insert(conditions)
  if (error) throw error
}

async function seedTrigger(
  supabase: SupabaseClient,
  userId: string,
  template: StarterTriggerTemplate,
) {
  const { data: existing } = await supabase
    .from('triggers')
    .select('id')
    .eq('user_id', userId)
    .eq('name', template.name)
    .maybeSingle()

  if (existing?.id) {
    return existing.id as string
  }

  const { data: trigger, error: triggerError } = await supabase
    .from('triggers')
    .insert({
      user_id: userId,
      name: template.name,
      type: template.type,
      description: template.description,
      is_active: true,
    })
    .select('id')
    .single()

  if (triggerError || !trigger) {
    throw triggerError || new Error(`No se pudo crear el disparador ${template.name}`)
  }

  await insertTriggerConditions(supabase, trigger.id, template)

  if (template.actions.length > 0) {
    const actions = template.actions.map((action, index) => ({
      trigger_id: trigger.id,
      type: action.type,
      payload: action.payload,
      delay_seconds: action.delay_seconds ?? 0,
      action_order: index,
    }))

    const { error } = await supabase.from('trigger_actions').insert(actions)
    if (error) throw error
  }

  return trigger.id as string
}

export async function seedStarterTemplatesForBusinessType(
  supabase: SupabaseClient,
  userId: string,
  businessType: BusinessType,
  goals?: BusinessGoal[],
) {
  const pack = getStarterTemplatePack(businessType, goals)
  const createdFlowIds: string[] = []
  const createdTriggerIds: string[] = []

  for (const flow of pack.flows) {
    createdFlowIds.push(await seedFlow(supabase, userId, flow))
  }

  for (const trigger of pack.triggers) {
    createdTriggerIds.push(await seedTrigger(supabase, userId, trigger))
  }

  return {
    flows: createdFlowIds,
    triggers: createdTriggerIds,
  }
}
