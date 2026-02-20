-- TABLA DE PEDIDOS (Orders)
-- Rastrea las ventas de Canva Pro y otros productos por WhatsApp.

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  chat_id UUID REFERENCES public.chats(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  contact_name TEXT,
  
  -- Producto y Plan
  product TEXT NOT NULL DEFAULT 'canva_pro',  -- 'canva_pro', futuro: 'invitaciones', 'posts_fb'
  plan TEXT NOT NULL,                          -- '1m', '3m', '6m', '9m', '1y'
  plan_name TEXT,                              -- 'Básico', 'Bronce', 'Plata', 'Gold', 'Premium'
  amount DECIMAL(10,2) NOT NULL,               -- 19.00, 39.00, 69.00, 99.00, 109.00
  
  -- Datos del cliente
  customer_email TEXT,
  
  -- Estado del pedido
  -- pending_email: esperando que el cliente envíe su email
  -- pending_payment: email recibido, QR enviado, esperando pago
  -- pending_delivery: pago confirmado, esperando envío de acceso
  -- delivered: acceso entregado
  -- cancelled: pedido cancelado
  status TEXT NOT NULL DEFAULT 'pending_email',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seguridad RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Usuarios solo ven sus propios pedidos (como tenant/admin)
CREATE POLICY "Usuarios ven sus propios pedidos" ON public.orders
  FOR ALL USING (auth.uid() = user_id);

-- Índices
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_chat_id ON public.orders(chat_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);
