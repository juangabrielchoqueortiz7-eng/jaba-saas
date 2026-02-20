import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
    const report: {
        timestamp: string;
        env_vars: Record<string, any>;
        connection_tests: any[];
    } = {
        timestamp: new Date().toISOString(),
        env_vars: {},
        connection_tests: []
    }

    // 1. Inspect Env Vars
    const keyNames = [
        'SUPABASE_SERVICE_ROLE_KEY',
        'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
        'JABA_ADMIN_KEY',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY'
    ]

    keyNames.forEach(name => {
        const val = process.env[name];
        report.env_vars[name] = {
            defined: !!val,
            length: val ? val.length : 0,
            ends_with: val ? val.substring(val.length - 5) : 'N/A'
        }
    })

    // 2. Connection Tests
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

    for (const name of keyNames) {
        const key = process.env[name];
        if (!key) continue;

        try {
            const client = createClient(url!, key);
            const { count, error } = await client.from('whatsapp_credentials').select('*', { count: 'exact', head: true });

            report.connection_tests.push({
                key_name: name,
                success: !error && count !== null,
                count: count,
                error: error ? error.message : null
            });
        } catch (e: any) {
            report.connection_tests.push({
                key_name: name,
                success: false,
                error: e.message || String(e)
            });
        }
    }

    return NextResponse.json(report);
}
