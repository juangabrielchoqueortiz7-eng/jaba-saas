import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { Subscription } from '@/types/subscription';

interface SubscriptionFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newSub: Subscription) => void;
}

export default function SubscriptionFormModal({ isOpen, onClose, onSuccess }: SubscriptionFormModalProps) {
    const supabase = createClient();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        numero: '',
        correo: '',
        vencimiento: dayjs().add(1, 'month').format('YYYY-MM-DD'), // Default next month, input type="date" uses YYYY-MM-DD
        estado: 'ACTIVO',
        equipo: ''
    });

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

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                        <Button type="button" variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white hover:bg-slate-800">
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            {isLoading ? 'Guardando...' : 'Guardar Suscripción'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
