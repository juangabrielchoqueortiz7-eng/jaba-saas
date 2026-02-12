'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Plus, Upload, Download, Trash2, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

import SubscriptionSettingsModal from './SubscriptionSettingsModal';
import SubscriptionFormModal from './SubscriptionFormModal';
import { Settings } from 'lucide-react';
import { Subscription } from '@/types/subscription';

export default function SubscriptionActions({ onRefresh, onLocalAdd }: { onRefresh: () => void, onLocalAdd?: (sub: Subscription) => void }) {
    const supabase = createClient();
    const [isImporting, setIsImporting] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);

    const handleFormSuccess = (newSub: Subscription) => {
        if (onLocalAdd) {
            onLocalAdd(newSub);
        } else {
            onRefresh();
        }
    };


    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });

                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('No user');

                let addedCount = 0;
                const batchSize = 100; // Create batch logic if many rows
                // Supabase inserts support array of objects

                for (const sheetName of workbook.SheetNames) {
                    const jsonData = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[sheetName], { header: 1 });
                    if (jsonData.length < 2) continue;

                    const headers = jsonData[0].map((h: any) => String(h || '').trim().toLowerCase());

                    const findHeader = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.includes(k)));

                    const colMap = {
                        numero: findHeader(['numero', 'celular', 'telefono']),
                        correo: findHeader(['correo', 'email']),
                        vencimiento: findHeader(['vencimiento', 'fecha']),
                        estado: findHeader(['estado', 'status']),
                        equipo: findHeader(['equipo', 'grupo'])
                    };

                    if (colMap.correo === -1) continue;

                    const rowsToInsert = [];

                    for (let i = 1; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        if (!row || row.length === 0) continue;

                        const email = String(row[colMap.correo] || '').trim();
                        if (!email) continue;

                        let vencimiento = '';
                        const rawDate = row[colMap.vencimiento];
                        if (typeof rawDate === 'number' && rawDate > 1) {
                            // Excel serial date
                            // Excel base date is Dec 30 1899 usually (25569 offset to 1970)
                            const date = new Date((rawDate - (25569)) * 86400 * 1000);
                            vencimiento = dayjs(date).format('DD/MM/YYYY');
                        } else {
                            vencimiento = String(rawDate || '');
                        }

                        let estado = 'ACTIVO';
                        const rawEstado = String(row[colMap.estado] || '').toUpperCase();
                        if (['INACTIVO', 'BAJA', 'FALSE', '0'].some(x => rawEstado.includes(x))) estado = 'INACTIVO';

                        rowsToInsert.push({
                            numero: String(row[colMap.numero] || '').replace(/\D/g, ''),
                            correo: email,
                            vencimiento: vencimiento,
                            estado: estado,
                            equipo: String(row[colMap.equipo] || ''),
                            user_id: user.id
                        });
                    }

                    if (rowsToInsert.length > 0) {
                        const { error } = await supabase.from('subscriptions').insert(rowsToInsert);
                        if (error) console.error(error);
                        else addedCount += rowsToInsert.length;
                    }
                }
                toast.success(`Importado ${addedCount} registros`);
                onRefresh();
            } catch (error) {
                console.error(error);
                toast.error('Error al importar');
            } finally {
                setIsImporting(false);
                e.target.value = ''; // Reset input
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleExportExcel = async () => {
        // Fetch all data
        const { data } = await supabase.from('subscriptions').select('*');
        if (!data) return;

        const ws = XLSX.utils.json_to_sheet(data.map(s => ({
            NUMERO: s.numero,
            CORREO: s.correo,
            VENCIMIENTO: s.vencimiento,
            ESTADO: s.estado,
            EQUIPO: s.equipo
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Suscripciones");
        XLSX.writeFile(wb, "Suscripciones_JABA.xlsx");
    };

    const handleExportPDF = async () => {
        const { data } = await supabase.from('subscriptions').select('*');
        if (!data) return;

        const doc = new jsPDF();
        autoTable(doc, {
            head: [['#', 'Correo', 'Vencimiento', 'Estado', 'Equipo']],
            body: data.map(s => [s.numero, s.correo, s.vencimiento, s.estado, s.equipo]),
        });
        doc.save("Suscripciones_JABA.pdf");
    };

    const handleDeleteAll = async () => {
        if (!confirm('¡PELIGRO! ¿Estás seguro de borrar TODAS las suscripciones? Esto no se puede deshacer.')) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase.from('subscriptions').delete().eq('user_id', user.id);
        if (error) toast.error('Error al borrar');
        else toast.success('Base de datos vaciada');
        onRefresh();
    };

    return (
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
            <button onClick={() => setIsFormOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 transition-all text-sm font-semibold flex items-center gap-2">
                <Plus size={16} /> Nuevo
            </button>

            <div className="hidden sm:block h-6 w-px bg-slate-700 mx-1"></div>

            <label className="cursor-pointer bg-slate-800 border border-slate-700 text-slate-300 px-4 py-2 rounded-lg hover:bg-slate-700 transition-all text-sm font-medium flex items-center gap-2 shadow-sm">
                <Upload size={16} className="text-emerald-500" />
                {isImporting ? 'Importando...' : 'Importar'}
                <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} disabled={isImporting} />
            </label>

            <div className="relative">
                <button
                    onClick={() => setIsExportOpen(!isExportOpen)}
                    className="bg-slate-800 border border-slate-700 text-slate-300 px-4 py-2 rounded-lg hover:bg-slate-700 transition-all text-sm font-medium flex items-center gap-2 shadow-sm"
                >
                    <Download size={16} className="text-sky-500" /> Exportar
                </button>

                {isExportOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-40 bg-transparent"
                            onClick={() => setIsExportOpen(false)}
                        />
                        <div className="absolute right-0 mt-2 w-48 bg-slate-800 rounded-xl shadow-xl border border-slate-700 z-50 animate-in fade-in zoom-in-95 duration-200">
                            <button
                                onClick={() => { handleExportExcel(); setIsExportOpen(false); }}
                                className="w-full text-left px-4 py-3 hover:bg-slate-700 text-sm text-slate-300 flex items-center gap-2 first:rounded-t-xl"
                            >
                                <FileSpreadsheet size={16} className="text-emerald-500" /> Excel
                            </button>
                            <button
                                onClick={() => { handleExportPDF(); setIsExportOpen(false); }}
                                className="w-full text-left px-4 py-3 hover:bg-slate-700 text-sm text-slate-300 flex items-center gap-2 last:rounded-b-xl border-t border-slate-700/50"
                            >
                                <FileText size={16} className="text-red-500" /> PDF
                            </button>
                        </div>
                    </>
                )}
            </div>

            <div className="hidden sm:block h-6 w-px bg-slate-700 mx-1"></div>

            <button onClick={() => setShowSettings(true)} className="bg-slate-800 border border-slate-700 text-slate-300 px-4 py-2 rounded-lg hover:bg-slate-700 transition-all text-sm font-medium flex items-center gap-2 shadow-sm">
                <Settings size={16} className="text-indigo-400" /> Configurar
            </button>

            <button onClick={handleDeleteAll} className="text-red-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-900/20 transition-colors" title="Borrar Todo">
                <Trash2 size={16} />
            </button>

            <SubscriptionSettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
            <SubscriptionFormModal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} onSuccess={handleFormSuccess} />
        </div>
    );
}
