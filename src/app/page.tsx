
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  Zap,
  MessageSquare,
  BarChart3,
  ShoppingBag,
  RefreshCw,
  Globe,
  CheckCircle,
  Send,
  Sparkles,
  Clock,
  Users,
  TrendingUp,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  Instagram,
  Facebook
} from 'lucide-react';
import { useState, useEffect } from 'react';

const WHATSAPP_URL = 'https://wa.me/59169344192?text=Hola%2C%20me%20interesa%20conocer%20más%20sobre%20sus%20servicios';
const WHATSAPP_NUMBER = '+591 69344192';

// Animated counter hook
function useCounter(end: number, duration: number = 2000, startOnView: boolean = true) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(!startOnView);

  useEffect(() => {
    if (!started) return;
    let startTime: number;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [end, duration, started]);

  return { count, start: () => setStarted(true) };
}

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } }
};

const services = [
  {
    icon: Bot,
    title: 'Chatbots con IA',
    description: 'Asistentes virtuales entrenados con los datos de tu negocio. Respuestas inteligentes 24/7 que venden, atienden y fidelizan.',
    color: 'from-indigo-500 to-violet-500',
    iconColor: 'text-indigo-400'
  },
  {
    icon: MessageSquare,
    title: 'Chat Empresarial',
    description: 'Panel unificado para gestionar todas tus conversaciones de WhatsApp Business desde un solo lugar.',
    color: 'from-emerald-500 to-teal-500',
    iconColor: 'text-emerald-400'
  },
  {
    icon: RefreshCw,
    title: 'Gestión de Suscripciones',
    description: 'Control total de tus clientes, fechas de vencimiento y renovaciones automáticas con recordatorios inteligentes.',
    color: 'from-amber-500 to-orange-500',
    iconColor: 'text-amber-400'
  },
  {
    icon: Zap,
    title: 'Automatización de Mensajes',
    description: 'Recordatorios, remarketing y seguimiento automático en 3 etapas. Tus clientes siempre informados sin esfuerzo.',
    color: 'from-violet-500 to-purple-500',
    iconColor: 'text-violet-400'
  },
  {
    icon: ShoppingBag,
    title: 'Catálogo y Cobros',
    description: 'Gestiona tus productos, planes y precios. Cobros automáticos con QR bancario integrado.',
    color: 'from-rose-500 to-pink-500',
    iconColor: 'text-rose-400'
  },
  {
    icon: BarChart3,
    title: 'Reportes y Métricas',
    description: 'Visualiza conversiones, ingresos y rendimiento de tu negocio en tiempo real desde tu dashboard.',
    color: 'from-cyan-500 to-blue-500',
    iconColor: 'text-cyan-400'
  },
  {
    icon: Globe,
    title: 'Páginas Web Profesionales',
    description: 'Diseño y desarrollo de sitios web modernos para todo tipo de rubro. Presencia digital que convierte visitantes en clientes.',
    color: 'from-teal-500 to-emerald-500',
    iconColor: 'text-teal-400'
  }
];

