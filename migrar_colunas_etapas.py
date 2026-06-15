#!/usr/bin/env python3
"""
Adiciona as 9 colunas de data das etapas 2-10 do fluxo AIO à tabela existente.

A etapa 1 (data_aio_recebido) já existe. Este script é idempotente:
colunas já presentes são ignoradas com segurança.

Uso:
    python3 migrar_colunas_etapas.py
"""

import os
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / "config.env")

SCHEMA = os.getenv("DB_SCHEMA", "se_cgpac")

NOVAS_COLUNAS = [
    ("dt_processo_sns",    "Processo na SNs"),
    ("dt_elaboracao_nt",   "Elaboração da NT"),
    ("dt_envio_gabse",     "Envio para GAB-SE"),
    ("dt_envio_dmpse",     "Envio para DMP-SE"),
    ("dt_checklist_cgpac", "Check-list CGPAC"),
    ("dt_gabse_oficio",    "GAB-SE → Ofício"),
    ("dt_assinatura_sex",  "Assinatura SEx"),
    ("dt_envio_sns",       "Envio SNs"),
    ("dt_aviso_sns_caixa", "Aviso SNs → Caixa"),
    ("dt_emissao_aio",     "Emissão do AIO"),  # etapa 11 — vem do TransfereGov
]


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
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = %s AND table_name = 'aio_solicitacoes'
                """,
                (SCHEMA,),
            )
            existentes = {row[0] for row in cur.fetchall()}

            adicionadas = []
            for col, rotulo in NOVAS_COLUNAS:
                if col in existentes:
                    print(f"  [ok]   {col} já existe ({rotulo})")
                    continue
                cur.execute(
                    f"ALTER TABLE {SCHEMA}.aio_solicitacoes ADD COLUMN {col} DATE"
                )
                adicionadas.append(col)
                print(f"  [add]  {col} adicionada ({rotulo})")

        conn.commit()
        if adicionadas:
            print(f"\n[OK] {len(adicionadas)} coluna(s) adicionada(s).")
        else:
            print("\n[OK] Nenhuma alteração necessária.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
