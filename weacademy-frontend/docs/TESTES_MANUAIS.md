# 📋 Roadmap de Testes Manuais - WE Academy

## 🎯 Objetivo
Validar manualmente todas as funcionalidades da plataforma WE Academy, garantindo que cada recurso está funcionando corretamente em produção.

---

## 👤 Credenciais de Teste

### Admin
- **Email:** `admin@weacademy.com`
- **Senha:** `admin123`
- **Role:** `admin`

### Usuário Regular
- **Email:** `user@weacademy.com`
- **Senha:** `user123`
- **Role:** `user`

### Convidado
- **Email:** `guest@weacademy.com`
- **Senha:** `guest123`
- **Role:** `guest`

---

## 🧪 1. Testes de Autenticação

### 1.1 Login
- [x] **Login Admin:** Acessar `http://localhost:3000/auth/login` e fazer login com credenciais admin ✅
- [x] **Login Usuário:** Fazer login com credenciais de usuário regular ✅
- [x] **Login Guest:** Fazer login com credenciais de convidado ✅
- [x] **Login Inválido:** Tentar login com credenciais incorretas (deve mostrar erro) ✅
- [⚠️] **Redirecionamento:** Verificar se após login é redirecionado para `/` ou dashboard (❌ NÃO FUNCIONA - usuário permanece na página de login)

### 1.2 Logout
- [x] **Botão Logout:** Clicar no botão de logout no menu do usuário ✅
- [x] **Sessão:** Verificar se a sessão é encerrada corretamente ✅
- [⚠️] **Redirecionamento:** Verificar se é redirecionado para página de login (❌ NÃO FUNCIONA - usuário permanece na página atual)

### 1.3 Registro (se implementado)
- [x] **Formulário:** Preencher formulário de registro ✅
- [x] **Validação:** Testar validação de campos (email inválido, senha fraca, etc.) ✅
- [x] **Criação:** Verificar se o usuário é criado no banco ✅
- [x] **Role:** Verificar se role padrão é `user` ✅

---

## 🛡️ 2. Testes de RBAC (Role-Based Access Control)

### 2.1 Admin (Role: admin)
- [x] **Dashboard Admin:** Acessar `/admin` como admin (deve funcionar) ✅
- [x] **Redirecionamento Admin:** Após login, redireciona automaticamente para `/admin` ✅
- [x] **Analytics:** Acessar `/analytics` (deve carregar) ✅
- [x] **Audit Logs:** Acessar `/admin/audit-logs` (deve carregar) ✅
- [x] **Laboratório IA:** Acessar `/ai-lab` (deve funcionar) ✅
- [x] **Admin IA:** Acessar `/ai-lab/admin/agents` (deve funcionar) ✅
- [x] **Menu Admin IA:** Verificar links no menu (Gerenciar Agentes, Templates, Pipelines) ✅

### 2.2 Usuário Regular (Role: user)
- [x] **Dashboard Admin:** Tentar acessar `/admin` (deve bloquear/redirecionar) ✅
- [x] **Analytics:** Tentar acessar `/analytics` (deve bloquear) ✅ Redireciona para `/admin/analytics` e bloqueia usuários não-admin
- [x] **Laboratório IA:** Acessar `/ai-lab` (deve funcionar) ✅
- [x] **Admin IA:** Tentar acessar `/ai-lab/admin/agents` (deve bloquear) ✅ Verificação de role implementada - redireciona usuários não-admin

### 2.3 Convidado (Role: guest)
- [x] **Dashboard Admin:** Tentar acessar `/admin` (deve bloquear) ✅
- [x] **Laboratório IA:** Tentar acessar `/ai-lab` (interface aparece mas input está desabilitado) ✅
- [x] **Input Bloqueado:** Verificar mensagem "Usuários Guest não podem usar o Laboratório de IA" ✅
- [x] **API Bloqueada:** Tentar enviar mensagem retorna erro 403 ✅

---

## 📚 3. Testes de Cursos

> **💡 Dica:** Teste as seções 3.1 e 3.2 como **usuario regular** (user), e as seções 3.3, 3.4 e 3.5 como **admin**.

