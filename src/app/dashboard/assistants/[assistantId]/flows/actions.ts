'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import type { WizardStepConfig } from './wizard-utils'

// ========================
// TYPES
// ========================

export type ConversationFlow = {
    id: string
    name: string
    description: string
    is_active: boolean
    priority: number
    created_at: string
    updated_at: string
}

export type FlowNodeData = {
    id: string
    flow_id: string
    type: string
    label: string
    position_x: number
    position_y: number
    config: WizardStepConfig
    created_at: string
}

export type FlowEdgeData = {
    id: string
    flow_id: string
    source_node_id: string
    target_node_id: string
    source_handle: string
    label: string
}

// ========================
// FLOWS CRUD
// ========================

export async function getFlows(): Promise<ConversationFlow[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
        .from('conversation_flows')
        .select('*')
        .eq('user_id', user.id)
        .order('priority', { ascending: false })

    if (error) {
        console.error('Error fetching flows:', error)
        return []
    }
    return data as ConversationFlow[]
}

export async function createFlow(name: string, description: string = ''): Promise<ConversationFlow | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('conversation_flows')
        .insert({
            user_id: user.id,
            name,
            description,
            is_active: false,
            priority: 0
        })
        .select()
        .single()

    if (error) throw error
    revalidatePath('/dashboard/assistants')
    return data
}

export async function updateFlow(id: string, updates: Partial<ConversationFlow>): Promise<void> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('conversation_flows')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/dashboard/assistants')
}

export async function deleteFlow(id: string): Promise<void> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('conversation_flows')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw error
    revalidatePath('/dashboard/assistants')
}

// ========================
// NODES & EDGES
// ========================

export async function getFlowDetails(flowId: string): Promise<{ nodes: FlowNodeData[], edges: FlowEdgeData[] }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { nodes: [], edges: [] }

    // Verify ownership
    const { data: flow } = await supabase
        .from('conversation_flows')
        .select('id')
        .eq('id', flowId)
        .eq('user_id', user.id)
        .single()

    if (!flow) return { nodes: [], edges: [] }

    const [nodesResult, edgesResult] = await Promise.all([
        supabase.from('flow_nodes').select('*').eq('flow_id', flowId),
        supabase.from('flow_edges').select('*').eq('flow_id', flowId)
    ])

    return {
        nodes: (nodesResult.data || []) as FlowNodeData[],
        edges: (edgesResult.data || []) as FlowEdgeData[]
    }
}

export async function saveFlowCanvas(
    flowId: string,
    nodes: { id: string; type: string; label: string; position_x: number; position_y: number; config: WizardStepConfig }[],
    edges: { id: string; source_node_id: string; target_node_id: string; source_handle: string; label: string }[]
): Promise<void> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Verify ownership
    const { data: flow } = await supabase
        .from('conversation_flows')
        .select('id')
        .eq('id', flowId)
        .eq('user_id', user.id)
        .single()

    if (!flow) throw new Error('Flow not found')

    // Delete existing nodes and edges (edges first due to FK constraints)
    const { error: delEdgeErr } = await supabase.from('flow_edges').delete().eq('flow_id', flowId)
    if (delEdgeErr) throw new Error(`Error al limpiar conexiones anteriores: ${delEdgeErr.message}`)

    const { error: delNodeErr } = await supabase.from('flow_nodes').delete().eq('flow_id', flowId)
    if (delNodeErr) throw new Error(`Error al limpiar nodos anteriores: ${delNodeErr.message}`)

    // Insert new nodes
    if (nodes.length > 0) {
        const nodeRows = nodes.map(n => ({
            id: n.id,
            flow_id: flowId,
            type: n.type,
            label: n.label,
            position_x: Math.max(-5000, Math.min(5000, n.position_x)),
            position_y: Math.max(-5000, Math.min(5000, n.position_y)),
            config: n.config
        }))
        const { error: nodeErr } = await supabase.from('flow_nodes').insert(nodeRows)
        if (nodeErr) throw new Error(`Error al guardar los pasos del flujo: ${nodeErr.message}`)
    }

    // Insert new edges
    if (edges.length > 0) {
        const edgeRows = edges.map(e => ({
            id: e.id,
            flow_id: flowId,
            source_node_id: e.source_node_id,
            target_node_id: e.target_node_id,
            source_handle: e.source_handle,
            label: e.label
        }))
        const { error: edgeErr } = await supabase.from('flow_edges').insert(edgeRows)
        if (edgeErr) throw new Error(`Error al guardar las conexiones del flujo: ${edgeErr.message}`)
    }

    // Update flow timestamp
    await supabase
        .from('conversation_flows')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', flowId)

    revalidatePath('/dashboard/assistants')
}

