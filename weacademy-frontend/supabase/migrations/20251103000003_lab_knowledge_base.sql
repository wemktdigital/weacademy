-- Migration: Knowledge Base e RAG
-- Criado em: 2025-11-03
-- Descrição: Sistema de knowledge base com vector store para RAG

-- Habilitar extensão pgvector para embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabela de knowledge bases
CREATE TABLE IF NOT EXISTS public.lab_knowledge_bases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.lab_agents(id) ON DELETE CASCADE, -- NULL = knowledge base global
    name TEXT NOT NULL,
    description TEXT,
    is_global BOOLEAN DEFAULT false, -- true = knowledge base global, false = específica do agente
    
    -- Configurações de chunking
    chunk_size INTEGER DEFAULT 1000, -- Tamanho do chunk em caracteres
    chunk_overlap INTEGER DEFAULT 200, -- Overlap entre chunks
    
    -- Status
    enabled BOOLEAN DEFAULT true,
    
    -- Metadados
    total_documents INTEGER DEFAULT 0,
    total_chunks INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT agent_or_global CHECK (
        (agent_id IS NULL AND is_global = true) OR
        (agent_id IS NOT NULL AND is_global = false)
    )
);

-- Tabela de documentos
CREATE TABLE IF NOT EXISTS public.lab_knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    knowledge_base_id UUID NOT NULL REFERENCES public.lab_knowledge_bases(id) ON DELETE CASCADE,
    
    -- Informações do arquivo
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL, -- 'pdf', 'txt', 'docx', 'md'
    file_size INTEGER, -- Tamanho em bytes
    file_url TEXT, -- URL do arquivo no storage (se aplicável)
    mime_type TEXT,
    
    -- Conteúdo processado
    raw_content TEXT, -- Conteúdo extraído do documento
    metadata JSONB, -- Metadados específicos (ex: número de páginas, autor, etc.)
    
    -- Status de processamento
    processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    
    -- Metadados
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Tabela de chunks (pedaços de documentos com embeddings)
CREATE TABLE IF NOT EXISTS public.lab_knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.lab_knowledge_documents(id) ON DELETE CASCADE,
    knowledge_base_id UUID NOT NULL REFERENCES public.lab_knowledge_bases(id) ON DELETE CASCADE,
    
    -- Conteúdo do chunk
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL, -- Índice do chunk no documento (0, 1, 2, ...)
    
    -- Embedding vector (1536 dimensões para OpenAI text-embedding-3-small)
    embedding vector(1536),
    
    -- Metadados do chunk
    start_char INTEGER, -- Posição inicial no documento original
    end_char INTEGER, -- Posição final no documento original
    metadata JSONB, -- Metadados adicionais (ex: página, seção, etc.)
    
    -- Metadados
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_chunk_range CHECK (start_char IS NULL OR end_char IS NULL OR end_char > start_char)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lab_knowledge_bases_user_id ON public.lab_knowledge_bases(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_knowledge_bases_agent_id ON public.lab_knowledge_bases(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lab_knowledge_bases_is_global ON public.lab_knowledge_bases(is_global) WHERE is_global = true;
CREATE INDEX IF NOT EXISTS idx_lab_knowledge_bases_enabled ON public.lab_knowledge_bases(enabled) WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_lab_knowledge_documents_knowledge_base_id ON public.lab_knowledge_documents(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_lab_knowledge_documents_processing_status ON public.lab_knowledge_documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_lab_knowledge_documents_file_type ON public.lab_knowledge_documents(file_type);

CREATE INDEX IF NOT EXISTS idx_lab_knowledge_chunks_document_id ON public.lab_knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_lab_knowledge_chunks_knowledge_base_id ON public.lab_knowledge_chunks(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_lab_knowledge_chunks_chunk_index ON public.lab_knowledge_chunks(document_id, chunk_index);

-- Índice HNSW para busca vetorial (similarity search)
CREATE INDEX IF NOT EXISTS idx_lab_knowledge_chunks_embedding ON public.lab_knowledge_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_lab_knowledge_base_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_lab_knowledge_bases_updated_at ON public.lab_knowledge_bases;
CREATE TRIGGER update_lab_knowledge_bases_updated_at
    BEFORE UPDATE ON public.lab_knowledge_bases
    FOR EACH ROW
    EXECUTE FUNCTION update_lab_knowledge_base_updated_at();

DROP TRIGGER IF EXISTS update_lab_knowledge_documents_updated_at ON public.lab_knowledge_documents;
CREATE TRIGGER update_lab_knowledge_documents_updated_at
    BEFORE UPDATE ON public.lab_knowledge_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_lab_knowledge_base_updated_at();

-- Função para busca semântica (similarity search)
CREATE OR REPLACE FUNCTION search_knowledge_base(
    query_embedding vector(1536),
    knowledge_base_id UUID,
    similarity_threshold FLOAT DEFAULT 0.7,
    max_results INTEGER DEFAULT 5
)
RETURNS TABLE (
    chunk_id UUID,
    content TEXT,
    document_id UUID,
    document_filename TEXT,
    similarity FLOAT,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id AS chunk_id,
        c.content,
        c.document_id,
        d.filename AS document_filename,
        1 - (c.embedding <=> query_embedding) AS similarity, -- Cosine distance -> similarity
        c.metadata
    FROM public.lab_knowledge_chunks c
    INNER JOIN public.lab_knowledge_documents d ON c.document_id = d.id
    WHERE 
        c.knowledge_base_id = search_knowledge_base.knowledge_base_id
        AND c.embedding IS NOT NULL
        AND d.processing_status = 'completed'
        AND (1 - (c.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY c.embedding <=> query_embedding -- Ordenar por menor distância (maior similaridade)
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar contadores de knowledge base
CREATE OR REPLACE FUNCTION update_knowledge_base_counters()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Incrementar contadores quando novo documento/chunk é criado
        IF TG_TABLE_NAME = 'lab_knowledge_documents' THEN
            UPDATE public.lab_knowledge_bases
            SET total_documents = total_documents + 1
            WHERE id = NEW.knowledge_base_id;
        ELSIF TG_TABLE_NAME = 'lab_knowledge_chunks' THEN
            UPDATE public.lab_knowledge_bases
            SET total_chunks = total_chunks + 1
            WHERE id = NEW.knowledge_base_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrementar contadores quando documento/chunk é deletado
        IF TG_TABLE_NAME = 'lab_knowledge_documents' THEN
            UPDATE public.lab_knowledge_bases
            SET total_documents = GREATEST(0, total_documents - 1)
            WHERE id = OLD.knowledge_base_id;
        ELSIF TG_TABLE_NAME = 'lab_knowledge_chunks' THEN
            UPDATE public.lab_knowledge_bases
            SET total_chunks = GREATEST(0, total_chunks - 1)
            WHERE id = OLD.knowledge_base_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_kb_document_counters ON public.lab_knowledge_documents;
CREATE TRIGGER update_kb_document_counters
    AFTER INSERT OR DELETE ON public.lab_knowledge_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_base_counters();

DROP TRIGGER IF EXISTS update_kb_chunk_counters ON public.lab_knowledge_chunks;
CREATE TRIGGER update_kb_chunk_counters
    AFTER INSERT OR DELETE ON public.lab_knowledge_chunks
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_base_counters();

-- RLS Policies
ALTER TABLE public.lab_knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Políticas para lab_knowledge_bases
-- Usuários podem ver suas próprias knowledge bases
DROP POLICY IF EXISTS "Users can view their own knowledge bases" ON public.lab_knowledge_bases;
CREATE POLICY "Users can view their own knowledge bases"
    ON public.lab_knowledge_bases
    FOR SELECT
    USING (auth.uid() = user_id);

-- Admins podem ver todas as knowledge bases
DROP POLICY IF EXISTS "Admins can view all knowledge bases" ON public.lab_knowledge_bases;
CREATE POLICY "Admins can view all knowledge bases"
    ON public.lab_knowledge_bases
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'gestor_we', 'gestor')
        )
    );

-- Usuários podem criar suas próprias knowledge bases
DROP POLICY IF EXISTS "Users can create their own knowledge bases" ON public.lab_knowledge_bases;
CREATE POLICY "Users can create their own knowledge bases"
    ON public.lab_knowledge_bases
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar suas próprias knowledge bases
DROP POLICY IF EXISTS "Users can update their own knowledge bases" ON public.lab_knowledge_bases;
CREATE POLICY "Users can update their own knowledge bases"
    ON public.lab_knowledge_bases
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Usuários podem deletar suas próprias knowledge bases
DROP POLICY IF EXISTS "Users can delete their own knowledge bases" ON public.lab_knowledge_bases;
CREATE POLICY "Users can delete their own knowledge bases"
    ON public.lab_knowledge_bases
    FOR DELETE
    USING (auth.uid() = user_id);

-- Admins podem gerenciar todas as knowledge bases
DROP POLICY IF EXISTS "Admins can manage all knowledge bases" ON public.lab_knowledge_bases;
CREATE POLICY "Admins can manage all knowledge bases"
    ON public.lab_knowledge_bases
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'gestor_we', 'gestor')
        )
    );

-- Políticas para lab_knowledge_documents (herdam acesso da knowledge base)
DROP POLICY IF EXISTS "Users can manage documents in their knowledge bases" ON public.lab_knowledge_documents;
CREATE POLICY "Users can manage documents in their knowledge bases"
    ON public.lab_knowledge_documents
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.lab_knowledge_bases
            WHERE lab_knowledge_bases.id = lab_knowledge_documents.knowledge_base_id
            AND lab_knowledge_bases.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Admins can manage all documents" ON public.lab_knowledge_documents;
CREATE POLICY "Admins can manage all documents"
    ON public.lab_knowledge_documents
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'gestor_we', 'gestor')
        )
    );

