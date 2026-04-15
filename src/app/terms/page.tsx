import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <Link href="/login" className="inline-flex items-center text-indigo-600 hover:text-indigo-800 transition-colors font-medium">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Volver al inicio de sesiÃ³n
                    </Link>
                </div>

                <div className="prose prose-slate max-w-none">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">TÃ©rminos y Condiciones de Uso</h1>
                    <p className="text-slate-500 mb-8">Ãšltima actualizaciÃ³n: {new Date().toLocaleDateString()}</p>

                    <div className="space-y-8 text-slate-700">
                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">1. AceptaciÃ³n y Objeto</h2>
                            <p>
                                <strong>JABA SaaS</strong> (en adelante &quot;la Plataforma&quot;), ofrece una plataforma tecnolÃ³gica para crear, entrenar y personalizar asistentes de inteligencia artificial (&ldquo;IAs&rdquo;).
                                El acceso y uso de la Plataforma implica la aceptaciÃ³n plena de estos TÃ©rminos y Condiciones y de la <strong>legislaciÃ³n del Estado Plurinacional de Bolivia</strong> aplicable.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">2. Definiciones</h2>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong>Plataforma:</strong> sitio web, aplicaciones y servicios asociados de JABA SaaS.</li>
                                <li><strong>IA(s):</strong> asistentes de inteligencia artificial creados por los usuarios.</li>
                                <li><strong>Entrenamiento:</strong> informaciÃ³n, prompts, plantillas, mensajes y configuraciones que el usuario suministra.</li>
                                <li><strong>ConversaciÃ³n:</strong> intercambio de mensajes entre un nÃºmero registrado y un nÃºmero distinto.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">3. Naturaleza y DescripciÃ³n del Servicio</h2>
                            <p>
                                La Plataforma es una herramienta de automatizaciÃ³n basada en IA. No garantizamos resultados comerciales especÃ­ficos (ventas, leads), ya que dependen de la gestiÃ³n del usuario.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">4. Programa de Referidos y Pagos</h2>
                            <p>
                                <strong>ComisiÃ³n:</strong> 20% sobre el valor neto pagado por referidos efectivos.
                                <br /><strong>Pagos:</strong> Se procesarÃ¡n a cuentas bancarias en Bolivia. Para montos superiores al Salario MÃ­nimo Nacional, se podrÃ¡ requerir documentaciÃ³n fiscal (NIT/Factura) conforme a la normativa tributaria boliviana.
                                <br /><strong>Restricciones:</strong> Prohibido el autorreferido o cuentas ficticias.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">5. Propiedad Intelectual</h2>
                            <p>
                                Todos los elementos de la Plataforma son propiedad de JABA SaaS. Se prohÃ­be la ingenierÃ­a inversa, copia o distribuciÃ³n no autorizada.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">6. LegislaciÃ³n y JurisdicciÃ³n</h2>
                            <p>
                                Estos TÃ©rminos se rigen por las leyes del <strong>Estado Plurinacional de Bolivia</strong>. Cualquier controversia se someterÃ¡ a los juzgados competentes de <strong>Bolivia</strong>, renunciando a cualquier otro fuero.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">7. Contacto</h2>
                            <p>
                                Para dudas sobre estos tÃ©rminos:<br />
                                Email: soporte@jabasaas.com
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    )
}