// ========================
// CREATE FROM TEMPLATE
// ========================

export async function createFlowFromTemplate(
    name: string,
    description: string,
    templateNodes: { type: string; label: string; position_x: number; position_y: number; config: WizardStepConfig }[],
    templateEdges: { sourceIndex: number; targetIndex: number; source_handle: string; label: string }[]
): Promise<string | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: flow, error: flowErr } = await supabase.from('conversation_flows').insert({
        user_id: user.id,
        name,
        description,
        is_active: false,
        priority: 0
    }).select().single()

    if (flowErr || !flow) throw flowErr || new Error('Error creando flujo')

    // Generate real UUIDs for each node
    const nodeIds = templateNodes.map(() => crypto.randomUUID())

    const nodes = templateNodes.map((n, i) => ({
        id: nodeIds[i],
        flow_id: flow.id,
        type: n.type,
        label: n.label,
        position_x: n.position_x,
        position_y: n.position_y,
        config: n.config,
    }))

    if (nodes.length > 0) {
        const { error } = await supabase.from('flow_nodes').insert(nodes)
        if (error) throw error
    }

    const edges = templateEdges.map(e => ({
        id: crypto.randomUUID(),
        flow_id: flow.id,
        source_node_id: nodeIds[e.sourceIndex],
        target_node_id: nodeIds[e.targetIndex],
        source_handle: e.source_handle,
        label: e.label,
    }))

    if (edges.length > 0) {
        const { error } = await supabase.from('flow_edges').insert(edges)
        if (error) throw error
    }

    revalidatePath('/dashboard/assistants')
    return flow.id
}

// ========================
// SEED: FLUJO DE VENTAS
// ========================

