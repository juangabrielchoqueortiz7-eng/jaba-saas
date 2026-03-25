---
name: crm-tag-strategy
description: Define y aplica estrategias de etiquetado (tags) en chats de JABA para segmentar clientes. Usar cuando el usuario quiere organizar sus contactos, crear segmentos o aplicar tags masivos.
---

# CRM Tag Strategy — JABA

Ayuda a definir y aplicar una estrategia de tags en los chats de JABA para segmentar y gestionar clientes.

## Tags recomendados para JABA

### Por estado del cliente
- `cliente-activo` — Tiene subscripcion vigente
- `cliente-inactivo` — Subscripcion vencida
- `prospecto` — Consulto pero no compro
- `nuevo` — Primera interaccion (menos de 7 dias)

### Por servicio contratado
- `canva`, `chatgpt`, `gemini`, `netflix`, `spotify` — Servicio activo
- `multi-servicio` — Tiene 2+ servicios

### Por comportamiento
- `por-vencer` — Vence en menos de 7 dias
- `sin-respuesta` — No contesto recordatorio
- `pago-pendiente` — Orden creada sin confirmar pago
- `pago-confirmado` — Pago verificado

### Por soporte
- `soporte-activo` — Tiene incidencia abierta
- `vip` — Cliente de alto valor o larga trayectoria

## SQL para ver distribucion de tags actual
```sql
SELECT
  tag,
  COUNT(*) as chats
FROM chats,
  jsonb_array_elements_text(tags::jsonb) as tag
WHERE user_id = '<user_id>'
GROUP BY tag
ORDER BY chats DESC;
```

## SQL para agregar tag a multiples chats
```sql
-- Agregar tag a todos los chats con subscripcion activa de CANVA
UPDATE chats
SET tags = COALESCE(tags::jsonb, '[]'::jsonb) || '["canva"]'::jsonb
WHERE user_id = '<user_id>'
  AND phone_number IN (
    SELECT numero FROM subscriptions
    WHERE user_id = '<user_id>'
      AND servicio = 'CANVA'
      AND estado = 'ACTIVO'
  )
  AND NOT (tags::jsonb ? 'canva');
```

## SQL para remover tag
```sql
UPDATE chats
SET tags = (
  SELECT jsonb_agg(t)
  FROM jsonb_array_elements_text(tags::jsonb) as t
  WHERE t != '<tag_a_remover>'
)
WHERE user_id = '<user_id>'
  AND tags::jsonb ? '<tag_a_remover>';
```

## Como usar tags en el Flow Engine

En nodos de tipo `action`:
```json
{
  "actionType": "add_tag",
  "value": "pago-pendiente"
}
```

```json
{
  "actionType": "remove_tag",
  "value": "prospecto"
}
```

## Proceso

1. Pregunta al usuario: que quiere segmentar o como quiere organizar sus contactos
2. Propone un sistema de tags coherente para su caso de uso
3. Genera las queries SQL para aplicar los tags en masa
4. Muestra como integrar los tags en los flujos automatizados
5. Sugiere como usar los tags para filtrar en el dashboard de chats
