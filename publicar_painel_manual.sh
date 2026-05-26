#!/bin/bash
# Publica o dashboard no GitHub Pages quando o Actions não rodar.
# Uso: ./publicar_painel_manual.sh
set -e
cd "$(dirname "$0")"

echo "=== Build do dashboard ==="
cd dashboard
npm install
npm run build

echo ""
echo "=== Publica branch gh-pages (site + CSV) ==="
npx --yes gh-pages@6 -d dist -m "Deploy manual painel AIO $(date +%Y-%m-%d)"

echo ""
echo "=== Solicita rebuild do GitHub Pages ==="
gh api -X POST repos/brunothiago/painel_aio/pages/builds 2>/dev/null || true

echo ""
echo "Pronto. Aguarde 2–5 min e abra:"
echo "  https://brunothiago.github.io/painel_aio/"
echo "Confira o CSV: deve ter 27+ linhas de dados (faixa verde no painel)."
