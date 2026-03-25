---
name: webhook-payload-tester
description: Genera y envia payloads simulados al webhook de JABA para probar el flow engine sin necesitar un celular real. Usar cuando el usuario quiere probar mensajes, botones o eventos de WhatsApp en local.
---

# Webhook Payload Tester — JABA

Simulas mensajes entrantes de Meta WhatsApp al endpoint `/api/webhook` de JABA sin necesitar un celular real.

## Endpoint objetivo
```
POST http://localhost:3000/api/webhook
```

## Tipos de payload que puedes generar

### 1. Mensaje de texto
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "ENTRY_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": { "display_phone_number": "15550000000", "phone_number_id": "<WHATSAPP_PHONE_NUMBER_ID>" },
        "contacts": [{ "profile": { "name": "<contact_name>" }, "wa_id": "<phone_number>" }],
        "messages": [{
          "from": "<phone_number>",
          "id": "wamid.test_<timestamp>",
          "timestamp": "<unix_timestamp>",
          "text": { "body": "<message_text>" },
          "type": "text"
        }]
      },
      "field": "messages"
    }]
  }]
}
```

### 2. Respuesta de boton interactivo
```json
{
  "messages": [{
    "type": "interactive",
    "interactive": {
      "type": "button_reply",
      "button_reply": { "id": "<button_id>", "title": "<button_title>" }
    }
  }]
}
```

### 3. Seleccion de lista
```json
{
  "messages": [{
    "type": "interactive",
    "interactive": {
      "type": "list_reply",
      "list_reply": { "id": "<row_id>", "title": "<row_title>" }
    }
  }]
}
```

### 4. Imagen recibida
```json
{
  "messages": [{
    "type": "image",
    "image": { "id": "media_id_test", "mime_type": "image/jpeg", "sha256": "test", "caption": "<caption>" }
  }]
}
```

## Proceso

1. Pregunta al usuario: tipo de mensaje, numero de telefono simulado, contenido
2. Genera el payload completo con timestamps reales (`Date.now()`)
3. Usa el Bash tool para enviarlo con curl:

```bash
curl -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -d '<payload_json>'
```

4. Muestra la respuesta y explica que parte del flow engine se activo

## Notas importantes
- El `phone_number_id` en metadata debe coincidir con el registrado en `whatsapp_credentials` del tenant
- Los numeros de telefono deben tener formato internacional sin `+` (ej: `5491112345678`)
- El `wamid` debe ser unico por mensaje — usa `wamid.test_<Date.now()>`
- Si el webhook tiene verificacion HMAC, este tester la omite (solo valido en desarrollo)
