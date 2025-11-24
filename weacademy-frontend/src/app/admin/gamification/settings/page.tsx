'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { GamificationSettings } from '@/components/admin/gamification/GamificationSettings'
import { ArrowLeft, Settings } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface GamificationSettingsData {
  settings: {
    xp_multiplier: number
    streak_bonus: number
  }
  enabled: boolean
  beta_users: string[]
}

export default function GamificationSettingsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<GamificationSettingsData | null>(null)

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      router.push('/access-denied')
      return
    }

    if (isAdmin) {
      loadSettings()
    }
  }, [user, isAdmin, authLoading, router])

  const loadSettings = async () => {
    try {
      setLoading(true)

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch('/api/admin/gamification/settings', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Erro ao buscar configurações')
      }

      const data = await response.json()
      setSettings(data.settings || null)
    } catch (error: any) {
      console.error('Error loading settings:', error)
      toast.error(error.message || 'Erro ao carregar configurações')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (data: GamificationSettingsData) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch('/api/admin/gamification/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao salvar configurações')
      }

      const savedData = await response.json()
      setSettings(savedData.settings)
    } catch (error: any) {
      throw error
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container py-6">
          <div className="flex items-center gap-4">
            <Link href="/admin/gamification">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold flex items-center space-x-2">
                <Settings className="h-8 w-8 text-primary" />
                <span>Configurações de Gamificação</span>
              </h1>
              <p className="text-muted-foreground mt-1">
                Configure opções gerais do sistema de gamificação
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <Card>
          <CardContent className="pt-6">
            <GamificationSettings
              settings={settings || undefined}
              onSave={handleSave}
              loading={loading}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

