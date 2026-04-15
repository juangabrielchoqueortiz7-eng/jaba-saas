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
  Instagram,
  Facebook,
  Star,
  ShoppingCart,
  Check
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { CartDrawer, type CartItem } from './_components/CartDrawer';
import { CheckoutModal } from './_components/CheckoutModal';

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
    iconColor: 'text-[#25D366]',
    popular: true,
    keyBenefit: 'Atiende a tus clientes aunque estés durmiendo',
    stat: '+200',
    statLabel: 'negocios activos',
    hero: true
  },
  {
    icon: MessageSquare,
    title: 'Chat Empresarial',
    description: 'Panel unificado para gestionar todas tus conversaciones de WhatsApp Business desde un solo lugar.',
    iconColor: 'text-white',
    popular: false,
    keyBenefit: 'Todas tus conversaciones en un solo panel',
    stat: '+15K',
    statLabel: 'chats gestionados',
    hero: false
  },
  {
    icon: RefreshCw,
    title: 'Gestión de Suscripciones',
    description: 'Control total de tus clientes, fechas de vencimiento y renovaciones automáticas con recordatorios inteligentes.',
    iconColor: 'text-white',
    popular: false,
    keyBenefit: 'Sin más clientes que se van sin pagar',
    stat: '98%',
    statLabel: 'tasa de retención',
    hero: false
  },
  {
    icon: Zap,
    title: 'Automatización de Mensajes',
    description: 'Recordatorios, remarketing y seguimiento automático en 3 etapas. Tus clientes siempre informados sin esfuerzo.',
    iconColor: 'text-white',
    popular: false,
    keyBenefit: 'Recupera ventas perdidas en piloto automático',
    stat: '+50K',
    statLabel: 'mensajes enviados',
    hero: false
  },
  {
    icon: ShoppingBag,
    title: 'Catálogo y Cobros',
    description: 'Gestiona tus productos, planes y precios. Cobros automáticos con QR bancario integrado.',
    iconColor: 'text-white',
    popular: false,
    keyBenefit: 'Cobra sin perseguir a tus clientes',
    stat: '+$120K',
    statLabel: 'cobrados vía JABA',
    hero: false
  },
  {
    icon: BarChart3,
    title: 'Reportes y Métricas',
    description: 'Visualiza conversiones, ingresos y rendimiento de tu negocio en tiempo real desde tu dashboard.',
    iconColor: 'text-white',
    popular: false,
    keyBenefit: 'Sabe exactamente qué funciona en tu negocio',
    stat: '3x',
    statLabel: 'más conversiones',
    hero: false
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
    initials: 'CM',
    textParts: null
  },
  {
    name: 'María Gutiérrez',
    role: 'Directora, Boutique Elegance',
    text: '',
    rating: 5,
    initials: 'MG',
    textParts: {
      before: 'La automatización de mensajes es increíble. Nuestros clientes reciben recordatorios y ofertas sin que tengamos que hacer nada. Las ventas crecieron un ',
      metric: '40%',
      after: '.'
    }
  },
  {
    name: 'Diego Ramírez',
    role: 'Fundador, TechStart',
    text: 'El chatbot con IA entiende perfectamente nuestro negocio. Es como tener un vendedor 24/7 que nunca descansa y siempre sabe qué decir.',
    rating: 5,
    initials: 'DR',
    textParts: null
  },
  {
    name: 'Ana Flores',
    role: 'Gerente, Dental Smile',
    text: 'Desde que implementamos JABA, nuestras citas se agendan solas. Los pacientes aman la atención inmediata por WhatsApp.',
    rating: 5,
    initials: 'AF',
    textParts: null
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
    q: '¿Cómo funcionan los paquetes de conversaciones?',
    a: 'Comienzas con 500 conversaciones gratis. Cuando las agotes, puedes recargar el pack que más se adapte a tu volumen de mensajes — desde 1,000 hasta 50,000 conversaciones. Pagas solo lo que usas, sin suscripciones forzadas.'
  }
];

const clientLogos = [
  { name: 'RestaurantePro', logo: '/logos/restaurantepro.png' },
  { name: 'Boutique Elegance', logo: '/logos/boutique.png' },
  { name: 'Dental Smile', logo: '/logos/dentalsmile.png' },
  { name: 'TechStart', logo: '/logos/techstart.png' },
  { name: 'InmoHogar', logo: '/logos/inmohogar.png' },
  { name: 'FitGym Pro', logo: '/logos/fitgym.png' }
];

const pricingPacks = [
  { conversations: '500',    price: 'GRATIS',   priceValue: 0,      priceNote: 'primer pack sin costo',    badge: null,          featured: false, cta: 'Empezar gratis', free: true  },
  { conversations: '1,000',  price: '$18.39',   priceValue: 18.39,  priceNote: 'USD · ahorras $1.59',      badge: null,          featured: false, cta: 'Agregar al carrito', free: false },
  { conversations: '2,000',  price: '$35.99',   priceValue: 35.99,  priceNote: 'USD · ahorras $3.97',      badge: 'Más popular', featured: true,  cta: 'Agregar al carrito', free: false },
  { conversations: '5,000',  price: '$84.99',   priceValue: 84.99,  priceNote: 'USD · ahorras $14.91',     badge: 'Mejor valor', featured: false, cta: 'Agregar al carrito', free: false },
  { conversations: '10,000', price: '$159.90',  priceValue: 159.90, priceNote: 'USD · ahorras $39.90',     badge: null,          featured: false, cta: 'Agregar al carrito', free: false },
  { conversations: '20,000', price: '$299.90',  priceValue: 299.90, priceNote: 'USD · ahorras $99.70',     badge: null,          featured: false, cta: 'Agregar al carrito', free: false },
  { conversations: '50,000', price: '$749.90',  priceValue: 749.90, priceNote: 'USD · ahorras $249.10',    badge: null,          featured: false, cta: 'Agregar al carrito', free: false },
];