export async function seedSalesFlow(): Promise<string | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Create flow
    const { data: flow, error: flowErr } = await supabase.from('conversation_flows').insert({
        user_id: user.id,
        name: 'Ventas - Servicios Digitales',
        description: 'Flujo para vender: Canva, páginas web, publicidad, creativos, logos, invitaciones',
        is_active: true,
        priority: 10
    }).select().single()

    if (flowErr || !flow) throw flowErr || new Error('Error creando flujo')

    const nodeIds = Array.from({ length: 11 }, () => crypto.randomUUID())

    const nodes = [
        { id: nodeIds[0], flow_id: flow.id, type: 'trigger', label: 'Inicio - Palabras clave', position_x: 400, position_y: 0,
          config: { trigger_type: 'keyword', keywords: ['hola', 'buenas', 'info', 'información', 'servicios', 'precios', 'cotización', 'presupuesto', 'quiero', 'necesito'], match_mode: 'contains' }
        },
        { id: nodeIds[1], flow_id: flow.id, type: 'message', label: 'Bienvenida', position_x: 400, position_y: 150,
          config: { text: '¡Hola {{contact_name}}! 👋\n\nBienvenido a *JABA Digital* 🚀\nSomos expertos en soluciones digitales para tu negocio.\n\nTe cuento lo que podemos hacer por ti:' }
        },
        { id: nodeIds[2], flow_id: flow.id, type: 'buttons', label: 'Menú de Servicios', position_x: 400, position_y: 320,
          config: {
            text: '¿Qué servicio te interesa? 👇',
            buttons: [
              { id: 'srv_canva', title: '🎨 Canva Premium' },
              { id: 'srv_web', title: '🌐 Páginas Web' },
              { id: 'srv_otros', title: '📋 Otros Servicios' }
            ]
          }
        },
        { id: nodeIds[3], flow_id: flow.id, type: 'wait_input', label: 'Esperar elección', position_x: 400, position_y: 470,
          config: { variable_name: 'servicio_elegido' }
        },
        { id: nodeIds[4], flow_id: flow.id, type: 'condition', label: '¿Es Canva?', position_x: 400, position_y: 610,
          config: { condition_type: 'interactive_id', value: 'srv_canva' }
        },
        { id: nodeIds[5], flow_id: flow.id, type: 'message', label: 'Info Canva', position_x: 100, position_y: 780,
          config: { text: '🎨 *Canva Premium - Cuentas Educativas*\n\n✅ Acceso completo a todas las funciones Premium\n✅ Miles de plantillas profesionales\n✅ Herramientas de IA incluidas\n✅ Almacenamiento ilimitado\n\nTenemos planes desde solo *Bs 39* por 3 meses.\n\n¿Te interesa? Te envío nuestros planes disponibles 👇' }
        },
        { id: nodeIds[6], flow_id: flow.id, type: 'condition', label: '¿Es Web?', position_x: 700, position_y: 780,
          config: { condition_type: 'interactive_id', value: 'srv_web' }
        },
        { id: nodeIds[7], flow_id: flow.id, type: 'message', label: 'Info Web', position_x: 500, position_y: 940,
          config: { text: '🌐 *Creación de Páginas Web*\n\n✅ Diseño moderno y responsivo\n✅ Optimización SEO\n✅ Hosting y dominio incluidos\n✅ Panel de administración fácil\n\nDesde *Bs 500* para una landing page hasta *Bs 2000* para un sitio completo.\n\n¿Te gustaría una cotización personalizada? Cuéntame sobre tu proyecto 📝' }
        },
        { id: nodeIds[8], flow_id: flow.id, type: 'message', label: 'Info Otros', position_x: 900, position_y: 940,
          config: { text: '📋 *Nuestros Otros Servicios:*\n\n🎯 *Publicidad Digital* - Desde Bs 150/mes\n  → Facebook Ads, Instagram, Google\n\n🎨 *Creativos para Redes* - Desde Bs 80\n  → Posts, stories, reels\n\n📩 *Invitaciones Digitales* - Desde Bs 30\n  → Bodas, cumpleaños, eventos\n\n🏷️ *Diseño de Logos* - Desde Bs 100\n  → Logotipo + manual de marca\n\n¿Cuál te interesa? Escríbeme y te doy más detalles 😊' }
        },
        { id: nodeIds[9], flow_id: flow.id, type: 'wait_input', label: 'Esperar detalle', position_x: 700, position_y: 1100,
          config: { variable_name: 'detalle_servicio' }
        },
        { id: nodeIds[10], flow_id: flow.id, type: 'ai_response', label: 'IA cierra venta', position_x: 700, position_y: 1250,
          config: { system_prompt: 'El cliente está interesado en nuestros servicios digitales. Tu objetivo es cerrar la venta. Sé amable, profesional y da precios claros. Si el cliente necesita una cotización personalizada, pídele los detalles. Si quiere comprar Canva, indícale los planes disponibles. Los servicios son: Canva Premium (desde Bs 39), Páginas Web (desde Bs 500), Publicidad Digital (desde Bs 150/mes), Creativos para redes (desde Bs 80), Invitaciones digitales (desde Bs 30), Logos (desde Bs 100).' }
        },
    ]

    await supabase.from('flow_nodes').insert(nodes)

    const edges = [
        { id: crypto.randomUUID(), flow_id: flow.id, source_node_id: nodeIds[0], target_node_id: nodeIds[1], source_handle: 'default', label: '' },
        { id: crypto.randomUUID(), flow_id: flow.id, source_node_id: nodeIds[1], target_node_id: nodeIds[2], source_handle: 'default', label: '' },
        { id: crypto.randomUUID(), flow_id: flow.id, source_node_id: nodeIds[2], target_node_id: nodeIds[3], source_handle: 'default', label: '' },
        { id: crypto.randomUUID(), flow_id: flow.id, source_node_id: nodeIds[3], target_node_id: nodeIds[4], source_handle: 'default', label: '' },
        { id: crypto.randomUUID(), flow_id: flow.id, source_node_id: nodeIds[4], target_node_id: nodeIds[5], source_handle: 'true', label: 'Canva' },
        { id: crypto.randomUUID(), flow_id: flow.id, source_node_id: nodeIds[4], target_node_id: nodeIds[6], source_handle: 'false', label: 'No Canva' },
        { id: crypto.randomUUID(), flow_id: flow.id, source_node_id: nodeIds[6], target_node_id: nodeIds[7], source_handle: 'true', label: 'Web' },
        { id: crypto.randomUUID(), flow_id: flow.id, source_node_id: nodeIds[6], target_node_id: nodeIds[8], source_handle: 'false', label: 'Otros' },
        { id: crypto.randomUUID(), flow_id: flow.id, source_node_id: nodeIds[7], target_node_id: nodeIds[9], source_handle: 'default', label: '' },
        { id: crypto.randomUUID(), flow_id: flow.id, source_node_id: nodeIds[8], target_node_id: nodeIds[9], source_handle: 'default', label: '' },
        { id: crypto.randomUUID(), flow_id: flow.id, source_node_id: nodeIds[9], target_node_id: nodeIds[10], source_handle: 'default', label: '' },
    ]

    await supabase.from('flow_edges').insert(edges)

    revalidatePath('/dashboard/assistants')
    return flow.id
}
