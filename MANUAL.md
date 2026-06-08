# Pipeline AIO — Manual para usuários

Este projeto **lê emails de AIO** (Autorização de Início de Execução) que chegam
encaminhados da Caixa (GEPAC07) para **cgpac.mcid@gmail.com** e **grava os dados
no banco de dados** PostgreSQL.

---

## O que o sistema faz? (em linguagem simples)

1. A Caixa envia um email sobre cada AIO autorizado.
2. Esse email é **encaminhado** para a caixa `cgpac.mcid@gmail.com`.
3. Um programa (`aio_pipeline.py`) entra nessa caixa, **lê o texto dentro do
   encaminhamento** (não a data do encaminhamento em si) e copia os dados para
   uma **tabela no banco**, chamada `se_cgpac.aio_solicitacoes`.
4. Os dados vão para o **banco** e, em seguida, para um **arquivo CSV**.
5. O **painel na internet** (GitHub) lê esse CSV e mostra gráficos e tabelas.

> **Atenção — dados públicos no site:** tudo que estiver em
> `dashboard/public/aio_solicitacoes.csv` e for enviado ao GitHub fica **visível
> para qualquer pessoa** no endereço do painel (GitHub Pages). Não coloque senhas
> nem tokens nesse arquivo — só dados de solicitações AIO.

```
Caixa (GEPAC07)
    → encaminha → cgpac.mcid@gmail.com
    → aio_pipeline.py → banco PostgreSQL
    → exportar_csv.py → arquivo CSV
    → site dashboard → GitHub Pages (painel_aio)
```

---

## Arquivos do projeto (o que é cada um)

