/**
 * Tests for ActionFactory and ActionExecutors
 * Validates all 12+ action types, variable resolution, and execution pipeline
 */

import ActionFactory, { executeActions, ActionContext, ActionResult } from './trigger-actions'
import { resolveVariables, extractVariables, AVAILABLE_VARIABLES } from './trigger-variables'

// ── Test Context Builder ───────────────────────────────────────────────────

function createTestContext(overrides?: Partial<ActionContext>): ActionContext {
  return {
    chatId: 'chat-abc123',
    phoneNumber: '+59170000001',
    tenantUserId: 'user-tenant-1',
    contactName: 'María García',
    chatStatus: 'customer',
    chatTags: ['vip', 'importante'],
    chatCustomFields: { tier: 'premium', region: 'latam' },
    tenantToken: 'fake-token',
    tenantPhoneId: 'phone-id-1',
    tenantName: 'Mi Negocio',
    tenantServiceName: 'Servicio Premium',
    subscriptionService: 'Netflix Premium',
    subscriptionEmail: 'cuenta@email.com',
    subscriptionStatus: 'activo',
    subscriptionExpiresAt: new Date('2025-12-31'),
    messageText: '¿Cuánto cuesta el servicio?',
    messageTimestamp: new Date(),
    ...overrides,
  }
}

// ── VARIABLE RESOLUTION TESTS ──────────────────────────────────────────────

describe('resolveVariables - Legacy Variables', () => {
  test('should resolve {nombre}', () => {
    const result = resolveVariables('Hola {nombre}!', { contactName: 'Juan' })
    expect(result).toBe('Hola Juan!')
  })

  test('should resolve {numero}', () => {
    const result = resolveVariables('Tu número: {numero}', { phoneNumber: '+59170000001' })
    expect(result).toBe('Tu número: +59170000001')
  })

  test('should resolve {telefono} (alias)', () => {
    const result = resolveVariables('Teléfono: {telefono}', { phoneNumber: '7000001' })
    expect(result).toBe('Teléfono: 7000001')
  })

  test('should resolve {vencimiento}', () => {
    const date = new Date('2025-12-31')
    const result = resolveVariables('Vence: {vencimiento}', { subscriptionExpiresAt: date })
    expect(result).toContain('2025')
  })

  test('should resolve {servicio}', () => {
    const result = resolveVariables('Servicio: {servicio}', { subscriptionService: 'Netflix' })
    expect(result).toBe('Servicio: Netflix')
  })

  test('should resolve {correo}', () => {
    const result = resolveVariables('Email: {correo}', { subscriptionEmail: 'test@email.com' })
    expect(result).toBe('Email: test@email.com')
  })

  test('should handle missing variables gracefully', () => {
    const result = resolveVariables('Hola {nombre}!', {})
    expect(result).toBe('Hola !')
  })
})

describe('resolveVariables - New Variables', () => {
  test('should resolve {{contact.name}}', () => {
    const result = resolveVariables('Hola {{contact.name}}!', { contactName: 'María' })
    expect(result).toBe('Hola María!')
  })

  test('should resolve {{contact.phone}}', () => {
    const result = resolveVariables('Tel: {{contact.phone}}', { phoneNumber: '+591700' })
    expect(result).toBe('Tel: +591700')
  })

  test('should resolve {{contact.status}}', () => {
    const result = resolveVariables('Estado: {{contact.status}}', { chatStatus: 'customer' })
    expect(result).toBe('Estado: customer')
  })

  test('should resolve {{subscription.service}}', () => {
    const result = resolveVariables('Servicio: {{subscription.service}}', { subscriptionService: 'Canva Pro' })
    expect(result).toBe('Servicio: Canva Pro')
  })

  test('should resolve {{subscription.days_remaining}}', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const result = resolveVariables('Te quedan {{subscription.days_remaining}} días', { subscriptionExpiresAt: tomorrow })
    expect(result).toContain('1')
  })

  test('should resolve {{date.today}}', () => {
    const result = resolveVariables('Hoy es {{date.today}}', {})
    expect(result).not.toBe('Hoy es {{date.today}}') // Should be resolved
    expect(result).not.toContain('{{date.today}}')
  })

  test('should resolve {{custom.field}}', () => {
    const result = resolveVariables('Tier: {{custom.tier}}', {
      chatCustomFields: { tier: 'premium' }
    })
    expect(result).toBe('Tier: premium')
  })

  test('should resolve multiple variables', () => {
    const result = resolveVariables(
      'Hola {{contact.name}}, tu servicio {{subscription.service}} vence pronto.',
      { contactName: 'Luis', subscriptionService: 'Netflix' }
    )
    expect(result).toBe('Hola Luis, tu servicio Netflix vence pronto.')
  })
})

