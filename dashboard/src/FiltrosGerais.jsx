/**
 * Filtros globais do painel — programa e semana do ano (chegada AIO).
 */
import React from 'react';
import { Filter, X, CalendarDays } from 'lucide-react';

const C = {
  navy: '#071D41',
  blue: '#1351B4',
  text: '#333333',
  muted: '#8C8C8C',
  line: '#E5E7EB',
  bg: '#FAFAF7',
  red: '#BC4749',
};

function Chip({ active, onClick, color, title, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="text-[11px] font-medium tracking-wide px-2.5 py-1 border transition-all max-w-[280px] truncate"
      style={{
        background: active ? color : 'transparent',
        color: active ? 'white' : C.text,
        borderColor: active ? color : C.line,
        fontFamily: 'Plus Jakarta Sans',
      }}
    >
      {children}
    </button>
  );
}

export default function FiltrosGerais({
  programasOpcoes,
  semanasOpcoes,
  filtroPrograma,
  setFiltroPrograma,
  filtroSemana,
  setFiltroSemana,
  totalBase,
  totalFiltrado,
  onLimpar,
  corPrograma,
}) {
  const ativos = filtroPrograma.length > 0 || filtroSemana.length > 0;
  const toggle = (arr, setArr, valor) =>
    setArr(arr.includes(valor) ? arr.filter((v) => v !== valor) : [...arr, valor]);

  return (
    <section className="border-b" style={{ borderColor: C.line, background: C.bg }}>
      <div className="mx-auto max-w-[1280px] px-8 py-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Filter size={16} strokeWidth={1.5} style={{ color: C.blue }} />
            <span
              className="text-[10px] font-semibold tracking-[0.22em] uppercase"
              style={{ color: C.navy, fontFamily: 'Plus Jakarta Sans' }}
            >
              Filtros gerais
            </span>
            <span className="text-xs tabular-nums" style={{ color: C.muted }}>
              <strong style={{ color: C.navy }}>{totalFiltrado}</strong> de {totalBase} solicitações
            </span>
          </div>
          {ativos && (
            <button
              type="button"
              onClick={onLimpar}
              className="inline-flex items-center gap-1 text-[11px] font-medium tracking-wider uppercase px-2.5 py-1 border self-start"
              style={{ color: C.red, borderColor: C.red, fontFamily: 'Plus Jakarta Sans' }}
            >
              <X size={12} />
              Limpar filtros gerais
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <div
              className="text-[10px] tracking-[0.18em] uppercase mb-2"
              style={{ color: C.muted, fontFamily: 'Plus Jakarta Sans' }}
            >
              Programa
            </div>
            <div className="flex flex-wrap gap-2">
              {programasOpcoes.map((nome) => (
                <Chip
                  key={nome}
                  active={filtroPrograma.includes(nome)}
                  color={corPrograma(nome)}
                  title={nome}
                  onClick={() => toggle(filtroPrograma, setFiltroPrograma, nome)}
                >
                  {nome}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <div
              className="flex items-center gap-2 text-[10px] tracking-[0.18em] uppercase mb-2"
              style={{ color: C.muted, fontFamily: 'Plus Jakarta Sans' }}
            >
              <CalendarDays size={12} strokeWidth={1.5} />
              Semana do ano (data de chegada do AIO)
            </div>
            <div className="flex flex-wrap gap-2">
              {semanasOpcoes.length === 0 && (
                <span className="text-sm" style={{ color: C.muted }}>
                  Sem datas de chegada AIO na base.
                </span>
              )}
              {semanasOpcoes.map((s) => (
                <Chip
                  key={s.key}
                  active={filtroSemana.includes(s.key)}
                  color={C.navy}
                  title={`${s.label} (${s.intervalo}) · ${s.qtd} AIO(s)`}
                  onClick={() => toggle(filtroSemana, setFiltroSemana, s.key)}
                >
                  {s.label}
                  <span className="opacity-80 font-normal"> · {s.intervalo}</span>
                  <span className="ml-1 tabular-nums opacity-90">({s.qtd})</span>
                </Chip>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs" style={{ color: C.muted, fontFamily: 'Plus Jakarta Sans' }}>
          Os filtros acima aplicam-se a todo o painel: indicadores, gráficos, cartões e tabela.
          {!ativos && ' Nenhum filtro selecionado — exibindo a base completa.'}
        </p>
      </div>
    </section>
  );
}
