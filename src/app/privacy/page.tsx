
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
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
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">POLÍTICA DE TRATAMIENTO DE DATOS PERSONALES</h1>
                    <p className="text-slate-500 mb-8">Última actualización: {new Date().toLocaleDateString()}</p>

                    <div className="space-y-8 text-slate-700">
                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">1. Introducción y Marco Legal</h2>
                            <p>
                                En cumplimiento de la <strong>Constitución Política del Estado Plurinacional de Bolivia</strong> (Art. 21.2 y Art. 130 sobre la Acción de Protección de Privacidad) y la <strong>Ley N° 164 General de Telecomunicaciones, Tecnologías de Información y Comunicación</strong>, <strong>JABA SaaS</strong> (en adelante, “La Plataforma”) establece la siguiente Política de Tratamiento de Datos Personales.
                            </p>
                            <p className="mt-2">
                                JABA SaaS utiliza la API de WhatsApp Cloud para automatizar conversaciones mediante Inteligencia Artificial, mejorando el servicio al cliente y las ventas. En este marco, realizamos el tratamiento de datos personales en estricto cumplimiento de la legislación boliviana.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">2. Definiciones</h2>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong>Dato personal:</strong> Cualquier información vinculada o que pueda asociarse a una persona natural o jurídica determinada o determinable.</li>
                                <li><strong>Titular:</strong> Persona natural o jurídica cuyos datos son objeto de tratamiento, con derechos de acceso, rectificación, cancelación y oposición (Derechos ARCO).</li>
                                <li><strong>Tratamiento:</strong> Recolección, almacenamiento, uso, circulación o supresión de datos.</li>
                                <li><strong>Responsable del tratamiento:</strong> JABA SaaS, quien decide sobre las bases de datos y su tratamiento.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">3. Principios Aplicables</h2>
                            <p>Nos regimos por los principios de:</p>
                            <ul className="list-disc pl-5 mt-2 space-y-1">
                                <li><strong>Legalidad:</strong> Tratamiento conforme a la ley boliviana.</li>
                                <li><strong>Finalidad:</strong> Uso legítimo e informado.</li>
                                <li><strong>Consentimiento:</strong> Recolección previa, expresa e informada.</li>
                                <li><strong>Calidad:</strong> Datos veraces y actualizados.</li>
                                <li><strong>Seguridad y Confidencialidad:</strong> Protección contra acceso no autorizado.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">4. Finalidad del Tratamiento</h2>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>Creación y entrenamiento de asistentes de Inteligencia Artificial.</li>
                                <li>Mejorar la interacción con clientes mediante respuestas automatizadas.</li>
                                <li>Almacenar historial de conversaciones para optimizar el rendimiento del asistente.</li>
                                <li>Análisis de seguridad y monitoreo de vulnerabilidades.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">5. Recolección y Tratamiento</h2>
                            <p>
                                Recolectamos datos al registrarse, configurar asistentes o interactuar con el bot. Los mensajes, prompts, instrucciones y números de teléfono se almacenan para garantizar el servicio.
                                <strong>La Plataforma no comercializa ni vende datos personales a terceros.</strong>
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">6. Derechos de los Titulares</h2>
                            <p>
                                Conforme a la legislación boliviana, usted tiene derecho a acceder, actualizar, rectificar y suprimir sus datos (Habeas Data). Puede ejercer estos derechos contactándonos a través de nuestros canales oficiales.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">7. Contacto</h2>
                            <p>
                                Para consultas o reclamos relacionados con su privacidad, contáctenos en:<br />
                                <strong>Email:</strong> soporte@jabasaas.com
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-3">8. Vigencia</h2>
                            <p>
                                Esta política entra en vigencia a partir de su publicación. El uso continuado de la plataforma implica su aceptación y autorización para el tratamiento de datos.
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    )
}