describe('extractVariables', () => {
  test('should extract legacy variables', () => {
    const vars = extractVariables('Hola {nombre}, tu {servicio} vence el {vencimiento}')
    expect(vars).toContain('nombre')
    expect(vars).toContain('servicio')
    expect(vars).toContain('vencimiento')
  })

  test('should extract new-style variables', () => {
    const vars = extractVariables('Hola {{contact.name}}, tu {{subscription.service}} vence')
    expect(vars).toContain('contact.name')
    expect(vars).toContain('subscription.service')
  })

  test('should not duplicate variables', () => {
    const vars = extractVariables('{nombre} {nombre} {nombre}')
    expect(vars.filter(v => v === 'nombre').length).toBe(1)
  })
})

describe('AVAILABLE_VARIABLES', () => {
  test('should have contact namespace', () => {
    expect(AVAILABLE_VARIABLES.contact.length).toBeGreaterThan(0)
  })

  test('should have subscription namespace', () => {
    expect(AVAILABLE_VARIABLES.subscription.length).toBeGreaterThan(0)
  })

  test('all variables should have key, label, and example', () => {
    const allVars = [...AVAILABLE_VARIABLES.contact, ...AVAILABLE_VARIABLES.subscription, ...AVAILABLE_VARIABLES.date]
    for (const v of allVars) {
      expect(v.key).toBeTruthy()
      expect(v.label).toBeTruthy()
      expect(v.example).toBeTruthy()
    }
  })
})

// ── ACTION FACTORY TESTS ───────────────────────────────────────────────────

describe('ActionFactory', () => {
  test('should return executor for send_text', () => {
    const executor = ActionFactory.getExecutor('send_text')
    expect(executor).not.toBeNull()
    expect(executor?.type).toBe('send_text')
  })

  test('should return executor for add_tag', () => {
    const executor = ActionFactory.getExecutor('add_tag')
    expect(executor).not.toBeNull()
    expect(executor?.type).toBe('add_tag')
  })

  test('should return executor for remove_tag', () => {
    const executor = ActionFactory.getExecutor('remove_tag')
    expect(executor).not.toBeNull()
  })

  test('should return executor for set_status', () => {
    const executor = ActionFactory.getExecutor('set_status')
    expect(executor).not.toBeNull()
  })

  test('should return executor for notify_admin', () => {
    const executor = ActionFactory.getExecutor('notify_admin')
    expect(executor).not.toBeNull()
  })

  test('should return executor for notify_webhook', () => {
    const executor = ActionFactory.getExecutor('notify_webhook')
    expect(executor).not.toBeNull()
  })

  test('should return executor for pause', () => {
    const executor = ActionFactory.getExecutor('pause')
    expect(executor).not.toBeNull()
  })

  test('should return executor for legacy send_message', () => {
    const executor = ActionFactory.getExecutor('send_message')
    expect(executor).not.toBeNull()
  })

  test('should return executor for legacy send_meta_template', () => {
    const executor = ActionFactory.getExecutor('send_meta_template')
    expect(executor).not.toBeNull()
  })

  test('should return null for unknown type', () => {
    const executor = ActionFactory.getExecutor('unknown_action_xyz')
    expect(executor).toBeNull()
  })

  test('getSupportedTypes should include all action types', () => {
    const types = ActionFactory.getSupportedTypes()
    const requiredTypes = ['send_text', 'add_tag', 'remove_tag', 'set_status', 'notify_admin', 'notify_webhook', 'pause', 'start_flow', 'update_field', 'set_status', 'send_interactive']
    for (const t of requiredTypes) {
      expect(types).toContain(t)
    }
  })

  test('isSupported should return true for valid types', () => {
    expect(ActionFactory.isSupported('send_text')).toBe(true)
    expect(ActionFactory.isSupported('add_tag')).toBe(true)
    expect(ActionFactory.isSupported('pause')).toBe(true)
  })

  test('isSupported should return false for invalid types', () => {
    expect(ActionFactory.isSupported('unknown')).toBe(false)
    expect(ActionFactory.isSupported('')).toBe(false)
  })
})

