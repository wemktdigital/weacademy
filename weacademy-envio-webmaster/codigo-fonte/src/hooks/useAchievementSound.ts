'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type SoundType = 'achievement' | 'level-up' | 'rare' | 'epic' | 'legendary'

interface UseAchievementSoundOptions {
  enabled?: boolean
}

// URLs dos sons (podem ser substituídos por arquivos reais depois)
const SOUND_URLS: Record<SoundType, string> = {
  achievement: '/sounds/achievement.mp3',
  'level-up': '/sounds/level-up.mp3',
  rare: '/sounds/rare.mp3',
  epic: '/sounds/epic.mp3',
  legendary: '/sounds/legendary.mp3',
}

// Fallback: sons sintetizados usando Web Audio API
function createFallbackSound(type: SoundType): void {
  try {
    if (typeof window === 'undefined') return
    
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContext) return
    
    const audioContext = new AudioContext()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    // Configurações por tipo
    const configs: Record<SoundType, { frequency: number; duration: number; volume: number }> = {
      achievement: { frequency: 440, duration: 200, volume: 0.3 },
      'level-up': { frequency: 523, duration: 300, volume: 0.4 },
      rare: { frequency: 587, duration: 250, volume: 0.35 },
      epic: { frequency: 659, duration: 300, volume: 0.4 },
      legendary: { frequency: 784, duration: 500, volume: 0.5 },
    }

    const config = configs[type]
    oscillator.frequency.value = config.frequency
    oscillator.type = 'sine'
    gainNode.gain.setValueAtTime(config.volume, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + config.duration / 1000)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + config.duration / 1000)
  } catch (error) {
    console.warn('Web Audio API não disponível para fallback sound', error)
  }
}

export function useAchievementSound(options: UseAchievementSoundOptions = {}) {
  const { enabled = true } = options
  const [soundEnabled, setSoundEnabled] = useState(enabled)
  const audioRefs = useRef<Record<SoundType, HTMLAudioElement | null>>({
    achievement: null,
    'level-up': null,
    rare: null,
    epic: null,
    legendary: null,
  })

  // Carregar preferência do localStorage
  useEffect(() => {
    const saved = localStorage.getItem('achievement-sound-enabled')
    if (saved !== null) {
      setSoundEnabled(saved === 'true')
    }
  }, [])

  // Salvar preferência
  useEffect(() => {
    localStorage.setItem('achievement-sound-enabled', String(soundEnabled))
  }, [soundEnabled])

  // Carregar áudios
  useEffect(() => {
    if (typeof window === 'undefined') return

    Object.keys(SOUND_URLS).forEach((type) => {
      const audioType = type as SoundType
      try {
        const audio = new Audio(SOUND_URLS[audioType])
        audio.preload = 'auto'
        audio.volume = 0.5
        audioRefs.current[audioType] = audio

        // Se falhar, usar fallback
        audio.addEventListener('error', () => {
          audioRefs.current[audioType] = null
        })
      } catch (error) {
        console.warn(`Erro ao carregar som ${audioType}:`, error)
        audioRefs.current[audioType] = null
      }
    })
  }, [])

  const playSound = useCallback(
    (type: SoundType) => {
      if (!soundEnabled) return

      const audio = audioRefs.current[type]

      if (audio) {
        try {
          audio.currentTime = 0
          audio.play().catch((error) => {
            console.warn(`Erro ao tocar som ${type}:`, error)
            // Tentar fallback
            createFallbackSound(type)
          })
        } catch (error) {
          console.warn(`Erro ao tocar som ${type}:`, error)
          createFallbackSound(type)
        }
      } else {
        // Usar fallback se áudio não carregou
        createFallbackSound(type)
      }
    },
    [soundEnabled]
  )

  return {
    playSound,
    soundEnabled,
    setSoundEnabled,
  }
}

