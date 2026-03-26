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
import { ImagePlus, Loader2, Sparkles, Eye, EyeOff } from 'lucide-react';

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
    const [fileInputKey, setFileInputKey] = useState(0);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        numero: '',
        correo: '',
        vencimiento: dayjs().add(1, 'month').format('YYYY-MM-DD'),
        estado: 'ACTIVO',
        equipo: '',
        servicio: 'CANVA',
        password: ''
    });

    const processImage = async (file: File) => {
        setIsProcessingImage(true);
        toast.info('Analizando imagen con IA... 🤖');

        const apiFormData = new FormData();
        apiFormData.append('image', file);

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
            setFileInputKey(prev => prev + 1);
        }
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) processImage(file);
                break;
            }
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                processImage(file);
            } else {
                toast.error('Por favor suelta una imagen válida');
            }
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processImage(e.target.files[0]);
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

            const newSub: Record<string, any> = {
                numero: formData.numero,
                correo: formData.correo,
                vencimiento: formattedDate,
                estado: formData.estado,
                equipo: formData.equipo,
                servicio: formData.servicio,
                user_id: user.id
            };
            if (formData.servicio !== 'CANVA' && formData.password) {
                newSub.password = formData.password;
            }

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
                equipo: '',
                servicio: 'CANVA',
                password: ''
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
        <div className="fixed inset-0 bg-[#0a0a0a]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0a0a0a] border border-white/6 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">

                <div className="p-6 border-b border-white/6 flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-white">Nueva Suscripción</h2>
                    <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 18 18" /></svg>
                    </button>
                </div>

                <div
                    className="p-6 space-y-4"
                    onPaste={handlePaste}
                >
                    {/* Paste / Drop / Click Area */}
                    <div
                        className="border-2 border-dashed border-white/8 rounded-lg p-6 flex flex-col items-center justify-center text-center transition-colors hover:border-[#25D366]/50 hover:bg-[#111]/50 group cursor-pointer"
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onClick={() => document.getElementById('imageUploadInput')?.click()}
                    >
                        <input
                            key={fileInputKey}
                            type="file"
                            id="imageUploadInput"
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileSelect}
                        />

                        {isProcessingImage ? (
                            <div className="flex flex-col items-center gap-2 text-[#4ade80]">
                                <Loader2 className="animate-spin w-8 h-8" />
                                <span className="text-sm font-medium">Leyendo comprobante...</span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2 text-white/35 group-hover:text-[#4ade80]">
                                <div className="p-3 rounded-full bg-[#111] group-hover:bg-[#25D366]/900/20 transition-colors">
                                    <Sparkles className="w-6 h-6" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-medium">Pegar (Ctrl+V), Arrastrar o <span className="underline">Clic para subir</span></p>
                                    <p className="text-xs text-slate-600">Autocompletar con IA</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="servicio" className="text-white/65">Servicio</Label>
                            <Select
                                value={formData.servicio}
                                onValueChange={(val) => handleChange('servicio', val)}
                            >
                                <SelectTrigger className="bg-[#111] border-white/8 text-slate-100">
                                    <SelectValue placeholder="Servicio" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#111] border-white/8 text-slate-100">
                                    <SelectItem value="CANVA">🎨 Canva</SelectItem>
                                    <SelectItem value="CHATGPT">🤖 ChatGPT</SelectItem>
                                    <SelectItem value="GEMINI">✨ Gemini</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="numero" className="text-white/65">WhatsApp (Número)</Label>
                            <Input
                                id="numero"
                                value={formData.numero}
                                onChange={(e) => handleChange('numero', e.target.value)}
                                placeholder="Ej: 59170000000"
                                className="bg-[#111] border-white/8 text-slate-100 focus:ring-[#25D366]"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="correo" className="text-white/65">
                                {formData.servicio === 'CANVA' ? 'Correo del Cliente' : 'Correo de la Cuenta'} <span className="text-red-400">*</span>
                            </Label>
                            <Input
                                id="correo"
                                type="email"
                                required
                                value={formData.correo}
                                onChange={(e) => handleChange('correo', e.target.value)}
                                placeholder={formData.servicio === 'CANVA' ? 'cliente@ejemplo.com' : 'cuenta@tudominio.com'}
                                className="bg-[#111] border-white/8 text-slate-100 focus:ring-[#25D366]"
                            />
                        </div>

                        {formData.servicio !== 'CANVA' && (
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-white/65">Contraseña de la Cuenta</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={formData.password}
                                        onChange={(e) => handleChange('password', e.target.value)}
                                        placeholder="Contraseña de tu cuenta compartida"
                                        className="bg-[#111] border-white/8 text-slate-100 focus:ring-[#25D366] pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(p => !p)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-slate-200"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="vencimiento" className="text-white/65">Fecha de Vencimiento</Label>
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
                                        className="px-2 py-1 text-xs font-medium rounded bg-indigo-900/40 text-indigo-300 border border-[#25D366]/30 hover:bg-[#25D366]/900/60 hover:border-[#25D366]/50 transition-colors"
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
                                className="bg-[#111] border-white/8 text-slate-100 focus:ring-[#25D366] block w-full"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="estado" className="text-white/65">Estado</Label>
                                <Select
                                    value={formData.estado}
                                    onValueChange={(val) => handleChange('estado', val)}
                                >
                                    <SelectTrigger className="bg-[#111] border-white/8 text-slate-100">
                                        <SelectValue placeholder="Estado" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#111] border-white/8 text-slate-100">
                                        <SelectItem value="ACTIVO">ACTIVO</SelectItem>
                                        <SelectItem value="INACTIVO">INACTIVO</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="equipo" className="text-white/65">Equipo</Label>
                                <Input
                                    id="equipo"
                                    value={formData.equipo}
                                    onChange={(e) => handleChange('equipo', e.target.value)}
                                    placeholder="Opcional"
                                    className="bg-[#111] border-white/8 text-slate-100 focus:ring-[#25D366]"
                                />
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end gap-3">
                            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium transition-colors text-white/40 hover:text-white hover:bg-[#111]">
                                Cancelar
                            </button>
                            <Button type="submit" disabled={isLoading} className="bg-[#25D366] hover:bg-[#25D366]/700 text-white">
                                {isLoading ? 'Guardando...' : 'Guardar Suscripción'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
