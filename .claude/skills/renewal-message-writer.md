---
name: renewal-message-writer
description: Redacta mensajes de renovacion, recordatorio y urgencia para WhatsApp adaptados al servicio y dias restantes. Usar cuando el usuario necesita escribir mensajes para las campanas de subscripciones de JABA.
---

# Renewal Message Writer — JABA

Redacta mensajes de WhatsApp para el ciclo de vida de subscripciones: recordatorio (7 dias), urgencia (1 dia) y seguimiento post-vencimiento.

## Servicios que maneja JABA

- **CANVA** — Herramienta de diseno grafico
- **CHATGPT** — OpenAI ChatGPT Plus
- **GEMINI** — Google Gemini
- **NETFLIX** — Streaming de video
- **SPOTIFY** — Musica en streaming
- **OTROS** — Servicio generico

## Tipos de mensaje

### 1. Recordatorio (7 dias antes)
- Tono: amigable, informativo
- Incluir: nombre del servicio, fecha de vencimiento, precio, como renovar
- CTA: boton o link para renovar

### 2. Urgencia (1 dia antes)
- Tono: urgente pero no agresivo
- Incluir: "mañana vence", beneficios de no perder acceso, accion inmediata
- CTA: directo y claro

### 3. Seguimiento post-vencimiento
- Tono: remarketing, FOMO (miedo a perder)
- Incluir: lo que perdio, oferta de reactivacion
- CTA: reactivar ahora

### 4. Confirmacion de pago
- Tono: positivo, confirmatorio
- Incluir: servicio renovado, nueva fecha de vencimiento, credenciales si aplica

## Proceso

1. Pregunta al usuario:
   - Tipo de mensaje (recordatorio/urgencia/seguimiento/confirmacion)
   - Servicio (CANVA, CHATGPT, etc.)
   - Dias restantes o fecha de vencimiento
   - Precio de renovacion (opcional)
   - Nombre del negocio del tenant (opcional)

2. Genera el mensaje con:
   - Emoji relevante al servicio (Canva=🎨, ChatGPT=🤖, Gemini=✨, Netflix=🎬, Spotify=🎵)
   - Variables de JABA entre `{{}}`: `{{contact_name}}`, `{{vencimiento}}`, `{{service_name}}`
   - Maximo 1000 caracteres (limite recomendado para WhatsApp)
   - Formato con saltos de linea para legibilidad en movil

3. Ofrece 2-3 variantes con distintos tonos o enfoques

## Ejemplo de output

```
🎨 Hola {{contact_name}}!

Tu suscripción a *CANVA PRO* vence el *{{vencimiento}}*.

Para seguir disfrutando de todos los beneficios, renueva antes de que expire.

💳 Precio de renovación: $X
📲 Responde *RENOVAR* o escríbenos para coordinar el pago.

¡Gracias por confiar en nosotros! ✨
```

## Restricciones WhatsApp

- No usar HTML (solo *negrita*, _italica_, ~tachado~)
- Emojis con moderacion (max 3-4 por mensaje)
- No incluir URLs acortadas (Meta las penaliza)
- Mensajes de template requieren aprobacion previa de Meta
