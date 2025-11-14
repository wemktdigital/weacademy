# Guia de Modelos de IA - WE Academy

## 📋 Visão Geral

Este guia ajuda a escolher o modelo de IA adequado para cada tipo de tarefa no Laboratório de IA da WE Academy.

## 🤖 Modo Auto vs Modo Manual

### 🎯 Modo Auto (Cursor-like)
Assim como o Cursor AI tem seu "modo Auto" que seleciona automaticamente o melhor modelo (geralmente Claude Sonnet para qualidade ou GPT-5 Nano para velocidade), o Laboratório de IA da WE Academy oferece:

**Como funciona:**
- Você **não escolhe** o modelo manualmente
- O sistema **analisa** a complexidade da tarefa
- Seleciona automaticamente entre modelos "balanceados" (ex: Gemini Flash, GPT-5 Nano)
- **Benefício**: Equilibrio automático entre qualidade, velocidade e custo

**Quando usar:**
- Tarefas rotineiras e casuais
- Quando você quer simplicidade
- Para conversas rápidas
- Quando a qualidade "boa o suficiente" é aceitável

**Limitação:** Você **não tem controle** sobre qual modelo específico será usado

---

### 🎛️ Modo Manual (Nossa Implementação)
No Laboratório de IA, você **sempre escolhe** o modelo manualmente:

**Como funciona:**
- Você seleciona o **provedor** (OpenAI, Google, DeepSeek, etc.)
- Você seleciona o **modelo específico** (GPT-5 Nano, Gemini Pro, etc.)
- Pode configurar agentes personalizados com modelos preferidos
- **Benefício**: Controle total sobre custo, velocidade e qualidade

**Quando usar:**
- Para prototipagem → use modelos baratos
- Para produção → use modelos de alta qualidade
- Para tarefas específicas → use modelos especializados
- Quando você quer otimizar custos

**Vantagem:** Controle total e previsibilidade de custos

---

### 🔄 Diferenças Principais

| Aspecto | Cursor Auto | WE Academy Manual |
|---------|-------------|-------------------|
| **Seleção** | Automática | Manual |
| **Controle** | Limitado | Total |
| **Custo** | Variável | Previsível |
| **Flexibilidade** | Média | Alta |
| **Simplicidade** | Alta | Média |
| **Ideal para** | Desenvolvimento rápido | Produção e otimização |

### 💡 Recomendação

**Use o Laboratório de IA quando:**
- Você quer **controlar os custos** de cada chamada
- Precisa de **qualidade específica** para tarefas críticas
- Quer **comparar** diferentes modelos
- Precisa de **modelos especializados** (DeepSeek para código, Veo para vídeo, etc.)
- Quer criar **agentes** com modelos preferidos

**Continue usando Cursor Auto quando:**
- Desenvolvimento rápido e iterativo
- Não quer se preocupar com escolhas
- Prefere que o sistema decida por você

---

## 🎚️ Configuração Recomendada: "Quase Auto"

Para simular um "modo Auto" no Laboratório de IA:

### Configuração 1: Desenvolvimento (Barato e Rápido)
- **Modelo**: Gemini Flash Lite ou GPT-5 Nano
- **Provedor**: Google ou OpenAI
- **Quando**: Tarefas simples, iterações rápidas
- **Custo**: ~$0.001-0.002 / 1K tokens

### Configuração 2: Produção (Balanceado)
- **Modelo**: Gemini Flash ou Claude Haiku
- **Provedor**: Google ou Anthropic
- **Quando**: Tarefas normais, boa qualidade
- **Custo**: ~$0.002-0.80 / 1K tokens

### Configuração 3: Crítico (Alta Qualidade)
- **Modelo**: Claude Sonnet ou Gemini Pro
- **Provedor**: Anthropic ou Google
- **Quando**: Trabalhos importantes, máxima precisão
- **Custo**: ~$1.25-3.00 / 1K tokens

**Dica:** Crie **agentes** com essas configurações e mude entre eles conforme necessário!

---

## 🤖 OpenAI

### GPT-5 Nano
- **Custo**: $0.0025 / 1K tokens (muito baixo)
- **Velocidade**: ⚡⚡⚡⚡⚡ (muito rápido)
- **Qualidade**: ⭐⭐⭐⭐ (boa)
- **Melhor para**:
  - Conversas rápidas e informais
  - Análise de texto simples
  - Respostas curtas e diretas
  - Desenvolvimento e teste de ideias
- **Quando usar**: Quando você precisa de respostas rápidas e baratas para tarefas simples
- **Não é ideal para**: Tarefas complexas que exigem raciocínio profundo ou análise detalhada

---

## ✨ Google Gemini

