import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    // Si tiene asistente, ir al dashboard del asistente
    const { data: credentials } = await supabase
        .from('whatsapp_credentials')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

    if (credentials?.id) {
        redirect(`/dashboard/assistants/${credentials.id}`)
    }

    // Sin asistente → pantalla de inicio/onboarding
    redirect('/dashboard/home')
}
