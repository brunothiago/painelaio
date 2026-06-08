#!/usr/bin/env python3
"""
=============================================================================
PIPELINE AIO — Gmail (GEPAC07) → PostgreSQL
=============================================================================

Lê emails de Autorização de Início de Execução (AIO) encaminhados para
cgpac.mcid@gmail.com, extrai os dados do corpo do email da Caixa (GEPAC07)
e grava na tabela se_cgpac.aio_solicitacoes.

Comandos:
    python3 aio_pipeline.py                  # busca últimos 2 dias e grava
    python3 aio_pipeline.py --dias 7         # busca últimos 7 dias
    python3 aio_pipeline.py --dry-run          # só mostra o que leu (não grava)
    python3 aio_pipeline.py --dias 7 --atualizar   # atualiza registros já importados

Configuração: arquivo config.env (banco + token Gmail).
Manual para leigos: MANUAL.md
=============================================================================
"""

import argparse
import base64
import html as html_module
import logging
import os
import re
import sys
from datetime import datetime
from email.utils import parsedate_to_datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import psycopg2
from dotenv import load_dotenv
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

# =============================================================================
# 1. CONFIGURAÇÃO — lê config.env na pasta do projeto
# =============================================================================

_SCRIPT_DIR = Path(__file__).resolve().parent
load_dotenv(_SCRIPT_DIR / "config.env")

DB_SCHEMA = os.getenv("DB_SCHEMA", "se_cgpac")