const steps = [
  {
    number: '01',
    title: 'Conecta',
    description: 'Vincula tu WhatsApp Business en minutos. Sin complicaciones técnicas.',
    icon: Phone
  },
  {
    number: '02',
    title: 'Configura',
    description: 'Entrena tu asistente IA, carga tus productos y personaliza tus mensajes.',
    icon: Sparkles
  },
  {
    number: '03',
    title: 'Automatiza',
    description: 'Deja que la IA trabaje por ti: ventas, cobros, seguimiento y atención 24/7.',
    icon: Zap
  }
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-indigo-500 selection:text-white overflow-x-hidden">

      {/* ============ NAVBAR ============ */}
      <nav className={`fixed top-0 w-full z-50 border-b transition-all duration-300 ${scrolled ? 'border-white/10 bg-slate-950/80 backdrop-blur-xl shadow-lg shadow-black/20' : 'border-transparent bg-transparent'}`}>
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Jaba" width={36} height={36} className="rounded-lg" />
            <span className="font-bold text-xl tracking-tight">JABA</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#servicios" className="text-sm text-slate-400 hover:text-white transition-colors">Servicios</a>
            <a href="#como-funciona" className="text-sm text-slate-400 hover:text-white transition-colors">Cómo Funciona</a>
            <a href="#contacto" className="text-sm text-slate-400 hover:text-white transition-colors">Contacto</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 rounded-full text-sm font-medium transition-all hover:bg-white/5 text-slate-300 hover:text-white"
            >
              Iniciar Sesión
            </Link>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold hover:shadow-lg hover:shadow-indigo-500/25 transition-all"
            >
              Contáctanos <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden">
        {/* Background effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-indigo-500/15 blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-violet-500/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            className="text-center max-w-4xl mx-auto"
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            <motion.span
              variants={fadeUp}
              className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold tracking-wide uppercase mb-8"
            >
              <Sparkles size={14} /> Potenciado por Inteligencia Artificial
            </motion.span>

            <motion.h1
              variants={fadeUp}
              className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-[1.1]"
            >
              <span className="bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-slate-400">
                Automatiza tu negocio
              </span>
              <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400">
                con Inteligencia Artificial
              </span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              Chatbots inteligentes, gestión de clientes, cobros automáticos y páginas web profesionales.
              Todo lo que tu negocio necesita para crecer, en una sola plataforma.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-lg hover:shadow-xl hover:shadow-indigo-500/25 hover:scale-[1.02] transition-all text-center flex items-center justify-center gap-2"
              >
                <Send size={20} /> Empezar Ahora
              </a>
              <Link
                href="/login"
                className="w-full sm:w-auto px-8 py-4 rounded-full border border-white/10 bg-white/5 text-white font-medium hover:bg-white/10 transition-all backdrop-blur-sm text-center"
              >
                Acceder al Dashboard
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ============ TRUSTED BY / STATS ============ */}
      <section className="py-16 border-y border-white/5 bg-slate-900/30">
        <div className="container mx-auto px-6">
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
          >
            <StatCard icon={<Users className="text-indigo-400" size={24} />} value="500+" label="Clientes Activos" />
            <StatCard icon={<MessageSquare className="text-emerald-400" size={24} />} value="10K+" label="Mensajes Automatizados" />
            <StatCard icon={<Clock className="text-violet-400" size={24} />} value="24/7" label="Atención Continua" />
            <StatCard icon={<TrendingUp className="text-amber-400" size={24} />} value="95%" label="Satisfacción" />
          </motion.div>
        </div>
      </section>

      {/* ============ SERVICIOS ============ */}
      <section id="servicios" className="py-24 relative">
        <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-indigo-500/5 blur-[150px] rounded-full pointer-events-none" />

        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <span className="text-indigo-400 text-sm font-semibold uppercase tracking-wider">Nuestros Servicios</span>
            <h2 className="text-3xl md:text-5xl font-extrabold mt-4 mb-6">
              Todo lo que tu negocio necesita
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">
              Soluciones completas de tecnología y automatización para impulsar el crecimiento de tu empresa.
            </p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={stagger}
          >
            {services.map((service, i) => (
              <ServiceCard key={i} {...service} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ============ CÓMO FUNCIONA ============ */}
      <section id="como-funciona" className="py-24 bg-slate-900/50 border-y border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-500/5 blur-[150px] rounded-full pointer-events-none" />

        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <span className="text-violet-400 text-sm font-semibold uppercase tracking-wider">Cómo Funciona</span>
            <h2 className="text-3xl md:text-5xl font-extrabold mt-4 mb-6">
              3 pasos para automatizar
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">
              Empieza a transformar tu negocio en minutos, no en meses.
            </p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            {steps.map((step, i) => (
              <StepCard key={i} {...step} isLast={i === steps.length - 1} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ============ WEB DEVELOPMENT HIGHLIGHT ============ */}
      <section className="py-24 relative">
        <div className="container mx-auto px-6">
          <motion.div
            className="relative rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/50 p-10 md:p-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-teal-500/10 blur-[100px] rounded-full pointer-events-none" />

            <div className="grid md:grid-cols-2 gap-12 items-center relative z-10">
              <div>
                <span className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold uppercase mb-6">
                  <Globe size={14} /> Nuevo Servicio
                </span>
                <h2 className="text-3xl md:text-4xl font-extrabold mb-6 leading-tight">
                  Páginas Web Profesionales
                  <br />
                  <span className="text-teal-400">para cualquier rubro</span>
                </h2>
                <p className="text-slate-400 text-lg mb-8 leading-relaxed">
                  Diseñamos y desarrollamos sitios web modernos, rápidos y optimizados para convertir visitantes en clientes.
                  Desde landing pages hasta tiendas online, adaptadas a tu marca y tu industria.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    'Diseño responsive y moderno',
                    'Optimización SEO incluida',
                    'Panel de administración fácil',
                    'Integración con WhatsApp y redes'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-slate-300">
                      <CheckCircle size={18} className="text-teal-400 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-bold hover:shadow-lg hover:shadow-teal-500/25 transition-all"
                >
                  Solicitar Cotización <ArrowRight size={16} />
                </a>
              </div>
              <div className="hidden md:flex items-center justify-center">
                <div className="relative w-full max-w-[400px] aspect-square">
                  {/* Decorative browser mockup */}
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-slate-800/50">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/60" />
                        <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                        <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
                      </div>
                      <div className="flex-1 mx-4 h-6 rounded-md bg-slate-700/50 flex items-center px-3">
                        <span className="text-[10px] text-slate-500">www.tunegocio.com</span>
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="h-6 w-3/4 bg-gradient-to-r from-indigo-500/20 to-violet-500/20 rounded" />
                      <div className="h-4 w-full bg-slate-700/30 rounded" />
                      <div className="h-4 w-5/6 bg-slate-700/30 rounded" />
                      <div className="mt-6 grid grid-cols-2 gap-3">
                        <div className="h-24 bg-slate-700/20 rounded-lg border border-white/5" />
                        <div className="h-24 bg-slate-700/20 rounded-lg border border-white/5" />
                        <div className="h-24 bg-slate-700/20 rounded-lg border border-white/5" />
                        <div className="h-24 bg-slate-700/20 rounded-lg border border-white/5" />
                      </div>
                      <div className="mt-4 h-10 w-1/2 bg-gradient-to-r from-teal-600/40 to-emerald-600/40 rounded-full" />
                    </div>
                  </div>
                  {/* Floating decorative elements */}
                  <div className="absolute -top-3 -right-3 w-16 h-16 bg-teal-500/20 border border-teal-500/30 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Globe size={24} className="text-teal-400" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============ CTA FINAL ============ */}
      <section id="contacto" className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-indigo-950/20 to-slate-950 pointer-events-none" />

        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            className="text-center max-w-3xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <h2 className="text-3xl md:text-5xl font-extrabold mb-6">
              ¿Listo para llevar tu negocio
              <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-violet-400">al siguiente nivel?</span>
            </h2>
            <p className="text-slate-400 text-lg mb-10 leading-relaxed">
              Agenda una consulta gratuita y descubre cómo nuestras soluciones pueden transformar tu negocio. Sin compromisos.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-lg hover:shadow-xl hover:shadow-emerald-500/25 hover:scale-[1.02] transition-all text-center flex items-center justify-center gap-3"
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                Hablar por WhatsApp
              </a>
              <a
                href={`mailto:jabachat@gmail.com`}
                className="w-full sm:w-auto px-8 py-4 rounded-full border border-white/10 bg-white/5 text-white font-medium hover:bg-white/10 transition-all backdrop-blur-sm text-center flex items-center justify-center gap-2"
              >
                <Mail size={20} /> Enviar Email
              </a>
            </div>

            {/* Contact info */}
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-8 text-slate-400 text-sm">
              <div className="flex items-center gap-2">
                <Phone size={16} className="text-emerald-400" />
                <span>{WHATSAPP_NUMBER}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-indigo-400" />
                <span>Bolivia</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="py-12 border-t border-white/5 bg-slate-950">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Image src="/logo.png" alt="Jaba" width={32} height={32} className="rounded-lg" />
                <span className="font-bold text-lg">JABA</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                Plataforma inteligente de automatización para negocios. Chatbots con IA, gestión de clientes y desarrollo web profesional.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Servicios</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#servicios" className="hover:text-white transition-colors">Chatbots con IA</a></li>
                <li><a href="#servicios" className="hover:text-white transition-colors">Chat Empresarial</a></li>
                <li><a href="#servicios" className="hover:text-white transition-colors">Automatización</a></li>
                <li><a href="#servicios" className="hover:text-white transition-colors">Páginas Web</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link href="/terms" className="hover:text-white transition-colors">Términos de Servicio</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Política de Privacidad</Link></li>
                <li><a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Contacto</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-500 text-sm">© {new Date().getFullYear()} JABA. Todos los derechos reservados.</p>
            <div className="flex gap-4">
              <a href="#" className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                <Facebook size={16} />
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                <Instagram size={16} />
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* ============ FLOATING WHATSAPP BUTTON ============ */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-emerald-500 hover:bg-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:scale-110 transition-all"
        title="Escribir por WhatsApp"
      >
        <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
      </a>
    </div>
  );
}

// ============ COMPONENTS ============

function ServiceCard({ icon: Icon, title, description, color, iconColor }: {
  icon: any, title: string, description: string, color: string, iconColor: string
}) {
  return (
    <motion.div
      variants={fadeUp}
      className="group p-8 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/15 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 relative overflow-hidden"
    >
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-5 blur-3xl transition-opacity duration-500 pointer-events-none`} />
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} bg-opacity-10 flex items-center justify-center mb-6 shadow-lg`}>
        <Icon size={24} className="text-white" />
      </div>
      <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
      <p className="text-slate-400 leading-relaxed text-sm">{description}</p>
    </motion.div>
  );
}

function StepCard({ number, title, description, icon: Icon, isLast }: {
  number: string, title: string, description: string, icon: any, isLast: boolean
}) {
  return (
    <motion.div variants={fadeUp} className="relative text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/20">
        <Icon size={28} className="text-white" />
      </div>
      <span className="text-indigo-400/50 text-6xl font-extrabold absolute -top-2 left-1/2 -translate-x-1/2 pointer-events-none select-none">{number}</span>
      <h3 className="text-xl font-bold text-white mb-3 relative z-10">{title}</h3>
      <p className="text-slate-400 leading-relaxed text-sm relative z-10">{description}</p>
      {!isLast && (
        <div className="hidden md:block absolute top-8 -right-4 z-20">
          <ChevronRight size={24} className="text-slate-700" />
        </div>
      )}
    </motion.div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode, value: string, label: string }) {
  return (
    <motion.div variants={fadeUp} className="flex flex-col items-center gap-2">
      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-2">
        {icon}
      </div>
      <span className="text-3xl font-extrabold text-white">{value}</span>
      <span className="text-sm text-slate-400">{label}</span>
    </motion.div>
  );
}