### 3.1 Listagem de Cursos
- [x] **Página Inicial:** Acessar `/` e verificar se cursos são exibidos ✅ Funciona (página inicial carrega)
- [⚠️] **Categorias:** Filtrar cursos por categoria ❌ Não implementado (botões existem mas não fazem nada)
- [⚠️] **Busca:** Usar barra de busca para encontrar cursos específicos ❌ Não implementado (input existe mas não conectado)
- [⚠️] **Paginção:** Testar paginação se houver muitos cursos ❌ Não implementado
- ⚠️ **Obs:** A página `/courses` usa dados mockados (não conectada ao Supabase ainda)

### 3.2 Detalhes do Curso
- [⚠️] **Página do Curso:** Acessar `/courses/[slug]` e verificar informações ❌ Página carrega mas sem dados reais
- [⚠️] **Informações:** Verificar título, descrição, preço, nível, duração ❌ Não exibe informações completas (dados mock)
- [⚠️] **Módulos:** Verificar se módulos e lições são exibidos ❌ Não conectado ao Supabase
- [⚠️] **Botão Inscrever:** Verificar se botão de inscrição está visível ❌ Existe mas não funcional
- ⚠️ **Obs:** Arquivo `seed.sql` existe mas os dados não estão populados no banco. Executar: `supabase db reset` ou seed manual.

### 3.3 Criação de Curso (Admin)
- [ ] **Formulário:** Acessar `/admin/courses` e clicar em "Criar Curso"
- [ ] **Campos:** Preencher todos os campos obrigatórios
- [ ] **Validação:** Testar validação (título vazio, preço negativo, etc.)
- [ ] **Salvar:** Salvar curso e verificar se aparece na lista
- [ ] **Publicar:** Alternar entre publicado/não publicado

### 3.4 Edição de Curso (Admin)
- [ ] **Editar:** Clicar em "Editar" em um curso existente
- [ ] **Atualizar:** Modificar campos e salvar
- [ ] **Verificar:** Confirmar que mudanças foram aplicadas

### 3.5 Exclusão de Curso (Admin)
- [ ] **Excluir:** Clicar em "Excluir" em um curso
- [ ] **Confirmação:** Confirmar exclusão no modal
- [ ] **Verificar:** Confirmar que curso foi removido da lista

---

## 🎓 4. Testes de Módulos e Lições

### 4.1 Criação de Módulos
- [ ] **Adicionar Módulo:** No formulário de curso, adicionar módulo
- [ ] **Título e Ordem:** Definir título e ordem do módulo
- [ ] **Salvar:** Verificar se módulo aparece na pré-visualização

### 4.2 Criação de Lições
- [ ] **Adicionar Lição:** Adicionar lição a um módulo
- [ ] **Tipo de Conteúdo:** Testar diferentes tipos (texto, vídeo, quiz)
- [ ] **URL de Vídeo:** Testar inserção de URL do YouTube/Vimeo
- [ ] **Conteúdo em Markdown:** Testar editor de markdown

### 4.3 Visualização do Player
- [ ] **Acessar Lição:** Clicar em uma lição do curso
- [ ] **Player de Vídeo:** Verificar se vídeo é carregado corretamente
- [ ] **Conteúdo Texto:** Verificar formatação de markdown
- [ ] **Navegação:** Usar botões de próxima/anterior
- [ ] **Progresso:** Verificar se progresso é atualizado

---

## 🧩 5. Testes de Quiz

### 5.1 Criação de Quiz
- [ ] **Formulário Quiz:** Acessar quiz builder no admin
- [ ] **Criar Pergunta:** Adicionar pergunta de múltipla escolha
- [ ] **Alternativas:** Definir alternativas e marcar resposta correta
- [ ] **Nota de Aprovação:** Definir nota mínima para aprovação
- [ ] **Salvar:** Salvar quiz e associar à lição

### 5.2 Resolução de Quiz
- [ ] **Acessar Quiz:** Clicar em lição com quiz
- [ ] **Responder:** Selecionar alternativas
- [ ] **Enviar:** Enviar respostas
- [ ] **Feedback:** Verificar se feedback é exibido
- [ ] **Nota:** Verificar se nota final é calculada corretamente

---

## 👥 6. Testes de Inscrições

### 6.1 Inscrição em Curso
- [ ] **Curso Gratuito:** Inscrever em curso gratuito (deve funcionar direto)
- [ ] **Curso Pago:** Inscrever em curso pago (deve abrir checkout)
- [ ] **Confirmação:** Verificar se aparece em "Meus Cursos"

