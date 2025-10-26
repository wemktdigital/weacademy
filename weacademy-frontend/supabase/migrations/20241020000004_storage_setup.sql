-- WE Academy - Configuração do Storage para Avatars
-- Criado em: 2024-10-20

-- Criar bucket para avatars
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Política para permitir upload de avatars apenas para usuários autenticados
CREATE POLICY "Users can upload their own avatar" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para permitir visualização pública de avatars
CREATE POLICY "Avatars are publicly viewable" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- Política para permitir atualização de avatars
CREATE POLICY "Users can update their own avatar" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para permitir exclusão de avatars
CREATE POLICY "Users can delete their own avatar" ON storage.objects
FOR DELETE USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Função para limpar avatars antigos quando um novo é enviado
CREATE OR REPLACE FUNCTION public.cleanup_old_avatar()
RETURNS TRIGGER AS $$
BEGIN
  -- Deletar avatar antigo se existir
  DELETE FROM storage.objects 
  WHERE bucket_id = 'avatars' 
    AND name LIKE NEW.id || '%'
    AND name != NEW.avatar_url;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para limpeza automática
CREATE TRIGGER cleanup_old_avatar_trigger
  AFTER UPDATE OF avatar_url ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_old_avatar();
