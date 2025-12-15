-- Tabela de certificados do laboratório de IA
CREATE TABLE IF NOT EXISTS lab_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para certificados
CREATE INDEX IF NOT EXISTS idx_lab_certificates_user_id ON lab_certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_certificates_issued_at ON lab_certificates(issued_at DESC);

-- Tabela de alertas de custo
CREATE TABLE IF NOT EXISTS lab_cost_alerts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_cost NUMERIC(10, 4) NOT NULL,
  alert_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para alertas
CREATE INDEX IF NOT EXISTS idx_lab_cost_alerts_user_id ON lab_cost_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_cost_alerts_alert_sent ON lab_cost_alerts(alert_sent);
CREATE INDEX IF NOT EXISTS idx_lab_cost_alerts_created_at ON lab_cost_alerts(created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE lab_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_cost_alerts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para certificados
CREATE POLICY "Users can view their own certificates"
  ON lab_certificates
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own certificates"
  ON lab_certificates
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Políticas RLS para alertas (apenas admin pode ver todos)
CREATE POLICY "Users can view their own cost alerts"
  ON lab_cost_alerts
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gestor_we')
    )
  );

CREATE POLICY "System can insert cost alerts"
  ON lab_cost_alerts
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update cost alerts"
  ON lab_cost_alerts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gestor_we')
    )
  );

-- Comentários
COMMENT ON TABLE lab_certificates IS 'Certificados de conclusão do Laboratório de IA';
COMMENT ON TABLE lab_cost_alerts IS 'Alertas de custo por usuário no Laboratório de IA';
