'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getWalletData() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { balance_conversations: 0, balance_audio_minutes: 0 }

    const { data, error } = await supabase
        .from('whatsapp_credentials')
        .select('balance_conversations, balance_audio_minutes')
        .eq('user_id', user.id)
        .single()

    if (error) {
        console.error('Error fetching wallet:', error)
        return { balance_conversations: 0, balance_audio_minutes: 0 }
    }

    return data
}

export async function processRecharge(
    type: 'conversations' | 'audios',
    amount: number,      // Cost in USD
    credits: number      // Quantity added
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // 1. Record Transaction
    const { error: txError } = await supabase
        .from('transactions')
        .insert({
            user_id: user.id,
            amount: amount,
            currency: 'USD',
            type: type,
            credits_added: credits,
            status: 'completed',
            payment_method: 'simulated'
        })

    if (txError) throw txError

    // 2. Update Balance (Increment)
    // Supabase doesn't have a clean "increment" atomic operator via JS client easily without RPC, 
    // but for this scale, reading and updating is acceptable, OR using an RPC if strict.
    // For MVP, we will fetch current, then update. 
    // ACTUALLY, to be safer, let's use a small SQL RPC or just rely on the user being single-threaded mostly.
    // Let's do fetch-update loop for simplicity.

    // Fetch current
    const { data: current, error: fetchError } = await supabase
        .from('whatsapp_credentials')
        .select('balance_conversations, balance_audio_minutes')
        .eq('user_id', user.id)
        .single()

    if (fetchError || !current) throw new Error('Wallet not found')

    let updateData = {}
    if (type === 'conversations') {
        updateData = { balance_conversations: (current.balance_conversations || 0) + credits }
    } else {
        updateData = { balance_audio_minutes: (current.balance_audio_minutes || 0) + credits }
    }

    const { error: updateError } = await supabase
        .from('whatsapp_credentials')
        .update(updateData)
        .eq('user_id', user.id)

    if (updateError) throw updateError

    revalidatePath('/dashboard/recharges')
    return { success: true, new_balance: updateData }
}
