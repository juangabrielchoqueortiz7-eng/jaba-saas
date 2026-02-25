export interface Subscription {
    id: string;
    created_at?: string;
    numero: string;
    correo: string;
    vencimiento: string;
    estado: string;
    equipo: string;
    notified: boolean;
    notified_at?: string;
    followup_sent?: boolean;
    auto_notify_paused?: boolean;
    user_id?: string;
}
