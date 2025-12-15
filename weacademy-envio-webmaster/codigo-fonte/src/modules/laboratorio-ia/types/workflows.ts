export type HumanAssignmentMode = 'user' | 'role' | 'group' | 'dynamic'

export interface HumanAssignmentConfig {
  mode: HumanAssignmentMode
  users?: string[]
  roles?: string[]
  groups?: string[]
  dynamicPath?: string
  allowSelfAssign?: boolean
  fallback?: {
    mode: HumanAssignmentMode
    targetIds?: string[]
    dynamicPath?: string
  } | null
}

export type HumanApprovalType = 'single' | 'majority' | 'unanimous'

export interface HumanApprovalConfig {
  type: HumanApprovalType
  requiredApprovals?: number
  allowRejectionComments?: boolean
  autoApproveAfterMinutes?: number | null
  autoRejectAfterMinutes?: number | null
  allowDelegation?: boolean
}

export interface HumanSLAConfig {
  enabled: boolean
  durationMinutes: number
  reminderEveryMinutes?: number | null
  maxReminders?: number | null
  escalationChain?: Array<{
    afterMinutes: number
    mode: HumanAssignmentMode
    targetId: string
    notifyChannels?: Array<'email' | 'sms' | 'teams' | 'webhook'>
  }>
}

export interface HumanExternalActionConfig {
  notifyChannels?: Array<'email' | 'sms' | 'teams' | 'whatsapp' | 'webhook'>
  webhookUrl?: string
  webhookHeaders?: Record<string, string>
  includeContext?: boolean
}

export interface HumanStageConfig {
  instructions?: string
  formSchema?: Record<string, any> | null
  assignment?: HumanAssignmentConfig | null
  approval?: HumanApprovalConfig | null
  sla?: HumanSLAConfig | null
  externalActions?: HumanExternalActionConfig | null
  allowAttachments?: boolean
  metadata?: Record<string, any> | null
}

export interface HumanTaskFilters {
  status?: string
  workflowInstanceId?: string
  workflowVersionId?: string
  stageId?: string
  assigneeUserId?: string
  includeCompleted?: boolean
  limit?: number
}

export type HumanTaskAction =
  | 'assign'
  | 'start'
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'escalate'
  | 'reassign'
  | 'add_comment'

export interface HumanTaskActionPayload {
  action: HumanTaskAction
  assigneeUserId?: string
  assigneeRole?: string
  decisionReason?: string
  metadata?: Record<string, any>
}

export type TeamStrategy =
  | 'round_robin'
  | 'parallel_debate'
  | 'majority_vote'
  | 'consensus'
  | 'coordinator_override'

export interface CollaborativeTeamMember {
  agentId: string
  role: 'coordinator' | 'executor' | 'validator' | 'observer'
  weight?: number
  responsibilities?: string
  metadata?: Record<string, any>
}

export interface CollaborativeTeamConfig {
  teamKey: string
  name: string
  description?: string | null
  strategy: TeamStrategy
  metadata?: Record<string, any>
  members: CollaborativeTeamMember[]
}

export type SupervisorDecisionStyle =
  | 'approve_reject'
  | 'merge_summary'
  | 'route_back'
  | 'escalate_human'

export type SupervisorScope = 'pipeline' | 'stage' | 'team'

export interface SupervisorValidationRule {
  id: string
  description: string
  severity?: 'info' | 'warning' | 'critical'
  expression?: string
}

export interface SupervisorConflictPolicy {
  strategy: 'auto_resolve' | 'rerun_team' | 'escalate_human' | 'fallback_pipeline'
  notify?: ('email' | 'slack' | 'teams' | 'webhook')[]
  messageTemplate?: string
}

export interface SupervisorConfig {
  supervisorAgentId: string
  scope: SupervisorScope
  appliesTo?: {
    stageKeys?: string[]
    teamKeys?: string[]
  }
  decisionStyle: SupervisorDecisionStyle
  validationRules?: SupervisorValidationRule[]
  conflictPolicy?: SupervisorConflictPolicy
  autoApproveThreshold?: number
  allowOverride?: boolean
  metadata?: Record<string, any>
}

