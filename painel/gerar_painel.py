#!/usr/bin/env python3
"""
Gera painel_aio.html (autossuficiente) a partir da tabela se_cgpac.aio_solicitacoes.

Usa a mesma conexão e config do pipeline principal (aio_pipeline.py).

Uso:
    python painel/gerar_painel.py
    python painel/gerar_painel.py --saida docs/painel_aio.html
"""

import argparse
import datetime
import json
import pathlib
import sys

# Reutiliza config e conexão do pipeline principal
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from aio_pipeline import get_db_connection  # noqa: E402  (after sys.path manipulation)

AQUI = pathlib.Path(__file__).resolve().parent
TEMPLATE = AQUI / "template_painel.html"
SAIDA_PADRAO = AQUI / "painel_aio.html"

PH_DADOS  = "/*__DADOS_AIO__*/[]"
PH_GERADO = "/*__GERADO_EM__*/"

# Mapeamento das 10 etapas → colunas de data (ordem exata igual ao template)
# Etapa 1 já existia na tabela; as outras foram adicionadas por migrar_colunas_etapas.py
COLUNAS_ETAPAS = [
    "data_aio_recebido",   # 1  Chegada e-mail Caixa
    "dt_processo_sns",     # 2  Processo na SNs
    "dt_elaboracao_nt",    # 3  Elaboração da NT
    "dt_envio_gabse",      # 4  Envio para GAB-SE
    "dt_envio_dmpse",      # 5  Envio para DMP-SE
    "dt_checklist_cgpac",  # 6  Check-list CGPAC
    "dt_gabse_oficio",     # 7  GAB-SE → Ofício
    "dt_assinatura_sex",   # 8  Assinatura SEx
    "dt_envio_sns",        # 9  Envio SNs
    "dt_aviso_sns_caixa",  # 10 Aviso SNs → Caixa
]


def _iso(v):
    """Converte date/datetime para string 'AAAA-MM-DD', ou None."""
    if v is None:
        return None
    if isinstance(v, (datetime.date, datetime.datetime)):
        return v.strftime("%Y-%m-%d")
    return str(v)[:10]


def buscar_aios(conn):
    extras = ["instrumento", "tc", "objeto", "municipio", "uf",
              "valor_investimento", "programa_descricao"]
    cols = ", ".join(extras + COLUNAS_ETAPAS)
    sql = (
        "SELECT " + cols +
        " FROM se_cgpac.aio_solicitacoes"
        " ORDER BY data_aio_recebido DESC NULLS LAST"
    )
    with conn.cursor() as cur:
        cur.execute(sql)
        nomes = [c[0] for c in cur.description]
        for row in cur.fetchall():
            r = dict(zip(nomes, row))
            instrumento = r.get("instrumento") or ""
            tc = r.get("tc") or ""
            if instrumento and tc:
                num = f"Instrumento {instrumento} / TC {tc}"
            else:
                num = instrumento or tc or "AIO —"

            loc_parts = [p for p in [r.get("municipio"), r.get("uf")] if p]
            loc = f" ({'/'.join(loc_parts)})" if loc_parts else ""
            obj_raw = (r.get("objeto") or "")[:120]
            obj = obj_raw + loc

            valor = r.get("valor_investimento")

            yield {
                "num": num,
                "obj": obj,
                "programa": r.get("programa_descricao") or "",
                "valor": float(valor) if valor is not None else None,
                "datas": [_iso(r.get(c)) for c in COLUNAS_ETAPAS],
            }


def main():
    ap = argparse.ArgumentParser(description="Gera painel HTML de acompanhamento de AIOs.")
    ap.add_argument("--saida", default=str(SAIDA_PADRAO), help="Caminho do HTML de saída.")
    args = ap.parse_args()

    conn = get_db_connection()
    try:
        dados = list(buscar_aios(conn))
    finally:
        conn.close()

    html = TEMPLATE.read_text(encoding="utf-8")
    html = html.replace(PH_DADOS, json.dumps(dados, ensure_ascii=False))
    html = html.replace(PH_GERADO, datetime.datetime.now().strftime("%d/%m/%Y %H:%M"))

    saida = pathlib.Path(args.saida)
    saida.parent.mkdir(parents=True, exist_ok=True)
    saida.write_text(html, encoding="utf-8")
    print(f"OK: {len(dados)} AIO(s) → {saida}")


if __name__ == "__main__":
    main()