LOG_DIR = Path.home() / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.FileHandler(LOG_DIR / "aio_pipeline.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("aio_pipeline")

# Escopos e regex usados no pipeline
GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
GMAIL_TOKEN_URI = "https://oauth2.googleapis.com/token"
_AIO_BODY_RE = re.compile(r"instrumento", re.I)
_TC_RE = re.compile(r"\bTC\s*:", re.I)
_GEPAC_RE = re.compile(r"GEPAC07|GEPAC\s*07|CAIXA\.GOV\.BR", re.I)
_TZ_BR = ZoneInfo("America/Sao_Paulo")

_MESES_PT = {
    "janeiro": 1, "fevereiro": 2, "marco": 3, "março": 3, "abril": 4,
    "maio": 5, "junho": 6, "julho": 7, "agosto": 8,
    "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12,
}


# =============================================================================
# 2. AUTENTICAÇÃO GMAIL — usa refresh token salvo no config.env
#    (gerado uma vez com gerar_token.py)
# =============================================================================

def get_gmail_service():
    """Conecta ao Gmail usando GMAIL_REFRESH_TOKEN do config.env."""
    refresh = os.getenv("GMAIL_REFRESH_TOKEN", "").strip()
    client_id = os.getenv("GMAIL_CLIENT_ID", "").strip()
    client_secret = os.getenv("GMAIL_CLIENT_SECRET", "").strip()

    faltando = [k for k, v in (
        ("GMAIL_REFRESH_TOKEN", refresh),
        ("GMAIL_CLIENT_ID", client_id),
        ("GMAIL_CLIENT_SECRET", client_secret),
    ) if not v]
    if faltando:
        log.error(
            "Faltam no config.env: %s\nRode uma vez: python3 gerar_token.py",
            ", ".join(faltando),
        )
        sys.exit(1)

    creds = Credentials(
        token=None,
        refresh_token=refresh,
        client_id=client_id,
        client_secret=client_secret,
        token_uri=GMAIL_TOKEN_URI,
        scopes=GMAIL_SCOPES,
    )
    try:
        if not creds.valid or creds.expired:
            creds.refresh(Request())
    except Exception as e:
        log.error("Falha ao renovar token Gmail: %s", e)
        sys.exit(1)

    return build("gmail", "v1", credentials=creds)


# =============================================================================
# 3. LEITURA DO CORPO DO EMAIL (texto ou HTML)
# =============================================================================

def _valid_schema(name: str) -> str:
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*$", name):
        raise ValueError(f"DB_SCHEMA inválido: {name!r}")
    return name


def _require_db_config():
    missing = [k for k in ("DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD") if not os.getenv(k)]
    if missing:
        log.error(
            "Variáveis ausentes no config.env: %s\n"
            "Preencha DB_HOST, DB_NAME, DB_USER e DB_PASSWORD em config.env.",
            ", ".join(missing),
        )
        sys.exit(1)
    _valid_schema(DB_SCHEMA)


def _decode_part(data: str) -> str:
    return base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")


def _html_to_text(raw: str) -> str:
    text = re.sub(r"(?i)<br\s*/?>", "\n", raw)
    text = re.sub(r"<[^>]+>", "", text)
    return html_module.unescape(text)


def get_email_body(msg: dict) -> str:
    plain_parts: list[str] = []
    html_parts: list[str] = []

    def _walk(payload):
        mime = payload.get("mimeType", "")
        parts = payload.get("parts", [])

        if mime == "text/plain":
            data = payload.get("body", {}).get("data", "")
            if data:
                plain_parts.append(_decode_part(data))
            return
        if mime == "text/html":
            data = payload.get("body", {}).get("data", "")
            if data:
                html_parts.append(_decode_part(data))
            return

        for part in parts:
            _walk(part)

        data = payload.get("body", {}).get("data", "")
        if data and not parts:
            if mime == "text/html":
                html_parts.append(_decode_part(data))
            else:
                plain_parts.append(_decode_part(data))

    _walk(msg["payload"])
    if plain_parts:
        return "\n".join(plain_parts)
    if html_parts:
        return _html_to_text("\n".join(html_parts))
    return ""


# =============================================================================
# 4. EXTRAÇÃO — metadados GEPAC07 e campos AIO (corpo do encaminhamento)
# =============================================================================

def _gepac_body_window(body: str) -> str:
    """Recorte do corpo em torno do bloco GEPAC07 encaminhado."""
    m = re.search(r"GEPAC\s*07|GEPAC07", body, re.I)
    if not m:
        return body
    start = max(0, m.start() - 500)
    end = min(len(body), m.end() + 3000)
    return body[start:end]


def _parse_data_corpo_email(texto: str) -> datetime | None:
    """
    Interpreta datas no corpo do encaminhamento (português).
    Ex.: sexta-feira, 22 de maio de 2026 às 16:45
    """
    t = re.sub(r"\s+", " ", texto.strip())

    m = re.search(
        r"(?:\w+-feira,?\s+)?(\d{1,2})\s+de\s+([a-zçãéíóú]+)\s+de\s+(\d{4})"
        r"(?:\s+[àa]s\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?",
        t,
        re.I,
    )
    if m:
        mes_nome = m.group(2).lower().replace("ç", "c")
        mes = _MESES_PT.get(mes_nome)
        if mes:
            hora = int(m.group(4) or 0)
            minuto = int(m.group(5) or 0)
            segundo = int(m.group(6) or 0)
            return datetime(
                int(m.group(3)), mes, int(m.group(1)), hora, minuto, segundo, tzinfo=_TZ_BR
            )

    m = re.search(
        r"(\d{1,2})/(\d{1,2})/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?",
        t,
    )
    if m:
        return datetime(
            int(m.group(3)),
            int(m.group(2)),
            int(m.group(1)),
            int(m.group(4) or 0),
            int(m.group(5) or 0),
            int(m.group(6) or 0),
            tzinfo=_TZ_BR,
        )

    # Inglês: May 22, 2026 at 4:45 PM
    m = re.search(
        r"([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)?",
        t,
        re.I,
    )
    if m:
        meses_en = {
            "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
            "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
        }
        mes = meses_en.get(m.group(1).lower())
        if mes:
            hora = int(m.group(4))
            minuto = int(m.group(5))
            if m.group(6) and m.group(6).upper() == "PM" and hora < 12:
                hora += 12
            if m.group(6) and m.group(6).upper() == "AM" and hora == 12:
                hora = 0
            return datetime(int(m.group(3)), mes, int(m.group(2)), hora, minuto, tzinfo=_TZ_BR)

    return None


def extract_gepac_metadata_from_body(body: str) -> dict:
    """
    Extrai remetente, data e assunto do bloco encaminhado GEPAC07 no corpo.
    Não usa cabeçalhos do Gmail (caixa cgpac.mcid@gmail.com).
    """
    out = {"email_remetente": None, "data_aio_recebido": None, "email_assunto": None}
    if not _GEPAC_RE.search(body):
        return out

    window = _gepac_body_window(body)

    # De:/From: GEPAC07
    for m in re.finditer(r"(?:De|From)\s*:\s*(.+?)(?:\r?\n)", body, re.I):
        linha = m.group(1).strip()
        if _GEPAC_RE.search(linha):
            out["email_remetente"] = linha
            trecho = body[m.end() : m.end() + 500]
            dm = re.search(r"(?:Data|Date)\s*:\s*(.+?)(?:\r?\n)", trecho, re.I)
            if dm:
                out["data_aio_recebido"] = _parse_data_corpo_email(dm.group(1))
            break

    if not out["data_aio_recebido"]:
        for m in re.finditer(r"(?:Data|Date)\s*:\s*(.+?)(?:\r?\n)", window, re.I):
            dt = _parse_data_corpo_email(m.group(1))
            if dt:
                out["data_aio_recebido"] = dt
                break

    for m in re.finditer(r"(?:Assunto|Subject)\s*:\s*(.+?)(?:\r?\n)", window, re.I):
        assunto = m.group(1).strip()
        if assunto:
            out["email_assunto"] = assunto
            break

    return out


# Rótulos do email GEPAC07 → colunas no banco (NULL se o campo não existir no email)
_PATTERNS = {
    "instrumento": r"Instrumento\s*:\s*(\d+)",
    "tc": r"\bTC\s*:\s*(\d+)",
    "recebedor": r"Recebedor\s*:\s*(.+?)(?:\r?\n|$)",
    "municipio_beneficiado": r"Munic[íi]pio beneficiado\s*:\s*(.+?)(?:\r?\n|$)",
    "data_assinatura": r"Data de Assinatura\s*:\s*(\d{2}/\d{2}/\d{4})",
    "data_retirada_suspensiva": r"Data de Retirada da Suspensiva\s*:\s*(\d{2}/\d{2}/\d{4})",
    "data_vigencia": r"Data de Vig[êe]ncia\s*:\s*(\d{2}/\d{2}/\d{4})",
    "valor_investimento": r"Valor de Investimento\s*:\s*(R\$\s*[\d.,]+)",
    "valor_repasse": r"Valor de Repasse\s*:\s*(R\$\s*[\d.,]+)",
    "objeto": r"Objeto\s*:\s*([\s\S]+?)(?=\r?\nPrograma|\r?\nA[çc][ãa]o)",
    "programa": r"Programa\s*:\s*(.+?)(?:\r?\n|$)",
    "acao_orcamentaria": r"A[çc][ãa]o Or[çc]ament[áa]ria\s*:\s*(.+?)(?:\r?\n|$)",
}

_AIO_BODY_COLUMNS = (
    "instrumento", "tc", "recebedor", "municipio_beneficiado", "municipio", "uf",
    "data_assinatura", "data_retirada_suspensiva", "data_vigencia",
    "valor_investimento", "valor_repasse", "objeto",
    "programa_codigo", "programa_descricao", "programa", "acao_orcamentaria",
)


def _parse_date(value: str):
    try:
        return datetime.strptime(value.strip(), "%d/%m/%Y").date()
    except (ValueError, AttributeError):
        return None


def _parse_currency(value: str):
    try:
        clean = re.sub(r"[R$\s]", "", value).replace(".", "").replace(",", ".")
        return float(clean)
    except (ValueError, AttributeError):
        return None


def _split_municipio_uf(value: str):
    if "/" in value:
        partes = value.rsplit("/", 1)
        return partes[0].strip(), partes[1].strip()
    return value.strip(), None


def _parse_programa(text: str | None) -> tuple[str | None, str | None]:
    if not text:
        return None, None
    texto = re.sub(r"\s+", " ", text).strip()
    m = re.match(r"^(\d+)\s*-\s*(.+)$", texto)
    if m:
        return m.group(1), m.group(2)
    return None, texto


def extract_aio_fields(body: str) -> dict | None:
    raw = {}
    for campo, pattern in _PATTERNS.items():
        m = re.search(pattern, body, re.IGNORECASE | re.MULTILINE)
        if m:
            raw[campo] = m.group(1).strip()

    if not raw.get("instrumento") or not raw.get("tc"):
        return None

    fields = {col: None for col in _AIO_BODY_COLUMNS}

    for key in ("instrumento", "tc", "recebedor", "acao_orcamentaria"):
        fields[key] = raw.get(key)

    if raw.get("municipio_beneficiado"):
        fields["municipio_beneficiado"] = raw["municipio_beneficiado"]
        fields["municipio"], fields["uf"] = _split_municipio_uf(raw["municipio_beneficiado"])

    if raw.get("objeto"):
        fields["objeto"] = re.sub(r"\s+", " ", raw["objeto"]).strip()

    if raw.get("programa"):
        fields["programa"] = re.sub(r"\s+", " ", raw["programa"]).strip()
        fields["programa_codigo"], fields["programa_descricao"] = _parse_programa(fields["programa"])

    for campo in ("data_assinatura", "data_retirada_suspensiva", "data_vigencia"):
        fields[campo] = _parse_date(raw.get(campo, ""))

    for campo in ("valor_investimento", "valor_repasse"):
        fields[campo] = _parse_currency(raw.get(campo, ""))

    return fields


# =============================================================================
# 5. BANCO DE DADOS — PostgreSQL (tabela se_cgpac.aio_solicitacoes)
# =============================================================================

def get_db_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", 5432)),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        connect_timeout=10,
    )


