-- WE Academy - Sistema de Certificados
-- Migration: 20241020000012_certificates.sql

-- Atualizar tabela de certificados existente (adicionar campos necessários)
ALTER TABLE public.certificates
ADD COLUMN IF NOT EXISTS certificate_number TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS qr_code_url TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.profiles(id);

-- Comentários
COMMENT ON COLUMN public.certificates.certificate_number IS 'Número único do certificado';
COMMENT ON COLUMN public.certificates.qr_code_url IS 'URL da imagem do QR Code';
COMMENT ON COLUMN public.certificates.metadata IS 'Metadados do certificado (nota, carga horária, etc)';
COMMENT ON COLUMN public.certificates.verified_at IS 'Data de verificação do certificado';
COMMENT ON COLUMN public.certificates.verified_by IS 'ID do usuário que verificou (admin/instrutor)';

-- Função para gerar número único de certificado
CREATE OR REPLACE FUNCTION generate_certificate_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    exists_check BOOLEAN;
BEGIN
    LOOP
        -- Gerar número: CERT-YYYYMMDD-HHMMSS-RANDOM
        new_number := 'CERT-' || 
                      TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                      TO_CHAR(NOW(), 'HH24MISS') || '-' || 
                      SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6);
        
        -- Verificar se já existe
        SELECT EXISTS(SELECT 1 FROM public.certificates WHERE certificate_number = new_number)
        INTO exists_check;
        
        -- Se não existe, retornar
        IF NOT exists_check THEN
            RETURN new_number;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Função para gerar certificado automaticamente quando curso é concluído
CREATE OR REPLACE FUNCTION auto_generate_certificate()
RETURNS TRIGGER AS $$
DECLARE
    course_completed BOOLEAN;
    course_duration INTEGER;
    v_certificate_number TEXT;
    v_qr_code_url TEXT;
BEGIN
    -- Verificar se o curso foi marcado como completo
    IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
        -- Verificar se não existe certificado
        IF NOT EXISTS (
            SELECT 1 FROM public.certificates 
            WHERE user_id = NEW.user_id 
            AND course_id = NEW.course_id
        ) THEN
            -- Pegar carga horária do curso
            SELECT duration_hours INTO course_duration
            FROM public.courses
            WHERE id = NEW.course_id;
            
            -- Gerar número do certificado
            v_certificate_number := generate_certificate_number();
            
            -- Gerar URL do QR Code (será implementado no frontend)
            v_qr_code_url := '/verify-certificate/' || v_certificate_number;
            
            -- Criar certificado
            INSERT INTO public.certificates (
                user_id,
                course_id,
                certificate_number,
                qr_code_url,
                metadata,
                issued_at
            ) VALUES (
                NEW.user_id,
                NEW.course_id,
                v_certificate_number,
                v_qr_code_url,
                jsonb_build_object(
                    'progress', NEW.progress_percentage,
                    'duration_hours', course_duration,
                    'completed_at', NEW.completed_at
                ),
                NOW()
            );
            
            -- Criar notificação para o usuário
            INSERT INTO public.notifications (user_id, message, read)
            VALUES (
                NEW.user_id,
                'Parabéns! Seu certificado foi gerado com sucesso!',
                false
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para gerar certificado automaticamente
DROP TRIGGER IF EXISTS generate_certificate_on_completion ON public.enrollments;
CREATE TRIGGER generate_certificate_on_completion
    AFTER UPDATE ON public.enrollments
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_certificate();

-- Índices
CREATE INDEX IF NOT EXISTS idx_certificates_number ON public.certificates(certificate_number);
CREATE INDEX IF NOT EXISTS idx_certificates_verified ON public.certificates(verified_at);

-- RLS Policies atualizadas
-- Permitir que qualquer pessoa valide um certificado
CREATE POLICY "Anyone can view certificates by number"
    ON public.certificates FOR SELECT 
    USING (certificate_number IS NOT NULL);

-- Adicionar política para verificação
CREATE POLICY "Admins can verify certificates"
    ON public.certificates FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- Função para verificar certificado
CREATE OR REPLACE FUNCTION verify_certificate(cert_number TEXT)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    course_id UUID,
    certificate_number TEXT,
    issued_at TIMESTAMP WITH TIME ZONE,
    verified_at TIMESTAMP WITH TIME ZONE,
    course_title TEXT,
    user_name TEXT,
    user_email TEXT,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.course_id,
        c.certificate_number,
        c.issued_at,
        c.verified_at,
        course.title as course_title,
        p.full_name as user_name,
        p.email as user_email,
        c.metadata
    FROM public.certificates c
    JOIN public.courses course ON course.id = c.course_id
    JOIN public.profiles p ON p.id = c.user_id
    WHERE c.certificate_number = cert_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para marcar certificado como verificado
CREATE OR REPLACE FUNCTION mark_certificate_verified(
    cert_number TEXT,
    verifier_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_verifier_role TEXT;
BEGIN
    -- Verificar se o verificador é admin ou instrutor
    SELECT role INTO v_verifier_role
    FROM public.profiles
    WHERE id = verifier_id;
    
    IF v_verifier_role NOT IN ('admin', 'instructor') THEN
        RETURN false;
    END IF;
    
    -- Marcar como verificado
    UPDATE public.certificates
    SET verified_at = NOW(),
        verified_by = verifier_id
    WHERE certificate_number = cert_number
    AND verified_at IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
