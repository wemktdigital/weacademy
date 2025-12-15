'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X, Maximize2 } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ImageGridProps {
  images: string[]
  className?: string
}

export function ImageGrid({ images, className }: ImageGridProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set())

  if (images.length === 0) return null

  const handleImageError = (index: number) => {
    setImageErrors(prev => new Set(prev).add(index))
  }

  const validImages = images.filter((_, index) => !imageErrors.has(index))

  if (validImages.length === 0) return null

  // Para 1 imagem: mostrar grande
  if (validImages.length === 1) {
    return (
      <div className={cn('my-4', className)}>
        <div className="relative w-full max-w-2xl mx-auto rounded-lg overflow-hidden border border-border group">
          <button
            type="button"
            onClick={() => setSelectedImage(validImages[0])}
            className="w-full h-auto cursor-pointer"
          >
            {validImages[0].startsWith('data:') || validImages[0].length > 1000000 ? (
              <img
                src={validImages[0]}
                alt="Imagem gerada"
                className="w-full h-auto"
                onError={() => handleImageError(0)}
              />
            ) : (
              <Image
                src={validImages[0]}
                alt="Imagem gerada"
                width={800}
                height={800}
                className="w-full h-auto"
                unoptimized={validImages[0].startsWith('data:')}
                onError={() => handleImageError(0)}
              />
            )}
          </button>
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation()
                setSelectedImage(validImages[0])
              }}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Para múltiplas imagens: mostrar em grid
  const gridCols = validImages.length === 2 ? 'grid-cols-2' : validImages.length <= 4 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'

  return (
    <div className={cn('my-4', className)}>
      <div className={cn('grid gap-4 max-w-4xl mx-auto', gridCols)}>
        {validImages.map((image, index) => (
          <div
            key={index}
            className="relative aspect-square rounded-lg overflow-hidden border border-border group cursor-pointer"
            onClick={() => setSelectedImage(image)}
          >
            {image.startsWith('data:') || image.length > 1000000 ? (
              <img
                src={image}
                alt={`Imagem ${index + 1}`}
                className="w-full h-full object-cover"
                onError={() => handleImageError(index)}
              />
            ) : (
              <Image
                src={image}
                alt={`Imagem ${index + 1}`}
                width={400}
                height={400}
                className="w-full h-full object-cover"
                unoptimized={image.startsWith('data:')}
                onError={() => handleImageError(index)}
              />
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 bg-white/90 hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedImage(image)
                }}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal para imagem ampliada */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-5xl p-0">
          {selectedImage && (
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-10 bg-background/90 hover:bg-background"
                onClick={() => setSelectedImage(null)}
              >
                <X className="h-4 w-4" />
              </Button>
              {selectedImage.startsWith('data:') || selectedImage.length > 1000000 ? (
                <img
                  src={selectedImage}
                  alt="Imagem ampliada"
                  className="w-full h-auto max-h-[80vh] object-contain"
                />
              ) : (
                <Image
                  src={selectedImage}
                  alt="Imagem ampliada"
                  width={1200}
                  height={1200}
                  className="w-full h-auto max-h-[80vh] object-contain"
                  unoptimized={selectedImage.startsWith('data:')}
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

