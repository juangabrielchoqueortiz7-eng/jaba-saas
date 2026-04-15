# JABA SaaS

Plataforma SaaS para gestionar asistentes de WhatsApp, conversaciones, suscripciones, automatizaciones y flujos conversacionales sobre Next.js y Supabase.

## Qué incluye

- Dashboard operativo para asistentes, chats, productos, suscripciones y configuraciones.
- Webhook y utilidades para WhatsApp Cloud API.
- Motor de automatizaciones programadas y ejecución manual.
- Flujos conversacionales y disparadores con acciones/condiciones.
- Persistencia y migraciones en Supabase.

## Stack

- Next.js 16
- React 19
- TypeScript
- Supabase
- Tailwind CSS 4

## Estructura

- `src/app`: páginas, layouts y rutas API.
- `src/components`: UI reutilizable y módulos del dashboard.
- `src/lib`: lógica de negocio, automatizaciones, WhatsApp, flujos y utilidades.
- `supabase/migrations`: migraciones activas de Supabase.
- `migrations`: migraciones históricas/manuales del proyecto.
- `scripts`: utilidades operativas y diagnósticos.
- `tmp`: artefactos temporales y salidas de depuración.

## Requisitos

- Node.js 20+
- `npm`
- Proyecto Supabase configurado
- Credenciales de WhatsApp Cloud API

## Variables de entorno

El proyecto usa `.env.local`. Las claves exactas pueden variar por módulo, pero estas son las más importantes:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` o `JABA_ADMIN_KEY`
- `CRON_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `WHATSAPP_API_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `GOOGLE_API_KEY`

## Comandos

```bash
npm run dev
npm run build
npm run lint
npm run lint:app
npm run verify
```

## Flujo recomendado

1. Configurar `.env.local`.
2. Ejecutar `npm run dev`.
3. Verificar cambios con `npm run lint:app`.
4. Confirmar build de producción con `npm run build` o `npm run verify`.

## Estado actual del repo

- `build` compila correctamente.
- La deuda de lint histórica todavía existe en módulos heredados y áreas grandes del producto.
- El foco actual de estabilización está en automatizaciones, componentes base, documentación y orden del repo.

## Notas operativas

- Las automatizaciones usan `CRON_SECRET` para ejecución protegida.
- `src/app/api/run-automations/route.ts` procesa jobs activos.
- `src/app/api/run-single-automation/route.ts` permite ejecutar un job puntual manualmente.
- Los artefactos temporales no deberían quedarse en la raíz; usa `tmp/`.
