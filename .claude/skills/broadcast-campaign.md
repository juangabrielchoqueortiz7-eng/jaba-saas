---
name: broadcast-campaign
description: Planifica y genera el payload para enviar mensajes masivos (broadcast) a segmentos de subscriptores en JABA. Usar cuando el usuario quiere enviar un mensaje a multiples contactos filtrados por servicio, estado o vencimiento.
---

# Broadcast Campaign — JABA

Genera la consulta SQL para obtener los destinatarios y el payload para el endpoint `/api/broadcast` de JABA.

## Segmentos disponibles

| Segmento | Filtro SQL |
|----------|------------|
| Todos activos | `estado = 'ACTIVO'` |
| Por servicio | `servicio = 'CANVA'` (o CHATGPT, GEMINI, etc.) |
| Por vencer (7 dias) | `vencimiento <= now() + interval '7 days' AND vencimiento >= now()` |
| Vencidos sin renovar | `estado = 'INACTIVO' AND followup_sent = false` |
| Sin notificar | `notified = false` |

## Proceso

1. Pregunta al usuario:
   - A quien va dirigido (segmento o criterio personalizado)
   - Contenido del mensaje
   - Tipo: texto simple, botones interactivos, o template de Meta
   - Si debe registrar en `subscription_notification_logs`

2. Genera la consulta SQL para obtener los numeros:
```sql
SELECT DISTINCT s.numero, s.servicio, s.vencimiento, c.contact_name
FROM subscriptions s
LEFT JOIN chats c ON c.phone_number = s.numero AND c.user_id = s.user_id
WHERE s.user_id = '<user_id>'
  AND s.estado = 'ACTIVO'
  AND s.servicio = '<servicio>'
ORDER BY s.vencimiento ASC;
```

3. Genera el payload para `/api/broadcast`:
```json
{
  "recipients": ["5491112345678", "5491187654321"],
  "message": "Texto del mensaje",
  "type": "text",
  "userId": "<user_id>"
}
```

4. Para mensajes con botones, genera:
```json
{
  "type": "buttons",
  "message": "Texto principal",
  "buttons": [
    { "id": "renovar", "title": "Renovar ahora" },
    { "id": "info", "title": "Mas informacion" }
  ]
}
```

5. Advierte sobre limites de Meta:
   - Maximo 1000 mensajes de marketing por dia (tier 1)
   - Esperar al menos 1 segundo entre mensajes para evitar ban
   - Usar templates aprobados para contactos que no han escrito en 24h

## Checklist antes de enviar

- [ ] Los numeros tienen formato internacional sin `+`
- [ ] El mensaje no supera 4096 caracteres
- [ ] Se verifico que no se enviaron mensajes a estos numeros recientemente (`subscription_notification_logs`)
- [ ] El contenido cumple politicas de Meta (sin spam, sin URLs engañosas)
