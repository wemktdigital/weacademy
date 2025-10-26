# WE Academy

Uma plataforma moderna de cursos online construída com Next.js e Supabase.

## 🚀 Tecnologias

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Deploy**: Vercel
- **Ferramentas**: Supabase CLI, Docker

## 📋 Pré-requisitos

- Node.js 18+ 
- Docker Desktop
- Supabase CLI
- Git

## 🛠️ Configuração do Ambiente

### 1. Clone o repositório
```bash
git clone <repository-url>
cd weacademy3
```

### 2. Instale o Supabase CLI
```bash
# macOS
brew install supabase/tap/supabase

# Outros sistemas: https://supabase.com/docs/guides/cli/getting-started
```

### 3. Configure as variáveis de ambiente
```bash
cp env.example .env.local
```

### 4. Inicie o Supabase localmente
```bash
# Inicie o Docker Desktop primeiro
open -a Docker

# Aguarde o Docker inicializar e execute:
supabase start
```

### 5. Verifique se tudo está funcionando
Acesse o Supabase Studio em: http://127.0.0.1:54323

## 📊 Estrutura do Banco de Dados

### Tabelas Principais

- **profiles**: Perfis de usuários (estende auth.users)
- **categories**: Categorias de cursos
- **courses**: Cursos disponíveis
- **modules**: Módulos/seções dos cursos
- **lessons**: Aulas individuais
- **enrollments**: Inscrições de usuários
- **lesson_progress**: Progresso das aulas
- **course_reviews**: Avaliações dos cursos
- **certificates**: Certificados de conclusão
- **favorites**: Cursos favoritos

### Funcionalidades Implementadas

- ✅ Autenticação de usuários
- ✅ Sistema de perfis com roles (student, instructor, admin)
- ✅ CRUD completo de cursos, módulos e aulas
- ✅ Sistema de inscrições e progresso
- ✅ Avaliações e certificados
- ✅ Row Level Security (RLS) configurado
- ✅ Triggers automáticos para updated_at
- ✅ Criação automática de perfis

## 🔧 Comandos Úteis

```bash
# Iniciar Supabase
supabase start

# Parar Supabase
supabase stop

# Resetar banco de dados
supabase db reset

# Ver logs
supabase logs

# Status dos serviços
supabase status
```

## 🌐 URLs de Desenvolvimento

- **Supabase Studio**: http://127.0.0.1:54323
- **API**: http://127.0.0.1:54321
- **Database**: postgresql://postgres:postgres@127.0.0.1:54322/postgres
- **Mailpit**: http://127.0.0.1:54324

## 📝 Próximos Passos

1. Criar aplicação Next.js
2. Configurar autenticação
3. Implementar interface de usuário
4. Criar sistema de pagamentos
5. Adicionar upload de vídeos
6. Implementar chat/suporte

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.
