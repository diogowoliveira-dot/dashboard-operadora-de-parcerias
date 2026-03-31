'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// ─── helpers ───────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (n == null) return '—';
  if (typeof n === 'string') n = Number(n);
  if (isNaN(n)) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.0', '') + 'K';
  return n.toLocaleString('pt-BR');
};

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const monthLabel = (isoMonth) => {
  if (!isoMonth) return '';
  const [y, m] = isoMonth.split('/');
  return `${MESES[(parseInt(m, 10) - 1) % 12]}/${y?.slice(2)}`;
};

const delta = (before, after) => {
  if (!before || before === 0) return null;
  return ((after - before) / before * 100).toFixed(1);
};

const g = (type, devId, extra = {}) => {
  const qs = new URLSearchParams({ type, devId, ...extra });
  return fetch(`/api/grafana?${qs}`).then(r => r.json());
};

const monthRange = (year, month) => ({
  dateFrom: new Date(year, month, 1).toISOString().split('T')[0],
  dateTo: new Date(year, month + 1, 1).toISOString().split('T')[0],
});

// ─── SVG bar chart ─────────────────────────────────────────────────────────
function BarChart({ data, color, baseline, h = 140, valueKey = 'v', labelKey = 'l' }) {
  if (!data?.length) return <div style={{ color: '#aaa', fontSize: 12, padding: '20px 0' }}>Sem dados</div>;
  const vals = data.map(d => d[valueKey] || 0);
  const mx = Math.max(...vals, baseline || 0, 1);
  const barW = Math.floor(540 / data.length) - 4;
  const drawH = h - 32;

  return (
    <svg viewBox={`0 0 540 ${h}`} style={{ width: '100%', height: h }}>
      {baseline > 0 && (
        <>
          <line
            x1={0} y1={drawH - (baseline / mx) * drawH}
            x2={540} y2={drawH - (baseline / mx) * drawH}
            stroke="#E8392A" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
          <text x={532} y={drawH - (baseline / mx) * drawH - 3} fill="#E8392A" fontSize={8} textAnchor="end" opacity={0.8}>ANTES</text>
        </>
      )}
      {data.map((d, i) => {
        const v = d[valueKey] || 0;
        const barH = Math.max((v / mx) * drawH, 2);
        const x = i * (barW + 4) + 2;
        const y = drawH - barH;
        const above = baseline > 0 ? v >= baseline : true;
        const fill = above ? color : '#ccc';
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} fill={fill} rx={2} opacity={0.85} />
            {v > 0 && barH > 16 && (
              <text x={x + barW / 2} y={y + 10} fill="#fff" fontSize={7} textAnchor="middle" fontFamily="monospace">{fmt(v)}</text>
            )}
            <text x={x + barW / 2} y={drawH + 12} fill="#777" fontSize={8} textAnchor="middle">{d[labelKey]}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── report content ────────────────────────────────────────────────────────
function ReportContent() {
  const params = useSearchParams();
  const op = params.get('op') || '';
  const devId = params.get('dev') || '';
  const devLabel = params.get('devLabel') || devId;
  const startDate = params.get('startDate') || '';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [genDate] = useState(() => new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }));

  const load = useCallback(async () => {
    if (!devId) { setLoading(false); return; }

    // ANTES: month before startDate (fixed)
    let antesRange = null;
    let antesLabel = null;
    let depoisRange = null;
    let depoisLabel = null;

    if (startDate) {
      const sd = new Date(startDate + 'T12:00:00');
      const am = monthRange(sd.getFullYear(), sd.getMonth() - 1);
      antesRange = am;
      const antesD = new Date(am.dateFrom);
      antesLabel = `${MESES[antesD.getMonth()]}/${antesD.getFullYear()}`;

      const today = new Date();
      const dm = monthRange(today.getFullYear(), today.getMonth() - 1);
      depoisRange = dm;
      const depoisD = new Date(dm.dateFrom);
      depoisLabel = `${MESES[depoisD.getMonth()]}/${depoisD.getFullYear()}`;
    }

    const [ac, lpsTotal, lpsMensal, lpsEmp, imobTotal, imobLista] = await Promise.all([
      g('acessos-construtora', devId),
      g('lps-total', devId),
      g('lps-mensal', devId, startDate ? { dateFrom: startDate } : {}),
      g('lps-empreendimentos', devId),
      g('imobiliarias-total', devId),
      g('imobiliarias-lista', devId),
    ]);

    let antes = null;
    let depois = null;

    if (antesRange) {
      const [acA, lpsA, imobA] = await Promise.all([
        g('acessos-construtora', devId, antesRange),
        g('lps-total', devId, antesRange),
        g('imobiliarias-total', devId, antesRange),
      ]);
      antes = { ac: acA, lps: lpsA, imob: imobA, label: antesLabel };
    }

    if (depoisRange) {
      const [acD, lpsD, imobD] = await Promise.all([
        g('acessos-construtora', devId, depoisRange),
        g('lps-total', devId, depoisRange),
        g('imobiliarias-total', devId, depoisRange),
      ]);
      depois = { ac: acD, lps: lpsD, imob: imobD, label: depoisLabel };
    }

    setData({ ac, lpsTotal, lpsMensal, lpsEmp, imobTotal, imobLista, antes, depois, antesLabel, depoisLabel, startDate });
    setLoading(false);
  }, [devId, startDate]);

  useEffect(() => { load(); }, [load]);

  // Derived values
  const acRows = data?.ac?.rows || [];
  const totAc = acRows.reduce((s, r) => s + (Number(r.acessos) || 0), 0);
  const lps = data?.lpsTotal?.rows?.[0];
  const imob = data?.imobTotal?.rows?.[0];
  const lpsRows = data?.lpsMensal?.rows || [];
  const imobLista = data?.imobLista?.rows || [];
  const empRows = data?.lpsEmp?.rows || [];

  const totAcAntes = (data?.antes?.ac?.rows || []).reduce((s, r) => s + (Number(r.acessos) || 0), 0);
  const lpsAntes = data?.antes?.lps?.rows?.[0];
  const imobAntes = data?.antes?.imob?.rows?.[0];
  const totAcDepois = (data?.depois?.ac?.rows || []).reduce((s, r) => s + (Number(r.acessos) || 0), 0);
  const lpsDepois = data?.depois?.lps?.rows?.[0];
  const imobDepois = data?.depois?.imob?.rows?.[0];

  const hasAntes = data?.antes && (totAcAntes > 0 || lpsAntes || imobAntes);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #eee', borderTopColor: '#E8392A', borderRadius: '50%', animation: 'sp .8s linear infinite', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 14, color: '#888' }}>Gerando relatório...</div>
        <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  if (!devId) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#888', fontSize: 14 }}>Parâmetros ausentes. Abra o relatório pelo dashboard.</div>
    </div>
  );

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
      <div className="page" style={{ maxWidth: 794, margin: '0 auto', padding: '0 0 40px' }}>

        {/* ── HEADER ── */}
        <div style={{ background: '#111', color: '#fff', padding: '32px 40px 28px', borderRadius: '0 0 16px 16px', marginBottom: 28, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: 300, height: '100%', background: 'linear-gradient(135deg, transparent, rgba(232,57,42,.12))', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, background: '#E8392A', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>DW</div>
                <div style={{ fontSize: 13, color: '#888', fontWeight: 500 }}>DWV Parcerias · Relatório de Performance</div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.8, lineHeight: 1.2, marginBottom: 8 }}>{devLabel}</div>
              <div style={{ fontSize: 13, color: '#888' }}>
                Operadora: <span style={{ color: '#ccc', fontWeight: 600 }}>{op || '—'}</span>
                {startDate && <span style={{ marginLeft: 20 }}>Início da operação: <span style={{ color: '#ccc', fontWeight: 600 }}>{new Date(startDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span></span>}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 20 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Gerado em</div>
              <div style={{ fontSize: 13, color: '#aaa', fontFamily: 'monospace' }}>{genDate}</div>
            </div>
          </div>
        </div>

        <div style={{ padding: '0 20px' }}>

          {/* ── KPI HEROES ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
            {[
              { label: 'Acessos totais', value: fmt(totAc), sub: 'no período', color: '#E8392A', icon: '📈' },
              { label: 'LPs geradas', value: fmt(lps?.total_generated), sub: `${fmt(lps?.total_access)} acessos nas LPs`, color: '#3b82f6', icon: '🔗' },
              { label: 'Imobiliárias integradas', value: fmt(imob?.imobiliarias), sub: `${fmt(imob?.qt)} unidades`, color: '#f59e0b', icon: '🏬' },
            ].map((k, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '20px 20px 18px', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
                <div style={{ fontSize: 18, marginBottom: 8 }}>{k.icon}</div>
                <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1, color: k.color, fontFamily: 'monospace', lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 8, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.4 }}>{k.label}</div>
                <div style={{ fontSize: 11, color: '#bbb', marginTop: 3 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* ── ANTES vs DEPOIS ── */}
          {hasAntes && (() => {
            const items = [
              {
                label: 'Acessos',
                icon: '📈',
                color: '#E8392A',
                before: totAcAntes,
                after: totAcDepois,
              },
              {
                label: 'LPs geradas',
                icon: '🔗',
                color: '#3b82f6',
                before: Number(lpsAntes?.total_generated || 0),
                after: Number(lpsDepois?.total_generated || 0),
              },
              {
                label: 'Imobiliárias',
                icon: '🏬',
                color: '#f59e0b',
                before: Number(imobAntes?.imobiliarias || 0),
                after: Number(imobDepois?.imobiliarias || 0),
              },
            ];
            return (
              <div style={{ marginBottom: 28 }}>
                <SectionTitle icon="📐" title="Antes vs Depois da Operação"
                  sub={`Marco: ${new Date(startDate + 'T12:00:00').toLocaleDateString('pt-BR')} · ANTES = ${data.antesLabel} · DEPOIS = ${data.depoisLabel}`} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {items.map((item, i) => {
                    const d = delta(item.before, item.after);
                    const positive = d !== null && Number(d) >= 0;
                    return (
                      <div key={i} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
                        <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{item.icon}</span>{item.label}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9, color: '#aaa', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>ANTES</div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#bbb', fontFamily: 'monospace', letterSpacing: -0.5 }}>{fmt(item.before)}</div>
                          </div>
                          <div style={{ fontSize: 16, color: '#ddd', paddingBottom: 2 }}>→</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9, color: '#aaa', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>DEPOIS</div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: item.color, fontFamily: 'monospace', letterSpacing: -0.5 }}>{fmt(item.after)}</div>
                          </div>
                        </div>
                        {d !== null && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: positive ? 'rgba(34,197,94,.08)' : 'rgba(232,57,42,.08)', padding: '4px 10px', borderRadius: 20 }}>
                            <span style={{ fontSize: 12 }}>{positive ? '↑' : '↓'}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: positive ? '#16a34a' : '#E8392A', fontFamily: 'monospace' }}>{Math.abs(d)}%</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── ACESSOS CHART ── */}
          {acRows.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <SectionTitle icon="📊" title="Acessos mensais" sub="Evolução de acessos da construtora" />
              <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
                <BarChart
                  data={acRows.map(r => ({ v: Number(r.acessos), l: monthLabel(r.month) }))}
                  color="#E8392A"
                  baseline={totAcAntes > 0 ? totAcAntes : 0}
                />
              </div>
            </div>
          )}

          {/* ── LPs CHART ── */}
          {lpsRows.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <SectionTitle icon="🔗" title="Landing Pages geradas por mês" sub="Evolução de geração de LPs" />
              <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
                <BarChart
                  data={lpsRows.map(r => ({ v: Number(r.total_links), l: monthLabel(r.month) }))}
                  color="#3b82f6"
                  baseline={Number(lpsAntes?.total_generated || 0)}
                />
              </div>
            </div>
          )}

          {/* ── LPs POR EMPREENDIMENTO ── */}
          {empRows.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <SectionTitle icon="🏗" title="LPs por empreendimento" sub={`${empRows.length} empreendimento${empRows.length !== 1 ? 's' : ''}`} />
              <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={{ textAlign: 'left', padding: '10px 16px', color: '#888', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #eee' }}>Empreendimento</th>
                      <th style={{ textAlign: 'right', padding: '10px 16px', color: '#888', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #eee' }}>LPs geradas</th>
                      <th style={{ textAlign: 'right', padding: '10px 16px', color: '#888', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #eee' }}>Acessos</th>
                      <th style={{ textAlign: 'right', padding: '10px 16px', color: '#888', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #eee' }}>Taxa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empRows.map((r, i) => {
                      const taxa = r.total_generated > 0 ? (r.total_access / r.total_generated * 100).toFixed(0) : 0;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                          <td style={{ padding: '10px 16px', color: '#222', fontWeight: 500 }}>{r.empreendimento || '—'}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#3b82f6', fontWeight: 600 }}>{fmt(r.total_generated)}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#16a34a', fontWeight: 600 }}>{fmt(r.total_access)}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#888' }}>{taxa}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── IMOBILIÁRIAS ── */}
          {imobLista.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <SectionTitle icon="🏬" title="Top imobiliárias integradas" sub={`${imobLista.length} imobiliária${imobLista.length !== 1 ? 's' : ''} no total`} />
              <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={{ textAlign: 'left', padding: '10px 16px', color: '#888', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #eee' }}>#</th>
                      <th style={{ textAlign: 'left', padding: '10px 16px', color: '#888', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #eee' }}>Imobiliária</th>
                      <th style={{ textAlign: 'right', padding: '10px 16px', color: '#888', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #eee' }}>Unidades</th>
                    </tr>
                  </thead>
                  <tbody>
                    {imobLista.slice(0, 20).map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                        <td style={{ padding: '9px 16px', color: '#ccc', fontFamily: 'monospace', fontSize: 11 }}>{String(i + 1).padStart(2, '0')}</td>
                        <td style={{ padding: '9px 16px', color: '#222', fontWeight: 500 }}>{r.imobiliaria}</td>
                        <td style={{ padding: '9px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#f59e0b', fontWeight: 600 }}>{fmt(r.qt)}</td>
                      </tr>
                    ))}
                    {imobLista.length > 20 && (
                      <tr>
                        <td colSpan={3} style={{ padding: '10px 16px', color: '#bbb', fontSize: 11, textAlign: 'center' }}>
                          + {imobLista.length - 20} outras imobiliárias
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── FOOTER ── */}
          <div style={{ borderTop: '1px solid #eee', paddingTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, background: '#E8392A', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10, color: '#fff' }}>DW</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#222' }}>DWV Parcerias</div>
                <div style={{ fontSize: 10, color: '#aaa' }}>Relatório gerado em {genDate}</div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: '#ccc', fontFamily: 'monospace' }}>dwvapp.com.br</div>
          </div>

        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #f0f0f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
        @media print {
          @page { size: A4 portrait; margin: 12mm 10mm; }
          body { background: white; }
          .no-print { display: none !important; }
          .page { max-width: 100%; padding: 0; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}

function SectionTitle({ icon, title, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <div>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{title}</span>
        {sub && <span style={{ fontSize: 11, color: '#aaa', marginLeft: 10 }}>{sub}</span>}
      </div>
    </div>
  );
}

export default function RelatorioPDF() {
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
