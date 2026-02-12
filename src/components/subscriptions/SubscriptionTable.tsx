'use client';

import { useState, useMemo, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Subscription } from '@/types/subscription';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { Trash2, Copy, MessageCircle, ExternalLink, CheckCircle, XCircle, RefreshCw, AlertTriangle, ArrowRightCircle, Users } from 'lucide-react';
import { toast } from 'sonner';
import SubscriptionCard from './SubscriptionCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

dayjs.extend(customParseFormat);

interface SubscriptionTableProps {
    subscriptions: Subscription[];
    isLoading: boolean;
    onRefresh: () => void;
    onLocalDelete?: (id: string) => void;
    onLocalUpdate?: (id: string, field: keyof Subscription, value: any) => void;
}

export default function SubscriptionTable({ subscriptions, isLoading, onRefresh, onLocalDelete, onLocalUpdate }: SubscriptionTableProps) {
    const supabase = createClient();
    const [customMessages, setCustomMessages] = useState<{ reminder: string, expired_grace: string, expired_removed: string } | null>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('subscription_settings')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (data) {
                setCustomMessages({
                    reminder: data.reminder_msg,
                    expired_grace: data.expired_grace_msg,
                    expired_removed: data.expired_removed_msg
                });
            }
        };

        fetchSettings();
        console.log("SubscriptionTable v2 loaded");
    }, []);
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

    // Pagination Input State
    const [inputPage, setInputPage] = useState(currentPage.toString());

    useEffect(() => {
        setInputPage(currentPage.toString());
    }, [currentPage]);

    const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputPage(e.target.value);
    };

    const handlePageCommit = () => {
        let page = parseInt(inputPage);
        if (isNaN(page) || page < 1) page = 1;
        if (page > totalPages) page = totalPages;

        setCurrentPage(page);
        setInputPage(page.toString());
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handlePageCommit();
        }
    };


    const [renewMenuOpen, setRenewMenuOpen] = useState<string | null>(null);

    const handleUpdate = async (id: string, field: keyof Subscription, value: any) => {
        // Optimistic update if handler provided
        if (onLocalUpdate) {
            onLocalUpdate(id, field, value);
        }

        try {
            const { error } = await supabase
                .from('subscriptions')
                .update({ [field]: value })
                .eq('id', id);

            if (error) throw error;
            toast.success('Actualizado correctamente');
            if (!onLocalUpdate) onRefresh(); // Fallback if no local update
        } catch (error) {
            console.error('Error updating:', error);
            toast.error('Error al actualizar');
            onRefresh(); // Revert on error
        }
    };

    const handleRenew = async (id: string, months: number) => {
        const newDate = dayjs().add(months, 'month').format('DD/MM/YYYY'); // Fixed format to DD/MM/YYYY

        // Optimistic Update
        if (onLocalUpdate) {
            onLocalUpdate(id, 'vencimiento', newDate);
            onLocalUpdate(id, 'estado', 'ACTIVO');
            onLocalUpdate(id, 'notified', false);
        }

        setRenewMenuOpen(null);

        try {
            const { error } = await supabase
                .from('subscriptions')
                .update({
                    vencimiento: newDate,
                    estado: 'ACTIVO',
                    notified: false
                })
                .eq('id', id);

            if (error) throw error;
            toast.success(`Renovado por ${months} mes(es)`);
        } catch (error) {
            console.error('Error renewing:', error);
            toast.error('Error al renovar');
            onRefresh();
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
            if (filtersState.status === 'POR_VENCER') {
                if (sub.estado !== 'ACTIVO') return false;
                if (!sub.vencimiento) return false;
                // Parse DD/MM/YYYY correctly for comparison
                const diff = dayjs(sub.vencimiento, 'DD/MM/YYYY').diff(dayjs().startOf('day'), 'day');
                // Show if expired (diff < 0) or expiring soon (diff <= 7)
                if (diff > 7) return false;
            } else if (filtersState.status && (sub.estado || '').toUpperCase() !== filtersState.status) {
                return false;
            }

            // Column Filters
            if (filtersState.numero && !sub.numero?.toLowerCase().includes(filtersState.numero.toLowerCase())) return false;
            if (filtersState.correo && !sub.correo?.toLowerCase().includes(filtersState.correo.toLowerCase())) return false;
            if (filtersState.vencimiento && !sub.vencimiento?.toLowerCase().includes(filtersState.vencimiento.toLowerCase())) return false;
            if (filtersState.equipo && !sub.equipo?.toLowerCase().includes(filtersState.equipo.toLowerCase())) return false;

            return true;
        }).sort((a, b) => {
            // 1. Sort by Status (Active First, then Inactive)
            if (a.estado === 'ACTIVO' && b.estado !== 'ACTIVO') return -1;
            if (a.estado !== 'ACTIVO' && b.estado === 'ACTIVO') return 1;

            // 2. Sort by Date Ascending (Closest/Expired dates first)
            // Parse dates with lenient mode
            const dateA = a.vencimiento ? dayjs(a.vencimiento, ['DD/MM/YYYY', 'YYYY-MM-DD']) : null;
            const dateB = b.vencimiento ? dayjs(b.vencimiento, ['DD/MM/YYYY', 'YYYY-MM-DD']) : null;

            const isValidA = dateA && dateA.isValid();
            const isValidB = dateB && dateB.isValid();

            if (isValidA && !isValidB) return -1; // Valid dates first
            if (!isValidA && isValidB) return 1;
            if (!isValidA && !isValidB) return 0; // Both invalid/missing

            if (isValidA && isValidB) {
                const diff = dateA.diff(dateB);
                if (diff !== 0) return diff;
                // Tie-breaker: Sort by Name/Number to keep list stable
                return (a.numero || '').localeCompare(b.numero || '');
            }

            return 0;
        });
    }, [subscriptions, filtersState]);

    // Extract Unique Teams
    const teams = useMemo(() => {
        const uniqueTeams = new Set(subscriptions.map(sub => sub.equipo).filter(Boolean));
        return Array.from(uniqueTeams).sort();
    }, [subscriptions]);

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

        // Default Messages
        const defaults = {
            reminder: `Hola! 👋 Te saludamos de Jaba SaaS. Queremos recordarte que tu suscripción vence el {vencimiento} ⏳. Nos encantaría que sigas con nosotros! 🚀`,
            expired_grace: `Hola! ⚠️ Tu suscripción venció el {vencimiento}, pero aún tienes acceso temporal. ⏳ Por favor renueva lo antes posible para evitar cortes. ✅`,
            expired_removed: `Hola 👋. Tu suscripción ha finalizado y el acceso se ha cerrado 🔒. Recuerda que tus diseños se guardan por un tiempo. Renueva ahora para recuperarlos! ✨`,
            active: `Hola! 👋 Tu suscripción está activa y vence el {vencimiento}. ¡Gracias por confiar en nosotros! 🚀`
        };

        const msgs = customMessages || { reminder: '', expired_grace: '', expired_removed: '' };

        if ((sub.estado || '').toUpperCase() === 'INACTIVO') {
            message = msgs.expired_removed || defaults.expired_removed;
        } else if (dateInfo.days < 0) {
            // Expired but Active (Grace Period)
            message = msgs.expired_grace || defaults.expired_grace;
        } else if (dateInfo.days <= 3 && dateInfo.days >= 0) {
            // Reminder (Only if expiring soon, not if renewed far in future)
            message = msgs.reminder || defaults.reminder;
        } else {
            // Active and safe date (Renewed)
            // Use defaults.active if no specific custom message for active exists yet
            message = defaults.active;
        }

        // Replace variables
        message = message
            .replace(/{correo}/g, sub.correo)
            .replace(/{vencimiento}/g, sub.vencimiento)
            .replace(/{equipo}/g, sub.equipo);

        // Append Team Reference if available
        if (sub.equipo) {
            message += `\n\nRef: ${sub.equipo}`;
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
        else {
            toast.success('Eliminado');
            if (onLocalDelete) {
                onLocalDelete(id);
            } else {
                onRefresh();
            }
        }
    };

    const handleNextExpiration = () => {
        // Find the first subscription that is "Por Vencer" and not notified today
        // Also skip users without a valid WhatsApp number

        const candidates = subscriptions.filter(sub => {
            // 1. Must be Active
            if (sub.estado !== 'ACTIVO') return false;

            // 2. Must have a expiration date
            if (!sub.vencimiento) return false;

            // Parse correctly to avoid issues with format
            let date = dayjs(sub.vencimiento, ['DD/MM/YYYY', 'YYYY-MM-DD'], true);
            if (!date.isValid()) date = dayjs(sub.vencimiento);

            if (!date.isValid()) return false;

            // 3. Must be expiring soon (<= 7 days) or already expired but active
            const diff = date.diff(dayjs().startOf('day'), 'day');

            if (diff > 7) return false; // Now this safely filters out future dates 

            // 4. Must NOT have been notified yet
            if (sub.notified) return false;

            // 5. Must have a valid phone number (at least 8 digits)
            const phone = (sub.numero || '').replace(/\D/g, '');
            if (phone.length < 8) return false;

            return true;
        }).sort((a, b) => {
            // Sort by closest expiration date first
            let dateA = dayjs(a.vencimiento, ['DD/MM/YYYY', 'YYYY-MM-DD'], true);
            if (!dateA.isValid()) dateA = dayjs(a.vencimiento);

            let dateB = dayjs(b.vencimiento, ['DD/MM/YYYY', 'YYYY-MM-DD'], true);
            if (!dateB.isValid()) dateB = dayjs(b.vencimiento);

            return dateA.diff(dateB);
        });

        if (candidates.length > 0) {
            const target = candidates[0];
            openWhatsApp(target);
            toast.success(`Contactando a ${target.numero} (Vence: ${target.vencimiento})`);
        } else {
            toast.success('¡Todo al día! No hay más pendientes por vencer para hoy.');
        }
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
                    <button
                        onClick={() => { setFilters(prev => ({ ...prev, status: 'POR_VENCER' })); setCurrentPage(1); }}
                        className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 transition-all ${filtersState.status === 'POR_VENCER' ? 'bg-slate-700 text-red-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        <AlertTriangle size={16} /> Por Vencer
                    </button>
                    <button
                        onClick={handleNextExpiration}
                        className="px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 transition-all bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm border border-indigo-500 ml-2"
                        title="Ir al siguiente vencimiento"
                    >
                        <ArrowRightCircle size={16} /> Siguiente
                    </button>

                    {/* Team Filter Dropdown */}
                    <div className="ml-2 w-[180px]">
                        <Select
                            value={filtersState.equipo}
                            onValueChange={(val) => {
                                setFilters(prev => ({ ...prev, equipo: val === 'ALL' ? '' : val }));
                                setCurrentPage(1);
                            }}
                        >
                            <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200 h-[38px]">
                                <div className="flex items-center gap-2">
                                    <Users size={16} className="text-slate-400" />
                                    <span>{filtersState.equipo ? `Equipo: ${filtersState.equipo}` : 'Todos los Equipos'}</span>
                                </div>
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700">
                                <SelectItem value="ALL" className="text-slate-300 focus:bg-slate-700 focus:text-white">
                                    Todos los Equipos
                                </SelectItem>
                                {teams.map(team => (
                                    <SelectItem key={team} value={team} className="text-slate-300 focus:bg-slate-700 focus:text-white">
                                        Equipo {team}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
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
                                                    <div className="relative">
                                                        <button
                                                            onClick={() => setRenewMenuOpen(renewMenuOpen === sub.id ? null : sub.id)}
                                                            className="p-2 rounded-lg bg-indigo-900/20 text-indigo-500 hover:bg-indigo-900/40 border border-indigo-900/50 transition-colors"
                                                            title="Renovación Rápida"
                                                        >
                                                            <RefreshCw size={16} />
                                                        </button>

                                                        {renewMenuOpen === sub.id && (
                                                            <div className="absolute right-0 top-full mt-2 w-32 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-[100] flex flex-col p-1">
                                                                <div className="text-xs font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">Renovar</div>
                                                                <button
                                                                    onClick={() => handleRenew(sub.id, 1)}
                                                                    className="text-left px-2 py-1.5 text-xs text-slate-300 hover:bg-indigo-900/30 hover:text-indigo-300 rounded transition-colors"
                                                                >
                                                                    +1 Mes
                                                                </button>
                                                                <button
                                                                    onClick={() => handleRenew(sub.id, 3)}
                                                                    className="text-left px-2 py-1.5 text-xs text-slate-300 hover:bg-indigo-900/30 hover:text-indigo-300 rounded transition-colors"
                                                                >
                                                                    +3 Meses
                                                                </button>
                                                                <button
                                                                    onClick={() => handleRenew(sub.id, 6)}
                                                                    className="text-left px-2 py-1.5 text-xs text-slate-300 hover:bg-indigo-900/30 hover:text-indigo-300 rounded transition-colors"
                                                                >
                                                                    +6 Meses
                                                                </button>
                                                                <button
                                                                    onClick={() => handleRenew(sub.id, 9)}
                                                                    className="text-left px-2 py-1.5 text-xs text-slate-300 hover:bg-indigo-900/30 hover:text-indigo-300 rounded transition-colors"
                                                                >
                                                                    +9 Meses
                                                                </button>
                                                                <button
                                                                    onClick={() => handleRenew(sub.id, 12)}
                                                                    className="text-left px-2 py-1.5 text-xs text-slate-300 hover:bg-indigo-900/30 hover:text-indigo-300 rounded transition-colors"
                                                                >
                                                                    +1 Año
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => openWhatsApp(sub)}
                                                        className={`p-2 rounded-lg border transition-colors relative ${sub.notified ? 'bg-slate-800 text-slate-500 border-slate-700 hover:text-emerald-500' : 'bg-emerald-900/20 text-emerald-500 hover:bg-emerald-900/40 border-emerald-900/50'}`}
                                                        title={sub.notified ? "Ya notificado hoy (Clic para reenviar)" : "Enviar recordatorio por WhatsApp"}
                                                    >
                                                        <MessageCircle size={16} />
                                                        {sub.notified && (
                                                            <div className="absolute -top-1 -right-1 bg-emerald-500 rounded-full p-[1px] border border-slate-900">
                                                                <CheckCircle size={8} className="text-white" strokeWidth={4} />
                                                            </div>
                                                        )}
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

                    {/* Dismiss menu on outside click overlay */}
                    {renewMenuOpen && (
                        <div className="fixed inset-0 z-40" onClick={() => setRenewMenuOpen(null)}></div>
                    )}
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
                            type="text"
                            value={inputPage}
                            onChange={handlePageInput}
                            onBlur={handlePageCommit}
                            onKeyDown={handleKeyDown}
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
            )
            }
        </div >
    );
}
