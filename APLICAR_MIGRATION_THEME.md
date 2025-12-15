# 🔧 Aplicar Migration: User Preferences (Theme)

## Problema Identificado

O erro 400 ao buscar o campo `theme` na tabela `profiles` ocorre porque a migration `20241020000003_user_preferences.sql` não foi aplicada.

## Solução

A migration foi corrigida e está pronta para aplicação. Ela adiciona:
- Campo `theme` na tabela `profiles`
- Campo `preferences` (JSONB)
- Campo `notification_settings` (JSONB)
- Funções auxiliares e triggers

## Como Aplicar

1. Acesse o SQL Editor no Supabase Dashboard
2. Execute o conteúdo do arquivo:
   ```
   weacademy-frontend/supabase/migrations/20241020000003_user_preferences.sql
   ```

## Após Aplicar

O erro 400 deve desaparecer e o tema do usuário será carregado corretamente.
