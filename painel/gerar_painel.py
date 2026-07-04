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
import decimal
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
PH_BANCO_COLS = "/*__BANCO_COLS__*/[]"
PH_BANCO_ROWS = "/*__BANCO_ROWS__*/[]"

# Link do SACI por instrumento: cod_tci vem de se_saci.view_mat_carteira_investimento
# (num_convenio == instrumento). A URL final é SACI_BASE + cod_tci.
SACI_BASE = "https://saci.cidades.gov.br/contratos/"

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
    "dt_emissao_aio",      # 11 Emissão do AIO (TransfereGov)
]


def _iso(v):
    """Converte date/datetime para string 'AAAA-MM-DD', ou None."""
    if v is None:
        return None
    if isinstance(v, (datetime.date, datetime.datetime)):
        return v.strftime("%Y-%m-%d")
    return str(v)[:10]


def _banco_safe(v):
    """Converte valores do banco para tipos serializáveis em JSON (export completo)."""
    if v is None:
        return None
    if isinstance(v, datetime.datetime):
        return v.strftime("%Y-%m-%d %H:%M")
    if isinstance(v, datetime.date):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, decimal.Decimal):
        return float(v)
    return v


def buscar_cod_tci(conn):
    """Retorna {instrumento(texto): cod_tci} a partir da view do SACI.

    Casa instrumento == num_convenio (ambos comparados como texto). Cada
    instrumento mapeia para um único cod_tci na carteira de investimento.
    """
    sql = """
        SELECT DISTINCT v.num_convenio::text AS instrumento, v.cod_tci
        FROM se_saci.view_mat_carteira_investimento v
        WHERE v.cod_tci IS NOT NULL AND v.num_convenio IS NOT NULL
    """
    with conn.cursor() as cur:
        cur.execute(sql)
        return {instr: cod for instr, cod in cur.fetchall()}


def _link_saci(cod_tci):
    """Monta a URL do contrato no SACI, ou None se não houver cod_tci."""
    return f"{SACI_BASE}{cod_tci}" if cod_tci else None


def buscar_banco(conn, cod_tci_por_instr):
    """Lê a tabela inteira (todas as colunas) + coluna link_saci para exportação."""
    sql = (
        "SELECT * FROM se_cgpac.aio_solicitacoes"
        " ORDER BY data_aio_recebido DESC NULLS LAST, id DESC"
    )
    with conn.cursor() as cur:
        cur.execute(sql)
        cols = [c[0] for c in cur.description]
        idx_instr = cols.index("instrumento") if "instrumento" in cols else None
        rows = []
        for row in cur.fetchall():
            valores = [_banco_safe(v) for v in row]
            instr = str(row[idx_instr]) if idx_instr is not None and row[idx_instr] is not None else None
            link = _link_saci(cod_tci_por_instr.get(instr))
            # SACI vira a 3ª coluna da planilha (logo após id/instrumento).
            valores.insert(2, link)
            rows.append(valores)
    cols_out = cols[:2] + ["link_saci"] + cols[2:]
    return cols_out, rows


def buscar_aios(conn, cod_tci_por_instr):
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
                "saci": _link_saci(cod_tci_por_instr.get(str(instrumento) if instrumento else None)),
            }


def main():
    ap = argparse.ArgumentParser(description="Gera painel HTML de acompanhamento de AIOs.")
    ap.add_argument("--saida", default=str(SAIDA_PADRAO), help="Caminho do HTML de saída.")
    args = ap.parse_args()

    conn = get_db_connection()
    try:
        cod_tci_por_instr = buscar_cod_tci(conn)
        dados = list(buscar_aios(conn, cod_tci_por_instr))
        banco_cols, banco_rows = buscar_banco(conn, cod_tci_por_instr)
    finally:
        conn.close()

    html = TEMPLATE.read_text(encoding="utf-8")
    html = html.replace(PH_DADOS, json.dumps(dados, ensure_ascii=False))
    html = html.replace(PH_BANCO_COLS, json.dumps(banco_cols, ensure_ascii=False))
    html = html.replace(PH_BANCO_ROWS, json.dumps(banco_rows, ensure_ascii=False))
    html = html.replace(PH_GERADO, datetime.datetime.now().strftime("%d/%m/%Y %H:%M"))

    saida = pathlib.Path(args.saida)
    saida.parent.mkdir(parents=True, exist_ok=True)
    saida.write_text(html, encoding="utf-8")
    print(f"OK: {len(dados)} AIO(s) | banco completo: {len(banco_rows)} linha(s) × "
          f"{len(banco_cols)} coluna(s) → {saida}")


if __name__ == "__main__":
    main()
