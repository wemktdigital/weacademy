'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, Lightbulb, Camera, Volume2, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface VeoTipsGuideProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VeoTipsGuide({ open, onOpenChange }: VeoTipsGuideProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Guia Completo: Como Escrever Prompts Eficazes para VEO 3.1
          </DialogTitle>
          <DialogDescription>
            Aprenda as melhores práticas para gerar vídeos de alta qualidade com o VEO 3.1
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)] pr-4">
          <div className="space-y-6">
            {/* Introdução */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Sobre o VEO 3.1</h3>
              <p className="text-sm text-muted-foreground">
                O VEO 3.1 é o modelo mais avançado da Google para geração de vídeos de alta fidelidade. 
                Ele gera vídeos de 8 segundos com resolução 720p ou 1080p, com áudio nativo e realismo cinematográfico.
              </p>
            </div>

            <Separator />

            {/* Como escrever prompts eficazes */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                Como Escrever Prompts Eficazes
              </h3>
              
              <div className="space-y-3">
                <div className="p-4 rounded-lg border bg-card">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Camera className="h-4 w-4 text-primary" />
                    1. Descreva Ações Específicas
                  </h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Em vez de "um cachorro", descreva "um golden retriever correndo pelo parque em um dia ensolarado, 
                    com a grama balançando ao vento".
                  </p>
                  <div className="mt-3 p-3 bg-muted rounded text-xs font-mono">
                    ❌ Ruim: "Um cachorro feliz"<br />
                    ✅ Bom: "Um golden retriever correndo pelo parque, com a cauda balançando e a língua para fora, 
                    cercado por árvores e flores coloridas"
                  </div>
                </div>

                <div className="p-4 rounded-lg border bg-card">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Camera className="h-4 w-4 text-primary" />
                    2. Especifique o Tipo de Tomada
                  </h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Indique o tipo de enquadramento: close-up, wide shot, medium shot, panning, tracking shot, etc.
                  </p>
                  <div className="mt-3 p-3 bg-muted rounded text-xs font-mono">
                    ✅ Exemplo: "Close-up de duas pessoas olhando para um desenho enigmático na parede, 
                    com tochas cintilando. Panning para mostrar o ambiente misterioso ao redor"
                  </div>
                </div>

                <div className="p-4 rounded-lg border bg-card">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-primary" />
                    3. Aproveite o Áudio Nativo
                  </h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    O VEO 3.1 gera áudio nativo! Descreva diálogos, efeitos sonoros e atmosfera sonora.
                  </p>
                  <div className="mt-3 p-3 bg-muted rounded text-xs font-mono">
                    ✅ Exemplo: "Um homem sussurra: 'Este deve ser. Esse é o código secreto.' 
                    A mulher olha para ele e sussurra animadamente: 'O que você encontrou?' 
                    Sons de passos ecoando no corredor, respiração ofegante"
                  </div>
                </div>

                <div className="p-4 rounded-lg border bg-card">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Camera className="h-4 w-4 text-primary" />
                    4. Descreva Movimento e Dinâmica
                  </h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Seja específico sobre como as coisas se movem: velocidade, direção, ritmo.
                  </p>
                  <div className="mt-3 p-3 bg-muted rounded text-xs font-mono">
                    ✅ Exemplo: "Panning suave e lento de uma cachoeira majestosa na floresta havaiana, 
                    com água caindo em cascata, folhas balançando ao vento suave, 
                    e névoa delicada criando arco-íris na luz do sol da manhã"
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Estilos e exemplos */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Estilos e Tipos de Vídeo</h3>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg border bg-card">
                  <Badge variant="outline" className="mb-2">Diálogo & Efeitos Sonoros</Badge>
                  <p className="text-sm text-muted-foreground mb-3">
                    Perfeito para cenas com personagens falando e interagindo.
                  </p>
                  <div className="p-3 bg-muted rounded text-xs font-mono">
                    "Close-up de duas pessoas olhando para um desenho enigmático na parede, 
                    tochas cintilando. Um homem murmura: 'Este deve ser. Esse é o código secreto.' 
                    A mulher olha para ele e sussurra animadamente: 'O que você encontrou?'"
                  </div>
                </div>

                <div className="p-4 rounded-lg border bg-card">
                  <Badge variant="outline" className="mb-2">Realismo Cinematográfico</Badge>
                  <p className="text-sm text-muted-foreground mb-3">
                    Para vídeos com visual cinematográfico e profissional.
                  </p>
                  <div className="p-3 bg-muted rounded text-xs font-mono">
                    "Wide shot de uma paisagem montanhosa ao amanhecer, com neblina suave 
                    cobrindo os vales, cores vibrantes do céu refletindo nas nuvens, 
                    câmera fazendo um movimento de dolly suave para frente"
                  </div>
                </div>

                <div className="p-4 rounded-lg border bg-card">
                  <Badge variant="outline" className="mb-2">Animação Criativa</Badge>
                  <p className="text-sm text-muted-foreground mb-3">
                    Para estilos artísticos e animados.
                  </p>
                  <div className="p-3 bg-muted rounded text-xs font-mono">
                    "Animação em stop-motion de um gatinho tricolor dormindo ao sol, 
                    com movimento suave de respiração, sombras projetadas na parede, 
                    ambiente acolhedor e iluminado"
                  </div>
                </div>

                <div className="p-4 rounded-lg border bg-card">
                  <Badge variant="outline" className="mb-2">Panning Wide Shot</Badge>
                  <p className="text-sm text-muted-foreground mb-3">
                    Para mostrar paisagens e ambientes amplos.
                  </p>
                  <div className="p-3 bg-muted rounded text-xs font-mono">
                    "Panning wide shot de uma cachoeira majestosa na floresta havaiana, 
                    com água caindo em cascata, folhas balançando ao vento suave, 
                    e névoa delicada criando arco-íris na luz do sol da manhã"
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Limitações e considerações */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Limitações e Considerações
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium mb-1">Tempo de Geração</h4>
                    <p className="text-sm text-muted-foreground">
                      Mínimo: 11 segundos | Máximo: 6 minutos (durante horários de pico)
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Camera className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium mb-1">Duração do Vídeo</h4>
                    <p className="text-sm text-muted-foreground">
                      Os vídeos são gerados em 8 segundos (ou 6s, 4s dependendo da configuração). 
                      Quando usando imagens de referência, apenas 8 segundos está disponível.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Camera className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium mb-1">Resolução</h4>
                    <p className="text-sm text-muted-foreground">
                      720p e 1080p disponíveis. 720p apenas quando usando extensão de vídeo.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium mb-1">Retenção de Vídeo</h4>
                    <p className="text-sm text-muted-foreground">
                      Os vídeos gerados são armazenados no servidor por 2 dias. 
                      Faça o download dentro deste período para salvar uma cópia local.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium mb-1">Watermarking e Segurança</h4>
                    <p className="text-sm text-muted-foreground">
                      Vídeos criados pelo VEO são marcados com SynthID para identificação de conteúdo gerado por IA. 
                      Os vídeos passam por filtros de segurança e verificação de memorização.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Volume2 className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium mb-1">Erros de Áudio</h4>
                    <p className="text-sm text-muted-foreground">
                      O VEO 3.1 pode bloquear a geração de vídeo devido a filtros de segurança ou problemas 
                      de processamento de áudio. Você não será cobrado se o vídeo for bloqueado.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Dicas finais */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Dicas Finais</h3>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                <li>Seja específico e detalhado - mais detalhes geralmente resultam em melhores vídeos</li>
                <li>Combine descrições visuais com informações de áudio para resultados mais ricos</li>
                <li>Mencione o tipo de tomada e movimento da câmera para maior controle criativo</li>
                <li>Use referências de estilo visual e atmosfera para guiar a geração</li>
                <li>Teste diferentes variações do mesmo prompt para encontrar o melhor resultado</li>
              </ul>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between">
          <Link
            href="https://ai.google.dev/gemini-api/docs/video"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              Documentação Oficial
            </Button>
          </Link>
          <Button onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

