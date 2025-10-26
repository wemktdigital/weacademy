# 📚 Sprint 7 - Biblioteca e Templates de Agentes

**Data:** Janeiro 2025  
**Autor:** WE Academy Development Team

## 📋 Visão Geral

Este sprint implementa uma biblioteca visual de templates de agentes, permitindo criação rápida de agentes a partir de templates pré-configurados. Inclui sistema de categorização, importação/exportação em JSON e integração completa com o CRUD de agentes.

## 🎯 Objetivos Alcançados

✅ **Tabela de Templates**: `lab_agent_templates` com 5 templates padrão  
✅ **Interface de Biblioteca**: Página visual com grid de cards  
✅ **Sistema de Categorias**: Organização por categorias  
✅ **Filtros e Busca**: Por categoria, provedor e busca textual  
✅ **Importação/Exportação**: JSON para compartilhar templates  
✅ **Integração com CRUD**: Templates aplicáveis diretamente  
✅ **UX Premium**: shadcn/ui com dark mode  

## 📦 Arquivos Criados

### Database

- `supabase/migrations/20251026160000_lab_templates.sql` - Tabela lab_agent_templates

### APIs

- `src/app/api/lab-ia/admin/templates/route.ts` - GET, POST, Export
- `src/app/api/lab-ia/admin/templates/import/route.ts` - Import JSON

### Frontend

- `src/app/ai-lab/admin/agents/templates/page.tsx` - Página de templates
- `docs/README_SPRINT7.md` - Esta documentação

### Atualizados

- `src/app/ai-lab/admin/agents/page.tsx` - Suporte a templates via URL

## 🗄️ Banco de Dados

### Tabela `lab_agent_templates`

```sql
CREATE TABLE lab_agent_templates (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT,
  provider TEXT,
  model TEXT,
  prompt TEXT NOT NULL,
  type TEXT CHECK (type IN ('llm', 'automation')),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Templates Padrão Incluídos

1. **Tradutor Médico** (Educacional)
2. **Gerador de Email para Pacientes** (Gestão Clínica)
3. **Análise de Dados de Campanha** (Marketing Médico)
4. **Resumidor de Casos Clínicos** (Gestão Clínica)
5. **Assistente de Revisão de Protocolos** (Pesquisa e IA Aplicada)

## 📡 APIs Criadas

### GET `/api/lab-ia/admin/templates`

Lista templates com filtros opcionais.

**Query params:**
- `page`: Página
- `limit`: Itens por página
- `category`: Filtrar por categoria
- `provider`: Filtrar por provedor
- `type`: Filtrar por tipo

### POST `/api/lab-ia/admin/templates`

Cria novo template (RBAC: admin/gestor_we).

### OPTIONS `/api/lab-ia/admin/templates?action=export`

Exporta todos os templates em JSON.

### POST `/api/lab-ia/admin/templates/import`

Importa templates de um arquivo JSON.

## 🎨 UI/UX

### Página de Templates

**Características:**
- Grid responsivo com cards de templates
- Sistema de badges por categoria
- Ícones emoji para identificação visual
- Botões "Usar como base" e visualização
- Export/Import com feedback visual

**Filtros:**
- Busca textual (nome e descrição)
- Por categoria (Educacional, Marketing, etc)
- Por provedor (OpenAI, Google, etc)

**Fluxo de Uso:**
1. Admin visualiza templates disponíveis
2. Clica em "Usar como base"
3. Redirecionado para página de agentes
4. Formulário preenchido automaticamente
5. Salva como novo agente

### Categorias Disponíveis

1. **Educacional** - Templates para educação médica
2. **Marketing Médico** - Templates de marketing
3. **Gestão Clínica** - Templates administrativos
4. **Pesquisa e IA Aplicada** - Templates de pesquisa
5. **Outros** - Templates diversos

## 📤 Importação/Exportação

### Exportar Templates

```typescript
// Cria arquivo JSON com todos os templates
const response = await fetch('/api/lab-ia/admin/templates?action=export')
const data = await response.json()
// Download automático do arquivo .json
```

### Importar Templates

```typescript
// Upload de arquivo JSON
const formData = new FormData()
formData.append('file', file)
const response = await fetch('/api/lab-ia/admin/templates/import', {
  method: 'POST',
  body: JSON.stringify({ templates: parsedData.templates })
})
```

### Formato JSON

```json
{
  "templates": [
    {
      "name": "Nome do Template",
      "description": "...",
      "icon": "🤖",
      "category": "Educacional",
      "provider": "OpenAI",
      "model": "gpt-4o-mini",
      "prompt": "...",
      "type": "llm"
    }
  ],
  "version": "1.0",
  "exported_at": "2025-01-27T..."
}
```

## 🔒 Segurança

- **RLS**: Templates visíveis para todos, criação apenas para admin
- **Validação**: Schema Zod em todas as APIs
- **RBAC**: Apenas admin/gestor_we podem gerenciar templates

## 🚀 Fluxo de Uso

1. **Visualizar Biblioteca**
   - Admin acessa `/ai-lab/admin/agents/templates`
   - Vê grid com todos os templates disponíveis

2. **Aplicar Template**
   - Clica em "✨ Usar como base"
   - É redirecionado para `/ai-lab/admin/agents`
   - Formulário preenchido automaticamente
   - Salva como novo agente

3. **Exportar Templates**
   - Clica em "📥 Exportar"
   - Download automático do JSON

4. **Importar Templates**
   - Clica em "📤 Importar"
   - Seleciona arquivo JSON
   - Templates adicionados ao banco

## 📈 Melhorias Futuras

- [ ] Sistema de versionamento de templates
- [ ] Templates populares/com mais uso
- [ ] Community templates (compartilhamento)
- [ ] Editor visual de prompts
- [ ] Preview interativo de templates
- [ ] Métricas de uso por template

---

**Status:** ✅ 100% Completo
