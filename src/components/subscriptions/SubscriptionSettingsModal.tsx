'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { MessageSquare, Save, X } from 'lucide-react';
import { toast } from 'sonner';

interface SubscriptionSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const DEFAULT_MESSAGES = {
    reminder: "Hola! 👋 Te saludamos de Jaba SaaS. Queremos recordarte que tu suscripción vence pronto ⏳. Nos encantaría que sigas con nosotros! 🚀",
    expired_grace: "Hola! ⚠️ Tu suscripción ha vencido, pero aún tienes acceso temporal. ⏳ Por favor renueva lo antes posible para evitar cortes. ✅",
    expired_removed: "Hola 👋. Tu suscripción ha finalizado y el acceso se ha cerrado 🔒. Recuerda que tus diseños se guardan por un tiempo 🕒. Renueva ahora para recuperarlos! ✨"
};

export default function SubscriptionSettingsModal({ isOpen, onClose }: SubscriptionSettingsModalProps) {
    const supabase = createClient();
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState({
        reminder_msg: DEFAULT_MESSAGES.reminder,
        expired_grace_msg: DEFAULT_MESSAGES.expired_grace,
        expired_removed_msg: DEFAULT_MESSAGES.expired_removed
    });

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        let cancelled = false;

        const loadSettings = async () => {
            const supabase = createClient();
            if (!cancelled) {
                setLoading(true);
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                if (!cancelled) {
                    setLoading(false);
                }
                return;
            }

            const { data } = await supabase
                .from('subscription_settings')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (!cancelled && data) {
                setMessages({
                    reminder_msg: data.reminder_msg || DEFAULT_MESSAGES.reminder,
                    expired_grace_msg: data.expired_grace_msg || DEFAULT_MESSAGES.expired_grace,
                    expired_removed_msg: data.expired_removed_msg || DEFAULT_MESSAGES.expired_removed
                });
            }

            if (!cancelled) {
                setLoading(false);
            }
        };

        void loadSettings();

        return () => {
            cancelled = true;
        };
    }, [isOpen]);

    const handleSave = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setLoading(true);
        const { error } = await supabase.from('subscription_settings').upsert({
            user_id: user.id,
            ...messages
        }, { onConflict: 'user_id' });

        if (error) {
            toast.error('Error al guardar configuración');
            console.error(error);
        } else {
            toast.success('Mensajes guardados correctamente');
            onClose();
        }
        setLoading(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">

                {/* Header with Gradient */}
                <div className="bg-gradient-to-r from-[#25D366] to-[#1fad52] p-6 flex justify-between items-center text-white shrink-0">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <MessageSquare className="text-indigo-100" size={24} />
                            Personalizar Mensajes
                        </h2>
                        <p className="text-indigo-100 text-sm mt-1 opacity-90">
                            Configura los mensajes automáticos de WhatsApp
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-slate-50/50">

                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg h-fit text-blue-600">
                            <MessageSquare size={18} />
                        </div>
                        <div className="text-sm text-blue-800">
                            <p className="font-semibold mb-1">¿Cómo funciona?</p>
                            <p className="opacity-90">Estos mensajes se cargarán automáticamente cuando hagas clic en el botón de WhatsApp de un cliente. El sistema elegirá el mensaje correcto según la fecha de vencimiento.</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Reminder */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group">
                            <div className="absolute top-4 right-4 text-emerald-500 bg-emerald-50 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                                Por Vencer
                            </div>
                            <label className="block text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
                                ⏳ Recordatorio Preventivo
                            </label>
                            <p className="text-xs text-[#0F172A]/35 mb-3">Se envía cuando faltan 3 días o menos.</p>
                            <textarea
                                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366] min-h-[80px] text-sm text-slate-700 bg-slate-50 focus:bg-white transition-all resize-y"
                                value={messages.reminder_msg}
                                onChange={e => setMessages(prev => ({ ...prev, reminder_msg: e.target.value }))}
                                placeholder={DEFAULT_MESSAGES.reminder}
                            />
                        </div>

                        {/* Grace Period */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group">
                            <div className="absolute top-4 right-4 text-amber-500 bg-amber-50 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                                Vencido (Gracia)
                            </div>
                            <label className="block text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
                                ⚠️ Vencido con Acceso
                            </label>
                            <p className="text-xs text-[#0F172A]/35 mb-3">Se envía cuando la fecha pasó pero sigue marcado como ACTIVO.</p>
                            <textarea
                                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366] min-h-[80px] text-sm text-slate-700 bg-slate-50 focus:bg-white transition-all resize-y"
                                value={messages.expired_grace_msg}
                                onChange={e => setMessages(prev => ({ ...prev, expired_grace_msg: e.target.value }))}
                                placeholder={DEFAULT_MESSAGES.expired_grace}
                            />
                        </div>

                        {/* Access Removed */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group">
                            <div className="absolute top-4 right-4 text-red-500 bg-red-50 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                                Sin Acceso
                            </div>
                            <label className="block text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
                                🔒 Acceso Cortado
                            </label>
                            <p className="text-xs text-[#0F172A]/35 mb-3">Se envía cuando el estado es INACTIVO.</p>
                            <textarea
                                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366] min-h-[80px] text-sm text-slate-700 bg-slate-50 focus:bg-white transition-all resize-y"
                                value={messages.expired_removed_msg}
                                onChange={e => setMessages(prev => ({ ...prev, expired_removed_msg: e.target.value }))}
                                placeholder={DEFAULT_MESSAGES.expired_removed}
                            />
                        </div>
                    </div>

                    {/* Variables Guide */}
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                        <h4 className="text-sm font-bold text-indigo-800 mb-2">📌 Variables disponibles</h4>
                        <p className="text-xs text-[#25D366] mb-2">Usa estas variables en tus mensajes y serán reemplazadas automáticamente:</p>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                            <span className="text-slate-600"><code className="bg-white px-1 py-0.5 rounded text-indigo-700 font-mono">{'{correo}'}</code> → Email del cliente</span>
                            <span className="text-slate-600"><code className="bg-white px-1 py-0.5 rounded text-indigo-700 font-mono">{'{vencimiento}'}</code> → Fecha de vencimiento</span>
                            <span className="text-slate-600"><code className="bg-white px-1 py-0.5 rounded text-indigo-700 font-mono">{'{equipo}'}</code> → Número de equipo</span>
                            <span className="text-slate-600"><code className="bg-white px-1 py-0.5 rounded text-indigo-700 font-mono">{'{planes}'}</code> → Lista de planes</span>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                    <Button
                        className="bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 font-medium px-6"
                        onClick={onClose}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={loading}
                        className="bg-gradient-to-r from-[#25D366] to-[#1fad52] hover:from-indigo-700 hover:to-violet-700 text-white gap-2 px-6 font-medium shadow-md shadow-indigo-200"
                    >
                        {loading ? 'Guardando...' : <><Save size={18} /> Guardar Mensajes</>}
                    </Button>
                </div>
            </div>
        </div>
    );
}
