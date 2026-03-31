'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';

// ═══════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════
const fmt = (n) => {
  if (n == null) return '—';
  if (typeof n === 'string') n = Number(n);
  if (isNaN(n)) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.0', '') + 'K';
  return n.toLocaleString('pt-BR');
};
const todayISO = () => new Date().toISOString().split('T')[0];
const yearAgoISO = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().split('T')[0]; };
const deltaStr = (before, after) => {
  if (!before || before === 0) return { text: '—', color: '#555' };
  const pct = ((after - before) / before * 100).toFixed(1);
  return { text: `${Number(pct) >= 0 ? '↑' : '↓'} ${pct}%`, color: Number(pct) >= 0 ? '#22c55e' : '#E8392A' };
};

// ═══════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════
const STORE = 'dwv_ops_v2';
const loadOps = () => { try { return JSON.parse(localStorage.getItem(STORE) || '[]'); } catch { return []; } };
const saveOps = (o) => localStorage.setItem(STORE, JSON.stringify(o));

// ═══════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════
const css = {
  card: { background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 10, overflow: 'hidden' },
  cHead: { padding: '14px 20px', borderBottom: '1px solid #1a1a1a', fontSize: 13, fontWeight: 600, color: '#999' },
  mc: { background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 10, padding: '18px 20px', transition: 'all 0.2s' },
  input: { background: '#0e0e0e', border: '1px solid #1a1a1a', color: '#f5f5f5', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: 'none' },
  btn: { padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: 'none', transition: 'all 0.2s' },
  th: { textAlign: 'left', padding: '10px 16px', color: '#555', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #1a1a1a' },
};

// ═══════════════════════════════════════════
// SMALL COMPONENTS
// ═══════════════════════════════════════════
function Spin() {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}>
    <div style={{ width: 20, height: 20, border: '2px solid #1a1a1a', borderTopColor: '#E8392A', borderRadius: '50%', animation: 'sp .8s linear infinite' }} />
    <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
  </div>;
}

function MC({ label, value, sub, color }) {
  return <div style={css.mc}
    onMouseEnter={e => { e.currentTarget.style.borderColor = '#282828'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a1a1a'; e.currentTarget.style.transform = 'none'; }}>
    <div style={{ fontSize: 12, color: '#555', fontWeight: 500, marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", letterSpacing: -1, color: color || '#f5f5f5' }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: '#555', marginTop: 6 }}>{sub}</div>}
  </div>;
}

function Bars({ data, color = '#E8392A', h = 150 }) {
  if (!data?.length) return <div style={{ color: '#555', fontSize: 13, padding: 20 }}>Sem dados</div>;
  const mx = Math.max(...data.map(d => d.v || 0), 1);
  return <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: h, paddingTop: 16 }}>
    {data.map((d, i) => <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <div style={{ fontSize: 8, fontFamily: "'JetBrains Mono',monospace", color: '#555' }}>{fmt(d.v)}</div>
      <div style={{ width: '100%', borderRadius: '3px 3px 0 0', background: color, height: Math.max((d.v / mx) * (h - 36), 3), opacity: .8, transition: 'opacity .2s' }}
        onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = .8} />
      <div style={{ fontSize: 8, color: '#555', fontFamily: "'JetBrains Mono',monospace", whiteSpace: 'nowrap' }}>{d.l}</div>
    </div>)}
  </div>;
}

function Sec({ icon, title, src, children }) {
  return <div style={{ marginBottom: 28 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, color: '#999' }}>{title}</span>
      {src && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#555', fontFamily: "'JetBrains Mono',monospace" }}>{src}</span>}
    </div>
    {children}
  </div>;
}

// ═══════════════════════════════════════════
// BEFORE / AFTER COMPARISON CARD
// ═══════════════════════════════════════════
function BeforeAfter({ startDate, items }) {
  // items: [{ label, before, after }]
  if (!startDate || !items?.length) return null;
  return <div style={{ ...css.card, marginBottom: 14, background: '#080808' }}>
    <div style={{ ...css.cHead, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(232,57,42,0.03)' }}>
      <span>📐 Antes vs Depois da Operação</span>
      <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: '#555' }}>Marco: {new Date(startDate).toLocaleDateString('pt-BR')}</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 0 }}>
      {items.map((item, i) => {
        const d = deltaStr(item.before, item.after);
        return <div key={i} style={{ padding: '16px 20px', borderRight: i < items.length - 1 ? '1px solid #1a1a1a' : 'none' }}>
          <div style={{ fontSize: 11, color: '#555', marginBottom: 10, fontWeight: 500 }}>{item.label}</div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: '#555', marginBottom: 2 }}>ANTES</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: '#666', letterSpacing: -1 }}>{fmt(item.before)}</div>
            </div>
            <div style={{ fontSize: 18, color: '#333', marginBottom: 2 }}>→</div>
            <div>
              <div style={{ fontSize: 10, color: '#555', marginBottom: 2 }}>DEPOIS</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: '#f5f5f5', letterSpacing: -1 }}>{fmt(item.after)}</div>
            </div>
          </div>
          <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: d.color }}>{d.text}</div>
        </div>;
      })}
    </div>
  </div>;
}

