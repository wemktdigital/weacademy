'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Trash2, XCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'destructive' | 'warning' | 'info'
  isLoading?: boolean
}

const VARIANT_CONFIG = {
  destructive: {
    icon: Trash2,
    iconColor: 'text-destructive',
    buttonVariant: 'destructive' as const,
    titleColor: 'text-destructive',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-yellow-600 dark:text-yellow-500',
    buttonVariant: 'default' as const,
    titleColor: 'text-yellow-600 dark:text-yellow-500',
  },
  info: {
    icon: Info,
    iconColor: 'text-blue-600 dark:text-blue-500',
    buttonVariant: 'default' as const,
    titleColor: 'text-foreground',
  },
}

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'destructive',
  isLoading = false,
}: ConfirmDialogProps) {
  const config = VARIANT_CONFIG[variant]
  const Icon = config.icon

  const handleConfirm = () => {
    onConfirm()
    if (!isLoading) {
      onOpenChange(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn('rounded-full p-2 bg-muted', config.iconColor)}>
              <Icon className={cn('h-5 w-5', config.iconColor)} />
            </div>
            <AlertDialogTitle className={cn('text-lg font-semibold', config.titleColor)}>
              {title}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2 text-sm text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={config.buttonVariant}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Processando...' : confirmText}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

