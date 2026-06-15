#!/bin/bash
# Fluxo completo: Gmail → PostgreSQL → painel HTML → publica no GitHub Pages.
set -e
cd "$(dirname "$0")"
source .venv/bin/activate

DIAS="${1:-7}"
echo "=== 1/4 Varredura Gmail → PostgreSQL ==="
python3 aio_pipeline.py --dias "$DIAS" --atualizar

echo ""
echo "=== 2/4 Planilha AIO: versionar + data quality + importar ==="
python3 atualizar_planilha.py --commit

echo ""
echo "=== 3/4 Emissão do AIO (TransfereGov) → etapa 11 ==="
python3 importar_emissao_transferegov.py --commit

echo ""
echo "=== 4/4 Gerar painel a partir do banco ==="
python3 painel/gerar_painel.py --saida docs/index.html

echo ""
echo "Pronto."
echo "  Pré-visualizar: open docs/index.html"
echo "  Publicar:       ./publicar_painel_manual.sh   (ou: git add docs/index.html && git commit && git push)"
