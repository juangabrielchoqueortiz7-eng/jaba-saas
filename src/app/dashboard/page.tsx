
export default async function DashboardPage() {
    return (
        <div className="p-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Panel de Control</h1>
                <p className="text-slate-400">Bienvenido de nuevo a tu espacio de trabajo.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Sample Stat Card */}
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                    <h3 className="text-slate-400 text-sm font-medium mb-1">Conversaciones Activas</h3>
                    <p className="text-3xl font-bold text-white">24</p>
                    <div className="mt-4 flex items-center text-emerald-400 text-sm font-medium">
                        <span>+12%</span>
                        <span className="text-slate-500 ml-1">vs mes anterior</span>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                    <h3 className="text-slate-400 text-sm font-medium mb-1">Clientes Nuevos</h3>
                    <p className="text-3xl font-bold text-white">156</p>
                    <div className="mt-4 flex items-center text-emerald-400 text-sm font-medium">
                        <span>+8%</span>
                        <span className="text-slate-500 ml-1">vs mes anterior</span>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                    <h3 className="text-slate-400 text-sm font-medium mb-1">Tasa de Respuesta</h3>
                    <p className="text-3xl font-bold text-white">1.2m</p>
                    <div className="mt-4 flex items-center text-rose-400 text-sm font-medium">
                        <span>-2%</span>
                        <span className="text-slate-500 ml-1">vs mes anterior</span>
                    </div>
                </div>
            </div>

            <div className="mt-8 bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[400px] flex items-center justify-center text-slate-500">
                <div className="text-center">
                    <p className="mb-2">Aquí irán tus gráficos y tablas de datos.</p>
                    <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                        Configurar Widgets
                    </button>
                </div>
            </div>
        </div>
    )
}
