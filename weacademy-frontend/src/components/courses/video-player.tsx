'use client'

import { useEffect, useState } from 'react'
import ReactPlayer from 'react-player'
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

  return (
    <div className={`relative w-full aspect-video bg-black rounded-lg overflow-hidden ${className}`}>
      {(ReactPlayer as any) && (
        <ReactPlayer
          // @ts-ignore
          url={url}
          playing={playing}
          onProgress={handleProgress as any}
          onDuration={setDuration}
          onEnded={handleEnded}
          width="100%"
          height="100%"
          controls
          config={{
            youtube: {
              // playerVars properties directly
              modestbranding: 1,
              rel: 0,
              showinfo: 0,
            } as any,
            vimeo: {
              // playerOptions properties directly
              responsive: true,
              title: false,
              byline: false,
            } as any,
          }}
        />
      )}
      {title && (
        <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-2 rounded-lg">
          <p className="font-semibold">{title}</p>
        </div>
      )}
    </div>
  )
}
