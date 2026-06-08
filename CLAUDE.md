# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project does

Pipeline that ingests AIO (Autorização de Início de Execução) emails from Gmail (GEPAC07 system) into PostgreSQL, then generates a **self-contained static HTML panel** (a 10-step tramitação timeline, Portaria Conjunta 32/2024) served on GitHub Pages. The emails are forwarded from the GEPAC07 system to a Gmail account (`cgpac.mcid@gmail.com`); the pipeline reads the forwarded body to extract structured fields.

> The project previously served a React/Vite dashboard; that was removed. The published artifact is now only the static timeline panel.

## Commands

### Python pipeline (activate venv first)
```bash
source .venv/bin/activate

# One-time setup
python3 setup_tabela.py          # create/upgrade DB table (requires schema se_cgpac to exist)
python3 migrar_colunas_etapas.py # add the 9 stage-date columns (dt_*) — idempotent
python3 gerar_token.py           # generate Gmail OAuth refresh token (interactive browser login)

# Daily use
python3 aio_pipeline.py --dias 30 --atualizar   # scan Gmail → PostgreSQL (upsert by email_id)
python3 aio_pipeline.py --dry-run               # inspect Gmail without writing to DB
python3 painel/gerar_painel.py --saida docs/index.html   # DB → panel HTML

# Full flow (Gmail → DB → panel)
./rodar_fluxo_completo.sh 30
```

### Publish to GitHub Pages
```bash
./publicar_painel_manual.sh
# Or: python3 painel/gerar_painel.py --saida docs/index.html
#     → git add docs/index.html → commit → push
```
GitHub Pages serves `docs/` from branch `main` natively (no GitHub Actions). A push is enough; the site updates in ~1–3 min (CDN TTL 600s).

## Architecture

### Data flow
```
Gmail (GEPAC07 emails) → aio_pipeline.py → PostgreSQL (se_cgpac.aio_solicitacoes)
                                          → painel/gerar_painel.py → docs/index.html
                                                                   → GitHub Pages (repo painelaio)
```
The panel **embeds its data** (read from the DB at generation time) — there is no CSV and no runtime fetch.

### Python backend (`/`)
- **`aio_pipeline.py`** — main pipeline: Gmail OAuth → message fetch → body parsing → DB insert. Uses `GEPAC07` detection and regex patterns (`_PATTERNS`) to extract fields like `instrumento`, `tc`, `municipio_beneficiado`, `programa`, etc. Deduplicates via `email_id` (Gmail message ID). `--atualizar` switches `ON CONFLICT DO NOTHING` to `DO UPDATE`. Exposes `get_db_connection()`, reused by the panel generator.
- **`setup_tabela.py`** — DDL for `aio_solicitacoes` table + indexes (includes the `dt_*` stage columns). Run once.
- **`migrar_colunas_etapas.py`** — idempotent migration that adds the 9 stage-date columns (etapas 2–10) to an existing table.
- **`gerar_token.py`** — interactive OAuth flow that writes `GMAIL_REFRESH_TOKEN` to `config.env`. If the browser does not open, the script prints the authorization URL to paste manually.
- **`config.env`** — secrets file (DB credentials + Gmail OAuth tokens). Never committed; see `config.env.example`.

### Panel (`painel/`)
- **`gerar_painel.py`** — reads `se_cgpac.aio_solicitacoes` via `get_db_connection()`, builds one object per AIO (`num`, `obj`, `programa`, `valor`, `datas`), and injects it into the template, producing a single self-contained HTML file (default `painel/painel_aio.html`; publish target `docs/index.html`).
- **`template_painel.html`** — the visual (gov.br style, inline CSS/JS, Google Fonts via CDN). Contains placeholders `/*__DADOS_AIO__*/[]` and `/*__GERADO_EM__*/`. All progress/dias-parado/"atrasado > 15 dias" math is done in the template's JS from the `datas` array (10 positions, `"AAAA-MM-DD"` or `null`).

### Deployment
- `docs/` — what GitHub Pages serves (`.nojekyll` + `index.html` + `favicon.png`). `docs/index.html` is the generated panel and **is committed/public**.
- Repo is **`painelaio`** (`github.com/brunothiago/painelaio`). Live URLs: `https://brunothiago.github.io/painelaio/` and the account custom domain `http://thiagobruno.com.br/painelaio/` (same Pages site).

## Key conventions

- **The 10 etapas are an ordered contract.** `COLUNAS_ETAPAS` in `gerar_painel.py` maps each stage to a DB date column, and its order must match the `ETAPAS` array in `template_painel.html` exactly. Etapa 1 = `data_aio_recebido`; etapas 2–10 = the `dt_*` columns. Only etapa 1 is filled by the pipeline; the `dt_*` dates are filled manually in the DB.
- **`email_id`** (Gmail message ID) is the unique key — used as `ON CONFLICT` target. Prevents duplicate inserts from re-running the pipeline, so a wide `--dias` window is safe.
- **GEPAC07 body parsing:** The pipeline reads forwarded emails where the original GEPAC07 metadata (From, Date, Subject) is embedded in the email body, not in the Gmail headers. `extract_gepac_metadata_from_body()` handles this; `extract_aio_fields()` uses `_PATTERNS` regexes to extract structured fields.
- **`programa` split:** The `programa` field from GEPAC07 is `"<codigo> - <descricao>"`. `_parse_programa()` splits into `programa_codigo` + `programa_descricao`. The panel displays `programa_descricao`.
- **Security:** `config.env`, `credentials.json`, `token.pickle` are gitignored. The generated panel (`docs/index.html`) embeds operational AIO data and **is** committed/public. Always run `git status` before pushing to confirm secrets are not staged.
- **Gmail test token:** the OAuth app is in "testing" mode, so the refresh token expires ~7 days after issue. Re-run `gerar_token.py` when a scan fails with `invalid_grant`.
- **VPN:** DB connection requires VPN if `DB_HOST` is on an internal network. Run the pipeline before disconnecting.
- **Logs:** Written to `~/logs/aio_pipeline.log`.
