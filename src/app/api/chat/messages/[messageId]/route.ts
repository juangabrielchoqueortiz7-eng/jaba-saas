import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { logger, redactId } from '@/lib/logger'

export async function DELETE(_request: Request, { params }: { params: Promise<{ messageId: string }> }) {
    try {
        const { messageId } = await params
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        if (!messageId) {
            return NextResponse.json({ error: 'Falta messageId' }, { status: 400 })
        }

        const { data: deletedMessage, error: deleteError } = await supabase
            .from('messages')
            .delete()
            .eq('id', messageId)
            .select('id, chat_id')
            .single()

        if (deleteError || !deletedMessage) {
            logger.error('[ChatMessages] Error deleting message', {
                error: deleteError,
                messageId: redactId(messageId),
            })
            return NextResponse.json({ error: 'No se pudo eliminar el mensaje' }, { status: 404 })
        }

        const { data: latestMessage } = await supabase
            .from('messages')
            .select('content, created_at, status')
            .eq('chat_id', deletedMessage.chat_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        await supabase
            .from('chats')
            .update({
                last_message: latestMessage?.content || '',
                last_message_time: latestMessage?.created_at || new Date().toISOString(),
                last_message_status: latestMessage?.status || 'sent',
            })
            .eq('id', deletedMessage.chat_id)

        return NextResponse.json({ success: true })
    } catch (error) {
        logger.error('[ChatMessages] Unexpected delete error', error)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}
