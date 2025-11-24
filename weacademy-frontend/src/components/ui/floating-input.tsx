'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Input } from './input'
import { Label } from './label'

export interface FloatingInputProps extends React.ComponentProps<'input'> {
  label?: string
  error?: string
  success?: boolean
  helperText?: string
  loading?: boolean
  required?: boolean
  showFloatingLabel?: boolean
}

export const FloatingInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ 
    label, 
    error, 
    success, 
    helperText, 
    loading,
    required,
    showFloatingLabel = true,
    className,
    id,
    placeholder,
    value,
    ...props 
  }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false)
    const [hasValue, setHasValue] = React.useState(!!value)
    const inputId = id || React.useId()
    const hasError = !!error
    const hasSuccess = success && !hasError
    const showLabel = showFloatingLabel && label

    React.useEffect(() => {
      setHasValue(!!value || !!props.defaultValue)
    }, [value, props.defaultValue])

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true)
      props.onFocus?.(e)
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false)
      props.onBlur?.(e)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(!!e.target.value)
      props.onChange?.(e)
    }

    const shouldFloatLabel = isFocused || hasValue || !!value

    return (
      <div className="relative w-full">
        {showLabel && (
          <Label
            htmlFor={inputId}
            className={cn(
              'absolute left-3 transition-all duration-200 pointer-events-none',
              shouldFloatLabel
                ? 'top-2 text-xs font-medium'
                : 'top-[50%] translate-y-[-50%] text-sm',
              hasError && 'text-destructive',
              hasSuccess && 'text-green-600 dark:text-green-400',
              !hasError && !hasSuccess && shouldFloatLabel && 'text-muted-foreground',
              !hasError && !hasSuccess && !shouldFloatLabel && 'text-muted-foreground/70',
            )}
          >
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}

        <div className="relative">
          <Input
            {...props}
            ref={ref}
            id={inputId}
            value={value}
            placeholder={showLabel && shouldFloatLabel ? placeholder : (!showLabel ? placeholder : undefined)}
            className={cn(
              'transition-all duration-200',
              showLabel && shouldFloatLabel && 'pt-6 pb-2',
              hasError && 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20',
              hasSuccess && 'border-green-500 focus-visible:border-green-500 focus-visible:ring-green-500/20',
              loading && 'pr-10',
              (hasError || hasSuccess) && 'pr-10',
              className
            )}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            aria-invalid={hasError}
            aria-describedby={
              hasError ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
            }
          />

          {/* Ícones de status */}
          <div className="absolute right-3 top-[50%] translate-y-[-50%]">
            {loading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {!loading && hasError && (
              <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
            )}
            {!loading && hasSuccess && (
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" aria-hidden="true" />
            )}
          </div>
        </div>

        {/* Mensagens de erro e helper */}
        <div className="mt-1.5 min-h-[20px]">
          {hasError && (
            <p
              id={`${inputId}-error`}
              className="text-sm text-destructive flex items-center gap-1.5"
              role="alert"
            >
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{error}</span>
            </p>
          )}
          {!hasError && helperText && (
            <p
              id={`${inputId}-helper`}
              className="text-sm text-muted-foreground"
            >
              {helperText}
            </p>
          )}
        </div>
      </div>
    )
  }
)

FloatingInput.displayName = 'FloatingInput'