def _insert_sql(schema: str, atualizar: bool = False) -> str:
    cols = (
        "instrumento", "tc", "recebedor", "municipio_beneficiado", "municipio", "uf",
        "data_assinatura", "data_retirada_suspensiva", "data_vigencia",
        "valor_investimento", "valor_repasse", "objeto",
        "programa_codigo", "programa_descricao", "programa", "acao_orcamentaria",
        "email_remetente", "email_assunto", "data_aio_recebido", "email_id",
    )
    col_list = ", ".join(cols)
    val_list = ", ".join(f"%({c})s" for c in cols)
    conflict = "DO NOTHING"
    if atualizar:
        upd = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols if c != "email_id")
        conflict = f"DO UPDATE SET {upd}"
    return f"""
    INSERT INTO {schema}.aio_solicitacoes ({col_list})
    VALUES ({val_list})
    ON CONFLICT (email_id) {conflict}
    RETURNING id;
    """


def list_gmail_messages(service, query: str) -> list[dict]:
    messages: list[dict] = []
    page_token = None
    while True:
        kwargs = {"userId": "me", "q": query, "maxResults": 100}
        if page_token:
            kwargs["pageToken"] = page_token
        result = service.users().messages().list(**kwargs).execute()
        messages.extend(result.get("messages", []))
        page_token = result.get("nextPageToken")
        if not page_token:
            break
    return messages


