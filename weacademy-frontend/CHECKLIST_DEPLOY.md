# ✅ Checklist Completo para Publicar a Aplicação

Este checklist contém todos os passos necessários para publicar a WE Academy em produção.

## 📋 Pré-requisitos

- [ ] Conta no [Supabase](https://supabase.com) (gratuita)
- [ ] Conta no [Vercel](https://vercel.com) (gratuita)
- [ ] Conta no [GitHub](https://github.com) (para conectar o repositório)
- [ ] Supabase CLI instalado localmente
- [ ] Projeto commitado no GitHub

---

## 🔵 Parte 1: Supabase em Produção

### 1.1 Criar Projeto no Supabase
- [ ] Acessar [app.supabase.com](https://app.supabase.com)
- [ ] Criar novo projeto: `weacademy-production`
- [ ] Escolher região: `South America (São Paulo)` (recomendado)
- [ ] Criar senha forte para o banco e **ANOTAR**
- [ ] Aguardar criação do projeto (2-3 minutos)

### 1.2 Obter Credenciais
- [ ] Ir em **Settings** → **API**
- [ ] Copiar **Project URL**: `https://xxxxx.supabase.co`
- [ ] Copiar **anon public key**
- [ ] Copiar **service_role key** (⚠️ manter secreto)
- [ ] Ir em **Settings** → **General**
- [ ] Copiar **Reference ID** (project-ref)

### 1.3 Fazer Link do Projeto
```bash
cd weacademy-frontend
supabase login
supabase link --project-ref seu-project-ref
```

### 1.4 Aplicar Migrations
```bash
supabase db push
```
- [ ] Aguardar conclusão (pode levar alguns minutos)
- [ ] Verificar em **Database** → **Migrations** se todas foram aplicadas

### 1.5 Configurar Storage Buckets
No Supabase Dashboard → **Storage**, criar:
- [ ] `knowledge-base` (público ou privado)
- [ ] `certificates` (público)
- [ ] `course-materials` (público ou privado)
- [ ] `avatars` (público)

### 1.6 Configurar URLs de Redirect
- [ ] Ir em **Authentication** → **URL Configuration**
- [ ] Adicionar URL da Vercel em **Site URL**
- [ ] Adicionar URL da Vercel em **Redirect URLs**

### 1.7 Criar Usuário Admin Inicial
- [ ] Criar usuário admin via Dashboard ou SQL
- [ ] Atualizar role para `admin` na tabela `profiles`

---

## 🟢 Parte 2: Vercel

### 2.1 Preparar Repositório
```bash
git add .
git commit -m "Preparar para deploy em produção"
git push origin main
```
- [ ] Verificar que tudo está commitado

### 2.2 Criar Projeto na Vercel
- [ ] Acessar [vercel.com](https://vercel.com)
- [ ] Fazer login com GitHub
- [ ] Clicar em **"Add New Project"**
- [ ] Importar repositório `weacademy3`
- [ ] Configurar:
  - **Framework Preset**: Next.js
  - **Root Directory**: `weacademy-frontend` ⚠️ **IMPORTANTE**
  - **Build Command**: `npm run build`
  - **Output Directory**: `.next`

### 2.3 Configurar Variáveis de Ambiente

Na Vercel → **Settings** → **Environment Variables**, adicionar:

#### Supabase (Obrigatório)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://seu-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key-aqui
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-aqui
NEXT_PUBLIC_SUPABASE_STORAGE_URL=https://seu-project-ref.supabase.co/storage/v1
DATABASE_URL=postgresql://postgres:[SUA-SENHA]@db.seu-project-ref.supabase.co:5432/postgres
```

#### App Configuration (Obrigatório)
```bash
NEXT_PUBLIC_APP_URL=https://seu-projeto.vercel.app
NEXT_PUBLIC_APP_NAME=WE Academy
```

#### APIs do Laboratório de IA (Opcional - conforme uso)

**OpenAI** (para GPT-5, GPT-4o, Sora, GPT-Image, Transcribe):
```bash
OPENAI_API_KEY=sk-...
```

**Google** (para Gemini, Veo):
```bash
GEMINI_API_KEY=...
```

**DeepSeek**:
```bash
DEEPSEEK_API_KEY=...
```

**Grok (xAI)**:
```bash
XAI_API_KEY=...
```

**Anthropic (Claude)**:
```bash
ANTHROPIC_API_KEY=sk-ant-...
```

**Replicate** (para FLUX, Ideogram, Seedream, Llama):
```bash
REPLICATE_API_TOKEN=r8_...
```

**PubMed**:
```bash
PUBMED_API_KEY=...
```

#### Email (Opcional)
```bash
RESEND_API_KEY=re_...
LAB_MAX_COST_USD=50
LAB_ALERT_EMAIL=contato@wemarketingdigital.com.br
```

#### Storage Local (Remover em produção)
- [ ] **NÃO** adicionar `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION` (são apenas para desenvolvimento local)

### 2.4 Fazer Deploy
- [ ] Clicar em **"Deploy"**
- [ ] Aguardar build (2-5 minutos)
- [ ] Verificar se build foi bem-sucedido

### 2.5 Atualizar URL do App
- [ ] Copiar URL gerada pela Vercel
- [ ] Atualizar `NEXT_PUBLIC_APP_URL` com a URL correta
- [ ] Fazer novo deploy ou aguardar próximo

---

## ✅ Parte 3: Verificações Pós-Deploy

### 3.1 Testar Aplicação
- [ ] Página inicial carrega
- [ ] Autenticação funciona (login/registro)
- [ ] Login de admin funciona
- [ ] Cursos aparecem
- [ ] Laboratório de IA funciona
- [ ] Modelos de IA estão disponíveis
- [ ] Upload de arquivos funciona
- [ ] Storage funciona

### 3.2 Verificar Logs
- [ ] Verificar logs na Vercel (Deployments → último deploy)
- [ ] Verificar logs no Supabase (Logs)
- [ ] Verificar se há erros de autenticação
- [ ] Verificar se há erros de queries

### 3.3 Testar Funcionalidades Críticas
- [ ] Criar novo usuário
- [ ] Fazer login
- [ ] Acessar painel admin
- [ ] Criar curso (se admin)
- [ ] Usar Laboratório de IA
- [ ] Buscar no PubMed (se configurado)
- [ ] Gerar imagens/vídeos (se APIs configuradas)

---

## 🔧 Troubleshooting

### Build falha na Vercel
- [ ] Verificar se `Root Directory` está como `weacademy-frontend`
- [ ] Verificar logs de build
- [ ] Testar build local: `cd weacademy-frontend && npm run build`

### Autenticação não funciona
- [ ] Verificar URLs de redirect no Supabase
- [ ] Verificar se `NEXT_PUBLIC_SUPABASE_URL` está correto
- [ ] Verificar se `NEXT_PUBLIC_SUPABASE_ANON_KEY` está correto

### Storage não funciona
- [ ] Verificar se buckets foram criados no Supabase
- [ ] Verificar políticas de acesso dos buckets
- [ ] Verificar se `NEXT_PUBLIC_SUPABASE_STORAGE_URL` está correto

### Laboratório de IA não funciona
- [ ] Verificar se APIs estão configuradas (OpenAI, Google, etc.)
- [ ] Verificar logs de erro na Vercel
- [ ] Testar uma requisição simples

### Erro de conexão com banco
- [ ] Verificar se `DATABASE_URL` está correto
- [ ] Verificar se senha está correta (sem caracteres especiais que precisam ser URL-encoded)
- [ ] Verificar se migrations foram aplicadas

---

## 📝 Checklist Final

Antes de considerar o deploy completo:

- [ ] Projeto Supabase criado em produção
- [ ] Todas as migrations aplicadas
- [ ] Storage buckets criados
- [ ] Usuários iniciais criados
- [ ] Variáveis de ambiente configuradas na Vercel
- [ ] Deploy realizado com sucesso
- [ ] Aplicação acessível e funcionando
- [ ] Autenticação testada
- [ ] Funcionalidades principais testadas
- [ ] URLs de redirect configuradas no Supabase
- [ ] APIs do Laboratório de IA configuradas (se necessário)
- [ ] Logs verificados sem erros críticos

---

## 🎉 Próximos Passos (Opcional)

### Domínio Customizado
- [ ] Configurar domínio personalizado na Vercel
- [ ] Atualizar `NEXT_PUBLIC_APP_URL` com novo domínio
- [ ] Atualizar URLs de redirect no Supabase

### Email em Produção
- [ ] Configurar Resend ou outro serviço de email
- [ ] Adicionar `RESEND_API_KEY` nas variáveis de ambiente
- [ ] Testar envio de emails

### Monitoramento
- [ ] Configurar alertas na Vercel
- [ ] Monitorar logs no Supabase
- [ ] Configurar analytics (opcional)

### Backup
- [ ] Configurar backups automáticos no Supabase
- [ ] Documentar processo de restore

---

## 📚 Documentação de Referência

- [Guia Completo de Deploy](./DEPLOY_VERCEL.md) - Guia detalhado passo a passo
- [Documentação Vercel](https://vercel.com/docs)
- [Documentação Supabase](https://supabase.com/docs)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)

---

## ⚠️ Importante

1. **Nunca commite** arquivos `.env.local` ou chaves de API no Git
2. **Mantenha secreto** a `SUPABASE_SERVICE_ROLE_KEY` e todas as API keys
3. **Teste localmente** antes de fazer deploy em produção
4. **Faça backup** do banco antes de aplicar migrations em produção
5. **Monitore custos** das APIs (especialmente OpenAI, Replicate)

---

**Boa sorte com o deploy! 🚀**

