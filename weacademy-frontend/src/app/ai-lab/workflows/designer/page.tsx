'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type OnEdgesChange,
} from 'reactflow'
import 'reactflow/dist/style.css'

import useSWR from 'swr'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Plus, Save, Trash2, Check, AlertCircle, History, RefreshCw } from 'lucide-react'
import type {
  HumanStageConfig,
  CollaborativeTeamConfig,
  TeamStrategy,
  SupervisorConfig,
  SupervisorDecisionStyle,
  SupervisorScope,
} from '@/modules/laboratorio-ia/types/workflows'

interface Blueprint {
  id: string
  name: string
  description?: string | null
  category?: string | null
  tags?: string[] | null
  canvas?: {
    nodes?: Node[]
    edges?: Edge[]
    viewport?: { x: number; y: number; zoom: number }
  }
  settings?: Record<string, any>
  updated_at?: string
}

interface BlueprintListResponse {
  success: boolean
  blueprints: Blueprint[]
}

interface BlueprintDetailResponse {
  success: boolean
  blueprint: Blueprint
}

const fetcher = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(await response.text())
  }
  return response.json()
}

const DEFAULT_NODE: Node = {
  id: crypto.randomUUID(),
  type: 'default',
  position: { x: 100, y: 100 },
  data: {
    label: 'Nova Etapa',
    stageKey: 'stage_' + Math.random().toString(16).slice(2, 6),
    stageType: 'pipeline',
  },
}

type LoopInnerStageType = 'pipeline' | 'human' | 'delay' | 'webhook' | 'agent' | 'loop'

const DEFAULT_LOOP_CONFIG = {
  itemsPath: '',
  itemAlias: 'item',
  maxParallel: 1,
  iterationContextPath: '',
  outputPath: '',
  accumulateContextPath: '',
  untilCondition: {
    path: '',
    equals: '',
  },
  inner: {
    stageType: 'pipeline' as LoopInnerStageType,
    stageConfig: {
      pipelineId: '',
      inputPath: '',
      outputPath: '',
      fallbackTextPath: '',
    },
  },
}

function ensureLoopConfig(config?: any) {
  const base = config || {}
  return {
    itemsPath: base.itemsPath || '',
    itemAlias: base.itemAlias || 'item',
    maxParallel: Number(base.maxParallel) || 1,
    iterationContextPath: base.iterationContextPath || '',
    outputPath: base.outputPath || '',
    accumulateContextPath: base.accumulateContextPath || '',
    untilCondition: {
      path: base.untilCondition?.path || '',
      equals: base.untilCondition?.equals ?? '',
    },
    inner: {
      stageType: (base.inner?.stageType as LoopInnerStageType) || 'pipeline',
      stageConfig: {
        pipelineId: base.inner?.stageConfig?.pipelineId || '',
        inputPath: base.inner?.stageConfig?.inputPath || '',
        outputPath: base.inner?.stageConfig?.outputPath || '',
        fallbackTextPath: base.inner?.stageConfig?.fallbackTextPath || '',
      },
    },
  }
}

function getNextVersionLabel(previous?: string | null) {
  if (previous) {
    const match = previous.trim().match(/v?(\d+)\.(\d+)\.(\d+)/i)
    if (match) {
      const [, majorStr, minorStr, patchStr] = match
      const major = Number(majorStr)
      const minor = Number(minorStr)
      const patch = Number(patchStr)
      if (!Number.isNaN(major) && !Number.isNaN(minor) && !Number.isNaN(patch)) {
        return `v${major}.${minor}.${patch + 1}`
      }
    }
  }
  return 'v1.0.0'
}

const HUMAN_ASSIGNMENT_MODES = ['user', 'role', 'group', 'dynamic'] as const
const HUMAN_CHANNEL_OPTIONS = ['email', 'sms', 'whatsapp', 'teams', 'webhook'] as const

function slugifyTeamKey(value: string, fallback = 'team') {
  const base = (value || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50)
  return base || fallback
}

type CollaborationTeamMemberState = {
  id: string
  agentId: string
  role: 'coordinator' | 'executor' | 'validator' | 'observer'
  weight: number
  responsibilities: string
}

type CollaborationTeamState = {
  id: string
  teamKey: string
  name: string
  description: string
  strategy: TeamStrategy
  metadata: Record<string, any>
  members: CollaborationTeamMemberState[]
}

type SupervisorValidationRuleState = {
  id: string
  description: string
  severity: 'info' | 'warning' | 'critical'
  expression: string
}

type SupervisorConflictPolicyState = {
  strategy: 'auto_resolve' | 'rerun_team' | 'escalate_human' | 'fallback_pipeline'
  notify: string[]
  messageTemplate: string
}

type SupervisorConfigState = {
  id: string
  supervisorAgentId: string
  scope: SupervisorScope
  stageKeys: string[]
  teamKeys: string[]
  decisionStyle: SupervisorDecisionStyle
  validationRules: SupervisorValidationRuleState[]
  conflictPolicy: SupervisorConflictPolicyState | null
  autoApproveThreshold?: number | null
  allowOverride: boolean
  metadata: Record<string, any>
}

type HumanStageConfigState = {
  instructions: string
  formSchema: Record<string, any>
  assignment: {
    mode: typeof HUMAN_ASSIGNMENT_MODES[number]
    users: string[]
    roles: string[]
    groups: string[]
    dynamicPath: string
    allowSelfAssign: boolean
    fallback?: {
      mode: typeof HUMAN_ASSIGNMENT_MODES[number]
      targetIds: string[]
      dynamicPath: string
    } | null
  } | null
  approval: {
    type: 'single' | 'majority' | 'unanimous'
    requiredApprovals: number | null
    allowRejectionComments: boolean
    allowDelegation: boolean
    autoApproveAfterMinutes: number | null
    autoRejectAfterMinutes: number | null
  } | null
  sla: {
    enabled: boolean
    durationMinutes: number | null
    reminderEveryMinutes: number | null
    maxReminders: number | null
    escalationChain: Array<{
      id: string
      mode: typeof HUMAN_ASSIGNMENT_MODES[number]
      targetId: string
      afterMinutes: number
      notifyChannels: string[]
    }>
  }
  externalActions: {
    notifyChannels: string[]
    webhookUrl: string
    webhookHeaders: Record<string, string>
    includeContext: boolean
  } | null
  allowAttachments: boolean
  metadata: Record<string, any>
  outputPath: string
}

function ensureHumanConfigState(raw?: HumanStageConfig | null): HumanStageConfigState {
  const assignmentMode =
    raw?.assignment && typeof raw.assignment.mode === 'string' && HUMAN_ASSIGNMENT_MODES.includes(raw.assignment.mode as any)
      ? (raw.assignment.mode as typeof HUMAN_ASSIGNMENT_MODES[number])
      : 'role'
  const assignment: HumanStageConfigState['assignment'] =
    raw?.assignment != null
      ? {
          mode: assignmentMode,
          users: Array.isArray(raw.assignment.users) ? raw.assignment.users.filter(Boolean) : [],
          roles: Array.isArray(raw.assignment.roles) ? raw.assignment.roles.filter(Boolean) : [],
          groups: Array.isArray(raw.assignment.groups) ? raw.assignment.groups.filter(Boolean) : [],
          dynamicPath: typeof raw.assignment.dynamicPath === 'string' ? raw.assignment.dynamicPath : '',
          allowSelfAssign: Boolean(raw.assignment.allowSelfAssign),
          fallback: raw.assignment.fallback
            ? {
                mode:
                  HUMAN_ASSIGNMENT_MODES.includes(raw.assignment.fallback.mode as any)
                    ? (raw.assignment.fallback.mode as typeof HUMAN_ASSIGNMENT_MODES[number])
                    : 'role',
                targetIds: Array.isArray(raw.assignment.fallback.targetIds)
                  ? raw.assignment.fallback.targetIds.filter(Boolean)
                  : [],
                dynamicPath:
                  typeof raw.assignment.fallback.dynamicPath === 'string'
                    ? raw.assignment.fallback.dynamicPath
                    : '',
              }
            : null,
        }
      : null

  const approval: HumanStageConfigState['approval'] =
    raw?.approval != null
      ? {
          type:
            raw.approval.type === 'majority' || raw.approval.type === 'unanimous' ? raw.approval.type : 'single',
          requiredApprovals:
            typeof raw.approval.requiredApprovals === 'number' ? raw.approval.requiredApprovals : null,
          allowRejectionComments: Boolean(raw.approval.allowRejectionComments),
          allowDelegation: Boolean(raw.approval.allowDelegation),
          autoApproveAfterMinutes:
            typeof raw.approval.autoApproveAfterMinutes === 'number' ? raw.approval.autoApproveAfterMinutes : null,
          autoRejectAfterMinutes:
            typeof raw.approval.autoRejectAfterMinutes === 'number' ? raw.approval.autoRejectAfterMinutes : null,
        }
      : {
          type: 'single',
          requiredApprovals: null,
          allowRejectionComments: false,
          allowDelegation: false,
          autoApproveAfterMinutes: null,
          autoRejectAfterMinutes: null,
        }

  const slaChain =
    raw?.sla?.escalationChain && Array.isArray(raw.sla.escalationChain)
      ? raw.sla.escalationChain
          .filter((entry: any) => entry && typeof entry === 'object')
          .map((entry: any) => ({
            id: crypto.randomUUID(),
            mode: HUMAN_ASSIGNMENT_MODES.includes(entry.mode as any)
              ? (entry.mode as typeof HUMAN_ASSIGNMENT_MODES[number])
              : 'role',
            targetId: typeof entry.targetId === 'string' ? entry.targetId : '',
            afterMinutes:
              typeof entry.afterMinutes === 'number'
                ? entry.afterMinutes
                : entry.afterMinutes && typeof entry.afterMinutes === 'string'
                ? Number(entry.afterMinutes)
                : 0,
            notifyChannels: Array.isArray(entry.notifyChannels)
              ? entry.notifyChannels
                  .map((channel: any) => (HUMAN_CHANNEL_OPTIONS.includes(channel) ? channel : null))
                  .filter(Boolean) as string[]
              : [],
          }))
      : []

  const sla: HumanStageConfigState['sla'] = {
    enabled: Boolean(raw?.sla?.enabled) || Boolean(raw?.sla?.durationMinutes),
    durationMinutes:
      typeof raw?.sla?.durationMinutes === 'number'
        ? raw!.sla!.durationMinutes
        : raw?.sla?.durationMinutes && typeof raw.sla.durationMinutes === 'string'
        ? Number(raw.sla.durationMinutes)
        : null,
    reminderEveryMinutes:
      typeof raw?.sla?.reminderEveryMinutes === 'number'
        ? raw!.sla!.reminderEveryMinutes
        : raw?.sla?.reminderEveryMinutes && typeof raw.sla.reminderEveryMinutes === 'string'
        ? Number(raw.sla.reminderEveryMinutes)
        : null,
    maxReminders:
      typeof raw?.sla?.maxReminders === 'number'
        ? raw!.sla!.maxReminders
        : raw?.sla?.maxReminders && typeof raw.sla.maxReminders === 'string'
        ? Number(raw.sla.maxReminders)
        : null,
    escalationChain: slaChain,
  }

  const externalActions: HumanStageConfigState['externalActions'] =
    raw?.externalActions && typeof raw.externalActions === 'object'
      ? {
          notifyChannels: Array.isArray(raw.externalActions.notifyChannels)
            ? raw.externalActions.notifyChannels.filter((channel: any) =>
                HUMAN_CHANNEL_OPTIONS.includes(channel)
              )
            : [],
          webhookUrl: typeof raw.externalActions.webhookUrl === 'string' ? raw.externalActions.webhookUrl : '',
          webhookHeaders:
            raw.externalActions.webhookHeaders && typeof raw.externalActions.webhookHeaders === 'object'
              ? raw.externalActions.webhookHeaders
              : {},
          includeContext: Boolean(raw.externalActions.includeContext),
        }
      : {
          notifyChannels: [],
          webhookUrl: '',
          webhookHeaders: {},
          includeContext: false,
        }

  return {
    instructions: typeof raw?.instructions === 'string' ? raw.instructions : '',
    formSchema: raw?.formSchema && typeof raw.formSchema === 'object' ? raw.formSchema : {},
    assignment,
    approval,
    sla,
    externalActions,
    allowAttachments: Boolean(raw?.allowAttachments),
    metadata: raw?.metadata && typeof raw.metadata === 'object' ? raw.metadata : {},
    outputPath:
      raw && typeof (raw as any).outputPath === 'string'
        ? ((raw as any).outputPath as string)
        : '',
  }
}

function sanitizeHumanConfigForSave(state: HumanStageConfigState): HumanStageConfig & { outputPath?: string } {
  const assignment =
    state.assignment && state.assignment.mode
      ? {
          mode: state.assignment.mode,
          allowSelfAssign: Boolean(state.assignment.allowSelfAssign),
          users: state.assignment.users.filter((value) => value.trim().length > 0),
          roles: state.assignment.roles.filter((value) => value.trim().length > 0),
          groups: state.assignment.groups.filter((value) => value.trim().length > 0),
          dynamicPath: state.assignment.dynamicPath?.trim() || undefined,
          fallback:
            state.assignment.fallback &&
            (state.assignment.fallback.targetIds.some((id) => id.trim().length > 0) ||
              state.assignment.fallback.dynamicPath.trim().length > 0)
              ? {
                  mode: state.assignment.fallback.mode,
                  targetIds: state.assignment.fallback.targetIds.filter((value) => value.trim().length > 0),
                  dynamicPath: state.assignment.fallback.dynamicPath.trim() || undefined,
                }
              : undefined,
        }
      : null

  const approval =
    state.approval?.type
      ? {
          type: state.approval.type,
          requiredApprovals:
            state.approval.type === 'majority' && state.approval.requiredApprovals
              ? Math.max(1, state.approval.requiredApprovals)
              : undefined,
          allowRejectionComments: Boolean(state.approval.allowRejectionComments),
          allowDelegation: Boolean(state.approval.allowDelegation),
          autoApproveAfterMinutes:
            state.approval.autoApproveAfterMinutes && state.approval.autoApproveAfterMinutes > 0
              ? state.approval.autoApproveAfterMinutes
              : undefined,
          autoRejectAfterMinutes:
            state.approval.autoRejectAfterMinutes && state.approval.autoRejectAfterMinutes > 0
              ? state.approval.autoRejectAfterMinutes
              : undefined,
        }
      : null

  const sla =
    state.sla.enabled && state.sla.durationMinutes
      ? {
          enabled: true,
          durationMinutes: state.sla.durationMinutes,
          reminderEveryMinutes:
            state.sla.reminderEveryMinutes && state.sla.reminderEveryMinutes > 0
              ? state.sla.reminderEveryMinutes
              : undefined,
          maxReminders:
            state.sla.maxReminders && state.sla.maxReminders > 0 ? state.sla.maxReminders : undefined,
          escalationChain:
            state.sla.escalationChain
              .filter((entry) => entry.targetId.trim().length > 0)
              .map((entry) => ({
                mode: entry.mode,
                targetId: entry.targetId.trim(),
                afterMinutes: Math.max(1, entry.afterMinutes),
                notifyChannels: entry.notifyChannels,
              })) || undefined,
        }
      : null

  const externalActions =
    state.externalActions &&
    (state.externalActions.notifyChannels.length > 0 ||
      state.externalActions.webhookUrl ||
      Object.keys(state.externalActions.webhookHeaders).length > 0 ||
      state.externalActions.includeContext)
      ? {
          notifyChannels: state.externalActions.notifyChannels,
          webhookUrl: state.externalActions.webhookUrl || undefined,
          webhookHeaders:
            Object.keys(state.externalActions.webhookHeaders).length > 0
              ? state.externalActions.webhookHeaders
              : undefined,
          includeContext: Boolean(state.externalActions.includeContext),
        }
      : null

  const metadata =
    state.metadata && Object.keys(state.metadata).length > 0 ? state.metadata : undefined

  const result: HumanStageConfig & { outputPath?: string } = {
    instructions: state.instructions.trim() || undefined,
    formSchema: state.formSchema,
    assignment,
    approval,
    sla,
    externalActions,
    allowAttachments: Boolean(state.allowAttachments),
    metadata,
  }

  if (state.outputPath.trim()) {
    result.outputPath = state.outputPath.trim()
  }

  return result
}

