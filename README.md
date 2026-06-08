# Pipeline AIO + Painel web

Fluxo integrado: **Gmail (GEPAC07)** → **PostgreSQL** → **painel HTML** (GitHub Pages).

| Etapa | Ferramenta |
|-------|------------|
| 1. Ler emails | `aio_pipeline.py` |
| 2. Banco | `se_cgpac.aio_solicitacoes` |
| 3. Painel | `painel/gerar_painel.py` → `docs/index.html` |
| 4. Site | GitHub Pages (pasta `docs/`, repo `painelaio`) |

O painel é um **HTML estático autossuficiente** (linha do tempo de 10 etapas, PC 32/2024)
que embute os dados do banco — não há CSV nem busca em runtime.

**Manual para usuários:** [MANUAL.md](MANUAL.md)

## Segurança e o que fica público

| Onde | O que expõe |
|------|-------------|
| **Sua máquina** | `config.env` (senha DB, tokens Gmail), `credentials.json` — **nunca** no Git |
| **Repositório GitHub** | Código Python e `docs/index.html` (painel com dados AIO, sem credenciais) |
| **GitHub Pages** | Só o painel em `docs/` — visível por qualquer visitante |

Arquivos ignorados pelo Git (ver `.gitignore`): `config.env`, `credentials.json`,
`client_secret*.json`, `token.pickle`, `.venv/`.

Antes de cada push:

```bash
git status   # não deve listar config.env
```

O `docs/index.html` embute **dados operacionais de AIO** (município, TC, valores,
etapas, etc.). Só faça commit/push se aceitar que isso fique **público** em
`https://SEU_USUARIO.github.io/painelaio/`.

Se `config.env` ou tokens forem commitados por engano: remova do Git, **rotacione**
senha do banco e gere novo token Gmail (`gerar_token.py`).

## Estrutura

```
painel_aio/
├── aio_pipeline.py          # programa principal (Gmail → banco)
├── gerar_token.py           # setup Gmail (1x, login no navegador)
├── setup_tabela.py          # setup banco (1x)
├── migrar_colunas_etapas.py # adiciona colunas das etapas 2–10
├── rodar_fluxo_completo.sh  # Gmail → banco → painel
├── publicar_painel_manual.sh# gera painel e publica no Pages
├── config.env
├── painel/                  # gerador do painel
│   ├── gerar_painel.py
│   └── template_painel.html
└── docs/                    # o que o GitHub Pages serve (index.html = painel)
```

## Comandos rápidos

```bash
source .venv/bin/activate

# Fluxo completo (30 dias: Gmail → banco → painel)
./rodar_fluxo_completo.sh 30

# Ou passo a passo:
python3 aio_pipeline.py --dias 30 --atualizar
python3 painel/gerar_painel.py --saida docs/index.html
```

## Publicar no GitHub

1. Repositório **painelaio** no GitHub (Pages: branch `main`, pasta `/docs`).
2. Rode localmente: `./rodar_fluxo_completo.sh 30` (VPN se necessário para o banco).
3. `git status` — confirme que `config.env` **não** está na lista.
4. `./publicar_painel_manual.sh` (gera `docs/index.html`, commit e push).
5. Pages serve `docs/` direto da `main` — site atualiza em ~1–3 min.

Site publicado: https://brunothiago.github.io/painelaio/
