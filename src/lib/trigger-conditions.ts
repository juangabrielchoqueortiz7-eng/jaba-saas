/**
 * Trigger Conditions Evaluator
 *
 * Flexible, type-safe system for evaluating trigger conditions.
 * Supports 12+ condition types with AND/OR grouping logic.
 */

import { createClient } from '@/utils/supabase/server'

// ── Types ──────────────────────────────────────────────────────────────────

export type ConditionType =
  | 'text_contains'         // Text message contains substring
  | 'text_regex'            // Text matches regex pattern
  | 'text_matches_intent'   // AI evaluates intent (queja, pregunta, oferta, etc)
  | 'last_message_time'     // Minutes since last message
  | 'message_count'         // Total number of messages in chat
  | 'message_rate'          // Messages per hour
  | 'has_tag'               // Chat has specific tag
  | 'not_tag'               // Chat does NOT have tag
  | 'custom_field'          // Custom chat field matches value
  | 'chat_status'           // Chat status (lead, customer, closed)
  | 'creation_date'         // Days since chat was created
  | 'day_of_week'           // Specific day(s) of week
  | 'hour_range'            // Specific time range (HH:MM-HH:MM)
  | 'expiration_days'       // Subscription expires in X days
  | 'subscription_status'   // Subscription status (active, expired, paused)

export type ConditionOperator =
  | 'equals'                // value == condition
  | 'not_equals'            // value != condition
  | 'contains'              // value includes condition
  | 'not_contains'          // value does not include condition
  | 'greater_than'          // value > condition (for numbers)
  | 'greater_equal'         // value >= condition
  | 'less_than'             // value < condition
  | 'less_equal'            // value <= condition
  | 'starts_with'           // text starts with
  | 'ends_with'             // text ends with
  | 'in'                    // value in comma-separated list
  | 'not_in'                // value not in list

export type GroupOperator = 'AND' | 'OR'

// Condition definition from database
export interface TriggerCondition {
  id: string
  trigger_id: string
  condition_type: ConditionType
  operator: ConditionOperator
  value: string  // Stored as string; parsed based on type
  payload?: Record<string, any>  // Additional config for complex types
  group_id?: string
}

// Group of conditions with AND/OR logic
export interface TriggerConditionGroup {
  id: string
  trigger_id: string
  operator: GroupOperator
  group_order: number
  parent_group_id?: string
  conditions: TriggerCondition[]
  subgroups?: TriggerConditionGroup[]
}

// Context data for evaluation
export interface EvaluationContext {
  messageText: string
  messageTimestamp: Date

  // Chat metadata
  chatId: string
  chatCreatedAt: Date
  chatTags: string[]
  chatStatus: string  // 'lead' | 'customer' | 'closed'
  chatLastMessageTime?: Date
  chatMessageCount: number
  chatCustomFields?: Record<string, any>

  // Subscription (optional)
  subscriptionStatus?: string  // 'active' | 'expired' | 'paused'
  subscriptionExpiresAt?: Date

  // AI evaluation (if needed)
  evaluateIntent?: (text: string) => Promise<string>  // Returns intent type
}

// Result of evaluating a condition group
export interface EvaluationResult {
  matched: boolean
  reason?: string  // For debugging
  evaluations?: {
    condition_id: string
    matched: boolean
    evaluated_value?: string
  }[]
}

// ── ConditionEvaluator Class ───────────────────────────────────────────────

export class ConditionEvaluator {
  /**
   * Evaluate a single condition against context
   */
  static async evaluateCondition(
    condition: TriggerCondition,
    context: EvaluationContext
  ): Promise<boolean> {
    try {
      switch (condition.condition_type) {
        // ── TEXT CONDITIONS ────────────────────────────────────────────
        case 'text_contains':
          return this.evaluateTextContains(context.messageText, condition)

        case 'text_regex':
          return this.evaluateTextRegex(context.messageText, condition)

        case 'text_matches_intent':
          return await this.evaluateTextIntent(context.messageText, condition, context)

        // ── CHAT CONDITIONS ────────────────────────────────────────────
        case 'last_message_time':
          return this.evaluateLastMessageTime(context, condition)

        case 'message_count':
          return this.evaluateMessageCount(context.chatMessageCount, condition)

        case 'message_rate':
          return this.evaluateMessageRate(context, condition)

        case 'has_tag':
          return this.evaluateHasTag(context.chatTags, condition)

        case 'not_tag':
          return !this.evaluateHasTag(context.chatTags, condition)

        case 'chat_status':
          return this.evaluateChatStatus(context.chatStatus, condition)

        case 'custom_field':
          return this.evaluateCustomField(context.chatCustomFields || {}, condition)

        case 'creation_date':
          return this.evaluateCreationDate(context.chatCreatedAt, condition)

        // ── TIME CONDITIONS ────────────────────────────────────────────
        case 'day_of_week':
          return this.evaluateDayOfWeek(new Date(), condition)

        case 'hour_range':
          return this.evaluateHourRange(new Date(), condition)

        // ── SUBSCRIPTION CONDITIONS ────────────────────────────────────
        case 'expiration_days':
          return this.evaluateExpirationDays(context.subscriptionExpiresAt, condition)

        case 'subscription_status':
          return this.evaluateSubscriptionStatus(context.subscriptionStatus, condition)

        default:
          console.warn(`Unknown condition type: ${condition.condition_type}`)
          return false
      }
    } catch (error) {
      console.error(`Error evaluating condition ${condition.id}:`, error)
      return false
    }
  }

