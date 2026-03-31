'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// ─── helpers ───────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (n == null || isNaN(Number(n))) return '—';
  n = Number(n);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.0', '') + 'K';
  return n.toLocaleString('pt-BR');
};

const delta = (before, after) => {
  if (!before || before === 0) return null;
  return ((after - before) / before * 100).toFixed(1);
};

// ─── sub-components ────────────────────────────────────────────────────────
function DeltaBadge({ before, after }) {
  const d = delta(before, after);
  if (d === null) return <span style={{ color: '#bbb', fontSize: 11 }}>—</span>;
  const pos = Number(d) >= 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      background: pos ? 'rgba(22,163,74,.1)' : 'rgba(232,57,42,.1)',
      color: pos ? '#16a34a' : '#E8392A',
      padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
    }}>
      {pos ? '↑' : '↓'} {Math.abs(d)}%
    </span>
  );
}

function KpiCard({ icon, label, antes, depois, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
      <div style={{ fontSize: 18, marginBottom: 8 }}>{icon}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 9, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Antes</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#ccc', fontFamily: 'monospace', letterSpacing: -0.5 }}>{fmt(antes)}</div>
        </div>
        <div style={{ fontSize: 14, color: '#ddd', paddingBottom: 3 }}>→</div>
        <div>
          <div style={{ fontSize: 9, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Depois</div>
          <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: 'monospace', letterSpacing: -0.5 }}>{fmt(depois)}</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#888', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <DeltaBadge before={antes} after={depois} />
    </div>
  );
}

