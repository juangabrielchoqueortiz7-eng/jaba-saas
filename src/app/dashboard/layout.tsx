
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return redirect('/login')
    }

    const { data: profile } = await supabase
        .from('user_profiles')
        .select('business_type, onboarding_completed')
        .eq('id', user.id)
        .maybeSingle()

    if (!profile?.business_type || !profile.onboarding_completed) {
        return redirect('/welcome')
    }

    const signOut = async () => {
        'use server'
        const supabase = await createClient()
        await supabase.auth.signOut()
        return redirect('/login')
    }

    return (
        <DashboardShell
            userEmail={user.email || ''}
            signOutAction={signOut}
        >
            {children}
        </DashboardShell>
    )
}
