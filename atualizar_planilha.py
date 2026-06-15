#!/usr/bin/env python3
"""
Orquestra a atualização da base a partir da planilha "Informações AIO":

  1. VERSIONA   — pega qualquer .xlsx novo largado em dados_planilha/ e o renomeia
                  para Informacoes_AIO_AAAA-MM-DD.xlsx (data = mtime do arquivo).
                  Os arquivos versionados formam o histórico (pasta gitignored).
  2. DATA QUALITY — compara a versão mais recente com a anterior e grava um
                  relatório em dados_planilha/relatorios/. NUNCA bloqueia.
  3. IMPORTA    — atualiza o banco a partir da versão mais recente (insere AIOs
                  ausentes + atualiza as datas de etapa). Reutiliza
                  importar_aios_planilha.importar e importar_datas_planilha.importar.

Onde colocar a planilha: pasta dados_planilha/ na raiz do projeto (nome livre).

Uso:
    python3 atualizar_planilha.py            # dry-run (versiona + DQ, não grava banco)
    python3 atualizar_planilha.py --commit   # grava no banco
"""

import argparse
import datetime
import hashlib
import logging
import pathlib
import re
import sys
from collections import Counter

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from aio_pipeline import get_db_connection  # noqa: E402
import importar_aios_planilha as iaios       # noqa: E402
import importar_datas_planilha as idatas     # noqa: E402

AQUI = pathlib.Path(__file__).resolve().parent
DADOS_DIR = AQUI / "dados_planilha"
RELATORIOS_DIR = DADOS_DIR / "relatorios"
ABA_PADRAO = "ListaAIO"

# nome de versão: Informacoes_AIO_AAAA-MM-DD.xlsx  (com sufixo opcional _2, _3…)
VERSAO_RE = re.compile(r"^Informacoes_AIO_(\d{4}-\d{2}-\d{2})(?:_(\d+))?\.xlsx$")

# colunas de data da planilha (na ordem cronológica do fluxo) + rótulo legível
ETAPAS_DATA = [
    ("dt_checklist_cgpac", "Chegada CGPAC (I)"),
    ("dt_gabse_oficio",    "Entrega SE (J)"),
    ("dt_assinatura_sex",  "Assinatura GM (K)"),
]
OUTLIER_VALOR = 1_000_000_000  # > R$ 1 bi → sinaliza possível erro de digitação

