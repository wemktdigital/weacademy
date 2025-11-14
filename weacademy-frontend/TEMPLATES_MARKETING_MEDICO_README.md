# Templates de Marketing Médico

Este diretório contém 16 templates de agentes especializados em marketing médico, prontos para importação.

## 📋 Templates Incluídos

1. **Criador de Postagens Sociais Médicas** 📱
2. **Escritor de Artigos Médicos para Blog** 📝
3. **Criador de Newsletter Médica** 📧
4. **Gerador de Copy para Anúncios Médicos** ✍️
5. **Analisador de Performance de Marketing Médico** 📊
6. **Planejador de Campanhas Médicas** 🎯
7. **Auditor de Compliance Médico** ✅
8. **Criador de Infográficos Médicos** 📊
9. **Desenvolvedor de Materiais para Pacientes** 📄
10. **Gerador de Perguntas Frequentes Médicas** ❓
11. **Especialista em SEO Médico** 🔍
12. **Criador de Vídeo Scripts Médicos** 🎬
13. **Especialista em Marketing para Especialidades** 🎨
14. **Gerador de Depoimentos e Cases Médicos** 💬
15. **Criador de Emails para Follow-up Médico** 📬
16. **Desenvolvedor de Chatbot Médico** 💬

## 🚀 Como Importar

### Opção 1: Importação via API (Recomendado)

1. Acesse o admin do sistema como usuário `admin` ou `gestor_we`
2. Vá até `/ai-lab/admin/agents/templates`
3. Use o botão "Importar Templates" e selecione o arquivo `templates-marketing-medico.json`
4. Ou use a API diretamente:

```bash
curl -X POST http://localhost:3001/api/lab-ia/admin/templates/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d @templates-marketing-medico.json
```

### Opção 2: Via Migração SQL

Execute a migração SQL diretamente no Supabase:

```bash
# Via Supabase CLI
supabase db push

# Ou execute diretamente no Supabase Dashboard:
# Vá em SQL Editor > Cole o conteúdo de:
# supabase/migrations/20250130000000_insert_marketing_medico_templates.sql
```

## 📝 Estrutura dos Templates

Cada template contém:

- **name**: Nome do template
- **description**: Descrição breve do que faz
- **icon**: Emoji representativo
- **category**: `marketing_médico`
- **provider**: `OpenAI`
- **model**: `gpt-4o-mini`
- **prompt**: Prompt especializado detalhado
- **type**: `llm`

## ✅ Validação

Todos os templates foram validados contra o schema `agentSchema` do Zod e estão prontos para uso imediato.

## 🎯 Próximos Passos

Após importar os templates:

1. Acesse `/ai-lab/admin/agents/templates` para visualizar todos os templates
2. Clique em um template para criar um agente baseado nele
3. Personalize o agente conforme necessário
4. Ative o agente para uso no Laboratório de IA

## 📚 Categorias

Todos os templates estão na categoria `marketing_médico` e podem ser filtrados por essa categoria na interface de templates.