function ensureCollaborationTeamsState(input?: any): CollaborationTeamState[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((team: any) => team && typeof team === 'object')
    .map((team: any, index: number) => {
      const generatedId = crypto.randomUUID()
      const members: CollaborationTeamMemberState[] = Array.isArray(team.members)
        ? team.members
            .filter((member: any) => member && typeof member === 'object')
            .map((member: any) => ({
              id: crypto.randomUUID(),
              agentId: typeof member.agentId === 'string' ? member.agentId : '',
              role:
                member.role === 'coordinator' ||
                member.role === 'validator' ||
                member.role === 'observer' ||
                member.role === 'executor'
                  ? member.role
                  : 'executor',
              weight:
                typeof member.weight === 'number'
                  ? member.weight
                  : member.weight && typeof member.weight === 'string'
                  ? Number(member.weight)
                  : 1,
              responsibilities: typeof member.responsibilities === 'string' ? member.responsibilities : '',
            }))
        : []

      return {
        id: team.id && typeof team.id === 'string' ? team.id : generatedId,
        teamKey:
          typeof team.teamKey === 'string' && team.teamKey.trim()
            ? slugifyTeamKey(team.teamKey)
            : slugifyTeamKey(team.name || `team_${index + 1}`),
        name:
          typeof team.name === 'string' && team.name.trim()
            ? team.name.trim()
            : `Time colaborativo ${index + 1}`,
        description: typeof team.description === 'string' ? team.description : '',
        strategy: (['round_robin', 'parallel_debate', 'majority_vote', 'consensus', 'coordinator_override'] as TeamStrategy[]).includes(
          team.strategy
        )
          ? team.strategy
          : 'round_robin',
        metadata: team.metadata && typeof team.metadata === 'object' ? team.metadata : {},
        members,
      }
    })
}

function serializeCollaborationTeams(teams: CollaborationTeamState[]): CollaborativeTeamConfig[] {
  return teams.map((team, index) => {
    const teamKey = team.teamKey.trim()
      ? slugifyTeamKey(team.teamKey)
      : slugifyTeamKey(team.name || `team_${index + 1}`)

    const sanitizedMembers = team.members
      .filter((member) => member.agentId.trim().length > 0)
      .map((member) => ({
        agentId: member.agentId.trim(),
        role: member.role,
        weight: member.weight ?? 1,
        responsibilities: member.responsibilities?.trim() || undefined,
      }))

    return {
      teamKey,
      name: team.name.trim() || `Equipe ${index + 1}`,
      description: team.description?.trim() || undefined,
      strategy: team.strategy,
      metadata: team.metadata && Object.keys(team.metadata).length > 0 ? team.metadata : undefined,
      members: sanitizedMembers,
    }
  })
}

function ensureSupervisorConfigsState(input?: any): SupervisorConfigState[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((config: any) => config && typeof config === 'object')
    .map((config: any) => {
      const validationRulesRaw = Array.isArray(config.validationRules) ? config.validationRules : []
      const conflictPolicyRaw = config.conflictPolicy && typeof config.conflictPolicy === 'object' ? config.conflictPolicy : null
      const appliesTo = config.appliesTo && typeof config.appliesTo === 'object' ? config.appliesTo : {}

      return {
        id: typeof config.id === 'string' ? config.id : crypto.randomUUID(),
        supervisorAgentId: typeof config.supervisorAgentId === 'string' ? config.supervisorAgentId : '',
        scope: (['pipeline', 'stage', 'team'] as SupervisorScope[]).includes(config.scope)
          ? (config.scope as SupervisorScope)
          : 'pipeline',
        stageKeys: Array.isArray(appliesTo.stageKeys)
          ? appliesTo.stageKeys.filter((value: any) => typeof value === 'string' && value.trim())
          : Array.isArray(config.stageKeys)
            ? config.stageKeys.filter((value: any) => typeof value === 'string' && value.trim())
            : [],
        teamKeys: Array.isArray(appliesTo.teamKeys)
          ? appliesTo.teamKeys.filter((value: any) => typeof value === 'string' && value.trim())
          : Array.isArray(config.teamKeys)
            ? config.teamKeys.filter((value: any) => typeof value === 'string' && value.trim())
            : [],
        decisionStyle: (['approve_reject', 'merge_summary', 'route_back', 'escalate_human'] as SupervisorDecisionStyle[]).includes(
          config.decisionStyle
        )
          ? (config.decisionStyle as SupervisorDecisionStyle)
          : 'approve_reject',
        validationRules: validationRulesRaw
          .filter((rule: any) => rule && typeof rule === 'object')
          .map((rule: any, index: number) => ({
            id: typeof rule.id === 'string' ? rule.id : `rule_${index + 1}_${crypto.randomUUID()}`,
            description: typeof rule.description === 'string' ? rule.description : '',
            severity:
              rule.severity === 'warning' || rule.severity === 'critical'
                ? rule.severity
                : 'info',
            expression: typeof rule.expression === 'string' ? rule.expression : '',
          })),
        conflictPolicy: conflictPolicyRaw
          ? {
              strategy:
                conflictPolicyRaw.strategy === 'rerun_team' ||
                conflictPolicyRaw.strategy === 'escalate_human' ||
                conflictPolicyRaw.strategy === 'fallback_pipeline'
                  ? conflictPolicyRaw.strategy
                  : 'auto_resolve',
              notify: Array.isArray(conflictPolicyRaw.notify)
                ? conflictPolicyRaw.notify.filter((value: any) => typeof value === 'string' && value.trim())
                : [],
              messageTemplate:
                typeof conflictPolicyRaw.messageTemplate === 'string' ? conflictPolicyRaw.messageTemplate : '',
            }
          : null,
        autoApproveThreshold:
          typeof config.autoApproveThreshold === 'number'
            ? config.autoApproveThreshold
            : config.autoApproveThreshold && typeof config.autoApproveThreshold === 'string'
            ? Number(config.autoApproveThreshold)
            : null,
        allowOverride: config.allowOverride !== undefined ? Boolean(config.allowOverride) : true,
        metadata: config.metadata && typeof config.metadata === 'object' ? config.metadata : {},
      }
    })
}

function serializeSupervisorConfigs(configs: SupervisorConfigState[]): SupervisorConfig[] {
  return configs
    .filter((config) => config.supervisorAgentId.trim().length > 0)
    .map((config) => {
      const stageKeys = config.stageKeys.filter(Boolean)
      const teamKeys = config.teamKeys.filter(Boolean)

      const serializedConflictPolicy = config.conflictPolicy
        ? {
            strategy: config.conflictPolicy.strategy,
            notify: config.conflictPolicy.notify.filter(Boolean),
            messageTemplate: config.conflictPolicy.messageTemplate?.trim() || undefined,
          }
        : undefined

      const serializedValidationRules = config.validationRules
        .filter((rule) => rule.description.trim().length > 0 || rule.expression.trim().length > 0)
        .map((rule) => ({
          id: rule.id,
          description: rule.description.trim(),
          severity: rule.severity,
          expression: rule.expression.trim(),
        }))

      const appliesTo =
        stageKeys.length > 0 || teamKeys.length > 0
          ? {
              stageKeys,
              teamKeys,
            }
          : undefined

      const metadata = config.metadata && Object.keys(config.metadata).length > 0 ? config.metadata : undefined

      return {
        supervisorAgentId: config.supervisorAgentId.trim(),
        scope: config.scope,
        decisionStyle: config.decisionStyle,
        autoApproveThreshold:
          typeof config.autoApproveThreshold === 'number' ? config.autoApproveThreshold : undefined,
        allowOverride: config.allowOverride,
        validationRules: serializedValidationRules,
        appliesTo,
        conflictPolicy: serializedConflictPolicy,
        metadata,
      }
    })
}