-- Políticas para lab_knowledge_chunks (herdam acesso da knowledge base)
DROP POLICY IF EXISTS "Users can manage chunks in their knowledge bases" ON public.lab_knowledge_chunks;
CREATE POLICY "Users can manage chunks in their knowledge bases"
    ON public.lab_knowledge_chunks
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.lab_knowledge_bases
            WHERE lab_knowledge_bases.id = lab_knowledge_chunks.knowledge_base_id
            AND lab_knowledge_bases.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Admins can manage all chunks" ON public.lab_knowledge_chunks;
CREATE POLICY "Admins can manage all chunks"
    ON public.lab_knowledge_chunks
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'gestor_we', 'gestor')
        )
    );

-- Comentários nas tabelas
COMMENT ON TABLE public.lab_knowledge_bases IS 'Knowledge bases para armazenar conhecimento de agentes';
COMMENT ON TABLE public.lab_knowledge_documents IS 'Documentos carregados na knowledge base';
COMMENT ON TABLE public.lab_knowledge_chunks IS 'Chunks de documentos com embeddings para busca semântica';

COMMENT ON COLUMN public.lab_knowledge_bases.is_global IS 'true = knowledge base global (para todos os agentes), false = específica de um agente';
COMMENT ON COLUMN public.lab_knowledge_chunks.embedding IS 'Vector embedding de 1536 dimensões para busca semântica';
COMMENT ON FUNCTION search_knowledge_base IS 'Busca semântica na knowledge base usando cosine similarity';

