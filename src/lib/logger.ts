type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const configuredLevel = (process.env.LOG_LEVEL as LogLevel | undefined) || 'info'

function shouldLog(level: LogLevel) {
  return levelPriority[level] >= (levelPriority[configuredLevel] ?? levelPriority.info)
}

export function redactPhone(phone?: string | null): string {
  return phone ? `***${phone.slice(-4)}` : '***'
}

export function redactEmail(email?: string | null): string {
  if (!email) return '***'
  const [user, domain] = email.split('@')
  return `${user.slice(0, 2)}***@${domain || '***'}`
}

export function redactId(value?: string | null): string {
  if (!value) return '***'
  if (value.length <= 8) return '***'
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

export function redactUrl(value?: string | null): string {
  if (!value) return '***'
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}`
  } catch {
    return value.split('?')[0] || '***'
  }
}

export const logger = {
  debug(message: string, context?: unknown) {
    if (shouldLog('debug')) console.debug(message, context ?? '')
  },
  info(message: string, context?: unknown) {
    if (shouldLog('info')) console.log(message, context ?? '')
  },
  warn(message: string, context?: unknown) {
    if (shouldLog('warn')) console.warn(message, context ?? '')
  },
  error(message: string, context?: unknown) {
    if (shouldLog('error')) console.error(message, context ?? '')
  },
}
