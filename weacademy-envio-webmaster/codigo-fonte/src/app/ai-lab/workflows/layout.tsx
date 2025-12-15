'use client'

import { PropsWithChildren, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface NavItem {
  name: string
  href: string
}

export default function WorkflowsLayout({ children }: PropsWithChildren) {
  const pathname = usePathname()

  const navItems = useMemo<NavItem[]>(() => [
    { name: 'Instâncias', href: '/ai-lab/workflows/instances' },
    { name: 'Designer', href: '/ai-lab/workflows/designer' },
    { name: 'Métricas', href: '/ai-lab/workflows/analytics' },
  ], [])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between py-4">
          <div className="flex items-center gap-6">
            <Link href="/ai-lab" className="text-sm font-semibold text-primary">
              ← Voltar para o Laboratório IA
            </Link>
            <h1 className="text-xl font-bold">Workflows</h1>
          </div>
          <nav className="flex items-center gap-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Button
                  key={item.href}
                  asChild
                  variant={isActive ? 'default' : 'ghost'}
                >
                  <Link
                    href={item.href}
                    className={cn(
                      'text-sm font-medium transition-colors',
                      isActive ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {item.name}
                  </Link>
                </Button>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 bg-muted/20">{children}</main>
    </div>
  )
}

