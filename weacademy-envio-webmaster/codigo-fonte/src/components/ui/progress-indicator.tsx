'use client'

import { Progress } from '@/components/ui/progress'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ProgressIndicatorProps {
  progress: number // 0-100
  status?: 'loading' | 'success' | 'error' | 'idle'
  label?: string
  description?: string
  showPercentage?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_STYLES = {
  sm: {
    progress: 'h-1.5',
    text: 'text-xs',
    icon: 'h-3 w-3',
  },
  md: {
    progress: 'h-2',
    text: 'text-sm',
    icon: 'h-4 w-4',
  },
  lg: {
    progress: 'h-3',
    text: 'text-base',
    icon: 'h-5 w-5',
  },
}

export function ProgressIndicator({
  progress,
  status = 'loading',
  label,
  description,
  showPercentage = true,
  size = 'md',
  className,
}: ProgressIndicatorProps) {
  const styles = SIZE_STYLES[size]
  const clampedProgress = Math.min(Math.max(progress, 0), 100)

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className={cn(styles.icon, 'animate-spin text-primary')} />
      case 'success':
        return <CheckCircle2 className={cn(styles.icon, 'text-green-600 dark:text-green-400')} />
      case 'error':
        return <AlertCircle className={cn(styles.icon, 'text-destructive')} />
      default:
        return null
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'bg-green-600 dark:bg-green-400'
      case 'error':
        return 'bg-destructive'
      default:
        return 'bg-primary'
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {status !== 'idle' && (
                <div className="flex-shrink-0">
                  {getStatusIcon()}
                </div>
              )}
              <span className={cn('font-medium truncate', styles.text)}>
                {label}
              </span>
            </div>
          )}
          {showPercentage && (
            <span className={cn('font-semibold text-muted-foreground whitespace-nowrap', styles.text)}>
              {Math.round(clampedProgress)}%
            </span>
          )}
        </div>
      )}
      
      <Progress
        value={clampedProgress}
        className={cn(styles.progress, 'transition-all duration-300')}
        style={{
          // @ts-ignore - CSS custom property
          '--progress-background': `var(--${status === 'success' ? 'green' : status === 'error' ? 'destructive' : 'primary'})`,
        }}
      />
      
      {description && (
        <p className={cn('text-muted-foreground', styles.text)}>
          {description}
        </p>
      )}
    </div>
  )
}

export interface TaskProgressProps {
  tasks: Array<{
    id: string
    label: string
    status: 'pending' | 'loading' | 'success' | 'error'
    progress?: number
  }>
  className?: string
}

export function TaskProgress({ tasks, className }: TaskProgressProps) {
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.status === 'success' || t.status === 'error').length
  const overallProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

  return (
    <div className={cn('space-y-4', className)}>
      <ProgressIndicator
        progress={overallProgress}
        status={overallProgress === 100 ? 'success' : 'loading'}
        label={`Processando tarefas`}
        description={`${completedTasks} de ${totalTasks} tarefas concluídas`}
        showPercentage
        size="md"
      />
      
      <div className="space-y-2">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-center gap-3 text-sm">
            {task.status === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            {task.status === 'success' && <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />}
            {task.status === 'error' && <AlertCircle className="h-4 w-4 text-destructive" />}
            {task.status === 'pending' && <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />}
            
            <span className={cn(
              'flex-1',
              task.status === 'success' && 'text-green-600 dark:text-green-400',
              task.status === 'error' && 'text-destructive',
              task.status === 'pending' && 'text-muted-foreground',
            )}>
              {task.label}
            </span>
            
            {task.progress !== undefined && task.status === 'loading' && (
              <span className="text-muted-foreground text-xs">
                {Math.round(task.progress)}%
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