### 6.2 Meus Cursos
- [ ] **Listagem:** Acessar `/my-courses` e verificar cursos inscritos
- [ ] **Progresso:** Verificar se percentual de progresso está correto
- [ ] **Continuar:** Clicar em "Continuar" e ir para última lição vista

### 6.3 Cancelamento (se implementado)
- [ ] **Cancelar:** Cancelar inscrição em curso
- [ ] **Verificar:** Confirmar que curso foi removido de "Meus Cursos"

---

## 🎯 7. Testes de Progresso e Certificados

### 7.1 Rastreamento de Progresso
- [ ] **Marcar Lição:** Marcar lição como concluída
- [ ] **Atualização:** Verificar se progresso é atualizado em tempo real
- [ ] **Persistência:** Recarregar página e verificar se progresso persiste

### 7.2 Geração de Certificado
- [ ] **Completar Curso:** Completar 100% do curso
- [ ] **Gerar Certificado:** Verificar se certificado é gerado automaticamente
- [ ] **Download:** Baixar certificado em PDF
- [ ] **Verificar:** Validar certificado com QR code

---

## 🤖 8. Testes do Laboratório de IA

### 8.1 Interface do Chat
- [x] **Acessar:** Acessar `/ai-lab` e verificar interface ✅
- [ ] **Sidebar:** Verificar se conversas antigas aparecem na sidebar
- [ ] **Nova Conversa:** Clicar em "+ Nova Conversa" e criar nova
- [ ] **Tema:** Alternar entre tema claro/escuro
- [x] **Bloqueio Guest:** Verificar que guests veem input desabilitado com mensagem explicativa ✅

### 8.2 Envio de Mensagens
- [ ] **Enviar Mensagem:** Digitar mensagem e enviar
- [ ] **Streaming:** Verificar se resposta aparece em streaming
- [ ] **Markdown:** Verificar se markdown é renderizado corretamente
- [ ] **Copiar:** Clicar em "Copiar" e verificar se código é copiado

### 8.3 Seleção de Modelo
- [ ] **ModelSelector:** Clicar no seletor de modelo
- [ ] **Alternar:** Alternar entre GPT-5 Nano e Gemini 2.5 Flash
- [ ] **Toast:** Verificar se toast de mudança aparece
- [ ] **Persistência:** Recarregar página e verificar modelo selecionado

### 8.4 Agentes Especializados
- [ ] **AgentSelector:** Selecionar agente especializado
- [ ] **Badge:** Verificar se badge do agente aparece
- [ ] **Sistema Prompt:** Enviar mensagem e verificar personalidade do agente
- [ ] **Logs:** Verificar se execução é logada em `lab_agent_logs`

### 8.5 Gerenciamento de Conversas
- [ ] **Renomear:** Clicar no nome da conversa e renomear
- [ ] **Excluir:** Excluir conversa e verificar se foi removida
- [ ] **Favoritar:** Favoritar mensagem e verificar se aparece em "Favoritas"
- [ ] **Exportar:** Exportar conversa em Markdown

### 8.6 Admin do Laboratório
- [ ] **Agentes CRUD:** Acessar `/ai-lab/admin/agents` e criar/editar/deletar agentes
- [ ] **Templates:** Acessar `/ai-lab/admin/agents/templates` e importar template
- [ ] **Pipelines:** Acessar `/ai-lab/admin/pipelines` e criar pipeline
- [ ] **Dashboard:** Acessar dashboard e verificar métricas de uso

---

## 📊 9. Testes de Analytics

### 9.1 Dashboard de Analytics
- [ ] **Acessar:** Acessar `/analytics` como admin
- [ ] **Gráficos:** Verificar se gráficos são renderizados
- [ ] **Eventos:** Verificar top eventos e cliques
- [ ] **Período:** Filtrar por período (últimos 7 dias, 30 dias, etc.)

### 9.2 Rastreamento de Eventos
- [ ] **Page Views:** Navegar entre páginas e verificar se são rastreadas
- [ ] **Button Clicks:** Clicar em botões e verificar se eventos são enviados
- [ ] **Custom Events:** Testar `trackEvent()` com eventos customizados

---

