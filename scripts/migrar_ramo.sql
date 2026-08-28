-- Migração: ramo de atuação por empresa (Fase 1)
-- Rode este script uma vez no SQL Editor do Supabase (Postgres).
-- É idempotente: pode rodar de novo sem quebrar nada.

-- 1. Ramo da empresa (imobiliaria | engenharia). Padrão mantém o comportamento atual.
ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS ramo TEXT NOT NULL DEFAULT 'imobiliaria';

-- 2. Campos do cliente específicos do ramo (endereço, contrato, ...),
--    guardados como JSON para não exigir uma coluna nova por ramo.
ALTER TABLE clientes
    ADD COLUMN IF NOT EXISTS dados_json TEXT;

-- 3. Garante que todo registro antigo fique explicitamente como imobiliária.
UPDATE empresas
    SET ramo = 'imobiliaria'
    WHERE ramo IS NULL OR ramo = '';

-- 4. Módulos do ramo engenharia (obras, equipamentos, materiais, medições, monitoramento).
--    Uma tabela só; o que é específico de cada tipo fica em dados_json.
CREATE TABLE IF NOT EXISTS recursos_eng (
    id TEXT PRIMARY KEY,
    criado_em TEXT NOT NULL,
    empresa_id TEXT,
    tipo TEXT NOT NULL,
    nome TEXT NOT NULL,
    dados_json TEXT,
    foto_nome TEXT,
    foto_mime TEXT
);

-- Se você já rodou uma versão anterior deste script, a tabela "materiais"
-- ficou órfã e pode ser removida com segurança:
-- DROP TABLE IF EXISTS materiais;
