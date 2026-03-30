import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createUserClient } from '@/utils/supabase/server'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
    try {
        const userClient = await createUserClient()
        const { data: { user }, error: authError } = await userClient.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { userId } = await req.json()
        if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
        if (userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

        // =====================
        // 1. FLUJO DE VENTAS - SERVICIOS DIGITALES
        // =====================
        const { data: salesFlow } = await supabaseAdmin.from('conversation_flows').insert({
            user_id: userId,
            name: 'Ventas - Servicios Digitales',
            description: 'Flujo para vender servicios: Canva, páginas web, publicidad, creativos, logos, invitaciones',
            is_active: true,
            priority: 10
        }).select().single()

        if (!salesFlow) return NextResponse.json({ error: 'Error creating sales flow' }, { status: 500 })

        // --- NODOS ---
        const nodes = [
            // Trigger
            { id: crypto.randomUUID(), type: 'trigger', label: 'Inicio - Palabras clave', position_x: 400, position_y: 0,
              config: { trigger_type: 'keyword', keywords: ['hola', 'buenas', 'info', 'información', 'servicios', 'precios', 'cotización', 'presupuesto', 'quiero', 'necesito'], match_mode: 'contains' }
            },
            // Bienvenida
            { id: crypto.randomUUID(), type: 'message', label: 'Bienvenida', position_x: 400, position_y: 150,
              config: { text: '¡Hola {{contact_name}}! 👋\n\nBienvenido a *JABA Digital* 🚀\nSomos expertos en soluciones digitales para tu negocio.\n\nTe cuento lo que podemos hacer por ti:' }
            },
            // Botones de servicios
            { id: crypto.randomUUID(), type: 'buttons', label: 'Menú de Servicios', position_x: 400, position_y: 320,
              config: {
                text: '¿Qué servicio te interesa? 👇',
                buttons: [
                  { id: 'srv_canva', title: '🎨 Canva Premium' },
                  { id: 'srv_web', title: '🌐 Páginas Web' },
                  { id: 'srv_otros', title: '📋 Otros Servicios' }
                ]
              }
            },
            // Esperar selección
            { id: crypto.randomUUID(), type: 'wait_input', label: 'Esperar elección', position_x: 400, position_y: 470,
              config: { variable_name: 'servicio_elegido' }
            },
            // Condición: ¿Canva?
            { id: crypto.randomUUID(), type: 'condition', label: '¿Es Canva?', position_x: 400, position_y: 610,
              config: { condition_type: 'interactive_id', value: 'srv_canva' }
            },
            // === RAMA CANVA ===
            { id: crypto.randomUUID(), type: 'message', label: 'Info Canva', position_x: 100, position_y: 780,
              config: { text: '🎨 *Canva Premium - Cuentas Educativas*\n\n✅ Acceso completo a todas las funciones Premium\n✅ Miles de plantillas profesionales\n✅ Herramientas de IA incluidas\n✅ Almacenamiento ilimitado\n\nTenemos planes desde solo *Bs 39* por 3 meses.\n\n¿Te interesa? Te envío nuestros planes disponibles 👇' }
            },
            // === RAMA NO-CANVA ===
            // Condición: ¿Web?
            { id: crypto.randomUUID(), type: 'condition', label: '¿Es Web?', position_x: 700, position_y: 780,
              config: { condition_type: 'interactive_id', value: 'srv_web' }
            },
            // Info Web
            { id: crypto.randomUUID(), type: 'message', label: 'Info Web', position_x: 500, position_y: 940,
              config: { text: '🌐 *Creación de Páginas Web*\n\n✅ Diseño moderno y responsivo\n✅ Optimización SEO\n✅ Hosting y dominio incluidos\n✅ Panel de administración fácil\n\nDesde *Bs 500* para una landing page hasta *Bs 2000* para un sitio completo.\n\n¿Te gustaría una cotización personalizada? Cuéntame sobre tu proyecto 📝' }
            },
            // Info Otros Servicios
            { id: crypto.randomUUID(), type: 'message', label: 'Info Otros', position_x: 900, position_y: 940,
              config: { text: '📋 *Nuestros Otros Servicios:*\n\n🎯 *Publicidad Digital* - Desde Bs 150/mes\n  → Facebook Ads, Instagram, Google\n\n🎨 *Creativos para Redes* - Desde Bs 80\n  → Posts, stories, reels\n\n📩 *Invitaciones Digitales* - Desde Bs 30\n  → Bodas, cumpleaños, eventos\n\n🏷️ *Diseño de Logos* - Desde Bs 100\n  → Logotipo + manual de marca\n\n¿Cuál te interesa? Escríbeme y te doy más detalles 😊' }
            },
            // Esperar respuesta final → IA
            { id: crypto.randomUUID(), type: 'wait_input', label: 'Esperar detalle', position_x: 700, position_y: 1100,
              config: { variable_name: 'detalle_servicio' }
            },
            // IA para cerrar la conversación
            { id: crypto.randomUUID(), type: 'ai_response', label: 'IA cierra venta', position_x: 700, position_y: 1250,
              config: { system_prompt: 'El cliente está interesado en nuestros servicios digitales. Tu objetivo es cerrar la venta. Sé amable, profesional y da precios claros. Si el cliente necesita una cotización personalizada, pídele los detalles. Si quiere comprar Canva, indícale los planes disponibles. Los servicios son: Canva Premium (desde Bs 39), Páginas Web (desde Bs 500), Publicidad Digital (desde Bs 150/mes), Creativos para redes (desde Bs 80), Invitaciones digitales (desde Bs 30), Logos (desde Bs 100).' }
            },
        ]

        // Insert nodes
        const { data: insertedNodes } = await supabaseAdmin.from('flow_nodes').insert(
            nodes.map(n => ({ ...n, flow_id: salesFlow.id }))
        ).select()

        if (!insertedNodes) return NextResponse.json({ error: 'Error creating nodes' }, { status: 500 })

        // --- EDGES ---
        const nodeMap: Record<string, string> = {}
        insertedNodes.forEach((n: any, i: number) => { nodeMap[`n${i}`] = n.id })

        const edges = [
            // Trigger → Bienvenida
            { flow_id: salesFlow.id, source_node_id: nodeMap['n0'], target_node_id: nodeMap['n1'], source_handle: 'default', label: '' },
            // Bienvenida → Botones
            { flow_id: salesFlow.id, source_node_id: nodeMap['n1'], target_node_id: nodeMap['n2'], source_handle: 'default', label: '' },
            // Botones → Esperar
            { flow_id: salesFlow.id, source_node_id: nodeMap['n2'], target_node_id: nodeMap['n3'], source_handle: 'default', label: '' },
            // Esperar → Condición Canva
            { flow_id: salesFlow.id, source_node_id: nodeMap['n3'], target_node_id: nodeMap['n4'], source_handle: 'default', label: '' },
            // Canva = Sí → Info Canva
            { flow_id: salesFlow.id, source_node_id: nodeMap['n4'], target_node_id: nodeMap['n5'], source_handle: 'true', label: 'Canva' },
            // Canva = No → Condición Web
            { flow_id: salesFlow.id, source_node_id: nodeMap['n4'], target_node_id: nodeMap['n6'], source_handle: 'false', label: 'No Canva' },
            // Web = Sí → Info Web
            { flow_id: salesFlow.id, source_node_id: nodeMap['n6'], target_node_id: nodeMap['n7'], source_handle: 'true', label: 'Web' },
            // Web = No → Info Otros
            { flow_id: salesFlow.id, source_node_id: nodeMap['n6'], target_node_id: nodeMap['n8'], source_handle: 'false', label: 'Otros' },
            // Info Web → Esperar detalle
            { flow_id: salesFlow.id, source_node_id: nodeMap['n7'], target_node_id: nodeMap['n9'], source_handle: 'default', label: '' },
            // Info Otros → Esperar detalle
            { flow_id: salesFlow.id, source_node_id: nodeMap['n8'], target_node_id: nodeMap['n9'], source_handle: 'default', label: '' },
            // Esperar detalle → IA cierra
            { flow_id: salesFlow.id, source_node_id: nodeMap['n9'], target_node_id: nodeMap['n10'], source_handle: 'default', label: '' },
        ]

        await supabaseAdmin.from('flow_edges').insert(
            edges.map(e => ({ ...e, id: crypto.randomUUID() }))
        )

        return NextResponse.json({
            success: true,
            flowId: salesFlow.id,
            message: 'Flujo de ventas creado con éxito'
        })

    } catch (err: any) {
        console.error('Error seeding flow:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