## 📝 10. Testes de Audit Logs

### 10.1 Visualização de Logs
- [ ] **Acessar:** Acessar `/admin/audit-logs` como admin
- [ ] **Tabela:** Verificar se logs são exibidos em tabela
- [ ] **Filtros:** Filtrar por ação, tabela, usuário
- [ ] **Paginação:** Navegar entre páginas de resultados

### 10.2 Geração de Logs
- [ ] **Criar:** Criar novo curso e verificar se log é gerado
- [ ] **Editar:** Editar curso e verificar log de UPDATE
- [ ] **Deletar:** Deletar curso e verificar log de DELETE

---

## ⚙️ 11. Testes de Configurações

### 11.1 Perfil do Usuário
- [ ] **Acessar:** Acessar `/settings`
- [ ] **Editar Nome:** Atualizar nome completo
- [ ] **Editar Email:** Atualizar email (se permitido)
- [ ] **Salvar:** Verificar se mudanças são salvas

### 11.2 Foto de Perfil
- [ ] **Upload:** Fazer upload de foto de perfil
- [ ] **Preview:** Verificar preview antes de salvar
- [ ] **Salvar:** Salvar e verificar se foto aparece no header

### 11.3 Senha
- [ ] **Alterar Senha:** Atualizar senha
- [ ] **Validação:** Testar validação (senha muito curta, sem confirmação, etc.)
- [ ] **Login:** Fazer logout e login com nova senha

### 11.4 Preferências
- [ ] **Tema:** Alternar entre claro/escuro e verificar persistência
- [ ] **Notificações:** Habilitar/desabilitar notificações
- [ ] **Salvar:** Verificar se preferências são salvas

---

## 🔔 12. Testes de Notificações

### 12.1 Sistema de Notificações
- [ ] **Ícone:** Verificar se ícone de sino aparece no header
- [ ] **Contador:** Verificar se contador de não lidas é exibido
- [ ] **Dropdown:** Clicar e verificar se notificações aparecem
- [ ] **Marcar como Lida:** Clicar em notificação e verificar fade out
- [ ] **Contador:** Verificar se contador é atualizado

### 12.2 Criação de Notificações (Admin)
- [ ] **Criar:** Criar notificação via admin
- [ ] **Enviar:** Enviar para usuário específico
- [ ] **Verificar:** Verificar se notificação aparece no destinatário

---

## 📱 13. Testes de Responsividade

### 13.1 Mobile
- [ ] **Navegação:** Testar menu hamburguer em mobile
- [ ] **Formulários:** Verificar se formulários são usáveis em mobile
- [ ] **Player:** Testar player de vídeo em mobile
- [ ] **Chat IA:** Testar interface do chat em mobile

### 13.2 Tablet
- [ ] **Layout:** Verificar layout em tablet
- [ ] **Navegação:** Testar navegação em tablet
- [ ] **Formulários:** Verificar formulários em tablet

### 13.3 Desktop
- [ ] **Layout:** Verificar layout em desktop
- [ ] **Sidebar:** Testar sidebar em diferentes resoluções
- [ ] **Tabelas:** Verificar tabelas em diferentes tamanhos

---

## 🔍 14. Testes de Performance

### 14.1 Carregamento
- [ ] **Primeira Carga:** Medir tempo de carregamento inicial
- [ ] **Navegação:** Testar velocidade de navegação entre páginas
- [ ] **Imagens:** Verificar se imagens são otimizadas
- [ ] **Streaming:** Testar velocidade de streaming de respostas da IA

### 14.2 Optimizações
- [ ] **Lazy Loading:** Verificar se componentes são carregados sob demanda
- [ ] **Cache:** Verificar se dados são cacheados
- [ ] **Bundle Size:** Verificar tamanho do bundle JavaScript

---

## 🐛 15. Testes de Erros

### 15.1 Tratamento de Erros
- [ ] **404:** Acessar URL inexistente e verificar página 404
- [ ] **500:** Simular erro do servidor e verificar tratamento
- [ ] **Validação:** Testar validação de formulários
- [ ] **Toasts:** Verificar se erros são exibidos em toasts

### 15.2 Permissões
- [ ] **Acesso Negado:** Tentar acessar recurso sem permissão
- [ ] **Mensagem:** Verificar se mensagem de acesso negado aparece
- [ ] **Redirecionamento:** Verificar se usuário é redirecionado

