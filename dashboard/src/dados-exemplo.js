/**
 * ============================================================================
 *  dados-exemplo.js
 * ----------------------------------------------------------------------------
 *  Dados de exemplo extraídos do CSV `aio_solicitacoes_*.csv`.
 *  Use como FALLBACK enquanto a query do banco não retorna, ou para testes
 *  isolados do componente.
 *
 *  -----------------  FORMATO ESPERADO PELO DASHBOARD  -----------------------
 *
 *  Cada item do array deve seguir este shape:
 *
 *    {
 *      id:             number,    // identificador único (chave de lista)
 *      tc:             string,    // nº do Termo de Compromisso (Transferegov)
 *      instrumento:    string,    // nº do instrumento (SACI)
 *      recebedor:      string,    // razão social do recebedor
 *      municipio:      string,    // município (capitalizado, sem UF)
 *      uf:             string,    // sigla da UF (2 letras maiúsculas)
 *      objeto:         string,    // descrição do objeto contratado
 *      programa:       string,    // nome COMPLETO do programa
 *      programaCurto:  string,    // rótulo curto p/ chips e gráficos
 *      valorInvest:    number,    // valor de investimento total (R$)
 *      valorRepasse:   number,    // valor de repasse da União (R$)
 *      dataAssinatura: string,    // ISO 'YYYY-MM-DD'
 *      dataSuspensiva: string,    // ISO 'YYYY-MM-DD'
 *      dataVigencia:   string,    // ISO 'YYYY-MM-DD'
 *      dataAIO:        string,    // ISO 'YYYY-MM-DD' (recebimento do e-mail AIO)
 *      acao:           string,    // código da ação orçamentária
 *    }
 *
 *  --------------------  COMO MAPEAR A PARTIR DO CSV  -----------------------
 *
 *  As chaves do CSV usam snake_case e datas com timestamp; abaixo o mapping
 *  direto para o shape acima:
 *
 *    csv.id                       -> id
 *    csv.tc                       -> tc
 *    csv.instrumento              -> instrumento
 *    csv.recebedor                -> recebedor
 *    capitalize(csv.municipio)    -> municipio
 *    csv.uf                       -> uf
 *    csv.objeto                   -> objeto
 *    csv.programa_descricao       -> programa
 *    csv.programa_descricao       -> programaCurto  (nome do banco, via mapeador.js)
 *    Number(csv.valor_investimento)-> valorInvest
 *    Number(csv.valor_repasse)    -> valorRepasse
 *    csv.data_assinatura.slice(0,10) -> dataAssinatura
 *    csv.data_retirada_suspensiva.slice(0,10) -> dataSuspensiva
 *    csv.data_vigencia.slice(0,10) -> dataVigencia
 *    csv.data_aio_recebido.slice(0,10) -> dataAIO
 *    csv.acao_orcamentaria        -> acao
 *
 *  Helper sugerido para derivar `programaCurto`:
 *
 *    const PROGRAMA_CURTO = {
 *      '5600020250030': 'MCMV Sub 50',
 *      '5600020240045': 'Mobilidade Urbana',
 *      // adicionar novos códigos conforme aparecerem
 *    };
 *    programaCurto = PROGRAMA_CURTO[csv.programa_codigo] ?? 'Outros';
 *
 * ============================================================================
 */

export const dadosExemplo = [
  {
    id: 1,
    tc: '1098544',
    instrumento: '969603',
    recebedor: 'MUNICÍPIO DE BAURU',
    municipio: 'Bauru',
    uf: 'SP',
    objeto: 'Elaboração de estudos — VLT Bauru',
    programa: 'Novo PAC — Mobilidade Urbana Sustentável: Mobilidade Grandes e Médias Cidades',
    programaCurto: 'Mobilidade Urbana',
    valorInvest: 2300000,
    valorRepasse: 1500000,
    dataAssinatura: '2024-12-02',
    dataSuspensiva: '2025-10-23',
    dataVigencia: '2028-09-02',
    dataAIO: '2026-05-22',
    acao: '231900T3',
  },
  {
    id: 2,
    tc: '1105091',
    instrumento: '986939',
    recebedor: 'MUNICÍPIO DE CACULÉ',
    municipio: 'Caculé',
    uf: 'BA',
    objeto: 'Provisão habitacional no Município de Caculé/BA',
    programa: 'Minha Casa, Minha Vida — MCMV FNHIS Sub 50',
    programaCurto: 'MCMV Sub 50',
    valorInvest: 2800000,
    valorRepasse: 2800000,
    dataAssinatura: '2025-12-10',
    dataSuspensiva: '2025-12-10',
    dataVigencia: '2028-09-10',
    dataAIO: '2026-05-22',
    acao: '232000TI',
  },
  {
    id: 3,
    tc: '1103812',
    instrumento: '989882',
    recebedor: 'MUNICÍPIO DE SERRA DA SAUDADE',
    municipio: 'Serra da Saudade',
    uf: 'MG',
    objeto: 'Provisão habitacional no município de Serra da Saudade/MG',
    programa: 'Minha Casa, Minha Vida — MCMV FNHIS Sub 50',
    programaCurto: 'MCMV Sub 50',
    valorInvest: 3029436.9,
    valorRepasse: 2800000,
    dataAssinatura: '2025-12-23',
    dataSuspensiva: '2025-12-24',
    dataVigencia: '2029-12-23',
    dataAIO: '2026-05-22',
    acao: '232000TI',
  },
  {
    id: 4,
    tc: '1106419',
    instrumento: '987333',
    recebedor: 'MUNICÍPIO DE NOVA INDEPENDÊNCIA',
    municipio: 'Nova Independência',
    uf: 'SP',
    objeto: 'Provisão de unidades habitacionais — MCMV Sub 50 / FNHIS',
    programa: 'Minha Casa, Minha Vida — MCMV FNHIS Sub 50',
    programaCurto: 'MCMV Sub 50',
    valorInvest: 2800000,
    valorRepasse: 2800000,
    dataAssinatura: '2025-12-15',
    dataSuspensiva: '2025-12-18',
    dataVigencia: '2029-04-05',
    dataAIO: '2026-05-22',
    acao: '232000TI',
  },
];

/** Linhas brutas (formato CSV/banco) para exportação Excel em modo demonstração */
export const linhasBrutasExemplo = dadosExemplo.map((d) => ({
  id: String(d.id),
  instrumento: d.instrumento,
  tc: d.tc,
  recebedor: d.recebedor,
  municipio_beneficiado: `${d.municipio.toUpperCase()}/${d.uf}`,
  municipio: d.municipio.toUpperCase(),
  uf: d.uf,
  data_assinatura: d.dataAssinatura,
  data_retirada_suspensiva: d.dataSuspensiva,
  data_vigencia: d.dataVigencia,
  valor_investimento: String(d.valorInvest),
  valor_repasse: String(d.valorRepasse),
  objeto: d.objeto,
  programa_codigo: '',
  programa_descricao: d.programa,
  programa: d.programa,
  acao_orcamentaria: d.acao,
  email_remetente: 'GEPAC07 <GEPAC07@CAIXA.GOV.BR>',
  email_assunto: '',
  data_aio_recebido: d.dataAIO,
  email_id: '',
  criado_em: '',
}));
