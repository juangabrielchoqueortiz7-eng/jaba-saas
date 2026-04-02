/**
 * Tests for ConditionEvaluator
 * Validates all 12+ condition types work correctly
 */

import ConditionEvaluator, {
  TriggerCondition,
  TriggerConditionGroup,
  EvaluationContext,
} from './trigger-conditions'

// ── Test Context Builder ───────────────────────────────────────────────

function createTestContext(overrides?: Partial<EvaluationContext>): EvaluationContext {
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  return {
    messageText: 'Hola, necesito ayuda con el precio del servicio',
    messageTimestamp: now,
    chatId: 'chat-123',
    chatCreatedAt: sevenDaysAgo,
    chatTags: ['importante', 'vip'],
    chatStatus: 'customer',
    chatLastMessageTime: oneHourAgo,
    chatMessageCount: 25,
    chatCustomFields: {
      tier: 'premium',
      region: 'latam',
    },
    subscriptionStatus: 'active',
    subscriptionExpiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    evaluateIntent: async (text: string) => {
      if (text.toLowerCase().includes('precio')) return 'pregunta'
      if (text.toLowerCase().includes('error')) return 'queja'
      return 'otro'
    },
    ...overrides,
  }
}

// ── TEXT CONDITION TESTS ───────────────────────────────────────────────

describe('ConditionEvaluator - Text Conditions', () => {
  test('text_contains with "contains" operator should match', async () => {
    const condition: TriggerCondition = {
      id: '1',
      trigger_id: 'trigger-1',
      condition_type: 'text_contains',
      operator: 'contains',
      value: 'precio',
    }
    const context = createTestContext()

    const result = await ConditionEvaluator.evaluateCondition(condition, context)
    expect(result).toBe(true)
  })

  test('text_contains with "not_contains" operator should not match', async () => {
    const condition: TriggerCondition = {
      id: '2',
      trigger_id: 'trigger-1',
      condition_type: 'text_contains',
      operator: 'not_contains',
      value: 'precio',
    }
    const context = createTestContext()

    const result = await ConditionEvaluator.evaluateCondition(condition, context)
    expect(result).toBe(false)
  })

  test('text_contains should be case-insensitive', async () => {
    const condition: TriggerCondition = {
      id: '3',
      trigger_id: 'trigger-1',
      condition_type: 'text_contains',
      operator: 'contains',
      value: 'PRECIO',
    }
    const context = createTestContext({ messageText: 'necesito ayuda con precio' })

    const result = await ConditionEvaluator.evaluateCondition(condition, context)
    expect(result).toBe(true)
  })

  test('text_regex with valid regex should match', async () => {
    const condition: TriggerCondition = {
      id: '4',
      trigger_id: 'trigger-1',
      condition_type: 'text_regex',
      operator: 'equals', // operator ignored for regex
      value: '\\d{3}-\\d{3}-\\d{4}',
      payload: { flags: 'i' },
    }
    const context = createTestContext({ messageText: 'Mi teléfono es 555-123-4567' })

    const result = await ConditionEvaluator.evaluateCondition(condition, context)
    expect(result).toBe(true)
  })

  test('text_matches_intent should match detected intent', async () => {
    const condition: TriggerCondition = {
      id: '5',
      trigger_id: 'trigger-1',
      condition_type: 'text_matches_intent',
      operator: 'equals',
      value: 'pregunta',
    }
    const context = createTestContext({
      messageText: '¿Cuál es el precio?',
    })

    const result = await ConditionEvaluator.evaluateCondition(condition, context)
    expect(result).toBe(true)
  })

  test('text_matches_intent should not match different intent', async () => {
    const condition: TriggerCondition = {
      id: '6',
      trigger_id: 'trigger-1',
      condition_type: 'text_matches_intent',
      operator: 'equals',
      value: 'queja',
    }
    const context = createTestContext({
      messageText: '¿Cuál es el precio?',
    })

    const result = await ConditionEvaluator.evaluateCondition(condition, context)
    expect(result).toBe(false)
  })
})

// ── CHAT CONDITION TESTS ───────────────────────────────────────────────

