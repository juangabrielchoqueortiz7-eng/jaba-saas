'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

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
    config: any
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
    nodes: { id: string; type: string; label: string; position_x: number; position_y: number; config: any }[],
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

    // Delete existing nodes and edges (cascade will handle edges via FK)
    await supabase.from('flow_edges').delete().eq('flow_id', flowId)
    await supabase.from('flow_nodes').delete().eq('flow_id', flowId)

    // Insert new nodes
    if (nodes.length > 0) {
        const nodeRows = nodes.map(n => ({
            id: n.id,
            flow_id: flowId,
            type: n.type,
            label: n.label,
            position_x: n.position_x,
            position_y: n.position_y,
            config: n.config
        }))
        const { error: nodeErr } = await supabase.from('flow_nodes').insert(nodeRows)
        if (nodeErr) throw nodeErr
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
        if (edgeErr) throw edgeErr
    }

    // Update flow timestamp
    await supabase
        .from('conversation_flows')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', flowId)

    revalidatePath('/dashboard/assistants')
}
