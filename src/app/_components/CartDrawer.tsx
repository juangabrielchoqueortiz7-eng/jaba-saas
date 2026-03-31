'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart, Trash2, ArrowRight } from 'lucide-react';

export interface CartItem {
  conversations: string;
  price: string;
  priceValue: number;
  badge: string | null;
}

interface CartDrawerProps {
  isOpen: boolean;
  items: CartItem[];
  onClose: () => void;
  onRemove: (conversations: string) => void;
  onCheckout: () => void;
}

export function CartDrawer({ isOpen, items, onClose, onRemove, onCheckout }: CartDrawerProps) {
  const total = items.reduce((sum, item) => sum + item.priceValue, 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-[#0f0f0f] border-l border-white/8 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
              <div className="flex items-center gap-3">
                <ShoppingCart size={20} className="text-[#25D366]" />
                <h2 className="font-bold text-lg">Tu carrito</h2>
                {items.length > 0 && (
                  <span className="w-5 h-5 rounded-full bg-[#25D366] text-black text-xs font-black flex items-center justify-center">
                    {items.length}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <ShoppingCart size={48} className="text-white/10 mb-4" />
                  <p className="text-white/30 font-medium">Tu carrito está vacío</p>
                  <p className="text-white/20 text-sm mt-1">Agrega un pack de conversaciones para continuar</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.conversations}
                      className="flex items-center justify-between p-4 bg-white/3 border border-white/8 rounded-xl"
                    >
                      <div>
                        {item.badge && (
                          <span className="text-[10px] text-[#25D366] font-bold uppercase tracking-wider bg-[#25D366]/10 px-2 py-0.5 rounded-full mb-1.5 inline-block">
                            {item.badge}
                          </span>
                        )}
                        <p className="text-white font-semibold text-sm">{item.conversations} conversaciones</p>
                        <p className="text-[#25D366] font-black text-lg">{item.price} <span className="text-white/30 text-xs font-normal">USD</span></p>
                      </div>
                      <button
                        onClick={() => onRemove(item.conversations)}
                        className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="px-6 py-5 border-t border-white/8">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-white/40 text-sm">Total estimado</span>
                  <span className="text-white font-black text-2xl">
                    ${total.toFixed(2)} <span className="text-white/30 text-sm font-normal">USD</span>
                  </span>
                </div>
                <button
                  onClick={onCheckout}
                  className="w-full py-3.5 btn-cta text-black font-bold text-base flex items-center justify-center gap-2"
                >
                  Proceder al pago <ArrowRight size={18} />
                </button>
                <p className="text-center text-white/20 text-xs mt-3">
                  Sin tarjeta de crédito requerida inicialmente
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
