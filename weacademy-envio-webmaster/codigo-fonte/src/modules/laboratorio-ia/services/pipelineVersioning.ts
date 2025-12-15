/**
 * Serviço de Versionamento de Pipelines
 */

import { createClient } from '@supabase/supabase-js'

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface PipelineVersion {
  id: string
  pipeline_id: string
  version: string
  major: number
  minor: number
  patch: number
  name: string
  description?: string
  steps: any[]
  draft: boolean
  active: boolean
  created_by: string
  created_at: string
  changelog?: string
  release_notes?: string
  is_release: boolean
  release_tag?: string
  status: 'draft' | 'published' | 'archived'
  previous_version_id?: string
  pipeline_snapshot: Record<string, any>
}

export interface ReleaseTag {
  id: string
  pipeline_id: string
  version_id: string
  tag_name: string
  tag_type: 'version' | 'release' | 'custom'
  created_by: string
  created_at: string
  description?: string
}

export interface VersionChange {
  id: string
  pipeline_id: string
  from_version_id?: string
  to_version_id: string
  change_type: 'created' | 'updated' | 'step_added' | 'step_removed' | 'step_modified' | 'rollback'
  change_description: string
  change_details?: Record<string, any>
  changed_by: string
  changed_at: string
}

/**
 * Valida formato de versão semântica
 */
export function validateSemanticVersion(version: string): boolean {
  const regex = /^v?(\d+)\.(\d+)\.(\d+)$/
  return regex.test(version)
}

/**
 * Parse versão semântica
 */
export function parseSemanticVersion(version: string): { major: number; minor: number; patch: number } | null {
  const regex = /^v?(\d+)\.(\d+)\.(\d+)$/
  const match = version.match(regex)
  
  if (!match) {
    return null
  }
  
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  }
}

/**
 * Cria uma nova versão de pipeline
 */
export async function createPipelineVersion(
  pipelineId: string,
  version: string,
  options?: {
    changelog?: string
    release_notes?: string
    is_release?: boolean
    release_tag?: string
    userId: string
  }
): Promise<PipelineVersion> {
  if (!validateSemanticVersion(version)) {
    throw new Error('Formato de versão inválido. Use formato semântico (ex: v1.0.0)')
  }

  if (!options?.userId) {
    throw new Error('userId é obrigatório')
  }

  const { data, error } = await serviceSupabase.rpc('create_pipeline_version', {
    p_pipeline_id: pipelineId,
    p_version: version,
    p_created_by: options.userId,
    p_changelog: options.changelog || null,
    p_release_notes: options.release_notes || null,
    p_is_release: options.is_release || false,
    p_release_tag: options.release_tag || null,
  })

  if (error) {
    throw new Error(`Erro ao criar versão: ${error.message}`)
  }

  // Buscar versão criada
  const { data: versionData, error: fetchError } = await serviceSupabase
    .from('lab_pipeline_versions')
    .select('*')
    .eq('id', data)
    .single()

  if (fetchError || !versionData) {
    throw new Error(`Erro ao buscar versão criada: ${fetchError?.message || 'Versão não encontrada'}`)
  }

  return versionData as PipelineVersion
}

/**
 * Busca versões de um pipeline
 */
export async function getPipelineVersions(
  pipelineId: string,
  options?: {
    includeDrafts?: boolean
    includeArchived?: boolean
  }
): Promise<PipelineVersion[]> {
  let query = serviceSupabase
    .from('lab_pipeline_versions')
    .select('*')
    .eq('pipeline_id', pipelineId)
    .order('major', { ascending: false })
    .order('minor', { ascending: false })
    .order('patch', { ascending: false })

  if (!options?.includeDrafts) {
    query = query.eq('status', 'published')
  }

  if (!options?.includeArchived) {
    query = query.neq('status', 'archived')
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Erro ao buscar versões: ${error.message}`)
  }

  return (data || []) as PipelineVersion[]
}

/**
 * Busca uma versão específica
 */
export async function getPipelineVersion(
  pipelineId: string,
  version: string
): Promise<PipelineVersion | null> {
  const { data, error } = await serviceSupabase
    .from('lab_pipeline_versions')
    .select('*')
    .eq('pipeline_id', pipelineId)
    .eq('version', version)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Erro ao buscar versão: ${error.message}`)
  }

  return data as PipelineVersion
}

/**
 * Busca versão mais recente
 */
