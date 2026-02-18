'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import SubscriptionTable from '@/components/subscriptions/SubscriptionTable';
import SubscriptionActions from '@/components/subscriptions/SubscriptionActions';
import { Subscription } from '@/types/subscription';
import { toast } from 'sonner';
import { Users, CheckCircle2, XCircle } from 'lucide-react';
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

        const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching subscriptions:', error);
            toast.error('Error al cargar suscripciones');
        } else {
            setSubscriptions(data || []);
        }
        setIsLoading(false);
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

    return (
        <div className="flex flex-col h-full bg-slate-950 p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Gestor de Suscripciones</h1>
                    <p className="text-slate-400 text-sm">Administra tus clientes y renovaciones</p>
                </div>
                <SubscriptionActions onRefresh={() => fetchSubscriptions(true)} onLocalAdd={handleLocalAdd} />
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

