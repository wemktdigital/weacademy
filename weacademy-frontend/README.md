# WE Academy

Uma plataforma moderna de cursos e treinamentos exclusiva para médicos clientes da WE Marketing Médico. Construída com Next.js 16, TypeScript, Tailwind CSS, shadcn/ui e Supabase.

## 🚀 Tecnologias

- **Frontend**: Next.js 16, React 18, TypeScript, Tailwind CSS
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) - Componentes modernos e acessíveis
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Deploy**: Vercel
- **Ferramentas**: Supabase CLI, Docker

## 🏥 Sobre a WE Academy

A WE Academy é a plataforma de educação continuada desenvolvida especificamente para médicos clientes da WE Marketing Médico. Oferecemos:

- **Cursos especializados** em marketing médico digital
- **Treinamentos clínicos** com casos reais
- **Gestão de consultório** e práticas médicas
- **Certificações reconhecidas** pelo CRM
- **Comunidade médica** exclusiva

## ✨ Funcionalidades Implementadas

### 🎨 Interface Moderna
- ✅ Design responsivo com Tailwind CSS
- ✅ Componentes acessíveis com shadcn/ui
- ✅ Tema claro/escuro automático
- ✅ Animações e transições suaves
- ✅ Layout profissional e moderno

### 📱 Páginas Principais
- ✅ **Homepage** - Landing page com hero section, features e cursos populares
- ✅ **Cursos** - Listagem completa com filtros e busca
- ✅ **Header** - Navegação com menu de usuário e busca
- ✅ **Footer** - Links úteis e informações de contato

### 🗄️ Banco de Dados
- ✅ Schema completo para plataforma de cursos
- ✅ Sistema de usuários com roles (student, instructor, admin)
- ✅ Cursos, módulos e aulas estruturados
- ✅ Sistema de inscrições e progresso
- ✅ Avaliações e certificados
- ✅ Row Level Security (RLS) configurado

## 🛠️ Configuração do Ambiente

### 1. Pré-requisitos
- Node.js 18+
- Docker Desktop
- Supabase CLI
- Git

### 2. Instalação
```bash
# Clone o repositório
git clone <repository-url>
cd weacademy3/weacademy-frontend

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env.local
```

### 3. Inicie o Supabase localmente
```bash
# Na pasta raiz do projeto (onde está o supabase/)
cd ..
supabase start
```

### 4. Execute a aplicação
```bash
# Na pasta frontend
cd weacademy-frontend
npm run dev
```

## 🌐 URLs de Desenvolvimento

- **Aplicação**: http://localhost:3000
- **Supabase Studio**: http://127.0.0.1:54323
- **API**: http://127.0.0.1:54321
- **Database**: postgresql://postgres:postgres@127.0.0.1:54322/postgres

## 📊 Estrutura do Projeto

```
weacademy-frontend/
├── src/
│   ├── app/                    # App Router do Next.js
│   │   ├── page.tsx           # Homepage
│   │   ├── courses/           # Página de cursos
│   │   └── layout.tsx         # Layout principal
│   ├── components/
│   │   ├── ui/                # Componentes shadcn/ui
│   │   ├── header.tsx         # Cabeçalho
│   │   └── footer.tsx         # Rodapé
│   └── lib/
│       ├── supabase.ts        # Configuração Supabase
│       └── utils.ts           # Utilitários
├── supabase/                  # Configuração Supabase
│   ├── migrations/           # Migrations do banco
│   └── seed.sql              # Dados iniciais
└── .env.local                # Variáveis de ambiente
```

## 🎨 Componentes shadcn/ui Utilizados

- **Button** - Botões com variantes
- **Card** - Cards para cursos e conteúdo
- **Badge** - Badges para categorias e status
- **Input** - Campos de entrada
- **Avatar** - Avatares de usuários
- **Dropdown Menu** - Menus suspensos
- **Dialog** - Modais e diálogos
- **Form** - Formulários estruturados

## 🔧 Comandos Úteis

```bash
# Desenvolvimento
npm run dev          # Inicia servidor de desenvolvimento
npm run build        # Build de produção
npm run start        # Inicia servidor de produção
npm run lint         # Executa ESLint

# Supabase
supabase start       # Inicia Supabase local
supabase stop        # Para Supabase local
supabase db reset    # Reset banco de dados
supabase status      # Status dos serviços

# shadcn/ui
npx shadcn@latest add [component]  # Adiciona componente
```

## 📝 Próximos Passos

1. **Autenticação** - Implementar login/registro com Supabase Auth
2. **Integração Real** - Conectar páginas com dados do Supabase
3. **Sistema de Pagamentos** - Integrar Stripe ou similar
4. **Upload de Vídeos** - Sistema de upload e streaming
5. **Chat/Suporte** - Sistema de mensagens em tempo real
6. **Dashboard** - Painel administrativo
7. **Mobile App** - Aplicativo React Native

## 🎯 Funcionalidades Planejadas

### Para Estudantes
- [ ] Perfil personalizado
- [ ] Meus cursos e progresso
- [ ] Certificados
- [ ] Favoritos
- [ ] Avaliações

### Para Instrutores
- [ ] Dashboard de instrutor
- [ ] Criação de cursos
- [ ] Upload de vídeos
- [ ] Estatísticas de vendas
- [ ] Comunicação com alunos

### Para Administradores
- [ ] Painel administrativo
- [ ] Gestão de usuários
- [ ] Relatórios e analytics
- [ ] Configurações da plataforma

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 🙏 Agradecimentos

- [shadcn/ui](https://ui.shadcn.com/) - Componentes incríveis
- [Supabase](https://supabase.com/) - Backend como serviço
- [Next.js](https://nextjs.org/) - Framework React
- [Tailwind CSS](https://tailwindcss.com/) - Framework CSS