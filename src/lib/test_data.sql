
-- Insertar un chat simulado
INSERT INTO public.chats (phone_number, contact_name, last_message, unread_count)
VALUES ('+59112345678', 'Cliente Simulado', 'Hola, quiero información sobre el SaaS', 1);

-- Insertar el mensaje asociado
INSERT INTO public.messages (chat_id, content, is_from_me, status)
SELECT id, 'Hola, quiero información sobre el SaaS', false, 'delivered'
FROM public.chats WHERE phone_number = '+59112345678';
