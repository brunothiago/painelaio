import { COLUNAS_BANCO } from './colunas-banco';

/**
 * Gera arquivo .xlsx no navegador a partir das linhas brutas do CSV/banco.
 */
export async function exportarLinhasExcel(linhas, colunasSelecionadas, nomeArquivo) {
  if (!linhas.length) {
    throw new Error('Não há registros para exportar.');
  }
  if (!colunasSelecionadas.length) {
    throw new Error('Selecione ao menos uma coluna.');
  }

  const defs = COLUNAS_BANCO.filter((c) => colunasSelecionadas.includes(c.key));
  const header = defs.map((c) => c.label);
  const rows = linhas.map((row) =>
    defs.map((c) => {
      const v = row[c.key];
      return v === null || v === undefined ? '' : String(v);
    })
  );

  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws['!cols'] = defs.map((c) => ({
    wch: Math.min(48, Math.max(c.label.length, 12)),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'AIO');
  XLSX.writeFile(wb, nomeArquivo);
}
