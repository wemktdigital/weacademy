# 🎭 Diferenças Entre Roles - WE Academy

## 📋 Visão Geral

A WE Academy usa um sistema **RBAC (Role-Based Access Control)** com 3 níveis de acesso:

---

## 👑 ADMIN (Administrador)

### Permissões:
- ✅ **Acesso total** ao sistema
- ✅ Pode acessar `/admin` (dashboard administrativo)
- ✅ Pode criar, editar e deletar cursos
- ✅ Pode criar, editar e deletar usuários
- ✅ Pode visualizar analytics e métricas
- ✅ Pode visualizar audit logs
- ✅ Pode acessar Laboratório de IA
- ✅ Pode acessar admin do Laboratório de IA (`/ai-lab/admin/*`)
- ✅ Pode criar e gerenciar agentes, pipelines e templates
- ✅ Pode visualizar relatórios de uso e custos

### Onde usar:
- Gestores da WE Academy
- Profissionais que precisam administrar a plataforma

---

## 👤 USER (Usuário Regular)

### Permissões:
- ✅ Pode se inscrever em cursos
- ✅ Pode assistir lições e completar cursos
- ✅ Pode acessar "Meus Cursos"
- ✅ Pode alterar configurações do próprio perfil
- ✅ Pode acessar Laboratório de IA
- ❌ **NÃO** pode acessar `/admin`
- ❌ **NÃO** pode criar/editar/deletar cursos
- ❌ **NÃO** pode acessar analytics (apenas para admins)
- ❌ **NÃO** pode acessar admin do Laboratório de IA

### Onde usar:
- Médicos cadastrados na plataforma
- Alunos que pagaram por cursos
- Usuários com cadastro completo

---

## 🚪 GUEST (Convidado)

### Permissões:
- ✅ Pode **visualizar** cursos públicos (página inicial)
- ✅ Pode **visualizar** categorias e descrições
- ❌ **NÃO** pode se inscrever em cursos
- ❌ **NÃO** pode assistir lições (apenas preview)
- ❌ **NÃO** pode acessar "Meus Cursos"
- ❌ **NÃO** pode acessar Laboratório de IA (bloqueado na API)
- ❌ **NÃO** pode acessar configurações
- ❌ **NÃO** pode acessar área administrativa

### Onde usar:
- Visitantes não cadastrados
- Usuários em fase de teste
- Contas temporárias para demonstração

**Nota:** O Guest tem acesso muito limitado, apenas visualização básica. Para usar qualquer funcionalidade interativa, é necessário ser USER ou ADMIN.

---

## 🔍 Como Identificar a Role de um Usuário?

### No Supabase Studio:
```sql
SELECT email, full_name, role, created_at 
FROM public.profiles 
ORDER BY email;
```

### No Código (Frontend):
```typescript
// Contexto de autenticação
const { user } = useAuth();

console.log(user.role); // 'admin' | 'user' | 'guest'
```

### No Código (Backend/Middleware):
```typescript
// Supabase RLS Policies
const { data: { user } } = await supabase.auth.getUser();
const { role } = await getProfile(user.id);

if (role === 'admin') {
  // Permitir acesso
}
```

---

## 🛡️ Proteção de Rotas

### Páginas Protegidas por Role:

| Rota | Admin | User | Guest |
|------|-------|------|-------|
| `/` | ✅ | ✅ | ✅ |
| `/admin/*` | ✅ | ❌ | ❌ |
| `/admin/courses` | ✅ | ❌ | ❌ |
| `/analytics` | ✅ | ❌ | ❌ |
| `/admin/audit-logs` | ✅ | ❌ | ❌ |
| `/my-courses` | ✅ | ✅ | ❌ |
| `/courses/[slug]` | ✅ | ✅ | ✅ (view only) |
| `/lessons/[id]` | ✅ | ✅ | ❌ |
| `/ai-lab` | ✅ | ✅ | ❌ |
| `/ai-lab/admin/*` | ✅ | ❌ | ❌ |
| `/settings` | ✅ | ✅ | ❌ |

---

## 🔄 Como Mudar a Role de um Usuário?

### Via Supabase Studio (SQL Editor):

```sql
-- Tornar usuário ADMIN
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'usuario@exemplo.com';

-- Tornar usuário USER regular
UPDATE public.profiles 
SET role = 'user' 
WHERE email = 'usuario@exemplo.com';

-- Tornar usuário GUEST
UPDATE public.profiles 
SET role = 'guest' 
WHERE email = 'usuario@exemplo.com';
```

### Via Interface (Futuro):
- [ ] Admin pode alterar roles de usuários via painel administrativo
- [ ] Sistema de convites por email com role pré-definida

---

## 🧪 Como Testar?

### Testar como GUEST:
1. Criar usuário no banco com `role = 'guest'`
2. Fazer login
3. Verificar que apenas visualiza cursos, não pode assistir lições
4. Verificar que não pode acessar `/admin`
5. Verificar que não pode acessar `/ai-lab`

### Testar como USER:
1. Já existe: `user@weacademy.com` / `user123`
2. Fazer login
3. Verificar que pode se inscrever em cursos
4. Verificar que pode assistir lições
5. Verificar que **NÃO** pode acessar `/admin`

### Testar como ADMIN:
1. Já existe: `admin@weacademy.com` / `admin123`
2. Fazer login
3. Verificar que acessa `/admin`
4. Verificar que pode criar/editar/deletar cursos
5. Verificar que acessa `/ai-lab/admin/agents`

---

## 📊 Resumo Visual

```
┌─────────────────────────────────────────────────────────────┐
│                         WE ACADEMY                           │
└─────────────────────────────────────────────────────────────┘

GUEST ────────────────────────────────────────────────────────►
├─ 📖 Ver cursos (preview)
├─ ❌ Não pode inscrever
├─ ❌ Não pode assistir
└─ ❌ Acesso muito limitado

USER ─────────────────────────────────────────────────────────►
├─ 📚 Ver e inscrever em cursos
├─ 🎓 Assistir lições e completar cursos
├─ 🤖 Usar Laboratório de IA
└─ ⚙️ Alterar configurações

ADMIN ────────────────────────────────────────────────────────►
├─ 👑 Controle total do sistema
├─ 📊 Analytics e relatórios
├─ 🔧 CRUD de cursos e usuários
├─ 🤖 Admin do Laboratório de IA
└─ 📝 Audit logs
```

---

## ⚠️ Importante

- **Guest** = Usuário sem acesso, apenas visualização básica
- **User** = Usuário normal, pode consumir conteúdo
- **Admin** = Usuário com poderes administrativos completos

**Recomendação:** Para usuários reais, use sempre `role = 'user'`. Use `role = 'guest'` apenas para contas temporárias ou demonstrações.