| Arquivo | Para que serve |
|---------|----------------|
| **aio_pipeline.py** | Programa principal — roda todo dia (ou quando quiser) |
| **gerar_token.py** | Configuração inicial do Gmail — **só uma vez** |
| **setup_tabela.py** | Cria a tabela no banco — **só uma vez** |
| **config.env** | Senhas e configurações (banco + Gmail) — **não compartilhar** |
| **config.env.example** | Modelo vazio do config.env |
| **requirements.txt** | Lista de bibliotecas Python (instalação técnica) |
| **exportar_csv.py** | Exporta a tabela para CSV do painel |
| **rodar_fluxo_completo.sh** | Roda pipeline + CSV + build do site |
| **dashboard/** | Site do painel (publicar no GitHub) |
| **MANUAL.md** | Este manual |
| **com.mcid.aio_pipeline.plist** | Agendamento automático no Mac (opcional) |

---

## Segurança — o que nunca vai para o GitHub

Estes arquivos ficam **somente no seu computador** (já estão no `.gitignore`):

| Nunca commitar | Contém |
|----------------|--------|
| **config.env** | Senha do banco, tokens Gmail |
| **credentials.json** | Chaves OAuth do Google Cloud |
| **client_secret*.json** | Segredo do cliente OAuth |
| **token.pickle** | Sessão antiga do Gmail (se existir) |
| **.venv/** | Ambiente Python local |

Antes de cada `git push`, confira no Terminal:

```bash
git status
```

Se aparecer `config.env` ou `credentials.json`, **não envie**. Peça ajuda à TI.

**O que o GitHub publica de fato:** só o site em `dashboard/` (HTML, JS, CSS) e o
**CSV** com solicitações AIO (municípios, valores, assuntos de email, etc.). O
programa Python e o `config.env` **não** entram no site público.

---

## Dados que são salvos no banco

Cada linha da tabela = um email AIO. Colunas principais:

| Coluna | Significado |
|--------|-------------|
| instrumento | Número do instrumento |
| tc | Número do Termo de Compromisso |
| recebedor | Quem recebe (ex.: MUNICIPIO DE BAURU) |
| municipio / uf | Cidade e estado |
| data_assinatura | Data de assinatura do TC |
| data_retirada_suspensiva | Quando saiu da suspensiva |
| data_vigencia | Até quando vale |
| valor_investimento / valor_repasse | Valores em reais |
| objeto | Descrição do objeto |
| programa | Programa do Novo PAC |
| acao_orcamentaria | Código da ação orçamentária |
| email_remetente | Sempre GEPAC07 (lido de dentro do email) |
| data_aio_recebido | **Data em que a Caixa enviou** o email (ex.: 22/05/2026 16:45) |
| email_assunto | Assunto original do email da Caixa |

Campos que não existirem em algum email ficam **vazios** no banco.

---

## Instalação (primeira vez) — peça ajuda de TI se necessário

### Passo 1 — Instalar o Python e as bibliotecas

No Terminal (Mac), na pasta do projeto:

```bash
cd painel_aio
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Passo 2 — Configurar o banco (`config.env`)

Copie o modelo e preencha com os dados do PostgreSQL:

```bash
cp config.env.example config.env
```

Edite `config.env` com os dados que a **TI** passar (`DB_HOST`, `DB_NAME`,
`DB_USER`, `DB_PASSWORD`). Não copie esse arquivo para email, WhatsApp nem GitHub.
O schema padrão é `se_cgpac`.

### Passo 3 — Criar a tabela

```bash
python3 setup_tabela.py
```

### Passo 4 — Configurar o Gmail (Google Cloud)

Isso é feito **uma vez** com apoio de quem administra o Google Cloud:

1. Projeto **aio-pipeline-mcid** com **Gmail API** ativada.
2. Email **cgpac.mcid@gmail.com** em **Usuários de teste**.
3. Arquivo **credentials.json** na pasta do projeto.
4. Rodar:

```bash
python3 gerar_token.py
```

Fazer login com `cgpac.mcid@gmail.com`. O script preenche o `config.env` sozinho.

---

## Uso do dia a dia

Abra o Terminal, entre na pasta e ative o ambiente:

```bash
cd painel_aio
source .venv/bin/activate
```

### Buscar emails dos últimos 7 dias e gravar

```bash
python3 aio_pipeline.py --dias 7
```

### Só testar (não grava no banco)

```bash
python3 aio_pipeline.py --dry-run --dias 7
```

### Atualizar registros já importados

```bash
python3 aio_pipeline.py --dias 7 --atualizar
```

### Execução automática (padrão: últimos 2 dias)

```bash
python3 aio_pipeline.py
```

### Atualizar banco e CSV do painel (recomendado)

```bash
python3 aio_pipeline.py --dias 7 --atualizar --export-csv
```

Ou tudo de uma vez:

```bash
./rodar_fluxo_completo.sh 7
```

### Só gerar o CSV (sem ler email de novo)

```bash
python3 exportar_csv.py
```

O arquivo fica em: `dashboard/public/aio_solicitacoes.csv`

### Ver o painel no computador

```bash
cd dashboard
npm install
npm run dev
```

Abra o endereço que o terminal mostrar (geralmente http://localhost:5173).

### Publicar o painel no GitHub

1. Repositório **painel_aio** no GitHub (público ou privado — o **site** em Pages
   continua público se o repositório for público e o Pages estiver ativo).
2. Rode `./rodar_fluxo_completo.sh 7` na sua máquina (com VPN, se a TI exigir).
3. Antes do `git push`, confira que **só** entram arquivos do projeto e o CSV —
   **nunca** `config.env` nem `credentials.json`.
4. O commit pode incluir `dashboard/public/aio_solicitacoes.csv` (dados AIO
   **públicos no painel** — revise se está confortável com o conteúdo).
5. Push → GitHub Actions publica o site. URL típica:
   `https://SEU_USUARIO.github.io/painelaio/`

Detalhes técnicos: [dashboard/README.md](dashboard/README.md) e [README.md](README.md)
(seção Segurança).

---

## Consultar os dados no banco

No DBeaver ou psql:

```sql
SELECT instrumento, tc, municipio, uf, valor_repasse, data_aio_recebido
FROM se_cgpac.aio_solicitacoes
ORDER BY data_aio_recebido DESC;
```

---

## Logs (se algo der errado)

```bash
tail -f ~/logs/aio_pipeline.log
```

---

## Perguntas frequentes

**Por que a data no banco é a da Caixa e não do encaminhamento?**  
O programa lê a linha `Data:` **dentro** do texto encaminhado da GEPAC07, não
a data em que alguém encaminhou para o Gmail.

**Rodei de novo e não entrou email novo.**  
Emails já importados são ignorados (não duplicam). Só entram mensagens novas.
Use `--atualizar` se quiser **atualizar** linhas já existentes.

**Deu erro de token Gmail.**  
Rode de novo `python3 gerar_token.py` (pode precisar revogar o app em
myaccount.google.com/permissions).

**Preciso de VPN?**  
Em geral sim, para alcançar o **servidor PostgreSQL da rede MCID** (host e
credenciais vêm da TI no `config.env`, não devem aparecer neste manual nem no GitHub).

---

## Agendamento automático no Mac (opcional)

Para rodar todo dia às 7h, copie o arquivo `com.mcid.aio_pipeline.plist` para
`~/Library/LaunchAgents/` e ative com `launchctl load`. Detalhes no README.md
técnico ou peça à TI.

---

## Resumo em uma frase

> O sistema lê emails GEPAC07, grava no banco, exporta um CSV e alimenta o
> **painel_aio** publicado no GitHub.
