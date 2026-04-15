import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
    asCredentials,
    asRecord,
    asRecordArray,
    formatPhone,
    getString,
    type AutomationRecord,
} from '@/lib/automation-jobs'
import { createClient as createUserClient } from '@/utils/supabase/server'
import { sendWhatsAppTemplate } from '@/lib/whatsapp'

const serviceRoleKey = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

interface BroadcastAudience {
    type: 'all' | 'service' | 'tag'
    value: string
}

interface BroadcastContact {
    correo: string
    nombre: string
    phone: string
    servicio: string
    vencimiento: string
}

interface BroadcastTemplateResult {
    error?: { message?: string }
    messages?: Array<{ id?: string }>
}

function resolveVars(text: string, ctx: Record<string, string>): string {
    return (text || '')
        .replace(/\{nombre\}/g, ctx.nombre || '')
        .replace(/\{numero\}/g, ctx.numero || '')
        .replace(/\{vencimiento\}/g, ctx.vencimiento || '')
        .replace(/\{correo\}/g, ctx.correo || '')
        .replace(/\{servicio\}/g, ctx.servicio || '')
}

function parseAudience(record: AutomationRecord | null): BroadcastAudience | null {
    if (!record) {
        return null
    }

    const type = getString(record, 'type')
    if (type !== 'all' && type !== 'service' && type !== 'tag') {
        return null
    }

    return {
        type,
        value: getString(record, 'value'),
    }
}

function toSubscriptionContacts(
    subscriptions: AutomationRecord[],
    chats: AutomationRecord[],
    countryCode: string,
): BroadcastContact[] {
    const nameByPhone = Object.fromEntries(
        chats.map(chat => [getString(chat, 'phone_number'), getString(chat, 'contact_name')]),
    )

    return subscriptions
        .map(subscription => {
            const phone = formatPhone(getString(subscription, 'numero'), countryCode)
            return {
                phone,
                nombre: nameByPhone[phone] || '',
                correo: getString(subscription, 'correo'),
                vencimiento: getString(subscription, 'vencimiento'),
                servicio: getString(subscription, 'servicio') || 'Servicio',
            }
        })
        .filter(contact => contact.phone.length >= 10)
}

function toTagContacts(chats: AutomationRecord[]): BroadcastContact[] {
    return chats
        .map(chat => ({
            phone: getString(chat, 'phone_number'),
            nombre: getString(chat, 'contact_name'),
            correo: '',
            vencimiento: '',
            servicio: '',
        }))
        .filter(contact => contact.phone.length >= 10)
}

function extractErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Error desconocido'
}

export async function POST(request: Request) {
    const supabase = await createUserClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = asRecord(await request.json())
    const templateName = getString(body ?? {}, 'templateName')
    const language = getString(body ?? {}, 'language') || 'es'
    const preview = body?.preview === true
    const variables = Array.isArray(body?.variables)
        ? body.variables.filter((value): value is string => typeof value === 'string')
        : []
    const audience = parseAudience(asRecord(body?.audience))

    if (!templateName) {
        return NextResponse.json({ error: 'Falta el nombre de la plantilla' }, { status: 400 })
    }

    if (!audience?.type) {
        return NextResponse.json({ error: 'Falta la configuracion de audiencia' }, { status: 400 })
    }

    const { data: credentialsRow } = await supabaseAdmin
        .from('whatsapp_credentials')
        .select('access_token, phone_number_id, country_code')
        .eq('user_id', user.id)
        .single()

    const credentials = asCredentials(asRecord(credentialsRow))
    if (!credentials) {
        return NextResponse.json({ error: 'Configura tus credenciales de WhatsApp en Ajustes' }, { status: 400 })
    }

    let contacts: BroadcastContact[] = []

    if (audience.type === 'service' || audience.type === 'all') {
        let query = supabaseAdmin
            .from('subscriptions')
            .select('numero, correo, vencimiento, servicio, equipo')
            .eq('user_id', user.id)
            .eq('estado', 'activo')

        if (audience.type === 'service' && audience.value) {
            query = query.eq('servicio', audience.value)
        }

        const { data: subscriptionRows } = await query
        const subscriptions = asRecordArray(subscriptionRows)
        const phones = subscriptions.map(subscription => formatPhone(getString(subscription, 'numero'), credentials.country_code))

        const { data: chatRows } = await supabaseAdmin
            .from('chats')
            .select('phone_number, contact_name')
            .eq('user_id', user.id)
            .in('phone_number', phones)

        contacts = toSubscriptionContacts(subscriptions, asRecordArray(chatRows), credentials.country_code)
    } else if (audience.type === 'tag' && audience.value) {
        const { data: chatRows } = await supabaseAdmin
            .from('chats')
            .select('phone_number, contact_name, tags')
            .eq('user_id', user.id)
            .contains('tags', [audience.value])

        contacts = toTagContacts(asRecordArray(chatRows))
    }

    const seen = new Set<string>()
    contacts = contacts.filter(contact => {
        if (seen.has(contact.phone)) return false
        seen.add(contact.phone)
        return true
    })

    if (preview) {
        return NextResponse.json({ total: contacts.length, contacts: contacts.slice(0, 5) })
    }

    if (contacts.length === 0) {
        return NextResponse.json({ error: 'No se encontraron contactos para esa audiencia' }, { status: 400 })
    }

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

            const resolvedVars = variables.map(variable => resolveVars(variable, ctx))
            const components = resolvedVars.length > 0
                ? [{
                    type: 'body',
                    parameters: resolvedVars.map(value => ({ type: 'text', text: value || ' ' })),
                }]
                : []

            const result = await sendWhatsAppTemplate(
                contact.phone,
                templateName,
                language,
                components,
                credentials.access_token,
                credentials.phone_number_id,
            ) as BroadcastTemplateResult | null

            if (result?.messages?.[0]?.id || result?.error === undefined) {
                results.sent++
            } else {
                results.failed++
                if (result.error?.message) {
                    results.errors.push(`${contact.phone}: ${result.error.message}`)
                }
            }
        } catch (error) {
            results.failed++
            results.errors.push(`${contact.phone}: ${extractErrorMessage(error)}`)
        }

        await delay(800)
    }

    console.log(`[Broadcast] Done: ${results.sent}/${results.total} sent, ${results.failed} failed`)
    return NextResponse.json(results)
}
