# Pipeline AIO + Painel web

Fluxo integrado: **Gmail (GEPAC07)** → **PostgreSQL** → **CSV** → **dashboard** (GitHub Pages).

| Etapa | Ferramenta |
|-------|------------|
| 1. Ler emails | `aio_pipeline.py` |
| 2. Banco | `se_cgpac.aio_solicitacoes` |
| 3. CSV | `exportar_csv.py` ou `--export-csv` |
| 4. Site | pasta `dashboard/` → GitHub Pages |

**Manual para usuários:** [MANUAL.md](MANUAL.md)  
**Manual do dashboard:** [dashboard/README.md](dashboard/README.md)

## Segurança e o que fica público

| Onde | O que expõe |
|------|-------------|
| **Sua máquina** | `config.env` (senha DB, tokens Gmail), `credentials.json` — **nunca** no Git |
| **Repositório GitHub** | Código Python, dashboard, `aio_solicitacoes.csv` (sem credenciais) |
| **GitHub Pages** | Só o build do `dashboard/` + CSV baixável por qualquer visitante |

Arquivos ignorados pelo Git (ver `.gitignore`): `config.env`, `credentials.json`,
`client_secret*.json`, `token.pickle`, `.venv/`.

Antes de cada push:

```bash
git status   # não deve listar config.env
```

O CSV em `dashboard/public/aio_solicitacoes.csv` contém **dados operacionais de
AIO** (município, TC, valores, assunto do email, etc.). Só faça commit/push se
aceitar que isso fique **público** em `https://SEU_USUARIO.github.io/painel_aio/`.

Se `config.env` ou tokens forem commitados por engano: remova do Git, **rotacione**
senha do banco e gere novo token Gmail (`gerar_token.py`).

## Estrutura

```
painel_aio/
├── aio_pipeline.py          # programa principal
├── exportar_csv.py          # banco → CSV
├── gerar_token.py           # setup Gmail (1x)
├── setup_tabela.py          # setup banco (1x)
├── rodar_fluxo_completo.sh  # executa tudo de uma vez
├── config.env
├── dashboard/               # site React (painel_aio no GitHub)
│   ├── public/aio_solicitacoes.csv
│   └── src/
└── .github/workflows/       # deploy GitHub Pages
```

## Comandos rápidos

```bash
source .venv/bin/activate

# Fluxo completo (7 dias + CSV + build)
./rodar_fluxo_completo.sh 7

# Ou passo a passo:
python3 aio_pipeline.py --dias 7 --atualizar --export-csv
python3 exportar_csv.py
cd dashboard && npm install && npm run dev
```

## Publicar no GitHub

1. Repositório **painel_aio** no GitHub.
2. Rode localmente: `./rodar_fluxo_completo.sh 7` (VPN se necessário para o banco).
3. `git status` — confirme que `config.env` **não** está na lista.
4. Commit incluindo `dashboard/public/aio_solicitacoes.csv` (dados **públicos** no Pages).
5. Push → GitHub Actions publica em `https://SEU_USUARIO.github.io/painel_aio/`

Site publicado (exemplo): https://brunothiago.github.io/painel_aio/
