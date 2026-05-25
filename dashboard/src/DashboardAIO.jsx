/**
 * ============================================================================
 *  DashboardAIO — Painel de AIO
 *  Ministério das Cidades · DMP/SE · Novo PAC
 * ----------------------------------------------------------------------------
 *  Componente único e autocontido. Recebe a lista de solicitações AIO via
 *  prop `dados` (formato definido em `./dados-exemplo.js`).
 *
 *  Dependências:
 *    - react             ^18
 *    - recharts          ^2.12
 *    - lucide-react      ^0.400
 *    - tailwindcss       ^3
 *
 *  Uso:
 *    import DashboardAIO from './DashboardAIO';
 *    import { dadosExemplo } from './dados-exemplo';
 *    <DashboardAIO dados={dadosVindosDoBanco ?? dadosExemplo} />
 * ============================================================================
 */

import React, { useMemo, useState } from 'react';
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LabelList,
} from 'recharts';
import {
  MapPin, Wallet, FileSignature, ArrowUpRight,
  Calendar, Clock, ChevronRight, Hash, Layers,
  Search, X, ArrowUpDown, ArrowUp, ArrowDown, Filter,
  ChevronLeft, ChevronRight as ChevRight,
} from 'lucide-react';
import { dadosExemplo } from './dados-exemplo';

/* ============================================================================
   PALETA DE CORES — extraída do PPTX da PC nº 32/2024 (gov.br)
   ============================================================================ */
const C = {
  navy:    '#071D41',
  blue:    '#1351B4',
  blueLt:  '#3DA5E0',
  blueIce: '#CADCFC',
  green:   '#168821',
  yellow:  '#FFCD07',
  red:     '#BC4749',
  purple:  '#7A1A8B',
  ink:     '#1A1A1A',
  text:    '#333333',
  muted:   '#8C8C8C',
  line:    '#E5E7EB',
  bg:      '#FAFAF7',
  card:    '#FFFFFF',
};

/* mapa de cores por programa — usado em chips, donut e tabela */
const programaCores = {
  'MCMV Sub 50':       C.blue,
  'Mobilidade Urbana': C.purple,
  /* fallback: qualquer outro programa cai em C.blueLt */
};
const corPrograma = (p) => programaCores[p] || C.blueLt;

/* ============================================================================
   FORMATADORES
   ============================================================================ */
const fmtBRL = (v) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const fmtBRLcompact = (v) => {
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(2).replace('.', ',')} mi`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)} mil`;
  return fmtBRL(v);
};

const fmtData = (d) => {
  if (!d) return '—';
  const [a, m, dia] = d.split('-');
  return `${dia}/${m}/${a}`;
};

const diasEntre = (d1, d2) =>
  Math.round((new Date(d2) - new Date(d1)) / 86400000);

/* ============================================================================
   FONTES (Google Fonts)
   ============================================================================ */
