---
name: subscription-report
description: Genera reportes y consultas SQL sobre el estado de subscripciones en JABA. Usar cuando el usuario necesita saber cuantas subs vencen, cuales estan inactivas, metricas de renovacion o exportar datos.
---

# Subscription Report — JABA

Genera consultas SQL y resumen de metricas sobre subscripciones para un tenant de JABA.

## Reportes disponibles

### 1. Resumen general del tenant
```sql
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE estado = 'ACTIVO') as activos,
  COUNT(*) FILTER (WHERE estado = 'INACTIVO') as inactivos,
  COUNT(*) FILTER (WHERE vencimiento::date <= now()::date + 7 AND estado = 'ACTIVO') as por_vencer_7dias,
  COUNT(*) FILTER (WHERE vencimiento::date <= now()::date + 1 AND estado = 'ACTIVO') as vencen_manana,
  COUNT(*) FILTER (WHERE vencimiento::date < now()::date AND estado = 'ACTIVO') as vencidos_activos
FROM subscriptions
WHERE user_id = '<user_id>';
```

### 2. Subscripciones por servicio
```sql
SELECT
  servicio,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE estado = 'ACTIVO') as activos,
  ROUND(AVG(CASE WHEN estado = 'ACTIVO' THEN 1 ELSE 0 END) * 100, 1) as tasa_activos_pct
FROM subscriptions
WHERE user_id = '<user_id>'
GROUP BY servicio
ORDER BY total DESC;
```

### 3. Subscripciones que vencen esta semana
```sql
SELECT numero, correo, servicio, vencimiento, estado, notified, urgency_sent
FROM subscriptions
WHERE user_id = '<user_id>'
  AND estado = 'ACTIVO'
  AND vencimiento::date BETWEEN now()::date AND now()::date + 7
ORDER BY vencimiento ASC;
```

### 4. Tasa de renovacion (ultimos 30 dias)
```sql
SELECT
  COUNT(*) FILTER (WHERE followup_sent = true AND estado = 'ACTIVO') as renovados_tras_followup,
  COUNT(*) FILTER (WHERE followup_sent = true) as total_con_followup,
  ROUND(
    COUNT(*) FILTER (WHERE followup_sent = true AND estado = 'ACTIVO')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE followup_sent = true), 0) * 100, 1
  ) as tasa_renovacion_pct
FROM subscriptions
WHERE user_id = '<user_id>'
  AND created_at >= now() - interval '30 days';
```

### 5. Contactos sin notificar (para campana)
```sql
SELECT numero, servicio, vencimiento
FROM subscriptions
WHERE user_id = '<user_id>'
  AND estado = 'ACTIVO'
  AND notified = false
  AND vencimiento::date <= now()::date + 7
ORDER BY vencimiento ASC;
```

## Proceso

1. Pregunta al usuario: que tipo de reporte necesita, para que periodo, si necesita exportar
2. Genera la query SQL correspondiente
3. Explica cada columna del resultado
4. Si necesita exportar a Excel, usa el patron de `/api/export-contacts`
5. Ofrece el formato CSV de los datos si el usuario lo necesita para compartir con clientes

## Metricas clave para monitorear

- **Tasa de renovacion**: % subs que renovaron antes de vencer
- **Tasa de respuesta a recordatorios**: % que contestaron tras recibir notificacion
- **Churn mensual**: subs que pasaron a INACTIVO / total activos del mes
- **Servicios con mayor churn**: para identificar problemas de precio/valor
