'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Smile } from 'lucide-react'

// Categorias de emojis relevantes para agentes de IA
const EMOJI_CATEGORIES = {
  robots: {
    name: 'Robôs',
    emojis: ['🤖', '👾', '🤖‍♀️', '🤖‍♂️', '👽', '🛸', '🎮', '🎯']
  },
  tech: {
    name: 'Tecnologia',
    emojis: ['💻', '🖥️', '⌨️', '🖱️', '📱', '💾', '💿', '📀', '🔌', '⚡', '🔋', '📡', '🌐', '💡', '🔬', '⚗️', '🧪', '🔭']
  },
  medical: {
    name: 'Médico',
    emojis: ['🏥', '⚕️', '🩺', '💊', '💉', '🦠', '🧬', '🩻', '🩹', '🏩', '🚑', '👨‍⚕️', '👩‍⚕️', '🧑‍⚕️']
  },
  communication: {
    name: 'Comunicação',
    emojis: ['💬', '📢', '📣', '📯', '🔔', '📧', '📨', '💌', '📮', '📪', '📫', '📬', '📭']
  },
  writing: {
    name: 'Escrita',
    emojis: ['📝', '✍️', '📄', '📃', '📑', '📊', '📈', '📉', '📋', '📌', '📍', '📎', '🖇️', '📏', '📐', '✂️', '📓', '📔', '📒', '📕', '📗', '📘', '📙', '📚', '📖']
  },
  business: {
    name: 'Negócios',
    emojis: ['💼', '📊', '📈', '📉', '💰', '💵', '💴', '💶', '💷', '💸', '💳', '🧾', '📇', '📑', '📋']
  },
  education: {
    name: 'Educação',
    emojis: ['🎓', '📚', '📖', '📗', '📘', '📙', '📕', '📔', '📒', '📓', '📝', '✏️', '✒️', '🖊️', '🖋️', '📏', '📐']
  },
  common: {
    name: 'Comuns',
    emojis: ['⭐', '✨', '🌟', '💫', '🔥', '💎', '🎯', '🎨', '🎭', '🎪', '🎬', '🎤', '🎧', '🎵', '🎶', '🎼', '🎹', '🥁', '🎺', '🎸', '🎻', '🎲', '🎰', '🎳', '🎮', '🕹️']
  }
}

const ALL_EMOJIS = Object.values(EMOJI_CATEGORIES).flatMap(cat => cat.emojis)

interface EmojiPickerProps {
  value: string
  onChange: (emoji: string) => void
  trigger?: React.ReactNode
}

export function EmojiPicker({ value, onChange, trigger }: EmojiPickerProps) {
  const [open, setOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof EMOJI_CATEGORIES | 'all'>('all')

  const filteredEmojis = selectedCategory === 'all'
    ? ALL_EMOJIS
    : EMOJI_CATEGORIES[selectedCategory].emojis

  const handleEmojiSelect = (emoji: string) => {
    onChange(emoji)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
          >
            <span className="text-2xl mr-2">{value || '🤖'}</span>
            <span className="text-sm text-muted-foreground">
              {value ? 'Alterar ícone' : 'Escolher ícone'}
            </span>
            <Smile className="ml-auto h-4 w-4" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 space-y-2">
          {/* Categorias */}
          <div className="flex flex-wrap gap-1 pb-2 border-b">
            <Button
              type="button"
              variant={selectedCategory === 'all' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSelectedCategory('all')}
            >
              Todos
            </Button>
            {Object.entries(EMOJI_CATEGORIES).map(([key, cat]) => (
              <Button
                key={key}
                type="button"
                variant={selectedCategory === key ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSelectedCategory(key as keyof typeof EMOJI_CATEGORIES)}
              >
                {cat.name}
              </Button>
            ))}
          </div>

          {/* Grid de Emojis */}
          <div className="grid grid-cols-8 gap-1 max-h-64 overflow-y-auto p-2">
            {filteredEmojis.map((emoji, index) => (
              <button
                key={`${emoji}-${index}`}
                type="button"
                onClick={() => handleEmojiSelect(emoji)}
                className="text-2xl hover:bg-muted rounded p-1 transition-colors cursor-pointer aspect-square flex items-center justify-center"
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>

          {filteredEmojis.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhum emoji encontrado
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
