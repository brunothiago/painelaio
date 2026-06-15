#!/bin/bash
# Fluxo completo: Gmail → PostgreSQL → painel HTML → publica no GitHub Pages.
set -e
cd "$(dirname "$0")"

# Usa o Python do venv diretamente (à prova de 'source activate' que não pega
# em shells não-interativos/cron). Cai para python3 do sistema se não houver venv.
if [ -x .venv/bin/python3 ]; then
  PY=.venv/bin/python3
else
  source .venv/bin/activate 2>/dev/null || true
  PY=python3
fi

DIAS="${1:-7}"
echo "=== 1/4 Varredura Gmail → PostgreSQL ==="
"$PY" aio_pipeline.py --dias "$DIAS" --atualizar

echo ""
echo "=== 2/4 Planilha AIO: versionar + data quality + importar ==="
"$PY" atualizar_planilha.py --commit

echo ""
echo "=== 3/4 Emissão do AIO (TransfereGov) → etapa 11 ==="
"$PY" importar_emissao_transferegov.py --commit

echo ""
echo "=== 4/4 Gerar painel a partir do banco ==="
"$PY" painel/gerar_painel.py --saida docs/index.html

echo ""
echo "Pronto."
echo "  Pré-visualizar: open docs/index.html"
echo "  Publicar:       ./publicar_painel_manual.sh   (ou: git add docs/index.html && git commit && git push)"
