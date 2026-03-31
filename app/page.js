'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

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
// AUTH API HELPERS
// ═══════════════════════════════════════════
const apiAuth = {
  me: () => fetch('/api/auth/me').then(r => r.json()),
  login: (email, password) => fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }).then(r => r.json()),
  logout: () => fetch('/api/auth/logout', { method: 'POST' }).then(r => r.json()),
  register: (token, name, password) => fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, name, password }) }).then(r => r.json()),
  forgotPassword: (email) => fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }).then(r => r.json()),
  resetPassword: (token, password) => fetch('/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) }).then(r => r.json()),
  listUsers: () => fetch('/api/users').then(r => r.json()),
  inviteUser: (email, role, operadora_name) => fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, role, operadora_name }) }).then(r => r.json()),
  deleteUser: (id) => fetch('/api/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).then(r => r.json()),
  toggleActive: (id) => fetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'toggle-active' }) }).then(r => r.json()),
  reassignUser: (id, operadora_name) => fetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'reassign', operadora_name }) }).then(r => r.json()),
  updateProfile: (name, current_password, new_password) => fetch('/api/auth/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, current_password, new_password }) }).then(r => r.json()),
};

// ═══════════════════════════════════════════
// API HELPERS
// ═══════════════════════════════════════════
const apiOps = {
  list: () => fetch('/api/ops').then(r => r.json()),
  create: (name) => fetch('/api/ops', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }),
  remove: (name) => fetch(`/api/ops?name=${encodeURIComponent(name)}`, { method: 'DELETE' }),
  updateEmail: (name, email) => fetch('/api/ops', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email }) }),
  sendReport: (operadora_name) => fetch('/api/email-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operadora_name }) }),
};
const apiCarteira = {
  add: (operadora_name, dev) => fetch('/api/carteira', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operadora_name, dev_value: dev.value, dev_label: dev.label, start_date: dev.startDate }),
  }),
  remove: (operadora_name, dev_value) => fetch(`/api/carteira?operadora_name=${encodeURIComponent(operadora_name)}&dev_value=${dev_value}`, { method: 'DELETE' }),
  updateDate: (operadora_name, dev_value, start_date) => fetch('/api/carteira', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operadora_name, dev_value, start_date }),
  }),
};

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

