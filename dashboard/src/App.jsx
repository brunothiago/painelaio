/**
 * App.jsx — carrega o CSV gerado pelo pipeline Python e exibe o dashboard.
 *
 * Fluxo de dados:
 *   aio_pipeline.py → PostgreSQL → exportar_csv.py → public/aio_solicitacoes.csv → aqui
 *
 * Usa duas fontes e fica com a que tiver mais registros (evita CSV antigo em cache no Pages).
 */
import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';
import DashboardAIO from './DashboardAIO';
import { mapearLinhasAIO } from './mapeador';
import { dadosExemplo, linhasBrutasExemplo } from './dados-exemplo';

const CSV_BASE = `${import.meta.env.BASE_URL}aio_solicitacoes.csv`;
const CSV_GITHUB_RAW =
  'https://raw.githubusercontent.com/brunothiago/painelaio/main/dashboard/public/aio_solicitacoes.csv';

function parseCsvText(text) {
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        if (res.errors?.length) {
          reject(new Error(res.errors[0]?.message || 'Erro ao interpretar CSV'));
          return;
        }
        const linhas = (res.data || []).filter((r) => r.id || r.instrumento);
        resolve(linhas);
      },
      error: (err) => reject(err),
    });
  });
}

/** Tenta várias URLs e retorna a que tiver mais linhas de dados */
async function carregarMelhorCsv() {
  const urls = [
    { id: 'site', url: `${CSV_BASE}?v=${Date.now()}` },
    { id: 'github', url: `${CSV_GITHUB_RAW}?v=${Date.now()}` },
  ];

  let melhor = { id: null, linhas: [] };

  for (const { id, url } of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const linhas = await parseCsvText(await res.text());
      if (linhas.length > melhor.linhas.length) {
        melhor = { id, linhas };
      }
    } catch {
      /* tenta próxima fonte */
    }
  }

  if (melhor.linhas.length === 0) {
    throw new Error('Não foi possível carregar aio_solicitacoes.csv');
  }
  return melhor;
}

export default function App() {
  const [dados, setDados] = useState([]);
  const [linhasBrutas, setLinhasBrutas] = useState([]);
  const [fonte, setFonte] = useState(null);
  const [fonteCsv, setFonteCsv] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarregando(true);
      setErro(null);

      try {
        const { id, linhas } = await carregarMelhorCsv();
        if (cancelado) return;

        setLinhasBrutas(linhas);
        setDados(mapearLinhasAIO(linhas));
        setFonte('csv');
        setFonteCsv(id === 'github' ? 'GitHub (atualizado)' : 'site');
      } catch (e) {
        if (cancelado) return;
        setErro(e.message);
        setFonte('exemplo');
        setFonteCsv(null);
        setDados(dadosExemplo);
        setLinhasBrutas(linhasBrutasExemplo);
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, []);

  if (carregando) {
    return (
      <div
        style={{
          minHeight: '40vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
          color: '#071D41',
        }}
      >
        Carregando solicitações AIO…
      </div>
    );
  }

  return (
    <>
      {erro && (
        <div
          style={{
            background: '#FFF3CD',
            color: '#664D03',
            padding: '8px 16px',
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          {erro} — exibindo dados de exemplo ({dadosExemplo.length} registros).
        </div>
      )}
      {fonte === 'csv' && (
        <div
          style={{
            background: '#D1E7DD',
            color: '#0F5132',
            padding: '6px 16px',
            fontSize: 12,
            textAlign: 'center',
          }}
        >
          Dados carregados ({dados.length} registros)
          {fonteCsv && (
            <span style={{ opacity: 0.85 }}> — fonte: {fonteCsv}</span>
          )}
        </div>
      )}
      <DashboardAIO
        dados={dados.length ? dados : dadosExemplo}
        linhasBrutas={linhasBrutas.length ? linhasBrutas : linhasBrutasExemplo}
      />
    </>
  );
}
