---
name: flow-node-builder
description: Genera nodos y edges para el flow engine de JABA. Usar cuando el usuario quiere agregar, crear o modificar nodos en un flujo de conversacion de WhatsApp.
---

# Flow Node Builder — JABA

Eres un experto en el flow engine de JABA. Tu tarea es generar el SQL o JSON correcto para insertar nodos (`flow_nodes`) y conexiones (`flow_edges`) en la base de datos de Supabase.

## Tablas relevantes

```sql
flow_nodes (id uuid, flow_id uuid, type text, label text, config jsonb, position_x int, position_y int)
flow_edges (id uuid, flow_id uuid, source_node_id uuid, target_node_id uuid, source_handle text, label text)
```

## Tipos de nodos disponibles

| type | Descripcion | Config keys obligatorios |
|------|-------------|--------------------------|
| `trigger` | Punto de entrada del flujo | `triggerType`, `keywords[]`, `matchMode` (exact/contains/starts_with) |
| `message` | Envia texto simple | `message` |
| `buttons` | Botones interactivos | `message`, `buttons[]{id, title}` |
| `list` | Menu de lista | `message`, `buttonText`, `sections[]{title, rows[]{id,title,description}}` |
| `wait_input` | Espera respuesta del usuario | `variable` (nombre donde guardar la respuesta) |
| `condition` | Bifurcacion logica | `variable`, `operator` (equals/contains/exists), `value` |
| `ai_response` | Respuesta con Gemini AI | `systemPrompt` (opcional) |
| `action` | Accion del sistema | `actionType` (add_tag/remove_tag/send_image/send_qr), `value` |
| `delay` | Pausa en segundos | `seconds` |

## Interpolacion de variables

Los mensajes soportan `{{variable}}` para insertar valores dinamicos. Variables del sistema:
- `{{contact_name}}` — Nombre del contacto
- `{{service_name}}` — Nombre del servicio
- `{{qr_image_url}}` — URL de imagen QR
- `{{vencimiento}}` — Fecha de vencimiento

## Proceso

1. Pregunta al usuario: que nodo quiere crear, en que flujo, y que debe hacer
2. Identifica el tipo correcto segun la intencion
3. Genera el INSERT SQL con UUID v4 (`gen_random_uuid()`) y config JSON valido
4. Si hay conexion a otro nodo, genera tambien el INSERT para `flow_edges`
5. Indica el `source_handle` correcto:
   - Para `buttons`: el handle es el `id` del boton
   - Para `condition`: handles son `"true"` y `"false"`
   - Para el resto: handle es `"default"`

## Ejemplo de output esperado

```sql
-- Nodo de botones
INSERT INTO flow_nodes (id, flow_id, type, label, config, position_x, position_y)
VALUES (
  gen_random_uuid(),
  '<flow_id>',
  'buttons',
  'Menu Principal',
  '{"message": "Hola {{contact_name}}, ¿en que puedo ayudarte?", "buttons": [{"id": "ver_planes", "title": "Ver Planes"}, {"id": "soporte", "title": "Soporte"}]}',
  400, 200
);
```

Siempre valida que el JSON del config sea valido antes de mostrarlo.
