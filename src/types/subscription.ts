export interface Subscription {
    id: string;
    created_at?: string;
    numero: string;
    correo: string;
    vencimiento: string;
    estado: string;
    equipo: string;
    notified: boolean;
    user_id?: string;
}
