---
name: trigger-creator
description: Crea configuraciones de triggers para el flow engine de JABA. Usar cuando el usuario quiere que un flujo se active con palabras clave, botones o eventos especificos.
---

# Trigger Creator — JABA

Genera la configuracion correcta para nodos de tipo `trigger` en el flow engine de JABA.

## Tipos de trigger disponibles

### 1. Keyword (palabra clave)
Se activa cuando el mensaje del usuario contiene/es igual a/empieza con una palabra.

```json
{
  "triggerType": "keyword",
  "keywords": ["precio", "planes", "cotizar"],
  "matchMode": "contains"
}
```

Modos de match:
- `exact` — El mensaje debe ser exactamente la palabra
- `contains` — El mensaje contiene la palabra en cualquier parte
- `starts_with` — El mensaje empieza con la palabra

### 2. Button reply (respuesta de boton)
Se activa cuando el usuario presiona un boton con un ID especifico.

```json
{
  "triggerType": "button",
  "buttonId": "ver_planes"
}
```

Patron con wildcard (cualquier boton que empiece con "plan_"):
```json
{
  "triggerType": "button",
  "buttonId": "plan_*"
}
```

### 3. Evento del sistema
```json
{
  "triggerType": "event",
  "event": "first_message"
}
```

Eventos disponibles:
- `first_message` — Primera vez que el contacto escribe
- `image_received` — El contacto envia una imagen
- `any_message` — Cualquier mensaje (fallback)

### 4. Tipo de mensaje
```json
{
  "triggerType": "message_type",
  "messageType": "image"
}
```

## SQL para insertar el trigger

```sql
INSERT INTO flow_nodes (id, flow_id, type, label, config, position_x, position_y)
VALUES (
  gen_random_uuid(),
  '<flow_id>',
  'trigger',
  '<Nombre descriptivo>',
  '<config_json>',
  100, 100
);
```

## Proceso

1. Pregunta al usuario:
   - Que debe escribir/hacer el usuario para activar el flujo
   - Si son multiples palabras, si deben funcionar todas o solo algunas
   - En que flujo va (flow_id)

2. Elige el tipo de trigger correcto
3. Si son keywords, normaliza a minusculas y sin acentos
4. Genera el INSERT SQL completo
5. Advierte si el trigger puede colisionar con otro existente (ej: "hola" es muy generico)

## Buenas practicas

- Usar `contains` para palabras clave de ventas (precio, info, ayuda)
- Usar `exact` para comandos especificos (menu, inicio, 0)
- Evitar keywords muy cortas o genéricas que se activen por accidente
- Un flujo puede tener multiples triggers (un trigger node por cada activador)
