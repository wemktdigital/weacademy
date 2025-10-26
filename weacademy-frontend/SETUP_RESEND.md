# 📧 Configuração do Resend

O Resend é usado para envio de emails de alertas no Laboratório de IA.

## 🚀 Como Configurar

### 1. Criar Conta no Resend

1. Acesse [https://resend.com](https://resend.com)
2. Crie uma conta (gratuita até 3.000 emails/mês)
3. Verifique seu domínio ou use o domínio de teste

### 2. Obter API Key

1. Acesse o Dashboard do Resend
2. Vá em **Settings** → **API Keys**
3. Clique em **Create API Key**
4. Escolha um nome (ex: "WE Academy Dev")
5. Copie a API Key gerada

### 3. Configurar no Projeto

1. Abra o arquivo `.env.local` na raiz do projeto
2. Localize a linha:
   ```bash
   RESEND_API_KEY=your_resend_api_key_here
   ```
3. Substitua `your_resend_api_key_here` pela sua API Key
4. Salve o arquivo

### 4. Verificar Configuração

As seguintes variáveis devem estar configuradas em `.env.local`:

```bash
# Resend Configuration
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx

# Laboratório de IA - Configurações
LAB_MAX_COST_USD=50
LAB_ALERT_EMAIL=contato@wemarketingdigital.com.br
```

## 📝 Notas

- **Desenvolvimento**: Você pode usar o domínio de teste do Resend (`onboarding@resend.dev`)
- **Produção**: Configure o seu domínio (`@wemarketingdigital.com.br`)
- **Limite Gratuito**: 3.000 emails/mês no plano gratuito
- **Rate Limit**: Máximo de 100 emails por segundo

## 🔗 Links Úteis

- Dashboard: https://resend.com/dashboard
- Documentação: https://resend.com/docs
- Preços: https://resend.com/pricing

## 🎯 Uso no Projeto

O Resend é usado para:
- ✅ Alertas de custo (quando usuário excede limite)
- ⏳ Notificações de certificados
- ⏳ Emails de boas-vindas
- ⏳ Recuperação de senha