function BarsWithBaseline({ data, baseline, color = '#E8392A', h = 200 }) {
  if (!data?.length) return <div style={{ color: '#555', fontSize: 13, padding: 20 }}>Sem dados ainda</div>;
  const drawH = h - 36;
  const mx = Math.max(...data.map(d => d.v || 0), baseline || 0, 1);
  const blPct = baseline > 0 ? (baseline / mx) : 0;
  return <div style={{ position: 'relative', height: h }}>
    {baseline > 0 && <>
      <div style={{ position: 'absolute', left: 0, right: 40, bottom: 20 + blPct * drawH, borderTop: '1px dashed rgba(232,57,42,0.5)', zIndex: 3, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: 2, bottom: 22 + blPct * drawH, fontSize: 8, color: 'rgba(232,57,42,0.7)', fontFamily: "'JetBrains Mono',monospace", zIndex: 3 }}>ANTES</div>
    </>}
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: h, paddingTop: 16, position: 'relative', zIndex: 1 }}>
      {data.map((d, i) => {
        const above = baseline > 0 ? d.v >= baseline : true;
        return <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ fontSize: 8, fontFamily: "'JetBrains Mono',monospace", color: '#555' }}>{fmt(d.v)}</div>
          <div style={{ width: '100%', borderRadius: '3px 3px 0 0', background: above ? '#22c55e' : color, height: Math.max((d.v / mx) * drawH, 3), opacity: .85, transition: 'opacity .2s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = .85} />
          <div style={{ fontSize: 8, color: '#555', fontFamily: "'JetBrains Mono',monospace", whiteSpace: 'nowrap' }}>{d.l}</div>
        </div>;
      })}
    </div>
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
function BeforeAfter({ startDate, antesLabel, depoisLabel, items }) {
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
              <div style={{ fontSize: 10, color: '#555', marginBottom: 2 }}>ANTES {antesLabel && <span style={{ color: '#444' }}>({antesLabel})</span>}</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: '#666', letterSpacing: -1 }}>{fmt(item.before)}</div>
            </div>
            <div style={{ fontSize: 18, color: '#333', marginBottom: 2 }}>→</div>
            <div>
              <div style={{ fontSize: 10, color: '#555', marginBottom: 2 }}>DEPOIS {depoisLabel && <span style={{ color: '#444' }}>({depoisLabel})</span>}</div>
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

  // Helpers para calcular intervalos de mês
  const monthRange = useCallback((year, month) => ({
    from: new Date(year, month, 1).toISOString().split('T')[0],
    to: new Date(year, month + 1, 1).toISOString().split('T')[0],
  }), []);

  // ANTES: mês imediatamente anterior ao marco (fixo)
  const qBefore = useCallback(async (type, params = {}) => {
    if (!startDate) return;
    try {
      const d = new Date(startDate + 'T12:00:00');
      const { from, to } = monthRange(d.getFullYear(), d.getMonth() - 1);
      const qs = new URLSearchParams({ type, ...params, dateFrom: from, dateTo: to });
      const r = await fetch(`/api/grafana?${qs}`);
      const json = await r.json();
      setDt(p => ({ ...p, [`${type}_before`]: json }));
    } catch {}
  }, [startDate, monthRange]);

  // DEPOIS: último mês fechado (mês anterior ao atual)
  const qAfter = useCallback(async (type, params = {}) => {
    if (!startDate) return;
    try {
      const today = new Date();
      const { from, to } = monthRange(today.getFullYear(), today.getMonth() - 1);
      const qs = new URLSearchParams({ type, ...params, dateFrom: from, dateTo: to });
      const r = await fetch(`/api/grafana?${qs}`);
      const json = await r.json();
      setDt(p => ({ ...p, [`${type}_after`]: json }));
    } catch {}
  }, [startDate, monthRange]);

  // EVOLUÇÃO: mensal desde o marco até hoje
  const qEvol = useCallback(async (type, params = {}) => {
    if (!startDate) return;
    try {
      const qs = new URLSearchParams({ type, ...params, dateFrom: startDate });
      const r = await fetch(`/api/grafana?${qs}`);
      const json = await r.json();
      setDt(p => ({ ...p, [`${type}_evol`]: json }));
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
    if (startDate) {
      qBefore('acessos-construtora', { devId: id });
      qBefore('lps-total', { devId: id });
      qBefore('imobiliarias-total', { devId: id });
      qAfter('acessos-construtora', { devId: id });
      qAfter('lps-total', { devId: id });
      qAfter('imobiliarias-total', { devId: id });
      qEvol('acessos-construtora', { devId: id });
      qEvol('lps-mensal', { devId: id });
      qEvol('imobiliarias-mensal', { devId: id });
    }
  }, [dev, q, qBefore, qAfter, qEvol]);

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

  // Main totals (global date filter)
  const lpsMain = dt['lps-total']?.rows?.[0];
  const imobMain = dt['imobiliarias-total']?.rows?.[0];

  // ANTES: mês anterior ao marco (fixo)
  const acAntes = dt['acessos-construtora_before']?.rows || [];
  const totAcAntes = acAntes.reduce((s, r) => s + (Number(r.acessos) || 0), 0);
  const lpsAntes = dt['lps-total_before']?.rows?.[0];
  const imobAntes = dt['imobiliarias-total_before']?.rows?.[0];

  // DEPOIS: último mês fechado
  const acDepois = dt['acessos-construtora_after']?.rows || [];
  const totAcDepois = acDepois.reduce((s, r) => s + (Number(r.acessos) || 0), 0);
  const lpsDepois = dt['lps-total_after']?.rows?.[0];
  const imobDepois = dt['imobiliarias-total_after']?.rows?.[0];

  // EVOLUÇÃO: mensal desde o marco
  const acEvol = dt['acessos-construtora_evol']?.rows || [];
  const lpsEvol = dt['lps-mensal_evol']?.rows || [];
  const imobEvol = dt['imobiliarias-mensal_evol']?.rows || [];

  // Labels de mês para ANTES e DEPOIS
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const antesLabel = startDate ? (() => {
    const d = new Date(startDate + 'T12:00:00');
    const m = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    return `${MESES[m.getMonth()]}/${m.getFullYear()}`;
  })() : null;
  const depoisLabel = (() => {
    const today = new Date();
    const m = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return `${MESES[m.getMonth()]}/${m.getFullYear()}`;
  })();

  const hasBeforeData = startDate && (totAcAntes > 0 || lpsAntes || imobAntes);
  const hasEvol = startDate && (acEvol.length > 0 || lpsEvol.length > 0 || imobEvol.length > 0);

  return <>
    {/* BEFORE / AFTER */}
    {hasBeforeData && <BeforeAfter startDate={startDate} antesLabel={antesLabel} depoisLabel={depoisLabel} items={[
      { label: 'Acessos', before: totAcAntes, after: totAcDepois },
      { label: 'LPs geradas', before: Number(lpsAntes?.total_generated || 0), after: Number(lpsDepois?.total_generated || 0) },
      { label: 'Imobiliárias integradas', before: Number(imobAntes?.imobiliarias || 0), after: Number(imobDepois?.imobiliarias || 0) },
    ]} />}

    {/* EVOLUÇÃO MENSAL */}
    {hasEvol && <div style={{ ...css.card, marginBottom: 14, background: '#080808' }}>
      <div style={{ ...css.cHead, background: 'rgba(34,197,94,0.03)' }}>📈 Evolução Mensal — desde o marco ({antesLabel} = base)</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 0 }}>
        {acEvol.length > 0 && <div style={{ padding: '14px 20px', borderRight: '1px solid #1a1a1a' }}>
          <div style={{ fontSize: 11, color: '#555', marginBottom: 8, fontWeight: 500 }}>Acessos mensais</div>
          <BarsWithBaseline
            data={acEvol.map(r => ({ l: r.month?.split('/')[1] || r.month || '', v: Number(r.acessos) }))}
            baseline={totAcAntes} />
        </div>}
        {lpsEvol.length > 0 && <div style={{ padding: '14px 20px', borderRight: imobEvol.length > 0 ? '1px solid #1a1a1a' : 'none' }}>
          <div style={{ fontSize: 11, color: '#555', marginBottom: 8, fontWeight: 500 }}>LPs geradas mensais</div>
          <BarsWithBaseline
            data={lpsEvol.map(r => ({ l: r.month?.split('/')[1] || r.month || '', v: Number(r.total_links) }))}
            baseline={Number(lpsAntes?.total_generated || 0)} color="#3b82f6" />
        </div>}
        {imobEvol.length > 0 && <div style={{ padding: '14px 20px' }}>
          <div style={{ fontSize: 11, color: '#555', marginBottom: 8, fontWeight: 500 }}>Imobiliárias mensais</div>
          <BarsWithBaseline
            data={imobEvol.map(r => ({ l: r.month?.split('/')[1] || r.month || '', v: Number(r.imobiliarias) }))}
            baseline={Number(imobAntes?.imobiliarias || 0)} color="#f59e0b" />
        </div>}
      </div>
    </div>}

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
          {lpsMain && <>
            <MC label="LPs geradas" value={fmt(lpsMain.total_generated)} color="#3b82f6" />
            <MC label="Acessos nas LPs" value={fmt(lpsMain.total_access)} color="#22c55e" />
            <MC label="Taxa de acesso" value={Number(lpsMain.total_generated) > 0
              ? (Number(lpsMain.total_access) / Number(lpsMain.total_generated) * 100).toFixed(1) + '%' : '—'} sub="acessos / LPs" />
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
          {imobMain && <>
            <MC label="Total de imobiliárias" value={fmt(imobMain.imobiliarias)} color="#f59e0b" />
            <MC label="Unidades integradas" value={fmt(imobMain.qt)} />
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
// AUTH SCREENS
// ═══════════════════════════════════════════
const authCard = { background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 12, padding: '36px 40px', width: '100%', maxWidth: 400 };

function LoginScreen({ onLogin, onForgot }) {
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const emailRef = useRef(null);
  const passRef = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    const data = await apiAuth.login(emailRef.current.value, passRef.current.value);
    setLoading(false);
    if (data.ok) { onLogin(data.user); }
    else { setErr(data.error || 'Erro ao fazer login'); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050505' }}>
      <div style={authCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{ width: 36, height: 36, background: '#E8392A', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>DW</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>DWV Parcerias</div>
        </div>
        <div style={{ fontSize: 13, color: '#555', marginBottom: 24 }}>Entre com suas credenciais</div>
        <form onSubmit={submit} autoComplete="on">
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>E-mail</label>
            <input ref={emailRef} name="email" type="email" autoComplete="email" required
              style={{ ...css.input, width: '100%', boxSizing: 'border-box' }} placeholder="seu@email.com" />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>Senha</label>
            <input ref={passRef} name="password" type="password" autoComplete="current-password" required
              style={{ ...css.input, width: '100%', boxSizing: 'border-box' }} placeholder="••••••••" />
          </div>
          {err && <div style={{ fontSize: 12, color: '#E8392A', marginBottom: 14, fontFamily: "'JetBrains Mono',monospace" }}>{err}</div>}
          <button type="submit" disabled={loading} style={{ ...css.btn, width: '100%', background: '#E8392A', color: '#fff', padding: '11px', fontSize: 13 }}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <button onClick={onForgot} style={{ background: 'none', border: 'none', color: '#555', fontSize: 12, cursor: 'pointer', marginTop: 18, width: '100%', textAlign: 'center', fontFamily: 'inherit' }}>
          Esqueci minha senha
        </button>
      </div>
    </div>
  );
}

function ForgotScreen({ onBack }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setErr('');
    await apiAuth.forgotPassword(email);
    setLoading(false);
    setSent(true);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050505' }}>
      <div style={authCard}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Recuperar senha</div>
        {sent ? (
          <>
            <div style={{ fontSize: 13, color: '#22c55e', marginBottom: 20 }}>Se o e-mail existir, você receberá um link em breve.</div>
            <button onClick={onBack} style={{ ...css.btn, background: '#141414', color: '#999', border: '1px solid #1a1a1a' }}>Voltar ao login</button>
          </>
        ) : (
          <form onSubmit={submit}>
            <div style={{ fontSize: 13, color: '#555', marginBottom: 20 }}>Digite seu e-mail para receber o link de redefinição.</div>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"
              style={{ ...css.input, width: '100%', boxSizing: 'border-box', marginBottom: 16 }} placeholder="seu@email.com" />
            {err && <div style={{ fontSize: 12, color: '#E8392A', marginBottom: 12 }}>{err}</div>}
            <button type="submit" disabled={loading} style={{ ...css.btn, width: '100%', background: '#E8392A', color: '#fff', padding: '11px', fontSize: 13, marginBottom: 12 }}>
              {loading ? 'Enviando...' : 'Enviar link'}
            </button>
            <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', color: '#555', fontSize: 12, cursor: 'pointer', width: '100%', textAlign: 'center', fontFamily: 'inherit' }}>
              Voltar ao login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function RegisterScreen({ token, onLogin }) {
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (pass !== pass2) { setErr('As senhas não coincidem'); return; }
    setLoading(true); setErr('');
    const data = await apiAuth.register(token, name, pass);
    setLoading(false);
    if (data.ok) { onLogin(data.user); }
    else { setErr(data.error || 'Erro ao criar conta'); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050505' }}>
      <div style={authCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div style={{ width: 36, height: 36, background: '#E8392A', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>DW</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Criar sua conta</div>
        </div>
        <div style={{ fontSize: 13, color: '#555', marginBottom: 24 }}>Complete seu cadastro para acessar o painel.</div>
        <form onSubmit={submit} autoComplete="on">
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>Seu nome</label>
            <input name="name" type="text" autoComplete="name" required value={name} onChange={e => setName(e.target.value)}
              style={{ ...css.input, width: '100%', boxSizing: 'border-box' }} placeholder="Nome completo" />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>Senha</label>
            <input name="password" type="password" autoComplete="new-password" required value={pass} onChange={e => setPass(e.target.value)}
              style={{ ...css.input, width: '100%', boxSizing: 'border-box' }} placeholder="Mínimo 6 caracteres" />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>Confirmar senha</label>
            <input name="password2" type="password" autoComplete="new-password" required value={pass2} onChange={e => setPass2(e.target.value)}
              style={{ ...css.input, width: '100%', boxSizing: 'border-box' }} placeholder="Repita a senha" />
          </div>
          {err && <div style={{ fontSize: 12, color: '#E8392A', marginBottom: 14 }}>{err}</div>}
          <button type="submit" disabled={loading} style={{ ...css.btn, width: '100%', background: '#E8392A', color: '#fff', padding: '11px', fontSize: 13 }}>
            {loading ? 'Criando conta...' : 'Criar conta e entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

function ResetScreen({ token, onLogin }) {
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (pass !== pass2) { setErr('As senhas não coincidem'); return; }
    setLoading(true); setErr('');
    const data = await apiAuth.resetPassword(token, pass);
    setLoading(false);
    if (data.ok) { onLogin(data.user); }
    else { setErr(data.error || 'Link inválido ou expirado'); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050505' }}>
      <div style={authCard}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Nova senha</div>
        <div style={{ fontSize: 13, color: '#555', marginBottom: 24 }}>Escolha sua nova senha de acesso.</div>
        <form onSubmit={submit} autoComplete="on">
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>Nova senha</label>
            <input name="password" type="password" autoComplete="new-password" required value={pass} onChange={e => setPass(e.target.value)}
              style={{ ...css.input, width: '100%', boxSizing: 'border-box' }} placeholder="Mínimo 6 caracteres" />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>Confirmar senha</label>
            <input name="password2" type="password" autoComplete="new-password" required value={pass2} onChange={e => setPass2(e.target.value)}
              style={{ ...css.input, width: '100%', boxSizing: 'border-box' }} placeholder="Repita a senha" />
          </div>
          {err && <div style={{ fontSize: 12, color: '#E8392A', marginBottom: 14 }}>{err}</div>}
          <button type="submit" disabled={loading} style={{ ...css.btn, width: '100%', background: '#E8392A', color: '#fff', padding: '11px', fontSize: 13 }}>
            {loading ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// ROLE BADGE
// ═══════════════════════════════════════════
const roleColors = { master: '#E8392A', admin: '#f59e0b', operadora: '#3b82f6' };
const roleLabel = { master: 'Master', admin: 'Admin', operadora: 'Operadora' };
function RoleBadge({ role }) {
  return <span style={{ fontSize: 10, fontWeight: 700, color: roleColors[role] || '#555', background: `${roleColors[role]}18`, padding: '2px 8px', borderRadius: 20, fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase', letterSpacing: .5 }}>{roleLabel[role] || role}</span>;
}

// ═══════════════════════════════════════════
// USERS TAB (master only)
// ═══════════════════════════════════════════
function UsersTab({ ops }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invEmail, setInvEmail] = useState('');
  const [invRole, setInvRole] = useState('operadora');
  const [invOp, setInvOp] = useState('');
  const [invMsg, setInvMsg] = useState(null);
  const [invLoading, setInvLoading] = useState(false);
  const [reassigning, setReassigning] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await apiAuth.listUsers();
    if (data.users) setUsers(data.users);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, []);

  const invite = async () => {
    if (!invEmail) { setInvMsg({ ok: false, text: 'E-mail obrigatório' }); return; }
    if (invRole === 'operadora' && !invOp) { setInvMsg({ ok: false, text: 'Selecione a operadora' }); return; }
    setInvMsg(null); setInvLoading(true);
    const data = await apiAuth.inviteUser(invEmail, invRole, invRole === 'operadora' ? invOp : undefined);
    setInvLoading(false);
    if (data.ok) { setInvMsg({ ok: true, text: '✓ Convite enviado por e-mail!' }); setInvEmail(''); setInvOp(''); reload(); }
    else { setInvMsg({ ok: false, text: data.error || 'Erro ao enviar convite' }); }
  };

  const deleteUser = async (id) => {
    if (!confirm('Excluir este usuário permanentemente?')) return;
    await apiAuth.deleteUser(id);
    reload();
  };

  const toggleActive = async (id) => {
    await apiAuth.toggleActive(id);
    reload();
  };

  const reassign = async (id, operadora_name) => {
    await apiAuth.reassignUser(id, operadora_name);
    setReassigning(null);
    reload();
  };

  const tdStyle = { padding: '11px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 13 };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 860 }}>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Gerenciar Usuários</div>
      <div style={{ fontSize: 13, color: '#555', marginBottom: 24 }}>Convide administradores e operadoras. Apenas o master pode gerenciar usuários.</div>

      {/* Invite form */}
      <div style={{ ...css.card, padding: '20px 24px', marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 16, textTransform: 'uppercase', letterSpacing: .5 }}>Convidar novo usuário</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, color: '#555', marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>E-mail</div>
            <input type="email" value={invEmail} onChange={e => setInvEmail(e.target.value)}
              placeholder="usuario@email.com" style={{ ...css.input, width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#555', marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>Perfil</div>
            <select value={invRole} onChange={e => { setInvRole(e.target.value); setInvOp(''); }}
              style={{ ...css.input, cursor: 'pointer', minWidth: 140 }}>
              <option value="operadora">Operadora</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          {invRole === 'operadora' && (
            <div>
              <div style={{ fontSize: 10, color: '#555', marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>Operadora</div>
              <select value={invOp} onChange={e => setInvOp(e.target.value)}
                style={{ ...css.input, cursor: 'pointer', minWidth: 160 }}>
                <option value="">Selecionar...</option>
                {ops.map((op, i) => <option key={i} value={op.name}>{op.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={invite} disabled={invLoading}
            style={{ ...css.btn, background: '#E8392A', color: '#fff', padding: '9px 20px' }}>
            {invLoading ? 'Enviando...' : '✉ Enviar convite'}
          </button>
          {invMsg && <span style={{ fontSize: 12, color: invMsg.ok ? '#22c55e' : '#E8392A', fontFamily: "'JetBrains Mono',monospace" }}>{invMsg.text}</span>}
        </div>
      </div>

      {/* Users list */}
      {loading ? <Spin /> : <div style={css.card}>
        <div style={{ ...css.cHead, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Usuários cadastrados</span>
          <span style={{ fontSize: 12, color: '#555', fontFamily: "'JetBrains Mono',monospace" }}>{users.length} total · {users.filter(u => u.active).length} ativos</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 600 }}>
            <thead><tr>
              <th style={css.th}>Usuário</th>
              <th style={css.th}>Perfil</th>
              <th style={css.th}>Operadora</th>
              <th style={css.th}>Status</th>
              <th style={{ ...css.th, textAlign: 'right' }}>Ações</th>
            </tr></thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={i} style={{ opacity: u.active ? 1 : 0.5 }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, color: '#f5f5f5', fontSize: 13 }}>{u.name || <span style={{ color: '#555', fontStyle: 'italic' }}>sem nome</span>}</div>
                    <div style={{ fontSize: 11, color: '#555', fontFamily: "'JetBrains Mono',monospace", marginTop: 1 }}>{u.email}</div>
                  </td>
                  <td style={tdStyle}><RoleBadge role={u.role} /></td>
                  <td style={tdStyle}>
                    {u.role === 'master' || u.role === 'admin'
                      ? <span style={{ color: '#555', fontSize: 12 }}>—</span>
                      : reassigning === u.id
                        ? <select defaultValue={u.operadora_name} autoFocus
                            onBlur={() => setReassigning(null)}
                            onChange={e => reassign(u.id, e.target.value)}
                            style={{ ...css.input, fontSize: 12, padding: '4px 8px' }}>
                            {ops.map((op, oi) => <option key={oi} value={op.name}>{op.name}</option>)}
                          </select>
                        : <span onClick={() => setReassigning(u.id)}
                            style={{ fontSize: 12, color: '#999', cursor: 'pointer', borderBottom: '1px dashed #333' }}>
                            {u.operadora_name || '—'}
                          </span>}
                  </td>
                  <td style={tdStyle}>
                    {u.pending_invite
                      ? <span style={{ fontSize: 11, color: '#f59e0b', fontFamily: "'JetBrains Mono',monospace" }}>convite pendente</span>
                      : u.active
                        ? <span style={{ fontSize: 11, color: '#22c55e', fontFamily: "'JetBrains Mono',monospace" }}>● ativo</span>
                        : <span style={{ fontSize: 11, color: '#555', fontFamily: "'JetBrains Mono',monospace" }}>○ inativo</span>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {u.role !== 'master' && <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => toggleActive(u.id)}
                        style={{ ...css.btn, background: u.active ? 'rgba(255,255,255,0.04)' : 'rgba(34,197,94,0.1)', color: u.active ? '#555' : '#22c55e', border: `1px solid ${u.active ? '#1a1a1a' : 'rgba(34,197,94,0.2)'}`, fontSize: 11, padding: '4px 10px' }}>
                        {u.active ? 'Desativar' : 'Ativar'}
                      </button>
                      <button onClick={() => deleteUser(u.id)}
                        style={{ ...css.btn, background: 'rgba(232,57,42,0.08)', color: '#E8392A', fontSize: 11, padding: '4px 10px' }}>
                        Excluir
                      </button>
                    </div>}
                  </td>
                </tr>
              ))}
              {!users.length && <tr><td colSpan={5} style={{ padding: 28, color: '#555', textAlign: 'center' }}>Nenhum usuário cadastrado</td></tr>}
            </tbody>
          </table>
        </div>
      </div>}
    </div>
  );
}

// ═══════════════════════════════════════════
// PROFILE PANEL (todos os usuários)
// ═══════════════════════════════════════════
function ProfilePanel({ user, onClose, onUpdated }) {
  const [name, setName] = useState(user.name || '');
  const [curPass, setCurPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newPass2, setNewPass2] = useState('');
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (newPass && newPass !== newPass2) { setMsg({ ok: false, text: 'As senhas não coincidem' }); return; }
    if (newPass && newPass.length < 6) { setMsg({ ok: false, text: 'Senha deve ter pelo menos 6 caracteres' }); return; }
    setLoading(true); setMsg(null);
    const data = await apiAuth.updateProfile(
      name !== user.name ? name : undefined,
      newPass ? curPass : undefined,
      newPass || undefined,
    );
    setLoading(false);
    if (data.ok) {
      setMsg({ ok: true, text: '✓ Dados atualizados' });
      setCurPass(''); setNewPass(''); setNewPass2('');
      onUpdated({ ...user, name: name || user.name });
    } else {
      setMsg({ ok: false, text: data.error || 'Erro ao salvar' });
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 14, padding: '28px 32px', width: '100%', maxWidth: 440, boxShadow: '0 24px 80px rgba(0,0,0,.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Meu Perfil</div>
            <div style={{ fontSize: 12, color: '#555', marginTop: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
              {user.email} <RoleBadge role={user.role} />
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        <form onSubmit={save}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>Nome</label>
            <input value={name} onChange={e => setName(e.target.value)} autoComplete="name"
              style={{ ...css.input, width: '100%', boxSizing: 'border-box' }} placeholder="Seu nome" />
          </div>

          <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#555', fontWeight: 600, marginBottom: 14, textTransform: 'uppercase', letterSpacing: .5 }}>Alterar senha <span style={{ color: '#333', fontWeight: 400 }}>(opcional)</span></div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>Senha atual</label>
              <input type="password" value={curPass} onChange={e => setCurPass(e.target.value)} autoComplete="current-password"
                style={{ ...css.input, width: '100%', boxSizing: 'border-box' }} placeholder="••••••••" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>Nova senha</label>
                <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} autoComplete="new-password"
                  style={{ ...css.input, width: '100%', boxSizing: 'border-box' }} placeholder="Mínimo 6" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>Confirmar</label>
                <input type="password" value={newPass2} onChange={e => setNewPass2(e.target.value)} autoComplete="new-password"
                  style={{ ...css.input, width: '100%', boxSizing: 'border-box' }} placeholder="Repetir" />
              </div>
            </div>
          </div>

          {msg && <div style={{ fontSize: 12, color: msg.ok ? '#22c55e' : '#E8392A', marginBottom: 14, fontFamily: "'JetBrains Mono',monospace" }}>{msg.text}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" disabled={loading}
              style={{ ...css.btn, background: '#E8392A', color: '#fff', flex: 1, padding: '10px' }}>
              {loading ? 'Salvando...' : 'Salvar alterações'}
            </button>
            <button type="button" onClick={onClose}
              style={{ ...css.btn, background: '#141414', color: '#555', border: '1px solid #1a1a1a', padding: '10px 16px' }}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════
export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authScreen, setAuthScreen] = useState('login'); // 'login' | 'forgot'
  const [urlToken, setUrlToken] = useState(null);
  const [urlTokenType, setUrlTokenType] = useState(null); // 'invite' | 'reset'

  const [view, setView] = useState('operadora');
  const [incs, setIncs] = useState([]);
  const [ops, setOps] = useState([]);
  const [opsLoading, setOpsLoading] = useState(true);
  const [curOp, setCurOp] = useState(null);
  const [selDev, setSelDev] = useState(null);
  const [search, setSearch] = useState('');
  const [showDD, setShowDD] = useState(false);
  const [dateFrom, setDateFrom] = useState(yearAgoISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [newOp, setNewOp] = useState('');
  const [editingDate, setEditingDate] = useState(null);
  const [editingEmail, setEditingEmail] = useState(null);
  const [sendingReport, setSendingReport] = useState(false);
  const [reportMsg, setReportMsg] = useState(null);
  const [showProfile, setShowProfile] = useState(false);

  // Check URL tokens (invite / reset) and session on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite');
    const reset = params.get('reset');
    if (invite) { setUrlToken(invite); setUrlTokenType('invite'); setAuthLoading(false); return; }
    if (reset) { setUrlToken(reset); setUrlTokenType('reset'); setAuthLoading(false); return; }
    apiAuth.me().then(data => {
      if (data.user) setAuthUser(data.user);
      setAuthLoading(false);
    }).catch(() => setAuthLoading(false));
  }, []);

  const handleLogin = useCallback((user) => {
    setAuthUser(user);
    // Clear URL tokens after successful auth
    window.history.replaceState({}, '', window.location.pathname);
    setUrlToken(null); setUrlTokenType(null);
  }, []);

  const handleLogout = useCallback(async () => {
    await apiAuth.logout();
    setAuthUser(null);
    setOps([]); setCurOp(null); setSelDev(null);
    setView('operadora');
  }, []);

  const reloadOps = useCallback(async () => {
    try {
      const data = await apiOps.list();
      if (Array.isArray(data)) {
        setOps(data);
        setCurOp(prev => {
          if (!prev && data.length) return data[0];
          if (prev) return data.find(o => o.name === prev.name) || prev;
          return prev;
        });
      }
    } catch {}
    setOpsLoading(false);
  }, []);

  useEffect(() => {
    if (!authUser) return;
    fetch('/api/incorporadoras').then(r => r.json()).then(d => { if (Array.isArray(d)) setIncs(d); }).catch(() => {});
    reloadOps();
    // For operadora users, auto-select their operadora
    if (authUser.role === 'operadora' && authUser.operadora_name) {
      setCurOp({ name: authUser.operadora_name, devs: [] });
    }
  }, [authUser]);

  const addOp = async () => {
    if (!newOp.trim()) return;
    await apiOps.create(newOp.trim());
    setNewOp('');
    await reloadOps();
    setCurOp(ops.find(o => o.name === newOp.trim()) || { name: newOp.trim(), devs: [] });
  };

  const rmOp = async (n) => {
    await apiOps.remove(n);
    if (curOp?.name === n) setCurOp(null);
    await reloadOps();
  };

  const addDev = async (dev) => {
    if (!curOp) return;
    const devWithDate = { ...dev, startDate: todayISO() };
    await apiCarteira.add(curOp.name, devWithDate);
    setSearch(''); setShowDD(false);
    await reloadOps();
  };

  const rmDev = async (val) => {
    await apiCarteira.remove(curOp.name, val);
    if (selDev?.value === val) setSelDev(null);
    await reloadOps();
  };

  const updateDevDate = async (val, newDate) => {
    await apiCarteira.updateDate(curOp.name, val, newDate);
    setEditingDate(null);
    await reloadOps();
  };

  const filtered = incs.filter(d => d.label?.toLowerCase().includes(search.toLowerCase())).slice(0, 25);
  const isMaster = authUser?.role === 'master';
  const isAdmin = authUser?.role === 'admin';
  const canManage = isMaster || isAdmin;

  // Auth loading spinner
  if (authLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050505' }}><Spin /></div>;

  // URL token flows
  if (urlTokenType === 'invite') return <RegisterScreen token={urlToken} onLogin={handleLogin} />;
  if (urlTokenType === 'reset') return <ResetScreen token={urlToken} onLogin={handleLogin} />;

  // Not logged in
  if (!authUser) {
    if (authScreen === 'forgot') return <ForgotScreen onBack={() => setAuthScreen('login')} />;
    return <LoginScreen onLogin={handleLogin} onForgot={() => setAuthScreen('forgot')} />;
  }

  return <div style={{ position: 'relative', zIndex: 1 }}>
    {/* HEADER */}
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 28px', borderBottom: '1px solid #1a1a1a', backdropFilter: 'blur(20px)', background: 'rgba(5,5,5,0.85)', position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 32, height: 32, background: '#E8392A', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, boxShadow: '0 0 16px rgba(232,57,42,0.12)' }}>DW</div>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: -0.3 }}>Painel da Operadora</div>
        {authUser.role === 'operadora' && authUser.operadora_name && <div style={{ fontSize: 11, color: '#555', fontFamily: "'JetBrains Mono',monospace" }}>{authUser.operadora_name}</div>}
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {canManage && (isMaster ? ['operadora', 'diretoria', 'config', 'usuarios'] : ['operadora', 'diretoria', 'config']).map(v => (
          <button key={v} onClick={() => setView(v)} style={{ ...css.btn, background: view === v ? '#E8392A' : '#141414', color: view === v ? '#fff' : '#999', border: view === v ? 'none' : '1px solid #1a1a1a', textTransform: 'capitalize' }}>
            {v === 'config' ? '⚙ Config' : v === 'usuarios' ? '👥 Usuários' : v}
          </button>
        ))}
        <div style={{ width: 1, height: 20, background: '#1a1a1a', margin: '0 4px' }} />
        <RoleBadge role={authUser.role} />
        <button onClick={() => setShowProfile(true)} style={{ ...css.btn, background: '#141414', color: '#999', border: '1px solid #1a1a1a', fontSize: 11, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{authUser.name || authUser.email}</button>
        <button onClick={handleLogout} style={{ ...css.btn, background: '#141414', color: '#555', border: '1px solid #1a1a1a', fontSize: 11 }}>Sair</button>
      </div>
    </header>

    {/* USUARIOS — master only */}
    {view === 'usuarios' && isMaster && <UsersTab ops={ops} />}

    {/* CONFIG — master or admin */}
    {view === 'config' && canManage && <div style={{ padding: '24px 28px', maxWidth: 600 }}>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Gerenciar Operadoras</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input value={newOp} onChange={e => setNewOp(e.target.value)} placeholder="Nome da operadora..." style={{ ...css.input, width: '100%' }} onKeyDown={e => e.key === 'Enter' && addOp()} />
        <button onClick={addOp} style={{ ...css.btn, background: '#E8392A', color: '#fff', whiteSpace: 'nowrap' }}>+ Adicionar</button>
      </div>
      {ops.map((op, i) => <div key={i} style={{ ...css.card, marginBottom: 10, padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{op.name}</div>
            <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{op.devs.length} incorporadoras</div>
          </div>
          <button onClick={() => rmOp(op.name)} style={{ ...css.btn, background: 'rgba(232,57,42,0.1)', color: '#E8392A', fontSize: 11 }}>Remover</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#555', whiteSpace: 'nowrap' }}>E-mail relatório:</span>
          {editingEmail === op.name ? (
            <input type="email" defaultValue={op.email} autoFocus
              onBlur={async e => { await apiOps.updateEmail(op.name, e.target.value); setEditingEmail(null); reloadOps(); }}
              onKeyDown={async e => { if (e.key === 'Enter') { await apiOps.updateEmail(op.name, e.target.value); setEditingEmail(null); reloadOps(); } }}
              style={{ ...css.input, fontSize: 12, padding: '5px 10px', flex: 1 }} />
          ) : (
            <span onClick={() => setEditingEmail(op.name)}
              style={{ fontSize: 12, color: op.email ? '#f5f5f5' : '#444', fontFamily: "'JetBrains Mono',monospace", cursor: 'pointer', borderBottom: '1px dashed #333', flex: 1 }}>
              {op.email || 'clique para definir...'}
            </span>
          )}
        </div>
      </div>)}
    </div>}

    {/* OPERADORA */}
    {(view === 'operadora' || !canManage) && <>
      <div style={{ padding: '14px 28px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {canManage && ops.length > 0 && <div style={{ display: 'flex', gap: 4, background: '#0a0a0a', borderRadius: 8, padding: 3, border: '1px solid #1a1a1a' }}>
          {ops.map((op, i) => <button key={i} onClick={() => { setCurOp(op); setSelDev(null); }} style={{ ...css.btn, padding: '6px 14px', background: curOp?.name === op.name ? '#E8392A' : 'transparent', color: curOp?.name === op.name ? '#fff' : '#555', fontSize: 12 }}>{op.name}</button>)}
        </div>}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#555' }}>Período:</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...css.input, width: 140, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", padding: '7px 10px' }} />
          <span style={{ color: '#555', fontSize: 12 }}>até</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...css.input, width: 140, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", padding: '7px 10px' }} />
        </div>
      </div>

      {opsLoading ? <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
      : !curOp ? <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 48, opacity: .3, marginBottom: 12 }}>⚙</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: '#999' }}>
          {canManage ? 'Configure as operadoras primeiro' : 'Sua operadora ainda não tem carteira configurada'}
        </div>
        {canManage && <button onClick={() => setView('config')} style={{ ...css.btn, background: '#E8392A', color: '#fff', marginTop: 12 }}>Ir para Config</button>}
      </div> : <div style={{ display: 'flex', minHeight: 'calc(100vh - 120px)' }}>
        {/* SIDEBAR */}
        <aside style={{ width: 280, borderRight: '1px solid #1a1a1a', flexShrink: 0, overflowY: 'auto', maxHeight: 'calc(100vh - 120px)' }}>
          <div style={{ padding: '16px 16px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#555', letterSpacing: .5 }}>Carteira de {curOp.name}</div>
          {canManage && <div style={{ padding: '0 12px 12px', position: 'relative' }}>
            <input value={search} onChange={e => { setSearch(e.target.value); setShowDD(true); }} onFocus={() => setShowDD(true)}
              placeholder="+ Adicionar incorporadora..." style={{ ...css.input, width: '100%', fontSize: 12, padding: '8px 10px' }} />
            {showDD && search.length > 1 && filtered.length > 0 && <div style={{ position: 'absolute', top: '100%', left: 12, right: 12, background: '#141414', border: '1px solid #1a1a1a', borderRadius: 8, maxHeight: 200, overflowY: 'auto', zIndex: 60, boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>
              {filtered.map((d, i) => <div key={i} onClick={() => addDev(d)} style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', color: '#999', borderBottom: '1px solid #1a1a1a' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(232,57,42,0.07)'; e.currentTarget.style.color = '#f5f5f5'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#999'; }}>{d.label}</div>)}
            </div>}
          </div>}
          {curOp.devs.map((d, i) => <div key={i} style={{ borderLeft: selDev?.value === d.value ? '2px solid #E8392A' : '2px solid transparent', background: selDev?.value === d.value ? 'rgba(232,57,42,0.07)' : 'transparent', transition: 'all .15s' }}
            onMouseEnter={e => { if (selDev?.value !== d.value) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
            onMouseLeave={e => { if (selDev?.value !== d.value) e.currentTarget.style.background = 'transparent'; }}>
            <div onClick={() => setSelDev(d)} style={{ padding: '10px 16px 2px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: selDev?.value === d.value ? 600 : 400, color: selDev?.value === d.value ? '#f5f5f5' : '#999' }}>{d.label}</span>
              {canManage && <span onClick={e => { e.stopPropagation(); rmDev(d.value); }} style={{ fontSize: 11, color: '#555', cursor: 'pointer', padding: '2px 6px' }}
                onMouseEnter={e => e.currentTarget.style.color = '#E8392A'} onMouseLeave={e => e.currentTarget.style.color = '#555'}>✕</span>}
            </div>
            {/* Start date */}
            <div style={{ padding: '2px 16px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
              {canManage && editingDate === d.value ? (
                <input type="date" defaultValue={d.startDate} autoFocus
                  onBlur={e => updateDevDate(d.value, e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && updateDevDate(d.value, e.target.value)}
                  style={{ ...css.input, fontSize: 10, padding: '3px 6px', width: 120, fontFamily: "'JetBrains Mono',monospace" }} />
              ) : (
                <span onClick={e => { if (!canManage) return; e.stopPropagation(); setEditingDate(d.value); }}
                  style={{ fontSize: 10, color: '#444', fontFamily: "'JetBrains Mono',monospace", cursor: canManage ? 'pointer' : 'default', borderBottom: canManage ? '1px dashed #333' : 'none' }}
                  title={canManage ? "Clique para editar a data de início" : undefined}>
                  Início: {d.startDate ? new Date(d.startDate).toLocaleDateString('pt-BR') : 'definir'}
                </span>
              )}
            </div>
          </div>)}
          {!curOp.devs.length && <div style={{ padding: '20px 16px', fontSize: 12, color: '#555', textAlign: 'center' }}>
            {canManage ? 'Busque incorporadoras acima' : 'Nenhuma incorporadora na sua carteira'}
          </div>}
        </aside>

        {/* MAIN */}
        <main style={{ flex: 1, padding: '24px 28px 60px', overflowY: 'auto', maxHeight: 'calc(100vh - 120px)' }}>
          {/* Botões de relatório mensal */}
          {curOp && <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {reportMsg && <span style={{ fontSize: 12, color: reportMsg.ok ? '#22c55e' : '#E8392A', fontFamily: "'JetBrains Mono',monospace" }}>{reportMsg.text}</span>}
            <button onClick={() => window.open(`/relatorio-mensal?op=${encodeURIComponent(curOp.name)}`, '_blank')}
              style={{ ...css.btn, background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)', fontSize: 12 }}>
              📥 Download PDF Mensal
            </button>
            <button disabled={sendingReport} onClick={async () => {
              setSendingReport(true); setReportMsg(null);
              const r = await apiOps.sendReport(curOp.name);
              const json = await r.json();
              setReportMsg(json.ok ? { ok: true, text: `✓ Enviado para ${json.sentTo}` } : { ok: false, text: json.error });
              setSendingReport(false);
              setTimeout(() => setReportMsg(null), 5000);
            }} style={{ ...css.btn, background: sendingReport ? '#141414' : 'rgba(34,197,94,0.1)', color: sendingReport ? '#555' : '#22c55e', border: '1px solid rgba(34,197,94,0.2)', fontSize: 12 }}>
              {sendingReport ? 'Enviando...' : '📧 Enviar Relatório Mensal'}
            </button>
          </div>}
          {selDev ? <>
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ padding: '6px 14px', background: 'rgba(232,57,42,0.07)', border: '1px solid rgba(232,57,42,0.2)', borderRadius: 20, fontSize: 13, fontWeight: 600, color: '#E8392A' }}>{selDev.label}</div>
              {selDev.startDate && <div style={{ fontSize: 11, color: '#555', fontFamily: "'JetBrains Mono',monospace" }}>Operando desde {new Date(selDev.startDate).toLocaleDateString('pt-BR')}</div>}
              <button onClick={() => {
                const qs = new URLSearchParams({ op: curOp.name, dev: selDev.value, devLabel: selDev.label, ...(selDev.startDate ? { startDate: selDev.startDate } : {}) });
                window.open(`/relatorio?${qs}`, '_blank');
              }} style={{ marginLeft: 'auto', padding: '6px 14px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#3b82f6', cursor: 'pointer', fontFamily: 'inherit' }}>
                📄 Relatório PDF
              </button>
            </div>
            <IncView dev={selDev} dateFrom={dateFrom} dateTo={dateTo} startDate={selDev.startDate} />
          </> : <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>
            <div style={{ fontSize: 48, opacity: .3, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#999' }}>Selecione uma incorporadora na lateral</div>
          </div>}
        </main>
      </div>}
    </>}

    {/* DIRETORIA — master or admin */}
    {view === 'diretoria' && canManage && <DirView operadoras={ops} />}

    {showDD && <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setShowDD(false)} />}
    {showProfile && <ProfilePanel user={authUser} onClose={() => setShowProfile(false)} onUpdated={u => setAuthUser(prev => ({ ...prev, ...u }))} />}
  </div>;
}
