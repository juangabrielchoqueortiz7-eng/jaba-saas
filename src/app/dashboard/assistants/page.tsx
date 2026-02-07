import { createClient } from '@/utils/supabase/server'
import { Plus, Power, MessageSquare, Wrench } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DeleteAssistantButton } from './DeleteAssistantButton'

export default async function AssistantsPage() {
    const supabase = await createClient()
    // ... (rest of file) ...
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return redirect('/login')

    // Fetch existing credentials (acting as "Assistants")
    const { data: assistants } = await supabase
        .from('whatsapp_credentials')
        .select('*')
        .eq('user_id', user.id)

    return (
        <div className="p-8 max-w-5xl mx-auto animate-in fade-in duration-500">
            <header className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-white">Mis Asistentes</h1>
                <Link
                    href="/dashboard/assistants/new"
                    className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                    <Plus size={20} />
                    Agregar asistente
                </Link>
            </header>

            <div className="grid gap-4">
                {assistants?.map((asst) => (
                    <div key={asst.id} className="bg-white rounded-xl overflow-hidden shadow-sm flex items-center p-4 gap-6 group">
                        {/* Robot Icon */}
                        <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10">
                                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 4C16.42 4 20 7.58 20 12C20 16.42 16.42 20 12 20C7.58 20 4 16.42 4 12C4 7.58 7.58 4 12 4ZM12 6C8.69 6 6 8.69 6 12C6 15.31 8.69 18 12 18C15.31 18 18 15.31 18 12C18 8.69 15.31 6 12 6ZM12 8C14.21 8 16 9.79 16 12C16 14.21 14.21 16 12 16C9.79 16 8 14.21 8 12C8 9.79 9.79 8 12 8Z" />
                            </svg>
                        </div>

                        {/* Info */}
                        <div className="flex-1">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                {asst.bot_name || asst.phone_number_id || 'Asistente sin Nombre'}
                                <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                    {asst.phone_number_display || asst.phone_number_id || 'N/A'}
                                </span>
                            </h3>
                            <p className="text-slate-500">{asst.phone_number_id ? 'Conectado' : 'Pendiente de conexión'}</p>
                        </div>

                        {/* Actions (Hover) */}
                        <div className="flex items-center gap-1 text-slate-400">
                            <button title="Chat" className="hover:text-green-500 transition-colors p-2 rounded-md hover:bg-slate-100"><MessageSquare size={20} /></button>
                            <button title="Configurar" className="hover:text-blue-500 transition-colors p-2 rounded-md hover:bg-slate-100"><Wrench size={20} /></button>
                            <button title="Estado" className={`hover:text-green-500 transition-colors p-2 rounded-md hover:bg-slate-100 ${asst.ai_status === 'active' ? 'text-green-500' : ''}`}>
                                <Power size={20} />
                            </button>
                            <div className="w-px h-6 bg-slate-200 mx-1"></div>
                            <DeleteAssistantButton id={asst.id} />
                        </div>

                        {/* Select Button */}
                        <Link
                            href={`/dashboard/assistants/${asst.id}`}
                            className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                        >
                            Seleccionar
                        </Link>
                    </div>
                ))}

                {(!assistants || assistants.length === 0) && (
                    <div className="text-center py-12 bg-slate-900/50 rounded-xl border border-slate-800 border-dashed">
                        <p className="text-slate-400 mb-4">No tienes asistentes configurados.</p>
                        <Link
                            href="/dashboard/assistants/new"
                            className="text-indigo-400 hover:underline"
                        >
                            Crear tu primer asistente
                        </Link>
                    </div>
                )}
            </div>
        </div>
    )
}
