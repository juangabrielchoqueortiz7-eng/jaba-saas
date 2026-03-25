---
name: whatsapp-template-builder
description: Crea templates de mensajes de WhatsApp Business que cumplan las reglas de Meta para su aprobacion. Usar cuando el usuario necesita crear un template para enviar a usuarios que no han escrito en las ultimas 24 horas.
---

# WhatsApp Template Builder — JABA

Genera templates de mensajes de Meta Business API listos para enviar a aprobacion y usar con `sendWhatsAppTemplate()`.

## Categorias de templates

| Categoria | Uso | Tasa de aprobacion |
|-----------|-----|-------------------|
| `MARKETING` | Promociones, renovaciones, ofertas | Media (revision manual) |
| `UTILITY` | Recordatorios de pago, confirmaciones, notificaciones de cuenta | Alta |
| `AUTHENTICATION` | Codigos OTP | Alta |

**Para JABA, usar `UTILITY` siempre que sea posible** (recordatorios de vencimiento, confirmaciones de pago).

## Estructura de un template

```json
{
  "name": "recordatorio_vencimiento_7dias",
  "language": "es",
  "category": "UTILITY",
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "⏰ Tu suscripción vence pronto"
    },
    {
      "type": "BODY",
      "text": "Hola {{1}}, tu suscripción a *{{2}}* vence el *{{3}}*.\n\nRenueva ahora para no perder el acceso.",
      "example": {
        "body_text": [["Juan", "CANVA PRO", "01/04/2026"]]
      }
    },
    {
      "type": "FOOTER",
      "text": "Responde RENOVAR para continuar"
    },
    {
      "type": "BUTTONS",
      "buttons": [
        { "type": "QUICK_REPLY", "text": "Renovar ahora" },
        { "type": "QUICK_REPLY", "text": "Recordarme despues" }
      ]
    }
  ]
}
```

## Reglas de Meta (obligatorias)

- Variables con `{{1}}`, `{{2}}`, etc. (numeradas desde 1)
- SIEMPRE incluir el campo `example` en BODY si usa variables
- Header TEXT: maximo 60 caracteres
- Body: maximo 1024 caracteres
- Footer: maximo 60 caracteres
- Botones QUICK_REPLY: maximo 3, texto maximo 20 caracteres cada uno
- No incluir URLs en body (usar boton CTA separado)
- Nombre del template: minusculas, guiones bajos, sin espacios

## Como usar en JABA (codigo)

```typescript
import { sendWhatsAppTemplate } from '@/lib/whatsapp'

await sendWhatsAppTemplate(
  phoneNumber,
  'recordatorio_vencimiento_7dias',
  'es',
  [
    { type: 'body', parameters: [
      { type: 'text', text: contactName },
      { type: 'text', text: serviceName },
      { type: 'text', text: fechaVencimiento }
    ]}
  ],
  accessToken,
  phoneNumberId
)
```

## Proceso

1. Pregunta al usuario: proposito del template, categoria, si necesita botones
2. Genera el JSON del template con ejemplos reales
3. Verifica que cumple todas las reglas de Meta
4. Genera tambien el codigo TypeScript para llamarlo desde JABA
5. Advierte sobre posibles rechazos (contenido promocional en UTILITY, etc.)
