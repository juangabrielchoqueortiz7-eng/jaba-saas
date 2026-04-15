'use client'

import { useState, useTransition, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getWalletData, processRecharge } from './actions'
import { Loader2, AlertCircle, MessageSquare, Mic, Check, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

// Mock Packages
const CONVERSATION_PACKAGES = [
    { id: 'c_500', count: 500, price: 9.99, save: 0, popular: false },
    { id: 'c_1000', count: 1000, price: 18.39, save: 1.59, popular: true },
    { id: 'c_2000', count: 2000, price: 35.99, save: 3.97, popular: false },
    { id: 'c_5000', count: 5000, price: 84.99, save: 14.91, popular: false },
]

const AUDIO_PACKAGES = [
    { id: 'a_30', count: 30, price: 9.99, save: 0, popular: false },
    { id: 'a_60', count: 60, price: 18.99, save: 1.00, popular: true },
    { id: 'a_120', count: 120, price: 35.99, save: 4.00, popular: false },
]

function getDefaultPackageId(tab: 'conversations' | 'audios') {
    return tab === 'conversations' ? CONVERSATION_PACKAGES[1].id : AUDIO_PACKAGES[1].id
}

export default function RechargesPage() {
    const [activeTab, setActiveTab] = useState<'conversations' | 'audios'>('conversations')

    // Wallet State
    const [balance, setBalance] = useState({ balance_conversations: 0, balance_audio_minutes: 0 })
    const [loadingWallet, setLoadingWallet] = useState(true)

    // Selection State
    const [selectedPkgId, setSelectedPkgId] = useState<string>(() => getDefaultPackageId('conversations'))

    // Payment State
    const [isProcessing, startTransition] = useTransition()

    // Load Wallet
    useEffect(() => {
        getWalletData().then(data => {
            setBalance(data)
            setLoadingWallet(false)
        })
    }, [])

    const packages = activeTab === 'conversations' ? CONVERSATION_PACKAGES : AUDIO_PACKAGES
    const selectedPackage = packages.find(p => p.id === selectedPkgId)

    const handleTabChange = (tab: 'conversations' | 'audios') => {
        setActiveTab(tab)
        setSelectedPkgId(getDefaultPackageId(tab))
    }

    const handlePayment = () => {
        if (!selectedPackage) return

        startTransition(async () => {
            try {
                const res = await processRecharge(
                    activeTab,
                    selectedPackage.price,
                    selectedPackage.count
                )
                if (res.success) {
                    setBalance(prev => ({ ...prev, ...res.new_balance }))
                    // Maybe show a nice toast here
                }
            } catch (error) {
                console.error(error)
            }
        })
    }

    if (loadingWallet) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 text-[#F97316] animate-spin" />
        </div>
    )

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">

            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-[#0F172A] mb-2">Recargas y Saldo</h1>
                    <p className="text-[rgba(15,23,42,0.45)]">Gestiona tu saldo disponible para conversaciones y audios.</p>
                </div>

                {/* Visual Wallet Card */}
                <div className="bg-white border border-black/[0.08] rounded-2xl p-4 flex items-center gap-6 shadow-lg min-w-[280px]">
                    <div className="space-y-1 flex-1">
                        <p className="text-xs text-[#0F172A]/35 uppercase tracking-wider font-semibold">Tu Saldo Actual</p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-[#0F172A]">
                                {activeTab === 'conversations'
                                    ? balance.balance_conversations.toLocaleString()
                                    : balance.balance_audio_minutes
                                }
                            </span>
                            <span className="text-sm text-[#0F172A]/40">
                                {activeTab === 'conversations' ? 'conversaciones' : 'minutos'}
                            </span>
                        </div>
                    </div>
                    <div className={`p-3 rounded-xl ${activeTab === 'conversations' ? 'bg-[rgba(16,185,129,0.1)] text-[#10b981]' : 'bg-[rgba(249,115,22,0.1)] text-[#F97316]'}`}>
                        {activeTab === 'conversations' ? <MessageSquare size={24} /> : <Mic size={24} />}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Selection */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Tabs */}
                    <div className="bg-white p-1 rounded-xl flex gap-1 border border-black/[0.08] backdrop-blur-sm">
                        <button
                            onClick={() => handleTabChange('conversations')}
                            className={cn(
                                "flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2",
                                activeTab === 'conversations'
                                    ? "bg-[rgba(16,185,129,0.1)] text-[#10b981] shadow-sm ring-1 ring-[rgba(16,185,129,0.25)]"
                                    : "text-[#0F172A]/40 hover:text-[#0F172A] hover:bg-black/[0.04]"
                            )}
                        >
                            <MessageSquare size={16} />
                            Conversaciones
                        </button>
                        <button
                            onClick={() => handleTabChange('audios')}
                            className={cn(
                                "flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2",
                                activeTab === 'audios'
                                    ? "bg-[rgba(249,115,22,0.1)] text-[#F97316] shadow-sm ring-1 ring-[rgba(249,115,22,0.25)]"
                                    : "text-[#0F172A]/40 hover:text-[#0F172A] hover:bg-black/[0.04]"
                            )}
                        >
                            <Mic size={16} />
                            Minutos de Audio
                        </button>
                    </div>

                    {/* Package Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {packages.map((pkg) => {
                            const isSelected = selectedPkgId === pkg.id
                            return (
                                <div
                                    key={pkg.id}
                                    onClick={() => setSelectedPkgId(pkg.id)}
                                    className={cn(
                                        "relative border rounded-2xl p-5 cursor-pointer transition-all duration-200 group hover:shadow-lg",
                                        isSelected
                                            ? "bg-[rgba(249,115,22,0.08)] border-[rgba(249,115,22,0.4)] ring-1 ring-[rgba(249,115,22,0.3)]"
                                            : "bg-white border-black/[0.08] hover:border-black/[0.15]"
                                    )}
                                >
                                    {/* Popular Badge */}
                                    {pkg.popular && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg shadow-orange-500/20 flex items-center gap-1">
                                            <Sparkles size={10} fill="currentColor" />
                                            MÁS POPULAR
                                        </div>
                                    )}

                                    {/* Check Indicator */}
                                    <div className={cn(
                                        "absolute top-4 right-4 w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
                                        isSelected
                                            ? "bg-[#F97316] border-[#F97316] text-white"
                                            : "border-black/[0.10] text-transparent"
                                    )}>
                                        <Check size={12} strokeWidth={4} />
                                    </div>

                                    {/* Content */}
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-[#0F172A]/40 text-sm font-medium mb-1">
                                                {activeTab === 'conversations' ? 'Paquete de' : 'Recarga de'}
                                            </p>
                                            <p className="text-2xl font-bold text-[#0F172A]">
                                                {pkg.count} {activeTab === 'conversations' ? 'Chats' : 'Min'}
                                            </p>
                                        </div>

                                        <div className="flex items-end justify-between border-t border-white/6/50 pt-4 mt-2">
                                            <div>
                                                {pkg.save > 0 && (
                                                    <p className="text-green-400 text-xs font-medium mb-0.5">
                                                        Ahorras ${pkg.save}
                                                    </p>
                                                )}
                                                <p className="text-2xl font-bold text-[#0F172A]">
                                                    ${Math.floor(pkg.price)}<span className="text-base text-[#0F172A]/40">.{(pkg.price % 1).toFixed(2).substring(2)}</span>
                                                </p>
                                            </div>
                                            <div className="text-[#0F172A]/35 text-xs font-mono">USD</div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Right Column: Checkout Summary */}
                <div className="space-y-6">
                    <Card className="bg-white border-black/[0.08] sticky top-6 shadow-xl overflow-hidden">
                        <div className="h-2 bg-gradient-to-r from-[#25D366] via-[#25D366] to-[#f59e0b]" />
                        <CardContent className="p-6 space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-[#0F172A] mb-4">Resumen de compra</h3>

                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between text-[#0F172A]/40">
                                        <span>Producto</span>
                                        <span className="text-[#0F172A] font-medium">
                                            {selectedPackage?.count} {activeTab === 'conversations' ? 'Conversaciones' : 'Minutos'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-[#0F172A]/40">
                                        <span>Precio</span>
                                        <span className="text-[#0F172A] font-medium">${selectedPackage?.price}</span>
                                    </div>
                                    {selectedPackage && selectedPackage.save > 0 && (
                                        <div className="flex justify-between text-green-400">
                                            <span>Descuento</span>
                                            <span>-${selectedPackage.save}</span>
                                        </div>
                                    )}
                                    <div className="pt-3 border-t border-black/[0.06] flex justify-between items-center">
                                        <span className="text-[#0F172A] font-bold">Total a pagar</span>
                                        <span className="text-2xl font-bold text-[#0F172A]">${selectedPackage?.price}</span>
                                    </div>
                                </div>
                            </div>

                            <Button
                                className="w-full bg-[#F97316] hover:bg-[#ea6a0a] text-white font-bold h-12 rounded-xl shadow-lg shadow-[rgba(249,115,22,0.3)]"
                                onClick={handlePayment}
                                disabled={isProcessing || !selectedPackage}
                            >
                                {isProcessing ? (
                                    <Loader2 className="animate-spin mr-2" />
                                ) : (
                                    <>Pagar Ahora</>
                                )}
                            </Button>

                            <div className="text-center space-y-2">
                                <p className="text-xs text-[#0F172A]/35 flex items-center justify-center gap-1">
                                    <AlertCircle size={12} />
                                    Pago seguro y encriptado
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Frequently Asked Questions Mini */}
                    <div className="bg-white rounded-xl p-5 border border-black/[0.08]">
                        <h4 className="text-sm font-semibold text-[#0F172A]/65 mb-3">¿Cómo funciona?</h4>
                        <ul className="text-xs text-[#0F172A]/35 space-y-2 list-disc pl-4">
                            <li>El saldo se acredita inmediatamente.</li>
                            <li>Las conversaciones no caducan.</li>
                            <li>Soporte prioritario incluido.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}
