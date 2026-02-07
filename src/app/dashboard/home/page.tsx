import { createClient } from '@/utils/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, FileText, Video, Bell, Globe } from 'lucide-react'
import { redirect } from 'next/navigation'

export default async function HomePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Get User Name (or meta)
    const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario'

    // Static News Data (Mocking the 'Novedades' section)
    const newsItems = [
        {
            title: "Los asistentes pueden interpretar documentos",
            description: "Ahora los asistentes son capaces de entender los documentos que los contactos envían en las conversaciones.",
            date: "hace 8 meses",
            icon: FileText
        },
        {
            title: "Los asistentes pueden interpretar videos",
            description: "Ahora los asistentes son capaces de entender los videos que los contactos envían en las conversaciones.",
            date: "hace 8 meses",
            icon: Video
        },
        {
            title: "Cambiamos nuestro nombre a SellerChat",
            description: "SmartChat evolucionó a SellerChat, no te preocupes todo sigue igual y seguimos con la misma energía. 😊",
            date: "hace un año",
            icon: Sparkles
        },
        {
            title: "Se ha añadido el idioma Portugues",
            description: "Ahora puedes disfrutar de la interfaz de SellerChat en Portugues para tu comodidad.",
            date: "hace un año",
            icon: Globe
        }
    ]

    return (
        <div className="p-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
            <header className="flex items-center justify-between mb-8 bg-green-500 p-4 -mx-8 -mt-8">
                <div className="text-white font-medium">Panel de administración</div>
                <div className="flex items-center gap-4 text-white">
                    <Bell size={20} />
                    <div className="flex items-center gap-2">
                        <span>{userName}</span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 mt-8">
                {/* Main Content */}
                <div className="space-y-8">
                    {/* Welcome Card */}
                    <Card className="bg-white border-none shadow-sm min-h-[300px] flex flex-col justify-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <Sparkles size={200} />
                        </div>
                        <CardContent className="p-10 relative z-10">
                            <h1 className="text-5xl font-light text-slate-800 mb-6">
                                Hola, <span className="font-normal">{userName}</span>
                            </h1>
                            <p className="text-slate-500 text-lg max-w-2xl leading-relaxed">
                                ¡Te damos la bienvenida a tu llegada a Jaba SaaS!
                                Prepárate para explorar un nuevo mundo de conversaciones automatizadas con la ayuda de nuestros asistentes inteligentes. 🤖
                            </p>
                        </CardContent>
                    </Card>

                    {/* Recommendations */}
                    <div>
                        <h2 className="text-2xl font-medium text-yellow-400 mb-4">Recomendaciones</h2>
                        <p className="text-slate-400">No hay recomendaciones por el momento...</p>
                    </div>
                </div>

                {/* News Sidebar */}
                <div className="space-y-6">
                    <h2 className="text-xl font-medium text-cyan-500 mb-4">Novedades</h2>
                    <div className="space-y-4">
                        {newsItems.map((item, index) => (
                            <Card key={index} className="bg-white border-slate-100 hover:shadow-md transition-shadow">
                                <CardContent className="p-5">
                                    <h3 className="font-bold text-slate-800 mb-2 text-sm">{item.title}</h3>
                                    <p className="text-slate-500 text-xs leading-relaxed mb-3">
                                        {item.description}
                                    </p>
                                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                                        <span>{item.date}</span>
                                        <item.icon size={14} className="text-slate-300" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
