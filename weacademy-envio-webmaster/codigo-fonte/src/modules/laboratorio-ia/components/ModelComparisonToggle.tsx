'use client'

import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { GitCompare } from 'lucide-react'

interface ModelComparisonToggleProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
}

export function ModelComparisonToggle({ enabled, onToggle }: ModelComparisonToggleProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card">
      <GitCompare className="h-4 w-4 text-muted-foreground" />
      <Label htmlFor="comparison-mode" className="text-sm cursor-pointer">
        Comparar Modelos
      </Label>
      <Switch
        id="comparison-mode"
        checked={enabled}
        onCheckedChange={onToggle}
      />
    </div>
  )
}