// ═══════════════════════════════════════════
// INCORPORADORA VIEW (with before/after)
// ═══════════════════════════════════════════
function IncView({ dev, dateFrom, dateTo, startDate }) {
  const [ld, setLd] = useState({});
  const [dt, setDt] = useState({});

  const q = useCallback(async (type, params = {}) => {
    setLd(p => ({ ...p, [type]: true }));
    try {
      const qs = new URLSearchParams({ type, ...params });
      if (dateFrom) qs.set('dateFrom', dateFrom);
      if (dateTo) qs.set('dateTo', dateTo);
      const r = await fetch(`/api/grafana?${qs}`);
      const json = await r.json();
      setDt(p => ({ ...p, [type]: json }));
    } catch (e) { setDt(p => ({ ...p, [type]: { error: e.message } })); }
    setLd(p => ({ ...p, [type]: false }));
  }, [dateFrom, dateTo]);

  // Before-period queries
  const qBefore = useCallback(async (type, params = {}) => {
    if (!startDate) return;
    try {
      const qs = new URLSearchParams({ type, ...params, dateTo: startDate });
      // Go back same duration as after period
      const start = new Date(startDate);
      const now = new Date();
      const diffMs = now - start;
      const beforeStart = new Date(start.getTime() - diffMs);
      qs.set('dateFrom', beforeStart.toISOString().split('T')[0]);
      const r = await fetch(`/api/grafana?${qs}`);
      const json = await r.json();
      setDt(p => ({ ...p, [`${type}_before`]: json }));
    } catch {}
  }, [startDate]);

  useEffect(() => {
    if (!dev) return;
    setDt({});
    const id = dev.value;
    q('acessos-construtora', { devId: id });
    q('stories', { devId: id });
    q('lps-total', { devId: id });
    q('lps-empreendimentos', { devId: id });
    q('lps-mensal', { devId: id });
    q('imobiliarias-total', { devId: id });
    q('imobiliarias-lista', { devId: id });
    // Before queries
    if (startDate) {
      qBefore('acessos-construtora', { devId: id });
      qBefore('lps-total', { devId: id });
      qBefore('imobiliarias-total', { devId: id });
    }
  }, [dev, q, qBefore]);

  useEffect(() => {
    const st = dt['stories'];
    if (st?.rows?.length) {
      const ids = st.rows.map(r => r.story_id).filter(Boolean).join(',');
      if (ids) q('stories-titles', { ids });
    }
  }, [dt['stories']]);

  const titles = useMemo(() => {
    const m = {};
    dt['stories-titles']?.rows?.forEach(r => { m[r.legacy_id] = r.title; });
    return m;
  }, [dt['stories-titles']]);

  if (!dev) return null;

  const ac = dt['acessos-construtora']?.rows || [];
  const totAc = ac.reduce((s, r) => s + (Number(r.acessos) || 0), 0);
  const lastM = ac[ac.length - 1];
  const prevM = ac[ac.length - 2];
  const dl = lastM && prevM ? ((lastM.acessos - prevM.acessos) / prevM.acessos * 100).toFixed(1) : null;

  // Before data
  const acBefore = dt['acessos-construtora_before']?.rows || [];
  const totAcBefore = acBefore.reduce((s, r) => s + (Number(r.acessos) || 0), 0);
  const lpsBefore = dt['lps-total_before']?.rows?.[0];
  const lpsAfter = dt['lps-total']?.rows?.[0];
  const imobBefore = dt['imobiliarias-total_before']?.rows?.[0];
  const imobAfter = dt['imobiliarias-total']?.rows?.[0];

  const hasBeforeData = startDate && (totAcBefore > 0 || lpsBefore || imobBefore);

  return <>
    {/* BEFORE / AFTER */}
    {hasBeforeData && <BeforeAfter startDate={startDate} items={[
      { label: 'Acessos (período equiv.)', before: totAcBefore, after: totAc },
      { label: 'LPs geradas', before: Number(lpsBefore?.total_generated || 0), after: Number(lpsAfter?.total_generated || 0) },
      { label: 'Imobiliárias integradas', before: Number(imobBefore?.imobiliarias || 0), after: Number(imobAfter?.imobiliarias || 0) },
    ]} />}

    {/* BLOCO 1 */}
    <Sec icon="📈" title="Saúde do Canal — Acessos" src="ClickHouse">
      {ld['acessos-construtora'] ? <Spin /> : <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10, marginBottom: 14 }}>
          <MC label="Total de acessos" value={fmt(totAc)} />
          <MC label={`Último mês (${lastM?.month || '—'})`} value={fmt(lastM?.acessos)} color="#22c55e"
            sub={dl ? `${Number(dl) > 0 ? '↑' : '↓'} ${dl}% vs. anterior` : undefined} />
          <MC label="Média mensal" value={fmt(Math.round(totAc / Math.max(ac.length, 1)))} />
        </div>
        <div style={css.card}>
          <div style={css.cHead}>Acessos mensais</div>
          <div style={{ padding: '10px 20px 20px' }}>
            <Bars data={ac.map(r => ({ l: r.month?.split('/')[1] || '', v: Number(r.acessos) }))} color="#E8392A" />
          </div>
        </div>
      </>}
    </Sec>

    {/* BLOCO 2 */}
    <Sec icon="📱" title="Stories — Visualizações" src="ClickHouse + Postgres">
      {ld['stories'] ? <Spin /> : <div style={css.card}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr>
            <th style={css.th}>Story</th>
            <th style={css.th}>Incorporadora</th>
            <th style={{ ...css.th, textAlign: 'right' }}>Views</th>
          </tr></thead>
          <tbody>
            {(dt['stories']?.rows || []).map((r, i) => <tr key={i}>
              <td style={{ padding: '10px 16px', color: '#f5f5f5', fontWeight: 600, borderBottom: '1px solid #1a1a1a' }}>{titles[r.story_id] || `#${r.story_id}`}</td>
              <td style={{ padding: '10px 16px', color: '#999', borderBottom: '1px solid #1a1a1a' }}>{r.construtora}</td>
              <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", color: '#22c55e', borderBottom: '1px solid #1a1a1a' }}>{fmt(r.views)}</td>
            </tr>)}
            {!dt['stories']?.rows?.length && <tr><td colSpan={3} style={{ padding: 20, color: '#555', textAlign: 'center' }}>Sem stories no período</td></tr>}
          </tbody>
        </table>
      </div>}
    </Sec>

    {/* BLOCO 3 */}
    <Sec icon="🔗" title="Landing Pages" src="PostgreSQL">
      {ld['lps-total'] ? <Spin /> : <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10, marginBottom: 14 }}>
          {lpsAfter && <>
            <MC label="LPs geradas" value={fmt(lpsAfter.total_generated)} color="#3b82f6" />
            <MC label="Acessos nas LPs" value={fmt(lpsAfter.total_access)} color="#22c55e" />
            <MC label="Taxa de acesso" value={Number(lpsAfter.total_generated) > 0
              ? (Number(lpsAfter.total_access) / Number(lpsAfter.total_generated) * 100).toFixed(1) + '%' : '—'} sub="acessos / LPs" />
          </>}
        </div>
        {dt['lps-mensal']?.rows && <div style={css.card}>
          <div style={css.cHead}>LPs geradas por mês</div>
          <div style={{ padding: '10px 20px 20px' }}>
            <Bars data={dt['lps-mensal'].rows.map(r => ({ l: r.month?.split('/')[1] || '', v: Number(r.total_links) }))} color="#3b82f6" />
          </div>
        </div>}
        {dt['lps-empreendimentos']?.rows && <div style={{ ...css.card, marginTop: 12 }}>
          <div style={css.cHead}>LPs por empreendimento</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr>
              <th style={css.th}>Empreendimento</th>
              <th style={{ ...css.th, textAlign: 'right' }}>LPs</th>
              <th style={{ ...css.th, textAlign: 'right' }}>Acessos</th>
            </tr></thead>
            <tbody>{dt['lps-empreendimentos'].rows.map((r, i) => <tr key={i}>
              <td style={{ padding: '10px 16px', color: '#f5f5f5', fontWeight: 600, borderBottom: '1px solid #1a1a1a' }}>{r.empreendimento}</td>
              <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", color: '#999', borderBottom: '1px solid #1a1a1a' }}>{fmt(r.total_generated)}</td>
              <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", color: '#22c55e', borderBottom: '1px solid #1a1a1a' }}>{fmt(r.total_access)}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </>}
    </Sec>

    {/* BLOCO 4 */}
    <Sec icon="🏬" title="Imobiliárias Integradas" src="PostgreSQL">
      {ld['imobiliarias-total'] ? <Spin /> : <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10, marginBottom: 14 }}>
          {imobAfter && <>
            <MC label="Total de imobiliárias" value={fmt(imobAfter.imobiliarias)} color="#f59e0b" />
            <MC label="Unidades integradas" value={fmt(imobAfter.qt)} />
          </>}
        </div>
        {dt['imobiliarias-lista']?.rows && <div style={{ ...css.card, maxHeight: 'none' }}>
          <div style={css.cHead}>Todas as imobiliárias ({dt['imobiliarias-lista'].rows.length})</div>
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>
                <th style={{ ...css.th, position: 'sticky', top: 0, background: '#0a0a0a', zIndex: 2 }}>Imobiliária</th>
                <th style={{ ...css.th, textAlign: 'right', position: 'sticky', top: 0, background: '#0a0a0a', zIndex: 2 }}>Unidades</th>
              </tr></thead>
              <tbody>{dt['imobiliarias-lista'].rows.map((r, i) => <tr key={i}>
                <td style={{ padding: '8px 16px', color: '#f5f5f5', fontWeight: 500, borderBottom: '1px solid #1a1a1a' }}>{r.imobiliaria}</td>
                <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", color: '#f59e0b', borderBottom: '1px solid #1a1a1a' }}>{fmt(r.qt)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>}
      </>}
    </Sec>
  </>;
}

// ═══════════════════════════════════════════
// DIRETORIA VIEW
// ═══════════════════════════════════════════
function DirView({ operadoras }) {
  const [ld, setLd] = useState(false);
  const [kpi, setKpi] = useState({});

  const load = useCallback(async () => {
    setLd(true);
    const nd = {};
    for (const op of operadoras) {
      nd[op.name] = [];
      for (const dev of op.devs) {
        try {
          const [ac, lp, im] = await Promise.all([
            fetch(`/api/grafana?type=acessos-construtora&devId=${dev.value}`).then(r => r.json()),
            fetch(`/api/grafana?type=lps-mensal&devId=${dev.value}`).then(r => r.json()),
            fetch(`/api/grafana?type=imobiliarias-mensal&devId=${dev.value}`).then(r => r.json()),
          ]);
          nd[op.name].push({ ...dev, ac: ac.rows || [], lp: lp.rows || [], im: im.rows || [] });
        } catch { nd[op.name].push({ ...dev, ac: [], lp: [], im: [] }); }
      }
    }
    setKpi(nd);
    setLd(false);
  }, [operadoras]);

  useEffect(() => { if (operadoras.length) load(); }, []);

  const sum3 = (rows, k) => rows.slice(-3).reduce((s, r) => s + (Number(r[k]) || 0), 0);

  return <div style={{ padding: '24px 28px 60px' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>Visão Diretoria</div>
        <div style={{ fontSize: 13, color: '#555', marginTop: 2 }}>Performance das operadoras e suas carteiras</div>
      </div>
      <button onClick={load} style={{ ...css.btn, background: '#E8392A', color: '#fff' }}>
        {ld ? 'Carregando...' : '↻ Atualizar'}
      </button>
    </div>

    {ld ? <Spin /> : operadoras.map((op, oi) => {
      const devs = kpi[op.name] || [];
      const tAc = devs.reduce((s, d) => s + sum3(d.ac, 'acessos'), 0);
      const tLp = devs.reduce((s, d) => s + sum3(d.lp, 'total_links'), 0);
      const tIm = devs.reduce((s, d) => s + sum3(d.im, 'imobiliarias'), 0);

      return <div key={oi} style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(232,57,42,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#E8392A' }}>{op.name.charAt(0)}</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{op.name}</div>
          <div style={{ fontSize: 12, color: '#555', fontFamily: "'JetBrains Mono',monospace" }}>{op.devs.length} incorporadoras</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginBottom: 14 }}>
          <MC label="Acessos (3 meses)" value={fmt(tAc)} color="#E8392A" />
          <MC label="LPs geradas (3 meses)" value={fmt(tLp)} color="#3b82f6" />
          <MC label="Imobiliárias (3 meses)" value={fmt(tIm)} color="#f59e0b" />
        </div>
        <div style={css.card}>
          <div style={css.cHead}>Incorporadoras na carteira</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr>
              <th style={css.th}>Incorporadora</th>
              <th style={{ ...css.th, textAlign: 'right' }}>Acessos 3M</th>
              <th style={{ ...css.th, textAlign: 'right' }}>LPs 3M</th>
              <th style={{ ...css.th, textAlign: 'right' }}>Imobs 3M</th>
              <th style={{ ...css.th, textAlign: 'right' }}>Tendência acessos</th>
              <th style={{ ...css.th, textAlign: 'center' }}>Início operação</th>
            </tr></thead>
            <tbody>{devs.map((d, di) => {
              const a3 = sum3(d.ac, 'acessos');
              const aP = d.ac.length >= 6 ? d.ac.slice(-6, -3).reduce((s, r) => s + (Number(r.acessos) || 0), 0) : 0;
              const tr = aP > 0 ? ((a3 - aP) / aP * 100).toFixed(1) : null;
              return <tr key={di}>
                <td style={{ padding: '10px 16px', color: '#f5f5f5', fontWeight: 600, borderBottom: '1px solid #1a1a1a' }}>{d.label}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", color: '#E8392A', borderBottom: '1px solid #1a1a1a' }}>{fmt(a3)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", color: '#3b82f6', borderBottom: '1px solid #1a1a1a' }}>{fmt(sum3(d.lp, 'total_links'))}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", color: '#f59e0b', borderBottom: '1px solid #1a1a1a' }}>{fmt(sum3(d.im, 'imobiliarias'))}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", borderBottom: '1px solid #1a1a1a', color: tr && Number(tr) >= 0 ? '#22c55e' : tr ? '#E8392A' : '#555' }}>
                  {tr ? `${Number(tr) >= 0 ? '↑' : '↓'} ${tr}%` : '—'}
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#555', borderBottom: '1px solid #1a1a1a' }}>
                  {d.startDate ? new Date(d.startDate).toLocaleDateString('pt-BR') : '—'}
                </td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </div>;
    })}
    {!operadoras.length && <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>
      <div style={{ fontSize: 48, opacity: .3, marginBottom: 12 }}>👥</div>
      <div style={{ fontSize: 15, fontWeight: 500, color: '#999' }}>Nenhuma operadora cadastrada</div>
    </div>}
  </div>;
}

// ═══════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════
export default function App() {
  const [view, setView] = useState('operadora');
  const [incs, setIncs] = useState([]);
  const [ops, setOps] = useState([]);
  const [curOp, setCurOp] = useState(null);
  const [selDev, setSelDev] = useState(null);
  const [search, setSearch] = useState('');
  const [showDD, setShowDD] = useState(false);
  const [dateFrom, setDateFrom] = useState(yearAgoISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [newOp, setNewOp] = useState('');
  const [editingDate, setEditingDate] = useState(null); // devValue being edited

  useEffect(() => {
    fetch('/api/incorporadoras').then(r => r.json()).then(d => { if (Array.isArray(d)) setIncs(d); }).catch(() => {});
    setOps(loadOps());
  }, []);
  useEffect(() => { saveOps(ops); }, [ops]);
  useEffect(() => { if (!curOp && ops.length) setCurOp(ops[0]); }, [ops]);

  // Sync curOp with ops
  useEffect(() => {
    if (curOp) {
      const fresh = ops.find(o => o.name === curOp.name);
      if (fresh) setCurOp(fresh);
    }
  }, [ops]);

  const addOp = () => { if (!newOp.trim()) return; const o = { name: newOp.trim(), devs: [] }; setOps(p => [...p, o]); setCurOp(o); setNewOp(''); };
  const rmOp = (n) => { setOps(p => p.filter(o => o.name !== n)); if (curOp?.name === n) setCurOp(null); };

  const addDev = (dev) => {
    if (!curOp) return;
    const devWithDate = { ...dev, startDate: todayISO() };
    setOps(p => p.map(o => {
      if (o.name !== curOp.name) return o;
      if (o.devs.find(d => d.value === dev.value)) return o;
      return { ...o, devs: [...o.devs, devWithDate] };
    }));
    setSearch(''); setShowDD(false);
  };

  const rmDev = (val) => {
    setOps(p => p.map(o => o.name !== curOp.name ? o : { ...o, devs: o.devs.filter(d => d.value !== val) }));
    if (selDev?.value === val) setSelDev(null);
  };

  const updateDevDate = (val, newDate) => {
    setOps(p => p.map(o => o.name !== curOp.name ? o : { ...o, devs: o.devs.map(d => d.value === val ? { ...d, startDate: newDate } : d) }));
    setEditingDate(null);
  };

  const filtered = incs.filter(d => d.label?.toLowerCase().includes(search.toLowerCase())).slice(0, 25);

  return <div style={{ position: 'relative', zIndex: 1 }}>
    {/* HEADER */}
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 28px', borderBottom: '1px solid #1a1a1a', backdropFilter: 'blur(20px)', background: 'rgba(5,5,5,0.85)', position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 32, height: 32, background: '#E8392A', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, boxShadow: '0 0 16px rgba(232,57,42,0.12)' }}>DW</div>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: -0.3 }}>Painel da Operadora</div>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {['operadora', 'diretoria', 'config'].map(v => (
          <button key={v} onClick={() => setView(v)} style={{ ...css.btn, background: view === v ? '#E8392A' : '#141414', color: view === v ? '#fff' : '#999', border: view === v ? 'none' : '1px solid #1a1a1a', textTransform: 'capitalize' }}>
            {v === 'config' ? '⚙ Config' : v}
          </button>
        ))}
      </div>
    </header>

    {/* CONFIG */}
    {view === 'config' && <div style={{ padding: '24px 28px', maxWidth: 600 }}>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Gerenciar Operadoras</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input value={newOp} onChange={e => setNewOp(e.target.value)} placeholder="Nome da operadora..." style={{ ...css.input, width: '100%' }} onKeyDown={e => e.key === 'Enter' && addOp()} />
        <button onClick={addOp} style={{ ...css.btn, background: '#E8392A', color: '#fff', whiteSpace: 'nowrap' }}>+ Adicionar</button>
      </div>
      {ops.map((op, i) => <div key={i} style={{ ...css.card, marginBottom: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{op.name}</div>
          <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{op.devs.length} incorporadoras</div>
        </div>
        <button onClick={() => rmOp(op.name)} style={{ ...css.btn, background: 'rgba(232,57,42,0.1)', color: '#E8392A', fontSize: 11 }}>Remover</button>
      </div>)}
    </div>}

    {/* OPERADORA */}
    {view === 'operadora' && <>
      <div style={{ padding: '14px 28px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {ops.length > 0 && <div style={{ display: 'flex', gap: 4, background: '#0a0a0a', borderRadius: 8, padding: 3, border: '1px solid #1a1a1a' }}>
          {ops.map((op, i) => <button key={i} onClick={() => { setCurOp(op); setSelDev(null); }} style={{ ...css.btn, padding: '6px 14px', background: curOp?.name === op.name ? '#E8392A' : 'transparent', color: curOp?.name === op.name ? '#fff' : '#555', fontSize: 12 }}>{op.name}</button>)}
        </div>}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#555' }}>Período:</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...css.input, width: 140, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", padding: '7px 10px' }} />
          <span style={{ color: '#555', fontSize: 12 }}>até</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...css.input, width: 140, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", padding: '7px 10px' }} />
        </div>
      </div>

      {!curOp ? <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 48, opacity: .3, marginBottom: 12 }}>⚙</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: '#999' }}>Configure as operadoras primeiro</div>
        <button onClick={() => setView('config')} style={{ ...css.btn, background: '#E8392A', color: '#fff', marginTop: 12 }}>Ir para Config</button>
      </div> : <div style={{ display: 'flex', minHeight: 'calc(100vh - 120px)' }}>
        {/* SIDEBAR */}
        <aside style={{ width: 280, borderRight: '1px solid #1a1a1a', flexShrink: 0, overflowY: 'auto', maxHeight: 'calc(100vh - 120px)' }}>
          <div style={{ padding: '16px 16px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#555', letterSpacing: .5 }}>Carteira de {curOp.name}</div>
          <div style={{ padding: '0 12px 12px', position: 'relative' }}>
            <input value={search} onChange={e => { setSearch(e.target.value); setShowDD(true); }} onFocus={() => setShowDD(true)}
              placeholder="+ Adicionar incorporadora..." style={{ ...css.input, width: '100%', fontSize: 12, padding: '8px 10px' }} />
            {showDD && search.length > 1 && filtered.length > 0 && <div style={{ position: 'absolute', top: '100%', left: 12, right: 12, background: '#141414', border: '1px solid #1a1a1a', borderRadius: 8, maxHeight: 200, overflowY: 'auto', zIndex: 60, boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>
              {filtered.map((d, i) => <div key={i} onClick={() => addDev(d)} style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', color: '#999', borderBottom: '1px solid #1a1a1a' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(232,57,42,0.07)'; e.currentTarget.style.color = '#f5f5f5'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#999'; }}>{d.label}</div>)}
            </div>}
          </div>
          {curOp.devs.map((d, i) => <div key={i} style={{ borderLeft: selDev?.value === d.value ? '2px solid #E8392A' : '2px solid transparent', background: selDev?.value === d.value ? 'rgba(232,57,42,0.07)' : 'transparent', transition: 'all .15s' }}
            onMouseEnter={e => { if (selDev?.value !== d.value) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
            onMouseLeave={e => { if (selDev?.value !== d.value) e.currentTarget.style.background = 'transparent'; }}>
            <div onClick={() => setSelDev(d)} style={{ padding: '10px 16px 2px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: selDev?.value === d.value ? 600 : 400, color: selDev?.value === d.value ? '#f5f5f5' : '#999' }}>{d.label}</span>
              <span onClick={e => { e.stopPropagation(); rmDev(d.value); }} style={{ fontSize: 11, color: '#555', cursor: 'pointer', padding: '2px 6px' }}
                onMouseEnter={e => e.currentTarget.style.color = '#E8392A'} onMouseLeave={e => e.currentTarget.style.color = '#555'}>✕</span>
            </div>
            {/* Start date */}
            <div style={{ padding: '2px 16px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
              {editingDate === d.value ? (
                <input type="date" defaultValue={d.startDate} autoFocus
                  onBlur={e => updateDevDate(d.value, e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && updateDevDate(d.value, e.target.value)}
                  style={{ ...css.input, fontSize: 10, padding: '3px 6px', width: 120, fontFamily: "'JetBrains Mono',monospace" }} />
              ) : (
                <span onClick={e => { e.stopPropagation(); setEditingDate(d.value); }}
                  style={{ fontSize: 10, color: '#444', fontFamily: "'JetBrains Mono',monospace", cursor: 'pointer', borderBottom: '1px dashed #333' }}
                  title="Clique para editar a data de início">
                  Início: {d.startDate ? new Date(d.startDate).toLocaleDateString('pt-BR') : 'definir'}
                </span>
              )}
            </div>
          </div>)}
          {!curOp.devs.length && <div style={{ padding: '20px 16px', fontSize: 12, color: '#555', textAlign: 'center' }}>Busque incorporadoras acima</div>}
        </aside>

        {/* MAIN */}
        <main style={{ flex: 1, padding: '24px 28px 60px', overflowY: 'auto', maxHeight: 'calc(100vh - 120px)' }}>
          {selDev ? <>
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ padding: '6px 14px', background: 'rgba(232,57,42,0.07)', border: '1px solid rgba(232,57,42,0.2)', borderRadius: 20, fontSize: 13, fontWeight: 600, color: '#E8392A' }}>{selDev.label}</div>
              {selDev.startDate && <div style={{ fontSize: 11, color: '#555', fontFamily: "'JetBrains Mono',monospace" }}>Operando desde {new Date(selDev.startDate).toLocaleDateString('pt-BR')}</div>}
            </div>
            <IncView dev={selDev} dateFrom={dateFrom} dateTo={dateTo} startDate={selDev.startDate} />
          </> : <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>
            <div style={{ fontSize: 48, opacity: .3, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#999' }}>Selecione uma incorporadora na lateral</div>
          </div>}
        </main>
      </div>}
    </>}

    {/* DIRETORIA */}
    {view === 'diretoria' && <DirView operadoras={ops} />}

    {showDD && <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setShowDD(false)} />}
  </div>;
}
