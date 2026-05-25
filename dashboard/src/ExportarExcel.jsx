/**
 * Painel de exportação Excel — colunas do banco + base filtrada da tabela.
 */
import React, { useMemo, useState } from 'react';
import { Download, CheckSquare, Square } from 'lucide-react';
import { COLUNAS_BANCO, CHAVES_COLUNAS_PADRAO } from './colunas-banco';
import { exportarLinhasExcel } from './gerarExcel';

const C = {
  navy: '#071D41',
  blue: '#1351B4',
  muted: '#8C8C8C',
  line: '#E5E7EB',
  bg: '#FAFAF7',
  red: '#BC4749',
};

export default function ExportarExcel({ linhasBrutas = [], dadosFiltrados = [], filtrosAtivos }) {
  const [colunasSel, setColunasSel] = useState(() => [...CHAVES_COLUNAS_PADRAO]);
  const [exportando, setExportando] = useState(false);
  const [msgErro, setMsgErro] = useState(null);

  const linhasExportar = useMemo(() => {
    if (!linhasBrutas.length) return [];
    const ids = new Set(dadosFiltrados.map((d) => String(d.id)));
    return linhasBrutas.filter((r) => ids.has(String(r.id)));
  }, [linhasBrutas, dadosFiltrados]);

  const toggleColuna = (key) => {
    setColunasSel((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
    setMsgErro(null);
  };

  const marcarTodas = () => {
    setColunasSel([...CHAVES_COLUNAS_PADRAO]);
    setMsgErro(null);
  };

  const desmarcarTodas = () => setColunasSel([]);

  const handleExportar = async () => {
    setMsgErro(null);
    if (colunasSel.length === 0) {
      setMsgErro('Selecione ao menos uma coluna.');
      return;
    }
    if (linhasExportar.length === 0) {
      setMsgErro('Não há registros na base filtrada para exportar.');
      return;
    }

    const sufixo = filtrosAtivos ? 'filtrado' : 'completo';
    const data = new Date().toISOString().slice(0, 10);
    const nome = `aio_solicitacoes_${sufixo}_${data}.xlsx`;

    setExportando(true);
    try {
      await exportarLinhasExcel(linhasExportar, colunasSel, nome);
    } catch (e) {
      setMsgErro(e.message || 'Falha ao gerar o Excel.');
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="border-t p-5 space-y-4" style={{ borderColor: C.line, background: C.bg }}>
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div
            className="text-[10px] font-semibold tracking-[0.22em] uppercase mb-1"
            style={{ color: C.blue }}
          >
            05 · Exportar base
          </div>
          <h3
            className="text-lg"
            style={{ fontFamily: 'Fraunces', color: C.navy, fontWeight: 400 }}
          >
            Exportar para Excel
          </h3>
          <p className="text-sm mt-1 max-w-xl" style={{ color: C.muted }}>
            Gera planilha <strong>.xlsx</strong> com os mesmos campos do banco{' '}
            <code style={{ fontFamily: 'JetBrains Mono', fontSize: 11 }}>aio_solicitacoes</code>.
            Usa a base da tabela acima{filtrosAtivos ? ' (filtros aplicados)' : ''}:{' '}
            <span className="tabular-nums font-semibold" style={{ color: C.navy }}>
              {linhasExportar.length}
            </span>{' '}
            registro(s).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={marcarTodas}
            className="text-[11px] font-medium tracking-wider uppercase px-2.5 py-1.5 border transition-colors hover:bg-white"
            style={{ borderColor: C.line, color: C.navy, fontFamily: 'Plus Jakarta Sans' }}
          >
            <CheckSquare size={12} className="inline mr-1 -mt-0.5" />
            Todas as colunas
          </button>
          <button
            type="button"
            onClick={desmarcarTodas}
            className="text-[11px] font-medium tracking-wider uppercase px-2.5 py-1.5 border transition-colors hover:bg-white"
            style={{ borderColor: C.line, color: C.muted, fontFamily: 'Plus Jakarta Sans' }}
          >
            <Square size={12} className="inline mr-1 -mt-0.5" />
            Limpar seleção
          </button>
          <button
            type="button"
            onClick={handleExportar}
            disabled={exportando || linhasExportar.length === 0}
            className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase px-4 py-2 transition-opacity disabled:opacity-40"
            style={{
              background: C.navy,
              color: 'white',
              fontFamily: 'Plus Jakarta Sans',
            }}
          >
            <Download size={14} strokeWidth={2} />
            {exportando ? 'Gerando…' : 'Baixar Excel'}
          </button>
        </div>
      </div>

      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 p-4 border bg-white max-h-[220px] overflow-y-auto"
        style={{ borderColor: C.line }}
      >
        {COLUNAS_BANCO.map((col) => {
          const ativo = colunasSel.includes(col.key);
          return (
            <label
              key={col.key}
              className="flex items-start gap-2 text-sm cursor-pointer py-1 px-1 rounded-sm hover:bg-slate-50"
              style={{ color: C.navy }}
            >
              <input
                type="checkbox"
                checked={ativo}
                onChange={() => toggleColuna(col.key)}
                className="mt-0.5 shrink-0"
                style={{ accentColor: C.blue }}
              />
              <span className="leading-snug">{col.label}</span>
            </label>
          );
        })}
      </div>

      <p className="text-xs" style={{ color: C.muted }}>
        {colunasSel.length} de {COLUNAS_BANCO.length} colunas selecionadas
      </p>

      {msgErro && (
        <p className="text-sm px-3 py-2 border" style={{ color: C.red, borderColor: C.red, background: '#fff5f5' }}>
          {msgErro}
        </p>
      )}
    </div>
  );
}
