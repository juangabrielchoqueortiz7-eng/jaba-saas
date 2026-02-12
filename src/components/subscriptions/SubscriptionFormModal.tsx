import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { Subscription } from '@/types/subscription';
import { ImagePlus, Loader2, Sparkles } from 'lucide-react';

dayjs.extend(customParseFormat);

interface SubscriptionFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newSub: Subscription) => void;
}

export default function SubscriptionFormModal({ isOpen, onClose, onSuccess }: SubscriptionFormModalProps) {
    const supabase = createClient();
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessingImage, setIsProcessingImage] = useState(false);
    const [formData, setFormData] = useState({
        numero: '',
        correo: '',
        vencimiento: dayjs().add(1, 'month').format('YYYY-MM-DD'), // Default next month, input type="date" uses YYYY-MM-DD
        estado: 'ACTIVO',
        equipo: ''
    });

    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        let imageFile = null;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                imageFile = items[i].getAsFile();
                break;
            }
        }

        if (!imageFile) return;

        setIsProcessingImage(true);
        toast.info('Analizando imagen con IA... 🤖');

        const apiFormData = new FormData();
        apiFormData.append('image', imageFile);

        try {
            const res = await fetch('/api/extract-subscription', {
                method: 'POST',
                body: apiFormData
            });

            if (!res.ok) throw new Error('Error processing image');

            const data = await res.json();

            if (data.correo) handleChange('correo', data.correo);
            if (data.numero) handleChange('numero', data.numero);
            if (data.vencimiento) {
                // Convert DD/MM/YYYY (from API) to YYYY-MM-DD (for input)
                const parsed = dayjs(data.vencimiento, 'DD/MM/YYYY');
                if (parsed.isValid()) {
                    handleChange('vencimiento', parsed.format('YYYY-MM-DD'));
                }
            }

            toast.success('¡Datos extraídos! ✨ Verifica por favor.');
        } catch (error) {
            console.error(error);
            toast.error('No se pudo leer la imagen');
        } finally {
            setIsProcessingImage(false);
        }
    };

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No authenticated user');

            // Format date back to DD/MM/YYYY for storage if that's the convention
            // Input date gives YYYY-MM-DD
            const formattedDate = dayjs(formData.vencimiento).format('DD/MM/YYYY');

            const newSub = {
                numero: formData.numero,
                correo: formData.correo,
                vencimiento: formattedDate,
                estado: formData.estado,
                equipo: formData.equipo,
                user_id: user.id
            };

            const { data, error } = await supabase
                .from('subscriptions')
                .insert(newSub)
                .select()
                .single();

            if (error) throw error;

            toast.success('Suscripción creada exitosamente');
            onSuccess(data as Subscription);
            onClose();
            // Reset form
            setFormData({
                numero: '',
                correo: '',
                vencimiento: dayjs().add(1, 'month').format('YYYY-MM-DD'),
                estado: 'ACTIVO',
                equipo: ''
            });

        } catch (error: any) {
            console.error('Error creating subscription:', error);
            toast.error(error.message || 'Error al crear la suscripción');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">

                <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-white">Nueva Suscripción</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 18 18" /></svg>
                    </button>
                </div>

                <div
                    className="p-6 space-y-4"
                    onPaste={handlePaste}
                >
                    {/* Paste Area */}
                    <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 flex flex-col items-center justify-center text-center transition-colors hover:border-indigo-500/50 hover:bg-slate-800/50 group">
                        {isProcessingImage ? (
                            <div className="flex flex-col items-center gap-2 text-indigo-400">
                                <Loader2 className="animate-spin w-8 h-8" />
                                <span className="text-sm font-medium">Leyendo comprobante...</span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2 text-slate-500 group-hover:text-indigo-400">
                                <div className="p-3 rounded-full bg-slate-800 group-hover:bg-indigo-900/20 transition-colors">
                                    <Sparkles className="w-6 h-6" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-medium">Pegar captura aquí (Ctrl + V)</p>
                                    <p className="text-xs text-slate-600">Autocompletar con IA</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="numero" className="text-slate-300">WhatsApp (Número)</Label>
                            <Input
                                id="numero"
                                value={formData.numero}
                                onChange={(e) => handleChange('numero', e.target.value)}
                                placeholder="Ej: 59170000000"
                                className="bg-slate-800 border-slate-700 text-slate-100 focus:ring-indigo-500"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="correo" className="text-slate-300">Correo Electrónico <span className="text-red-400">*</span></Label>
                            <Input
                                id="correo"
                                type="email"
                                required
                                value={formData.correo}
                                onChange={(e) => handleChange('correo', e.target.value)}
                                placeholder="cliente@ejemplo.com"
                                className="bg-slate-800 border-slate-700 text-slate-100 focus:ring-indigo-500"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="vencimiento" className="text-slate-300">Fecha de Vencimiento</Label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {[
                                    { label: '+1 Mes', months: 1 },
                                    { label: '+3 Meses', months: 3 },
                                    { label: '+6 Meses', months: 6 },
                                    { label: '+9 Meses', months: 9 },
                                    { label: '+1 Año', months: 12 },
                                ].map((plan) => (
                                    <button
                                        key={plan.label}
                                        type="button"
                                        onClick={() => handleChange('vencimiento', dayjs().add(plan.months, 'month').format('YYYY-MM-DD'))}
                                        className="px-2 py-1 text-xs font-medium rounded bg-indigo-900/40 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-900/60 hover:border-indigo-500/50 transition-colors"
                                    >
                                        {plan.label}
                                    </button>
                                ))}
                            </div>
                            <Input
                                id="vencimiento"
                                type="date"
                                required
                                value={formData.vencimiento}
                                onChange={(e) => handleChange('vencimiento', e.target.value)}
                                className="bg-slate-800 border-slate-700 text-slate-100 focus:ring-indigo-500 block w-full"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="estado" className="text-slate-300">Estado</Label>
                                <Select
                                    value={formData.estado}
                                    onValueChange={(val) => handleChange('estado', val)}
                                >
                                    <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                                        <SelectValue placeholder="Estado" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                                        <SelectItem value="ACTIVO">ACTIVO</SelectItem>
                                        <SelectItem value="INACTIVO">INACTIVO</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="equipo" className="text-slate-300">Equipo</Label>
                                <Input
                                    id="equipo"
                                    value={formData.equipo}
                                    onChange={(e) => handleChange('equipo', e.target.value)}
                                    placeholder="Opcional"
                                    className="bg-slate-800 border-slate-700 text-slate-100 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end gap-3">
                            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium transition-colors text-slate-400 hover:text-white hover:bg-slate-800">
                                Cancelar
                            </button>
                            <Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                {isLoading ? 'Guardando...' : 'Guardar Suscripción'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