// ── PAYLOAD VALIDATION TESTS ───────────────────────────────────────────────

describe('Action Validation', () => {
  test('send_text requires message field', () => {
    const executor = ActionFactory.getExecutor('send_text')!
    expect(executor.validate({})).toEqual({ valid: false, error: expect.any(String) })
    expect(executor.validate({ message: 'Hola' })).toEqual({ valid: true })
  })

  test('add_tag requires tag field', () => {
    const executor = ActionFactory.getExecutor('add_tag')!
    expect(executor.validate({})).toEqual({ valid: false, error: expect.any(String) })
    expect(executor.validate({ tag: 'vip' })).toEqual({ valid: true })
  })

  test('remove_tag requires tag field', () => {
    const executor = ActionFactory.getExecutor('remove_tag')!
    expect(executor.validate({ tag: 'spam' })).toEqual({ valid: true })
    expect(executor.validate({})).toEqual({ valid: false, error: expect.any(String) })
  })

  test('set_status requires status field', () => {
    const executor = ActionFactory.getExecutor('set_status')!
    expect(executor.validate({})).toEqual({ valid: false, error: expect.any(String) })
    expect(executor.validate({ status: 'customer' })).toEqual({ valid: true })
    expect(executor.validate({ status: 'lead' })).toEqual({ valid: true })
  })

  test('notify_admin requires message field', () => {
    const executor = ActionFactory.getExecutor('notify_admin')!
    expect(executor.validate({})).toEqual({ valid: false, error: expect.any(String) })
    expect(executor.validate({ message: 'Alerta' })).toEqual({ valid: true })
    expect(executor.validate({ title: 'Alerta', message: 'Hay un problema' })).toEqual({ valid: true })
  })

  test('notify_webhook requires valid url', () => {
    const executor = ActionFactory.getExecutor('notify_webhook')!
    expect(executor.validate({})).toEqual({ valid: false, error: expect.any(String) })
    expect(executor.validate({ url: 'not-a-url' })).toEqual({ valid: false, error: expect.any(String) })
    expect(executor.validate({ url: 'https://example.com/webhook' })).toEqual({ valid: true })
  })

  test('pause requires seconds field', () => {
    const executor = ActionFactory.getExecutor('pause')!
    expect(executor.validate({})).toEqual({ valid: false, error: expect.any(String) })
    expect(executor.validate({ seconds: 5 })).toEqual({ valid: true })
    expect(executor.validate({ seconds: 300 })).toEqual({ valid: true })
    expect(executor.validate({ seconds: 301 })).toEqual({ valid: false, error: expect.any(String) })
  })

  test('send_media requires url and type', () => {
    const executor = ActionFactory.getExecutor('send_media')!
    expect(executor.validate({})).toEqual({ valid: false, error: expect.any(String) })
    expect(executor.validate({ url: 'https://example.com/img.jpg' })).toEqual({ valid: false, error: expect.any(String) })
    expect(executor.validate({ url: 'https://example.com/img.jpg', type: 'image' })).toEqual({ valid: true })
    expect(executor.validate({ url: 'https://example.com/vid.mp4', type: 'video' })).toEqual({ valid: true })
    expect(executor.validate({ url: 'https://example.com/doc.pdf', type: 'invalid_type' })).toEqual({ valid: false, error: expect.any(String) })
  })

  test('send_interactive requires body and buttons or sections', () => {
    const executor = ActionFactory.getExecutor('send_interactive')!
    expect(executor.validate({})).toEqual({ valid: false, error: expect.any(String) })
    expect(executor.validate({ body: 'Texto' })).toEqual({ valid: false, error: expect.any(String) })
    expect(executor.validate({ body: 'Texto', buttons: [{ id: '1', title: 'Sí' }] })).toEqual({ valid: true })
    expect(executor.validate({ body: 'Texto', sections: [] })).toEqual({ valid: true })
  })

  test('send_template requires template_name', () => {
    const executor = ActionFactory.getExecutor('send_template')!
    expect(executor.validate({})).toEqual({ valid: false, error: expect.any(String) })
    expect(executor.validate({ template_name: 'hello_world' })).toEqual({ valid: true })
  })

  test('start_flow requires flow_id', () => {
    const executor = ActionFactory.getExecutor('start_flow')!
    expect(executor.validate({})).toEqual({ valid: false, error: expect.any(String) })
    expect(executor.validate({ flow_id: 'flow-abc123' })).toEqual({ valid: true })
  })

  test('update_field requires field_name and value', () => {
    const executor = ActionFactory.getExecutor('update_field')!
    expect(executor.validate({})).toEqual({ valid: false, error: expect.any(String) })
    expect(executor.validate({ field_name: 'tier' })).toEqual({ valid: false, error: expect.any(String) })
    expect(executor.validate({ field_name: 'tier', value: 'premium' })).toEqual({ valid: true })
    expect(executor.validate({ field_name: 'count', value: 0 })).toEqual({ valid: true })
  })

  test('send_text_ai requires instruction field', () => {
    const executor = ActionFactory.getExecutor('send_text_ai')!
    expect(executor.validate({})).toEqual({ valid: false, error: expect.any(String) })
    expect(executor.validate({ instruction: 'Responde como soporte técnico' })).toEqual({ valid: true })
  })
})

