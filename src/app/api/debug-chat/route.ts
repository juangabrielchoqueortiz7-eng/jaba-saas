import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
    const report: any = {}

    // 1. Setup Admin Client
    const SERVICE_ROLE_KEY = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
    report.key_present = !!SERVICE_ROLE_KEY;

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // 2. Define Targets (Matches the failing case)
    const targetPhone = "59169344192";
    const targetPhoneId = "1017996884730043";

    // 3. Lookup Tenant
    const { data: creds } = await supabaseAdmin
        .from('whatsapp_credentials')
        .select('user_id')
        .eq('phone_number_id', targetPhoneId)
        .single();

    report.tenant_lookup = { found: !!creds, user_id: creds?.user_id };

    if (!creds) return NextResponse.json(report);

    const tenantUserId = creds.user_id;

    // 4. Lookup Chat (The Failing Logic)
    const { data: existingChat, error: chatError } = await supabaseAdmin
        .from('chats')
        .select('id, user_id, phone_number')
        .eq('phone_number', targetPhone)
        .eq('user_id', tenantUserId)
        .maybeSingle()

    report.chat_lookup_exact = {
        found: !!existingChat,
        data: existingChat,
        error: chatError?.message
    };

    // 5. Lookup Chat (Loose - Phone Only)
    const { data: looseChat } = await supabaseAdmin
        .from('chats')
        .select('id, user_id, phone_number')
        .eq('phone_number', targetPhone)
        .maybeSingle()

    report.chat_lookup_loose = {
        found: !!looseChat,
        data: looseChat,
        match_user_id: looseChat?.user_id === tenantUserId
    };

    return NextResponse.json(report);
}
