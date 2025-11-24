# Plano para Implementar Notificações Assíncronas para VEO 3.1

## Problema Identificado
Vídeos do VEO 3.1 podem levar de 11 segundos a 6 minutos para serem gerados. Atualmente, o usuário precisa permanecer no chat aguardando. Seria melhor permitir que o usuário saia e receba uma notificação quando o vídeo estiver pronto.

## Tarefas

### 1. Criar tabela no Supabase para operações assíncronas
- **Arquivo**: Criar migration no Supabase
- **Ação**:
  - Criar tabela `lab_video_operations` com campos:
    - `id` (UUID, primary key)
    - `user_id` (UUID, foreign key para profiles)
    - `conversation_id` (UUID, foreign key para lab_conversations)
    - `message_id` (UUID, foreign key para lab_messages)
    - `model` (text)
    - `prompt` (text)
    - `operation_name` (text) - nome da operação do Google
    - `status` (text) - pending, processing, completed, failed
    - `video_url` (text, nullable)
    - `video_data_url` (text, nullable) - base64 do vídeo
    - `error_message` (text, nullable)
    - `created_at` (timestamp)
    - `updated_at` (timestamp)
    - `completed_at` (timestamp, nullable)

### 2. Modificar callVeo para salvar operação no banco
- **Arquivo**: `weacademy-frontend/src/modules/laboratorio-ia/services/llmRouter.ts`
- **Localização**: Função `callVeo`
- **Ação**:
  - Após criar a operação inicial, salvar no banco com status "pending"
  - Retornar imediatamente uma mensagem informando que o vídeo está sendo processado
  - Incluir o ID da operação na mensagem
  - Não fazer polling imediatamente, deixar para processamento em background

### 3. Criar API route para processar operações em background
- **Arquivo**: `weacademy-frontend/src/app/api/lab-ia/videos/poll/route.ts` (novo)
- **Ação**:
  - Endpoint POST que processa operações pendentes
  - Buscar operações com status "pending" ou "processing"
  - Fazer polling das operações do Google
  - Atualizar status no banco quando completo
  - Fazer download do vídeo e salvar como base64
  - Pode ser chamado por um cron job ou webhook

### 4. Criar API route para verificar status de operação
- **Arquivo**: `weacademy-frontend/src/app/api/lab-ia/videos/status/[operationId]/route.ts` (novo)
- **Ação**:
  - Endpoint GET para verificar status de uma operação específica
  - Retorna status atual e vídeo se disponível
  - Usado pelo frontend para verificar periodicamente

### 5. Implementar sistema de notificações
- **Arquivo**: Criar serviço de notificações
- **Ação**:
  - Usar polling no frontend para verificar status periodicamente
  - Quando vídeo estiver pronto, enviar notificação toast
  - Permitir navegar para a mensagem com o vídeo
  - Opcional: Implementar WebSockets ou Server-Sent Events para notificações em tempo real

### 6. Modificar frontend para exibir status de operações pendentes
- **Arquivo**: `weacademy-frontend/src/app/ai-lab/page.tsx`
- **Ação**:
  - Verificar operações pendentes ao carregar conversa
  - Exibir indicador de "Processando vídeo..." para operações pendentes
  - Atualizar automaticamente quando vídeo estiver pronto
  - Mostrar botão para verificar status manualmente

### 7. Adicionar notificação visual quando vídeo estiver pronto
- **Arquivo**: `weacademy-frontend/src/app/ai-lab/page.tsx`
- **Ação**:
  - Usar toast notification quando vídeo estiver pronto
  - Permitir navegar para a mensagem com o vídeo
  - Mostrar preview do vídeo na notificação (opcional)

### 8. Criar página de status de operações (opcional)
- **Arquivo**: `weacademy-frontend/src/app/ai-lab/videos/status/page.tsx` (novo)
- **Ação**:
  - Página para visualizar todas as operações de vídeo do usuário
  - Mostrar status, progresso, e links para vídeos prontos
  - Permitir cancelar operações pendentes (se suportado pela API)

### 9. Implementar webhook ou cron job para processar operações
- **Opção A**: Webhook do Google (se disponível)
- **Opção B**: Cron job que verifica operações pendentes periodicamente
- **Ação**:
  - Verificar operações com status "pending" ou "processing" periodicamente
  - Fazer polling da API do Google
  - Atualizar status quando completo
  - Pode usar Vercel Cron Jobs ou similar

### 10. Testar implementação completa
- Testar criação de operação
- Testar processamento em background
- Testar notificações
- Testar exibição de vídeo quando pronto
- Testar navegação entre conversas durante processamento

## Notas Importantes
- A API do VEO 3.1 usa operações assíncronas, então é necessário implementar polling
- O vídeo gerado fica disponível por 2 dias no servidor do Google
- A latência pode variar de 11 segundos a 6 minutos (durante horários de pico)
- Os vídeos são gerados com áudio nativo
- Resolução suportada: 720p e 1080p (8 segundos) ou 720p apenas (extensão de vídeo)

