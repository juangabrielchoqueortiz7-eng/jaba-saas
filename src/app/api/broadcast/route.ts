import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createUserClient } from '@/utils/supabase/server'
import { sendWhatsAppTemplate } from '@/lib/whatsapp'

const serviceRoleKey = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

function resolveVars(text: string, ctx: Record<string, string>): string {
    return (text || '')
        .replace(/\{nombre\}/g, ctx.nombre || '')
        .replace(/\{numero\}/g, ctx.numero || '')
        .replace(/\{vencimiento\}/g, ctx.vencimiento || '')
        .replace(/\{correo\}/g, ctx.correo || '')
        .replace(/\{servicio\}/g, ctx.servicio || '')
}

// ─────────────────────────────────────────────────────────────
// POST /api/broadcast
// Body: { templateName, language, variables, audience, preview? }
// ─────────────────────────────────────────────────────────────
export async function POST(request: Request) {
    const supabase = await createUserClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { templateName, language = 'es', variables = [], audience, preview = false } = body

    if (!templateName) {
        return NextResponse.json({ error: 'Falta el nombre de la plantilla' }, { status: 400 })
    }
    if (!audience?.type) {
        return NextResponse.json({ error: 'Falta la configuración de audiencia' }, { status: 400 })
    }

    // Obtener credenciales WhatsApp del usuario
    const { data: creds } = await supabaseAdmin
        .from('whatsapp_credentials')
        .select('access_token, phone_number_id')
        .eq('user_id', user.id)
        .single()

    if (!creds?.access_token || !creds?.phone_number_id) {
        return NextResponse.json({ error: 'Configura tus credenciales de WhatsApp en Ajustes' }, { status: 400 })
    }

    // ── Construir lista de contactos según audiencia ──────────
    let contacts: Array<{ phone: string; nombre: string; correo: string; vencimiento: string; servicio: string }> = []

    if (audience.type === 'service' || audience.type === 'all') {
        let query = supabaseAdmin
            .from('subscriptions')
            .select('numero, correo, vencimiento, servicio, equipo')
            .eq('user_id', user.id)
            .eq('estado', 'activo')

        if (audience.type === 'service' && audience.value) {
            query = query.eq('servicio', audience.value)
        }

        const { data: subs } = await query

        // Obtener nombres desde chats
        const phones = (subs || []).map(s => {
            const clean = s.numero.replace(/\D/g, '')
            return clean.startsWith('591') ? clean : '591' + clean
        })

        const { data: chats } = await supabaseAdmin
            .from('chats')
            .select('phone_number, contact_name')
            .eq('user_id', user.id)
            .in('phone_number', phones)

        const nameByPhone = Object.fromEntries((chats || []).map(c => [c.phone_number, c.contact_name || '']))

        contacts = (subs || []).map(sub => {
            const clean = sub.numero.replace(/\D/g, '')
            const phone = clean.startsWith('591') ? clean : '591' + clean
            return {
                phone,
                nombre: nameByPhone[phone] || '',
                correo: sub.correo || '',
                vencimiento: sub.vencimiento || '',
                servicio: sub.servicio || 'CANVA',
            }
        }).filter(c => c.phone.length >= 10)

    } else if (audience.type === 'tag' && audience.value) {
        const { data: chats } = await supabaseAdmin
            .from('chats')
            .select('phone_number, contact_name, tags')
            .eq('user_id', user.id)
            .contains('tags', [audience.value])

        contacts = (chats || [])
            .filter(c => c.phone_number && c.phone_number.length >= 10)
            .map(c => ({
                phone: c.phone_number,
                nombre: c.contact_name || '',
                correo: '',
                vencimiento: '',
                servicio: '',
            }))
    }

    // Eliminar duplicados por número
    const seen = new Set<string>()
    contacts = contacts.filter(c => {
        if (seen.has(c.phone)) return false
        seen.add(c.phone)
        return true
    })

    // Si es preview, solo devolver el conteo
    if (preview) {
        return NextResponse.json({ total: contacts.length, contacts: contacts.slice(0, 5) })
    }

    if (contacts.length === 0) {
        return NextResponse.json({ error: 'No se encontraron contactos para esa audiencia' }, { status: 400 })
    }

    // ── Envío masivo ──────────────────────────────────────────
    const results = { sent: 0, failed: 0, total: contacts.length, errors: [] as string[] }

    for (const contact of contacts) {
        try {
            const ctx = {
                nombre: contact.nombre,
                numero: contact.phone,
                correo: contact.correo,
                vencimiento: contact.vencimiento,
                servicio: contact.servicio,
            }

            const resolvedVars = (variables as string[]).map(v => resolveVars(v, ctx))
            const components: any[] = []
            if (resolvedVars.length > 0) {
                components.push({
                    type: 'body',
                    parameters: resolvedVars.map(v => ({ type: 'text', text: v || ' ' }))
                })
            }

            const result = await sendWhatsAppTemplate(
                contact.phone,
                templateName,
                language,
                components,
                creds.access_token,
                creds.phone_number_id
            )

            if (result?.messages?.[0]?.id || result?.error === undefined) {
                results.sent++
            } else {
                results.failed++
                if (result?.error?.message) {
                    results.errors.push(`${contact.phone}: ${result.error.message}`)
                }
            }
        } catch (err: any) {
            results.failed++
            results.errors.push(`${contact.phone}: ${err.message || 'Error desconocido'}`)
        }

        // Delay entre envíos para respetar rate limit de Meta
        await delay(800)
    }

    console.log(`[Broadcast] Done: ${results.sent}/${results.total} sent, ${results.failed} failed`)
    return NextResponse.json(results)
}