describe('ConditionEvaluator - Chat Conditions', () => {
  test('last_message_time with "greater_than" should match', async () => {
    const condition: TriggerCondition = {
      id: '7',
      trigger_id: 'trigger-1',
      condition_type: 'last_message_time',
      operator: 'greater_than',
      value: '30', // 30 minutes
    }
    const context = createTestContext({
      chatLastMessageTime: new Date(Date.now() - 61 * 60 * 1000), // 61 minutes ago
    })

    const result = await ConditionEvaluator.evaluateCondition(condition, context)
    expect(result).toBe(true)
  })

  test('message_count with "greater_equal" should match', async () => {
    const condition: TriggerCondition = {
      id: '8',
      trigger_id: 'trigger-1',
      condition_type: 'message_count',
      operator: 'greater_equal',
      value: '25',
    }
    const context = createTestContext({ chatMessageCount: 25 })

    const result = await ConditionEvaluator.evaluateCondition(condition, context)
    expect(result).toBe(true)
  })

  test('message_rate should calculate correctly', async () => {
    const condition: TriggerCondition = {
      id: '9',
      trigger_id: 'trigger-1',
      condition_type: 'message_rate',
      operator: 'greater_than',
      value: '3', // > 3 messages per hour
    }
    // 7 days ago = 168 hours, 25 messages = 0.15 msg/hour
    const context = createTestContext({ chatMessageCount: 25 })

    const result = await ConditionEvaluator.evaluateCondition(condition, context)
    expect(result).toBe(false)
  })

  test('has_tag should match existing tag', async () => {
    const condition: TriggerCondition = {
      id: '10',
      trigger_id: 'trigger-1',
      condition_type: 'has_tag',
      operator: 'equals',
      value: 'vip',
    }
    const context = createTestContext({ chatTags: ['importante', 'vip'] })

    const result = await ConditionEvaluator.evaluateCondition(condition, context)
    expect(result).toBe(true)
  })

  test('not_tag should match when tag is missing', async () => {
    const condition: TriggerCondition = {
      id: '11',
      trigger_id: 'trigger-1',
      condition_type: 'not_tag',
      operator: 'equals',
      value: 'spam',
    }
    const context = createTestContext({ chatTags: ['importante', 'vip'] })

    const result = await ConditionEvaluator.evaluateCondition(condition, context)
    expect(result).toBe(true)
  })

  test('chat_status should match status', async () => {
    const condition: TriggerCondition = {
      id: '12',
      trigger_id: 'trigger-1',
      condition_type: 'chat_status',
      operator: 'equals',
      value: 'customer',
    }
    const context = createTestContext({ chatStatus: 'customer' })

    const result = await ConditionEvaluator.evaluateCondition(condition, context)
    expect(result).toBe(true)
  })

  test('custom_field should match field value', async () => {
    const condition: TriggerCondition = {
      id: '13',
      trigger_id: 'trigger-1',
      condition_type: 'custom_field',
      operator: 'equals',
      value: 'tier:premium',
      payload: { field_name: 'tier' },
    }
    const context = createTestContext({
      chatCustomFields: { tier: 'premium' },
    })

    const result = await ConditionEvaluator.evaluateCondition(condition, context)
    expect(result).toBe(true)
  })

  test('creation_date should calculate days since creation', async () => {
    const condition: TriggerCondition = {
      id: '14',
      trigger_id: 'trigger-1',
      condition_type: 'creation_date',
      operator: 'greater_equal',
      value: '7',
    }
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const context = createTestContext({ chatCreatedAt: sevenDaysAgo })

    const result = await ConditionEvaluator.evaluateCondition(condition, context)
    expect(result).toBe(true)
  })
})

// ── TIME CONDITION TESTS ───────────────────────────────────────────────

describe('ConditionEvaluator - Time Conditions', () => {
  test('day_of_week should match current day', async () => {
    const condition: TriggerCondition = {
      id: '15',
      trigger_id: 'trigger-1',
      condition_type: 'day_of_week',
      operator: 'equals',
      value: 'monday,tuesday,wednesday,thursday,friday',
    }
    // This test depends on current day, so we'll use a flexible approach
    const today = new Date()
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const todayName = dayNames[today.getDay()]

    const result = await ConditionEvaluator.evaluateCondition(condition, createTestContext())
    // Should only match if today is a weekday
    expect(result).toBe(todayName !== 'sunday' && todayName !== 'saturday')
  })

  test('hour_range should match current hour', async () => {
    const condition: TriggerCondition = {
      id: '16',
      trigger_id: 'trigger-1',
      condition_type: 'hour_range',
      operator: 'equals',
      value: '09:00-18:00',
    }
    const now = new Date()
    const currentHour = now.getHours()
    const shouldMatch = currentHour >= 9 && currentHour < 18

    const result = await ConditionEvaluator.evaluateCondition(condition, createTestContext())
    expect(result).toBe(shouldMatch)
  })
})

// ── SUBSCRIPTION CONDITION TESTS ─────────────────────────────────────

