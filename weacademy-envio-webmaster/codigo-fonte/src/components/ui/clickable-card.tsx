'use client'

import { forwardRef, ReactNode } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'

export interface ClickableCardProps {
  title: string
  description?: string
  href?: string
  onClick?: () => void
  children?: ReactNode
  className?: string
  showArrow?: boolean
  disabled?: boolean
}

export const ClickableCard = forwardRef<HTMLDivElement, ClickableCardProps>(
  ({ title, description, href, onClick, children, className, showArrow = true, disabled = false }, ref) => {
    const cardContent = (
      <Card
        ref={ref}
        className={cn(
          'transition-all duration-300 cursor-pointer group',
          'hover:shadow-lg hover:border-primary/50',
          'active:scale-[0.98]',
          disabled && 'opacity-50 cursor-not-allowed hover:shadow-none hover:border-border',
          className
        )}
        onClick={disabled ? undefined : onClick}
        role={href || onClick ? 'button' : undefined}
        tabIndex={disabled || (!href && !onClick) ? undefined : 0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && (href || onClick) && !disabled) {
            e.preventDefault()
            if (href) {
              window.location.href = href
            } else if (onClick) {
              onClick()
            }
          }
        }}
        aria-label={disabled ? `${title} (desabilitado)` : title}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg group-hover:text-primary transition-colors">
                {title}
              </CardTitle>
              {description && (
                <CardDescription className="mt-1 text-sm">
                  {description}
                </CardDescription>
              )}
            </div>
            {showArrow && !disabled && (
              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
            )}
          </div>
        </CardHeader>
        {children && (
          <CardContent className="pt-0">
            {children}
          </CardContent>
        )}
      </Card>
    )

    if (href && !disabled) {
      return (
        <Link href={href} className="block">
          {cardContent}
        </Link>
      )
    }

    return cardContent
  }
)

ClickableCard.displayName = 'ClickableCard'

