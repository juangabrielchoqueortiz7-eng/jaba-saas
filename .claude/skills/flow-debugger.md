---
name: flow-debugger
description: Traza y depura la ejecucion de un flujo de conversacion en JABA. Usar cuando el usuario reporta que un flujo no funciona como esperaba, un mensaje no se envia, o un trigger no se activa.
---

# Flow Debugger — JABA

Diagnostica problemas en el flow engine de JABA analizando el estado, los nodos y los logs.

## Checklist de diagnostico

### 1. Verificar que el flujo esta activo
```sql
SELECT id, name, is_active, priority
FROM flows
WHERE user_id = '<user_id>'
ORDER BY priority DESC;
```

### 2. Ver el estado actual del chat
```sql
SELECT cfs.*, fn.type, fn.label, fn.config
FROM chat_flow_state cfs
JOIN flow_nodes fn ON fn.id = cfs.current_node_id
JOIN chats c ON c.id = cfs.chat_id
WHERE c.phone_number = '<phone_number>'
  AND cfs.status = 'active';
```

### 3. Ver todos los nodos del flujo
```sql
SELECT id, type, label, config
FROM flow_nodes
WHERE flow_id = '<flow_id>'
ORDER BY position_y ASC;
```

### 4. Ver las conexiones (edges)
```sql
SELECT
  fe.source_handle,
  fn_src.label as desde,
  fn_src.type as tipo_origen,
  fn_dst.label as hacia,
  fn_dst.type as tipo_destino
FROM flow_edges fe
JOIN flow_nodes fn_src ON fn_src.id = fe.source_node_id
JOIN flow_nodes fn_dst ON fn_dst.id = fe.target_node_id
WHERE fe.flow_id = '<flow_id>';
```

### 5. Ver ultimos mensajes del chat
```sql
SELECT content, is_from_me, created_at
FROM messages
JOIN chats ON chats.id = messages.chat_id
WHERE chats.phone_number = '<phone_number>'
ORDER BY created_at DESC
LIMIT 20;
```

## Problemas comunes y soluciones

| Problema | Causa probable | Solucion |
|----------|---------------|----------|
| Trigger no se activa | matchMode incorrecto o keyword con tilde | Cambiar a `contains`, normalizar keywords |
| Flujo se queda pegado | Nodo `wait_input` sin edge de salida | Agregar edge desde el nodo de espera |
| Botones no responden | button_id en trigger no coincide con el enviado | Verificar que el `id` del boton y el `buttonId` del trigger son identicos |
| Variables vacias | Variable no fue guardada en `wait_input` previo | Verificar campo `variable` en el nodo wait_input |
| Flujo no avanza | `chat_flow_state` con status diferente a 'active' | Resetear estado: `UPDATE chat_flow_state SET status = 'completed'` |
| AI no responde | Cuota de Gemini agotada o error de red | Verificar logs del servidor, revisar GOOGLE_API_KEY |

## Proceso

1. Pregunta al usuario: numero de telefono del chat problema, que se esperaba vs que ocurrio
2. Genera las queries SQL para inspeccionar el estado
3. Analiza el flujo de nodos paso a paso
4. Identifica el nodo donde se rompe la ejecucion
5. Propone la correccion especifica

## Resetear estado de un chat (emergencia)

```sql
-- Limpiar estado activo para permitir reinicio
UPDATE chat_flow_state
SET status = 'completed', updated_at = now()
WHERE chat_id = (
  SELECT id FROM chats WHERE phone_number = '<phone_number>' LIMIT 1
)
AND status = 'active';
```
