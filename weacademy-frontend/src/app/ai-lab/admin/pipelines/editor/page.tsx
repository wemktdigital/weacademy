'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PipelineEditor } from '@/modules/laboratorio-ia/components/PipelineEditor'
import type { Pipeline } from '@/lib/validations/pipeline.schema'
import type { Agent } from '@/lib/validations/agent.schema'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function PipelineEditorPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pipelineId = searchParams?.get('id')
  
  const [agents, setAgents] = useState<Agent[]>([])
  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAgents()
    if (pipelineId) {
      fetchPipeline(pipelineId)
    } else {
      setLoading(false)
    }
  }, [pipelineId])

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/lab-ia/agents')
      if (!response.ok) throw new Error('Failed to fetch agents')
      const data = await response.json()
      setAgents(data.agents || [])
    } catch (error) {
      console.error('Error fetching agents:', error)
      toast.error('Erro ao carregar agentes')
    }
  }

  const fetchPipeline = async (id: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch(`/api/lab-ia/admin/pipelines`, {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        credentials: 'include',
      })

      if (!response.ok) throw new Error('Failed to fetch pipeline')

      const data = await response.json()
      const foundPipeline = data.pipelines?.find((p: Pipeline) => p.id === id)
      
      if (foundPipeline) {
        setPipeline(foundPipeline)
      } else {
        toast.error('Pipeline não encontrado')
        router.push('/ai-lab/admin/pipelines')
      }
    } catch (error) {
      console.error('Error fetching pipeline:', error)
      toast.error('Erro ao carregar pipeline')
      router.push('/ai-lab/admin/pipelines')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (pipelineData: Omit<Pipeline, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const url = pipelineId
        ? `/api/lab-ia/admin/pipelines/${pipelineId}`
        : '/api/lab-ia/admin/pipelines'

      const method = pipelineId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        credentials: 'include',
        body: JSON.stringify(pipelineData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || `Erro HTTP ${response.status}`)
      }

      const savedPipeline = await response.json()
      
      toast.success(
        pipelineId
          ? 'Pipeline atualizado com sucesso!'
          : 'Pipeline criado com sucesso!'
      )

      // Redirecionar para a página de pipelines
      router.push('/ai-lab/admin/pipelines')
    } catch (error: any) {
      console.error('Error saving pipeline:', error)
      toast.error(error.message || 'Erro ao salvar pipeline')
      throw error
    }
  }

  const handleCancel = () => {
    router.push('/ai-lab/admin/pipelines')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      <PipelineEditor
        agents={agents}
        pipeline={pipeline || undefined}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  )
}