const fontImport = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..800;1,9..144,300..600&family=Plus+Jakarta+Sans:wght@300..800&family=JetBrains+Mono:wght@400..600&display=swap');
`;

/* ============================================================================
   COMPONENTES AUXILIARES
   ============================================================================ */

/** Faixa colorida (verde-amarelo-azul-vermelho) — topo e rodapé */
function FaixaBandeira() {
  return (
    <div className="flex h-1 w-full">
      <div style={{ background: C.green,  flex: 1 }} />
      <div style={{ background: C.yellow, flex: 1 }} />
      <div style={{ background: C.blue,   flex: 1 }} />
      <div style={{ background: C.red,    flex: 1 }} />
    </div>
  );
}

/** Cartão de KPI */
function KPI({ icon: Icon, label, value, sub, accent = C.blue }) {
  return (
    <div
      className="relative overflow-hidden rounded-sm border bg-white p-7 transition-all hover:shadow-md group"
      style={{ borderColor: C.line }}
    >
      <div
        className="absolute left-0 top-0 h-full w-[3px] transition-all group-hover:w-[6px]"
        style={{ background: accent }}
      />
      <div className="flex items-start justify-between mb-5">
        <span
          className="text-[10px] font-medium tracking-[0.18em] uppercase"
          style={{ color: C.muted, fontFamily: 'Plus Jakarta Sans' }}
        >
          {label}
        </span>
        <Icon size={18} style={{ color: accent }} strokeWidth={1.5} />
      </div>
      <div
        className="font-light leading-none"
        style={{
          fontFamily: 'Fraunces',
          fontSize: '52px',
          color: C.navy,
          fontVariationSettings: '"opsz" 144, "SOFT" 50',
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-3 text-xs" style={{ color: C.muted, fontFamily: 'Plus Jakarta Sans' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/** Título de seção (kicker + título + subtítulo) */
function SectionTitle({ kicker, title, children }) {
  return (
    <div className="mb-6">
      <div
        className="text-[10px] font-semibold tracking-[0.22em] uppercase mb-2"
        style={{ color: C.blue, fontFamily: 'Plus Jakarta Sans' }}
      >
        {kicker}
      </div>
      <h2
        className="text-2xl"
        style={{
          fontFamily: 'Fraunces',
          color: C.navy,
          fontWeight: 400,
          fontVariationSettings: '"opsz" 60',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h2>
      {children && (
        <p className="mt-1 text-sm" style={{ color: C.muted, fontFamily: 'Plus Jakarta Sans' }}>
          {children}
        </p>
      )}
    </div>
  );
}

/** Tooltip customizado para Recharts */
const TooltipBox = ({ active, payload, label, fmt }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="border bg-white px-4 py-3 shadow-lg"
      style={{ borderColor: C.line, fontFamily: 'Plus Jakarta Sans' }}
    >
      <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: C.muted }}>
        {label || payload[0].payload.name || payload[0].payload.uf}
      </div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-3 text-sm" style={{ color: C.text }}>
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span>{p.name}:</span>
          <span className="font-semibold tabular-nums" style={{ color: C.navy }}>
            {fmt ? fmt(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

/** Botão de filtro (toggle) — usado para UF e Programa */
function FilterChip({ active, onClick, color, children }) {
  return (
    <button
      onClick={onClick}
      className="text-[11px] font-medium tracking-wider uppercase px-2.5 py-1 border transition-all"
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

/** Cabeçalho de coluna ordenável */
function SortableTh({ label, field, sortField, sortDir, onSort, align = 'left', children }) {
  const active = sortField === field;
  const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      onClick={() => onSort(field)}
      className="cursor-pointer select-none px-4 py-3 text-[10px] font-semibold tracking-[0.15em] uppercase transition-colors"
      style={{
        color: active ? C.navy : C.muted,
        background: C.bg,
        borderBottom: `1px solid ${C.line}`,
        textAlign: align,
        fontFamily: 'Plus Jakarta Sans',
      }}
    >
      <span className="inline-flex items-center gap-1.5">
        {children || label}
        <Icon size={11} strokeWidth={2} />
      </span>
    </th>
  );
}

/* ============================================================================
   COMPONENTE PRINCIPAL
   ============================================================================ */
export default function DashboardAIO({ dados = dadosExemplo }) {
  /* ---------- estado dos filtros e ordenação ---------- */
  const [busca, setBusca]         = useState('');
  const [filtroUF, setFiltroUF]   = useState([]);   // array vazio = sem filtro
  const [filtroProg, setFiltroProg] = useState([]);
  const [sortField, setSortField] = useState('dataAssinatura');
  const [sortDir, setSortDir]     = useState('desc');
  const [pagina, setPagina]       = useState(1);
  const [selecionado, setSelecionado] = useState(null);
  const POR_PAGINA = 10;

  /* ---------- agregações ---------- */
  const totalInvest  = dados.reduce((s, d) => s + d.valorInvest, 0);
  const totalRepasse = dados.reduce((s, d) => s + d.valorRepasse, 0);
  const ufsUnicas    = useMemo(() => [...new Set(dados.map((d) => d.uf))].sort(), [dados]);
  const programasUnicos = useMemo(
    () => [...new Set(dados.map((d) => d.programaCurto))].sort(),
    [dados]
  );

  const porPrograma = useMemo(
    () => Object.values(
      dados.reduce((acc, d) => {
        acc[d.programaCurto] = acc[d.programaCurto] || {
          name: d.programaCurto, value: 0, valor: 0,
        };
        acc[d.programaCurto].value += 1;
        acc[d.programaCurto].valor += d.valorInvest;
        return acc;
      }, {})
    ),
    [dados]
  );

  const porUF = useMemo(
    () => Object.values(
      dados.reduce((acc, d) => {
        acc[d.uf] = acc[d.uf] || { uf: d.uf, qtd: 0, valor: 0 };
        acc[d.uf].qtd += 1;
        acc[d.uf].valor += d.valorInvest;
        return acc;
      }, {})
    ).sort((a, b) => b.valor - a.valor),
    [dados]
  );

  /* ---------- aplicação de filtros + ordenação ---------- */
  const dadosFiltrados = useMemo(() => {
    let lista = dados.filter((d) => {
      if (filtroUF.length && !filtroUF.includes(d.uf)) return false;
      if (filtroProg.length && !filtroProg.includes(d.programaCurto)) return false;
      if (busca) {
        const b = busca.toLowerCase();
        return (
          d.municipio.toLowerCase().includes(b) ||
          d.recebedor.toLowerCase().includes(b) ||
          d.objeto.toLowerCase().includes(b) ||
          d.tc.includes(b) ||
          d.instrumento.includes(b)
        );
      }
      return true;
    });

    lista.sort((a, b) => {
      const va = a[sortField], vb = b[sortField];
      if (typeof va === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc'
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
    return lista;
  }, [dados, filtroUF, filtroProg, busca, sortField, sortDir]);

  const totalPaginas = Math.max(1, Math.ceil(dadosFiltrados.length / POR_PAGINA));
  const paginaAtual  = Math.min(pagina, totalPaginas);
  const inicio       = (paginaAtual - 1) * POR_PAGINA;
  const dadosPagina  = dadosFiltrados.slice(inicio, inicio + POR_PAGINA);

  const totalFiltradoInvest  = dadosFiltrados.reduce((s, d) => s + d.valorInvest, 0);
  const totalFiltradoRepasse = dadosFiltrados.reduce((s, d) => s + d.valorRepasse, 0);

  /* ---------- handlers ---------- */
  const toggle = (arr, valor) =>
    arr.includes(valor) ? arr.filter((v) => v !== valor) : [...arr, valor];
  const handleSort = (field) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };
  const resetFiltros = () => {
    setBusca(''); setFiltroUF([]); setFiltroProg([]); setPagina(1);
  };
  const filtrosAtivos = busca || filtroUF.length || filtroProg.length;

  /* ========================================================================
     RENDER
     ======================================================================== */
  return (
    <>
      <style>{fontImport}</style>

      <div
        className="min-h-screen w-full"
        style={{
          background: C.bg,
          fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
          color: C.text,
          backgroundImage: `
            radial-gradient(circle at 0% 0%, rgba(19,81,180,0.04) 0%, transparent 40%),
            radial-gradient(circle at 100% 100%, rgba(7,29,65,0.03) 0%, transparent 40%)
          `,
        }}
      >
        <FaixaBandeira />

        {/* ================ HEADER ================ */}
        <header className="border-b" style={{ borderColor: C.line, background: C.card }}>
          <div className="mx-auto max-w-[1280px] px-8 pt-10 pb-8">
            <div className="flex items-start justify-between gap-8">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div
                    className="flex h-9 px-2.5 items-center justify-center"
                    style={{
                      background: C.navy,
                      color: 'white',
                      fontFamily: 'Fraunces',
                      fontWeight: 600,
                      fontSize: 11,
                      letterSpacing: '0.12em',
                    }}
                  >
                    DMP
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="text-[10px] tracking-[0.22em] uppercase font-semibold" style={{ color: C.navy }}>
                      Ministério das Cidades
                    </span>
                    <span className="text-[10px] tracking-[0.18em] uppercase" style={{ color: C.muted }}>
                      DMP · SE · Novo PAC
                    </span>
                  </div>
                </div>

                <h1
                  style={{
                    fontFamily: 'Fraunces',
                    color: C.navy,
                    fontWeight: 300,
                    fontSize: 'clamp(36px, 4.5vw, 56px)',
                    lineHeight: 1.02,
                    letterSpacing: '-0.025em',
                    fontVariationSettings: '"opsz" 144, "SOFT" 100',
                  }}
                >
                  Painel de{' '}
                  <em style={{ fontStyle: 'italic', fontWeight: 400, color: C.blue }}>
                    AIO
                  </em>
                </h1>

                <div className="mt-4 flex items-center gap-6 text-sm" style={{ color: C.muted }}>
                  <span className="flex items-center gap-2">
                    <Clock size={14} strokeWidth={1.5} />
                    Atualizado em {new Date().toLocaleDateString('pt-BR')}
                  </span>
                  <span className="flex items-center gap-2">
                    <Hash size={14} strokeWidth={1.5} />
                    Base: <code style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}>aio_solicitacoes</code>
                  </span>
                </div>
              </div>

              <div className="text-right hidden md:block">
                <div
                  className="inline-flex items-center gap-2 border px-3 py-1.5"
                  style={{ borderColor: C.green, color: C.green, background: 'rgba(22,136,33,0.05)' }}
                >
                  <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: C.green }} />
                  <span className="text-[11px] font-semibold tracking-wider uppercase">
                    Em monitoramento
                  </span>
                </div>
                <div className="mt-3 text-[10px] tracking-[0.18em] uppercase" style={{ color: C.muted }}>
                  Conforme PC nº 32/2024
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ================ KPIs ================ */}
        <section className="mx-auto max-w-[1280px] px-8 py-10">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KPI
              icon={FileSignature}
              label="Solicitações AIO"
              value={String(dados.length).padStart(2, '0')}
              sub="Termos de Compromisso pendentes de análise"
              accent={C.blue}
            />
            <KPI
              icon={Wallet}
              label="Investimento Total"
              value={fmtBRLcompact(totalInvest)}
              sub={`Repasse de ${fmtBRLcompact(totalRepasse)} (${((totalRepasse / totalInvest) * 100).toFixed(0)}%)`}
              accent={C.green}
            />
            <KPI
              icon={MapPin}
              label="UFs Atendidas"
              value={String(ufsUnicas.length).padStart(2, '0')}
              sub={ufsUnicas.join(' · ')}
              accent={C.yellow}
            />
            <KPI
              icon={Layers}
              label="Programas"
              value={String(porPrograma.length).padStart(2, '0')}
              sub={programasUnicos.join(' · ')}
              accent={C.purple}
            />
          </div>
        </section>

        {/* ================ GRÁFICOS ================ */}
        <section className="mx-auto max-w-[1280px] px-8 pb-10">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="lg:col-span-2 border bg-white p-8" style={{ borderColor: C.line }}>
              <SectionTitle kicker="01 · Distribuição" title="Por programa">
                Volume financeiro por linha de atuação
              </SectionTitle>

              <div style={{ height: 240 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={porPrograma} dataKey="valor" nameKey="name"
                      cx="50%" cy="50%" innerRadius={62} outerRadius={95}
                      paddingAngle={2} stroke="none"
                    >
                      {porPrograma.map((entry, i) => (
                        <Cell key={i} fill={corPrograma(entry.name)} />
                      ))}
                    </Pie>
                    <Tooltip content={<TooltipBox fmt={fmtBRL} />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 space-y-3">
                {porPrograma.map((p) => (
                  <div key={p.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-1" style={{ background: corPrograma(p.name) }} />
                      <span style={{ color: C.text }}>{p.name}</span>
                      <span className="text-[10px] tabular-nums px-1.5 py-0.5"
                            style={{ color: C.muted, background: C.bg }}>
                        {p.value} {p.value === 1 ? 'TC' : 'TCs'}
                      </span>
                    </div>
                    <span className="tabular-nums font-semibold"
                          style={{ color: C.navy, fontFamily: 'Fraunces', fontVariationSettings: '"opsz" 60' }}>
                      {fmtBRLcompact(p.valor)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-3 border bg-white p-8" style={{ borderColor: C.line }}>
              <SectionTitle kicker="02 · Geografia" title="Por unidade federativa">
                Investimento agregado por estado
              </SectionTitle>

              <div style={{ height: 280 }}>
                <ResponsiveContainer>
                  <BarChart
                    data={porUF} layout="vertical"
                    margin={{ top: 10, right: 80, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid horizontal={false} stroke={C.line} />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => `R$ ${(v / 1e6).toFixed(1)}M`}
                      stroke={C.muted}
                      tick={{ fontSize: 11, fontFamily: 'Plus Jakarta Sans' }}
                      tickLine={false} axisLine={{ stroke: C.line }}
                    />
                    <YAxis
                      type="category" dataKey="uf" stroke={C.navy}
                      tick={{ fontSize: 14, fontFamily: 'Fraunces', fontWeight: 500 }}
                      tickLine={false} axisLine={false} width={40}
                    />
                    <Tooltip cursor={{ fill: 'rgba(19,81,180,0.05)' }} content={<TooltipBox fmt={fmtBRL} />} />
                    <Bar dataKey="valor" name="Investimento" radius={[0, 2, 2, 0]} barSize={26}>
                      {porUF.map((entry, i) => (
                        <Cell key={i} fill={i === 0 ? C.navy : C.blue} fillOpacity={1 - i * 0.12} />
                      ))}
                      <LabelList
                        dataKey="valor" position="right"
                        formatter={(v) => fmtBRLcompact(v)}
                        style={{ fill: C.navy, fontSize: 12, fontWeight: 600, fontFamily: 'Plus Jakarta Sans' }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        {/* ================ CARDS DETALHADOS ================ */}
        <section className="mx-auto max-w-[1280px] px-8 pb-10">
          <SectionTitle kicker="03 · Detalhamento" title="Termos de Compromisso">
            Clique em um cartão para inspecionar
          </SectionTitle>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {dados.map((d) => {
              const isOpen = selecionado === d.id;
              const repassePct = (d.valorRepasse / d.valorInvest) * 100;
              const diasSuspensiva = diasEntre(d.dataAssinatura, d.dataSuspensiva);

              return (
                <article
                  key={d.id}
                  onClick={() => setSelecionado(isOpen ? null : d.id)}
                  className="cursor-pointer border bg-white transition-all hover:shadow-md"
                  style={{
                    borderColor: isOpen ? C.navy : C.line,
                    borderLeftWidth: isOpen ? 3 : 1,
                  }}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="text-[10px] px-2 py-0.5 font-semibold tracking-wider"
                            style={{
                              color: corPrograma(d.programaCurto),
                              background: `${corPrograma(d.programaCurto)}12`,
                            }}
                          >
                            {d.programaCurto.toUpperCase()}
                          </span>
                          <span className="text-[10px] tabular-nums" style={{ color: C.muted }}>
                            TC <code style={{ fontFamily: 'JetBrains Mono' }}>{d.tc}</code>
                          </span>
                        </div>
                        <h3
                          className="leading-tight"
                          style={{
                            fontFamily: 'Fraunces', color: C.navy,
                            fontSize: 22, fontWeight: 400,
                            fontVariationSettings: '"opsz" 60',
                            letterSpacing: '-0.01em',
                          }}
                        >
                          {d.municipio}
                          <span style={{ color: C.muted, fontWeight: 300 }}> / {d.uf}</span>
                        </h3>
                        <p className="mt-1 text-xs" style={{ color: C.muted }}>
                          {d.recebedor}
                        </p>
                      </div>
                      <ChevronRight
                        size={20} strokeWidth={1.5}
                        style={{
                          color: C.muted, transition: 'transform 200ms',
                          transform: isOpen ? 'rotate(90deg)' : 'none', flexShrink: 0,
                        }}
                      />
                    </div>

                    <p className="text-sm leading-relaxed pb-4 border-b"
                       style={{ color: C.text, borderColor: C.line }}>
                      {d.objeto}
                    </p>

                    <div className="grid grid-cols-2 gap-4 pt-4">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: C.muted }}>
                          Investimento
                        </div>
                        <div className="tabular-nums"
                             style={{ fontFamily: 'Fraunces', fontSize: 22, color: C.navy, fontWeight: 400 }}>
                          {fmtBRLcompact(d.valorInvest)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: C.muted }}>
                          Repasse União
                        </div>
                        <div className="tabular-nums flex items-baseline gap-2"
                             style={{ fontFamily: 'Fraunces', fontSize: 22, color: C.green, fontWeight: 400 }}>
                          {fmtBRLcompact(d.valorRepasse)}
                          <span className="text-[10px] tabular-nums"
                                style={{ color: C.muted, fontFamily: 'Plus Jakarta Sans' }}>
                            {repassePct.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="mt-5 pt-5 border-t space-y-3" style={{ borderColor: C.line }}>
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-2" style={{ color: C.muted }}>
                            <Calendar size={13} strokeWidth={1.5} /> Assinatura
                          </span>
                          <span style={{ color: C.text }} className="tabular-nums">{fmtData(d.dataAssinatura)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-2" style={{ color: C.muted }}>
                            <Calendar size={13} strokeWidth={1.5} /> Retirada da suspensiva
                          </span>
                          <span style={{ color: C.text }} className="tabular-nums">
                            {fmtData(d.dataSuspensiva)}
                            <span
                              className="ml-2 text-[10px] px-1.5 py-0.5"
                              style={{
                                color: diasSuspensiva <= 30 ? C.green : C.red,
                                background: diasSuspensiva <= 30 ? `${C.green}12` : `${C.red}12`,
                              }}
                            >
                              {diasSuspensiva}d
                            </span>
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-2" style={{ color: C.muted }}>
                            <Calendar size={13} strokeWidth={1.5} /> Vigência
                          </span>
                          <span style={{ color: C.text }} className="tabular-nums">{fmtData(d.dataVigencia)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-2" style={{ color: C.muted }}>
                            <Hash size={13} strokeWidth={1.5} /> Ação orçamentária
                          </span>
                          <code style={{ color: C.text, fontFamily: 'JetBrains Mono', fontSize: 12, background: C.bg, padding: '2px 6px' }}>
                            {d.acao}
                          </code>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-2" style={{ color: C.muted }}>
                            <Hash size={13} strokeWidth={1.5} /> Instrumento
                          </span>
                          <code style={{ color: C.text, fontFamily: 'JetBrains Mono', fontSize: 12, background: C.bg, padding: '2px 6px' }}>
                            {d.instrumento}
                          </code>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ================ TABELA COM FILTROS ================ */}
        <section className="mx-auto max-w-[1280px] px-8 pb-16">
          <SectionTitle kicker="04 · Consulta avançada" title="Tabela de solicitações">
            Filtre, ordene e explore o conjunto completo
          </SectionTitle>

          <div className="border bg-white" style={{ borderColor: C.line }}>
            {/* BARRA DE FILTROS */}
            <div className="border-b p-5 space-y-4" style={{ borderColor: C.line }}>
              {/* linha 1: busca + reset */}
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="relative flex-1">
                  <Search
                    size={15} strokeWidth={1.5}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: C.muted }}
                  />
                  <input
                    type="text" value={busca}
                    onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
                    placeholder="Buscar por município, recebedor, objeto, TC ou instrumento..."
                    className="w-full border pl-9 pr-9 py-2 text-sm outline-none transition-colors focus:border-current"
                    style={{ borderColor: C.line, color: C.text, fontFamily: 'Plus Jakarta Sans' }}
                  />
                  {busca && (
                    <button
                      onClick={() => setBusca('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: C.muted }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs tabular-nums" style={{ color: C.muted }}>
                    <span style={{ color: C.navy, fontWeight: 600 }}>
                      {dadosFiltrados.length}
                    </span>
                    {' '}de {dados.length} solicitações
                  </span>
                  {filtrosAtivos && (
                    <button
                      onClick={resetFiltros}
                      className="text-[11px] font-medium tracking-wider uppercase px-2.5 py-1 border transition-all hover:bg-red-50"
                      style={{ color: C.red, borderColor: C.red, fontFamily: 'Plus Jakarta Sans' }}
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>

              {/* linha 2: chips de filtro */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter size={12} strokeWidth={1.5} style={{ color: C.muted }} />
                  <span className="text-[10px] tracking-[0.18em] uppercase" style={{ color: C.muted }}>
                    UF
                  </span>
                  {ufsUnicas.map((uf) => (
                    <FilterChip
                      key={uf}
                      active={filtroUF.includes(uf)}
                      color={C.blue}
                      onClick={() => { setFiltroUF(toggle(filtroUF, uf)); setPagina(1); }}
                    >
                      {uf}
                    </FilterChip>
                  ))}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] tracking-[0.18em] uppercase" style={{ color: C.muted }}>
                    Programa
                  </span>
                  {programasUnicos.map((p) => (
                    <FilterChip
                      key={p}
                      active={filtroProg.includes(p)}
                      color={corPrograma(p)}
                      onClick={() => { setFiltroProg(toggle(filtroProg, p)); setPagina(1); }}
                    >
                      {p}
                    </FilterChip>
                  ))}
                </div>
              </div>
            </div>

            {/* TABELA */}
            <div className="overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <SortableTh field="municipio" sortField={sortField} sortDir={sortDir} onSort={handleSort}>
                      Município / UF
                    </SortableTh>
                    <SortableTh field="programaCurto" sortField={sortField} sortDir={sortDir} onSort={handleSort}>
                      Programa
                    </SortableTh>
                    <SortableTh field="valorInvest" align="right" sortField={sortField} sortDir={sortDir} onSort={handleSort}>
                      Investimento
                    </SortableTh>
                    <SortableTh field="valorRepasse" align="right" sortField={sortField} sortDir={sortDir} onSort={handleSort}>
                      Repasse
                    </SortableTh>
                    <SortableTh field="dataAIO" sortField={sortField} sortDir={sortDir} onSort={handleSort}>
                      Chegada AIO
                    </SortableTh>
                    <SortableTh field="dataAssinatura" sortField={sortField} sortDir={sortDir} onSort={handleSort}>
                      Assinatura
                    </SortableTh>
                    <SortableTh field="dataVigencia" sortField={sortField} sortDir={sortDir} onSort={handleSort}>
                      Vigência
                    </SortableTh>
                    <SortableTh field="tc" align="right" sortField={sortField} sortDir={sortDir} onSort={handleSort}>
                      TC
                    </SortableTh>
                  </tr>
                </thead>
                <tbody>
                  {dadosPagina.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: C.muted }}>
                        Nenhum resultado encontrado com os filtros aplicados.
                      </td>
                    </tr>
                  )}
                  {dadosPagina.map((d, i) => (
                    <tr
                      key={d.id}
                      className="transition-colors hover:bg-slate-50 cursor-pointer"
                      onClick={() => setSelecionado(d.id)}
                      style={{ background: i % 2 === 1 ? 'rgba(0,0,0,0.012)' : 'transparent' }}
                    >
                      <td className="px-4 py-3.5 border-b" style={{ borderColor: C.line }}>
                        <div className="font-medium" style={{ color: C.navy, fontFamily: 'Fraunces', fontSize: 15 }}>
                          {d.municipio}
                          <span style={{ color: C.muted, fontWeight: 300 }}> / {d.uf}</span>
                        </div>
                        <div className="text-[11px] mt-0.5 truncate max-w-[280px]" style={{ color: C.muted }}>
                          {d.recebedor}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 border-b" style={{ borderColor: C.line }}>
                        <span
                          className="inline-block text-[10px] px-2 py-0.5 font-semibold tracking-wider whitespace-nowrap"
                          style={{
                            color: corPrograma(d.programaCurto),
                            background: `${corPrograma(d.programaCurto)}12`,
                          }}
                        >
                          {d.programaCurto.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 border-b text-right tabular-nums"
                          style={{ borderColor: C.line, color: C.navy, fontWeight: 600 }}>
                        {fmtBRLcompact(d.valorInvest)}
                      </td>
                      <td className="px-4 py-3.5 border-b text-right tabular-nums"
                          style={{ borderColor: C.line, color: C.green }}>
                        {fmtBRLcompact(d.valorRepasse)}
                      </td>
                      <td className="px-4 py-3.5 border-b tabular-nums text-sm"
                          style={{ borderColor: C.line, color: C.blue, fontWeight: 500 }}>
                        {fmtData(d.dataAIO)}
                      </td>
                      <td className="px-4 py-3.5 border-b tabular-nums text-sm"
                          style={{ borderColor: C.line, color: C.text }}>
                        {fmtData(d.dataAssinatura)}
                      </td>
                      <td className="px-4 py-3.5 border-b tabular-nums text-sm"
                          style={{ borderColor: C.line, color: C.text }}>
                        {fmtData(d.dataVigencia)}
                      </td>
                      <td className="px-4 py-3.5 border-b text-right" style={{ borderColor: C.line }}>
                        <code style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: C.muted }}>
                          {d.tc}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {dadosPagina.length > 0 && (
                  <tfoot>
                    <tr style={{ background: C.bg }}>
                      <td colSpan={2} className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold"
                          style={{ color: C.muted }}>
                        Total {filtrosAtivos ? '(filtrado)' : ''}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold"
                          style={{ color: C.navy, fontFamily: 'Fraunces' }}>
                        {fmtBRLcompact(totalFiltradoInvest)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold"
                          style={{ color: C.green, fontFamily: 'Fraunces' }}>
                        {fmtBRLcompact(totalFiltradoRepasse)}
                      </td>
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* PAGINAÇÃO */}
            {totalPaginas > 1 && (
              <div className="border-t flex items-center justify-between px-5 py-3" style={{ borderColor: C.line }}>
                <span className="text-xs" style={{ color: C.muted }}>
                  Página {paginaAtual} de {totalPaginas}
                  {' · '}
                  <span className="tabular-nums">
                    {inicio + 1}–{Math.min(inicio + POR_PAGINA, dadosFiltrados.length)}
                  </span>
                  {' de '}
                  <span className="tabular-nums">{dadosFiltrados.length}</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPagina(Math.max(1, paginaAtual - 1))}
                    disabled={paginaAtual === 1}
                    className="border p-1.5 transition-colors disabled:opacity-30"
                    style={{ borderColor: C.line, color: C.text }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => setPagina(Math.min(totalPaginas, paginaAtual + 1))}
                    disabled={paginaAtual === totalPaginas}
                    className="border p-1.5 transition-colors disabled:opacity-30"
                    style={{ borderColor: C.line, color: C.text }}
                  >
                    <ChevRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ================ FOOTER ================ */}
        <footer className="border-t mt-8" style={{ borderColor: C.line, background: C.navy }}>
          <div className="mx-auto max-w-[1280px] px-8 py-8">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                <div className="text-[10px] tracking-[0.22em] uppercase font-semibold mb-2" style={{ color: C.yellow }}>
                  Ministério das Cidades
                </div>
                <div className="text-2xl"
                     style={{ fontFamily: 'Fraunces', color: 'white', fontWeight: 300, fontVariationSettings: '"opsz" 60' }}>
                  Diretoria de Monitoramento de Programas
                </div>
                <div className="text-xs mt-1" style={{ color: C.blueIce }}>
                  DMP · SE · Novo PAC
                </div>
              </div>
              <div className="text-xs flex items-center gap-2"
                   style={{ color: C.blueIce, fontFamily: 'JetBrains Mono' }}>
                <ArrowUpRight size={12} />
                gerado em {new Date().toLocaleDateString('pt-BR')}
              </div>
            </div>
          </div>
          <FaixaBandeira />
        </footer>
      </div>
    </>
  );
}
