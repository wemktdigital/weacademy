'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { 
  Sun, 
  Moon, 
  Monitor, 
  Check,
  Palette
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

interface ThemeToggleProps {
  variant?: 'default' | 'ghost' | 'outline'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  showLabel?: boolean
}

export function ThemeToggle({ 
  variant = 'ghost', 
  size = 'icon', 
  showLabel = false 
}: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)

  const themes = [
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Escuro', icon: Moon },
    { value: 'system', label: 'Sistema', icon: Monitor },
  ]

  const currentTheme = themes.find(t => t.value === theme) || themes[2]
  const CurrentIcon = currentTheme.icon

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme)
    setIsOpen(false)
  }

  if (showLabel) {
    return (
      <div className="flex items-center space-x-2">
        <Palette className="h-4 w-4" />
        <span className="text-sm font-medium">Tema</span>
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant={variant} size={size} className="justify-start">
              <CurrentIcon className="mr-2 h-4 w-4" />
              {currentTheme.label}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {themes.map((themeOption) => {
              const Icon = themeOption.icon
              return (
                <DropdownMenuItem
                  key={themeOption.value}
                  onClick={() => handleThemeChange(themeOption.value as any)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <Icon className="mr-2 h-4 w-4" />
                    {themeOption.label}
                  </div>
                  {theme === themeOption.value && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size}>
          <CurrentIcon className="h-4 w-4" />
          <span className="sr-only">Alternar tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {themes.map((themeOption) => {
          const Icon = themeOption.icon
          return (
            <DropdownMenuItem
              key={themeOption.value}
              onClick={() => handleThemeChange(themeOption.value as any)}
              className="flex items-center justify-between"
            >
              <div className="flex items-center">
                <Icon className="mr-2 h-4 w-4" />
                {themeOption.label}
              </div>
              {theme === themeOption.value && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Componente simples para toggle rápido
export function SimpleThemeToggle() {
  const { toggleTheme, resolvedTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="relative"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Alternar tema</span>
    </Button>
  )
}