  /**
   * Evaluate a group of conditions with AND/OR logic
   */
  static async evaluateConditionGroup(
    group: TriggerConditionGroup,
    context: EvaluationContext
  ): Promise<EvaluationResult> {
    const isAnd = group.operator === 'AND'
    const evaluations: EvaluationResult['evaluations'] = []

    // Evaluate all conditions in this group
    for (const condition of group.conditions) {
      const matched = await this.evaluateCondition(condition, context)
      evaluations.push({
        condition_id: condition.id,
        matched,
      })

      // Short-circuit for AND (if one fails, whole group fails)
      // OR continues to check all
      if (isAnd && !matched) {
        return {
          matched: false,
          reason: `Condition ${condition.id} failed (${condition.condition_type})`,
          evaluations,
        }
      }
      if (!isAnd && matched) {
        // OR: found a match, but continue evaluating for logging
      }
    }

    // Evaluate subgroups recursively
    if (group.subgroups?.length) {
      for (const subgroup of group.subgroups) {
        const subResult = await this.evaluateConditionGroup(subgroup, context)

        if (isAnd && !subResult.matched) {
          return {
            matched: false,
            reason: `Subgroup ${subgroup.id} failed`,
            evaluations,
          }
        }
        if (!isAnd && subResult.matched) {
          // Continue for logging
        }
      }
    }

    // Determine final result based on operator
    if (isAnd) {
      return {
        matched: true,
        reason: 'All conditions matched',
        evaluations,
      }
    } else {
      // OR: check if at least one matched
      const anyMatched = evaluations.some(e => e.matched)
      return {
        matched: anyMatched,
        reason: anyMatched ? 'At least one condition matched' : 'No conditions matched',
        evaluations,
      }
    }
  }

  /**
   * Evaluate all condition groups for a trigger (top-level AND between groups)
   */
  static async evaluateAllConditionGroups(
    groups: TriggerConditionGroup[],
    context: EvaluationContext
  ): Promise<EvaluationResult> {
    // All groups must match (implicit AND at top level)
    for (const group of groups) {
      const result = await this.evaluateConditionGroup(group, context)
      if (!result.matched) {
        return {
          matched: false,
          reason: `Group ${group.id} with ${group.operator} operator did not match`,
        }
      }
    }
    return {
      matched: true,
      reason: 'All condition groups matched',
    }
  }

  // ── Individual Evaluators ──────────────────────────────────────────────

  private static evaluateTextContains(text: string, condition: TriggerCondition): boolean {
    const searchText = condition.value.toLowerCase()
    const messageText = text.toLowerCase()

    switch (condition.operator) {
      case 'contains':
        return messageText.includes(searchText)
      case 'not_contains':
        return !messageText.includes(searchText)
      case 'starts_with':
        return messageText.startsWith(searchText)
      case 'ends_with':
        return messageText.endsWith(searchText)
      default:
        return false
    }
  }

  private static evaluateTextRegex(text: string, condition: TriggerCondition): boolean {
    try {
      const regex = new RegExp(condition.value, condition.payload?.flags || 'i')
      return regex.test(text)
    } catch (error) {
      console.error('Invalid regex in condition:', condition.value, error)
      return false
    }
  }

  private static async evaluateTextIntent(
    text: string,
    condition: TriggerCondition,
    context: EvaluationContext
  ): Promise<boolean> {
    if (!context.evaluateIntent) {
      console.warn('evaluateIntent function not provided in context')
      return false
    }

    try {
      const intent = await context.evaluateIntent(text)
      return this.compareValues(intent, condition.value, condition.operator)
    } catch (error) {
      console.error('Error evaluating intent:', error)
      return false
    }
  }

