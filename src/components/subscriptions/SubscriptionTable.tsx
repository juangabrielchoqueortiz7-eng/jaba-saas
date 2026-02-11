'use client';

import { useState, useMemo, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Subscription } from '@/types/subscription';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { Trash2, Copy, MessageCircle, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import SubscriptionCard from './SubscriptionCard';

dayjs.extend(customParseFormat);

interface SubscriptionTableProps {
    subscriptions: Subscription[];
    isLoading: boolean;
}

export default function SubscriptionTable({ subscriptions, isLoading }: SubscriptionTableProps) {
    const supabase = createClient();
    const [filtersState, setFilters] = useState({
        numero: '',
        correo: '',
        vencimiento: '',
        equipo: '',
        status: 'ACTIVO' // 'ACTIVO' | 'INACTIVO'
    });

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const filters = useMemo(() => filtersState, [filtersState]); // Fix potential infinite loop if passed directly

    const handleUpdate = async (id: string, field: keyof Subscription, value: any) => {
        try {
            const { error } = await supabase
                .from('subscriptions')
                .update({ [field]: value })
                .eq('id', id);

            if (error) throw error;
            toast.success('Actualizado correctamente');
        } catch (error) {
            console.error('Error updating:', error);
            toast.error('Error al actualizar');
        }
    };

    const toggleStatus = async (sub: Subscription) => {
        const newStatus = sub.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
        await handleUpdate(sub.id, 'estado', newStatus);
        if (newStatus === 'ACTIVO') {
            await handleUpdate(sub.id, 'notified', false);
        }
    };

    const filteredData = useMemo(() => {
        return subscriptions.filter(sub => {
            // Status Filter
            if (filtersState.status && (sub.estado || '').toUpperCase() !== filtersState.status) return false;

            // Column Filters
            if (filtersState.numero && !sub.numero?.toLowerCase().includes(filtersState.numero.toLowerCase())) return false;
            if (filtersState.correo && !sub.correo?.toLowerCase().includes(filtersState.correo.toLowerCase())) return false;
            if (filtersState.vencimiento && !sub.vencimiento?.toLowerCase().includes(filtersState.vencimiento.toLowerCase())) return false;
            if (filtersState.equipo && !sub.equipo?.toLowerCase().includes(filtersState.equipo.toLowerCase())) return false;

            return true;
        }).sort((a, b) => {
            // Basic sort: active first, then by date (simplified)
            if (a.estado === 'ACTIVO' && b.estado !== 'ACTIVO') return -1;
            if (a.estado !== 'ACTIVO' && b.estado === 'ACTIVO') return 1;
            return 0;
        });
    }, [subscriptions, filtersState]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const getDateStatus = (dateString: string) => {
        if (!dateString) return { className: 'text-slate-400', label: 'Sin Fecha', days: Infinity };

        let date = dayjs(dateString, ['DD/MM/YYYY', 'YYYY-MM-DD'], true);
        if (!date.isValid()) date = dayjs(dateString); // Fallback

        if (!date.isValid()) return { className: 'text-slate-400', label: dateString, days: Infinity };

        const diff = date.diff(dayjs().startOf('day'), 'day');

        if (diff < 0) return { className: 'text-red-600 font-bold bg-red-50', label: date.format('DD/MM/YYYY'), days: diff };
        if (diff <= 3) return { className: 'text-amber-600 font-bold bg-amber-50', label: date.format('DD/MM/YYYY'), days: diff };
        if (diff <= 7) return { className: 'text-indigo-600 font-semibold', label: date.format('DD/MM/YYYY'), days: diff };

        return { className: 'text-slate-700', label: date.format('DD/MM/YYYY'), days: diff };
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copiado al portapapeles');
    };

    const openWhatsApp = (sub: Subscription) => {
        const phone = sub.numero.replace(/\D/g, '');
        const fullPhone = (phone.length === 8 && (phone.startsWith('6') || phone.startsWith('7'))) ? '591' + phone : phone;

        if (!fullPhone) {
            toast.error('Número inválido');
            return;
        }

        let message = '';
        const dateInfo = getDateStatus(sub.vencimiento);

        if (dateInfo.days < 0) {
            message = `Hola, tu suscripción venció el ${sub.vencimiento}. Por favor realiza el pago para renovar el servicio.`;
        } else if (dateInfo.days <= 3) {
            message = `Hola, te recordamos que tu suscripción vence pronto, el ${sub.vencimiento}. Evita cortes en el servicio renovando a tiempo.`;
        } else {
            message = `Hola, tienes una suscripción activa hasta el ${sub.vencimiento}.`;
        }

        const encodedMessage = encodeURIComponent(message);
        const url = `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodedMessage}`;

        window.open(url, '_blank');
        handleUpdate(sub.id, 'notified', true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta suscripción?')) return;
        const { error } = await supabase.from('subscriptions').delete().eq('id', id);
        if (error) toast.error('Error al eliminar');
        else toast.success('Eliminado');
    };

    return (
        <div className="space-y-4">
            {/* Tabs & Search */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex space-x-2 bg-slate-800 p-1 rounded-lg w-fit border border-slate-700">
                    <button
                        onClick={() => { setFilters(prev => ({ ...prev, status: 'ACTIVO' })); setCurrentPage(1); }}
                        className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 transition-all ${filtersState.status === 'ACTIVO' ? 'bg-slate-700 text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        <CheckCircle size={16} /> Activos
                    </button>
                    <button
                        onClick={() => { setFilters(prev => ({ ...prev, status: 'INACTIVO' })); setCurrentPage(1); }}
                        className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 transition-all ${filtersState.status === 'INACTIVO' ? 'bg-slate-700 text-amber-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        <XCircle size={16} /> Inactivos
                    </button>
                </div>
            </div>

            {/* Mobile View: Cards */}
            <div className="block md:hidden space-y-4">
                {isLoading ? (
                    <div className="text-center py-10 text-slate-400">Cargando...</div>
                ) : paginatedData.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">No hay registros</div>
                ) : (
                    paginatedData.map(sub => (
                        <SubscriptionCard
                            key={sub.id}
                            sub={sub}
                            onUpdate={handleUpdate}
                            onToggleStatus={toggleStatus}
                            onDelete={handleDelete}
                            onWhatsApp={openWhatsApp}
                            onCopy={copyToClipboard}
                            dateInfo={getDateStatus(sub.vencimiento)}
                        />
                    ))
                )}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-950 text-slate-400 uppercase text-xs border-b border-slate-800">
                            <tr>
                                <th className="px-6 py-3 min-w-[140px]">
                                    <div className="flex flex-col gap-1">
                                        <span>WhatsApp</span>
                                        <input
                                            type="text"
                                            placeholder="Buscar..."
                                            className="w-full text-xs border-slate-700 bg-slate-800 rounded px-2 py-1 font-normal text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                                            value={filtersState.numero}
                                            onChange={(e) => { setFilters(prev => ({ ...prev, numero: e.target.value })); setCurrentPage(1); }}
                                        />
                                    </div>
                                </th>
                                <th className="px-6 py-3 min-w-[200px]">
                                    <div className="flex flex-col gap-1">
                                        <span>Correo</span>
                                        <input
                                            type="text"
                                            placeholder="Buscar..."
                                            className="w-full text-xs border-slate-700 bg-slate-800 rounded px-2 py-1 font-normal text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                                            value={filtersState.correo}
                                            onChange={(e) => { setFilters(prev => ({ ...prev, correo: e.target.value })); setCurrentPage(1); }}
                                        />
                                    </div>
                                </th>
                                <th className="px-6 py-3 min-w-[120px]">
                                    <div className="flex flex-col gap-1">
                                        <span>Vencimiento</span>
                                        <input
                                            type="text"
                                            placeholder="Fecha..."
                                            className="w-full text-xs border-slate-700 bg-slate-800 rounded px-2 py-1 font-normal text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                                            value={filtersState.vencimiento}
                                            onChange={(e) => { setFilters(prev => ({ ...prev, vencimiento: e.target.value })); setCurrentPage(1); }}
                                        />
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-center w-[140px]">Estado</th>
                                <th className="px-6 py-3 w-[100px]">
                                    <div className="flex flex-col gap-1">
                                        <span>Equipo</span>
                                        <input
                                            type="text"
                                            placeholder="Eq..."
                                            className="w-full text-xs border-slate-700 bg-slate-800 rounded px-2 py-1 font-normal text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                                            value={filtersState.equipo}
                                            onChange={(e) => { setFilters(prev => ({ ...prev, equipo: e.target.value })); setCurrentPage(1); }}
                                        />
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-center min-w-[140px]">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-10 text-slate-500">Cargando...</td>
                                </tr>
                            ) : paginatedData.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-10 text-slate-500">No hay registros</td>
                                </tr>
                            ) : (
                                paginatedData.map(sub => {
                                    const dateInfo = getDateStatus(sub.vencimiento);
                                    // Adjust dateInfo colors for dark mode
                                    // We need to override the classnames from getDateStatus or modify getDateStatus. 
                                    // For simplicity, I'll modify getDateStatus return values in the function above, or just override here.
                                    // Actually, I should modify getDateStatus to return appropriate dark mode classes.
                                    // Let's modify getDateStatus in a separate edit or assume I can't easily.
                                    // Wait, I can't modify getDateStatus here easily without changing the whole file. 
                                    // I will just let dateInfo classes be what they use if they work, but they use bg-red-50 etc. 
                                    // I should update getDateStatus too.

                                    return (
                                        <tr key={sub.id} className="hover:bg-slate-800/50 group transition-colors">
                                            <td className="px-6 py-3">
                                                <input
                                                    className="bg-transparent w-full focus:outline-none focus:bg-slate-800 focus:ring-1 focus:ring-indigo-500 rounded px-1 text-slate-300 font-mono"
                                                    defaultValue={sub.numero}
                                                    onBlur={(e) => handleUpdate(sub.id, 'numero', e.target.value)}
                                                />
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        className="bg-transparent w-full focus:outline-none focus:bg-slate-800 focus:ring-1 focus:ring-indigo-500 rounded px-1 truncate text-slate-300"
                                                        defaultValue={sub.correo}
                                                        onBlur={(e) => handleUpdate(sub.id, 'correo', e.target.value)}
                                                    />
                                                    <button onClick={() => copyToClipboard(sub.correo)} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-indigo-400 transition-opacity">
                                                        <Copy size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3">
                                                {/* Custom logic to map light classes to dark */}
                                                <input
                                                    className={`bg-transparent w-full focus:outline-none focus:bg-slate-800 focus:ring-1 focus:ring-indigo-500 rounded px-1 ${dateInfo.className.replace('text-slate-700', 'text-slate-300').replace('bg-red-50', 'bg-red-900/20 text-red-400').replace('bg-amber-50', 'bg-amber-900/20 text-amber-400').replace('text-indigo-600', 'text-indigo-400').replace('text-red-600', 'text-red-400').replace('text-amber-600', 'text-amber-400')}`}
                                                    defaultValue={sub.vencimiento}
                                                    onBlur={(e) => handleUpdate(sub.id, 'vencimiento', e.target.value)}
                                                />
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <button
                                                    onClick={() => toggleStatus(sub)}
                                                    className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${sub.estado === 'ACTIVO' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800 hover:bg-emerald-900/50' : 'bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700'}`}
                                                >
                                                    {sub.estado}
                                                </button>
                                            </td>
                                            <td className="px-6 py-3">
                                                <input
                                                    className="bg-transparent w-full focus:outline-none focus:bg-slate-800 focus:ring-1 focus:ring-indigo-500 rounded px-1 text-center text-slate-300"
                                                    defaultValue={sub.equipo}
                                                    onBlur={(e) => handleUpdate(sub.id, 'equipo', e.target.value)}
                                                />
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <div className="flex justify-center items-center gap-2">
                                                    <button onClick={() => openWhatsApp(sub)} className="p-2 rounded-lg bg-emerald-900/20 text-emerald-500 hover:bg-emerald-900/40 border border-emerald-900/50 transition-colors" title="WhatsApp">
                                                        <MessageCircle size={16} />
                                                    </button>
                                                    <button onClick={() => handleDelete(sub.id)} className="p-2 rounded-lg hover:bg-red-900/20 text-slate-500 hover:text-red-400 transition-colors" title="Eliminar">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex justify-between items-center bg-slate-900 p-3 rounded-lg border border-slate-800 shadow-sm">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 text-sm disabled:opacity-50 hover:bg-slate-700 hover:text-white transition-colors"
                    >
                        Anterior
                    </button>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400 font-medium hidden sm:inline">Página</span>
                        <input
                            type="number"
                            min={1}
                            max={totalPages}
                            value={currentPage}
                            onChange={(e) => {
                                const page = parseInt(e.target.value);
                                if (!isNaN(page) && page >= 1 && page <= totalPages) {
                                    setCurrentPage(page);
                                }
                            }}
                            className="w-16 px-2 py-1 text-sm border border-slate-700 bg-slate-800 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center text-slate-200"
                        />
                        <span className="text-sm text-slate-400 font-medium">de {totalPages}</span>
                    </div>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 text-sm disabled:opacity-50 hover:bg-slate-700 hover:text-white transition-colors"
                    >
                        Siguiente
                    </button>
                </div>
            )}
        </div>
    );
}