# ---------------------------------------------------------------- logging
LOG_DIR = pathlib.Path.home() / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.FileHandler(LOG_DIR / "aio_pipeline.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("atualizar_planilha")


# ============================================================ 1. VERSIONAMENTO
def _md5(caminho):
    h = hashlib.md5()
    with open(caminho, "rb") as f:
        for bloco in iter(lambda: f.read(65536), b""):
            h.update(bloco)
    return h.hexdigest()


def _versoes_existentes():
    """Lista (data, sufixo, Path) dos arquivos já versionados, ordenada."""
    out = []
    for p in DADOS_DIR.glob("Informacoes_AIO_*.xlsx"):
        m = VERSAO_RE.match(p.name)
        if m:
            out.append((m.group(1), int(m.group(2) or 1), p))
    return sorted(out)


def _proximo_nome(data_str):
    """Nome de versão livre para a data dada (resolve colisão com _2, _3…)."""
    alvo = DADOS_DIR / f"Informacoes_AIO_{data_str}.xlsx"
    if not alvo.exists():
        return alvo
    i = 2
    while (DADOS_DIR / f"Informacoes_AIO_{data_str}_{i}.xlsx").exists():
        i += 1
    return DADOS_DIR / f"Informacoes_AIO_{data_str}_{i}.xlsx"


def versionar_drops():
    """Renomeia .xlsx novos (nome fora do padrão) para o nome de versão.

    Arquivos idênticos (mesmo conteúdo) à última versão são descartados."""
    DADOS_DIR.mkdir(parents=True, exist_ok=True)
    RELATORIOS_DIR.mkdir(parents=True, exist_ok=True)

    novos = sorted(
        p for p in DADOS_DIR.glob("*.xlsx")
        if not VERSAO_RE.match(p.name) and not p.name.startswith("~$")
    )
    for p in novos:
        versoes = _versoes_existentes()
        hash_novo = _md5(p)
        if versoes and _md5(versoes[-1][2]) == hash_novo:
            log.info("Drop '%s' é idêntico à última versão — descartado.", p.name)
            p.unlink()
            continue
        data_str = datetime.date.fromtimestamp(p.stat().st_mtime).isoformat()
        destino = _proximo_nome(data_str)
        p.rename(destino)
        log.info("Versionado: %s → %s", p.name, destino.name)


# ============================================================ 2. DATA QUALITY
def _por_chave(linhas):
    """dict chave→linha (última ocorrência) ignorando linhas sem chave."""
    return {ln["chave"]: ln for ln in linhas if ln["chave"]}


def data_quality(versao_atual, versao_anterior, aba):
    """Gera relatório markdown comparando as duas versões. Retorna (texto, resumo)."""
    atual = iaios.ler_planilha(versao_atual, aba)
    idx_atual = _por_chave(atual)
    resumo = {}
    L = []
    L.append(f"# Data Quality — planilha AIO")
    L.append("")
    L.append(f"- Gerado em: {datetime.datetime.now():%Y-%m-%d %H:%M}")
    L.append(f"- Versão atual: `{versao_atual.name}` ({len(atual)} linhas)")

    if versao_anterior is None:
        L.append("- Versão anterior: _(nenhuma — primeira versão, sem comparação)_")
        L.append("")
    else:
        anterior = iaios.ler_planilha(versao_anterior, aba)
        idx_ant = _por_chave(anterior)
        L.append(f"- Versão anterior: `{versao_anterior.name}` ({len(anterior)} linhas)")
        L.append("")

        add = sorted(set(idx_atual) - set(idx_ant))
        rem = sorted(set(idx_ant) - set(idx_atual))
        resumo["adicionados"] = len(add)
        resumo["removidos"] = len(rem)

        L.append("## Comparação entre versões")
        L.append(f"- Linhas: {len(anterior)} → {len(atual)} "
                 f"(saldo {len(atual) - len(anterior):+d})")
        L.append(f"- AIOs adicionados: **{len(add)}** | removidos: **{len(rem)}**")
        L.append("")
        if add:
            L.append("### AIOs adicionados")
            for k in add:
                ln = idx_atual[k]
                L.append(f"- `{ln['instr_raw']}` — {ln['municipio']}/{ln['uf'] or '?'}")
            L.append("")
        if rem:
            L.append("### AIOs removidos (atenção — possível perda de dados)")
            for k in rem:
                ln = idx_ant[k]
                L.append(f"- `{ln['instr_raw']}` — {ln['municipio']}/{ln['uf'] or '?'}")
            L.append("")

        # mudanças de data por etapa
        alteradas, regressoes = [], []
        for k in sorted(set(idx_atual) & set(idx_ant)):
            a, b = idx_ant[k], idx_atual[k]
            for col, rotulo in ETAPAS_DATA:
                va, vb = a["datas"].get(col), b["datas"].get(col)
                if va == vb:
                    continue
                linha = f"`{b['instr_raw']}` · {rotulo}: {va or '—'} → {vb or '—'}"
                alteradas.append(linha)
                if va is not None and (vb is None or vb < va):
                    regressoes.append(linha)
        resumo["datas_alteradas"] = len(alteradas)
        resumo["regressoes"] = len(regressoes)
        L.append(f"### Datas alteradas: {len(alteradas)} "
                 f"(regressões: **{len(regressoes)}**)")
        if regressoes:
            L.append("")
            L.append("**Regressões (data recuou ou ficou vazia):**")
            for x in regressoes:
                L.append(f"- ⚠️ {x}")
        if alteradas:
            L.append("")
            L.append("<details><summary>Todas as alterações de data</summary>")
            L.append("")
            for x in alteradas:
                L.append(f"- {x}")
            L.append("")
            L.append("</details>")
        L.append("")

    # ----- checks intra-versão (sempre) -----
    L.append("## Integridade da versão atual")
    contagem = Counter(ln["chave"] for ln in atual if ln["chave"])
    duplicatas = {k: n for k, n in contagem.items() if n > 1}
    sem_uf = [ln for ln in atual if not ln["uf"]]
    sem_valor = [ln for ln in atual if ln["valor"] in (None, 0)]
    outliers = [ln for ln in atual if ln["valor"] and ln["valor"] > OUTLIER_VALOR]
    sem_chave = [ln for ln in atual if not ln["chave"]]
    fora_ordem = []
    for ln in atual:
        ds = [ln["datas"].get(c) for c, _ in ETAPAS_DATA]
        seq = [d for d in ds if d is not None]
        if seq != sorted(seq):
            fora_ordem.append(ln)

    resumo.update({
        "duplicatas": len(duplicatas), "sem_uf": len(sem_uf),
        "sem_valor": len(sem_valor), "outliers_valor": len(outliers),
        "datas_fora_de_ordem": len(fora_ordem), "instr_nao_numerico": len(sem_chave),
    })

    def _bloco(titulo, itens, fmt):
        L.append(f"### {titulo}: {len(itens)}")
        for it in itens:
            L.append(f"- {fmt(it)}")
        L.append("")

    if duplicatas:
        L.append(f"### Instrumentos duplicados na planilha: {len(duplicatas)}")
        for k, n in duplicatas.items():
            L.append(f"- `{k}` aparece {n}×")
        L.append("")
    _bloco("Sem UF identificada", sem_uf, lambda l: f"`{l['instr_raw']}` — {l['municipio']}")
    _bloco("Sem valor / valor zero", sem_valor, lambda l: f"`{l['instr_raw']}` — {l['municipio']}/{l['uf'] or '?'}")
    _bloco("Valores suspeitos (> R$ 1 bi)", outliers,
           lambda l: f"`{l['instr_raw']}` — {l['municipio']} — R$ {l['valor']:,.2f}")
    _bloco("Datas fora de ordem (chegada ≤ entrega ≤ assinatura)", fora_ordem,
           lambda l: f"`{l['instr_raw']}` — " +
                     ", ".join(f"{r}={l['datas'].get(c) or '—'}" for c, r in ETAPAS_DATA))
    _bloco("Instrumento não numérico (não casa convênio)", sem_chave,
           lambda l: f"`{l['instr_raw']}` — {l['municipio']}")

    return "\n".join(L), resumo


# ============================================================ MAIN
def main():
    ap = argparse.ArgumentParser(description="Versiona, faz data quality e importa a planilha AIO.")
    ap.add_argument("--commit", action="store_true",
                    help="Grava no banco. Sem a flag, roda em dry-run (versiona + DQ apenas).")
    ap.add_argument("--aba", default=ABA_PADRAO)
    args = ap.parse_args()

    versionar_drops()
    versoes = _versoes_existentes()
    if not versoes:
        log.error("Nenhuma planilha em %s. Copie o .xlsx para lá e rode de novo.", DADOS_DIR)
        sys.exit(1)

    atual = versoes[-1][2]
    anterior = versoes[-2][2] if len(versoes) > 1 else None
    log.info("Versão atual: %s | anterior: %s",
             atual.name, anterior.name if anterior else "(nenhuma)")

    texto, resumo = data_quality(atual, anterior, args.aba)
    ts = datetime.datetime.now().strftime("%Y-%m-%d_%H%M")
    rel = RELATORIOS_DIR / f"dq_{ts}.md"
    rel.write_text(texto, encoding="utf-8")
    log.info("Relatório de data quality: %s", rel)
    log.info("Resumo DQ: %s", ", ".join(f"{k}={v}" for k, v in resumo.items()))

    conn = get_db_connection()
    try:
        print("\n========== IMPORTAR AIOs AUSENTES ==========")
        st_aios = iaios.importar(atual, conn, commit=args.commit, aba=args.aba)
        print("\n========== ATUALIZAR DATAS DE ETAPA ==========")
        st_datas = idatas.importar(atual, conn, commit=args.commit, aba=args.aba)
    finally:
        conn.close()

    log.info("Import AIOs: %s | Import datas: %s", st_aios, st_datas)
    if not args.commit:
        print("\n[DRY-RUN] Banco não alterado. Rode com --commit para gravar.")


if __name__ == "__main__":
    main()
