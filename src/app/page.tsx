
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
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
  ChevronDown,
  Phone,
  Mail,
  MapPin,
  Instagram,
  Facebook,
  Play,
  Pause,
  Star
} from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';

const WHATSAPP_URL = 'https://wa.me/59169344192?text=Hola%2C%20me%20interesa%20conocer%20más%20sobre%20sus%20servicios';
const WHATSAPP_NUMBER = '+591 69344192';

// ============ HOOKS ============

function useCounter(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

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

function useTypingEffect(words: string[], speed: number = 100, pause: number = 2000) {
  const [text, setText] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentWord = words[wordIndex];
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        setText(currentWord.substring(0, text.length + 1));
        if (text === currentWord) {
          setTimeout(() => setIsDeleting(true), pause);
        }
      } else {
        setText(currentWord.substring(0, text.length - 1));
        if (text === '') {
          setIsDeleting(false);
          setWordIndex((prev) => (prev + 1) % words.length);
        }
      }
    }, isDeleting ? speed / 2 : speed);

    return () => clearTimeout(timeout);
  }, [text, isDeleting, wordIndex, words, speed, pause]);

  return text;
}

// ============ ANIMATIONS ============

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } }
};

// ============ DATA ============

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

const testimonials = [
  {
    name: 'Carlos Mendoza',
    role: 'CEO, RestaurantePro',
    text: 'JABA transformó por completo nuestra atención al cliente. Ahora respondemos al instante, vendemos más y tenemos control total de nuestras suscripciones.',
    rating: 5,
    avatar: '👨‍💼'
  },
  {
    name: 'María Gutiérrez',
    role: 'Directora, Boutique Elegance',
    text: 'La automatización de mensajes es increíble. Nuestros clientes reciben recordatorios y ofertas sin que tengamos que hacer nada. Las ventas crecieron un 40%.',
    rating: 5,
    avatar: '👩‍💼'
  },
  {
    name: 'Diego Ramírez',
    role: 'Fundador, TechStart',
    text: 'El chatbot con IA entiende perfectamente nuestro negocio. Es como tener un vendedor 24/7 que nunca descansa y siempre sabe qué decir.',
    rating: 5,
    avatar: '🧑‍💻'
  },
  {
    name: 'Ana Flores',
    role: 'Gerente, Dental Smile',
    text: 'Desde que implementamos JABA, nuestras citas se agendan solas. Los pacientes aman la atención inmediata por WhatsApp.',
    rating: 5,
    avatar: '👩‍⚕️'
  }
];

const faqs = [
  {
    q: '¿Qué tan rápido puedo empezar a usar JABA?',
    a: 'Puedes tener tu chatbot IA funcionando en menos de 24 horas. Solo necesitas vincular tu WhatsApp Business, entrenar al asistente con la información de tu negocio y listo. Nosotros te acompañamos en todo el proceso.'
  },
  {
    q: '¿Funciona con cualquier tipo de negocio?',
    a: 'Sí. JABA se adapta a restaurantes, clínicas, boutiques, empresas de servicios, tiendas online y cualquier rubro. El chatbot se entrena específicamente con los datos de tu negocio para dar respuestas precisas.'
  },
  {
    q: '¿Puedo gestionar varios números de WhatsApp?',
    a: 'Absolutamente. Nuestro panel unificado te permite gestionar múltiples asistentes y líneas de WhatsApp Business desde una sola cuenta. Ideal para empresas con varios equipos o sucursales.'
  },
  {
    q: '¿Los cobros con QR son seguros?',
    a: 'Sí, los códigos QR se generan directamente desde tu cuenta bancaria. JABA solo automatiza el envío del QR al cliente en el momento adecuado, sin intermediarios en el proceso de pago.'
  },
  {
    q: '¿Qué incluye el servicio de páginas web?',
    a: 'Diseñamos y desarrollamos sitios web modernos, responsive y optimizados para SEO. Incluye dominio, hosting, panel de administración y la integración con WhatsApp para recibir consultas directamente.'
  },
  {
    q: '¿Cómo son los recordatorios automáticos?',
    a: 'JABA envía hasta 3 mensajes automáticos: un recordatorio inicial, un seguimiento de remarketing y un aviso de urgencia. Todo configurable según tus tiempos y necesidades.'
  }
];

const clientLogos = ['RestaurantePro', 'Boutique Elegance', 'Dental Smile', 'TechStart', 'InmoHogar', 'FitGym Pro'];

