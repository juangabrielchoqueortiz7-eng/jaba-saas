/**
 * Convierte una hora UTC a la zona horaria del usuario
 * y determina si debe ejecutarse en esa hora específica
 *
 * @param userTimezone - IANA timezone string (e.g., 'America/La_Paz')
 * @param userConfigHour - Hora configurada por el usuario (0-23)
 * @param utcDate - Fecha/hora UTC (default: now)
 * @returns true si la hora local coincide con la hora configurada
 */
export function shouldExecuteAtHour(
  userTimezone: string,
  userConfigHour: number,
  utcDate: Date = new Date()
): boolean {
  try {
    const localHour = getLocalHour(userTimezone, utcDate)
    return localHour === userConfigHour
  } catch (error) {
    console.error(`Error converting timezone for ${userTimezone}:`, error)
    return false
  }
}

/**
 * Obtiene la hora local (0-23) en una zona horaria específica
 */
function getLocalHour(timezone: string, utcDate: Date): number {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  }).format(utcDate)

  // Intl puede retornar "24" para medianoche en algunos sistemas
  const hour = parseInt(formatted, 10)
  return hour === 24 ? 0 : hour
}

/**
 * Obtiene la hora actual en una zona horaria específica
 *
 * @param timezone - IANA timezone string
 * @param utcDate - Fecha/hora UTC (default: now)
 * @returns Objeto con hora, minuto, segundo
 */
export function getLocalTime(
  timezone: string,
  utcDate: Date = new Date()
): { hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(utcDate)

  const get = (type: string) => {
    const part = parts.find((p) => p.type === type)
    const val = parseInt(part?.value || '0', 10)
    return val === 24 ? 0 : val
  }

  return {
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  }
}

/**
 * Lista de timezones comunes para mostrar en selects
 */
export const COMMON_TIMEZONES = [
  // América Latina
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (UTC-3)' },
  { value: 'America/Bogota', label: 'Colombia (UTC-5)' },
  { value: 'America/La_Paz', label: 'Bolivia (UTC-4)' },
  { value: 'America/Lima', label: 'Perú (UTC-5)' },
  { value: 'America/Caracas', label: 'Venezuela (UTC-4)' },
  { value: 'America/Santiago', label: 'Chile (UTC-4)' },
  { value: 'America/Mexico_City', label: 'México (UTC-6)' },
  { value: 'America/New_York', label: 'USA/Canadá Este (UTC-5)' },
  { value: 'America/Los_Angeles', label: 'USA Pacific (UTC-8)' },
  { value: 'America/Denver', label: 'USA Mountain (UTC-7)' },
  { value: 'America/Chicago', label: 'USA Central (UTC-6)' },
  { value: 'America/Guayaquil', label: 'Ecuador (UTC-5)' },
  { value: 'America/Asuncion', label: 'Paraguay (UTC-4)' },

  // Europa
  { value: 'Europe/London', label: 'Reino Unido (UTC+0)' },
  { value: 'Europe/Paris', label: 'Francia (UTC+1)' },
  { value: 'Europe/Berlin', label: 'Alemania (UTC+1)' },
  { value: 'Europe/Madrid', label: 'España (UTC+1)' },
  { value: 'Europe/Rome', label: 'Italia (UTC+1)' },
  { value: 'Europe/Amsterdam', label: 'Países Bajos (UTC+1)' },

  // Asia
  { value: 'Asia/Shanghai', label: 'China (UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Japón (UTC+9)' },
  { value: 'Asia/Bangkok', label: 'Tailandia (UTC+7)' },
  { value: 'Asia/Dubai', label: 'Dubai (UTC+4)' },
  { value: 'Asia/Singapore', label: 'Singapur (UTC+8)' },
  { value: 'Asia/Manila', label: 'Filipinas (UTC+8)' },

  // Oceanía
  { value: 'Australia/Sydney', label: 'Australia/Sydney (UTC+10)' },
  { value: 'Pacific/Auckland', label: 'Nueva Zelanda (UTC+12)' },

  // África
  { value: 'Africa/Johannesburg', label: 'Sudáfrica (UTC+2)' },
  { value: 'Africa/Cairo', label: 'Egipto (UTC+2)' },
  { value: 'Africa/Lagos', label: 'Nigeria (UTC+1)' },
]
