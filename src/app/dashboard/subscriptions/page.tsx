'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import SubscriptionTable from '@/components/subscriptions/SubscriptionTable';
import SubscriptionActions from '@/components/subscriptions/SubscriptionActions';
import { Subscription } from '@/types/subscription';
import { toast } from 'sonner';

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
        fetchSubscriptions();

        const channel = supabase
            .channel('subscriptions_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'subscriptions'
                },
                (payload) => {
                    // Refresh silently (no loading spinner) when realtime events occur
                    fetchSubscriptions(false);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
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

    return (
        <div className="flex flex-col h-full bg-slate-50/50 p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gestor de Suscripciones</h1>
                    <p className="text-slate-500 text-sm">Administra tus clientes y renovaciones</p>
                </div>
                <SubscriptionActions onRefresh={() => fetchSubscriptions(true)} onLocalAdd={handleLocalAdd} />
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
