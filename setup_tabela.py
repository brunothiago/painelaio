#!/usr/bin/env python3
"""
=============================================================================
CRIAR TABELA NO BANCO — rodar UMA vez na instalação
=============================================================================

Cria a tabela se_cgpac.aio_solicitacoes (ou DB_SCHEMA do config.env).
O schema (se_cgpac) já deve existir no PostgreSQL.

Uso:
  python3 setup_tabela.py
=============================================================================
"""

import os
import re
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / "config.env")

SCHEMA = os.getenv("DB_SCHEMA", "se_cgpac")
if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*$", SCHEMA):
    print(f"[ERRO] DB_SCHEMA inválido: {SCHEMA!r}")
    sys.exit(1)

# Estrutura da tabela — cada coluna corresponde a um campo do email GEPAC07
TABLE_DDL = f"""
CREATE TABLE IF NOT EXISTS {SCHEMA}.aio_solicitacoes (
    id                        SERIAL PRIMARY KEY,
    instrumento               VARCHAR(20),
    tc                        VARCHAR(20),
    recebedor                 TEXT,
    municipio_beneficiado     VARCHAR(200),
    municipio                 VARCHAR(150),
    uf                        CHAR(2),
    data_assinatura           DATE,
    data_retirada_suspensiva  DATE,
    data_vigencia             DATE,
    valor_investimento        NUMERIC(18,2),
    valor_repasse             NUMERIC(18,2),
    objeto                    TEXT,
    programa_codigo           VARCHAR(30),
    programa_descricao        TEXT,
    programa                  TEXT,
    acao_orcamentaria         VARCHAR(50),
    email_remetente           VARCHAR(300),
    email_assunto             VARCHAR(500),
    data_aio_recebido         TIMESTAMP WITH TIME ZONE,
    email_id                  VARCHAR(200) UNIQUE,
    criado_em                 TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Etapas de tramitação do fluxo AIO (datas preenchidas manualmente)
    dt_processo_sns           DATE,
    dt_elaboracao_nt          DATE,
    dt_envio_gabse            DATE,
    dt_envio_dmpse            DATE,
    dt_checklist_cgpac        DATE,
    dt_gabse_oficio           DATE,
    dt_assinatura_sex         DATE,
    dt_envio_sns              DATE,
    dt_aviso_sns_caixa        DATE
);

CREATE INDEX IF NOT EXISTS idx_aio_instrumento ON {SCHEMA}.aio_solicitacoes (instrumento);
CREATE INDEX IF NOT EXISTS idx_aio_tc ON {SCHEMA}.aio_solicitacoes (tc);
CREATE INDEX IF NOT EXISTS idx_aio_uf ON {SCHEMA}.aio_solicitacoes (uf);
CREATE INDEX IF NOT EXISTS idx_aio_data_recebido ON {SCHEMA}.aio_solicitacoes (data_aio_recebido);
"""


def main():
    for var in ("DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"):
        if not os.getenv(var):
            print(f"[ERRO] Preencha {var} no config.env")
            sys.exit(1)

    conn = psycopg2.connect(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", 5432)),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        connect_timeout=10,
    )
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM information_schema.schemata WHERE schema_name = %s",
                (SCHEMA,),
            )
            if not cur.fetchone():
                print(f"[ERRO] Schema '{SCHEMA}' não existe no banco.")
                sys.exit(1)
            cur.execute(TABLE_DDL)
        conn.commit()
        print(f"[OK] Tabela {SCHEMA}.aio_solicitacoes pronta.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
