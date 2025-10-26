# 📊 Sprint 5 - Dashboard Admin, Analytics e Certificados

**Data:** Janeiro 2025  
**Autor:** WE Academy Development Team

## 📋 Visão Geral

Este sprint implementa o módulo Admin do Laboratório de IA, permitindo acompanhar uso, custos, gerar certificados e exportar relatórios.

## 🎯 Objetivos Alcançados

✅ **Dashboard de Métricas**: Cards com estatísticas principais  
✅ **Gráficos Interativos**: Custo por provedor e agentes mais usados (Recharts)  
✅ **Exportação de Relatórios**: Excel com dados completos (ExcelJS)  
✅ **Verificação de Custos**: Alertas quando limite é ultrapassado  
✅ **Certificados**: Sistema de emissão automática (critérios configuráveis)  
✅ **RBAC**: Proteção por role (admin/gestor_we)

## 📦 Arquivos Criados

### APIs

- `src/app/api/lab-ia/admin/dashboard/route.ts` - Estatísticas do dashboard
- `src/app/api/lab-ia/admin/check-costs/route.ts` - Verificação de custos
- `src/app/api/lab-ia/admin/export/route.ts` - Exportação Excel
- `src/app/api/lab-ia/certificates/generate/route.ts` - Geração de certificados

### Frontend

- `src/app/ai-lab/admin/page.tsx` - Dashboard admin

### Database

- `supabase/migrations/20251026140000_lab_admin.sql` - Tabelas de certificados e alertas

## 🎨 UI/UX

### Dashboard

- **Cards de Métricas**: 4 cards principais com estatísticas
- **Gráfico de Pizza**: Custo por provedor (OpenAI vs Gemini)
- **Gráfico de Barras**: Top 5 agentes mais usados
- **Botões de Ação**: Exportar relatório e verificar custos

### Certificados

- Critérios: ≥10 execuções de agentes + ≥50 mensagens
- Geração automática via API
- Armazenamento no Supabase Storage (TODO)

## 🗄️ Banco de Dados

### Tabela `lab_certificates`

```sql
CREATE TABLE lab_certificates (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  issued_at TIMESTAMPTZ
);
```

### Tabela `lab_cost_alerts`

```sql
CREATE TABLE lab_cost_alerts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  total_cost NUMERIC(10, 4),
  alert_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ
);
```

## 🔒 Segurança

- RBAC: Apenas admin e gestor_we podem acessar
- RLS aplicado em todas as tabelas
- Verificação de autenticação em todas as APIs

## 🚀 Variáveis de Ambiente

```bash
LAB_MAX_COST_USD=50
LAB_ALERT_EMAIL=contato@wemarketingdigital.com.br
```

## 📊 Métricas Disponíveis

- Total de mensagens
- Total de conversas
- Total de agentes executados
- Custo total (USD)
- Custo por provedor
- Top 5 agentes mais usados
- Latência média de respostas
- Total de tokens processados

## 🐛 Troubleshooting

### Dashboard não carrega

- Verificar se usuário tem role admin/gestor_we
- Verificar console para erros de API
- Verificar RLS policies no Supabase

### Export falha

- Verificar se ExcelJS está instalado
- Verificar tamanho dos dados
- Verificar logs do servidor

### Certificado não gera

- Verificar se critérios foram atendidos
- Verificar se usuário já tem certificado
- Verificar logs da API

## 📈 Próximos Passos

- [x] Implementar envio de email via Resend ✅
- [ ] Adicionar filtros por data no dashboard
- [x] Criar template de PDF de certificados ✅
- [ ] Implementar geração completa de PDF com upload
- [ ] Adicionar mais gráficos e métricas
- [ ] Implementar notificações push

---

**Status:** ✅ 100% Completo  
**Implementado:**
- ✅ Integração com Resend para emails de alertas
- ✅ Template de PDF de certificados criado
- ✅ Sistema de verificação de custos com notificações

**Pendências:**
- Geração completa de PDF com upload para Supabase Storage
- Filtros por data no dashboard
- Mais métricas e gráficos
