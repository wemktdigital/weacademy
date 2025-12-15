"use client"

import * as React from "react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts, dismiss } = useToast()

  React.useEffect(() => {
    // Auto-dismiss toasts after 5 seconds
    const timers: NodeJS.Timeout[] = []
    
    toasts.forEach((toast) => {
      if (toast.open !== false) {
        const timer = setTimeout(() => {
          dismiss(toast.id)
        }, 5000)
        timers.push(timer)
      }
    })
    
    return () => {
      timers.forEach(timer => clearTimeout(timer))
    }
  }, [toasts, dismiss])

  return (
    <ToastProvider>
      <ToastViewport />
      {toasts.map(function ({ id, title, description, action, open, ...props }) {
        if (open === false) return null
        
        return (
          <Toast
            key={id}
            variant={props.variant || 'default'}
            {...props}
          >
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose onClose={() => dismiss(id)} />
          </Toast>
        )
      })}
    </ToastProvider>
  )
}

