/**
 * Format timestamp like WhatsApp does:
 * - Today: "09:19"
 * - Yesterday: "Ayer"
 * - This week: "Lunes", "Martes", etc.
 * - Older: "15/02/2026"
 */
export function formatChatListTime(dateStr: string): string {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    const isToday = date.toDateString() === now.toDateString()

    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = date.toDateString() === yesterday.toDateString()

    if (isToday) {
        return date.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false })
    }

    if (isYesterday) {
        return 'Ayer'
    }

    if (diffDays < 7) {
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
        return days[date.getDay()]
    }

    return date.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Format timestamp for message bubbles like WhatsApp:
 * - Shows time always: "09:19"
 * - But messages from different days get a separator (handled separately)
 */
export function formatMessageTime(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/**
 * Format date separator for message groups like WhatsApp:
 * - Today: "Hoy"
 * - Yesterday: "Ayer"  
 * - This week: "Lunes 17 de febrero"
 * - Older: "15/02/2026"
 */
export function formatDateSeparator(dateStr: string): string {
    const date = new Date(dateStr)
    const now = new Date()

    const isToday = date.toDateString() === now.toDateString()

    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = date.toDateString() === yesterday.toDateString()

    if (isToday) return 'Hoy'
    if (isYesterday) return 'Ayer'

    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays < 7) {
        return date.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })
    }

    return date.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Check if two dates are on different days (for showing date separators)
 */
export function isDifferentDay(date1: string, date2: string): boolean {
    return new Date(date1).toDateString() !== new Date(date2).toDateString()
}
