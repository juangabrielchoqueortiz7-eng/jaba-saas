export interface Plan {
    id: string
    conversations: number
    price_usd: number
    label: string
    savings_usd: number | null
    recharge_price?: number // only for free plan
    highlight?: boolean
}

// Base rate for savings calculation: free plan recharge = $9.99 / 500 = $0.01998 per conv
const BASE_RATE = 9.99 / 500

export const PLANS: Plan[] = [
    {
        id: 'free',
        conversations: 500,
        price_usd: 0,
        label: 'GRATIS',
        savings_usd: null,
        recharge_price: 9.99,
    },
    {
        id: '1000',
        conversations: 1000,
        price_usd: 18.39,
        label: '1,000 conversaciones',
        savings_usd: 1.59,
    },
    {
        id: '2000',
        conversations: 2000,
        price_usd: 35.99,
        label: '2,000 conversaciones',
        savings_usd: 3.97,
    },
    {
        id: '5000',
        conversations: 5000,
        price_usd: 84.99,
        label: '5,000 conversaciones',
        savings_usd: 14.91,
        highlight: true,
    },
    {
        id: '10000',
        conversations: 10000,
        price_usd: 159.90,
        label: '10,000 conversaciones',
        savings_usd: 39.90,
    },
    {
        id: '20000',
        conversations: 20000,
        price_usd: 299.90,
        label: '20,000 conversaciones',
        savings_usd: 99.70,
    },
    {
        id: '50000',
        conversations: 50000,
        price_usd: 749.90,
        label: '50,000 conversaciones',
        savings_usd: 249.10,
    },
]

export function getPlanById(id: string): Plan | undefined {
    return PLANS.find(p => p.id === id)
}

export function pricePerConversation(plan: Plan): string {
    if (plan.price_usd === 0) return ((plan.recharge_price ?? 9.99) / plan.conversations).toFixed(4)
    return (plan.price_usd / plan.conversations).toFixed(4)
}

// Returns 0–100 usage percentage
export function usagePercent(used: number, total: number): number {
    if (total <= 0) return 100
    return Math.min(100, Math.round(((total - used) <= 0 ? 100 : ((total - (used > total ? total : used)) / total) * 100)))
}

// True when tenant has no conversations left
export function isOverLimit(balance: number): boolean {
    return balance <= 0
}

// Warning threshold: show alert when < 10% remaining or < 50 conversations
export function isNearLimit(balance: number, total: number): boolean {
    return balance > 0 && (balance <= 50 || balance / total <= 0.1)
}
