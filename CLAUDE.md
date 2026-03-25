# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

No test framework is configured — testing is done manually via scripts in `scripts/` or by hitting API endpoints directly.

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase public access
- `SUPABASE_SERVICE_ROLE_KEY` — Bypasses RLS for admin operations
- `GOOGLE_API_KEY` — Google Gemini 1.5 Pro
- `WHATSAPP_API_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` — Meta WhatsApp Graph API v21.0
- `WEBHOOK_VERIFY_TOKEN` — Webhook verification with Meta

## Architecture

**JABA** is a multi-tenant WhatsApp business platform. Each tenant (`user_id`) has isolated data via Supabase Row-Level Security. The main data flow:

```
Meta Webhook → /api/webhook → Flow Engine → AI (Gemini) fallback → WhatsApp API
```

### Key modules (`src/lib/`)

| File | Purpose |
|------|---------|
| `whatsapp.ts` | Full Meta WhatsApp API wrapper (text, media, templates, interactive buttons/lists) |
| `ai.ts` | Gemini 1.5 Pro integration with rate-limit retry/backoff |
| `flow-engine.ts` | Executes node-based conversation flows stored in `flows`/`flow_nodes`/`flow_edges` tables |
| `supabase.ts` | Admin Supabase client (service role, bypasses RLS) |
| `utils/supabase/` | SSR-safe server and client Supabase instances |

### Supabase tables (key ones)

- `chats` / `messages` — Conversation history per phone number
- `flows` / `flow_nodes` / `flow_edges` — Visual flow builder data
- `chat_flow_state` — Active flow execution state per chat
- `subscriptions` / `orders` — Business subscription lifecycle
- `whatsapp_credentials` — Per-tenant WhatsApp API tokens
- `products` — Sellable items per tenant

### Webhook message flow

1. `GET /api/webhook` — Meta verification handshake
2. `POST /api/webhook` — Incoming message:
   - Check `chat_flow_state` for an active flow → continue execution
   - If no active flow → check triggers in `flow_nodes`
   - If no trigger match → call Gemini with system prompt + message history
   - Save message to DB → send reply via WhatsApp API

### Flow Engine node types

`send_message`, `send_buttons`, `send_list`, `send_image`, `wait_input`, `ai_response`, `system_action`

### Cron jobs (vercel.json)

- `13:00 UTC` — `/api/subscription-reminders` + `/api/subscription-urgency`
- `22:00 UTC` — `/api/subscription-followup`
- `14:00 UTC` — `/api/trigger-engine`

### Path alias

`@/*` maps to `./src/*` (configured in `tsconfig.json`).

### React Server vs Client components

- Dashboard pages are Server Components (data fetched server-side via Supabase)
- Interactive UI (chat panel, flow builder) uses Client Components with `'use client'`
- `ChatContext` (`src/context/`) provides global chat open/close state
- Server actions use `'use server'` (e.g. `signOut`, form submissions)

## Deployment

Deployed on Vercel. `next.config.ts` enables the React Compiler and whitelists `localhost:3000` + `jaba-test-client.loca.lt` for Server Actions.

## Scripts directory

`scripts/` contains ~47 one-off Node.js utilities for database diagnostics, WhatsApp registration, webhook testing, and migrations. These are development/ops tools, not production code.
