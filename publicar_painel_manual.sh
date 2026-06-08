#!/bin/bash
# Publica o Painel AIO (linha do tempo, PC 32/2024) no GitHub Pages.
# O painel é um HTML estático autossuficiente gerado a partir do banco.
# GitHub Pages serve docs/ na branch main (sem GitHub Actions).
set -e
cd "$(dirname "$0")"

echo "=== 1/3 Gerar painel a partir do banco ==="
if [ -f config.env ]; then
  source .venv/bin/activate 2>/dev/null || true
  python3 painel/gerar_painel.py --saida docs/index.html
else
  echo "(sem config.env — copiando painel já gerado)"
  cp painel/painel_aio.html docs/index.html
fi
touch docs/.nojekyll

echo ""
echo "=== 2/3 Commit ==="
git add docs/index.html docs/.nojekyll
git status -sb docs/

if git diff --cached --quiet; then
  echo "Nada novo em docs/ para commitar."
else
  git commit -m "Publica Painel AIO (linha do tempo) em docs/"
fi

echo ""
echo "=== 3/3 Push ==="
git push origin main
gh api -X POST repos/brunothiago/painel_aio/pages/builds 2>/dev/null || true

echo ""
echo "Pronto. Em 2-5 min: https://brunothiago.github.io/painel_aio/"
