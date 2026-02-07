'use client'

import { Card } from '@/components/ui/card'
import { MessageSquare, Mic, Wallet, Trophy, Star } from 'lucide-react'

// Mock Data for Achievements
const ACHIEVEMENTS = [
    {
        id: 'conversations',
        title: 'Maestro de la Charla',
        icon: <MessageSquare className="h-8 w-8 text-blue-400" />,
        description: 'Mantén el flujo de conversación constante con tus clientes.',
        milestone: '1000 conversaciones',
        reward: '100 Créditos',
        current: 250,
        target: 1000,
        color: 'from-blue-500 to-cyan-500',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20'
    },
    {
        id: 'audios',
        title: 'Voz del Futuro',
        icon: <Mic className="h-8 w-8 text-purple-400" />,
        description: 'Utiliza audios generados por IA para respuestas más humanas.',
        milestone: '30 min de audio',
        reward: '3 min Gratis',
        current: 5,
        target: 30,
        color: 'from-purple-500 to-pink-500',
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/20'
    },
    {
        id: 'recharges',
        title: 'Inversor',
        icon: <Wallet className="h-8 w-8 text-green-400" />,
        description: 'Total de recargas efectuadas para potenciar tu asistente.',
        milestone: '4 recargas',
        reward: '100 Créditos',
        current: 1,
        target: 4,
        color: 'from-green-500 to-emerald-500',
        bg: 'bg-green-500/10',
        border: 'border-green-500/20'
    }
]

export default function AchievementsPage() {
    return (
        <div className="p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
            <header className="mb-10">
                <div className="flex items-center gap-3 mb-2">
                    <Trophy className="text-yellow-500" size={32} />
                    <h1 className="text-3xl font-bold text-white">Logros y Recompensas</h1>
                </div>
                <p className="text-slate-400 ml-11">Completa objetivos para desbloquear bonificaciones exclusivas.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {ACHIEVEMENTS.map((achievement) => {
                    const progress = Math.min(100, (achievement.current / achievement.target) * 100)

                    return (
                        <Card
                            key={achievement.id}
                            className={`bg-slate-900 border ${achievement.border} shadow-xl relative overflow-hidden group hover:-translate-y-1 transition-all duration-300`}
                        >
                            {/* Background decoration */}
                            <div className={`absolute -right-10 -top-10 w-40 h-40 ${achievement.bg} rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity`} />

                            <div className="p-6 relative z-10 flex flex-col h-full">
                                {/* Header */}
                                <div className="flex justify-between items-start mb-6">
                                    <div className={`p-4 rounded-2xl ${achievement.bg} ring-1 ring-white/5`}>
                                        {achievement.icon}
                                    </div>
                                    <div className="bg-slate-950/50 px-3 py-1 rounded-full border border-slate-800 text-xs font-medium text-slate-300 flex items-center gap-1">
                                        <Star size={12} className="text-yellow-500" />
                                        {achievement.reward}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="mb-6">
                                    <h2 className="text-xl font-bold text-white mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-slate-300 transition-colors">
                                        {achievement.title}
                                    </h2>
                                    <p className="text-slate-400 text-sm leading-relaxed">
                                        {achievement.description}
                                    </p>
                                </div>

                                {/* Progress Section */}
                                <div className="mt-auto space-y-3">
                                    <div className="flex justify-between text-xs font-medium">
                                        <span className="text-slate-300">{progress.toFixed(0)}% Completado</span>
                                        <span className="text-slate-500">{achievement.current} / {achievement.target}</span>
                                    </div>

                                    <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden p-[2px] border border-slate-800">
                                        <div
                                            className={`h-full rounded-full bg-gradient-to-r ${achievement.color} shadow-[0_0_10px_rgba(0,0,0,0.3)] transition-all duration-1000 group-hover:shadow-[0_0_15px_rgba(255,255,255,0.3)]`}
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>

                                    <p className="text-xs text-center text-slate-500 pt-2 font-mono">
                                        Meta: {achievement.milestone}
                                    </p>
                                </div>
                            </div>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}
