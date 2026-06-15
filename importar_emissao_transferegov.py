#!/usr/bin/env python3
"""
Preenche a etapa 11 (dt_emissao_aio) em se_cgpac.aio_solicitacoes com a data de
emissão do AIO consultada no módulo TransfereGov.

Casamento: num_convenio (mcid_transferegov.tab_convenios) == instrumento (nosso).
Para cada AIO pega a emissão mais recente entre os instrumentos contratuais do
convênio (MAX da dte_emissao_aio_instrumento_contratual; NULL = "Não Emitida").

Uso:
    python3 importar_emissao_transferegov.py            # dry-run (não grava)
    python3 importar_emissao_transferegov.py --commit   # grava
"""

import argparse
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from aio_pipeline import get_db_connection  # noqa: E402

# Emissão mais recente por convênio, casando convênio == nosso instrumento.
SQL_EMISSOES = """
    SELECT s.id, s.instrumento, s.municipio,
           MAX(a.dte_emissao_aio_instrumento_contratual) AS dt_emissao
    FROM se_cgpac.aio_solicitacoes s
    JOIN mcid_transferegov.tab_convenios c
      ON c.num_convenio = s.instrumento::numeric
    JOIN mcid_transferegov.tab_inst_cont_proposta_aio_modulo_empresas a
      ON a.cod_proposta = c.cod_proposta
    WHERE s.instrumento ~ '^[0-9]+$'
    GROUP BY s.id, s.instrumento, s.municipio
    HAVING MAX(a.dte_emissao_aio_instrumento_contratual) IS NOT NULL
"""


def main():
    ap = argparse.ArgumentParser(description="Importa data de emissão do AIO (TransfereGov).")
    ap.add_argument("--commit", action="store_true",
                    help="Grava no banco. Sem a flag, roda em dry-run.")
    args = ap.parse_args()

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(SQL_EMISSOES)
            linhas = cur.fetchall()

        print(f"AIOs com emissão no TransfereGov: {len(linhas)}\n")
        for _id, instr, municipio, dt in linhas:
            print(f"  id {_id:>4} | instr {instr:<10} | {str(municipio or ''):24.24s} | {dt.isoformat()}")

        if not args.commit:
            print(f"\n[DRY-RUN] Nada gravado. Rode com --commit para aplicar {len(linhas)} update(s).")
            return

        n = 0
        with conn.cursor() as cur:
            for _id, _instr, _m, dt in linhas:
                cur.execute(
                    "UPDATE se_cgpac.aio_solicitacoes SET dt_emissao_aio = %s WHERE id = %s",
                    (dt, _id),
                )
                n += cur.rowcount
        conn.commit()
        print(f"\n[OK] {n} linha(s) atualizada(s) com a data de emissão do AIO.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
