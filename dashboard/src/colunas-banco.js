/**
 * Colunas de se_cgpac.aio_solicitacoes (mesmo conjunto do exportar_csv.py / CSV).
 */
export const COLUNAS_BANCO = [
  { key: 'id', label: 'ID' },
  { key: 'instrumento', label: 'Instrumento' },
  { key: 'tc', label: 'Termo de compromisso (TC)' },
  { key: 'recebedor', label: 'Recebedor' },
  { key: 'municipio_beneficiado', label: 'Município beneficiado' },
  { key: 'municipio', label: 'Município' },
  { key: 'uf', label: 'UF' },
  { key: 'data_assinatura', label: 'Data de assinatura' },
  { key: 'data_retirada_suspensiva', label: 'Data retirada suspensiva' },
  { key: 'data_vigencia', label: 'Data de vigência' },
  { key: 'valor_investimento', label: 'Valor investimento (R$)' },
  { key: 'valor_repasse', label: 'Valor repasse (R$)' },
  { key: 'objeto', label: 'Objeto' },
  { key: 'programa_codigo', label: 'Código do programa' },
  { key: 'programa_descricao', label: 'Descrição do programa' },
  { key: 'programa', label: 'Programa (completo)' },
  { key: 'acao_orcamentaria', label: 'Ação orçamentária' },
  { key: 'email_remetente', label: 'E-mail remetente' },
  { key: 'email_assunto', label: 'Assunto do e-mail' },
  { key: 'data_aio_recebido', label: 'Data chegada AIO (e-mail)' },
  { key: 'email_id', label: 'ID mensagem Gmail' },
  { key: 'criado_em', label: 'Criado em (importação)' },
];

export const CHAVES_COLUNAS_PADRAO = COLUNAS_BANCO.map((c) => c.key);
