import { supabase as adminSupabase } from '@/lib/supabase';
import { SupabaseClient } from '@supabase/supabase-js';

export interface SchedulingConfig {
  id: string;
  user_id: string;
  timezone: string;
  reminder_hour: number;
  followup_hour: number;
  urgency_hour: number;
  created_at: string;
  updated_at: string;
}

/**
 * Obtiene la configuración de scheduling de un usuario específico
 */
export async function getUserSchedulingConfig(
  client: SupabaseClient,
  userId: string
): Promise<SchedulingConfig | null> {
  const { data, error } = await client
    .from('scheduling_config')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found
    console.error('Error fetching scheduling config:', error);
    throw error;
  }

  return data || null;
}

/**
 * Obtiene la configuración de scheduling para TODOS los usuarios
 * (usado por cron jobs)
 */
export async function getAllSchedulingConfigs(): Promise<SchedulingConfig[]> {
  const { data, error } = await adminSupabase
    .from('scheduling_config')
    .select('*');

  if (error) {
    console.error('Error fetching all scheduling configs:', error);
    throw error;
  }

  return data || [];
}

/**
 * Crea o actualiza la configuración de scheduling de un usuario
 */
export async function upsertSchedulingConfig(
  client: SupabaseClient,
  userId: string,
  config: Partial<Omit<SchedulingConfig, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<SchedulingConfig> {
  const { data, error } = await client
    .from('scheduling_config')
    .upsert(
      {
        user_id: userId,
        ...config,
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) {
    console.error('Error upserting scheduling config:', error);
    throw error;
  }

  return data;
}

/**
 * Actualiza solo la zona horaria de un usuario
 */
export async function updateUserTimezone(
  client: SupabaseClient,
  userId: string,
  timezone: string
): Promise<SchedulingConfig> {
  return upsertSchedulingConfig(client, userId, { timezone });
}

/**
 * Actualiza solo las horas de un usuario
 */
export async function updateUserHours(
  client: SupabaseClient,
  userId: string,
  hours: {
    reminder_hour?: number;
    followup_hour?: number;
    urgency_hour?: number;
  }
): Promise<SchedulingConfig> {
  return upsertSchedulingConfig(client, userId, hours);
}

/**
 * Obtiene los usuarios que deben ejecutar una tarea específica ahora
 * Filtra por timezone y hora configurada
 */
export async function getUsersToExecuteNow(
  taskType: 'reminder' | 'followup' | 'urgency',
  currentUtcDate: Date = new Date()
): Promise<SchedulingConfig[]> {
  const allConfigs = await getAllSchedulingConfigs();

  // Importar aquí para evitar circular dependencies
  const { shouldExecuteAtHour } = await import('@/lib/timezone-utils');

  return allConfigs.filter((config) => {
    const hourKey = `${taskType}_hour` as const;
    const configHour = config[hourKey];

    return shouldExecuteAtHour(config.timezone, configHour, currentUtcDate);
  });
}

/**
 * Obtiene la configuración con defaults
 */
export function getSchedulingConfigWithDefaults(
  config: SchedulingConfig | null
): SchedulingConfig {
  return {
    id: config?.id || '',
    user_id: config?.user_id || '',
    timezone: config?.timezone || 'America/La_Paz',
    reminder_hour: config?.reminder_hour ?? 9,
    followup_hour: config?.followup_hour ?? 18,
    urgency_hour: config?.urgency_hour ?? 9,
    created_at: config?.created_at || new Date().toISOString(),
    updated_at: config?.updated_at || new Date().toISOString(),
  };
}
