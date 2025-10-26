'use client'

import { useEffect, useState } from 'react'
import ReactPlayer from 'react-player/lazy'
import { PlayCircle, PauseCircle } from 'lucide-react'

interface VideoPlayerProps {
  url: string
  provider?: 'youtube' | 'vimeo'
  title?: string
  onProgress?: (seconds: number) => void
  onComplete?: () => void
  className?: string
}

export function VideoPlayer({
  url,
  provider = 'youtube',
  title,
  onProgress,
  onComplete,
  className = '',
}: VideoPlayerProps) {
  const [playing, setPlaying] = useState(false)
  const [played, setPlayed] = useState(0)
  const [duration, setDuration] = useState(0)

  const handleProgress = (state: { playedSeconds: number }) => {
    setPlayed(state.playedSeconds)
    onProgress?.(state.playedSeconds)
  }

  const handleEnded = () => {
    setPlaying(false)
    onComplete?.()
  }

  // Extratir ID do YouTube
  const getYouTubeId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)
    return match ? match[1] : null
  }

  // Extrair ID do Vimeo
  const getVimeoId = (url: string) => {
    const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
    return match ? match[1] : null
  }

  const playerUrl = provider === 'youtube' 
    ? `https://www.youtube.com/watch?v=${getYouTubeId(url)}`
    : `https://vimeo.com/${getVimeoId(url)}`

  return (
    <div className={`relative w-full aspect-video bg-black rounded-lg overflow-hidden ${className}`}>
      <ReactPlayer
        url={playerUrl}
        playing={playing}
        onProgress={handleProgress}
        onDuration={setDuration}
        onEnded={handleEnded}
        width="100%"
        height="100%"
        controls
        config={{
          youtube: {
            playerVars: {
              modestbranding: 1,
              rel: 0,
              showinfo: 0,
            },
          },
          vimeo: {
            playerOptions: {
              responsive: true,
              title: false,
              byline: false,
            },
          },
        }}
      />
      {title && (
        <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-2 rounded-lg">
          <p className="font-semibold">{title}</p>
        </div>
      )}
    </div>
  )
}
