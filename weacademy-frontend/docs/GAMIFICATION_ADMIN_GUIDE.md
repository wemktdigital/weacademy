# 🎮 Guia Administrativo - Sistema de Gamificação

## Visão Geral

Este guia fornece instruções completas para administradores gerenciarem o sistema de gamificação da WE Academy, incluindo criação de achievements, configuração de níveis, análise de métricas e gerenciamento de usuários.

## 📋 Índice

1. [Acesso à Interface Administrativa](#acesso-à-interface-administrativa)
2. [Gerenciamento de Achievements](#gerenciamento-de-achievements)
3. [Configuração de Níveis](#configuração-de-níveis)
4. [Analytics e Métricas](#analytics-e-métricas)
5. [Exportar/Importar Configurações](#exportarimportar-configurações)
6. [Gerenciamento de Usuários](#gerenciamento-de-usuários)
7. [Melhores Práticas](#melhores-práticas)

---

## 1. Acesso à Interface Administrativa

### Como Acessar

1. Faça login como **admin** na plataforma
2. Acesse `/admin/gamification` no navegador
3. Você verá o dashboard principal de gamificação

### Menu de Navegação

- **Dashboard**: Visão geral do sistema
- **Achievements**: Gerenciar badges/conquistas
- **Níveis**: Configurar níveis de XP
- **Settings**: Configurações gerais
- **Analytics**: Estatísticas e métricas detalhadas

---

## 2. Gerenciamento de Achievements

### Criar um Novo Achievement

1. Acesse `/admin/gamification/achievements`
2. Clique em **"Novo Achievement"**
3. Preencha os campos:

#### Campos Obrigatórios

- **Código** (`code`): Identificador único (ex: `first_step`, `quiz_master`)
  - Use apenas letras minúsculas, números e underscores
  - Deve ser único no sistema
  
- **Nome** (`name`): Nome exibido ao usuário (ex: "Primeiro Passo")

- **Descrição** (`description`): Descrição do achievement

- **Categoria** (`category`): Escolha uma das categorias:
  - `courses`: Relacionado a cursos
  - `quizzes`: Relacionado a quizzes
  - `lab-ia`: Relacionado ao Laboratório de IA
  - `community`: Relacionado a comunidade
  - `special`: Especial/eventos

#### Campos Opcionais

- **Ícone** (`icon`): Emoji ou texto para o badge (padrão: 🏆)
- **Pontos** (`points`): XP adicional ao desbloquear (padrão: 0)
- **Raridade** (`rarity`): Nível de raridade:
  - `common`: Comum (maioria dos usuários)
  - `uncommon`: Incomum (alguns usuários)
  - `rare`: Raro (poucos usuários)
  - `epic`: Épico (muito raro)
  - `legendary`: Lendário (extremamente raro)

- **Condições** (`conditions`): JSON com condições para desbloquear

### Exemplos de Condições JSON

#### Achievement por Número de Cursos Completos

```json
{
  "type": "courses_completed",
  "count": 5
}
```

#### Achievement por Score Perfeito em Quizzes

```json
{
  "type": "quiz_perfect",
  "count": 3
}
```

#### Achievement por Sequência de Estudos

```json
{
  "type": "streak",
  "min_days": 7
}
```

#### Achievement por Uso do Lab IA

```json
{
  "type": "lab_ia_usage",
  "min_requests": 100
}
```

#### Achievement Combinado

```json
{
  "type": "composite",
  "conditions": [
    {
      "type": "courses_completed",
      "count": 5
    },
    {
      "type": "quiz_perfect",
      "count": 3
    }
  ],
  "operator": "AND"
}
```

### Editar Achievement Existente

1. Acesse `/admin/gamification/achievements`
2. Clique no botão **"Editar"** no achievement desejado
3. Modifique os campos necessários
4. Clique em **"Salvar"**

**⚠️ Atenção**: Alterações em achievements ativos afetam todos os usuários. Mudanças em `conditions` não desbloqueiam automaticamente achievements já desbloqueados.

### Desativar/Ativar Achievement

1. Acesse a lista de achievements
2. Use o toggle **"Ativo"** para desativar/ativar
3. Achievements desativados não aparecem para usuários e não podem ser desbloqueados

### Deletar Achievement

1. Acesse a lista de achievements
2. Clique em **"Deletar"** no achievement desejado
3. Confirme a ação

**⚠️ Atenção**: Deletar um achievement também remove todos os desbloqueios associados. Use com cuidado.

---

## 3. Configuração de Níveis

### Acessar Configuração de Níveis

1. Acesse `/admin/gamification/levels`
2. Você verá todos os níveis configurados

### Criar um Novo Nível

1. Clique em **"Novo Nível"**
2. Preencha os campos:

#### Campos Obrigatórios

- **Número do Nível** (`level_number`): Número único do nível (ex: 1, 2, 3...)
- **Nome** (`name`): Nome do nível (ex: "Iniciante", "Avançado")
- **XP Mínimo** (`min_xp`): XP necessário para alcançar este nível
- **XP Máximo** (`max_xp`): XP máximo do nível (deixe NULL para nível máximo)

#### Campos Opcionais

- **Ícone** (`icon`): Emoji ou símbolo (padrão: ⭐)
- **Cor** (`color`): Cor hexadecimal (ex: `#29CEDF`)
- **Benefícios** (`benefits`): Array JSON de benefícios:

```json
[
  "Badge exclusivo",
  "Acesso antecipado a novos cursos",
  "Desconto de 10% em certificações"
]
```

### Exemplo de Configuração de Níveis Balanceados

```
Nível 1 - Iniciante:    0-99 XP    (⭐)
Nível 2 - Básico:       100-299 XP (⭐)
Nível 3 - Intermediário: 300-599 XP (⭐)
Nível 4 - Avançado:     600-999 XP (⭐)
Nível 5 - Especialista: 1000+ XP   (⭐)
```

**Dica**: Use uma progressão exponencial para níveis mais altos:
- Níveis 1-5: 100 XP cada
- Níveis 6-10: 200 XP cada
- Níveis 11-15: 300 XP cada
- E assim por diante...

### Editar Nível Existente

1. Acesse a lista de níveis
2. Clique em **"Editar"** no nível desejado
3. Modifique os campos
4. Clique em **"Salvar"**

**⚠️ Atenção**: Alterar `min_xp` ou `max_xp` afeta todos os usuários que estão nesse nível. Use com cuidado.

---

## 4. Analytics e Métricas

### Acessar Analytics

1. Acesse `/admin/gamification/analytics`
2. Você verá estatísticas em tempo real

### Métricas Disponíveis

#### Overview Cards

- **Total de Usuários**: Número total de usuários cadastrados
- **Usuários Ativos**: Usuários que têm gamificação ativa
- **Achievements**: Total de badges disponíveis
- **Níveis**: Total de níveis configurados
- **Taxa de Engajamento**: Percentual de usuários engajados

#### Top 10 Usuários

Lista dos usuários com mais XP acumulado, mostrando:
- Posição no ranking
- Nome e avatar
- Nível atual
- XP total

#### Achievements Mais Desbloqueados

Lista dos badges mais populares, mostrando:
- Posição
- Ícone e nome
- Código do achievement
- Número de usuários que desbloquearam

#### Distribuição de Níveis

Gráfico mostrando quantos usuários estão em cada nível, útil para:
- Identificar níveis muito fáceis (muitos usuários)
- Identificar níveis muito difíceis (poucos usuários)
- Balancear a progressão de XP

### Como Interpretar as Métricas

#### Taxa de Engajamento

- **Alta (>70%)**: Sistema está funcionando bem
- **Média (40-70%)**: Possível necessidade de ajustes
- **Baixa (<40%)**: Investigar problemas ou melhorar incentives

#### Distribuição de Níveis

- **Pirâmide saudável**: Maioria em níveis baixos, poucos em altos
- **Plataforma**: Muitos no mesmo nível = necessidade de balanceamento
- **Invertida**: Muitos em níveis altos = muito fácil ou migração de dados

#### Achievements Populares

- Identifica quais achievements motivam mais os usuários
- Use para criar achievements similares
- Achievements muito difíceis (poucos desbloqueados) podem precisar de ajuste

---

## 5. Exportar/Importar Configurações

### Exportar Configurações

1. Acesse `/admin/gamification`
2. Clique em **"Exportar Configurações"**
3. Um arquivo JSON será baixado contendo:
   - Todos os achievements
   - Todos os níveis
   - Configurações gerais

**Uso**: Backup, migração para outro ambiente, versionamento

### Importar Configurações

1. Acesse `/admin/gamification`
2. Clique em **"Importar Configurações"**
3. Selecione o arquivo JSON
4. Confirme a importação

**⚠️ Atenção**: Importar sobrescreve configurações existentes. Faça backup antes.

### Estrutura do Arquivo JSON

```json
{
  "achievements": [
    {
      "code": "first_step",
      "name": "Primeiro Passo",
      "description": "Completar primeira aula",
      "icon": "🎯",
      "category": "courses",
      "points": 10,
      "rarity": "common",
      "conditions": {
        "type": "courses_completed",
        "count": 1
      }
    }
  ],
  "levels": [
    {
      "level_number": 1,
      "name": "Iniciante",
      "min_xp": 0,
      "max_xp": 99,
      "icon": "⭐",
      "color": "#29CEDF"
    }
  ],
  "settings": {
    "xp_multiplier": 1.0,
    "streak_bonus_enabled": true
  }
}
```

---

## 6. Gerenciamento de Usuários

### Resetar XP de um Usuário

1. Acesse `/admin/gamification`
2. Na seção "Usuários", localize o usuário
3. Clique em **"Resetar Gamificação"**
4. Confirme a ação

**Ação**: Remove todos os pontos, achievements e reseta o nível para 1.

**⚠️ Atenção**: Esta ação não pode ser desfeita. Use apenas em casos excepcionais.

### Adicionar XP Manualmente

1. Acesse `/admin/gamification`
2. Localize o usuário
3. Clique em **"Adicionar XP"**
4. Digite a quantidade de XP
5. Adicione uma razão (opcional)
6. Confirme

**Uso**: Compensar bugs, eventos especiais, testes

### Migrar Usuários Existentes

1. Acesse `/admin/gamification`
2. Clique em **"Migrar Usuários Existentes"**
3. Confirme a ação

**Ação**: Calcula XP retroativo baseado em:
- Cursos completados: 100 XP por curso
- Aulas completadas: 10 XP por aula
- Quizzes passados: 50 XP por quiz

**⚠️ Atenção**: Execute apenas uma vez. Executar novamente duplicará XP.

---

## 7. Melhores Práticas

### Criar Achievements Efetivos

1. **Faça-os alcançáveis**: Achievements muito difíceis desmotivam
2. **Variedade**: Crie achievements para diferentes tipos de atividade
3. **Progressão**: Achievements relacionados que levem a achievements maiores
4. **Feedback claro**: Descrições devem deixar claro como desbloquear

### Balancear XP e Níveis

1. **Progressão suave**: Níveis não devem ser muito espaçados
2. **Recompensas justas**: XP deve refletir o esforço necessário
3. **Teste com usuários reais**: Ajuste baseado em feedback
4. **Mantenha consistência**: XP similar para ações similares

### Monitorar Métricas

1. **Revisar semanalmente**: Verifique engajamento e distribuição
2. **Ajustar dinamicamente**: Faça pequenos ajustes baseados em dados
3. **Escutar feedback**: Usuários são a melhor fonte de informações
4. **Experimentar**: Teste novas features e veja o impacto

### Segurança

1. **Backup regular**: Exporte configurações regularmente
2. **Teste em staging**: Teste mudanças antes de produção
3. **Auditoria**: Use o change log para rastrear mudanças
4. **Acesso restrito**: Apenas admins devem ter acesso

### Suporte a Usuários

1. **Comunicação clara**: Explique como o sistema funciona
2. **Suporte a problemas**: Monitore problemas e resolva rapidamente
3. **Feedback loop**: Colete e implemente sugestões de usuários
4. **Documentação**: Mantenha documentação atualizada

---

## 🔍 Troubleshooting

### Achievement Não Está Sendo Desbloqueado

1. Verifique se o achievement está **ativo**
2. Verifique se as **condições** estão corretas
3. Execute **"Verificar Achievements"** para o usuário
4. Verifique logs de erro no console

### Usuário Não Está Recebendo XP

1. Verifique se os **triggers SQL** estão ativos
2. Verifique se a ação do usuário está registrada corretamente
3. Verifique se há erros no console
4. Teste manualmente adicionando XP

### Leaderboard Não Está Atualizado

1. Execute **"Atualizar Leaderboard"** manualmente
2. Verifique se a função `refresh_leaderboard` está funcionando
3. Verifique logs de erro

### Nível Não Está Mudando

1. Verifique se o XP total foi atualizado
2. Verifique se a função `update_user_level_from_xp` está sendo chamada
3. Verifique se há erros no console

---

## 📞 Suporte

Para mais ajuda:
- Consulte a documentação de desenvolvedor: `GAMIFICATION_DEVELOPER_GUIDE.md`
- Entre em contato com a equipe de desenvolvimento
- Verifique logs do sistema em `/admin/audit-logs`

---

**Última atualização**: Janeiro 2025
**Versão**: 1.0.0
