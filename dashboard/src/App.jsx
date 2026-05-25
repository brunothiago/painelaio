/**
 * App.jsx — carrega o CSV gerado pelo pipeline Python e exibe o dashboard.
 *
 * Fluxo de dados:
 *   aio_pipeline.py → PostgreSQL → exportar_csv.py → public/aio_solicitacoes.csv → aqui
 */
import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';
import DashboardAIO from './DashboardAIO';
import { mapearLinhasAIO } from './mapeador';
import { dadosExemplo, linhasBrutasExemplo } from './dados-exemplo';

const CSV_BASE = `${import.meta.env.BASE_URL}aio_solicitacoes.csv`;

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

export default function App() {
  const [dados, setDados] = useState([]);
  const [linhasBrutas, setLinhasBrutas] = useState([]);
  const [fonte, setFonte] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarregando(true);
      setErro(null);

      const url = `${CSV_BASE}?v=${Date.now()}`;

      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const text = await res.text();
        const linhas = await parseCsvText(text);

        if (cancelado) return;

        if (linhas.length === 0) {
          setErro('CSV vazio — rode: python3 exportar_csv.py');
          setFonte('exemplo');
          setDados(dadosExemplo);
          setLinhasBrutas(linhasBrutasExemplo);
          return;
        }

        setLinhasBrutas(linhas);
        setDados(mapearLinhasAIO(linhas));
        setFonte('csv');
      } catch (e) {
        if (cancelado) return;
        setErro(`Não foi possível ler ${CSV_BASE} (${e.message})`);
        setFonte('exemplo');
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
          Dados carregados de aio_solicitacoes.csv ({dados.length} registros)
        </div>
      )}
      <DashboardAIO
        dados={dados.length ? dados : dadosExemplo}
        linhasBrutas={linhasBrutas.length ? linhasBrutas : linhasBrutasExemplo}
      />
    </>
  );
}