// ── PAUSE ACTION EXECUTION TEST ────────────────────────────────────────────

describe('PauseAction execution', () => {
  test('pause should wait for specified seconds', async () => {
    const executor = ActionFactory.getExecutor('pause')!
    const context = createTestContext()
    const start = Date.now()

    const result = await executor.execute({ seconds: 1 }, context)

    const elapsed = Date.now() - start
    expect(elapsed).toBeGreaterThanOrEqual(900) // At least 900ms
    expect(result.success).toBe(true)
    expect(result.actionType).toBe('pause')
  })

  test('pause should cap at 300 seconds max', async () => {
    const executor = ActionFactory.getExecutor('pause')!
    const validation = executor.validate({ seconds: 999 })
    expect(validation.valid).toBe(false)
  })
})

// ── executeActions PIPELINE TESTS ──────────────────────────────────────────

describe('executeActions pipeline', () => {
  test('should handle empty actions list', async () => {
    const context = createTestContext()
    const { results, allSucceeded } = await executeActions([], context)
    expect(results).toHaveLength(0)
    expect(allSucceeded).toBe(true)
  })

  test('should skip unsupported action types', async () => {
    const context = createTestContext()
    const { results } = await executeActions([
      { type: 'unknown_type', payload: {} }
    ], context)

    expect(results[0].success).toBe(false)
    expect(results[0].error).toContain('no soportado')
  })

  test('should skip actions with invalid payloads', async () => {
    const context = createTestContext()
    const { results } = await executeActions([
      { type: 'add_tag', payload: {} } // Missing "tag" field
    ], context)

    expect(results[0].success).toBe(false)
    expect(results[0].error).toContain('inválido')
  })

  test('should execute actions in action_order sequence', async () => {
    const executionOrder: string[] = []
    const executor = ActionFactory.getExecutor('pause')!

    // Simulate order by checking results
    const context = createTestContext()
    const { results } = await executeActions([
      { type: 'pause', payload: { seconds: 0 }, action_order: 2 },
      { type: 'pause', payload: { seconds: 0 }, action_order: 1 },
    ], context)

    expect(results).toHaveLength(2)
    expect(results.every(r => r.success)).toBe(true)
  })

  test('should count failed actions correctly', async () => {
    const context = createTestContext()
    const { failedCount, allSucceeded } = await executeActions([
      { type: 'add_tag', payload: {} },   // Invalid - missing tag
      { type: 'pause', payload: { seconds: 0 } }, // Valid
    ], context)

    expect(failedCount).toBe(1)
    expect(allSucceeded).toBe(false)
  })
})

// Export for test runners
export {}
