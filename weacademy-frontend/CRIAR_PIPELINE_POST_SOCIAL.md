# 🚀 Como Criar o Pipeline "Criação Completa de Post Social"

Este guia explica como criar o pipeline exemplo "Criação Completa de Post Social" usando código.

## 📋 Pré-requisitos

Antes de criar o pipeline, você precisa ter criado os seguintes agentes a partir dos templates:

1. ✅ **Criador de Postagens Sociais Médicas** (obrigatório)
2. ✅ **Auditor de Compliance Médico** (obrigatório)
3. ✅ **Especialista em SEO Médico** (opcional, mas recomendado)

### Como criar os agentes:

1. Acesse `/ai-lab/admin/agents/templates`
2. Filtre por categoria: "marketing_médico"
3. Para cada template acima:
   - Clique no template
   - Clique em "Criar Agente a partir deste Template"
   - Salve o agente (pode manter os valores padrão)

## 🛠️ Métodos para Criar o Pipeline

### Método 1: Via Migração SQL (Recomendado)

**Mais fácil e automático!**

1. Após criar os agentes, execute a migração SQL:

```bash
# Via Supabase CLI
supabase db push

# Ou execute diretamente no Supabase Dashboard:
# SQL Editor > Cole o conteúdo de:
# supabase/migrations/20250130000001_create_pipeline_post_social.sql
```

A migração SQL:
- ✅ Busca automaticamente os agentes pelos nomes
- ✅ Cria o pipeline com as etapas corretas
- ✅ Inclui SEO se o agente existir (opcional)
- ✅ Avisa se algum agente não for encontrado

### Método 2: Via Script TypeScript

1. Certifique-se de ter os agentes criados
2. Execute o script:

```bash
npx ts-node scripts/create-pipeline-post-social.ts
```

### Método 3: Via API REST

```bash
curl -X POST http://localhost:3001/api/lab-ia/admin/pipelines \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d @pipeline-criacao-post-social.json
```

**⚠️ Nota:** Você precisa substituir os `UUID_AGENTE_*` no JSON pelos IDs reais dos agentes.

Para obter os IDs:
```sql
SELECT id, name FROM lab_agents 
WHERE name IN (
  'Criador de Postagens Sociais Médicas',
  'Auditor de Compliance Médico',
  'Especialista em SEO Médico'
);
```

### Método 4: Via Interface (Manual)

1. Acesse `/ai-lab/admin/pipelines`
2. Clique em "+ Novo Pipeline"
3. Preencha:
   - **Nome:** "Criação Completa de Post Social"
   - **Descrição:** "Cria post para redes sociais, valida compliance com ANVISA/CFM e otimiza para SEO"
4. Adicione etapas:
   - Etapa 1: Selecione "Criador de Postagens Sociais Médicas"
   - Etapa 2: Selecione "Auditor de Compliance Médico"
   - Etapa 3: Selecione "Especialista em SEO Médico" (opcional)
5. Salve o pipeline

## ✅ Verificar se Funcionou

Após criar o pipeline:

1. **Verificar na interface:**
   - Acesse `/ai-lab/admin/pipelines`
   - Você deve ver o card "Criação Completa de Post Social"

2. **Verificar via SQL:**
```sql
SELECT 
  id,
  name,
  description,
  jsonb_array_length(steps) as num_steps,
  active
FROM lab_agent_pipelines
WHERE name = 'Criação Completa de Post Social';
```

3. **Testar o pipeline:**
   - Acesse `/ai-lab`
   - Selecione o pipeline "Criação Completa de Post Social"
   - Envie: "Crie um post sobre vacinação contra gripe para Instagram"
   - O pipeline executará todas as etapas e retornará o post validado

## 🎯 Exemplo de Uso

**Input:**
```
"Crie um post sobre vacinação contra gripe para Instagram. O post deve ser educativo e chamar atenção para a importância da vacinação."
```

**Output (após as 3 etapas):**
```
[Post criado] → [Validado para compliance] → [Otimizado para SEO]
Resultado final: Post completo, validado e otimizado, pronto para publicação!
```

## 🐛 Solução de Problemas

### Erro: "Agente não encontrado"

**Causa:** Os agentes ainda não foram criados a partir dos templates.

**Solução:** Crie os agentes primeiro:
1. Vá para `/ai-lab/admin/agents/templates`
2. Crie os agentes necessários
3. Execute a migração SQL novamente

### Pipeline não aparece na lista

**Causa:** Pipeline pode estar inativo ou não criado.

**Solução:** 
1. Verifique via SQL se o pipeline existe
2. Se existir mas estiver inativo, ative via interface ou SQL:
```sql
UPDATE lab_agent_pipelines
SET active = true
WHERE name = 'Criação Completa de Post Social';
```

### Pipeline retorna erro ao executar

**Causa:** Um dos agentes pode estar inativo ou ter problemas.

**Solução:**
1. Verifique se todos os agentes estão ativos
2. Teste cada agente individualmente primeiro
3. Verifique os logs no console do servidor

## 📚 Próximos Passos

Após criar e testar este pipeline, você pode:

1. Criar outros pipelines da lista de exemplos
2. Personalizar este pipeline adicionando/removendo etapas
3. Criar pipelines customizados para suas necessidades específicas

---

**Arquivos criados:**
- `pipeline-criacao-post-social.json` - Referência JSON
- `supabase/migrations/20250130000001_create_pipeline_post_social.sql` - Migração SQL automática
- `scripts/create-pipeline-post-social.ts` - Script TypeScript alternativo