def insert_aio(conn, record: dict, atualizar: bool = False) -> int | None:
    schema = _valid_schema(DB_SCHEMA)
    with conn.cursor() as cur:
        cur.execute(_insert_sql(schema, atualizar=atualizar), record)
        row = cur.fetchone()
        conn.commit()
        return row[0] if row else None


# =============================================================================
# 6. PIPELINE PRINCIPAL — busca Gmail, extrai, grava
# =============================================================================

def run_pipeline(dias: int = 2, dry_run: bool = False, atualizar: bool = False):
    log.info("=" * 60)
    log.info("PIPELINE AIO | dry_run=%s | dias=%s | schema=%s", dry_run, dias, DB_SCHEMA)
    log.info("=" * 60)

    if not dry_run:
        _require_db_config()

    log.info("Conectando ao Gmail (refresh token)...")
    service = get_gmail_service()

    conn = None
    if not dry_run:
        try:
            conn = get_db_connection()
            log.info("PostgreSQL conectado (%s@%s/%s).", os.getenv("DB_USER"), os.getenv("DB_HOST"), os.getenv("DB_NAME"))
        except Exception as e:
            log.error("Falha ao conectar ao PostgreSQL: %s", e)
            sys.exit(1)

    query = (
        f"newer_than:{dias}d "
        '(subject:"Autorização de Início" OR subject:"Início de Execução" '
        'OR subject:"AIO")'
    )
    log.info("Query Gmail: %s", query)
    messages = list_gmail_messages(service, query)
    log.info("Candidatos encontrados: %s", len(messages))

    inseridos = descartados = duplicatas = erros = 0

    for msg_ref in messages:
        msg_id = msg_ref["id"]
        try:
            msg = service.users().messages().get(userId="me", id=msg_id, format="full").execute()
            body = get_email_body(msg)

            if not _AIO_BODY_RE.search(body) or not _TC_RE.search(body):
                descartados += 1
                continue

            meta = extract_gepac_metadata_from_body(body)
            headers = {h["name"]: h["value"] for h in msg["payload"]["headers"]}

            # Encaminhamento: metadados vêm do corpo (GEPAC07), não da caixa Gmail
            if _GEPAC_RE.search(body):
                remetente = meta["email_remetente"]
                data_aio_recebido = meta["data_aio_recebido"]
                assunto = meta["email_assunto"]
                if not remetente:
                    log.warning("[%s] De: GEPAC07 não encontrado no corpo.", msg_id)
                if not data_aio_recebido:
                    log.warning("[%s] Data GEPAC07 não encontrada no corpo.", msg_id)
            else:
                log.warning("[%s] Sem GEPAC07 no corpo; usando cabeçalhos Gmail.", msg_id)
                remetente = headers.get("From", "")
                assunto = headers.get("Subject", "")
                try:
                    data_aio_recebido = parsedate_to_datetime(headers.get("Date", ""))
                except Exception:
                    data_aio_recebido = None

            fields = extract_aio_fields(body)
            if fields is None:
                log.warning("[%s] Campos AIO não encontrados no corpo.", msg_id)
                descartados += 1
                continue

            record = {
                **fields,
                "email_remetente": remetente,
                "email_assunto": assunto,
                "data_aio_recebido": data_aio_recebido,
                "email_id": msg_id,
            }

            dt_log = (
                data_aio_recebido.strftime("%Y-%m-%d %H:%M")
                if data_aio_recebido
                else "—"
            )
            log.info(
                "[%s] Instrumento=%s | TC=%s | %s/%s | GEPAC07 %s | data_aio=%s",
                msg_id,
                record.get("instrumento"),
                record.get("tc"),
                record.get("municipio"),
                record.get("uf"),
                (remetente or "")[:40],
                dt_log,
            )

            if dry_run:
                for k, v in record.items():
                    log.info("    %-30s: %s", k, v)
                inseridos += 1
                continue

            novo_id = insert_aio(conn, record, atualizar=atualizar)
            if novo_id:
                log.info("    Inserido id=%s", novo_id)
                inseridos += 1
            else:
                log.info("    Duplicata ignorada (email_id já existe).")
                duplicatas += 1

        except Exception as e:
            log.error("[%s] Erro: %s", msg_id, e, exc_info=True)
            erros += 1

    if conn:
        conn.close()

    log.info("─" * 60)
    log.info(
        "RESUMO | inseridos=%s | duplicatas=%s | descartados=%s | erros=%s",
        inseridos,
        duplicatas,
        descartados,
        erros,
    )
    log.info("=" * 60)


# =============================================================================
# 7. LINHA DE COMANDO
# =============================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pipeline AIO — Gmail → PostgreSQL")
    parser.add_argument("--dry-run", action="store_true", help="Extrai sem gravar no banco.")
    parser.add_argument(
        "--dias",
        type=int,
        default=int(os.getenv("DIAS_RETROATIVOS", 2)),
        help="Dias retroativos para buscar emails (padrão: 2).",
    )
    parser.add_argument(
        "--atualizar",
        action="store_true",
        help="Atualiza registros existentes (mesmo email_id) com dados reprocessados.",
    )
    args = parser.parse_args()
    run_pipeline(
        dias=args.dias,
        dry_run=args.dry_run,
        atualizar=args.atualizar,
    )
