/**
 * Semana ISO do ano com base na data de chegada do AIO (dataAIO / data_aio_recebido).
 */

/** Retorna { isoYear, week, key: '2026-W21' } ou null */
export function semanaAioKey(dataAIO) {
  if (!dataAIO) return null;
  const date = new Date(`${String(dataAIO).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const week = 1 + Math.ceil((firstThursday - target) / 604800000);
  const isoYear = new Date(firstThursday).getFullYear();
  return {
    isoYear,
    week,
    key: `${isoYear}-W${String(week).padStart(2, '0')}`,
  };
}

/** Início (segunda) e fim (domingo) da semana ISO */
function intervaloSemanaISO(isoYear, week) {
  const simple = new Date(isoYear, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const monday = new Date(simple);
  if (dow <= 4) monday.setDate(simple.getDate() - simple.getDay() + 1);
  else monday.setDate(simple.getDate() + 8 - simple.getDay());
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
}

const fmtCurto = (d) =>
  d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

/** Lista semanas presentes nos dados, mais recente primeiro */
export function listarSemanasOpcoes(dados) {
  const map = new Map();

  for (const d of dados) {
    const info = semanaAioKey(d.dataAIO);
    if (!info) continue;
    if (!map.has(info.key)) {
      const { monday, sunday } = intervaloSemanaISO(info.isoYear, info.week);
      map.set(info.key, {
        key: info.key,
        isoYear: info.isoYear,
        week: info.week,
        label: `Semana ${info.week} · ${info.isoYear}`,
        intervalo: `${fmtCurto(monday)} – ${fmtCurto(sunday)}`,
        qtd: 0,
      });
    }
    map.get(info.key).qtd += 1;
  }

  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
}
