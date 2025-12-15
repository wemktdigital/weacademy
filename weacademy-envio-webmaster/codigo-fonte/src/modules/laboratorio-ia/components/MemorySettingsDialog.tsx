'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Brain } from 'lucide-react'
import { MemorySettings } from '@/components/lab-ia/MemorySettings'

interface MemorySettingsDialogProps {
  children?: React.ReactNode
}

export function MemorySettingsDialog({ children }: MemorySettingsDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Brain className="h-4 w-4 mr-2" />
            Memória
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Configurações de Memória
          </DialogTitle>
          <DialogDescription>
            Controle como o Laboratório de IA usa suas informações para personalizar respostas
          </DialogDescription>
        </DialogHeader>
        <MemorySettings />
      </DialogContent>
    </Dialog>
  )
}

