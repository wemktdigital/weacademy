'use client'

import { ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Search, X, Filter, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FilterOption {
  value: string
  label: string
}

export interface SortOption {
  value: string
  label: string
}

export interface AccessibleFiltersProps {
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  searchLabel?: string
  filters?: Array<{
    id: string
    label: string
    value: string
    options: FilterOption[]
    onChange: (value: string) => void
  }>
  sort?: {
    value: string
    options: SortOption[]
    onChange: (value: string) => void
  }
  showClearButton?: boolean
  onClear?: () => void
  className?: string
  layout?: 'row' | 'column'
}

export function AccessibleFilters({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Buscar...',
  searchLabel = 'Buscar',
  filters = [],
  sort,
  showClearButton = true,
  onClear,
  className,
  layout = 'row',
}: AccessibleFiltersProps) {
  const hasActiveFilters = searchValue || filters.some(f => f.value !== 'all') || (sort && sort.value !== 'default')

  const handleClear = () => {
    onSearchChange('')
    filters.forEach(f => f.onChange('all'))
    if (sort) {
      sort.onChange('default')
    }
    if (onClear) {
      onClear()
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div
        className={cn(
          'flex flex-wrap items-end gap-3',
          layout === 'column' && 'flex-col items-stretch'
        )}
        role="group"
        aria-label="Filtros e busca"
      >
        {/* Busca */}
        <div className="flex-1 min-w-[200px]">
          <Label htmlFor="search-input" className="sr-only">
            {searchLabel}
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search-input"
              type="search"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 pr-10"
              aria-label={searchLabel}
            />
            {searchValue && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                onClick={() => onSearchChange('')}
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Filtros */}
        {filters.map((filter) => (
          <div key={filter.id} className="w-full sm:w-auto">
            <Label htmlFor={`filter-${filter.id}`} className="sr-only">
              {filter.label}
            </Label>
            <Select
              value={filter.value}
              onValueChange={filter.onChange}
            >
              <SelectTrigger
                id={`filter-${filter.id}`}
                className="w-full sm:w-[180px]"
                aria-label={filter.label}
              >
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}

        {/* Ordenação */}
        {sort && (
          <div className="w-full sm:w-auto">
            <Label htmlFor="sort-select" className="sr-only">
              Ordenar por
            </Label>
            <Select value={sort.value} onValueChange={sort.onChange}>
              <SelectTrigger
                id="sort-select"
                className="w-full sm:w-[180px]"
                aria-label="Ordenar por"
              >
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                {sort.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Botão Limpar */}
        {showClearButton && hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="w-full sm:w-auto"
            aria-label="Limpar todos os filtros"
          >
            <X className="h-4 w-4 mr-2" />
            Limpar
          </Button>
        )}
      </div>

      {/* Resumo de filtros ativos */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium">Filtros ativos:</span>
          {searchValue && (
            <span className="px-2 py-1 bg-muted rounded-md">
              Busca: &quot;{searchValue}&quot;
            </span>
          )}
          {filters
            .filter(f => f.value !== 'all')
            .map((filter) => {
              const option = filter.options.find(o => o.value === filter.value)
              return (
                <span key={filter.id} className="px-2 py-1 bg-muted rounded-md">
                  {filter.label}: {option?.label}
                </span>
              )
            })}
          {sort && sort.value !== 'default' && (
            <span className="px-2 py-1 bg-muted rounded-md">
              Ordenação: {sort.options.find(o => o.value === sort.value)?.label}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