  private static evaluateLastMessageTime(
    context: EvaluationContext,
    condition: TriggerCondition
  ): boolean {
    if (!context.chatLastMessageTime) return false

    const minutesSinceLastMessage = Math.floor(
      (Date.now() - context.chatLastMessageTime.getTime()) / (1000 * 60)
    )
    const targetMinutes = parseInt(condition.value)

    return this.compareNumbers(minutesSinceLastMessage, targetMinutes, condition.operator)
  }

  private static evaluateMessageCount(
    messageCount: number,
    condition: TriggerCondition
  ): boolean {
    const targetCount = parseInt(condition.value)
    return this.compareNumbers(messageCount, targetCount, condition.operator)
  }

  private static evaluateMessageRate(
    context: EvaluationContext,
    condition: TriggerCondition
  ): boolean {
    if (!context.chatLastMessageTime || context.chatMessageCount === 0) {
      return false
    }

    const hoursSinceCreated = Math.max(
      1,
      Math.floor((Date.now() - context.chatCreatedAt.getTime()) / (1000 * 60 * 60))
    )
    const messagesPerHour = context.chatMessageCount / hoursSinceCreated
    const targetRate = parseFloat(condition.value)

    return this.compareNumbers(messagesPerHour, targetRate, condition.operator)
  }

  private static evaluateHasTag(tags: string[], condition: TriggerCondition): boolean {
    return tags.includes(condition.value)
  }

  private static evaluateChatStatus(
    status: string,
    condition: TriggerCondition
  ): boolean {
    return this.compareValues(status, condition.value, condition.operator)
  }

  private static evaluateCustomField(
    customFields: Record<string, any>,
    condition: TriggerCondition
  ): boolean {
    const fieldName = condition.payload?.field_name || condition.value.split(':')[0]
    const value = customFields[fieldName]

    if (value === undefined) return false
    return this.compareValues(String(value), condition.value, condition.operator)
  }

  private static evaluateCreationDate(
    createdAt: Date,
    condition: TriggerCondition
  ): boolean {
    const daysSinceCreation = Math.floor(
      (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
    )
    const targetDays = parseInt(condition.value)

    return this.compareNumbers(daysSinceCreation, targetDays, condition.operator)
  }

  private static evaluateDayOfWeek(date: Date, condition: TriggerCondition): boolean {
    const dayOfWeek = date.getDay() // 0=Sunday, 1=Monday, etc.
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const currentDay = dayNames[dayOfWeek]

    const targetDays = condition.value.toLowerCase().split(',').map(d => d.trim())
    return targetDays.includes(currentDay)
  }

  private static evaluateHourRange(date: Date, condition: TriggerCondition): boolean {
    const currentHour = date.getHours()
    const [startStr, endStr] = condition.value.split('-')
    const startHour = parseInt(startStr.split(':')[0])
    const endHour = parseInt(endStr.split(':')[0])

    return currentHour >= startHour && currentHour < endHour
  }

  private static evaluateExpirationDays(
    expiresAt: Date | undefined,
    condition: TriggerCondition
  ): boolean {
    if (!expiresAt) return false

    const daysUntilExpiration = Math.floor(
      (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    const targetDays = parseInt(condition.value)

    return this.compareNumbers(daysUntilExpiration, targetDays, condition.operator)
  }

  private static evaluateSubscriptionStatus(
    status: string | undefined,
    condition: TriggerCondition
  ): boolean {
    if (!status) return false
    return this.compareValues(status, condition.value, condition.operator)
  }

  // ── Helper Methods ────────────────────────────────────────────────────

  private static compareValues(actual: string, target: string, operator: ConditionOperator): boolean {
    const actualLower = actual.toLowerCase()
    const targetLower = target.toLowerCase()

    switch (operator) {
      case 'equals':
        return actualLower === targetLower
      case 'not_equals':
        return actualLower !== targetLower
      case 'contains':
        return actualLower.includes(targetLower)
      case 'not_contains':
        return !actualLower.includes(targetLower)
      case 'starts_with':
        return actualLower.startsWith(targetLower)
      case 'ends_with':
        return actualLower.endsWith(targetLower)
      case 'in':
        return target.split(',').map(s => s.trim().toLowerCase()).includes(actualLower)
      case 'not_in':
        return !target.split(',').map(s => s.trim().toLowerCase()).includes(actualLower)
      default:
        return false
    }
  }

  private static compareNumbers(actual: number, target: number, operator: ConditionOperator): boolean {
    switch (operator) {
      case 'equals':
        return actual === target
      case 'not_equals':
        return actual !== target
      case 'greater_than':
        return actual > target
      case 'greater_equal':
        return actual >= target
      case 'less_than':
        return actual < target
      case 'less_equal':
        return actual <= target
      default:
        return false
    }
  }
}

// ── Export default ────────────────────────────────────────────────────────

export default ConditionEvaluator
