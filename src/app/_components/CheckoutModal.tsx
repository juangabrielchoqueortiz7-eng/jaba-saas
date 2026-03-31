'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ArrowRight, ArrowLeft, User, Mail, Phone, Building } from 'lucide-react';
import type { CartItem } from './CartDrawer';

function WhatsAppIcon({ className = 'w-5 h-5 fill-current' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

interface FormData {
  nombre: string;
  email: string;
  telefono: string;
  negocio: string;
}

interface CheckoutModalProps {
  isOpen: boolean;
  items: CartItem[];
  total: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function CheckoutModal({ isOpen, items, total, onClose, onSuccess }: CheckoutModalProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>({ nombre: '', email: '', telefono: '', negocio: '' });
  const [errors, setErrors] = useState<Partial<FormData>>({});

  const validate = () => {
    const e: Partial<FormData> = {};
    if (!form.nombre.trim()) e.nombre = 'Campo requerido';
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Email inválido';
    if (!form.telefono.trim()) e.telefono = 'Campo requerido';
    if (!form.negocio.trim()) e.negocio = 'Campo requerido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) setStep(3);
  };

  const getWhatsAppUrl = () => {
    const orderLines = items.map(i => `• ${i.conversations} conversaciones — ${i.price} USD`).join('\n');
    const msg = `¡Hola! Quiero adquirir los siguientes packs de JABA:\n\n${orderLines}\n\n*Total: $${total.toFixed(2)} USD*\n\nMis datos:\n• Nombre: ${form.nombre}\n• Email: ${form.email}\n• Teléfono: ${form.telefono}\n• Negocio: ${form.negocio}`;
    return `https://wa.me/59169344192?text=${encodeURIComponent(msg)}`;
  };

  const resetAndClose = () => {
    setStep(1);
    setForm({ nombre: '', email: '', telefono: '', negocio: '' });
    setErrors({});
    onClose();
  };

  const inputClass = (field: keyof FormData) =>
    `w-full bg-white/4 border rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#25D366]/50 transition-colors ${
      errors[field] ? 'border-red-500/40' : 'border-white/10'
    }`;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-lg bg-[#0f0f0f] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {[1, 2, 3].map((s) => (
                    <div key={s} className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        step > s
                          ? 'bg-[#25D366] text-black'
                          : step === s
                          ? 'bg-[#25D366] text-black ring-4 ring-[#25D366]/20'
                          : 'bg-white/8 text-white/30'
                      }`}>
                        {step > s ? <Check size={13} /> : s}
                      </div>
                      {s < 3 && (
                        <div className={`w-10 h-px transition-all duration-500 ${step > s ? 'bg-[#25D366]' : 'bg-white/10'}`} />
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-white/30 text-xs">
                  {step === 1 ? 'Resumen del pedido' : step === 2 ? 'Tus datos de contacto' : '¡Pedido confirmado!'}
                </p>
              </div>
              <button
                onClick={resetAndClose}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* ── STEP 1: Resumen ── */}
            {step === 1 && (
              <div className="px-6 py-6">
                <h3 className="font-bold text-xl mb-1">Resumen de tu pedido</h3>
                <p className="text-white/35 text-sm mb-5">Revisa los packs seleccionados antes de continuar</p>

                <div className="space-y-3 mb-5">
                  {items.map((item) => (
                    <div key={item.conversations} className="flex items-center justify-between p-4 bg-white/3 rounded-xl border border-white/6">
                      <div>
                        {item.badge && (
                          <span className="text-[10px] text-[#25D366] font-bold bg-[#25D366]/10 px-2 py-0.5 rounded-full mb-1 inline-block">
                            {item.badge}
                          </span>
                        )}
                        <p className="text-white font-semibold text-sm">{item.conversations} conversaciones</p>
                      </div>
                      <p className="text-[#25D366] font-black text-lg">{item.price} <span className="text-white/30 text-xs font-normal">USD</span></p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between py-4 border-t border-white/8 mb-5">
                  <span className="text-white/40 text-sm">Total</span>
                  <span className="text-white font-black text-2xl">
                    ${total.toFixed(2)} <span className="text-white/25 text-sm font-normal">USD</span>
                  </span>
                </div>

                <div className="space-y-2.5 mb-6">
                  {['Sin permanencia ni contratos', 'Soporte incluido desde el día 1', 'Activo en menos de 24 horas'].map((b) => (
                    <div key={b} className="flex items-center gap-2.5 text-sm text-white/45">
                      <Check size={14} className="text-[#25D366] flex-shrink-0" />
                      {b}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setStep(2)}
                  className="w-full py-3.5 btn-cta text-black font-bold text-base flex items-center justify-center gap-2"
                >
                  Continuar <ArrowRight size={18} />
                </button>
              </div>
            )}

            {/* ── STEP 2: Formulario ── */}
            {step === 2 && (
              <div className="px-6 py-6">
                <h3 className="font-bold text-xl mb-1">Tus datos</h3>
                <p className="text-white/35 text-sm mb-5">Completa la información para procesar tu pedido</p>

                <div className="space-y-4">
                  {/* Nombre */}
                  <div>
                    <label className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                      Nombre completo <span className="text-[#25D366]">*</span>
                    </label>
                    <div className="relative">
                      <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
                      <input
                        type="text"
                        value={form.nombre}
                        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                        placeholder="Tu nombre completo"
                        className={inputClass('nombre')}
                      />
                    </div>
                    {errors.nombre && <p className="text-red-400 text-xs mt-1">{errors.nombre}</p>}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                      Correo electrónico <span className="text-[#25D366]">*</span>
                    </label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="tu@email.com"
                        className={inputClass('email')}
                      />
                    </div>
                    {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                  </div>

                  {/* Teléfono */}
                  <div>
                    <label className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                      WhatsApp / Teléfono <span className="text-[#25D366]">*</span>
                    </label>
                    <div className="relative">
                      <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
                      <input
                        type="tel"
                        value={form.telefono}
                        onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                        placeholder="+591 70000000"
                        className={inputClass('telefono')}
                      />
                    </div>
                    {errors.telefono && <p className="text-red-400 text-xs mt-1">{errors.telefono}</p>}
                  </div>

                  {/* Negocio */}
                  <div>
                    <label className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                      Nombre del negocio <span className="text-[#25D366]">*</span>
                    </label>
                    <div className="relative">
                      <Building size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
                      <input
                        type="text"
                        value={form.negocio}
                        onChange={(e) => setForm({ ...form, negocio: e.target.value })}
                        placeholder="Nombre de tu empresa o negocio"
                        className={inputClass('negocio')}
                      />
                    </div>
                    {errors.negocio && <p className="text-red-400 text-xs mt-1">{errors.negocio}</p>}
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setStep(1)}
                    className="px-4 py-3 border border-white/10 hover:border-white/20 rounded-xl text-white/40 hover:text-white/70 transition-all flex items-center gap-2 text-sm"
                  >
                    <ArrowLeft size={15} /> Volver
                  </button>
                  <button
                    onClick={handleSubmit}
                    className="flex-1 py-3 btn-cta text-black font-bold flex items-center justify-center gap-2"
                  >
                    Confirmar pedido <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3: Confirmación ── */}
            {step === 3 && (
              <div className="px-6 py-8 text-center">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 15 }}
                  className="w-16 h-16 rounded-full bg-[#25D366]/15 border-2 border-[#25D366]/40 flex items-center justify-center mx-auto mb-5"
                >
                  <Check size={28} className="text-[#25D366]" />
                </motion.div>

                <h3 className="font-black text-2xl mb-2">¡Pedido registrado!</h3>
                <p className="text-white/40 text-sm mb-6 max-w-xs mx-auto leading-relaxed">
                  Hola <span className="text-white font-semibold">{form.nombre}</span>, haz clic en el botón para enviarnos tu pedido por WhatsApp y lo activamos en menos de 24h.
                </p>

                <div className="bg-white/3 border border-white/8 rounded-xl p-4 text-left mb-6">
                  {items.map((item) => (
                    <div key={item.conversations} className="flex justify-between text-sm py-1.5">
                      <span className="text-white/40">{item.conversations} conversaciones</span>
                      <span className="text-white font-semibold">{item.price} USD</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm pt-3 border-t border-white/8 mt-1">
                    <span className="text-white/60 font-semibold">Total</span>
                    <span className="text-[#25D366] font-black">${total.toFixed(2)} USD</span>
                  </div>
                </div>

                <a
                  href={getWhatsAppUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => { onSuccess(); resetAndClose(); }}
                  className="w-full py-3.5 btn-cta text-black font-bold text-base flex items-center justify-center gap-2 mb-3"
                >
                  <WhatsAppIcon className="w-5 h-5 fill-black" />
                  Enviar pedido por WhatsApp
                </a>
                <p className="text-white/20 text-xs">Te responderemos en menos de 2 horas · La Paz, Bolivia</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