// ============ MAIN PAGE ============

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const typedText = useTypingEffect(['Automatiza', 'Potencia', 'Escala', 'Transforma'], 80, 1800);

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
            <a href="#demo" className="text-sm text-slate-400 hover:text-white transition-colors">Demo</a>
            <a href="#testimonios" className="text-sm text-slate-400 hover:text-white transition-colors">Testimonios</a>
            <a href="#faq" className="text-sm text-slate-400 hover:text-white transition-colors">FAQ</a>
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

      {/* ============ HERO WITH PARTICLES ============ */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden">
        {/* Particle Canvas */}
        <ParticleBackground />

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
                {typedText}
              </span>
              <span className="inline-block w-[3px] h-[0.8em] bg-indigo-400 ml-1 animate-pulse align-middle" />
              <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400">
                tu negocio con IA
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
                className="group w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-lg hover:shadow-xl hover:shadow-indigo-500/25 hover:scale-[1.02] transition-all text-center flex items-center justify-center gap-2"
              >
                <Send size={20} className="group-hover:translate-x-1 transition-transform" /> Empezar Ahora
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

        {/* Wave Divider */}
        <WaveDivider color="#0f172a" bgColor="transparent" flip={false} />
      </section>

      {/* ============ CLIENT LOGOS MARQUEE ============ */}
      <section className="py-10 bg-slate-900/30 border-y border-white/5 overflow-hidden">
        <div className="container mx-auto px-6 mb-6">
          <p className="text-center text-sm text-slate-500 uppercase tracking-wider font-semibold">Empresas que confían en nosotros</p>
        </div>
        <div className="relative">
          <div className="flex animate-marquee whitespace-nowrap">
            {[...clientLogos, ...clientLogos, ...clientLogos].map((name, i) => (
              <div key={i} className="mx-8 flex items-center gap-3 text-slate-500/60 hover:text-slate-300 transition-colors duration-300">
                <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                  <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-br from-slate-400 to-slate-600">{name.charAt(0)}</span>
                </div>
                <span className="text-sm font-semibold tracking-wide">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ STATS WITH ANIMATED COUNTERS ============ */}
      <section className="py-16 bg-slate-950">
        <div className="container mx-auto px-6">
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            onViewportEnter={() => { }}
          >
            <AnimatedStatCard icon={<Users className="text-indigo-400" size={24} />} end={500} suffix="+" label="Clientes Activos" />
            <AnimatedStatCard icon={<MessageSquare className="text-emerald-400" size={24} />} end={10} suffix="K+" label="Mensajes Enviados" />
            <AnimatedStatCard icon={<Clock className="text-violet-400" size={24} />} end={24} suffix="/7" label="Atención Continua" />
            <AnimatedStatCard icon={<TrendingUp className="text-amber-400" size={24} />} end={95} suffix="%" label="Satisfacción" />
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

      {/* Wave divider */}
      <WaveDivider color="#0f172a80" bgColor="#020617" />

      {/* ============ DEMO VIDEO ============ */}
      <section id="demo" className="py-24 bg-slate-900/50 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-500/10 blur-[150px] rounded-full pointer-events-none" />

        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            className="text-center mb-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <span className="text-violet-400 text-sm font-semibold uppercase tracking-wider">Demo en Vivo</span>
            <h2 className="text-3xl md:text-5xl font-extrabold mt-4 mb-6">
              Mira JABA en acción
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">
              Observa cómo nuestro panel facilita la gestión de tu negocio en tiempo real.
            </p>
          </motion.div>

          <motion.div
            className="max-w-4xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={scaleIn}
          >
            <VideoPlayer />
          </motion.div>
        </div>
      </section>

      {/* ============ CÓMO FUNCIONA ============ */}
      <section id="como-funciona" className="py-24 bg-slate-950 relative overflow-hidden">
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

      {/* Wave divider */}
      <WaveDivider color="#020617" bgColor="#0f172a80" flip />

      {/* ============ WEB DEVELOPMENT HIGHLIGHT ============ */}
      <section className="py-24 relative">
        <div className="container mx-auto px-6">
          <motion.div
            className="relative rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/50 p-8 md:p-16"
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
                  {/* Browser mockup */}
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
                      </div>
                      <div className="h-10 w-1/2 bg-gradient-to-r from-teal-600/30 to-emerald-600/30 rounded-lg mt-4" />
                    </div>
                  </div>
                  {/* Floating elements */}
                  <motion.div
                    className="absolute -top-4 -right-4 w-16 h-16 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-xl shadow-teal-500/30"
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Globe className="text-white" size={28} />
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============ TESTIMONIOS ============ */}
      <section id="testimonios" className="py-24 relative overflow-hidden">
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-violet-500/5 blur-[150px] rounded-full pointer-events-none" />

        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <span className="text-amber-400 text-sm font-semibold uppercase tracking-wider">Testimonios</span>
            <h2 className="text-3xl md:text-5xl font-extrabold mt-4 mb-6">
              Lo que dicen nuestros clientes
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">
              Negocios reales que transformaron su atención al cliente con JABA.
            </p>
          </motion.div>

          <TestimonialCarousel />
        </div>
      </section>

      {/* Wave divider */}
      <WaveDivider color="#0f172a" bgColor="#020617" />

      {/* ============ FAQ ============ */}
      <section id="faq" className="py-24 bg-slate-900/30 relative">
        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <span className="text-cyan-400 text-sm font-semibold uppercase tracking-wider">Preguntas Frecuentes</span>
            <h2 className="text-3xl md:text-5xl font-extrabold mt-4 mb-6">
              ¿Tienes dudas?
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">
              Aquí están las respuestas a las preguntas más comunes.
            </p>
          </motion.div>

          <motion.div
            className="max-w-3xl mx-auto space-y-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            {faqs.map((faq, i) => (
              <FAQItem key={i} question={faq.q} answer={faq.a} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section id="contacto" className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-indigo-950/20 to-slate-950 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 blur-[200px] rounded-full pointer-events-none" />

        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            className="text-center max-w-3xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2
              variants={fadeUp}
              className="text-3xl md:text-5xl font-extrabold mb-6"
            >
              ¿Listo para
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-violet-400"> transformar </span>
              tu negocio?
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-slate-400 text-lg mb-10 max-w-xl mx-auto"
            >
              Escríbenos hoy y te mostramos cómo JABA puede automatizar tu atención al cliente y aumentar tus ventas.
            </motion.p>
            <motion.div
              variants={fadeUp}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-lg hover:shadow-xl hover:shadow-indigo-500/25 hover:scale-[1.02] transition-all"
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white group-hover:scale-110 transition-transform"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                Escribir por WhatsApp
              </a>
              <a
                href={`mailto:info@jabachat.com`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 font-medium transition-all"
              >
                <Mail size={18} /> info@jabachat.com
              </a>
            </motion.div>
            <motion.p variants={fadeUp} className="text-slate-500 text-sm mt-8">
              📞 {WHATSAPP_NUMBER} · La Paz, Bolivia
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="py-12 border-t border-white/5">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <Image src="/logo.png" alt="Jaba" width={32} height={32} className="rounded-lg" />
                <span className="font-bold text-lg">JABA</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed max-w-md">
                Plataforma integral de automatización empresarial con IA. Chatbots inteligentes,
                gestión de clientes, cobros automáticos y desarrollo web profesional.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Servicios</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#servicios" className="hover:text-white transition-colors">Chatbots IA</a></li>
                <li><a href="#servicios" className="hover:text-white transition-colors">Chat Empresarial</a></li>
                <li><a href="#servicios" className="hover:text-white transition-colors">Suscripciones</a></li>
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
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-emerald-500 hover:bg-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:scale-110 transition-all group"
        title="Escribir por WhatsApp"
      >
        <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white group-hover:scale-110 transition-transform"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
      </a>

      {/* ============ MARQUEE KEYFRAMES ============ */}
      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
        .animate-marquee {
          animation: marquee 20s linear infinite;
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(99, 102, 241, 0.3); }
          50% { box-shadow: 0 0 40px rgba(99, 102, 241, 0.6); }
        }
        .glow-border {
          animation: glow-pulse 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

// ============ COMPONENTS ============

function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check if mobile
    const isMobile = window.innerWidth < 768;
    if (isMobile) return; // Skip on mobile for performance

    let animationId: number;
    const particles: { x: number; y: number; vx: number; vy: number; size: number }[] = [];
    const particleCount = 50;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Init particles
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 1
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(99, 102, 241, ${0.1 * (1 - dist / 150)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw & update particles
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(99, 102, 241, 0.4)';
        ctx.fill();

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
}

function VideoPlayer() {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (videoRef.current) {
      if (playing) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setPlaying(!playing);
    }
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/10 glow-border">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/80 border-b border-white/5">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/60" />
          <div className="w-3 h-3 rounded-full bg-amber-500/60" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
        </div>
        <div className="flex-1 mx-4 h-7 rounded-lg bg-slate-700/50 flex items-center px-3">
          <span className="text-xs text-slate-500">jabachat.com/dashboard</span>
        </div>
      </div>
      <div className="relative bg-slate-900 aspect-video">
        <video
          ref={videoRef}
          src="/tutorial.mp4"
          className="w-full h-full object-cover"
          playsInline
          onEnded={() => setPlaying(false)}
        />
        {/* Play/Pause overlay */}
        <button
          onClick={togglePlay}
          className={`absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity duration-300 ${playing ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}
        >
          <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center hover:scale-110 transition-transform">
            {playing ? <Pause size={32} className="text-white" /> : <Play size={32} className="text-white ml-1" />}
          </div>
        </button>
      </div>
    </div>
  );
}

function TestimonialCarousel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActive(prev => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="relative overflow-hidden rounded-2xl bg-white/[0.03] border border-white/5 p-8 md:p-12 min-h-[280px]">
        <div className="absolute top-6 right-8 text-6xl text-indigo-500/10 font-serif pointer-events-none">"</div>
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex gap-1 mb-6">
              {[...Array(testimonials[active].rating)].map((_, i) => (
                <Star key={i} size={18} className="fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="text-lg md:text-xl text-slate-300 leading-relaxed mb-8 italic">
              "{testimonials[active].text}"
            </p>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-2xl">
                {testimonials[active].avatar}
              </div>
              <div>
                <p className="font-bold text-white">{testimonials[active].name}</p>
                <p className="text-sm text-slate-400">{testimonials[active].role}</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Indicators */}
      <div className="flex justify-center gap-2 mt-6">
        {testimonials.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`h-2 rounded-full transition-all duration-300 ${i === active ? 'w-8 bg-indigo-500' : 'w-2 bg-slate-700 hover:bg-slate-600'}`}
          />
        ))}
      </div>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      variants={fadeUp}
      className="border border-white/5 rounded-xl overflow-hidden bg-white/[0.02] hover:border-white/10 transition-colors"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 md:p-6 text-left"
      >
        <span className="text-white font-semibold text-sm md:text-base pr-4">{question}</span>
        <ChevronDown
          size={20}
          className={`text-slate-400 flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div className="px-5 md:px-6 pb-5 md:pb-6 text-slate-400 text-sm leading-relaxed border-t border-white/5 pt-4">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ServiceCard({ icon: Icon, title, description, color, iconColor }: {
  icon: any, title: string, description: string, color: string, iconColor: string
}) {
  return (
    <motion.div
      variants={fadeUp}
      className="group p-8 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/15 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 relative overflow-hidden"
    >
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-5 blur-3xl transition-opacity duration-500 pointer-events-none`} />
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} bg-opacity-10 flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
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
      <span className="text-indigo-400/20 text-7xl font-extrabold absolute -top-6 left-1/2 -translate-x-1/2 pointer-events-none select-none z-0">{number}</span>
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/20 relative z-10">
        <Icon size={28} className="text-white" />
      </div>
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

function AnimatedStatCard({ icon, end, suffix, label }: {
  icon: React.ReactNode, end: number, suffix: string, label: string
}) {
  const { count, start } = useCounter(end, 2000);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) start(); },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [start]);

  return (
    <motion.div ref={ref} variants={fadeUp} className="flex flex-col items-center gap-2">
      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-2">
        {icon}
      </div>
      <span className="text-3xl font-extrabold text-white">{count}{suffix}</span>
      <span className="text-sm text-slate-400">{label}</span>
    </motion.div>
  );
}

function WaveDivider({ color, bgColor, flip = false }: { color: string; bgColor: string; flip?: boolean }) {
  return (
    <div className={`relative w-full h-16 ${flip ? 'rotate-180' : ''}`} style={{ background: bgColor }}>
      <svg
        viewBox="0 0 1440 80"
        className="absolute bottom-0 w-full h-full"
        preserveAspectRatio="none"
      >
        <path
          d="M0,40 C360,80 720,0 1080,40 C1260,60 1380,40 1440,40 L1440,80 L0,80 Z"
          fill={color}
        />
      </svg>
    </div>
  );
}
