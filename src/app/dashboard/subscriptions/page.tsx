'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import SubscriptionTable from '@/components/subscriptions/SubscriptionTable';
import SubscriptionActions from '@/components/subscriptions/SubscriptionActions';
import { Subscription } from '@/types/subscription';
import { toast } from 'sonner';
import { Users, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SubscriptionsPage() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const supabase = createClient();

    const fetchSubscriptions = async (showLoading = true) => {
        if (showLoading) setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            setIsLoading(false);
            return;
        }

        let allSubscriptions: Subscription[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        try {
            while (hasMore) {
                const { data, error } = await supabase
                    .from('subscriptions')
                    .select('*')
                    .eq('user_id', user.id)
                    .range(from, from + step - 1)
                    .order('created_at', { ascending: false });

                if (error) {
                    console.error('Error fetching subscriptions:', error);
                    toast.error('Error al cargar suscripciones');
                    hasMore = false;
                    break;
                }

                if (data) {
                    allSubscriptions = [...allSubscriptions, ...data];
                    if (data.length < step) {
                        hasMore = false;
                    } else {
                        from += step;
                    }
                } else {
                    hasMore = false;
                }
            }
            setSubscriptions(allSubscriptions);
        } catch (err) {
            console.error('Unexpected error:', err);
            toast.error('Error inesperado al cargar suscripciones');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        let channel: any;

        const setupRealtime = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Initial fetch
            fetchSubscriptions();

            channel = supabase
                .channel('subscriptions_changes')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'subscriptions',
                        filter: `user_id=eq.${user.id}`
                    },
                    (payload) => {
                        // Refresh silently when realtime events occur
                        fetchSubscriptions(false);
                    }
                )
                .subscribe();
        };

        setupRealtime();

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, []);

    const handleLocalAdd = (newSub: Subscription) => {
        setSubscriptions(prev => [newSub, ...prev]);
    };

    const handleLocalDelete = (id: string) => {
        setSubscriptions(prev => prev.filter(sub => sub.id !== id));
    };

    const handleLocalUpdate = (id: string, field: keyof Subscription, value: any) => {
        setSubscriptions(prev => prev.map(sub =>
            sub.id === id ? { ...sub, [field]: value } : sub
        ));
    };

    const activeCount = subscriptions.filter(sub => sub.estado === 'ACTIVO').length;
    const inactiveCount = subscriptions.filter(sub => sub.estado !== 'ACTIVO').length;

    const pendingCount = useMemo(() => {
        const today = dayjs().startOf('day');
        return subscriptions.filter(sub => {
            if (sub.estado !== 'ACTIVO') return false;
            if (sub.notified) return false;
            if (sub.auto_notify_paused) return false;
            if (!sub.vencimiento) return false;
            const phone = (sub.numero || '').replace(/\D/g, '');
            if (phone.length < 8) return false;
            const expDate = dayjs(sub.vencimiento, ['DD/MM/YYYY', 'YYYY-MM-DD'], true);
            if (!expDate.isValid()) return false;
            const diff = expDate.diff(today, 'day');
            return diff <= 7;
        }).length;
    }, [subscriptions]);

    return (
        <div className="flex flex-col h-full bg-slate-950 p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Gestor de Suscripciones</h1>
                    <p className="text-slate-400 text-sm">Administra tus clientes y renovaciones</p>
                </div>
                <SubscriptionActions onRefresh={() => fetchSubscriptions(true)} onLocalAdd={handleLocalAdd} pendingCount={pendingCount} />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-200">
                            Total Suscripciones
                        </CardTitle>
                        <Users className="h-4 w-4 text-slate-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-100">{subscriptions.length}</div>
                        <p className="text-xs text-slate-400">
                            Total de registros
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-emerald-400">
                            Activos
                        </CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-400">{activeCount}</div>
                        <p className="text-xs text-slate-400">
                            Suscripciones vigentes
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-red-400">
                            Inactivos
                        </CardTitle>
                        <XCircle className="h-4 w-4 text-red-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-400">{inactiveCount}</div>
                        <p className="text-xs text-slate-400">
                            Suscripciones finalizadas
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800 border-amber-900/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-amber-400">
                            ⏳ Por Vencer
                        </CardTitle>
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-400">{pendingCount}</div>
                        <p className="text-xs text-slate-400">
                            Pendientes de recordatorio
                        </p>
                    </CardContent>
                </Card>
            </div>

            <SubscriptionTable
                subscriptions={subscriptions}
                isLoading={isLoading}
                onRefresh={() => fetchSubscriptions(true)}
                onLocalDelete={handleLocalDelete}
                onLocalUpdate={handleLocalUpdate}
            />
        </div>
    );
}