describe('ConditionEvaluator - Subscription Conditions', () => {
  test('expiration_days should calculate correctly', async () => {
    const condition: TriggerCondition = {
      id: '17',
      trigger_id: 'trigger-1',
      condition_type: 'expiration_days',
      operator: 'less_than',
      value: '7', // Expires in less than 7 days
    }
    const expiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days
    const context = createTestContext({ subscriptionExpiresAt: expiresAt })

    const result = await ConditionEvaluator.evaluateCondition(condition, context)
    expect(result).toBe(true)
  })

  test('subscription_status should match status', async () => {
    const condition: TriggerCondition = {
      id: '18',
      trigger_id: 'trigger-1',
      condition_type: 'subscription_status',
      operator: 'equals',
      value: 'active',
    }
    const context = createTestContext({ subscriptionStatus: 'active' })

    const result = await ConditionEvaluator.evaluateCondition(condition, context)
    expect(result).toBe(true)
  })

  test('subscription_status should not match different status', async () => {
    const condition: TriggerCondition = {
      id: '19',
      trigger_id: 'trigger-1',
      condition_type: 'subscription_status',
      operator: 'equals',
      value: 'expired',
    }
    const context = createTestContext({ subscriptionStatus: 'active' })

    const result = await ConditionEvaluator.evaluateCondition(condition, context)
    expect(result).toBe(false)
  })
})

// ── CONDITION GROUP TESTS (AND/OR LOGIC) ───────────────────────────────

describe('ConditionEvaluator - Condition Groups', () => {
  test('AND group should match when all conditions match', async () => {
    const group: TriggerConditionGroup = {
      id: 'group-1',
      trigger_id: 'trigger-1',
      operator: 'AND',
      group_order: 0,
      conditions: [
        {
          id: '20',
          trigger_id: 'trigger-1',
          condition_type: 'text_contains',
          operator: 'contains',
          value: 'precio',
        },
        {
          id: '21',
          trigger_id: 'trigger-1',
          condition_type: 'chat_status',
          operator: 'equals',
          value: 'customer',
        },
      ],
    }
    const context = createTestContext({
      messageText: 'Hola, ¿cuál es el precio?',
      chatStatus: 'customer',
    })

    const result = await ConditionEvaluator.evaluateConditionGroup(group, context)
    expect(result.matched).toBe(true)
  })

  test('AND group should not match when one condition fails', async () => {
    const group: TriggerConditionGroup = {
      id: 'group-2',
      trigger_id: 'trigger-1',
      operator: 'AND',
      group_order: 0,
      conditions: [
        {
          id: '22',
          trigger_id: 'trigger-1',
          condition_type: 'text_contains',
          operator: 'contains',
          value: 'precio',
        },
        {
          id: '23',
          trigger_id: 'trigger-1',
          condition_type: 'chat_status',
          operator: 'equals',
          value: 'lead', // Will not match 'customer'
        },
      ],
    }
    const context = createTestContext({
      messageText: 'Hola, ¿cuál es el precio?',
      chatStatus: 'customer',
    })

    const result = await ConditionEvaluator.evaluateConditionGroup(group, context)
    expect(result.matched).toBe(false)
  })

  test('OR group should match when any condition matches', async () => {
    const group: TriggerConditionGroup = {
      id: 'group-3',
      trigger_id: 'trigger-1',
      operator: 'OR',
      group_order: 0,
      conditions: [
        {
          id: '24',
          trigger_id: 'trigger-1',
          condition_type: 'text_contains',
          operator: 'contains',
          value: 'error',
        },
        {
          id: '25',
          trigger_id: 'trigger-1',
          condition_type: 'has_tag',
          operator: 'equals',
          value: 'vip',
        },
      ],
    }
    const context = createTestContext({
      messageText: 'Hola, ¿cuál es el precio?',
      chatTags: ['vip'],
    })

    const result = await ConditionEvaluator.evaluateConditionGroup(group, context)
    expect(result.matched).toBe(true)
  })

  test('OR group should not match when no conditions match', async () => {
    const group: TriggerConditionGroup = {
      id: 'group-4',
      trigger_id: 'trigger-1',
      operator: 'OR',
      group_order: 0,
      conditions: [
        {
          id: '26',
          trigger_id: 'trigger-1',
          condition_type: 'text_contains',
          operator: 'contains',
          value: 'error',
        },
        {
          id: '27',
          trigger_id: 'trigger-1',
          condition_type: 'has_tag',
          operator: 'equals',
          value: 'spam',
        },
      ],
    }
    const context = createTestContext({
      messageText: 'Hola, ¿cuál es el precio?',
      chatTags: ['importante', 'vip'],
    })

    const result = await ConditionEvaluator.evaluateConditionGroup(group, context)
    expect(result.matched).toBe(false)
  })
})

// ── Run tests (if using Jest or similar) ───────────────────────────────

// Export for use in test runners
export {}
