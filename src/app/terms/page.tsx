
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <Link href="/login" className="inline-flex items-center text-indigo-600 hover:text-indigo-800 transition-colors font-medium">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Volver al inicio de sesión
                    </Link>
                </div>

                <div className="prose prose-slate max-w-none">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Términos y Condiciones de Uso</h1>
                    <p className="text-slate-500 mb-8">Última actualización: {new Date().toLocaleDateString()}</p>

                    <div className="space-y-8 text-slate-700">
                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">1. Aceptación y Objeto</h2>
                            <p>
                                <strong>JABA SaaS</strong> (en adelante "la Plataforma"), ofrece una plataforma tecnológica para crear, entrenar y personalizar asistentes de inteligencia artificial (“IAs”).
                                El acceso y uso de la Plataforma implica la aceptación plena de estos Términos y Condiciones y de la <strong>legislación del Estado Plurinacional de Bolivia</strong> aplicable.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">2. Definiciones</h2>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong>Plataforma:</strong> sitio web, aplicaciones y servicios asociados de JABA SaaS.</li>
                                <li><strong>IA(s):</strong> asistentes de inteligencia artificial creados por los usuarios.</li>
                                <li><strong>Entrenamiento:</strong> información, prompts, plantillas, mensajes y configuraciones que el usuario suministra.</li>
                                <li><strong>Conversación:</strong> intercambio de mensajes entre un número registrado y un número distinto.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">3. Naturaleza y Descripción del Servicio</h2>
                            <p>
                                La Plataforma es una herramienta de automatización basada en IA. No garantizamos resultados comerciales específicos (ventas, leads), ya que dependen de la gestión del usuario.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">4. Programa de Referidos y Pagos</h2>
                            <p>
                                <strong>Comisión:</strong> 20% sobre el valor neto pagado por referidos efectivos.
                                <br /><strong>Pagos:</strong> Se procesarán a cuentas bancarias en Bolivia. Para montos superiores al Salario Mínimo Nacional, se podrá requerir documentación fiscal (NIT/Factura) conforme a la normativa tributaria boliviana.
                                <br /><strong>Restricciones:</strong> Prohibido el autorreferido o cuentas ficticias.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">5. Propiedad Intelectual</h2>
                            <p>
                                Todos los elementos de la Plataforma son propiedad de JABA SaaS. Se prohíbe la ingeniería inversa, copia o distribución no autorizada.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">6. Legislación y Jurisdicción</h2>
                            <p>
                                Estos Términos se rigen por las leyes del <strong>Estado Plurinacional de Bolivia</strong>. Cualquier controversia se someterá a los juzgados competentes de <strong>Bolivia</strong>, renunciando a cualquier otro fuero.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">7. Contacto</h2>
                            <p>
                                Para dudas sobre estos términos:<br />
                                Email: soporte@jabasaas.com
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    )
}
