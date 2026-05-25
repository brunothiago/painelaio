# Painel AIO (site publicável)

Dashboard React para GitHub Pages. Lê `public/aio_solicitacoes.csv` gerado pelo Python.

**Privacidade:** o CSV versionado e publicado no Pages fica **acessível na internet**
(municípios, valores, assuntos de email AIO). Não inclua senhas, tokens ou dados
pessoais no CSV. Credenciais ficam só em `config.env` na máquina local.

## Fluxo

```
aio_pipeline.py  →  PostgreSQL  →  exportar_csv.py  →  public/aio_solicitacoes.csv  →  este site
```

## Desenvolvimento local

```bash
cd dashboard
npm install
npm run dev
```

Antes, gere o CSV na pasta pai:

```bash
cd ..
source .venv/bin/activate
python3 exportar_csv.py
```

## Publicar no GitHub Pages

1. Repositório no GitHub chamado **painel_aio** (ou ajuste `base` em `vite.config.js`).
2. Rode na raiz do repositório:

```bash
python3 exportar_csv.py
cd dashboard && npm install && npm run build
```

3. Settings → Pages → Source: **GitHub Actions** (workflow incluído) ou pasta `docs` com conteúdo de `dist`.

URL esperada: `https://SEU_USUARIO.github.io/painel_aio/`

## Arquivos

| Arquivo | Função |
|---------|--------|
| `src/DashboardAIO.jsx` | Visual do painel |
| `src/mapeador.js` | Converte CSV → formato do gráfico |
| `src/App.jsx` | Carrega o CSV |
| `public/aio_solicitacoes.csv` | Dados (atualizar via pipeline) |
| `src/ExportarExcel.jsx` | Exportação .xlsx com seleção de colunas do banco |
