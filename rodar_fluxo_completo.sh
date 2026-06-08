#!/bin/bash
# Fluxo completo: Gmail → PostgreSQL → painel HTML → publica no GitHub Pages.
set -e
cd "$(dirname "$0")"
source .venv/bin/activate

DIAS="${1:-7}"
echo "=== 1/2 Varredura Gmail → PostgreSQL ==="
python3 aio_pipeline.py --dias "$DIAS" --atualizar

echo ""
echo "=== 2/2 Gerar painel a partir do banco ==="
python3 painel/gerar_painel.py --saida docs/index.html

echo ""
echo "Pronto."
echo "  Pré-visualizar: open docs/index.html"
echo "  Publicar:       ./publicar_painel_manual.sh   (ou: git add docs/index.html && git commit && git push)"