### Gemini 2.5 Flash
- **Custo**: $0.002 / 1K tokens (muito baixo)
- **Velocidade**: ⚡⚡⚡⚡⚡ (muito rápido)
- **Qualidade**: ⭐⭐⭐⭐ (boa)
- **Multimodal**: ✅ (imagens e texto)
- **Melhor para**:
  - Análise de imagens e documentos
  - Processamento de grandes volumes de texto
  - Respostas rápidas com boa qualidade
  - Tarefas que exigem contexto visual
- **Quando usar**: Ideal para uso geral com suporte a imagens

### Gemini 2.5 Pro
- **Custo**: $1.25 / 1M tokens input (alto)
- **Velocidade**: ⚡⚡ (lento)
- **Qualidade**: ⭐⭐⭐⭐⭐ (excelente)
- **Multimodal**: ✅✅✅ (muito avançado)
- **Melhor para**:
  - Análise profunda de dados complexos
  - Raciocínio avançado e matemática
  - Geração de código complexo
  - Análise de documentos longos
  - Aplicações web interativas
- **Quando usar**: Quando a qualidade é mais importante que velocidade e custo
- **Não é ideal para**: Conversas rápidas ou uso em larga escala

### Gemini 2.5 Flash Lite
- **Custo**: $0.001 / 1K tokens (extremamente baixo)
- **Velocidade**: ⚡⚡⚡⚡⚡ (extremamente rápido)
- **Qualidade**: ⭐⭐⭐ (razoável)
- **Melhor para**:
  - Tarefas simples e repetitivas
  - Processamento em lote (batch)
  - Uso em grande escala
  - Classificação e categorização básica
- **Quando usar**: Quando você precisa processar muitos dados rapidamente e barato

### Gemini 2.5 Flash Image
- **Custo**: $0.002 / 1K tokens (muito baixo)
- **Velocidade**: ⚡⚡⚡⚡ (rápido)
- **Qualidade**: ⭐⭐⭐⭐ (boa)
- **Especialização**: 🖼️ Análise de imagens
- **Melhor para**:
  - Análise detalhada de imagens
  - OCR (reconhecimento de texto em imagens)
  - Descrição de fotos e gráficos
  - Moderação de conteúdo visual
- **Quando usar**: Quando o trabalho principal é análise de imagens

### Veo 3.1 Generate Preview
- **Custo**: $1.0 / 1K tokens (alto)
- **Velocidade**: ⚡ (muito lento)
- **Qualidade**: 🎬 Alta qualidade de vídeo
- **Especialização**: 🎬 Geração de vídeo
- **Melhor para**:
  - Geração de vídeos de alta qualidade
  - Produção de conteúdo visual complexo
  - Simulação de física do mundo real
  - Diferentes estilos visuais
- **Quando usar**: Para produções profissionais de vídeo

### Veo 3.1 Fast Generate Preview
- **Custo**: $0.5 / 1K tokens (médio)
- **Velocidade**: ⚡⚡⚡ (rápido)
- **Qualidade**: 🎬 Boa qualidade de vídeo
- **Especialização**: 🎬 Geração rápida de vídeo
- **Melhor para**:
  - Prototipagem rápida de vídeos
  - Testes e iterações
  - Vídeos mais simples
- **Quando usar**: Quando você precisa de vídeos rápidos para teste

### Gemma 3
- **Custo**: 🎁 **GRATUITO** (open source!)
- **Velocidade**: ⚡⚡⚡⚡ (rápido)
- **Qualidade**: ⭐⭐⭐ (razoável-boa)
- **Especialização**: 🎯 Modelo open source compacto e eficiente
- **Melhor para**:
  - Tarefas intermediárias
  - Uso em dispositivos com recursos limitados
  - Quando você precisa de custo zero
  - Projetos pessoais e experimentais
- **Quando usar**: Quando você quer qualidade boa sem gastar nada
- **Nota**: Modelo open source do Google, disponível gratuitamente

---

## 🔥 DeepSeek

### DeepSeek Chat
- **Custo**: $0.14 / 1M tokens input (muito baixo)
- **Velocidade**: ⚡⚡⚡⚡ (rápido)
- **Qualidade**: ⭐⭐⭐⭐ (boa)
- **Melhor para**:
  - Programação e desenvolvimento
  - Análise de código
  - Geração de código
  - Refatoração e debug
- **Quando usar**: Ideal para desenvolvedores e tarefas de programação

### DeepSeek Reasoner
- **Custo**: $0.55 / 1M tokens input (baixo)
- **Velocidade**: ⚡⚡⚡ (médio-rápido)
- **Qualidade**: ⭐⭐⭐⭐⭐ (excelente em raciocínio)
- **Melhor para**:
  - Resolução de problemas complexos
  - Análise matemática avançada
  - Raciocínio lógico profundo
  - Dilemas e análises complexas