export async function getLatestVersion(pipelineId: string): Promise<PipelineVersion | null> {
  const { data, error } = await serviceSupabase
    .from('lab_pipeline_versions')
    .select('*')
    .eq('pipeline_id', pipelineId)
    .eq('status', 'published')
    .order('major', { ascending: false })
    .order('minor', { ascending: false })
    .order('patch', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Erro ao buscar versão mais recente: ${error.message}`)
  }

  return data as PipelineVersion
}

/**
 * Calcula próxima versão baseada no tipo de mudança
 */
export async function getNextVersion(
  pipelineId: string,
  changeType: 'major' | 'minor' | 'patch'
): Promise<{ major: number; minor: number; patch: number; version: string }> {
  const { data, error } = await serviceSupabase.rpc('get_next_version', {
    p_pipeline_id: pipelineId,
    p_change_type: changeType,
  })

  if (error) {
    throw new Error(`Erro ao calcular próxima versão: ${error.message}`)
  }

  if (!data || data.length === 0) {
    // Se não há versão anterior, retornar v1.0.0
    return { major: 1, minor: 0, patch: 0, version: 'v1.0.0' }
  }

  return data[0]
}

/**
 * Faz rollback para uma versão anterior
 */
export async function rollbackToVersion(
  pipelineId: string,
  version: string,
  userId: string,
  changelog?: string
): Promise<PipelineVersion> {
  // Buscar versão alvo
  const targetVersion = await getPipelineVersion(pipelineId, version)
  
  if (!targetVersion) {
    throw new Error('Versão não encontrada')
  }

  // Buscar pipeline atual
  const { data: currentPipeline, error: pipelineError } = await serviceSupabase
    .from('lab_agent_pipelines')
    .select('*')
    .eq('id', pipelineId)
    .single()

  if (pipelineError) {
    throw new Error(`Erro ao buscar pipeline: ${pipelineError.message}`)
  }

  // Restaurar snapshot da versão
  const snapshot = targetVersion.pipeline_snapshot as any

  // Atualizar pipeline com dados da versão
  const { error: updateError } = await serviceSupabase
    .from('lab_agent_pipelines')
    .update({
      name: snapshot.name,
      description: snapshot.description,
      steps: snapshot.steps,
      draft: snapshot.draft,
      active: snapshot.active,
    })
    .eq('id', pipelineId)

  if (updateError) {
    throw new Error(`Erro ao fazer rollback: ${updateError.message}`)
  }

  // Criar nova versão para registrar o rollback
  const nextVersion = await getNextVersion(pipelineId, 'patch')
  const rollbackVersion = await createPipelineVersion(pipelineId, nextVersion.version, {
    changelog: changelog || `Rollback para versão ${version}`,
    userId,
  })

  // Registrar mudança como rollback
  await serviceSupabase
    .from('lab_pipeline_version_changes')
    .insert({
      pipeline_id: pipelineId,
      from_version_id: currentPipeline.id, // Versão atual
      to_version_id: rollbackVersion.id,
      change_type: 'rollback',
      change_description: `Rollback para versão ${version}`,
      changed_by: userId,
      change_details: {
        target_version: version,
        target_version_id: targetVersion.id,
      },
    })

  return rollbackVersion
}

/**
 * Calcula diff entre duas versões
 */
export async function getVersionDiff(
  pipelineId: string,
  fromVersion: string,
  toVersion: string
): Promise<Array<{
  change_type: string
  change_description: string
  change_details: Record<string, any>
}>> {
  const { data, error } = await serviceSupabase.rpc('get_version_diff', {
    p_pipeline_id: pipelineId,
    p_from_version: fromVersion,
    p_to_version: toVersion,
  })

  if (error) {
    throw new Error(`Erro ao calcular diff: ${error.message}`)
  }

  return data || []
}

/**
 * Busca histórico de mudanças
 */
export async function getVersionHistory(
  pipelineId: string,
  limit: number = 50
): Promise<VersionChange[]> {
  const { data, error } = await serviceSupabase
    .from('lab_pipeline_version_changes')
    .select('*')
    .eq('pipeline_id', pipelineId)
    .order('changed_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Erro ao buscar histórico: ${error.message}`)
  }

  return (data || []) as VersionChange[]
}

/**
 * Busca tags de releases
 */
export async function getReleaseTags(pipelineId: string): Promise<ReleaseTag[]> {
  const { data, error } = await serviceSupabase
    .from('lab_pipeline_release_tags')
    .select('*')
    .eq('pipeline_id', pipelineId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Erro ao buscar tags: ${error.message}`)
  }

  return (data || []) as ReleaseTag[]
}

/**
 * Cria uma tag de release
 */
export async function createReleaseTag(
  pipelineId: string,
  versionId: string,
  tagName: string,
  userId: string,
  description?: string
): Promise<ReleaseTag> {
  const { data, error } = await serviceSupabase
    .from('lab_pipeline_release_tags')
    .insert({
      pipeline_id: pipelineId,
      version_id: versionId,
      tag_name: tagName,
      tag_type: 'release',
      created_by: userId,
      description,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Erro ao criar tag: ${error.message}`)
  }

  return data as ReleaseTag
}

/**
 * Compara steps entre duas versões (diff detalhado)
 */
export function compareVersions(
  fromVersion: PipelineVersion,
  toVersion: PipelineVersion
): {
  added: any[]
  removed: any[]
  modified: any[]
} {
  const fromSteps = (fromVersion.steps || []) as Array<{ order: number; agent_id: string }>
  const toSteps = (toVersion.steps || []) as Array<{ order: number; agent_id: string }>

  const fromStepsMap = new Map(fromSteps.map(s => [s.order, s]))
  const toStepsMap = new Map(toSteps.map(s => [s.order, s]))

  const added: any[] = []
  const removed: any[] = []
  const modified: any[] = []

  // Verificar steps adicionados ou modificados
  for (const [order, toStep] of toStepsMap) {
    const fromStep = fromStepsMap.get(order)
    
    if (!fromStep) {
      added.push({ order, step: toStep })
    } else if (fromStep.agent_id !== toStep.agent_id) {
      modified.push({
        order,
        from: fromStep,
        to: toStep,
      })
    }
  }

  // Verificar steps removidos
  for (const [order, fromStep] of fromStepsMap) {
    if (!toStepsMap.has(order)) {
      removed.push({ order, step: fromStep })
    }
  }

  return { added, removed, modified }
}