// ─── main report ───────────────────────────────────────────────────────────
function ReportContent() {
  const params = useSearchParams();
  const op = params.get('op') || '';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [genDate] = useState(() => new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }));

  useEffect(() => {
    if (!op) { setLoading(false); return; }
    fetch(`/api/email-report?operadora_name=${encodeURIComponent(op)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [op]);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #eee', borderTopColor: '#E8392A', borderRadius: '50%', animation: 'sp .8s linear infinite', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 14, color: '#888' }}>Carregando relatório mensal...</div>
        <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  if (!op || error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
      <div style={{ textAlign: 'center', color: '#888', fontSize: 14 }}>
        {error || 'Parâmetro operadora ausente. Abra pelo dashboard.'}
      </div>
    </div>
  );

  const { devsWithMetrics = [], depoisLabel } = data;

  // Totals across all devs
  const totals = devsWithMetrics.reduce((acc, d) => ({
    acAntes: acc.acAntes + d.metrics.acessos.antes,
    acDepois: acc.acDepois + d.metrics.acessos.depois,
    lpAntes: acc.lpAntes + d.metrics.lps.antes,
    lpDepois: acc.lpDepois + d.metrics.lps.depois,
    imAntes: acc.imAntes + d.metrics.imob.antes,
    imDepois: acc.imDepois + d.metrics.imob.depois,
  }), { acAntes: 0, acDepois: 0, lpAntes: 0, lpDepois: 0, imAntes: 0, imDepois: 0 });

  return (
    <div style={{ background: '#f7f7f7', minHeight: '100vh', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" }}>

      {/* ── Print button (hidden on print) ── */}
      <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, zIndex: 99, display: 'flex', gap: 8 }}>
        <button onClick={() => window.print()}
          style={{ padding: '10px 20px', background: '#E8392A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 16px rgba(232,57,42,.25)' }}>
          ⬇ Salvar PDF
        </button>
        <button onClick={() => window.close()}
          style={{ padding: '10px 16px', background: '#fff', color: '#555', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
          ✕
        </button>
      </div>

      {/* ── A4 page ── */}
      <div className="page" style={{ maxWidth: 794, margin: '0 auto', paddingBottom: 40 }}>

        {/* ── HEADER ── */}
        <div style={{ background: '#111', color: '#fff', padding: '32px 40px 28px', borderRadius: '0 0 16px 16px', marginBottom: 28, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: 280, height: '100%', background: 'linear-gradient(135deg, transparent, rgba(232,57,42,.12))', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, background: '#E8392A', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>DW</div>
                <div style={{ fontSize: 13, color: '#888', fontWeight: 500 }}>DWV Parcerias · Relatório Mensal de Parcerias</div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.8, lineHeight: 1.2, marginBottom: 8 }}>{op}</div>
              <div style={{ fontSize: 13, color: '#888' }}>
                <span style={{ color: '#555' }}>Mês de referência: </span>
                <span style={{ color: '#E8392A', fontWeight: 700, fontFamily: 'monospace' }}>{depoisLabel}</span>
                <span style={{ marginLeft: 20, color: '#555' }}>{devsWithMetrics.length} incorporadora{devsWithMetrics.length !== 1 ? 's' : ''} na carteira</span>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 20 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Gerado em</div>
              <div style={{ fontSize: 13, color: '#aaa', fontFamily: 'monospace' }}>{genDate}</div>
            </div>
          </div>
        </div>

        <div style={{ padding: '0 20px' }}>

          {/* ── TOTALS ── */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Consolidado da carteira</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <KpiCard icon="📈" label="Acessos totais" antes={totals.acAntes} depois={totals.acDepois} color="#E8392A" />
              <KpiCard icon="🔗" label="LPs geradas" antes={totals.lpAntes} depois={totals.lpDepois} color="#3b82f6" />
              <KpiCard icon="🏬" label="Imobiliárias" antes={totals.imAntes} depois={totals.imDepois} color="#f59e0b" />
            </div>
          </div>

          {/* ── TABELA COMPLETA ── */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Detalhamento por incorporadora</div>
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={{ ...thStyle, textAlign: 'left', width: 180 }}>Incorporadora</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Marco</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Ref. ANTES</th>
                      <th colSpan={3} style={{ ...thStyle, textAlign: 'center', background: 'rgba(232,57,42,.04)', borderBottom: '2px solid rgba(232,57,42,.15)' }}>
                        📈 Acessos
                      </th>
                      <th colSpan={3} style={{ ...thStyle, textAlign: 'center', background: 'rgba(59,130,246,.04)', borderBottom: '2px solid rgba(59,130,246,.15)' }}>
                        🔗 LPs geradas
                      </th>
                      <th colSpan={3} style={{ ...thStyle, textAlign: 'center', background: 'rgba(245,158,11,.04)', borderBottom: '2px solid rgba(245,158,11,.15)' }}>
                        🏬 Imobiliárias
                      </th>
                    </tr>
                    <tr style={{ background: '#fafafa', borderBottom: '1px solid #eee' }}>
                      <th style={thStyle2} />
                      <th style={thStyle2} />
                      <th style={thStyle2} />
                      <th style={{ ...thStyle2, color: '#bbb' }}>Antes</th>
                      <th style={{ ...thStyle2, color: '#E8392A' }}>Depois</th>
                      <th style={{ ...thStyle2 }}>Δ</th>
                      <th style={{ ...thStyle2, color: '#bbb' }}>Antes</th>
                      <th style={{ ...thStyle2, color: '#3b82f6' }}>Depois</th>
                      <th style={{ ...thStyle2 }}>Δ</th>
                      <th style={{ ...thStyle2, color: '#bbb' }}>Antes</th>
                      <th style={{ ...thStyle2, color: '#f59e0b' }}>Depois</th>
                      <th style={{ ...thStyle2 }}>Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devsWithMetrics.map((dev, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f5f5f5', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '11px 14px', fontWeight: 600, color: '#111', fontSize: 12 }}>{dev.label}</td>
                        <td style={{ padding: '11px 14px', color: '#888', fontFamily: 'monospace', fontSize: 10, whiteSpace: 'nowrap' }}>
                          {dev.startDate ? new Date(dev.startDate + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td style={{ padding: '11px 14px', color: '#aaa', fontFamily: 'monospace', fontSize: 10, whiteSpace: 'nowrap' }}>{dev.antesLabel}</td>
                        {/* Acessos */}
                        <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#bbb', fontSize: 11 }}>{fmt(dev.metrics.acessos.antes)}</td>
                        <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#E8392A', fontWeight: 700, fontSize: 11 }}>{fmt(dev.metrics.acessos.depois)}</td>
                        <td style={{ padding: '11px 14px', textAlign: 'center' }}><DeltaBadge before={dev.metrics.acessos.antes} after={dev.metrics.acessos.depois} /></td>
                        {/* LPs */}
                        <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#bbb', fontSize: 11 }}>{fmt(dev.metrics.lps.antes)}</td>
                        <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#3b82f6', fontWeight: 700, fontSize: 11 }}>{fmt(dev.metrics.lps.depois)}</td>
                        <td style={{ padding: '11px 14px', textAlign: 'center' }}><DeltaBadge before={dev.metrics.lps.antes} after={dev.metrics.lps.depois} /></td>
                        {/* Imob */}
                        <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#bbb', fontSize: 11 }}>{fmt(dev.metrics.imob.antes)}</td>
                        <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#f59e0b', fontWeight: 700, fontSize: 11 }}>{fmt(dev.metrics.imob.depois)}</td>
                        <td style={{ padding: '11px 14px', textAlign: 'center' }}><DeltaBadge before={dev.metrics.imob.antes} after={dev.metrics.imob.depois} /></td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr style={{ background: '#f5f5f5', borderTop: '2px solid #e5e5e5' }}>
                      <td colSpan={3} style={{ padding: '11px 14px', fontWeight: 700, color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total</td>
                      <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#bbb', fontWeight: 700, fontSize: 11 }}>{fmt(totals.acAntes)}</td>
                      <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#E8392A', fontWeight: 700, fontSize: 11 }}>{fmt(totals.acDepois)}</td>
                      <td style={{ padding: '11px 14px', textAlign: 'center' }}><DeltaBadge before={totals.acAntes} after={totals.acDepois} /></td>
                      <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#bbb', fontWeight: 700, fontSize: 11 }}>{fmt(totals.lpAntes)}</td>
                      <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#3b82f6', fontWeight: 700, fontSize: 11 }}>{fmt(totals.lpDepois)}</td>
                      <td style={{ padding: '11px 14px', textAlign: 'center' }}><DeltaBadge before={totals.lpAntes} after={totals.lpDepois} /></td>
                      <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#bbb', fontWeight: 700, fontSize: 11 }}>{fmt(totals.imAntes)}</td>
                      <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#f59e0b', fontWeight: 700, fontSize: 11 }}>{fmt(totals.imDepois)}</td>
                      <td style={{ padding: '11px 14px', textAlign: 'center' }}><DeltaBadge before={totals.imAntes} after={totals.imDepois} /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── CARDS POR INCORPORADORA ── */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Comparativo individual</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {devsWithMetrics.map((dev, i) => (
                <div key={i} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{dev.label}</div>
                    <div style={{ fontSize: 10, color: '#aaa', fontFamily: 'monospace' }}>
                      ANTES: {dev.antesLabel} · DEPOIS: {depoisLabel}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {[
                      { label: 'Acessos', antes: dev.metrics.acessos.antes, depois: dev.metrics.acessos.depois, color: '#E8392A' },
                      { label: 'LPs', antes: dev.metrics.lps.antes, depois: dev.metrics.lps.depois, color: '#3b82f6' },
                      { label: 'Imobs', antes: dev.metrics.imob.antes, depois: dev.metrics.imob.depois, color: '#f59e0b' },
                    ].map((m, j) => {
                      const d = delta(m.antes, m.depois);
                      const pos = d !== null && Number(d) >= 0;
                      return (
                        <div key={j} style={{ background: '#fafafa', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ fontSize: 9, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{m.label}</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: m.color, fontFamily: 'monospace', letterSpacing: -0.5 }}>{fmt(m.depois)}</div>
                          <div style={{ fontSize: 9, color: '#ccc', marginTop: 2 }}>antes: {fmt(m.antes)}</div>
                          {d !== null && (
                            <div style={{ fontSize: 10, fontWeight: 700, color: pos ? '#16a34a' : '#E8392A', fontFamily: 'monospace', marginTop: 4 }}>
                              {pos ? '↑' : '↓'} {Math.abs(d)}%
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── FOOTER ── */}
          <div style={{ borderTop: '1px solid #eee', paddingTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, background: '#E8392A', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10, color: '#fff' }}>DW</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#222' }}>DWV Parcerias</div>
                <div style={{ fontSize: 10, color: '#aaa' }}>Relatório gerado em {genDate}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: '#ccc', fontFamily: 'monospace' }}>dwvapp.com.br</div>
              <div style={{ fontSize: 10, color: '#ddd', marginTop: 2 }}>Referência: {depoisLabel}</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #f0f0f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
        @media print {
          @page { size: A4 landscape; margin: 10mm 8mm; }
          body { background: white; }
          .no-print { display: none !important; }
          .page { max-width: 100%; padding: 0; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}

const thStyle = {
  padding: '10px 14px',
  color: '#888',
  fontWeight: 600,
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  borderBottom: '1px solid #eee',
  whiteSpace: 'nowrap',
};

const thStyle2 = {
  padding: '6px 14px',
  color: '#aaa',
  fontWeight: 600,
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  borderBottom: '1px solid #eee',
  textAlign: 'right',
};

export default function RelatorioMensal() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
        <div style={{ width: 24, height: 24, border: '3px solid #eee', borderTopColor: '#E8392A', borderRadius: '50%', animation: 'sp .8s linear infinite' }} />
        <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <ReportContent />
    </Suspense>
  );
}
