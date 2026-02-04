
'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Bot, Zap, Shield } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-indigo-500 selection:text-white">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/10 bg-slate-950/50 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-lg flex items-center justify-center">
              <span className="font-bold text-lg">J</span>
            </div>
            <span className="font-bold text-xl tracking-tight">JABA Marketing</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="px-5 py-2 rounded-full text-sm font-medium transition-all hover:bg-white/5 text-slate-300 hover:text-white"
            >
              Iniciar Sesión
            </Link>
            <Link
              href="#"
              className="hidden md:flex items-center gap-2 px-5 py-2 rounded-full bg-white text-slate-950 text-sm font-bold hover:bg-indigo-50 transition-colors"
            >
              Empezar Ahora <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none" />

        <div className="container mx-auto px-6 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block py-1 px-3 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold tracking-wide uppercase mb-6">
              Potenciado por Inteligencia Artificial
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">
              Automatización con IA <br /> para tu Negocio
            </h1>
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Optimiza tus procesos, incrementa tus ventas y recupera tu tiempo con nuestras soluciones de automatización inteligente.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/dashboard"
                className="w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-lg hover:shadow-lg hover:shadow-indigo-500/25 transition-all text-center"
              >
                Comenzar Gratis
              </Link>
              <button className="w-full sm:w-auto px-8 py-4 rounded-full border border-white/10 bg-white/5 text-white font-medium hover:bg-white/10 transition-all backdrop-blur-sm">
                Agendar Demo
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-20 border-t border-white/5 bg-slate-900/50">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Bot className="text-indigo-400" size={32} />}
              title="Chatbots Inteligentes"
              description="Responde a tus clientes 24/7 con asistentes virtuales entrenados con tus propios datos."
            />
            <FeatureCard
              icon={<Zap className="text-violet-400" size={32} />}
              title="Automatización de Flujos"
              description="Conecta tus herramientas favoritas y crea flujos de trabajo que funcionan solos."
            />
            <FeatureCard
              icon={<Shield className="text-emerald-400" size={32} />}
              title="Seguridad Empresarial"
              description="Tus datos están protegidos con los más altos estándares de seguridad y encriptación."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10 bg-slate-950 text-slate-400 text-sm">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center">
          <p>© 2024 JABA Marketing. Todos los derechos reservados.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <Link href="#" className="hover:text-white transition-colors">Términos</Link>
            <Link href="#" className="hover:text-white transition-colors">Privacidad</Link>
            <Link href="#" className="hover:text-white transition-colors">Contacto</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-8 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all hover:-translate-y-1">
      <div className="w-12 h-12 rounded-lg bg-slate-900 flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
      <p className="text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}