- **Quando usar**: Quando o problema requer raciocínio passo a passo

---

## ⚡ Grok (xAI)

### Grok-4 Fast
- **Custo**: $0.20 / 1K tokens (baixo-médio)
- **Velocidade**: ⚡⚡⚡⚡⚡ (muito rápido)
- **Qualidade**: ⭐⭐⭐⭐ (boa)
- **Melhor para**:
  - Conversas dinâmicas
  - Análise em tempo real
  - Respostas rápidas e naturais
  - Tarefas gerais interativas
- **Quando usar**: Para chat interativo rápido
- **Observação**: Desenvolvido pelo xAI (Elon Musk)

### Grok-4 Fast Reasoning
- **Custo**: $0.80 / 1K tokens (médio)
- **Velocidade**: ⚡⚡⚡⚡ (rápido)
- **Qualidade**: ⭐⭐⭐⭐⭐ (excelente)
- **Melhor para**:
  - Raciocínio rápido e profundo
  - Análise complexa em tempo hábil
  - Decisões estratégicas
  - Pensamento crítico acelerado
- **Quando usar**: Quando você precisa de qualidade alta com velocidade

---

## 🎯 Anthropic (Claude)

### Claude Sonnet 4.5
- **Custo**: $3.00 / 1M tokens input (alto)
- **Velocidade**: ⚡⚡ (lento)
- **Qualidade**: ⭐⭐⭐⭐⭐ (excelente)
- **Melhor para**:
  - Análise de documentos longos
  - Redação profissional
  - Análise estratégica
  - Tarefas que exigem precisão máxima
- **Quando usar**: Para trabalhos que exigem máxima qualidade e precisão
- **Vantagem**: Excelente em manter contexto longo

### Claude Haiku 4.5
- **Custo**: $0.80 / 1M tokens input (baixo)
- **Velocidade**: ⚡⚡⚡⚡⚡ (muito rápido)
- **Qualidade**: ⭐⭐⭐⭐ (muito boa)
- **Melhor para**:
  - Respostas rápidas de alta qualidade
  - Extração de informações
  - Moderação de conteúdo
  - Análise de dados
- **Quando usar**: Ideal para uso geral rápido com qualidade Claude

### Claude Opus 4.1
- **Custo**: $15.00 / 1M tokens input (muito alto)
- **Velocidade**: ⚡ (muito lento)
- **Qualidade**: ⭐⭐⭐⭐⭐⭐ (excepcional)
- **Melhor para**:
  - Pesquisa acadêmica
  - Análise crítica complexa
  - Trabalhos criativos de alta qualidade
  - Resolução de problemas extremamente complexos
- **Quando usar**: Para os trabalhos mais complexos e importantes
- **Não é ideal para**: Uso casual ou em larga escala (muito caro)

---

## 📊 Tabela Comparativa Rápida

| Modelo | Custo | Velocidade | Qualidade | Uso Principal |
|--------|-------|------------|-----------|---------------|
| **GPT-5 Nano** | 🟢 Muito Baixo | 🟢 Muito Rápido | 🟡 Boa | Chat rápido |
| **Gemini Flash** | 🟢 Muito Baixo | 🟢 Muito Rápido | 🟡 Boa | Uso geral + imagens |
| **Gemini Pro** | 🔴 Alto | 🔴 Lento | 🟢 Excelente | Análise complexa |
| **Gemini Flash Lite** | 🟢 Extremo | 🟢 Extremo | 🟡 Razoável | Batch/escala |
| **Gemini Flash Image** | 🟢 Muito Baixo | 🟢 Rápido | 🟡 Boa | Análise de imagens |
| **Veo 3.1 Fast** | 🟡 Médio | 🟢 Rápido | 🟢 Boa | Vídeo rápido |
| **Veo 3.1** | 🔴 Alto | 🔴 Lento | 🟢 Alta | Vídeo profissional |
| **Gemma 3** | 🟢 GRATUITO | 🟢 Rápido | 🟡 Razoável | Open Source |
| **DeepSeek Chat** | 🟢 Muito Baixo | 🟢 Rápido | 🟡 Boa | Programação |
| **DeepSeek Reasoner** | 🟢 Baixo | 🟡 Médio | 🟢 Excelente | Raciocínio |
| **Grok-4 Fast** | 🟡 Baixo-Médio | 🟢 Muito Rápido | 🟡 Boa | Chat dinâmico |
| **Grok-4 Reasoning** | 🟡 Médio | 🟢 Rápido | 🟢 Excelente | Raciocínio rápido |
| **Claude Haiku** | 🟢 Baixo | 🟢 Muito Rápido | 🟡 Muito Boa | Uso geral |
| **Claude Sonnet** | 🔴 Alto | 🔴 Lento | 🟢 Excelente | Precisão máxima |
| **Claude Opus** | 🔴 Muito Alto | 🔴 Muito Lento | 🟢 Excepcional | Pesquisa/Crítico |