// WhatsApp SVG reutilizable
function WhatsAppIcon({ className = 'w-5 h-5 fill-current' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// ============ MAIN PAGE ============

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [showAllPacks, setShowAllPacks] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const addToCart = (pack: typeof pricingPacks[0]) => {
    if (cart.find(i => i.conversations === pack.conversations)) {
      setCartOpen(true);
      return;
    }
    setCart(prev => [...prev, {
      conversations: pack.conversations,
      price: pack.price,
      priceValue: pack.priceValue,
      badge: pack.badge,
    }]);
    setCartOpen(true);
  };

  const removeFromCart = (conversations: string) => {
    setCart(prev => prev.filter(i => i.conversations !== conversations));
  };

  const cartTotal = cart.reduce((sum, i) => sum + i.priceValue, 0);

  const visiblePacks = showAllPacks
    ? pricingPacks
    : pricingPacks.filter((_, i) => [0, 2, 3, 4].includes(i));

  return (
    <div className="min-h-screen bg-white text-[#0F172A] selection:bg-[#25D366] selection:text-white overflow-x-hidden">

      {/* ============ NAVBAR ============ */}
      <nav className={`fixed top-0 w-full z-50 border-b transition-all duration-300 ${
        scrolled ? 'border-black/8 bg-white/95 backdrop-blur-xl shadow-sm' : 'border-transparent bg-transparent'
      }`}>
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Jaba" width={36} height={36} className="rounded-lg" />
            <span className="font-bold text-xl tracking-tight text-[#0F172A]">JABA</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#servicios" className="text-sm text-[#0F172A]/50 hover:text-[#0F172A] transition-colors font-medium">Servicios</a>
            <a href="#demo" className="text-sm text-[#0F172A]/50 hover:text-[#0F172A] transition-colors font-medium">Demo</a>
            <a href="#precios" className="text-sm text-[#0F172A]/50 hover:text-[#0F172A] transition-colors font-medium">Precios</a>
            <a href="#testimonios" className="text-sm text-[#0F172A]/50 hover:text-[#0F172A] transition-colors font-medium">Testimonios</a>
            <a href="#faq" className="text-sm text-[#0F172A]/50 hover:text-[#0F172A] transition-colors font-medium">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCartOpen(true)}
              className="relative w-9 h-9 rounded-full bg-black/4 hover:bg-black/8 border border-black/8 flex items-center justify-center transition-all"
              aria-label="Ver carrito"
            >
              <ShoppingCart size={16} className="text-[#0F172A]/60" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#25D366] text-white text-[10px] font-black flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </button>
            <Link
              href="/login"
              className="px-4 py-2 rounded-full text-sm font-medium transition-all hover:bg-black/5 text-[#0F172A]/55 hover:text-[#0F172A]"
            >
              Iniciar Sesión
            </Link>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-2 px-5 py-2 btn-cta text-sm font-bold"
            >
              Contáctanos <ArrowRight size={15} />
            </a>
          </div>
        </div>
      </nav>

      {/* ============ HERO — SPLIT LAYOUT ============ */}
      <section className="relative pt-28 pb-16 md:pt-36 md:pb-24 bg-white overflow-hidden">
        {/* Ambient verde sutil */}
        <div className="absolute top-0 right-0 w-[600px] h-[500px] bg-[#25D366]/8 blur-[200px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[300px] bg-[#128C7E]/5 blur-[150px] rounded-full pointer-events-none" />

        <div className="container mx-auto px-6 relative z-10">
          <div className="grid md:grid-cols-[54fr_46fr] gap-12 lg:gap-20 items-center">

            {/* Left — Texto */}
            <motion.div initial="hidden" animate="visible" variants={stagger}>

              <motion.div variants={fadeUp} className="mb-8 flex items-center gap-3 flex-wrap">
                <span className="green-badge">
                  <WhatsAppIcon className="w-3.5 h-3.5 fill-[#25D366]" />
                  WhatsApp Business API Oficial
                </span>
                <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full bg-black/4 border border-black/8 text-[#0F172A]/45 text-xs font-semibold tracking-wide uppercase">
                  <Sparkles size={12} /> IA Gemini
                </span>
              </motion.div>

              <motion.h1
                variants={fadeUp}
                className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-black tracking-tight leading-[0.92] mb-8"
              >
                <span className="text-[#0F172A]">Tu WhatsApp.</span>
                <br />
                <span className="text-[#0F172A]">Tus clientes.</span>
                <br />
                <span className="text-[#25D366]">Automatizado.</span>
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className="text-lg text-[#0F172A]/50 max-w-xl mb-10 leading-relaxed"
              >
                Cada hora sin automatización son ventas perdidas. JABA te da chatbots con IA, cobros automáticos y gestión de clientes —{' '}
                <span className="text-[#0F172A] font-semibold">activo en menos de 24 horas.</span>
              </motion.p>

              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-start gap-4 mb-8">
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-2.5 px-8 py-4 btn-cta font-bold text-base"
                >
                  <WhatsAppIcon className="w-5 h-5 fill-white" />
                  Agenda tu Demo Gratis
                  <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform" />
                </a>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-8 py-4 btn-outline font-medium text-base"
                >
                  Acceder al Dashboard
                </Link>
              </motion.div>

              <motion.div variants={fadeUp} className="flex items-center gap-2 flex-wrap">
                <span className="trust-badge">Sin permanencia</span>
                <span className="trust-badge">Soporte incluido</span>
                <span className="trust-badge">Activo en 24h</span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/8 border border-red-500/15 text-red-600/70 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  Quedan 3 plazas esta semana
                </span>
              </motion.div>
            </motion.div>

            {/* Right — Chat Mockup */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.25 }}
              className="hidden md:block"
            >
              <HeroChatMockup />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ============ CLIENT LOGOS MARQUEE ============ */}
      <section className="py-10 border-y border-black/6 overflow-hidden bg-[#F7F8FA]">
        <div className="container mx-auto px-6 mb-5">
          <p className="text-center text-xs text-[#0F172A]/35 uppercase tracking-widest font-semibold">Empresas que confían en nosotros</p>
        </div>
        <div className="relative">
          <div className="flex animate-marquee whitespace-nowrap items-center">
            {[...clientLogos, ...clientLogos, ...clientLogos].map((client, i) => (
              <div key={i} className="mx-8 flex items-center gap-3 text-[#0F172A]/30 hover:text-[#0F172A]/70 transition-colors duration-300">
                <div className="w-12 h-12 rounded-lg bg-white border border-black/8 flex items-center justify-center overflow-hidden p-2 shadow-sm">
                  <Image src={client.logo} alt={client.name} width={40} height={40} className="w-full h-full object-contain" />
                </div>
                <span className="text-sm font-semibold tracking-wide">{client.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ STATS ============ */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
          >
            <AnimatedStatCard icon={<Users className="text-[#25D366]" size={22} />} end={500} suffix="+" label="Negocios automatizados" />
            <AnimatedStatCard icon={<MessageSquare className="text-[#25D366]" size={22} />} end={10} suffix="K+" label="Mensajes por mes" />
            <AnimatedStatCard icon={<Clock className="text-[#25D366]" size={22} />} end={24} suffix="/7" label="Horas al día, 7 días" />
            <AnimatedStatCard icon={<TrendingUp className="text-[#25D366]" size={22} />} end={95} suffix="%" label="Tasa de satisfacción" />
          </motion.div>
        </div>
      </section>

      {/* ============ SERVICIOS ============ */}
      <section id="servicios" className="py-24 bg-[#F7F8FA]">
        <div className="container mx-auto px-6">
          <motion.div
            className="mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <span className="green-badge mb-6 inline-flex">Nuestros Servicios</span>
            <h2 className="text-4xl md:text-6xl font-black mt-4 tracking-tight leading-[1.05]">
              Todo lo que tu negocio
              <br />
              <span className="text-[#0F172A]/30">necesita en un solo lugar.</span>
            </h2>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-5"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={stagger}
          >
            {services.map((service, i) => (
              <ServiceCard key={i} {...service} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ============ DEMO ============ */}
      <section id="demo" className="py-24 bg-white relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[#25D366]/8 blur-[150px] rounded-full pointer-events-none" />

        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            className="text-center mb-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <span className="green-badge mb-6 inline-flex">Demo en Vivo</span>
            <h2 className="text-4xl md:text-6xl font-black mt-4 mb-4 tracking-tight text-[#0F172A]">
              Mira JABA en acción.
            </h2>
            <p className="text-[#0F172A]/45 max-w-xl mx-auto text-lg">
              Observa cómo el asistente IA gestiona clientes en tiempo real.
            </p>
          </motion.div>

          <motion.div
            className="max-w-4xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={scaleIn}
          >
            <InteractiveDemo />
          </motion.div>
        </div>
      </section>

      {/* ============ CÓMO FUNCIONA ============ */}
      <section id="como-funciona" className="py-24 bg-[#F7F8FA]">
        <div className="container mx-auto px-6">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <span className="green-badge mb-6 inline-flex">Cómo Funciona</span>
            <h2 className="text-4xl md:text-6xl font-black mt-4 mb-4 tracking-tight text-[#0F172A]">
              3 pasos para automatizar.
            </h2>
            <p className="text-[#0F172A]/45 max-w-xl mx-auto text-lg">
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

      {/* ============ PRECIOS ============ */}
      <section id="precios" className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <span className="green-badge mb-6 inline-flex">Precios</span>
            <h2 className="text-4xl md:text-6xl font-black mt-4 mb-4 tracking-tight text-[#0F172A]">
              Paga solo por lo que usas.
            </h2>
            <p className="text-[#0F172A]/45 text-lg mb-2">Sin suscripciones forzadas. Sin contratos. Sin sorpresas.</p>
            <p className="text-[#0F172A]/30 text-sm">Recarga base: 500 conversaciones = $9.99 USD</p>
          </motion.div>

          <motion.div
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={stagger}
          >
            {visiblePacks.map((pack) => {
              const inCart = cart.some(i => i.conversations === pack.conversations);
              return (
                <motion.div
                  key={pack.conversations}
                  variants={fadeUp}
                  className={`pricing-card flex flex-col ${pack.featured ? 'featured' : ''}`}
                >
                  {pack.badge && (
                    <span className="popular-badge">{pack.badge}</span>
                  )}
                  <p className="text-[#0F172A]/40 text-xs font-semibold uppercase tracking-wider mb-3">
                    {pack.conversations} conversaciones
                  </p>
                  <p className={`font-black mb-1 leading-none tracking-tight ${
                    pack.price === 'GRATIS' ? 'text-[#25D366] text-4xl' : 'text-[#0F172A] text-3xl'
                  }`}>
                    {pack.price}
                  </p>
                  <p className="text-[#0F172A]/30 text-xs mb-6">{pack.priceNote}</p>
                  <div className="flex-1" />
                  {pack.free ? (
                    <a
                      href={WHATSAPP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full text-center py-2.5 rounded-full text-sm font-bold transition-all block btn-cta text-black"
                    >
                      {pack.cta}
                    </a>
                  ) : inCart ? (
                    <button
                      onClick={() => setCartOpen(true)}
                      className="w-full text-center py-2.5 rounded-full text-sm font-bold transition-all flex items-center justify-center gap-2 bg-[#25D366]/15 border border-[#25D366]/40 text-[#25D366]"
                    >
                      <Check size={14} /> En el carrito
                    </button>
                  ) : (
                    <button
                      onClick={() => addToCart(pack)}
                      className={`w-full text-center py-2.5 rounded-full text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                        pack.featured ? 'btn-cta text-black' : 'btn-outline'
                      }`}
                    >
                      <ShoppingCart size={14} /> {pack.cta}
                    </button>
                  )}
                </motion.div>
              );
            })}
          </motion.div>

          <div className="text-center mt-8">
            <button
              onClick={() => setShowAllPacks(!showAllPacks)}
              className="inline-flex items-center gap-2 text-[#0F172A]/40 hover:text-[#0F172A]/70 text-sm font-medium transition-colors"
            >
              <ChevronDown
                size={17}
                className={`transition-transform duration-300 ${showAllPacks ? 'rotate-180' : ''}`}
              />
              {showAllPacks ? 'Ver menos packs' : 'Ver todos los packs'}
            </button>
          </div>
        </div>
      </section>

      {/* ============ TESTIMONIOS ============ */}
      <section id="testimonios" className="py-24 bg-[#F7F8FA]">
        <div className="container mx-auto px-6">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <span className="green-badge mb-6 inline-flex">Testimonios</span>
            <h2 className="text-4xl md:text-6xl font-black mt-4 mb-6 tracking-tight text-[#0F172A]">
              Lo que dicen nuestros
              <br />
              <span className="text-[#0F172A]/30">clientes.</span>
            </h2>
          </motion.div>

          <TestimonialCarousel />
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <span className="green-badge mb-6 inline-flex">Preguntas Frecuentes</span>
            <h2 className="text-4xl md:text-6xl font-black mt-4 mb-4 tracking-tight text-[#0F172A]">
              ¿Tienes dudas?
            </h2>
            <p className="text-[#0F172A]/45 max-w-xl mx-auto text-lg">
              Aquí están las respuestas a las preguntas más comunes.
            </p>
          </motion.div>

          <motion.div
            className="max-w-3xl mx-auto space-y-3"
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
      <section id="contacto" className="py-24 bg-[#F7F8FA]">
        <div className="container mx-auto px-6">
          <motion.div
            className="relative rounded-2xl border border-[#25D366]/20 p-10 md:p-16 text-center max-w-4xl mx-auto overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)' }}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-[#25D366]/10 blur-[150px] rounded-full pointer-events-none" />

            <div className="relative z-10">
              <motion.span variants={fadeUp} className="green-badge mb-8 inline-flex">
                Empieza hoy
              </motion.span>
              <motion.h2
                variants={fadeUp}
                className="text-4xl md:text-6xl font-black mb-4 tracking-tight mt-2 text-[#0F172A]"
              >
                ¿Listo para automatizar
                <br />
                <span className="text-[#25D366]">tu negocio?</span>
              </motion.h2>
              <motion.p
                variants={fadeUp}
                className="text-[#0F172A]/50 text-lg mb-4 max-w-xl mx-auto"
              >
                Agenda una demo gratuita y te mostramos cómo JABA puede transformar tu negocio en menos de 24 horas.
              </motion.p>
              <motion.p variants={fadeUp} className="text-[#128C7E] text-sm font-semibold mb-10 flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
                Respondemos en menos de 2 horas
              </motion.p>
              <motion.div
                variants={fadeUp}
                className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
              >
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-3 px-8 py-4 btn-cta font-bold text-lg"
                >
                  <WhatsAppIcon className="w-6 h-6 fill-white" />
                  Agenda una Demo Gratuita
                </a>
                <a
                  href="mailto:info@jabachat.com"
                  className="inline-flex items-center gap-2 px-8 py-4 btn-outline font-medium"
                >
                  <Mail size={18} /> info@jabachat.com
                </a>
              </motion.div>
              <motion.div variants={fadeUp} className="flex items-center justify-center gap-3 flex-wrap mb-6">
                <span className="trust-badge">Sin tarjeta de crédito</span>
                <span className="trust-badge">Garantía de satisfacción</span>
                <span className="trust-badge">Soporte directo incluido</span>
              </motion.div>
              <motion.p variants={fadeUp} className="text-[#0F172A]/30 text-sm">
                {WHATSAPP_NUMBER} · La Paz, Bolivia
              </motion.p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="py-12 border-t border-black/6 bg-[#0F172A]">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <Image src="/logo.png" alt="Jaba" width={32} height={32} className="rounded-lg" />
                <span className="font-bold text-lg text-white">JABA</span>
              </div>
              <p className="text-white/35 text-sm leading-relaxed max-w-md">
                Plataforma integral de automatización empresarial con IA. Chatbots inteligentes,
                gestión de clientes, cobros automáticos y reportes en tiempo real.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4 text-sm">Servicios</h4>
              <ul className="space-y-2 text-sm text-white/40">
                <li><a href="#servicios" className="hover:text-[#25D366] transition-colors">Chatbots IA</a></li>
                <li><a href="#servicios" className="hover:text-[#25D366] transition-colors">Chat Empresarial</a></li>
                <li><a href="#servicios" className="hover:text-[#25D366] transition-colors">Suscripciones</a></li>
                <li><a href="#servicios" className="hover:text-[#25D366] transition-colors">Automatización</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4 text-sm">Legal</h4>
              <ul className="space-y-2 text-sm text-white/40">
                <li><Link href="/terms" className="hover:text-[#25D366] transition-colors">Términos de Servicio</Link></li>
                <li><Link href="/privacy" className="hover:text-[#25D366] transition-colors">Política de Privacidad</Link></li>
                <li><a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="hover:text-[#25D366] transition-colors">Contacto</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-white/25 text-sm">© {new Date().getFullYear()} JABA. Todos los derechos reservados.</p>
            <div className="flex gap-4">
              <a href="#" className="w-9 h-9 rounded-full bg-white/5 border border-white/8 flex items-center justify-center text-white/35 hover:text-[#25D366] hover:border-[#25D366]/25 transition-all">
                <Facebook size={15} />
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-white/5 border border-white/8 flex items-center justify-center text-white/35 hover:text-[#25D366] hover:border-[#25D366]/25 transition-all">
                <Instagram size={15} />
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* ============ CART DRAWER ============ */}
      <CartDrawer
        isOpen={cartOpen}
        items={cart}
        onClose={() => setCartOpen(false)}
        onRemove={removeFromCart}
        onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }}
      />

      {/* ============ CHECKOUT MODAL ============ */}
      <CheckoutModal
        isOpen={checkoutOpen}
        items={cart}
        total={cartTotal}
        onClose={() => setCheckoutOpen(false)}
        onSuccess={() => setCart([])}
      />

      {/* ============ FLOATING WHATSAPP BUTTON ============ */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#25D366] hover:bg-[#1fad52] rounded-full flex items-center justify-center shadow-lg shadow-[#25D366]/30 hover:scale-110 transition-all"
        title="Escribir por WhatsApp"
      >
        <WhatsAppIcon className="w-7 h-7 fill-white" />
      </a>

      {/* ============ GLOBAL STYLES ============ */}
      <style jsx global>{`
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
        .animate-marquee {
          animation: marquee 20s linear infinite;
        }
      `}</style>
    </div>
  );
}

// ============ COMPONENTS ============

function HeroChatMockup() {
  return (
    <div className="relative">
      <div className="relative w-full max-w-[320px] mx-auto">
        {/* Phone shell */}
        <div className="bg-[#111] rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl shadow-black/60">
          {/* Notch */}
          <div className="bg-[#111] py-2 px-6 flex justify-center">
            <div className="w-20 h-5 bg-black rounded-full" />
          </div>
          {/* WhatsApp chat */}
          <div className="bg-[#0b141a]">
            {/* Header */}
            <div className="bg-[#1f2c33] px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0">
                <Bot size={17} className="text-black" />
              </div>
              <div>
                <p className="text-white text-sm font-semibold leading-none">JABA Bot</p>
                <p className="text-[#25D366] text-xs flex items-center gap-1 mt-0.5">
                  <span className="w-1 h-1 rounded-full bg-[#25D366] animate-pulse" />
                  en línea
                </p>
              </div>
            </div>
            {/* Messages */}
            <div className="px-3 py-4 space-y-2.5 min-h-[260px] flex flex-col justify-end">
              <div className="bg-[#1f2c33] text-white/75 rounded-xl rounded-tl-none px-3 py-2 text-sm max-w-[85%] self-start">
                Hola! ¿En qué te ayudo? 👋
                <div className="text-white/25 text-[10px] text-right mt-1">9:41</div>
              </div>
              <div className="bg-[#005c4b] text-white/85 rounded-xl rounded-tr-none px-3 py-2 text-sm max-w-[80%] self-end ml-auto">
                ¿Cuánto cuesta?
                <div className="text-white/35 text-[10px] text-right mt-1 flex justify-end items-center gap-1">
                  9:42 <span className="text-sky-400">✓✓</span>
                </div>
              </div>
              <div className="bg-[#1f2c33] text-white/75 rounded-xl rounded-tl-none px-3 py-2 text-sm max-w-[85%] self-start">
                Empiezas con <span className="text-[#25D366] font-bold">500 conversaciones gratis</span>. ¿Te agendo una demo?
                <div className="text-white/25 text-[10px] text-right mt-1">9:42</div>
              </div>
              <div className="bg-[#005c4b] text-white/85 rounded-xl rounded-tr-none px-3 py-2 text-sm max-w-[60%] self-end ml-auto">
                ¡Sí! 🙌
                <div className="text-white/35 text-[10px] text-right mt-1 flex justify-end items-center gap-1">
                  9:43 <span className="text-sky-400">✓✓</span>
                </div>
              </div>
            </div>
            {/* Input bar */}
            <div className="bg-[#1f2c33] px-3 py-2.5 flex items-center gap-2">
              <div className="flex-1 bg-[#2a3942] rounded-full h-9 px-4 flex items-center">
                <span className="text-white/20 text-xs">Escribe un mensaje...</span>
              </div>
              <div className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0">
                <Send size={15} className="text-black -ml-0.5" />
              </div>
            </div>
          </div>
          {/* Home indicator */}
          <div className="bg-[#111] py-2 flex justify-center">
            <div className="w-20 h-1 bg-white/15 rounded-full" />
          </div>
        </div>

        {/* Floating badge — 24/7 */}
        <motion.div
          className="absolute -top-3 -right-2 bg-[#25D366] text-black text-xs font-black px-3 py-1.5 rounded-full shadow-lg shadow-[#25D366]/40"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          24/7 activo
        </motion.div>

        {/* Floating stat — tiempo de respuesta */}
        <motion.div
          className="absolute -bottom-2 -left-6 bg-white border border-black/10 rounded-xl px-3 py-2 shadow-xl"
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        >
          <p className="text-[9px] text-[#0F172A]/40 uppercase tracking-wider">Respuesta</p>
          <p className="text-[#0F172A] font-black text-sm">&lt; 1 segundo</p>
        </motion.div>
      </div>
    </div>
  );
}

function InteractiveDemo() {
  const [messages, setMessages] = useState<{ id: number; text: string; sender: 'user' | 'bot'; time: string }[]>([]);
  const [typing, setTyping] = useState(false);

  const demoSequence = [
    { text: '¡Hola! Quiero información sobre los planes', sender: 'user', delay: 1000 },
    { text: '¡Hola! 👋 Empiezas con 500 conversaciones GRATIS. Sin tarjeta. ¿Te agendo una demo?', sender: 'bot', delay: 1500 },
    { text: 'Sí, por favor', sender: 'user', delay: 2000 },
    { text: 'Perfecto. Dame tu nombre y tipo de negocio y preparo una propuesta a medida. 🚀', sender: 'bot', delay: 1500 }
  ];

  useEffect(() => {
    let currentTimeout: NodeJS.Timeout;
    let isActive = true;

    const runSequence = async () => {
      setMessages([]);
      for (const msg of demoSequence) {
        if (!isActive) break;
        await new Promise(resolve => { currentTimeout = setTimeout(resolve, msg.delay); });
        if (!isActive) break;
        if (msg.sender === 'bot') {
          setTyping(true);
          await new Promise(resolve => { currentTimeout = setTimeout(resolve, 800); });
          if (!isActive) break;
          setTyping(false);
        }
        setMessages(prev => [...prev, {
          id: Date.now(),
          text: msg.text,
          sender: msg.sender as 'user' | 'bot',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      }
      if (isActive) {
        currentTimeout = setTimeout(() => { if (isActive) runSequence(); }, 4000);
      }
    };

    runSequence();
    return () => { isActive = false; clearTimeout(currentTimeout); };
  }, []);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/8 bg-[#111] shadow-2xl">
      <div className="flex items-center gap-2 px-4 py-3 bg-[#0a0a0a] border-b border-white/5">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/50" />
          <div className="w-3 h-3 rounded-full bg-amber-500/50" />
          <div className="w-3 h-3 rounded-full bg-[#25D366]/60" />
        </div>
        <div className="flex-1 mx-4 h-6 rounded-lg bg-white/4 flex items-center px-3 justify-center">
          <span className="text-xs text-white/30 font-medium">Asistente IA · JABA</span>
        </div>
      </div>

      <div className="aspect-[16/10] sm:aspect-video relative overflow-hidden bg-[#0b141a] flex flex-col">
        <div className="bg-[#1f2c33] px-4 py-3 flex items-center gap-3 border-b border-white/5">
          <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0">
            <Bot className="text-black" size={18} />
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm">JABA Bot</h4>
            <p className="text-[#25D366] text-xs flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse" />
              en línea
            </p>
          </div>
        </div>

        <div className="flex-1 p-4 overflow-y-auto flex flex-col justify-end gap-3">
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className={`max-w-[85%] rounded-xl p-3 text-sm shadow-md ${
                  msg.sender === 'user'
                    ? 'bg-[#005c4b] text-white/85 self-end rounded-tr-none ml-auto'
                    : 'bg-[#1f2c33] text-white/75 self-start rounded-tl-none border border-white/5'
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                <div className="text-[10px] text-white/25 text-right mt-1 flex justify-end items-center gap-1">
                  {msg.time}
                  {msg.sender === 'user' && <span className="text-sky-400 text-xs">✓✓</span>}
                </div>
              </motion.div>
            ))}
            {typing && (
              <motion.div
                key="typing"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-[#1f2c33] border border-white/5 self-start rounded-xl rounded-tl-none p-4 max-w-[80%] flex items-center gap-1.5"
              >
                <div className="w-1.5 h-1.5 bg-white/35 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-white/35 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-white/35 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="bg-[#1f2c33] px-3 py-3 flex items-center gap-3 border-t border-white/5">
          <div className="flex-1 bg-[#2a3942] rounded-full h-11 px-5 flex items-center border border-white/5">
            <span className="text-white/25 text-sm">Escribe un mensaje...</span>
          </div>
          <div className="w-11 h-11 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0">
            <Send size={17} className="text-black -ml-0.5" />
          </div>
        </div>
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

  const t = testimonials[active];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="relative overflow-hidden rounded-2xl bg-white border border-black/8 p-8 md:p-12 min-h-[280px] shadow-md">
        <div className="absolute top-6 right-8 text-7xl text-[#25D366]/15 font-serif pointer-events-none select-none">&quot;</div>
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex gap-1 mb-6">
              {[...Array(t.rating)].map((_, i) => (
                <Star key={i} size={20} className="fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="text-lg md:text-xl text-[#0F172A]/65 leading-relaxed mb-8 italic">
              &ldquo;{t.textParts ? (
                <>
                  {t.textParts.before}
                  <span className="metric-highlight not-italic">{t.textParts.metric}</span>
                  {t.textParts.after}
                </>
              ) : t.text}&rdquo;
            </p>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#F0FDF4] border border-[#25D366]/20 flex items-center justify-center flex-shrink-0">
                <span className="text-[#128C7E] font-black text-sm">{t.initials}</span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-[#0F172A]">{t.name}</p>
                  <span className="verified-pill">
                    <CheckCircle size={11} /> Verificado
                  </span>
                </div>
                <p className="text-sm text-[#0F172A]/40">{t.role}</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex justify-center gap-2 mt-6">
        {testimonials.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === active ? 'w-8 bg-[#25D366]' : 'w-1.5 bg-black/15 hover:bg-black/30'
            }`}
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
      className="border border-black/8 rounded-xl overflow-hidden bg-white hover:border-[#25D366]/30 transition-colors shadow-sm"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 md:p-6 text-left"
      >
        <span className="text-[#0F172A] font-semibold text-sm md:text-base pr-4">{question}</span>
        <ChevronDown
          size={20}
          className={`text-[#25D366] flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
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
            <div className="px-5 md:px-6 pb-5 md:pb-6 text-[#0F172A]/50 text-sm leading-relaxed border-t border-black/6 pt-4">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ---- Mini Mockup Components ---- */

function MiniChatMockup() {
  return (
    <div className="bg-[#0b141a] rounded-lg overflow-hidden h-full">
      <div className="bg-[#1f2c33] px-3 py-2 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0">
          <Bot size={12} className="text-black" />
        </div>
        <div>
          <p className="text-white text-[10px] font-semibold leading-none">JABA Bot</p>
          <p className="text-[#25D366] text-[8px] flex items-center gap-0.5 mt-0.5">
            <span className="w-1 h-1 rounded-full bg-[#25D366]" />
            en línea
          </p>
        </div>
      </div>
      <div className="px-2 py-2 space-y-1.5 flex flex-col justify-end">
        <div className="bg-[#1f2c33] text-white/70 rounded-lg rounded-tl-none px-2 py-1.5 text-[9px] max-w-[85%] self-start">
          ¡Hola! ¿En qué te ayudo? 👋
        </div>
        <div className="bg-[#005c4b] text-white/80 rounded-lg rounded-tr-none px-2 py-1.5 text-[9px] max-w-[75%] self-end">
          ¿Cuánto cuesta?
        </div>
        <div className="bg-[#1f2c33] text-white/70 rounded-lg rounded-tl-none px-2 py-1.5 text-[9px] max-w-[85%] self-start">
          Empiezas con <span className="text-[#25D366] font-bold">500 gratis</span> 🎉
        </div>
      </div>
    </div>
  );
}

function MiniInboxMockup() {
  const chats = [
    { initials: 'CM', name: 'Carlos M.', msg: 'Necesito info del plan...', unread: 3, color: '#25D366' },
    { initials: 'MG', name: 'María G.', msg: 'Perfecto, gracias!', unread: 0, color: '#3b82f6' },
    { initials: 'DR', name: 'Diego R.', msg: '¿Cuánto cuesta el...', unread: 1, color: '#f59e0b' },
  ];
  return (
    <div className="h-full flex flex-col">
      <div className="bg-[#1a1a1a] px-3 py-2 border-b border-white/5">
        <p className="text-[9px] text-white/40 font-semibold uppercase tracking-wider">Bandeja de entrada</p>
      </div>
      <div className="flex-1 divide-y divide-white/5">
        {chats.map((c, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 hover:bg-white/[0.02] transition-colors">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[8px] font-bold" style={{ background: `${c.color}20`, color: c.color }}>
              {c.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-white/70 truncate">{c.name}</p>
              <p className="text-[9px] text-white/30 truncate">{c.msg}</p>
            </div>
            {c.unread > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#25D366] text-black text-[8px] font-bold flex items-center justify-center flex-shrink-0">
                {c.unread}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniSubscriptionMockup() {
  return (
    <div className="h-full p-3 flex flex-col gap-2">
      <div className="flex-1 bg-[#1a1a1a] rounded-lg p-2.5 border border-white/5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-bold text-white/70">Plan Pro</span>
          <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-full bg-[#25D366]/15 text-[#25D366]">Activo</span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-1.5 mb-1">
          <div className="bg-[#25D366] h-1.5 rounded-full" style={{ width: '35%' }} />
        </div>
        <p className="text-[8px] text-white/25">350 / 1,000 conversaciones</p>
      </div>
      <div className="flex-1 bg-[#1a1a1a] rounded-lg p-2.5 border border-white/5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-bold text-white/70">Plan Basic</span>
          <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">Vence 3d</span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-1.5 mb-1">
          <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: '90%' }} />
        </div>
        <p className="text-[8px] text-white/25">450 / 500 conversaciones</p>
      </div>
    </div>
  );
}

function MiniFlowMockup() {
  return (
    <div className="h-full flex items-center justify-center px-4 py-3">
      <div className="flex items-center gap-1 w-full">
        {/* Node 1 */}
        <div className="flex-1 bg-[#1a1a1a] border border-white/5 border-l-2 border-l-[#25D366] rounded-lg px-2 py-2 text-center">
          <MessageSquare size={10} className="text-[#25D366] mx-auto mb-1" />
          <p className="text-[8px] text-white/60 font-medium">Mensaje</p>
        </div>
        {/* Connector */}
        <div className="flex items-center gap-0.5">
          <div className="w-3 h-[1px] border-t border-dashed border-white/15" />
          <ChevronRight size={8} className="text-white/15 -mx-1" />
        </div>
        {/* Node 2 */}
        <div className="flex-1 bg-[#1a1a1a] border border-white/5 rounded-lg px-2 py-2 text-center">
          <Clock size={10} className="text-amber-400 mx-auto mb-1" />
          <p className="text-[8px] text-white/60 font-medium">Esperar 24h</p>
        </div>
        {/* Connector */}
        <div className="flex items-center gap-0.5">
          <div className="w-3 h-[1px] border-t border-dashed border-white/15" />
          <ChevronRight size={8} className="text-white/15 -mx-1" />
        </div>
        {/* Node 3 */}
        <div className="flex-1 bg-[#1a1a1a] border border-white/5 rounded-lg px-2 py-2 text-center">
          <Zap size={10} className="text-[#25D366] mx-auto mb-1" />
          <p className="text-[8px] text-white/60 font-medium">Seguimiento</p>
        </div>
      </div>
    </div>
  );
}

function MiniCatalogMockup() {
  return (
    <div className="h-full p-3 flex gap-2">
      <div className="flex-1 bg-[#1a1a1a] rounded-lg border border-white/5 p-2.5 flex flex-col">
        <div className="w-full flex-1 bg-white/[0.03] rounded-md flex items-center justify-center mb-2">
          <ShoppingBag size={14} className="text-white/10" />
        </div>
        <p className="text-[9px] font-semibold text-white/60">Plan Premium</p>
        <p className="text-[10px] font-bold text-[#25D366]">$35.99</p>
      </div>
      <div className="flex-1 bg-[#1a1a1a] rounded-lg border border-white/5 p-2.5 flex flex-col">
        <div className="w-full flex-1 bg-white/[0.03] rounded-md flex items-center justify-center mb-2">
          <ShoppingBag size={14} className="text-white/10" />
        </div>
        <p className="text-[9px] font-semibold text-white/60">Pack 5000</p>
        <p className="text-[10px] font-bold text-[#25D366]">$84.99</p>
      </div>
    </div>
  );
}

function MiniChartMockup() {
  const bars = [
    { h: '35%', label: 'L' },
    { h: '55%', label: 'M' },
    { h: '45%', label: 'M' },
    { h: '80%', label: 'J' },
    { h: '100%', label: 'V' },
    { h: '65%', label: 'S' },
  ];
  return (
    <div className="h-full p-3 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[9px] text-white/40 font-semibold">Conversiones</p>
        <p className="text-[10px] font-bold text-[#25D366]">+24%</p>
      </div>
      <div className="flex-1 flex items-end gap-1.5 pb-4 relative">
        <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-white/5" />
        {bars.map((bar, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-sm bg-[#25D366]"
              style={{ height: bar.h, opacity: 0.2 + (i * 0.15), minHeight: 4 }}
            />
            <span className="text-[7px] text-white/25">{bar.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getServiceMockup(title: string) {
  switch (title) {
    case 'Chat Empresarial': return <MiniInboxMockup />;
    case 'Gestión de Suscripciones': return <MiniSubscriptionMockup />;
    case 'Automatización de Mensajes': return <MiniFlowMockup />;
    case 'Catálogo y Cobros': return <MiniCatalogMockup />;
    case 'Reportes y Métricas': return <MiniChartMockup />;
    default: return null;
  }
}

function ServiceCard({ icon: Icon, title, description, iconColor, popular, keyBenefit, stat, statLabel, hero }: {
  icon: React.ElementType;
  title: string;
  description: string;
  iconColor: string;
  popular: boolean;
  keyBenefit: string;
  stat: string;
  statLabel: string;
  hero: boolean;
}) {
  if (hero) {
    return (
      <motion.div
        variants={fadeUp}
        className="group md:col-span-2 rounded-2xl bg-white border border-black/8 hover:border-[#25D366]/30 transition-all duration-300 relative overflow-hidden shadow-sm hover:shadow-md"
      >
        {popular && <span className="popular-badge">Más popular</span>}
        <div className="flex flex-col md:flex-row">
          {/* Left — text */}
          <div className="flex-1 p-7 md:p-8 flex flex-col justify-center">
            <div className="w-12 h-12 rounded-xl bg-[#25D366]/10 flex items-center justify-center mb-5">
              <Icon size={24} className="text-[#25D366]" />
            </div>
            <h3 className="text-xl md:text-2xl font-black text-[#0F172A] mb-1">{title}</h3>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl font-black text-[#25D366]">{stat}</span>
              <span className="text-xs text-[#0F172A]/40">{statLabel}</span>
            </div>
            <p className="text-[#0F172A]/50 leading-relaxed text-sm mb-5">{description}</p>
            <div className="flex items-start gap-2 pt-4 border-t border-black/6">
              <CheckCircle size={14} className="text-[#25D366] mt-0.5 flex-shrink-0" />
              <span className="text-xs text-[#128C7E] font-medium leading-snug">{keyBenefit}</span>
            </div>
          </div>
          {/* Right — mockup (WhatsApp dark theme preserved) */}
          <div className="md:w-[45%] bg-[#0a0a0a] border-t md:border-t-0 md:border-l border-black/8 min-h-[200px] md:min-h-0">
            <MiniChatMockup />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={fadeUp}
      className="group rounded-2xl bg-white border border-black/8 hover:border-[#25D366]/30 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden flex flex-col shadow-sm hover:shadow-md"
    >
      {/* Mockup area (WhatsApp dark theme preserved) */}
      <div className="h-36 bg-[#0a0a0a] border-b border-black/8 overflow-hidden">
        {getServiceMockup(title)}
      </div>
      {/* Content */}
      <div className="p-6 flex flex-col flex-1">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-[#25D366]/10 flex items-center justify-center flex-shrink-0">
            <Icon size={18} className="text-[#25D366]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#0F172A] leading-tight">{title}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-sm font-bold text-[#25D366]">{stat}</span>
              <span className="text-[10px] text-[#0F172A]/35">{statLabel}</span>
            </div>
          </div>
        </div>
        <p className="text-[#0F172A]/45 leading-relaxed text-sm mb-4 flex-1">{description}</p>
        <div className="flex items-start gap-2 pt-3 border-t border-black/6">
          <CheckCircle size={14} className="text-[#25D366] mt-0.5 flex-shrink-0" />
          <span className="text-xs text-[#128C7E] font-medium leading-snug">{keyBenefit}</span>
        </div>
      </div>
    </motion.div>
  );
}

function StepCard({ number, title, description, icon: Icon, isLast }: {
  number: string;
  title: string;
  description: string;
  icon: React.ElementType;
  isLast: boolean;
}) {
  return (
    <motion.div variants={fadeUp} className="relative text-center">
      <span className="text-[#25D366]/10 text-8xl font-black absolute -top-6 left-1/2 -translate-x-1/2 pointer-events-none select-none z-0">
        {number}
      </span>
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center mx-auto mb-6 relative z-10 shadow-lg shadow-[#25D366]/25">
        <Icon size={24} className="text-white" />
      </div>
      <h3 className="text-xl font-bold text-[#0F172A] mb-3 relative z-10">{title}</h3>
      <p className="text-[#0F172A]/45 leading-relaxed text-sm relative z-10">{description}</p>
      {!isLast && (
        <div className="hidden md:block absolute top-7 -right-4 z-20">
          <ChevronRight size={24} className="text-[#0F172A]/15" />
        </div>
      )}
    </motion.div>
  );
}

function AnimatedStatCard({ icon, end, suffix, label }: {
  icon: React.ReactNode;
  end: number;
  suffix: string;
  label: string;
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
      <div className="w-12 h-12 rounded-xl bg-[#25D366]/10 border border-[#25D366]/20 flex items-center justify-center mb-1">
        {icon}
      </div>
      <span className="stat-number-white">{count}{suffix}</span>
      <span className="text-sm text-[#0F172A]/40">{label}</span>
    </motion.div>
  );
}