export default function WorkflowDesignerPage() {
  const { data, isLoading, error, mutate } = useSWR<BlueprintListResponse>(
    '/api/lab-ia/workflows/blueprints?limit=100',
    fetcher
  )
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string | null>(null)

  const blueprints = data?.blueprints ?? []

  useEffect(() => {
    if (!selectedBlueprintId && blueprints.length > 0) {
      setSelectedBlueprintId(blueprints[0].id)
    }
  }, [blueprints, selectedBlueprintId])

  const handleCreateBlueprint = useCallback(async () => {
    try {
      const name = `Workflow ${new Date().toLocaleString('pt-BR')}`
      const response = await fetch('/api/lab-ia/workflows/blueprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: 'Novo workflow visual' }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result?.error || 'Erro ao criar blueprint')
      await mutate()
      setSelectedBlueprintId(result.blueprint.id)
    } catch (err) {
      console.error(err)
      alert('Erro ao criar blueprint: ' + (err as Error).message)
    }
  }, [mutate])

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-10 space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Designer Visual de Workflows</h1>
            <p className="text-muted-foreground">
              Construa, visualize e publique workflows end-to-end com arrastar & soltar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => mutate()}>
              Atualizar
            </Button>
            <Button onClick={handleCreateBlueprint}>
              <Plus className="mr-2 h-4 w-4" /> Novo Blueprint
            </Button>
          </div>
        </header>

        <Separator />

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Blueprints</h2>
            {isLoading ? (
              <BlueprintSkeleton />
            ) : error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                Não foi possível carregar os blueprints.
              </div>
            ) : blueprints.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhum blueprint criado. Clique em "Novo Blueprint" para começar.
              </div>
            ) : (
              <ul className="space-y-2">
                {blueprints.map((bp) => (
                  <li key={bp.id}>
                    <button
                      onClick={() => setSelectedBlueprintId(bp.id)}
                      className={cn(
                        'w-full rounded-lg border px-3 py-2 text-left transition hover:border-primary',
                        selectedBlueprintId === bp.id && 'border-primary bg-primary/5'
                      )}
                    >
                      <p className="font-medium text-sm">{bp.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Atualizado em {new Date(bp.updated_at ?? bp.created_at ?? Date.now()).toLocaleString('pt-BR')}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(bp.tags || []).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            {selectedBlueprintId ? (
              <BlueprintEditor blueprintId={selectedBlueprintId} onRefetchList={mutate} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed p-12 text-sm text-muted-foreground">
                Selecione ou crie um blueprint para iniciar.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

type CollaborationTeamsSettingsProps = {
  teams: CollaborationTeamState[]
  onChange: (teams: CollaborationTeamState[]) => void
}

function CollaborationTeamsSettings({ teams, onChange }: CollaborationTeamsSettingsProps) {
  const [metadataDrafts, setMetadataDrafts] = useState<Record<string, string>>({})
  const [metadataErrors, setMetadataErrors] = useState<Record<string, string | null>>({})

  useEffect(() => {
    const drafts: Record<string, string> = {}
    teams.forEach((team) => {
      drafts[team.id] = JSON.stringify(team.metadata ?? {}, null, 2)
    })
    setMetadataDrafts(drafts)
    setMetadataErrors({})
  }, [teams])

  const updateTeam = (teamId: string, updater: (team: CollaborationTeamState) => CollaborationTeamState) => {
    onChange(teams.map((team) => (team.id === teamId ? updater(team) : team)))
  }

  const updateMember = (
    teamId: string,
    memberId: string,
    updater: (member: CollaborationTeamMemberState) => CollaborationTeamMemberState
  ) => {
    updateTeam(teamId, (team) => ({
      ...team,
      members: team.members.map((member) => (member.id === memberId ? updater(member) : member)),
    }))
  }

  const addTeam = () => {
    const newTeam: CollaborationTeamState = {
      id: crypto.randomUUID(),
      teamKey: slugifyTeamKey(`team_${teams.length + 1}`),
      name: `Equipe colaborativa ${teams.length + 1}`,
      description: '',
      strategy: 'round_robin',
      metadata: {},
      members: [],
    }
    onChange([...teams, newTeam])
  }

  const removeTeam = (teamId: string) => {
    onChange(teams.filter((team) => team.id !== teamId))
  }

  const addMember = (teamId: string, role: CollaborationTeamMemberState['role'] = 'executor') => {
    updateTeam(teamId, (team) => ({
      ...team,
      members: [
        ...team.members,
        {
          id: crypto.randomUUID(),
          agentId: '',
          role,
          weight: 1,
          responsibilities: '',
        },
      ],
    }))
  }

  const removeMember = (teamId: string, memberId: string) => {
    updateTeam(teamId, (team) => ({
      ...team,
      members: team.members.filter((member) => member.id !== memberId),
    }))
  }

  const handleMetadataBlur = (teamId: string) => {
    const draft = metadataDrafts[teamId] ?? '{}'
    try {
      const parsed = draft.trim().length > 0 ? JSON.parse(draft) : {}
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        setMetadataErrors((prev) => ({ ...prev, [teamId]: null }))
        updateTeam(teamId, (team) => ({
          ...team,
          metadata: parsed,
        }))
      } else {
        throw new Error('Metadata precisa ser um objeto JSON')
      }
    } catch {
      setMetadataErrors((prev) => ({
        ...prev,
        [teamId]: 'JSON inválido. Forneça um objeto (ex.: { "prioridade": "alta" }).',
      }))
    }
  }

  const strategies: { value: TeamStrategy; label: string }[] = [
    { value: 'round_robin', label: 'Rodízio sequencial' },
    { value: 'parallel_debate', label: 'Debate paralelo' },
    { value: 'majority_vote', label: 'Votação por maioria' },
    { value: 'consensus', label: 'Consenso unânime' },
    { value: 'coordinator_override', label: 'Coordenador decide' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Times colaborativos</h4>
          <p className="text-xs text-muted-foreground">
            Defina como agentes irão colaborar (debate, votação, supervisão) em etapas do workflow.
          </p>
        </div>
        <Button type="button" size="sm" onClick={addTeam}>
          + Nova equipe
        </Button>
      </div>

      {teams.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhum time configurado ainda. Crie uma equipe para orquestrar agentes colaborativos.
        </div>
      ) : (
        <div className="space-y-4">
          {teams.map((team) => (
            <div key={team.id} className="space-y-4 rounded-lg border p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="grid gap-3 md:grid-cols-2 md:flex-1">
                  <div className="space-y-2">
                    <Label htmlFor={`team-name-${team.id}`}>Nome</Label>
                    <Input
                      id={`team-name-${team.id}`}
                      value={team.name}
                      onChange={(event) =>
                        updateTeam(team.id, (current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`team-key-${team.id}`}>Identificador</Label>
                    <Input
                      id={`team-key-${team.id}`}
                      value={team.teamKey}
                      onChange={(event) =>
                        updateTeam(team.id, (current) => ({
                          ...current,
                          teamKey: slugifyTeamKey(event.target.value, current.teamKey || 'team'),
                        }))
                      }
                      placeholder="ex.: equipe_triagem"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use para referenciar a equipe nas etapas (ex.: `teamKey` nos pipelines).
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Estratégia</Label>
                    <Select
                      value={team.strategy}
                      onValueChange={(value) =>
                        updateTeam(team.id, (current) => ({
                          ...current,
                          strategy: value as TeamStrategy,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {strategies.map((strategy) => (
                          <SelectItem key={strategy.value} value={strategy.value}>
                            {strategy.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`team-description-${team.id}`}>Descrição</Label>
                    <Textarea
                      id={`team-description-${team.id}`}
                      value={team.description}
                      onChange={(event) =>
                        updateTeam(team.id, (current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      rows={2}
                      placeholder="Função do time no workflow"
                    />
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeTeam(team.id)}>
                  Remover
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Membros</Label>
                {team.members.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    Nenhum membro. Adicione agentes e defina papéis (coordenador, executor, validador).
                  </div>
                ) : (
                  <div className="space-y-3">
                    {team.members.map((member) => (
                      <div key={member.id} className="rounded-md border border-muted/40 p-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="grid gap-3 md:grid-cols-4 md:flex-1">
                            <div className="space-y-2 md:col-span-2">
                              <Label>Agente (ID)</Label>
                              <Input
                                value={member.agentId}
                                onChange={(event) =>
                                  updateMember(team.id, member.id, (current) => ({
                                    ...current,
                                    agentId: event.target.value,
                                  }))
                                }
                                placeholder="UUID do agente cadastrado"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Papel</Label>
                              <Select
                                value={member.role}
                                onValueChange={(value) =>
                                  updateMember(team.id, member.id, (current) => ({
                                    ...current,
                                    role: value as CollaborationTeamMemberState['role'],
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="coordinator">Coordenador</SelectItem>
                                  <SelectItem value="executor">Executor</SelectItem>
                                  <SelectItem value="validator">Validador</SelectItem>
                                  <SelectItem value="observer">Observador</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Peso</Label>
                              <Input
                                type="number"
                                min={0}
                                step={0.1}
                                value={member.weight}
                                onChange={(event) =>
                                  updateMember(team.id, member.id, (current) => ({
                                    ...current,
                                    weight: Number(event.target.value),
                                  }))
                                }
                              />
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => removeMember(team.id, member.id)}>
                            Remover
                          </Button>
                        </div>
                        <div className="mt-3">
                          <Label>Responsabilidades</Label>
                          <Textarea
                            value={member.responsibilities}
                            onChange={(event) =>
                              updateMember(team.id, member.id, (current) => ({
                                ...current,
                                responsibilities: event.target.value,
                              }))
                            }
                            rows={2}
                            placeholder="Descreva o que este agente deve avaliar/produzir"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => addMember(team.id, 'executor')}>
                    + Executor
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => addMember(team.id, 'validator')}>
                    + Validador
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => addMember(team.id, 'coordinator')}>
                    + Coordenador
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => addMember(team.id, 'observer')}>
                    + Observador
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Metadados (JSON)</Label>
                <Textarea
                  className="font-mono text-xs"
                  rows={4}
                  value={metadataDrafts[team.id] ?? '{}'}
                  onChange={(event) =>
                    setMetadataDrafts((prev) => ({
                      ...prev,
                      [team.id]: event.target.value,
                    }))
                  }
                  onBlur={() => handleMetadataBlur(team.id)}
                />
                {metadataErrors[team.id] && <p className="text-xs text-destructive">{metadataErrors[team.id]}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type SupervisorSettingsProps = {
  supervisors: SupervisorConfigState[]
  onChange: (configs: SupervisorConfigState[]) => void
}

function SupervisorSettings({ supervisors, onChange }: SupervisorSettingsProps) {
  const [metadataDrafts, setMetadataDrafts] = useState<Record<string, string>>({})
  const [metadataErrors, setMetadataErrors] = useState<Record<string, string | null>>({})

  useEffect(() => {
    const drafts: Record<string, string> = {}
    supervisors.forEach((config) => {
      drafts[config.id] = JSON.stringify(config.metadata ?? {}, null, 2)
    })
    setMetadataDrafts(drafts)
    setMetadataErrors({})
  }, [supervisors])

  const updateSupervisor = (configId: string, updater: (config: SupervisorConfigState) => SupervisorConfigState) => {
    onChange(supervisors.map((config) => (config.id === configId ? updater(config) : config)))
  }

  const addSupervisor = () => {
    const newSupervisor: SupervisorConfigState = {
      id: crypto.randomUUID(),
      supervisorAgentId: '',
      scope: 'pipeline',
      stageKeys: [],
      teamKeys: [],
      decisionStyle: 'approve_reject',
      validationRules: [],
      conflictPolicy: {
        strategy: 'auto_resolve',
        notify: [],
        messageTemplate: '',
      },
      autoApproveThreshold: null,
      allowOverride: true,
      metadata: {},
    }
    onChange([...supervisors, newSupervisor])
  }

  const removeSupervisor = (configId: string) => {
    onChange(supervisors.filter((config) => config.id !== configId))
  }

  const handleMetadataBlur = (configId: string) => {
    const draft = metadataDrafts[configId] ?? '{}'
    try {
      const parsed = draft.trim().length > 0 ? JSON.parse(draft) : {}
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        setMetadataErrors((prev) => ({ ...prev, [configId]: null }))
        updateSupervisor(configId, (config) => ({
          ...config,
          metadata: parsed,
        }))
      } else {
        throw new Error('Metadata precisa ser um objeto JSON')
      }
    } catch (error) {
      setMetadataErrors((prev) => ({
        ...prev,
        [configId]: 'JSON inválido. Forneça um objeto (ex.: { "limite": 0.8 }).',
      }))
    }
  }

  const addValidationRule = (configId: string) => {
    updateSupervisor(configId, (config) => ({
      ...config,
      validationRules: [
        ...config.validationRules,
        {
          id: crypto.randomUUID(),
          description: '',
          severity: 'info',
          expression: '',
        },
      ],
    }))
  }

  const updateValidationRule = (
    configId: string,
    ruleId: string,
    updater: (rule: SupervisorValidationRuleState) => SupervisorValidationRuleState
  ) => {
    updateSupervisor(configId, (config) => ({
      ...config,
      validationRules: config.validationRules.map((rule) => (rule.id === ruleId ? updater(rule) : rule)),
    }))
  }

  const removeValidationRule = (configId: string, ruleId: string) => {
    updateSupervisor(configId, (config) => ({
      ...config,
      validationRules: config.validationRules.filter((rule) => rule.id !== ruleId),
    }))
  }

  const strategies: { value: SupervisorDecisionStyle; label: string }[] = [
    { value: 'approve_reject', label: 'Aprovar / Rejeitar' },
    { value: 'merge_summary', label: 'Produzir resumo final' },
    { value: 'route_back', label: 'Reencaminhar para revisão' },
    { value: 'escalate_human', label: 'Escalonar para humano' },
  ]

  const scopes: { value: SupervisorScope; label: string }[] = [
    { value: 'pipeline', label: 'Pipeline inteiro' },
    { value: 'stage', label: 'Etapas específicas' },
    { value: 'team', label: 'Times colaborativos' },
  ]

  const conflictStrategies: Array<{ value: SupervisorConflictPolicyState['strategy']; label: string }> = [
    { value: 'auto_resolve', label: 'Resolver automaticamente' },
    { value: 'rerun_team', label: 'Reexecutar time' },
    { value: 'escalate_human', label: 'Escalonar para humano' },
    { value: 'fallback_pipeline', label: 'Executar pipeline fallback' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Supervisores</h4>
          <p className="text-xs text-muted-foreground">
            Defina agentes supervisores responsáveis por validar resultados, consolidar decisões e resolver conflitos.
          </p>
        </div>
        <Button type="button" size="sm" onClick={addSupervisor}>
          + Novo supervisor
        </Button>
      </div>

      {supervisors.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhum supervisor configurado. Adicione um agente para coordenar revisões e aprovações.
        </div>
      ) : (
        <div className="space-y-4">
          {supervisors.map((config) => (
            <div key={config.id} className="space-y-4 rounded-lg border p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="grid gap-3 md:grid-cols-3 md:flex-1">
                  <div className="space-y-2">
                    <Label htmlFor={`supervisor-agent-${config.id}`}>Agente supervisor (ID)</Label>
                    <Input
                      id={`supervisor-agent-${config.id}`}
                      value={config.supervisorAgentId}
                      onChange={(event) =>
                        updateSupervisor(config.id, (current) => ({
                          ...current,
                          supervisorAgentId: event.target.value,
                        }))
                      }
                      placeholder="UUID do agente supervisor"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Escopo</Label>
                    <Select
                      value={config.scope}
                      onValueChange={(value) =>
                        updateSupervisor(config.id, (current) => ({
                          ...current,
                          scope: value as SupervisorScope,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {scopes.map((scope) => (
                          <SelectItem key={scope.value} value={scope.value}>
                            {scope.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Estilo de decisão</Label>
                    <Select
                      value={config.decisionStyle}
                      onValueChange={(value) =>
                        updateSupervisor(config.id, (current) => ({
                          ...current,
                          decisionStyle: value as SupervisorDecisionStyle,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {strategies.map((strategy) => (
                          <SelectItem key={strategy.value} value={strategy.value}>
                            {strategy.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeSupervisor(config.id)}>
                  Remover
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Estágios monitorados</Label>
                  <Input
                    value={config.stageKeys.join(', ')}
                    onChange={(event) =>
                      updateSupervisor(config.id, (current) => ({
                        ...current,
                        stageKeys: event.target.value
                          .split(',')
                          .map((value) => value.trim())
                          .filter(Boolean),
                      }))
                    }
                    placeholder="stage_triagem, stage_validacao"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Deixe vazio para aplicar ao pipeline inteiro ou selecione times específicos.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Times monitorados</Label>
                  <Input
                    value={config.teamKeys.join(', ')}
                    onChange={(event) =>
                      updateSupervisor(config.id, (current) => ({
                        ...current,
                        teamKeys: event.target.value
                          .split(',')
                          .map((value) => value.trim())
                          .filter(Boolean),
                      }))
                    }
                    placeholder="time_triagem, time_redacao"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[180px_1fr_160px]">
                <div className="space-y-2">
                  <Label htmlFor={`auto-threshold-${config.id}`}>Limite auto-aprovação (%)</Label>
                  <Input
                    id={`auto-threshold-${config.id}`}
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={config.autoApproveThreshold ?? ''}
                    onChange={(event) =>
                      updateSupervisor(config.id, (current) => ({
                        ...current,
                        autoApproveThreshold: event.target.value ? Number(event.target.value) : null,
                      }))
                    }
                    placeholder="Ex.: 85"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`conflict-strategy-${config.id}`}>Conflitos</Label>
                  <Select
                    value={config.conflictPolicy?.strategy ?? 'auto_resolve'}
                    onValueChange={(value) =>
                      updateSupervisor(config.id, (current) => ({
                        ...current,
                        conflictPolicy: {
                          strategy: value as SupervisorConflictPolicyState['strategy'],
                          notify: current.conflictPolicy?.notify ?? [],
                          messageTemplate: current.conflictPolicy?.messageTemplate ?? '',
                        },
                      }))
                    }
                  >
                    <SelectTrigger id={`conflict-strategy-${config.id}`}>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {conflictStrategies.map((strategy) => (
                        <SelectItem key={strategy.value} value={strategy.value}>
                          {strategy.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`conflict-notify-${config.id}`}>Notificar</Label>
                  <Input
                    id={`conflict-notify-${config.id}`}
                    value={(config.conflictPolicy?.notify ?? []).join(', ')}
                    onChange={(event) =>
                      updateSupervisor(config.id, (current) => ({
                        ...current,
                        conflictPolicy: {
                          strategy: current.conflictPolicy?.strategy ?? 'auto_resolve',
                          notify: event.target.value
                            .split(',')
                            .map((value) => value.trim())
                            .filter(Boolean),
                          messageTemplate: current.conflictPolicy?.messageTemplate ?? '',
                        },
                      }))
                    }
                    placeholder="email, slack, webhook"
                  />
                  <p className="text-[11px] text-muted-foreground">Separe múltiplos canais por vírgula.</p>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Regras de validação</Label>
                {config.validationRules.length === 0 ? (
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    Nenhuma regra definida. Adicione verificações para garantir qualidade antes de aprovar.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {config.validationRules.map((rule) => (
                      <div key={rule.id} className="rounded-md border border-muted/40 p-3 text-sm">
                        <div className="grid gap-3 md:grid-cols-[1fr_160px]">
                          <div className="space-y-2">
                            <Label htmlFor={`rule-desc-${rule.id}`}>Descrição</Label>
                            <Input
                              id={`rule-desc-${rule.id}`}
                              value={rule.description}
                              onChange={(event) =>
                                updateValidationRule(config.id, rule.id, (current) => ({
                                  ...current,
                                  description: event.target.value,
                                }))
                              }
                              placeholder="Ex.: Garantir linguagem formal e sem termos proibidos"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Severidade</Label>
                            <Select
                              value={rule.severity}
                              onValueChange={(value) =>
                                updateValidationRule(config.id, rule.id, (current) => ({
                                  ...current,
                                  severity: value as SupervisorValidationRuleState['severity'],
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="info">Informativo</SelectItem>
                                <SelectItem value="warning">Alerta</SelectItem>
                                <SelectItem value="critical">Crítico</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="mt-2 space-y-2">
                          <Label htmlFor={`rule-expression-${rule.id}`}>Expressão / Condição</Label>
                          <Textarea
                            id={`rule-expression-${rule.id}`}
                            value={rule.expression}
                            onChange={(event) =>
                              updateValidationRule(config.id, rule.id, (current) => ({
                                ...current,
                                expression: event.target.value,
                              }))
                            }
                            rows={2}
                            placeholder="Ex.: context.score >= 0.85 && output.includes('Diagnóstico')"
                          />
                        </div>
                        <div className="mt-2 flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => removeValidationRule(config.id, rule.id)}
                          >
                            Remover
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button type="button" size="sm" variant="outline" onClick={() => addValidationRule(config.id)}>
                  + Regra de validação
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`conflict-message-${config.id}`}>Mensagem de conflito</Label>
                <Textarea
                  id={`conflict-message-${config.id}`}
                  className="text-xs"
                  rows={3}
                  value={config.conflictPolicy?.messageTemplate ?? ''}
                  onChange={(event) =>
                    updateSupervisor(config.id, (current) => ({
                      ...current,
                      conflictPolicy: {
                        strategy: current.conflictPolicy?.strategy ?? 'auto_resolve',
                        notify: current.conflictPolicy?.notify ?? [],
                        messageTemplate: event.target.value,
                      },
                    }))
                  }
                  placeholder="Mensagem enviada ao time/humano quando o supervisor identificar conflito."
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id={`allow-override-${config.id}`}
                  checked={config.allowOverride}
                  onCheckedChange={(checked) =>
                    updateSupervisor(config.id, (current) => ({
                      ...current,
                      allowOverride: checked,
                    }))
                  }
                />
                <Label htmlFor={`allow-override-${config.id}`}>Permitir override manual</Label>
              </div>

              <div className="space-y-2">
                <Label>Metadados (JSON)</Label>
                <Textarea
                  className="font-mono text-xs"
                  rows={4}
                  value={metadataDrafts[config.id] ?? '{}'}
                  onChange={(event) =>
                    setMetadataDrafts((prev) => ({
                      ...prev,
                      [config.id]: event.target.value,
                    }))
                  }
                  onBlur={() => handleMetadataBlur(config.id)}
                />
                {metadataErrors[config.id] && <p className="text-xs text-destructive">{metadataErrors[config.id]}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BlueprintSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-16 rounded-lg border bg-muted/40" />
      ))}
    </div>
  )
}

function createDefaultAssignmentState(
  mode: typeof HUMAN_ASSIGNMENT_MODES[number] = 'role'
): NonNullable<HumanStageConfigState['assignment']> {
  return {
    mode,
    users: [],
    roles: [],
    groups: [],
    dynamicPath: '',
    allowSelfAssign: false,
    fallback: null,
  }
}

type HumanStageConfigFormProps = {
  value?: HumanStageConfig | null
  onChange: (config: HumanStageConfig & { outputPath?: string }) => void
}

function HumanStageConfigForm({ value, onChange }: HumanStageConfigFormProps) {
  const [state, setState] = useState<HumanStageConfigState>(() => ensureHumanConfigState(value))
  const [formSchemaText, setFormSchemaText] = useState(() => JSON.stringify(state.formSchema, null, 2))
  const [formSchemaError, setFormSchemaError] = useState<string | null>(null)
  const [metadataText, setMetadataText] = useState(() => JSON.stringify(state.metadata, null, 2))
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const [webhookHeadersText, setWebhookHeadersText] = useState(() =>
    JSON.stringify(state.externalActions?.webhookHeaders ?? {}, null, 2)
  )
  const [webhookHeadersError, setWebhookHeadersError] = useState<string | null>(null)
  const lastEmittedRef = useRef<string>('')

  useEffect(() => {
    const nextState = ensureHumanConfigState(value)
    setState(nextState)
    setFormSchemaText(JSON.stringify(nextState.formSchema, null, 2))
    setFormSchemaError(null)
    setMetadataText(JSON.stringify(nextState.metadata ?? {}, null, 2))
    setMetadataError(null)
    setWebhookHeadersText(JSON.stringify(nextState.externalActions?.webhookHeaders ?? {}, null, 2))
    setWebhookHeadersError(null)
    lastEmittedRef.current = JSON.stringify(sanitizeHumanConfigForSave(nextState))
  }, [value])

  useEffect(() => {
    const payload = sanitizeHumanConfigForSave(state)
    const serialized = JSON.stringify(payload)
    if (serialized !== lastEmittedRef.current) {
      lastEmittedRef.current = serialized
      onChange(payload)
    }
  }, [state, onChange])

  const currentAssignment = state.assignment ?? createDefaultAssignmentState()

  const updateAssignment = (updater: (assignment: NonNullable<HumanStageConfigState['assignment']>) => NonNullable<HumanStageConfigState['assignment']>) => {
    setState((prev) => {
      const assignmentState = updater(prev.assignment ?? createDefaultAssignmentState())
      return { ...prev, assignment: assignmentState }
    })
  }

  const updateApproval = (updater: (approval: NonNullable<HumanStageConfigState['approval']>) => NonNullable<HumanStageConfigState['approval']>) => {
    setState((prev) => {
      const approvalState = updater(
        prev.approval ?? {
          type: 'single',
          requiredApprovals: null,
          allowRejectionComments: false,
          allowDelegation: false,
          autoApproveAfterMinutes: null,
          autoRejectAfterMinutes: null,
        }
      )
      return { ...prev, approval: approvalState }
    })
  }

  const updateSla = (updater: (sla: HumanStageConfigState['sla']) => HumanStageConfigState['sla']) => {
    setState((prev) => ({ ...prev, sla: updater(prev.sla) }))
  }

  const updateExternalActions = (
    updater: (actions: NonNullable<HumanStageConfigState['externalActions']>) => NonNullable<HumanStageConfigState['externalActions']>
  ) => {
    setState((prev) => ({
      ...prev,
      externalActions: updater(
        prev.externalActions ?? {
          notifyChannels: [],
          webhookUrl: '',
          webhookHeaders: {},
          includeContext: false,
        }
      ),
    }))
  }

  const handleFormSchemaBlur = () => {
    try {
      const parsed = formSchemaText.trim().length > 0 ? JSON.parse(formSchemaText) : {}
      setFormSchemaError(null)
      setState((prev) => ({ ...prev, formSchema: parsed }))
    } catch {
      setFormSchemaError('JSON inválido. Verifique o formato antes de salvar.')
    }
  }

  const handleMetadataBlur = () => {
    try {
      const parsed = metadataText.trim().length > 0 ? JSON.parse(metadataText) : {}
      setMetadataError(null)
      setState((prev) => ({ ...prev, metadata: parsed }))
    } catch {
      setMetadataError('JSON inválido. Utilize um objeto válido.')
    }
  }

  const handleWebhookHeadersBlur = () => {
    try {
      const parsed =
        webhookHeadersText.trim().length > 0 ? JSON.parse(webhookHeadersText) : {}
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        setWebhookHeadersError(null)
        updateExternalActions((actions) => ({
          ...actions,
          webhookHeaders: parsed,
        }))
      } else {
        throw new Error('Headers devem ser um objeto JSON')
      }
    } catch {
      setWebhookHeadersError('JSON inválido. Forneça um objeto { "Header": "Valor" }.')
    }
  }

  const toggleChannel = (channel: typeof HUMAN_CHANNEL_OPTIONS[number]) => {
    updateExternalActions((actions) => {
      const exists = actions.notifyChannels.includes(channel)
      return {
        ...actions,
        notifyChannels: exists
          ? actions.notifyChannels.filter((value) => value !== channel)
          : [...actions.notifyChannels, channel],
      }
    })
  }

  const handleAddEscalationRow = () => {
    updateSla((sla) => ({
      ...sla,
      escalationChain: [
        ...sla.escalationChain,
        {
          id: crypto.randomUUID(),
          mode: 'role',
          targetId: '',
          afterMinutes: 15,
          notifyChannels: ['email'],
        },
      ],
    }))
  }

  const handleUpdateEscalationRow = (
    rowId: string,
    updates: Partial<HumanStageConfigState['sla']['escalationChain'][number]>
  ) => {
    updateSla((sla) => ({
      ...sla,
      escalationChain: sla.escalationChain.map((row) =>
        row.id === rowId ? { ...row, ...updates } : row
      ),
    }))
  }

  const handleRemoveEscalationRow = (rowId: string) => {
    updateSla((sla) => ({
      ...sla,
      escalationChain: sla.escalationChain.filter((row) => row.id !== rowId),
    }))
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="human-instructions">Instruções para o responsável</Label>
        <Textarea
          id="human-instructions"
          rows={3}
          value={state.instructions}
          onChange={(event) => setState((prev) => ({ ...prev, instructions: event.target.value }))}
          placeholder="Descreva a ação esperada, detalhes clínicos, anexos necessários, etc."
        />
      </div>

      <div className="space-y-2">
        <Label>Responsável</Label>
        <div className="grid gap-2 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label className="text-xs uppercase text-muted-foreground">Modo</Label>
            <Select
              value={currentAssignment.mode}
              onValueChange={(mode) =>
                updateAssignment((assignment) => ({
                  ...createDefaultAssignmentState(mode as typeof HUMAN_ASSIGNMENT_MODES[number]),
                  allowSelfAssign: assignment.allowSelfAssign,
                  fallback: assignment.fallback,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Usuario específico</SelectItem>
                <SelectItem value="role">Perfil / função</SelectItem>
                <SelectItem value="group">Grupo</SelectItem>
                <SelectItem value="dynamic">Dinâmico via contexto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 flex items-center gap-2">
            <Switch
              id="allow-self-assign"
              checked={currentAssignment.allowSelfAssign}
              onCheckedChange={(checked) =>
                updateAssignment((assignment) => ({
                  ...assignment,
                  allowSelfAssign: checked,
                }))
              }
            />
            <Label htmlFor="allow-self-assign">Permitir auto-atribuição</Label>
          </div>
        </div>

        {currentAssignment.mode === 'user' && (
          <Input
            value={currentAssignment.users.join(', ')}
            onChange={(event) =>
              updateAssignment((assignment) => ({
                ...assignment,
                users: event.target.value
                  .split(',')
                  .map((value) => value.trim())
                  .filter(Boolean),
              }))
            }
            placeholder="Usuários (UUID) separados por vírgula"
          />
        )}

        {currentAssignment.mode === 'role' && (
          <Input
            value={currentAssignment.roles.join(', ')}
            onChange={(event) =>
              updateAssignment((assignment) => ({
                ...assignment,
                roles: event.target.value
                  .split(',')
                  .map((value) => value.trim())
                  .filter(Boolean),
              }))
            }
            placeholder="Funções (ex.: 'enfermeiro', 'gestor') separadas por vírgula"
          />
        )}

        {currentAssignment.mode === 'group' && (
          <Input
            value={currentAssignment.groups.join(', ')}
            onChange={(event) =>
              updateAssignment((assignment) => ({
                ...assignment,
                groups: event.target.value
                  .split(',')
                  .map((value) => value.trim())
                  .filter(Boolean),
              }))
            }
            placeholder="Grupos separados por vírgula"
          />
        )}

        {currentAssignment.mode === 'dynamic' && (
          <Input
            value={currentAssignment.dynamicPath}
            onChange={(event) =>
              updateAssignment((assignment) => ({
                ...assignment,
                dynamicPath: event.target.value,
              }))
            }
            placeholder="Caminho no contexto (ex.: context.medicoResponsavel.id)"
          />
        )}

        <div className="mt-3 space-y-2 rounded-md border border-dashed border-muted-foreground/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Fallback</span>
            <Switch
              checked={Boolean(currentAssignment.fallback)}
              onCheckedChange={(checked) =>
                updateAssignment((assignment) => ({
                  ...assignment,
                  fallback: checked ? createDefaultAssignmentState('role') : null,
                }))
              }
            />
          </div>
          {currentAssignment.fallback && (
            <div className="space-y-2">
              <Select
                value={currentAssignment.fallback.mode}
                onValueChange={(mode) =>
                  updateAssignment((assignment) => ({
                    ...assignment,
                    fallback: {
                      mode: mode as typeof HUMAN_ASSIGNMENT_MODES[number],
                      targetIds: [],
                      dynamicPath: '',
                    },
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Modo de fallback" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário específico</SelectItem>
                  <SelectItem value="role">Função</SelectItem>
                  <SelectItem value="group">Grupo</SelectItem>
                  <SelectItem value="dynamic">Dinâmico</SelectItem>
                </SelectContent>
              </Select>

              {currentAssignment.fallback.mode === 'dynamic' ? (
                <Input
                  value={currentAssignment.fallback.dynamicPath}
                  onChange={(event) =>
                    updateAssignment((assignment) => ({
                      ...assignment,
                      fallback: assignment.fallback
                        ? { ...assignment.fallback, dynamicPath: event.target.value }
                        : null,
                    }))
                  }
                  placeholder="contexto para fallback (ex.: context.gestor.id)"
                />
              ) : (
                <Input
                  value={currentAssignment.fallback.targetIds.join(', ')}
                  onChange={(event) =>
                    updateAssignment((assignment) => ({
                      ...assignment,
                      fallback: assignment.fallback
                        ? {
                            ...assignment.fallback,
                            targetIds: event.target.value
                              .split(',')
                              .map((value) => value.trim())
                              .filter(Boolean),
                          }
                        : null,
                    }))
                  }
                  placeholder="IDs para fallback separados por vírgula"
                />
              )}
            </div>
          )}
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label>Fluxo de aprovação</Label>
        <Select
          value={state.approval?.type ?? 'single'}
          onValueChange={(type) =>
            updateApproval((approval) => ({
              ...approval,
              type: type as 'single' | 'majority' | 'unanimous',
            }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single">Aprovação simples (1 pessoa)</SelectItem>
            <SelectItem value="majority">Maioria</SelectItem>
            <SelectItem value="unanimous">Unânime</SelectItem>
          </SelectContent>
        </Select>

        {state.approval?.type === 'majority' && (
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <Label htmlFor="required-approvals">Qtd. mínima de aprovações</Label>
              <Input
                id="required-approvals"
                type="number"
                min={1}
                value={state.approval?.requiredApprovals ?? ''}
                onChange={(event) =>
                  updateApproval((approval) => ({
                    ...approval,
                    requiredApprovals: event.target.value ? Number(event.target.value) : null,
                  }))
                }
              />
            </div>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex items-center gap-2">
            <Switch
              id="allow-rejection-comments"
              checked={Boolean(state.approval?.allowRejectionComments)}
              onCheckedChange={(checked) =>
                updateApproval((approval) => ({
                  ...approval,
                  allowRejectionComments: checked,
                }))
              }
            />
            <Label htmlFor="allow-rejection-comments">Permitir comentários ao rejeitar</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="allow-delegation"
              checked={Boolean(state.approval?.allowDelegation)}
              onCheckedChange={(checked) =>
                updateApproval((approval) => ({
                  ...approval,
                  allowDelegation: checked,
                }))
              }
            />
            <Label htmlFor="allow-delegation">Permitir delegação</Label>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="auto-approve-after">Auto-aprovar após (min)</Label>
            <Input
              id="auto-approve-after"
              type="number"
              min={1}
              value={state.approval?.autoApproveAfterMinutes ?? ''}
              onChange={(event) =>
                updateApproval((approval) => ({
                  ...approval,
                  autoApproveAfterMinutes: event.target.value ? Number(event.target.value) : null,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="auto-reject-after">Auto-rejeitar após (min)</Label>
            <Input
              id="auto-reject-after"
              type="number"
              min={1}
              value={state.approval?.autoRejectAfterMinutes ?? ''}
              onChange={(event) =>
                updateApproval((approval) => ({
                  ...approval,
                  autoRejectAfterMinutes: event.target.value ? Number(event.target.value) : null,
                }))
              }
            />
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>SLA e lembretes</Label>
          <Switch
            checked={state.sla.enabled}
            onCheckedChange={(checked) =>
              updateSla((sla) => ({
                ...sla,
                enabled: checked,
              }))
            }
          />
        </div>

        {state.sla.enabled && (
          <div className="space-y-3 rounded-md border border-primary/20 bg-primary/5 p-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label htmlFor="sla-duration">Prazo (min)</Label>
                <Input
                  id="sla-duration"
                  type="number"
                  min={1}
                  value={state.sla.durationMinutes ?? ''}
                  onChange={(event) =>
                    updateSla((sla) => ({
                      ...sla,
                      durationMinutes: event.target.value ? Number(event.target.value) : null,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="sla-reminder">Lembrete a cada (min)</Label>
                <Input
                  id="sla-reminder"
                  type="number"
                  min={1}
                  value={state.sla.reminderEveryMinutes ?? ''}
                  onChange={(event) =>
                    updateSla((sla) => ({
                      ...sla,
                      reminderEveryMinutes: event.target.value ? Number(event.target.value) : null,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="sla-max-reminders">Máx. lembretes</Label>
                <Input
                  id="sla-max-reminders"
                  type="number"
                  min={1}
                  value={state.sla.maxReminders ?? ''}
                  onChange={(event) =>
                    updateSla((sla) => ({
                      ...sla,
                      maxReminders: event.target.value ? Number(event.target.value) : null,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Escalonamento</span>
                <Button type="button" variant="outline" size="sm" onClick={handleAddEscalationRow}>
                  + Adicionar nível
                </Button>
              </div>

              {state.sla.escalationChain.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum escalonamento configurado. Adicione níveis para notificar outros responsáveis se o SLA expirar.
                </p>
              ) : (
                <div className="space-y-3">
                  {state.sla.escalationChain.map((row) => (
                    <div
                      key={row.id}
                      className="space-y-3 rounded-md border border-dashed border-primary/30 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <Select
                          value={row.mode}
                          onValueChange={(mode) =>
                            handleUpdateEscalationRow(row.id, {
                              mode: mode as typeof HUMAN_ASSIGNMENT_MODES[number],
                              targetId: '',
                              notifyChannels: ['email'],
                            })
                          }
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">Usuário específico</SelectItem>
                            <SelectItem value="role">Função</SelectItem>
                            <SelectItem value="group">Grupo</SelectItem>
                            <SelectItem value="dynamic">Dinâmico</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveEscalationRow(row.id)}
                        >
                          Remover
                        </Button>
                      </div>

                      <Input
                        value={row.targetId}
                        onChange={(event) =>
                          handleUpdateEscalationRow(row.id, { targetId: event.target.value })
                        }
                        placeholder={
                          row.mode === 'dynamic'
                            ? 'Path dinâmico (ex.: contexto.gestor.id)'
                            : 'IDs / funções / grupos separados por vírgula'
                        }
                      />

                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <Label htmlFor={`after-${row.id}`}>Escalonar após (min)</Label>
                          <Input
                            id={`after-${row.id}`}
                            type="number"
                            min={1}
                            value={row.afterMinutes}
                            onChange={(event) =>
                              handleUpdateEscalationRow(row.id, {
                                afterMinutes: event.target.value ? Number(event.target.value) : 0,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Notificar via</Label>
                          <div className="flex flex-wrap gap-2">
                            {HUMAN_CHANNEL_OPTIONS.map((channel) => {
                              const selected = row.notifyChannels.includes(channel)
                              return (
                                <Button
                                  key={channel}
                                  type="button"
                                  variant={selected ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => {
                                    const nextSelected = selected
                                      ? row.notifyChannels.filter((value) => value !== channel)
                                      : [...row.notifyChannels, channel]
                                    handleUpdateEscalationRow(row.id, { notifyChannels: nextSelected })
                                  }}
                                >
                                  {channel.toUpperCase()}
                                </Button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-3">
        <Label>Notificações externas</Label>
        <div className="flex flex-wrap gap-2">
          {HUMAN_CHANNEL_OPTIONS.map((channel) => {
            const selected = state.externalActions?.notifyChannels.includes(channel) ?? false
            return (
              <Button
                key={channel}
                type="button"
                size="sm"
                variant={selected ? 'default' : 'outline'}
                onClick={() => toggleChannel(channel)}
              >
                {channel.toUpperCase()}
              </Button>
            )
          })}
        </div>

        <Input
          value={state.externalActions?.webhookUrl ?? ''}
          onChange={(event) =>
            updateExternalActions((actions) => ({
              ...actions,
              webhookUrl: event.target.value,
            }))
          }
          placeholder="Webhook (opcional) para acionar serviços externos"
        />

        <div className="space-y-2">
          <Label htmlFor="webhook-headers">Headers do webhook (JSON)</Label>
          <Textarea
            id="webhook-headers"
            className="font-mono text-xs"
            rows={4}
            value={webhookHeadersText}
            onChange={(event) => setWebhookHeadersText(event.target.value)}
            onBlur={handleWebhookHeadersBlur}
          />
          {webhookHeadersError && <p className="text-xs text-destructive">{webhookHeadersError}</p>}
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="include-context"
            checked={Boolean(state.externalActions?.includeContext)}
            onCheckedChange={(checked) =>
              updateExternalActions((actions) => ({
                ...actions,
                includeContext: checked,
              }))
            }
          />
          <Label htmlFor="include-context">Incluir contexto completo no payload</Label>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label htmlFor="human-output-path">Salvar decisão em</Label>
        <Input
          id="human-output-path"
          value={state.outputPath}
          onChange={(event) => setState((prev) => ({ ...prev, outputPath: event.target.value }))}
          placeholder="Ex.: context.aprovacoes.triagem"
        />

        <div className="flex items-center gap-2">
          <Switch
            id="allow-attachments"
            checked={state.allowAttachments}
            onCheckedChange={(checked) => setState((prev) => ({ ...prev, allowAttachments: checked }))}
          />
          <Label htmlFor="allow-attachments">Permitir anexos (exames, fotos, PDFs)</Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="form-schema-text">Formulário (JSON Schema simplificado)</Label>
          <Textarea
            id="form-schema-text"
            className="font-mono text-xs"
            rows={8}
            value={formSchemaText}
            onChange={(event) => setFormSchemaText(event.target.value)}
            onBlur={handleFormSchemaBlur}
          />
          {formSchemaError && <p className="text-xs text-destructive">{formSchemaError}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="metadata-text">Metadados extras (JSON)</Label>
          <Textarea
            id="metadata-text"
            className="font-mono text-xs"
            rows={4}
            value={metadataText}
            onChange={(event) => setMetadataText(event.target.value)}
            onBlur={handleMetadataBlur}
          />
          {metadataError && <p className="text-xs text-destructive">{metadataError}</p>}
        </div>
      </div>
    </div>
  )
}

type GlobalSettingsState = {
  retryPolicy: {
    maxAttempts: number
    backoffStrategy: 'fixed' | 'exponential'
    baseDelayMs: number
  }
  variables: { key: string; type: 'string' | 'number' | 'boolean' | 'json'; description?: string }[]
  notifications: {
    channel: 'email' | 'sms' | 'whatsapp' | 'webhook'
    template: string
    trigger: 'workflow.started' | 'workflow.completed' | 'workflow.failed'
  }[]
  collaboration: {
    teams: CollaborationTeamState[]
  }
  supervisors: SupervisorConfigState[]
}

function getDefaultGlobalSettings(): GlobalSettingsState {
  return {
    retryPolicy: {
      maxAttempts: 3,
      backoffStrategy: 'exponential',
      baseDelayMs: 30_000,
    },
    variables: [],
    notifications: [],
    collaboration: {
      teams: [],
    },
    supervisors: [],
  }
}

type VersionHistoryItem = {
  id: string
  versionLabel: string
  createdAt: string
  isActive: boolean
  stageCount: number
  edgeCount: number
  notes?: string
  tags?: string[] | null
}

type SnapshotNode = {
  id: string
  position: { x: number; y: number }
  data: any
}

type SnapshotEdge = {
  id: string
  source: string
  target: string
  data?: {
    condition?: any
    fromKey?: string
    toKey?: string
  }
}

type VersionSnapshot = {
  version: {
    id: string
    label: string
    createdAt: string
    isActive: boolean
  }
  nodes: SnapshotNode[]
  edges: SnapshotEdge[]
  globalSettings: any
}

type StageSummary = {
  stageKey: string
  label: string
  stageType: string
}

type StageChange = StageSummary & {
  previousLabel: string
  previousType: string
  differences: string[]
}

type GlobalDiff = {
  changed: boolean
  retryPolicyChanged: boolean
  variablesAdded: string[]
  variablesRemoved: string[]
  variablesChanged: string[]
  notificationsAdded: number
  notificationsRemoved: number
  notificationsChanged: boolean
  collaborationTeamsAdded: string[]
  collaborationTeamsRemoved: string[]
  collaborationTeamsChanged: string[]
  supervisorsAdded: string[]
  supervisorsRemoved: string[]
  supervisorsChanged: string[]
}

type VersionDiff = {
  addedStages: StageSummary[]
  removedStages: StageSummary[]
  changedStages: StageChange[]
  addedEdges: string[]
  removedEdges: string[]
  globalChanges: GlobalDiff
  totalDifferences: number
}

function normalizeGlobalSettings(input: any): GlobalSettingsState {
  const defaults = getDefaultGlobalSettings()
  const retryPolicy = input?.retryPolicy || {}
  const variablesRaw = Array.isArray(input?.variables) ? input.variables : []
  const notificationsRaw = Array.isArray(input?.notifications) ? input.notifications : []
  const collaborationTeams = ensureCollaborationTeamsState(input?.collaboration?.teams)
  const supervisorsConfig = ensureSupervisorConfigsState(input?.supervisors)

  return {
    retryPolicy: {
      maxAttempts:
        Number(retryPolicy.maxAttempts) > 0 ? Number(retryPolicy.maxAttempts) : defaults.retryPolicy.maxAttempts,
      backoffStrategy: retryPolicy.backoffStrategy === 'fixed' ? 'fixed' : 'exponential',
      baseDelayMs:
        Number(retryPolicy.baseDelayMs) > 0 ? Number(retryPolicy.baseDelayMs) : defaults.retryPolicy.baseDelayMs,
    },
    variables: variablesRaw.map((variable: any, index: number) => ({
      key: typeof variable?.key === 'string' && variable.key.trim() ? variable.key.trim() : `variavel_${index + 1}`,
      type: ['string', 'number', 'boolean', 'json'].includes(variable?.type) ? variable.type : 'string',
      description: typeof variable?.description === 'string' ? variable.description : '',
    })),
    notifications: notificationsRaw.map((notification: any) => ({
      channel: ['email', 'sms', 'whatsapp', 'webhook'].includes(notification?.channel) ? notification.channel : 'email',
      trigger: ['workflow.started', 'workflow.completed', 'workflow.failed'].includes(notification?.trigger)
        ? notification.trigger
        : 'workflow.started',
      template: typeof notification?.template === 'string' ? notification.template : '',
    })),
    collaboration: {
      teams: collaborationTeams,
    },
    supervisors: supervisorsConfig,
  }
}

function deepEqual(a: any, b: any) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function normalizeNodeForDiff(data: any) {
  return {
    label: data?.label ?? '',
    stageType: data?.stageType ?? 'pipeline',
    stageConfig: data?.stageConfig ?? {},
    humanConfig: data?.humanConfig ?? {},
    stageConditions: data?.stageConditions ?? {},
    outputTransforms: data?.outputTransforms ?? [],
    validateOutput: Boolean(data?.validateOutput),
    notifications: Array.isArray(data?.notifications) ? data.notifications : [],
  }
}

function computeVersionDiff(
  snapshot: VersionSnapshot,
  currentNodes: Node[],
  currentEdges: Edge[],
  globalSettings: GlobalSettingsState
): VersionDiff {
  const currentStageMap = new Map<string, { summary: StageSummary; data: ReturnType<typeof normalizeNodeForDiff> }>()
  currentNodes.forEach((node) => {
    const data = normalizeNodeForDiff(node.data)
    const stageKey = node.data?.stageKey ?? node.id
    currentStageMap.set(stageKey, {
      summary: {
        stageKey,
        label: data.label || stageKey,
        stageType: data.stageType,
      },
      data,
    })
  })

  const snapshotStageMap = new Map<string, { summary: StageSummary; data: ReturnType<typeof normalizeNodeForDiff> }>()
  snapshot.nodes.forEach((node) => {
    const data = normalizeNodeForDiff(node.data)
    const stageKey = node.data?.stageKey ?? node.id
    snapshotStageMap.set(stageKey, {
      summary: {
        stageKey,
        label: data.label || stageKey,
        stageType: data.stageType,
      },
      data,
    })
  })

  const addedStages: StageSummary[] = []
  const removedStages: StageSummary[] = []
  const changedStages: StageChange[] = []

  currentStageMap.forEach((value, key) => {
    if (!snapshotStageMap.has(key)) {
      addedStages.push(value.summary)
    }
  })

  snapshotStageMap.forEach((value, key) => {
    if (!currentStageMap.has(key)) {
      removedStages.push(value.summary)
    } else {
      const current = currentStageMap.get(key)!
      const differences: string[] = []

      if (current.data.stageType !== value.data.stageType) {
        differences.push(`Tipo alterado: ${value.data.stageType} → ${current.data.stageType}`)
      }
      if (current.data.label !== value.data.label) {
        differences.push(`Nome alterado: "${value.data.label}" → "${current.data.label}"`)
      }
      if (!deepEqual(current.data.stageConfig, value.data.stageConfig)) {
        differences.push('Configuração da etapa modificada')
      }
      if (!deepEqual(current.data.humanConfig, value.data.humanConfig)) {
        differences.push('Configuração humana modificada')
      }
      if (!deepEqual(current.data.stageConditions, value.data.stageConditions)) {
        differences.push('Condições de entrada alteradas')
      }
      if (!deepEqual(current.data.outputTransforms, value.data.outputTransforms)) {
        differences.push('Transformações de saída alteradas')
      }
      if (current.data.validateOutput !== value.data.validateOutput) {
        differences.push('Validação de output alterada')
      }
      if (!deepEqual(current.data.notifications, value.data.notifications)) {
        differences.push('Notificações da etapa modificadas')
      }

      if (differences.length > 0) {
        changedStages.push({
          stageKey: key,
          label: current.summary.label,
          stageType: current.summary.stageType,
          previousLabel: value.summary.label,
          previousType: value.summary.stageType,
          differences,
        })
      }
    }
  })

  const currentEdgeSet = new Set<string>()
  const currentNodeKeyById = new Map<string, string>()
  currentNodes.forEach((node) => {
    currentNodeKeyById.set(node.id, node.data?.stageKey ?? node.id)
  })
  currentEdges.forEach((edge) => {
    const fromKey = currentNodeKeyById.get(edge.source) ?? edge.source
    const toKey = currentNodeKeyById.get(edge.target) ?? edge.target
    currentEdgeSet.add(`${fromKey}→${toKey}`)
  })

  const snapshotEdgeSet = new Set<string>()
  snapshot.edges.forEach((edge) => {
    const fromKey = edge.data?.fromKey || edge.source
    const toKey = edge.data?.toKey || edge.target
    snapshotEdgeSet.add(`${fromKey}→${toKey}`)
  })

  const addedEdges: string[] = []
  const removedEdges: string[] = []

  currentEdgeSet.forEach((edge) => {
    if (!snapshotEdgeSet.has(edge)) {
      addedEdges.push(edge)
    }
  })

  snapshotEdgeSet.forEach((edge) => {
    if (!currentEdgeSet.has(edge)) {
      removedEdges.push(edge)
    }
  })

  const snapshotGlobal = normalizeGlobalSettings(snapshot.globalSettings)
  const currentGlobal = globalSettings

  const globalChanges: GlobalDiff = {
    changed: false,
    retryPolicyChanged: !deepEqual(currentGlobal.retryPolicy, snapshotGlobal.retryPolicy),
    variablesAdded: [],
    variablesRemoved: [],
    variablesChanged: [],
    notificationsAdded: 0,
    notificationsRemoved: 0,
    notificationsChanged: false,
    collaborationTeamsAdded: [],
    collaborationTeamsRemoved: [],
    collaborationTeamsChanged: [],
    supervisorsAdded: [],
    supervisorsRemoved: [],
    supervisorsChanged: [],
  }

  const currentVariables = new Map(currentGlobal.variables.map((variable) => [variable.key, variable]))
  const snapshotVariables = new Map(snapshotGlobal.variables.map((variable) => [variable.key, variable]))

  currentVariables.forEach((variable, key) => {
    if (!snapshotVariables.has(key)) {
      globalChanges.variablesAdded.push(key)
    } else if (!deepEqual(variable, snapshotVariables.get(key))) {
      globalChanges.variablesChanged.push(key)
    }
  })

  snapshotVariables.forEach((_, key) => {
    if (!currentVariables.has(key)) {
      globalChanges.variablesRemoved.push(key)
    }
  })

  const currentNotifications = currentGlobal.notifications
  const snapshotNotifications = snapshotGlobal.notifications
  const currentNotificationSet = new Set(
    currentNotifications.map((notification) => `${notification.trigger}:${notification.channel}:${notification.template}`)
  )
  const snapshotNotificationSet = new Set(
    snapshotNotifications.map((notification: any) => `${notification.trigger}:${notification.channel}:${notification.template}`)
  )

  currentNotificationSet.forEach((notification) => {
    if (!snapshotNotificationSet.has(notification)) {
      globalChanges.notificationsAdded += 1
    }
  })

  snapshotNotificationSet.forEach((notification) => {
    if (!currentNotificationSet.has(notification)) {
      globalChanges.notificationsRemoved += 1
    }
  })

  if (
    snapshotNotifications.length === currentNotifications.length &&
    snapshotNotificationSet.size === currentNotificationSet.size &&
    !deepEqual(
      Array.from(snapshotNotificationSet).sort(),
      Array.from(currentNotificationSet).sort()
    )
  ) {
    globalChanges.notificationsChanged = true
  }

  const currentTeamsMap = new Map(
    (currentGlobal.collaboration?.teams ?? []).map((team) => [team.teamKey, team])
  )
  const snapshotTeamsMap = new Map(
    (snapshotGlobal.collaboration?.teams ?? []).map((team: any) => [team.teamKey, team])
  )

  currentTeamsMap.forEach((team, key) => {
    if (!snapshotTeamsMap.has(key)) {
      globalChanges.collaborationTeamsAdded.push(team.name || key)
    }
  })

  snapshotTeamsMap.forEach((team, key) => {
    if (!currentTeamsMap.has(key)) {
      globalChanges.collaborationTeamsRemoved.push(team.name || key)
    } else {
      const currentTeam = currentTeamsMap.get(key)!
      const snapshotTeam = snapshotTeamsMap.get(key)!
      if (
        currentTeam.name !== snapshotTeam.name ||
        currentTeam.strategy !== snapshotTeam.strategy ||
        !deepEqual(currentTeam.members, snapshotTeam.members) ||
        !deepEqual(currentTeam.metadata, snapshotTeam.metadata)
      ) {
        globalChanges.collaborationTeamsChanged.push(currentTeam.name || key)
      }
    }
  })

  const currentSupervisors = currentGlobal.supervisors ?? []
  const snapshotSupervisors = snapshotGlobal.supervisors ?? []

  const supervisorKey = (config: SupervisorConfigState) => {
    const stageKeys = [...config.stageKeys].sort().join('|')
    const teamKeys = [...config.teamKeys].sort().join('|')
    return `${config.supervisorAgentId}::${config.scope}::${stageKeys}::${teamKeys}`
  }

  const supervisorComparable = (config: SupervisorConfigState) => ({
    supervisorAgentId: config.supervisorAgentId,
    scope: config.scope,
    stageKeys: [...config.stageKeys].sort(),
    teamKeys: [...config.teamKeys].sort(),
    decisionStyle: config.decisionStyle,
    autoApproveThreshold:
      typeof config.autoApproveThreshold === 'number' ? config.autoApproveThreshold : null,
    allowOverride: Boolean(config.allowOverride),
    validationRules: config.validationRules
      .map((rule) => ({
        description: rule.description,
        severity: rule.severity,
        expression: rule.expression,
      }))
      .sort((a, b) => a.description.localeCompare(b.description)),
    conflictPolicy: config.conflictPolicy
      ? {
          strategy: config.conflictPolicy.strategy,
          notify: [...config.conflictPolicy.notify].sort(),
          messageTemplate: config.conflictPolicy.messageTemplate || '',
        }
      : null,
  })

  const currentSupervisorsMap = new Map(currentSupervisors.map((config) => [supervisorKey(config), config]))
  const snapshotSupervisorsMap = new Map(snapshotSupervisors.map((config) => [supervisorKey(config), config]))

  currentSupervisorsMap.forEach((config, key) => {
    if (!snapshotSupervisorsMap.has(key)) {
      globalChanges.supervisorsAdded.push(config.supervisorAgentId || key)
    }
  })

  snapshotSupervisorsMap.forEach((config, key) => {
    if (!currentSupervisorsMap.has(key)) {
      globalChanges.supervisorsRemoved.push(config.supervisorAgentId || key)
    } else {
      const currentConfig = currentSupervisorsMap.get(key)!
      if (!deepEqual(supervisorComparable(currentConfig), supervisorComparable(config as SupervisorConfigState))) {
        globalChanges.supervisorsChanged.push(currentConfig.supervisorAgentId || key)
      }
    }
  })

  globalChanges.changed =
    globalChanges.retryPolicyChanged ||
    globalChanges.variablesAdded.length > 0 ||
    globalChanges.variablesRemoved.length > 0 ||
    globalChanges.variablesChanged.length > 0 ||
    globalChanges.notificationsChanged ||
    globalChanges.notificationsAdded > 0 ||
    globalChanges.notificationsRemoved > 0 ||
    globalChanges.collaborationTeamsAdded.length > 0 ||
    globalChanges.collaborationTeamsRemoved.length > 0 ||
    globalChanges.collaborationTeamsChanged.length > 0 ||
    globalChanges.supervisorsAdded.length > 0 ||
    globalChanges.supervisorsRemoved.length > 0 ||
    globalChanges.supervisorsChanged.length > 0

  const totalDifferences =
    addedStages.length +
    removedStages.length +
    changedStages.length +
    addedEdges.length +
    removedEdges.length +
    globalChanges.supervisorsAdded.length +
    globalChanges.supervisorsRemoved.length +
    globalChanges.supervisorsChanged.length +
    (globalChanges.changed ? 1 : 0)

  return {
    addedStages,
    removedStages,
    changedStages,
    addedEdges,
    removedEdges,
    globalChanges,
    totalDifferences,
  }
}

function BlueprintEditor({ blueprintId, onRefetchList }: { blueprintId: string; onRefetchList: () => Promise<any> }) {
  const { data, isLoading, error, mutate } = useSWR<BlueprintDetailResponse>(
    `/api/lab-ia/workflows/blueprints/${blueprintId}`,
    fetcher,
    {
      keepPreviousData: true,
    }
  )

  const [nodes, setNodes, onNodesChange] = useNodesState<Node[]>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [meta, setMeta] = useState({ name: '', description: '', category: '', tags: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [viewport, setViewport] = useState<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 })
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false)
  const [publishVersionLabel, setPublishVersionLabel] = useState('v1.0.0')
  const [activateAfterPublish, setActivateAfterPublish] = useState(true)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [versionHistory, setVersionHistory] = useState<VersionHistoryItem[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [selectedVersionSnapshot, setSelectedVersionSnapshot] = useState<VersionSnapshot | null>(null)
  const [isLoadingVersionDetail, setIsLoadingVersionDetail] = useState(false)
  const [versionDiff, setVersionDiff] = useState<VersionDiff | null>(null)
  const [isPublishingVersion, setIsPublishingVersion] = useState(false)
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false)
  const [publishSyncDraft, setPublishSyncDraft] = useState(true)
  const { toast } = useToast()
  const [globalSettings, setGlobalSettings] = useState<GlobalSettingsState>(getDefaultGlobalSettings())

  const blueprintSettings = (data?.blueprint?.settings as Record<string, any>) ?? {}
  const lastPublishedVersion = blueprintSettings.lastPublishedVersionLabel as string | undefined
  const lastPublishedAt = blueprintSettings.lastPublishedAt as string | undefined
  const formattedLastPublished = lastPublishedAt ? new Date(lastPublishedAt).toLocaleString('pt-BR') : undefined

  useEffect(() => {
    if (!data?.blueprint) return
    const { blueprint } = data
    const canvasNodes = blueprint.canvas?.nodes ?? []
    const canvasEdges = blueprint.canvas?.edges ?? []

    setNodes(
      canvasNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          loopConfig:
            node.data?.stageType === 'loop'
              ? ensureLoopConfig(node.data?.loopConfig)
              : node.data?.loopConfig,
        },
        selected: selectedNodeId === node.id,
      }))
    )
    setEdges(canvasEdges)
    setViewport(blueprint.canvas?.viewport ?? { x: 0, y: 0, zoom: 1 })
    setMeta({
      name: blueprint.name,
      description: blueprint.description || '',
      category: blueprint.category || '',
      tags: (blueprint.tags || []).join(', '),
    })
    setActivateAfterPublish(true)
    const extractedSettings = (blueprint.settings as Record<string, any>)?.global
    setGlobalSettings(normalizeGlobalSettings(extractedSettings))
    if (selectedNodeId && canvasNodes.every((node) => node.id !== selectedNodeId)) {
      setSelectedNodeId(null)
    }
  }, [data, selectedNodeId, setEdges, setNodes])

  const loadHistory = useCallback(async () => {
    if (!data?.blueprint?.id) {
      setVersionHistory([])
      setIsLoadingHistory(false)
      return
    }
    setIsLoadingHistory(true)
    try {
      const response = await fetch(`/api/lab-ia/workflows/blueprints/${blueprintId}/history`)
      if (!response.ok) throw new Error('Erro ao carregar histórico de versões')
      const result = await response.json()
      const items =
        result.history?.map((item: any) => ({
          id: item.version_id as string,
          versionLabel: item.version_label as string,
          createdAt: item.created_at as string,
          isActive: Boolean(item.is_active),
          stageCount: item.stage_count ?? 0,
          edgeCount: item.edge_count ?? 0,
          notes: item.notes ?? undefined,
          tags: item.tags ?? null,
        })) ?? []
      setVersionHistory(items)
    } catch (historyError) {
      console.error(historyError)
      toast({
        title: 'Erro ao carregar histórico',
        description: (historyError as Error).message,
        variant: 'destructive',
      })
    } finally {
      setIsLoadingHistory(false)
    }
  }, [blueprintId, data?.blueprint?.id, toast])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  useEffect(() => {
    setPublishVersionLabel(getNextVersionLabel(lastPublishedVersion))
  }, [blueprintId, lastPublishedVersion])

  useEffect(() => {
    if (!selectedVersionId) {
      setSelectedVersionSnapshot(null)
      setVersionDiff(null)
      return
    }

    let cancelled = false
    setIsLoadingVersionDetail(true)

    const loadSnapshot = async () => {
      try {
        const response = await fetch(`/api/lab-ia/workflows/blueprints/${blueprintId}/history/${selectedVersionId}`)
        if (!response.ok) {
          throw new Error('Erro ao carregar detalhes da versão')
        }
        const snapshot: VersionSnapshot = await response.json()
        if (!cancelled) {
          setSelectedVersionSnapshot(snapshot)
        }
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          toast({
            title: 'Erro ao abrir versão',
            description: (err as Error).message,
            variant: 'destructive',
          })
          setSelectedVersionSnapshot(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoadingVersionDetail(false)
        }
      }
    }

    loadSnapshot()

    return () => {
      cancelled = true
    }
  }, [blueprintId, selectedVersionId, toast])

  useEffect(() => {
    if (!selectedVersionSnapshot) {
      setVersionDiff(null)
      return
    }
    const diff = computeVersionDiff(selectedVersionSnapshot, nodes, edges, globalSettings)
    setVersionDiff(diff)
  }, [selectedVersionSnapshot, nodes, edges, globalSettings])

  useEffect(() => {
    setPublishSyncDraft(true)
  }, [selectedVersionId])

  useEffect(() => {
    if (!isHistoryOpen) {
      setSelectedVersionId(null)
      setSelectedVersionSnapshot(null)
      setVersionDiff(null)
    }
  }, [isHistoryOpen])

  const handleAddNode = useCallback(() => {
    const newNode: Node = {
      ...DEFAULT_NODE,
      id: crypto.randomUUID(),
      position: { x: Math.random() * 400, y: Math.random() * 400 },
    }
    setNodes((ns) => ns.concat(newNode))
    setSelectedNodeId(newNode.id)
  }, [setNodes])

  const handleDeleteNode = useCallback(() => {
    if (!selectedNodeId) return
    setEdges((eds) => eds.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId))
    setNodes((ns) => ns.filter((node) => node.id !== selectedNodeId))
    setSelectedNodeId(null)
  }, [selectedNodeId, setEdges, setNodes])

  const handleSaveBlueprint = useCallback(async () => {
    if (!data?.blueprint) return
    const canvas = {
      nodes,
      edges,
      viewport,
    }
    const serializedGlobal = {
      retryPolicy: globalSettings.retryPolicy,
      variables: globalSettings.variables,
      notifications: globalSettings.notifications,
      collaboration: {
        teams: serializeCollaborationTeams(globalSettings.collaboration.teams),
      },
      supervisors: serializeSupervisorConfigs(globalSettings.supervisors),
    }
    const body = {
      ...meta,
      tags: meta.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      canvas,
      settings: {
        ...blueprintSettings,
        global: serializedGlobal,
      },
    }
    try {
      setIsSaving(true)
      const response = await fetch(`/api/lab-ia/workflows/blueprints/${blueprintId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result?.error || 'Erro ao salvar blueprint')
      await mutate()
      await onRefetchList()
      toast({
        title: 'Blueprint salvo',
        description: 'Rascunho atualizado com sucesso.',
      })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao salvar',
        description: (err as Error).message,
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }, [blueprintId, data?.blueprint, edges, globalSettings, meta, mutate, nodes, onRefetchList, toast, viewport])

  const handlePublish = useCallback(async () => {
    if (!publishVersionLabel.trim()) {
      toast({
        title: 'Versão obrigatória',
        description: 'Informe um rótulo de versão antes de publicar.',
        variant: 'destructive',
      })
      return
    }
    try {
      setIsPublishing(true)
      const response = await fetch(`/api/lab-ia/workflows/blueprints/${blueprintId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versionLabel: publishVersionLabel.trim(),
          activate: activateAfterPublish,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result?.error || 'Erro ao publicar blueprint')
      }

      toast({
        title: 'Workflow publicado',
        description: `Versão ${result.version?.version_label ?? publishVersionLabel.trim()} criada com sucesso.`,
      })
      setIsPublishDialogOpen(false)
      await mutate()
      await onRefetchList()
      const nextLabel = getNextVersionLabel(result.version?.version_label ?? publishVersionLabel.trim())
      setPublishVersionLabel(nextLabel)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao publicar',
        description: (err as Error).message,
        variant: 'destructive',
      })
    } finally {
      setIsPublishing(false)
    }
  }, [
    activateAfterPublish,
    blueprintId,
    mutate,
    onRefetchList,
    publishVersionLabel,
    toast,
  ])

  const handleApplyVersion = useCallback(() => {
    if (!selectedVersionSnapshot) return

    const normalizedGlobal = normalizeGlobalSettings(selectedVersionSnapshot.globalSettings)

    const clonedNodes: Node[] = selectedVersionSnapshot.nodes.map((node, index) => ({
      id: node.id || `stage_${index}`,
      type: node.data?.stageType === 'output' ? 'output' : node.type ?? 'default',
      position: { ...node.position },
      data: {
        label: node.data?.label ?? node.data?.stageKey ?? `Etapa ${index + 1}`,
        stageKey: node.data?.stageKey ?? node.id ?? `stage_${index + 1}`,
        stageType: node.data?.stageType ?? 'pipeline',
        stageConfig: { ...(node.data?.stageConfig ?? {}) },
        humanConfig: { ...(node.data?.humanConfig ?? {}) },
        stageConditions: { ...(node.data?.stageConditions ?? {}) },
        outputTransforms: Array.isArray(node.data?.outputTransforms) ? [...node.data.outputTransforms] : [],
        validateOutput: Boolean(node.data?.validateOutput),
        notifications: Array.isArray(node.data?.notifications) ? [...node.data.notifications] : [],
        loopConfig:
          node.data?.stageType === 'loop'
            ? ensureLoopConfig(node.data?.loopConfig)
            : node.data?.loopConfig,
      },
    }))

    const clonedEdges: Edge[] = selectedVersionSnapshot.edges.map((edge, index) => ({
      id: edge.id || `edge_${index}`,
      source: edge.source,
      target: edge.target,
      type: edge.type ?? 'default',
      data: edge.data ? { ...edge.data } : undefined,
    }))

    setNodes(clonedNodes)
    setEdges(clonedEdges)
    setGlobalSettings(normalizedGlobal)
    setSelectedNodeId(null)
    setViewport({ x: 0, y: 0, zoom: 1 })
    setIsHistoryOpen(false)
    toast({
      title: 'Versão aplicada ao rascunho',
      description: `Versão ${selectedVersionSnapshot.version.label} carregada. Revise e salve o blueprint.`,
    })
  }, [selectedVersionSnapshot, setEdges, setNodes, setViewport, toast])

  const handlePublishVersion = useCallback(
    async ({ updateDraft }: { updateDraft: boolean }) => {
      if (!selectedVersionId) return
      setIsPublishingVersion(true)
      try {
        const response = await fetch(`/api/lab-ia/workflows/blueprints/${blueprintId}/activate-version`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ versionId: selectedVersionId, updateDraft }),
        })
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Erro ao publicar versão' }))
          throw new Error(errorData.error || 'Erro ao publicar versão')
        }
        toast({
          title: 'Versão publicada',
          description: 'Versão ativada com sucesso no orquestrador.',
        })
        setPublishConfirmOpen(false)
        await mutate()
        await loadHistory()
      } catch (err) {
        console.error(err)
        toast({
          title: 'Erro ao publicar versão',
          description: (err as Error).message,
          variant: 'destructive',
        })
      } finally {
        setIsPublishingVersion(false)
      }
    },
    [blueprintId, loadHistory, mutate, selectedVersionId, toast]
  )

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, animated: true }, eds)),
    [setEdges]
  )

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId) ?? null, [nodes, selectedNodeId])
  const loopConfig = useMemo(() => ensureLoopConfig(selectedNode?.data?.loopConfig), [selectedNode])
  const stageSupervisorConfig = selectedNode?.data?.stageConfig?.supervisor || null

  const updateSelectedNodeData = useCallback(
    (updates: Record<string, any>) => {
      if (!selectedNode) return
      setNodes((ns) => ns.map((node) => (node.id === selectedNode.id ? { ...node, data: { ...node.data, ...updates } } : node)))
    },
    [selectedNode, setNodes]
  )

  if (isLoading) {
    return (
      <div className="flex h-[640px] items-center justify-center rounded-lg border">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data?.blueprint) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Erro ao carregar blueprint selecionado.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-lg border bg-background p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bp-name">Nome</Label>
            <Input
              id="bp-name"
              value={meta.name}
              onChange={(event) => setMeta((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Campanha Clínica X"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bp-category">Categoria</Label>
            <Input
              id="bp-category"
              value={meta.category}
              onChange={(event) => setMeta((prev) => ({ ...prev, category: event.target.value }))}
              placeholder="Triagem / Conteúdo / Exames"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bp-desc">Descrição</Label>
          <Textarea
            id="bp-desc"
            value={meta.description}
            onChange={(event) => setMeta((prev) => ({ ...prev, description: event.target.value }))}
            rows={2}
            placeholder="Workflow end-to-end para jornada do paciente."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bp-tags">Tags</Label>
          <Input
            id="bp-tags"
            value={meta.tags}
            onChange={(event) => setMeta((prev) => ({ ...prev, tags: event.target.value }))}
            placeholder="medicina, triagem, follow-up"
          />
        </div>
        <div className="rounded-lg border bg-muted/10 p-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Configurações globais</h3>
            <p className="text-xs text-muted-foreground">
              Defina políticas padrão e variáveis compartilhadas para todas as etapas deste workflow.
            </p>
          </div>
          <Tabs defaultValue="config" className="mt-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="config">Políticas</TabsTrigger>
              <TabsTrigger value="variables">Variáveis</TabsTrigger>
              <TabsTrigger value="notifications">Notificações</TabsTrigger>
              <TabsTrigger value="collaboration">Times</TabsTrigger>
              <TabsTrigger value="supervisors">Supervisores</TabsTrigger>
            </TabsList>
            <TabsContent value="config" className="space-y-4 pt-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="retry-max-attempts">Tentativas máximas</Label>
                  <Input
                    id="retry-max-attempts"
                    type="number"
                    min={1}
                    value={globalSettings.retryPolicy.maxAttempts}
                    onChange={(event) =>
                      setGlobalSettings((prev) => ({
                        ...prev,
                        retryPolicy: {
                          ...prev.retryPolicy,
                          maxAttempts: Math.max(1, Number(event.target.value) || 1),
                        },
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Número de tentativas antes de marcar uma etapa como falha.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Estratégia de backoff</Label>
                  <Select
                    value={globalSettings.retryPolicy.backoffStrategy}
                    onValueChange={(value: 'fixed' | 'exponential') =>
                      setGlobalSettings((prev) => ({
                        ...prev,
                        retryPolicy: {
                          ...prev.retryPolicy,
                          backoffStrategy: value,
                        },
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Linear</SelectItem>
                      <SelectItem value="exponential">Exponencial</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Define como o tempo entre tentativas aumenta a cada falha.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retry-base-delay">Delay base (ms)</Label>
                  <Input
                    id="retry-base-delay"
                    type="number"
                    min={1000}
                    step={1000}
                    value={globalSettings.retryPolicy.baseDelayMs}
                    onChange={(event) =>
                      setGlobalSettings((prev) => ({
                        ...prev,
                        retryPolicy: {
                          ...prev.retryPolicy,
                          baseDelayMs: Math.max(1000, Number(event.target.value) || 1000),
                        },
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Tempo inicial (em milissegundos) antes de reagendar uma etapa.
                  </p>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="variables" className="space-y-3 pt-4">
              {globalSettings.variables.length === 0 ? (
                <div className="rounded-md border border-dashed bg-background p-6 text-center text-xs text-muted-foreground">
                  Nenhuma variável global definida. Use esta área para mapear chaves compartilhadas entre etapas.
                </div>
              ) : (
                <ul className="space-y-3">
                  {globalSettings.variables.map((variable, index) => (
                    <li key={variable.key + index} className="rounded-md border bg-background p-4 text-sm">
                      <div className="grid gap-3 md:grid-cols-[1fr_160px]">
                        <div className="space-y-2">
                          <Label htmlFor={`var-key-${index}`}>Identificador</Label>
                          <Input
                            id={`var-key-${index}`}
                            value={variable.key}
                            onChange={(event) => {
                              const value = event.target.value
                              setGlobalSettings((prev) => {
                                const copy = [...prev.variables]
                                copy[index] = { ...copy[index], key: value }
                                return { ...prev, variables: copy }
                              })
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Tipo</Label>
                          <Select
                            value={variable.type}
                            onValueChange={(value: GlobalSettingsState['variables'][number]['type']) => {
                              setGlobalSettings((prev) => {
                                const copy = [...prev.variables]
                                copy[index] = { ...copy[index], type: value }
                                return { ...prev, variables: copy }
                              })
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="string">Texto</SelectItem>
                              <SelectItem value="number">Número</SelectItem>
                              <SelectItem value="boolean">Booleano</SelectItem>
                              <SelectItem value="json">JSON</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        <Label htmlFor={`var-desc-${index}`}>Descrição</Label>
                        <Textarea
                          id={`var-desc-${index}`}
                          rows={2}
                          value={variable.description ?? ''}
                          onChange={(event) => {
                            const value = event.target.value
                            setGlobalSettings((prev) => {
                              const copy = [...prev.variables]
                              copy[index] = { ...copy[index], description: value }
                              return { ...prev, variables: copy }
                            })
                          }}
                        />
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() =>
                            setGlobalSettings((prev) => ({
                              ...prev,
                              variables: prev.variables.filter((_, i) => i !== index),
                            }))
                          }
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remover
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setGlobalSettings((prev) => ({
                    ...prev,
                    variables: prev.variables.concat({
                      key: `variavel_${prev.variables.length + 1}`,
                      type: 'string',
                      description: '',
                    }),
                  }))
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar variável
              </Button>
            </TabsContent>
            <TabsContent value="notifications" className="space-y-3 pt-4">
              {globalSettings.notifications.length === 0 ? (
                <div className="rounded-md border border-dashed bg-background p-6 text-center text-xs text-muted-foreground">
                  Nenhuma notificação global configurada. Adicione canais padrão para eventos de início, conclusão ou falha.
                </div>
              ) : (
                <ul className="space-y-3">
                  {globalSettings.notifications.map((notification, index) => (
                    <li key={`${notification.channel}-${index}`} className="rounded-md border bg-background p-4 text-sm">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Evento</Label>
                          <Select
                            value={notification.trigger}
                            onValueChange={(value: GlobalSettingsState['notifications'][number]['trigger']) => {
                              setGlobalSettings((prev) => {
                                const copy = [...prev.notifications]
                                copy[index] = { ...copy[index], trigger: value }
                                return { ...prev, notifications: copy }
                              })
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="workflow.started">Workflow iniciado</SelectItem>
                              <SelectItem value="workflow.completed">Workflow concluído</SelectItem>
                              <SelectItem value="workflow.failed">Workflow falhou</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Canal</Label>
                          <Select
                            value={notification.channel}
                            onValueChange={(value: GlobalSettingsState['notifications'][number]['channel']) => {
                              setGlobalSettings((prev) => {
                                const copy = [...prev.notifications]
                                copy[index] = { ...copy[index], channel: value }
                                return { ...prev, notifications: copy }
                              })
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="email">E-mail</SelectItem>
                              <SelectItem value="sms">SMS</SelectItem>
                              <SelectItem value="whatsapp">WhatsApp</SelectItem>
                              <SelectItem value="webhook">Webhook</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        <Label htmlFor={`notif-template-${index}`}>Template</Label>
                        <Textarea
                          id={`notif-template-${index}`}
                          rows={3}
                          value={notification.template}
                          onChange={(event) => {
                            const value = event.target.value
                            setGlobalSettings((prev) => {
                              const copy = [...prev.notifications]
                              copy[index] = { ...copy[index], template: value }
                              return { ...prev, notifications: copy }
                            })
                          }}
                          placeholder="Ex.: Olá {{paciente.nome}}, seu workflow {{workflow.name}} foi concluído."
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Variáveis suportadas: {{'{{workflow.name}}'}}, {{'{{paciente.nome}}'}}, {{'{{status}}'}}
                        </p>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() =>
                            setGlobalSettings((prev) => ({
                              ...prev,
                              notifications: prev.notifications.filter((_, i) => i !== index),
                            }))
                          }
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remover
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setGlobalSettings((prev) => ({
                    ...prev,
                    notifications: prev.notifications.concat({
                      channel: 'email',
                      trigger: 'workflow.started',
                      template: '',
                    }),
                  }))
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar notificação
              </Button>
            </TabsContent>
            <TabsContent value="collaboration" className="space-y-4 pt-4">
              <CollaborationTeamsSettings
                teams={globalSettings.collaboration.teams}
                onChange={(teams) =>
                  setGlobalSettings((prev) => ({
                    ...prev,
                    collaboration: { teams },
                  }))
                }
              />
            </TabsContent>
            <TabsContent value="supervisors" className="space-y-4 pt-4">
              <SupervisorSettings
                supervisors={globalSettings.supervisors}
                onChange={(configs) =>
                  setGlobalSettings((prev) => ({
                    ...prev,
                    supervisors: configs,
                  }))
                }
              />
            </TabsContent>
          </Tabs>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleAddNode}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar etapa
          </Button>
          <Button variant="outline" size="sm" onClick={handleDeleteNode} disabled={!selectedNodeId}>
            <Trash2 className="mr-2 h-4 w-4" /> Remover etapa
          </Button>
          <Button variant="default" size="sm" onClick={handleSaveBlueprint} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsHistoryOpen(true)}
            disabled={isLoadingHistory && versionHistory.length === 0}
          >
            <History className="mr-2 h-4 w-4" />
            Histórico
          </Button>
          <Dialog open={isPublishDialogOpen} onOpenChange={setIsPublishDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={nodes.length === 0}>
                <Check className="mr-2 h-4 w-4" />
                {data.blueprint.published_workflow_version_id ? 'Publicar nova versão' : 'Publicar workflow'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Publicar workflow</DialogTitle>
                <DialogDescription>
                  Gere uma versão executável no orquestrador com as etapas configuradas neste blueprint.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                    <span>{nodes.length} etapas</span>
                    <span>•</span>
                    <span>{edges.length} conexões</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {data.blueprint.published_workflow_version_id
                      ? 'Criará uma nova versão mantendo o histórico anterior.'
                      : 'Criará um workflow e uma versão inicial no orquestrador.'}
                  </p>
                  {lastPublishedVersion && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Última versão publicada: <span className="font-medium">{lastPublishedVersion}</span>
                      {formattedLastPublished ? ` em ${formattedLastPublished}` : ''}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="publish-version-label">Rótulo da versão</Label>
                  <Input
                    id="publish-version-label"
                    value={publishVersionLabel}
                    onChange={(event) => setPublishVersionLabel(event.target.value)}
                    placeholder="v1.0.0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Utilize um identificador legível (ex.: v1.2.3). Evite repetir um rótulo já utilizado.
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <Label className="text-xs">Definir como ativa</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Desativa versões anteriores e torna esta a versão padrão para execuções.
                    </p>
                  </div>
                  <Switch checked={activateAfterPublish} onCheckedChange={setActivateAfterPublish} />
                </div>
              </div>
              <DialogFooter className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsPublishDialogOpen(false)} disabled={isPublishing}>
                  Cancelar
                </Button>
                <Button onClick={handlePublish} disabled={isPublishing || nodes.length === 0}>
                  {isPublishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  Publicar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {data.blueprint.published_workflow_version_id ? (
            <Badge variant="secondary" className="gap-1">
              <Check className="h-3 w-3" /> Publicado
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-xs">
              <AlertCircle className="h-3 w-3" /> Rascunho
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="h-[600px] rounded-lg border bg-slate-50 dark:bg-slate-950">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange as OnEdgesChange}
            onConnect={onConnect}
            onPaneClick={() => setSelectedNodeId(null)}
            onSelectionChange={(params) => {
              const firstSelected = params?.nodes?.[0]
              setSelectedNodeId(firstSelected?.id ?? null)
            }}
            fitView
            onMoveEnd={(_, viewport) => setViewport(viewport)}
          >
            <MiniMap pannable zoomable />
            <Controls />
            <Background gap={16} size={1} />
          </ReactFlow>
        </div>

        <aside className="h-[600px] overflow-hidden rounded-lg border bg-background">
          <Tabs defaultValue="stage" className="flex h-full flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="stage">Etapa</TabsTrigger>
              <TabsTrigger value="notifications">Notificações</TabsTrigger>
            </TabsList>

            <TabsContent value="stage" className="h-[calc(100%-48px)]">
              <div className="flex h-full flex-col p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Propriedades da etapa
                </h3>
                <Separator className="my-3" />

                {selectedNode ? (
                  <div className="space-y-4 overflow-y-auto pr-1">
                    <div className="space-y-2">
                      <Label htmlFor="stage-label">Nome da etapa</Label>
                      <Input
                        id="stage-label"
                        value={selectedNode.data?.label || ''}
                        onChange={(event) => updateSelectedNodeData({ label: event.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="stage-key">Identificador</Label>
                      <Input
                        id="stage-key"
                        value={selectedNode.data?.stageKey || ''}
                        onChange={(event) => updateSelectedNodeData({ stageKey: event.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Usado internamente pelo orchestrator para mapear etapas.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Tipo de etapa</Label>
                      <Select
                        value={selectedNode.data?.stageType || 'pipeline'}
                        onValueChange={(value) => {
                          if (value === 'loop') {
                            updateSelectedNodeData({
                              stageType: value,
                              loopConfig,
                            })
                          } else if (value === 'human') {
                            updateSelectedNodeData({
                              stageType: value,
                              humanConfig: sanitizeHumanConfigForSave(
                                ensureHumanConfigState(selectedNode.data?.humanConfig as HumanStageConfig | null)
                              ),
                            })
                          } else {
                            updateSelectedNodeData({ stageType: value })
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pipeline">Pipeline</SelectItem>
                          <SelectItem value="human">Etapa humana</SelectItem>
                          <SelectItem value="delay">Delay / espera</SelectItem>
                          <SelectItem value="webhook">Webhook externo</SelectItem>
                          <SelectItem value="loop">Loop / Iteração</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Accordion type="multiple" className="w-full">
                      {selectedNode.data?.stageType === 'pipeline' && (
                        <AccordionItem value="pipeline-config">
                          <AccordionTrigger>Execução de pipeline / agente</AccordionTrigger>
                          <AccordionContent className="space-y-2">
                            <Label htmlFor="stage-pipeline-id">Pipeline executado</Label>
                            <Input
                              id="stage-pipeline-id"
                              value={selectedNode.data?.stageConfig?.pipelineId || ''}
                              onChange={(event) =>
                                updateSelectedNodeData({
                                  stageConfig: {
                                    ...selectedNode.data?.stageConfig,
                                    pipelineId: event.target.value,
                                  },
                                })
                              }
                              placeholder="UUID do pipeline"
                            />
                            <Label htmlFor="stage-input-path">Caminho do input</Label>
                            <Input
                              id="stage-input-path"
                              value={selectedNode.data?.stageConfig?.inputPath || ''}
                              onChange={(event) =>
                                updateSelectedNodeData({
                                  stageConfig: {
                                    ...selectedNode.data?.stageConfig,
                                    inputPath: event.target.value,
                                  },
                                })
                              }
                              placeholder="context.patient.messages"
                            />
                            <Label htmlFor="stage-output-path">Caminho do output</Label>
                            <Input
                              id="stage-output-path"
                              value={selectedNode.data?.stageConfig?.outputPath || ''}
                              onChange={(event) =>
                                updateSelectedNodeData({
                                  stageConfig: {
                                    ...selectedNode.data?.stageConfig,
                                    outputPath: event.target.value,
                                  },
                                })
                              }
                              placeholder="context.pipelineResults.triage"
                            />
                            {globalSettings.collaboration.teams.length > 0 && (
                              <div className="space-y-2">
                                <Label htmlFor="stage-team-key">Equipe colaborativa</Label>
                                <Select
                                  value={selectedNode.data?.stageConfig?.teamKey || ''}
                                  onValueChange={(value) =>
                                    updateSelectedNodeData({
                                      stageConfig: {
                                        ...selectedNode.data?.stageConfig,
                                        teamKey: value || undefined,
                                      },
                                    })
                                  }
                                >
                                  <SelectTrigger id="stage-team-key">
                                    <SelectValue placeholder="Selecione um time (opcional)" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="">Sem colaboração</SelectItem>
                                    {globalSettings.collaboration.teams.map((team) => (
                                      <SelectItem key={team.teamKey} value={team.teamKey}>
                                        {team.name} ({team.teamKey})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                  Se definido, a etapa usará esse time para debate/votação entre agentes.
                                </p>
                            {(() => {
                              const currentTeamKey = selectedNode.data?.stageConfig?.teamKey
                              if (!currentTeamKey) return null
                              const selectedTeam = globalSettings.collaboration.teams.find(
                                (team) => team.teamKey === currentTeamKey
                              )
                              if (!selectedTeam) return null
                              const members = selectedTeam.members || []
                              return (
                                <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                                      Estratégia: {selectedTeam.strategy}
                                    </Badge>
                                    <Badge variant="secondary" className="text-[10px]">
                                      {members.length} integrante(s)
                                    </Badge>
                                  </div>
                                  {members.length > 0 ? (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {members.map((member) => (
                                        <Badge
                                          key={`${selectedTeam.teamKey}-${member.agentId}`}
                                          variant="outline"
                                          className="text-[10px]"
                                        >
                                          {member.role.toUpperCase()} · {member.agentId}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="mt-2 text-[11px]">Adicione membros no painel de times.</p>
                                  )}
                                </div>
                              )
                            })()}
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      )}

                      {selectedNode.data?.stageType === 'human' && (
                        <AccordionItem value="human-config">
                          <AccordionTrigger>Etapa humana</AccordionTrigger>
                          <AccordionContent className="space-y-4">
                            <HumanStageConfigForm
                              value={selectedNode.data?.humanConfig}
                              onChange={(config) =>
                                updateSelectedNodeData({
                                  humanConfig: config,
                                })
                              }
                            />
                          </AccordionContent>
                        </AccordionItem>
                      )}

                      {selectedNode.data?.stageType === 'loop' && (
                        <>
                          <AccordionItem value="loop-config">
                            <AccordionTrigger>Loop / Itens</AccordionTrigger>
                            <AccordionContent className="space-y-2">
                              <Label htmlFor="loop-items-path">Lista de itens (path)</Label>
                              <Input
                                id="loop-items-path"
                                value={loopConfig.itemsPath}
                                onChange={(event) =>
                                  updateSelectedNodeData({
                                    loopConfig: {
                                      ...loopConfig,
                                      itemsPath: event.target.value,
                                    },
                                  })
                                }
                                placeholder="context.patients"
                              />
                              <Label htmlFor="loop-alias">Alias do item</Label>
                              <Input
                                id="loop-alias"
                                value={loopConfig.itemAlias}
                                onChange={(event) =>
                                  updateSelectedNodeData({
                                    loopConfig: {
                                      ...loopConfig,
                                      itemAlias: event.target.value,
                                    },
                                  })
                                }
                                placeholder="item"
                              />
                              <Label htmlFor="loop-max-parallel">Execuções em paralelo</Label>
                              <Input
                                id="loop-max-parallel"
                                type="number"
                                min={1}
                                value={loopConfig.maxParallel}
                                onChange={(event) =>
                                  updateSelectedNodeData({
                                    loopConfig: {
                                      ...loopConfig,
                                      maxParallel: Number(event.target.value) || 1,
                                    },
                                  })
                                }
                              />
                              <Label htmlFor="loop-iteration-context">Contexto adicional por iteração</Label>
                              <Input
                                id="loop-iteration-context"
                                value={loopConfig.iterationContextPath}
                                onChange={(event) =>
                                  updateSelectedNodeData({
                                    loopConfig: {
                                      ...loopConfig,
                                      iterationContextPath: event.target.value,
                                    },
                                  })
                                }
                                placeholder="$root.iterationContext"
                              />
                              <Label htmlFor="loop-output-path">Caminho para salvar resultados</Label>
                              <Input
                                id="loop-output-path"
                                value={loopConfig.outputPath}
                                onChange={(event) =>
                                  updateSelectedNodeData({
                                    loopConfig: {
                                      ...loopConfig,
                                      outputPath: event.target.value,
                                    },
                                  })
                                }
                                placeholder="context.loopResults"
                              />
                              <Label htmlFor="loop-accumulate-context">Acumular outputs em contexto</Label>
                              <Input
                                id="loop-accumulate-context"
                                value={loopConfig.accumulateContextPath}
                                onChange={(event) =>
                                  updateSelectedNodeData({
                                    loopConfig: {
                                      ...loopConfig,
                                      accumulateContextPath: event.target.value,
                                    },
                                  })
                                }
                                placeholder="context.accumulatedOutputs"
                              />
                              <div className="grid gap-2 md:grid-cols-2">
                                <div className="space-y-2">
                                  <Label htmlFor="loop-until-path">Until (path)</Label>
                                  <Input
                                    id="loop-until-path"
                                    value={loopConfig.untilCondition.path}
                                    onChange={(event) =>
                                      updateSelectedNodeData({
                                        loopConfig: {
                                          ...loopConfig,
                                          untilCondition: {
                                            ...loopConfig.untilCondition,
                                            path: event.target.value,
                                          },
                                        },
                                      })
                                    }
                                    placeholder="output.success"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="loop-until-equals">Until (equals)</Label>
                                  <Input
                                    id="loop-until-equals"
                                    value={loopConfig.untilCondition.equals ?? ''}
                                    onChange={(event) =>
                                      updateSelectedNodeData({
                                        loopConfig: {
                                          ...loopConfig,
                                          untilCondition: {
                                            ...loopConfig.untilCondition,
                                            equals: event.target.value,
                                          },
                                        },
                                      })
                                    }
                                    placeholder="true"
                                  />
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                          <AccordionItem value="loop-inner-stage">
                            <AccordionTrigger>Etapa interna</AccordionTrigger>
                            <AccordionContent className="space-y-3">
                              <div className="space-y-2">
                                <Label>Tipo da etapa interna</Label>
                                <Select
                                  value={loopConfig.inner.stageType}
                                  onValueChange={(value) =>
                                    updateSelectedNodeData({
                                      loopConfig: {
                                        ...loopConfig,
                                        inner: {
                                          ...loopConfig.inner,
                                          stageType: value,
                                        },
                                      },
                                    })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pipeline">Pipeline</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {loopConfig.inner.stageType === 'pipeline' && (
                                <div className="space-y-2">
                                  <Label htmlFor="loop-inner-pipeline">Pipeline executado</Label>
                                  <Input
                                    id="loop-inner-pipeline"
                                    value={loopConfig.inner.stageConfig.pipelineId}
                                    onChange={(event) =>
                                      updateSelectedNodeData({
                                        loopConfig: {
                                          ...loopConfig,
                                          inner: {
                                            ...loopConfig.inner,
                                            stageConfig: {
                                              ...loopConfig.inner.stageConfig,
                                              pipelineId: event.target.value,
                                            },
                                          },
                                        },
                                      })
                                    }
                                    placeholder="UUID do pipeline"
                                  />
                                  <Label htmlFor="loop-inner-input">Caminho do input</Label>
                                  <Input
                                    id="loop-inner-input"
                                    value={loopConfig.inner.stageConfig.inputPath}
                                    onChange={(event) =>
                                      updateSelectedNodeData({
                                        loopConfig: {
                                          ...loopConfig,
                                          inner: {
                                            ...loopConfig.inner,
                                            stageConfig: {
                                              ...loopConfig.inner.stageConfig,
                                              inputPath: event.target.value,
                                            },
                                          },
                                        },
                                      })
                                    }
                                    placeholder="$loop.minhaEtapa.item.messages"
                                  />
                                  <Label htmlFor="loop-inner-output">Caminho do output</Label>
                                  <Input
                                    id="loop-inner-output"
                                    value={loopConfig.inner.stageConfig.outputPath}
                                    onChange={(event) =>
                                      updateSelectedNodeData({
                                        loopConfig: {
                                          ...loopConfig,
                                          inner: {
                                            ...loopConfig.inner,
                                            stageConfig: {
                                              ...loopConfig.inner.stageConfig,
                                              outputPath: event.target.value,
                                            },
                                          },
                                        },
                                      })
                                    }
                                    placeholder="context.iterations.$index.output"
                                  />
                                  <Label htmlFor="loop-inner-fallback">Fallback (texto)</Label>
                                  <Input
                                    id="loop-inner-fallback"
                                    value={loopConfig.inner.stageConfig.fallbackTextPath}
                                    onChange={(event) =>
                                      updateSelectedNodeData({
                                        loopConfig: {
                                          ...loopConfig,
                                          inner: {
                                            ...loopConfig.inner,
                                            stageConfig: {
                                              ...loopConfig.inner.stageConfig,
                                              fallbackTextPath: event.target.value,
                                            },
                                          },
                                        },
                                      })
                                    }
                                    placeholder="context.defaultText"
                                  />
                                </div>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        </>
                      )}

                      <AccordionItem value="logic">
                        <AccordionTrigger>Condições e variáveis</AccordionTrigger>
                        <AccordionContent className="space-y-2">
                          <Label htmlFor="stage-condition">Condição de entrada (JSON)</Label>
                          <Textarea
                            id="stage-condition"
                            rows={4}
                            className="font-mono text-xs"
                            value={JSON.stringify(selectedNode.data?.stageConditions || {}, null, 2)}
                            onChange={(event) => {
                              try {
                                const value = JSON.parse(event.target.value)
                                updateSelectedNodeData({ stageConditions: value })
                              } catch {
                                // idem
                              }
                            }}
                          />

                          <Label htmlFor="stage-transform">Transformações de output (JSON)</Label>
                          <Textarea
                            id="stage-transform"
                            rows={4}
                            className="font-mono text-xs"
                            value={JSON.stringify(selectedNode.data?.outputTransforms || [], null, 2)}
                            onChange={(event) => {
                              try {
                                const value = JSON.parse(event.target.value)
                                updateSelectedNodeData({ outputTransforms: value })
                              } catch {
                                // idem
                              }
                            }}
                          />

                          <div className="flex items-center justify-between rounded-md border p-2">
                            <div>
                              <Label className="text-xs">Validar output com schema</Label>
                              <p className="text-[11px] text-muted-foreground">
                                Se ativo, o orchestrator valida o output antes de seguir para a próxima etapa.
                              </p>
                            </div>
                            <Switch
                              checked={Boolean(selectedNode.data?.validateOutput)}
                              onCheckedChange={(checked) => updateSelectedNodeData({ validateOutput: checked })}
                            />
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Selecione uma etapa no fluxograma para editar suas propriedades.
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="notifications" className="h-[calc(100%-48px)]">
              <div className="flex h-full flex-col p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Notificações
                </h3>
                <Separator className="my-3" />

                {selectedNode ? (
                  <div className="space-y-4 overflow-y-auto pr-1">
                    <div className="text-sm text-muted-foreground">
                      Configure alertas automáticos quando esta etapa for iniciada, concluída ou apresentar erros.
                    </div>

                    {(selectedNode.data?.notifications || []).map((notification: any, index: number) => (
                      <div key={index} className="space-y-2 rounded-md border p-3">
                        <div className="flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground">
                          Notificação #{index + 1}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                            onClick={() => {
                              const list = [...(selectedNode.data?.notifications || [])]
                              list.splice(index, 1)
                              updateSelectedNodeData({ notifications: list })
                            }}
                          >
                            Remover
                          </Button>
                        </div>

                        <Label className="text-xs">Canal</Label>
                        <Select
                          value={notification.channel || 'email'}
                          onValueChange={(value) => {
                            const list = [...(selectedNode.data?.notifications || [])]
                            list[index] = { ...notification, channel: value }
                            updateSelectedNodeData({ notifications: list })
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="email">E-mail</SelectItem>
                            <SelectItem value="sms">SMS</SelectItem>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="webhook">Webhook</SelectItem>
                          </SelectContent>
                        </Select>

                        <Label className="text-xs">Template</Label>
                        <Textarea
                          rows={3}
                          className="text-xs"
                          value={notification.template || ''}
                          onChange={(event) => {
                            const list = [...(selectedNode.data?.notifications || [])]
                            list[index] = { ...notification, template: event.target.value }
                            updateSelectedNodeData({ notifications: list })
                          }}
                          placeholder="Use variáveis como {{paciente.nome}} para personalizar."
                        />

                        <Label className="text-xs">Condicional (JSON)</Label>
                        <Textarea
                          rows={3}
                          className="font-mono text-xs"
                          value={JSON.stringify(notification.condition || {}, null, 2)}
                          onChange={(event) => {
                            try {
                              const condition = JSON.parse(event.target.value)
                              const list = [...(selectedNode.data?.notifications || [])]
                              list[index] = { ...notification, condition }
                              updateSelectedNodeData({ notifications: list })
                            } catch {
                              // permitir edição mesmo com JSON inválido temporariamente
                            }
                          }}
                          placeholder='{"status":"completed"}'
                        />
                      </div>
                    ))}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const list = [...(selectedNode.data?.notifications || [])]
                        list.push({ channel: 'email', template: '', condition: {} })
                        updateSelectedNodeData({ notifications: list })
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" /> Adicionar notificação
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Selecione uma etapa no fluxograma para gerenciar notificações.
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </aside>
      </div>
      <Drawer open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Histórico de versões</DrawerTitle>
            <DrawerDescription>
              Compare versões publicadas e restaure uma versão anterior diretamente no designer.
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {isLoadingHistory ? (
              <div className="flex items-center gap-2 rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando histórico...
              </div>
            ) : versionHistory.length === 0 ? (
              <div className="rounded-md border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                Nenhuma versão publicada ainda. Publique para registrar o histórico.
              </div>
            ) : (
              <>
                <ul className="space-y-3">
                  {versionHistory.map((version) => (
                    <li key={version.id}>
                      <button
                        onClick={() => setSelectedVersionId(version.id)}
                        className={cn(
                          'w-full rounded-lg border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-ring',
                          selectedVersionId === version.id ? 'border-primary bg-primary/10' : 'border-border bg-background'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold">{version.versionLabel}</p>
                            <p className="text-xs text-muted-foreground">
                              Publicado em {new Date(version.createdAt).toLocaleString('pt-BR')}
                            </p>
                          </div>
                          {version.isActive && (
                            <Badge variant="secondary" className="text-[10px]">
                              Ativa
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{version.stageCount} etapas</span>
                          <span>•</span>
                          <span>{version.edgeCount} conexões</span>
                        </div>
                        {version.notes && <p className="mt-2 text-xs text-muted-foreground">{version.notes}</p>}
                        {version.tags && version.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {version.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-[10px]">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 border-t pt-4">
                  {selectedVersionId ? (
                    isLoadingVersionDetail ? (
                      <div className="flex items-center gap-2 rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Carregando detalhes da versão...
                      </div>
                    ) : selectedVersionSnapshot && versionDiff ? (
                      <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-md border bg-muted/20 p-3">
                            <p className="text-xs uppercase text-muted-foreground">Diferenças totais</p>
                            <p className="text-2xl font-semibold">{versionDiff.totalDifferences}</p>
                          </div>
                          <div className="rounded-md border bg-muted/20 p-3">
                            <p className="text-xs uppercase text-muted-foreground">Versão selecionada</p>
                            <p className="text-sm font-medium">{selectedVersionSnapshot.version.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(selectedVersionSnapshot.version.createdAt).toLocaleString('pt-BR')}
                            </p>
                          </div>
                        </div>

                        {versionDiff.addedStages.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-green-600 dark:text-green-400">Etapas novas no rascunho</h4>
                            <ul className="space-y-1 text-xs">
                              {versionDiff.addedStages.map((stage) => (
                                <li
                                  key={`added-${stage.stageKey}`}
                                  className="rounded-md border border-green-500/30 bg-green-500/10 p-2"
                                >
                                  <span className="font-medium">{stage.label}</span> ({stage.stageKey}) — {stage.stageType}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {versionDiff.removedStages.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-red-600 dark:text-red-400">Etapas ausentes</h4>
                            <ul className="space-y-1 text-xs">
                              {versionDiff.removedStages.map((stage) => (
                                <li
                                  key={`removed-${stage.stageKey}`}
                                  className="rounded-md border border-red-500/30 bg-red-500/10 p-2"
                                >
                                  <span className="font-medium">{stage.label}</span> ({stage.stageKey}) — {stage.stageType}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {versionDiff.changedStages.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-amber-600 dark:text-amber-400">Etapas alteradas</h4>
                            <ul className="space-y-2 text-xs">
                              {versionDiff.changedStages.map((stage) => (
                                <li
                                  key={`changed-${stage.stageKey}`}
                                  className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2"
                                >
                                  <div className="font-medium">
                                    {stage.previousLabel} ({stage.stageKey})
                                  </div>
                                  <ul className="ml-3 list-disc space-y-1">
                                    {stage.differences.map((difference, index) => (
                                      <li key={`${stage.stageKey}-diff-${index}`}>{difference}</li>
                                    ))}
                                  </ul>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {(versionDiff.addedEdges.length > 0 || versionDiff.removedEdges.length > 0) && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-sky-600 dark:text-sky-400">Conexões</h4>
                            {versionDiff.addedEdges.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-sky-500">Novas no rascunho</p>
                                <ul className="ml-3 list-disc text-xs">
                                  {versionDiff.addedEdges.map((edge) => (
                                    <li key={`edge-added-${edge}`}>{edge.replace('→', ' → ')}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {versionDiff.removedEdges.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-sky-500">Removidas no rascunho</p>
                                <ul className="ml-3 list-disc text-xs">
                                  {versionDiff.removedEdges.map((edge) => (
                                    <li key={`edge-removed-${edge}`}>{edge.replace('→', ' → ')}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}

                        {versionDiff.globalChanges.changed && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-purple-600 dark:text-purple-400">Configurações globais</h4>
                            <ul className="ml-3 list-disc text-xs">
                              {versionDiff.globalChanges.retryPolicyChanged && <li>Política de retry alterada</li>}
                              {versionDiff.globalChanges.variablesAdded.length > 0 && (
                                <li>Variáveis adicionadas: {versionDiff.globalChanges.variablesAdded.join(', ')}</li>
                              )}
                              {versionDiff.globalChanges.variablesRemoved.length > 0 && (
                                <li>Variáveis removidas: {versionDiff.globalChanges.variablesRemoved.join(', ')}</li>
                              )}
                              {versionDiff.globalChanges.variablesChanged.length > 0 && (
                                <li>Variáveis alteradas: {versionDiff.globalChanges.variablesChanged.join(', ')}</li>
                              )}
                              {versionDiff.globalChanges.notificationsChanged && <li>Template das notificações modificado</li>}
                              {versionDiff.globalChanges.notificationsAdded > 0 && (
                                <li>{versionDiff.globalChanges.notificationsAdded} nova(s) notificação(ões) adicionada(s)</li>
                              )}
                              {versionDiff.globalChanges.notificationsRemoved > 0 && (
                                <li>{versionDiff.globalChanges.notificationsRemoved} notificação(ões) removida(s)</li>
                              )}
                              {versionDiff.globalChanges.collaborationTeamsAdded.length > 0 && (
                                <li>
                                  Times adicionados: {versionDiff.globalChanges.collaborationTeamsAdded.join(', ')}
                                </li>
                              )}
                              {versionDiff.globalChanges.collaborationTeamsRemoved.length > 0 && (
                                <li>
                                  Times removidos: {versionDiff.globalChanges.collaborationTeamsRemoved.join(', ')}
                                </li>
                              )}
                              {versionDiff.globalChanges.collaborationTeamsChanged.length > 0 && (
                                <li>
                                  Times atualizados: {versionDiff.globalChanges.collaborationTeamsChanged.join(', ')}
                                </li>
                              )}
                              {versionDiff.globalChanges.supervisorsAdded.length > 0 && (
                                <li>
                                  Supervisores adicionados: {versionDiff.globalChanges.supervisorsAdded.join(', ')}
                                </li>
                              )}
                              {versionDiff.globalChanges.supervisorsRemoved.length > 0 && (
                                <li>
                                  Supervisores removidos: {versionDiff.globalChanges.supervisorsRemoved.join(', ')}
                                </li>
                              )}
                              {versionDiff.globalChanges.supervisorsChanged.length > 0 && (
                                <li>
                                  Supervisores atualizados: {versionDiff.globalChanges.supervisorsChanged.join(', ')}
                                </li>
                              )}
                            </ul>
                          </div>
                        )}

                        {!versionDiff.totalDifferences && (
                          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600">
                            Nenhuma diferença detectada entre essa versão e o rascunho atual.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-md border border-dashed bg-muted/20 p-6 text-center text-xs text-muted-foreground">
                        Selecione uma versão para visualizar diferenças e aplicar ao rascunho.
                      </div>
                    )
                  ) : (
                    <div className="rounded-md border border-dashed bg-muted/20 p-6 text-center text-xs text-muted-foreground">
                      Selecione uma versão publicada para ver detalhes.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        <DrawerFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <DrawerClose asChild>
            <Button variant="outline">Fechar</Button>
          </DrawerClose>
          <AlertDialog open={publishConfirmOpen} onOpenChange={setPublishConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="secondary"
                disabled={!selectedVersionSnapshot || isLoadingVersionDetail || isPublishingVersion}
              >
                <Check className="mr-2 h-4 w-4" />
                Publicar versão
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Publicar versão {selectedVersionSnapshot?.version.label}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  A versão selecionada será marcada como ativa no orquestrador. Você pode opcionalmente sincronizar o rascunho com os nós desta versão.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4 py-2">
                <div className="rounded-md border bg-muted/20 p-3 text-sm">
                  <div className="font-semibold text-foreground">
                    {selectedVersionSnapshot?.version.label}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Publicada em{' '}
                    {selectedVersionSnapshot
                      ? new Date(selectedVersionSnapshot.version.createdAt).toLocaleString('pt-BR')
                      : '--'}
                  </div>
                  {versionDiff && (
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{versionDiff.addedStages.length} etapas novas</span>
                      <span>•</span>
                      <span>{versionDiff.removedStages.length} removidas</span>
                      <span>•</span>
                      <span>{versionDiff.changedStages.length} alteradas</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between rounded-md border bg-muted/10 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Atualizar rascunho</p>
                    <p className="text-xs text-muted-foreground">
                      Substitui o blueprint atual pelos nós e conexões desta versão.
                    </p>
                  </div>
                  <Switch checked={publishSyncDraft} onCheckedChange={setPublishSyncDraft} />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={isPublishingVersion}
                  onClick={() => handlePublishVersion({ updateDraft: publishSyncDraft })}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isPublishingVersion ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Publicar versão
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            variant="default"
            disabled={!selectedVersionSnapshot || isLoadingVersionDetail}
            onClick={handleApplyVersion}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Aplicar ao rascunho
          </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}