---

## ✅ Checklist Final

- [ ] **Todos os testes de autenticação passaram**
- [ ] **Todos os testes de RBAC passaram**
- [ ] **Todos os testes de cursos passaram**
- [ ] **Todos os testes do Laboratório de IA passaram**
- [ ] **Todos os testes de performance passaram**
- [ ] **Todos os testes de responsividade passaram**
- [ ] **Nenhum erro crítico encontrado**
- [ ] **Documentação atualizada**

---

## 📅 Histórico de Testes

### Teste #1 - Autenticação e RBAC
**Data:** 26/10/2025  
**Testador:** Equipe de Desenvolvimento  
**Ambiente:** Local (dev)  
**Resultado:** Passou (com ressalvas)  
**Observações:** 
- ✅ Todos os tipos de login funcionando (Admin, User, Guest)
- ✅ Login inválido mostra erro corretamente
- ✅ Botão de logout funciona
- ✅ Sessão é encerrada corretamente
- ⚠️ **REDIRECIONAMENTO NÃO FUNCIONA** após login e logout (ver PROBLEMA_REDIRECIONAMENTO.md)
- ✅ Formulário de registro funciona
- ✅ Validação de campos funciona
- ✅ Usuários são criados no banco corretamente
- ✅ Role padrão é `user` para novos usuários
- ✅ RBAC implementado corretamente - Guest bloqueado no Laboratório de IA
- ✅ Input do chat desabilitado para guests com mensagem clara
- ✅ API bloqueada com erro 403 para guests
- ⚠️ Credenciais de demonstração criadas manualmente no banco via SQL
- ✅ Sistema de roles funcionando corretamente

### Teste #2 - RBAC e Navegação (Admin)
**Data:** 26/10/2025  
**Testador:** Equipe de Desenvolvimento  
**Ambiente:** Local (dev)  
**Resultado:** Passou parcialmente  
**Observações:** 
- ✅ Dashboard Admin acessível como admin
- ✅ Redirecionamento automático para `/admin` após login admin funcionando
- ✅ Analytics acessível em `/admin/analytics`
- ✅ Audit Logs acessível em `/admin/audit-logs`
- ✅ Laboratório IA acessível em `/ai-lab`
- ✅ Admin IA acessível em `/ai-lab/admin/agents` para admins
- ✅ Menu Admin IA com todos os links funcionando

### Teste #3 - RBAC (Usuário Regular)
**Data:** 26/10/2025  
**Testador:** Equipe de Desenvolvimento  
**Ambiente:** Local (dev)  
**Resultado:** Passou parcialmente  
**Observações:** 
- ✅ Dashboard Admin bloqueado para usuário regular
- ⚠️ **Analytics** - Ao tentar acessar `/analytics` diretamente, retorna 404 E perde a sessão (avatar desaparece do header)
- ⚠️ **Problema:** A página `/analytics` não existe (existe apenas `/admin/analytics`)
- ⚠️ **Sessão:** Aplicação perde o estado da sessão após erro 404
- ✅ Laboratório IA acessível
- ⚠️ **Admin IA** permite acesso à página mas API bloqueia corretamente (erro 401 - OK)
- 🔧 **CORRIGIDO:** Verificação de role adicionada na página `/ai-lab/admin/agents` para redirecionar usuários não-admin

### Teste #4 - Correções e Melhorias
**Data:** 26/10/2025  
**Testador:** Equipe de Desenvolvimento  
**Ambiente:** Local (dev)  
**Resultado:** Passou  
**Observações:** 
- ✅ Criada página `/analytics` com redirecionamento automático para `/admin/analytics`
- ✅ Problema de "perda de sessão" após erro 404 resolvido
- ✅ Verificação de role implementada na página `/ai-lab/admin/agents`
- ✅ Usuários não-admin agora são redirecionados corretamente
- ✅ Avatar permanece visível durante navegação (sessão preservada)
- ✅ Testes RBAC concluídos com sucesso para Usuário Regular

### Teste #5
**Data:** _______________  
**Testador:** _______________  
**Ambiente:** _______________ (dev/staging/production)  
**Resultado:** _______________ (Passou / Falhou)  
**Observações:** _______________