Legenda:
- 🟢 = Melhor
- 🟡 = Médio
- 🔴 = Pior

---

## 🎯 Recomendações por Tipo de Tarefa

### 💬 Conversa Casual
1. **Gemini Flash** - Melhor custo-benefício com suporte a imagens
2. **Grok-4 Fast** - Respostas rápidas e naturais
3. **Claude Haiku** - Muito boa qualidade

### 💻 Programação e Desenvolvimento
1. **DeepSeek Chat** - Especializado em código
2. **Gemini Pro** - Excelente para projetos complexos
3. **Claude Sonnet** - Máxima precisão

### 📚 Análise de Documentos
1. **Claude Opus** - Melhor para documentos longos
2. **Gemini Pro** - Grande contexto
3. **Claude Sonnet** - Alta qualidade

### 🖼️ Análise de Imagens
1. **Gemini Flash Image** - Especializado
2. **Gemini Flash** - Básico
3. **Gemini Pro** - Avançado

### 🎬 Geração de Vídeo
1. **Veo 3.1 Fast** - Prototipagem
2. **Veo 3.1** - Produção

### 🧮 Matemática e Raciocínio
1. **DeepSeek Reasoner** - Melhor custo-benefício
2. **Grok-4 Fast Reasoning** - Rápido e bom
3. **Claude Opus** - Máxima qualidade

### 📊 Análise de Dados
1. **Claude Haiku** - Rápido e eficiente
2. **Gemini Flash** - Custo baixo
3. **Gemini Pro** - Análise complexa

### 💡 Prototipagem Rápida
1. **Gemini Flash Lite** - Extremamente barato
2. **GPT-5 Nano** - Muito rápido
3. **Gemini Flash** - Balanceado

### 🚀 Produção Crítica
1. **Claude Opus** - Máxima qualidade
2. **Claude Sonnet** - Excelente qualidade
3. **Gemini Pro** - Multimodal avançado

---

## 💰 Gerenciamento de Custos

### Modelos para Uso em Larga Escala (Baratos)
- Gemini Flash Lite
- Gemini Flash
- GPT-5 Nano
- DeepSeek Chat

### Modelos para Uso Moderado (Balanceados)
- Claude Haiku
- Gemini Flash Image
- Grok-4 Fast
- Gemma 3

### Modelos para Uso Seletivo (Caros)
- Gemini Pro
- Claude Sonnet
- Veo 3.1
- DeepSeek Reasoner

### Modelos para Uso Excepcional (Muito Caros)
- Claude Opus
- Veo 3.1 (produção profissional)

---

## 🔍 Como Escolher

### Perguntas para Decidir:

1. **Qual é o seu orçamento?**
   - Baixo → Gemini Flash Lite, GPT-5 Nano
   - Médio → Gemini Flash, Claude Haiku
   - Alto → Gemini Pro, Claude Sonnet
   - Sem limites → Claude Opus

2. **Qual é a urgência?**
   - Imediata → GPT-5 Nano, Gemini Flash Lite
   - Rápida → Gemini Flash, Grok-4 Fast
   - Pode esperar → Gemini Pro, Claude Sonnet

3. **Qual é a complexidade?**
   - Simples → Gemini Flash Lite
   - Moderada → Gemini Flash, Claude Haiku
   - Complexa → Gemini Pro, Claude Sonnet
   - Crítica → Claude Opus

4. **Precisa de imagens?**
   - Sim → Gemini Flash Image, Gemini Flash, Gemini Pro
   - Não → Use outros modelos (mais baratos)

5. **Precisa de vídeo?**
   - Protótipo → Veo 3.1 Fast
   - Produção → Veo 3.1

6. **É programação?**
   - Sim → DeepSeek Chat ou DeepSeek Reasoner
   - Não → Outros modelos

---

## 📝 Notas Finais

- **Comece com modelos mais baratos** para testar suas necessidades
- **Atualize para modelos mais avançados** apenas quando necessário
- **Monitore custos** regularmente usando o painel de admin
- **Combine modelos** - use baratos para iterações, caros para resultados finais
- **Aproveite o streaming** - modelos mais rápidos mostram resposta incrementalmente

---

## 🆘 Precisa de Ajuda?

Entre em contato com a equipe de desenvolvimento ou consulte a documentação técnica em `/docs/TESTES_MANUAIS.md`.

