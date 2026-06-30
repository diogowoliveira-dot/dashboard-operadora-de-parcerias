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
const apiTarefas = {
  list: (operadora_name, year, month) => fetch(`/api/tarefas?operadora_name=${encodeURIComponent(operadora_name)}&year=${year}&month=${month}`).then(r => r.json()),
  create: (body) => fetch('/api/tarefas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  update: (body) => fetch('/api/tarefas', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  remove: (id) => fetch(`/api/tarefas?id=${id}`, { method: 'DELETE' }).then(r => r.json()),
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
      <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: '#555' }}>Marco: {new Date(startDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
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
  const [onbLd, setOnbLd] = useState(false);
  const [onbErr, setOnbErr] = useState(null);
  const [onbTotal, setOnbTotal] = useState(null); // total records returned by summary
  const [kpi, setKpi] = useState({});
  const [onbMap, setOnbMap] = useState({}); // { [operadora_name]: record[] }

  // Load onboarding summary independently (fast — DB only, no Grafana)
  const loadOnboarding = useCallback(async () => {
    setOnbLd(true);
    setOnbErr(null);
    try {
      const res = await fetch('/api/onboarding/summary');
      const sumJson = await res.json();
      console.log('[DirView] summary status=%d records=%d err=%s', res.status, sumJson.records?.length ?? -1, sumJson.error || '');
      if (sumJson.error) {
        setOnbErr(sumJson.error);
      } else if (Array.isArray(sumJson.records)) {
        setOnbTotal(sumJson.records.length);
        const grouped = {};
        for (const rec of sumJson.records) {
          // Normalize key: trim + lowercase comparison handled server-side via canonical_name.
          // Also build a lowercase-keyed lookup so DirView can find by normalized op.name.
          const key = rec.operadora_name; // already canonical (from operadoras table) after fix
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(rec);
        }
        console.log('[DirView] onbMap keys:', Object.keys(grouped), '| operadoras will match against these');
        setOnbMap(grouped);
      }
    } catch(e) {
      console.error('[DirView] loadOnboarding error:', e);
      setOnbErr(e.message);
    }
    setOnbLd(false);
  }, []);

  // Load Grafana KPI data (slow — external API)
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

  // Load onboarding from DB on mount (independent of Grafana / operadoras prop).
  // Separate effect so it fires immediately even if operadoras starts empty.
  useEffect(() => {
    loadOnboarding();
  }, []);

  // Load Grafana KPI data once operadoras becomes non-empty.
  // Using operadoras.length (not []) so we retry if DirView mounts before reloadOps finishes.
  const didGrafanaLoad = useRef(false);
  useEffect(() => {
    if (!operadoras.length || didGrafanaLoad.current) return;
    didGrafanaLoad.current = true;
    load();
  }, [operadoras.length]);

  const sum3 = (rows, k) => rows.slice(-3).reduce((s, r) => s + (Number(r[k]) || 0), 0);

  const mono = "'JetBrains Mono',monospace";

  return <div style={{ padding: '24px 28px 60px' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>Visão Diretoria</div>
        <div style={{ fontSize: 13, color: '#555', marginTop: 2 }}>Performance das operadoras e suas carteiras</div>
        {onbErr && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>⚠ Erro ao carregar onboarding: {onbErr}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={loadOnboarding} style={{ ...css.btn, background: '#141414', color: '#999', border: '1px solid #1a1a1a' }}>
          {onbLd ? 'Carregando...' : '↻ Onboarding'}
        </button>
        <button onClick={() => { load(); loadOnboarding(); }} style={{ ...css.btn, background: '#E8392A', color: '#fff' }}>
          {ld ? 'Carregando...' : '↻ Atualizar tudo'}
        </button>
      </div>
    </div>

    {ld ? <Spin /> : operadoras.map((op, oi) => {
      const devs = kpi[op.name] || [];
      // Lookup with exact match first, then case-insensitive fallback to handle any name mismatch
      const onbRecords = onbMap[op.name]
        || onbMap[Object.keys(onbMap).find(k => k.toLowerCase().trim() === op.name.toLowerCase().trim())]
        || [];
      const overdueCount = onbRecords.filter(r => r.overdue).length;

      return <div key={oi} style={{ marginBottom: 40 }}>
        {/* Operadora header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(232,57,42,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#E8392A' }}>{op.name.charAt(0)}</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{op.name}</div>
          <div style={{ fontSize: 12, color: '#555', fontFamily: mono }}>{op.devs.length} incorporadoras</div>
          {overdueCount > 0 && (
            <div style={{ fontSize: 11, fontFamily: mono, padding: '2px 10px', borderRadius: 20, background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', gap: 5 }}>
              ⚠ {overdueCount} onboarding{overdueCount > 1 ? 's' : ''} em atraso
            </div>
          )}
        </div>

        {/* Performance table */}
        <div style={{ ...css.card, marginBottom: 14 }}>
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
                <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: mono, color: '#E8392A', borderBottom: '1px solid #1a1a1a' }}>{fmt(a3)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: mono, color: '#3b82f6', borderBottom: '1px solid #1a1a1a' }}>{fmt(sum3(d.lp, 'total_links'))}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: mono, color: '#f59e0b', borderBottom: '1px solid #1a1a1a' }}>{fmt(sum3(d.im, 'imobiliarias'))}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: mono, borderBottom: '1px solid #1a1a1a', color: tr && Number(tr) >= 0 ? '#22c55e' : tr ? '#E8392A' : '#555' }}>
                  {tr ? `${Number(tr) >= 0 ? '↑' : '↓'} ${tr}%` : '—'}
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'center', fontFamily: mono, fontSize: 11, color: '#555', borderBottom: '1px solid #1a1a1a' }}>
                  {d.startDate ? new Date(d.startDate + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                </td>
              </tr>;
            })}</tbody>
          </table>
        </div>

        {/* Onboarding panel */}
        <div style={css.card}>
          <div style={{ ...css.cHead, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>🎯 Onboarding por incorporadora</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <span style={{ fontSize: 11, fontFamily: mono, color: onbRecords.length > 0 ? '#22c55e' : '#555' }}>{onbLd ? 'carregando...' : `${onbRecords.length}/${op.devs.length} com dados`}</span>
              {!onbLd && onbRecords.length === 0 && op.devs.length > 0 && onbTotal !== null && onbTotal > 0 && (
                <span style={{ fontSize: 10, fontFamily: mono, color: '#f59e0b' }}>
                  ⚠ Há registros no banco mas nenhum para "{op.name}"
                </span>
              )}
            </div>
          </div>

          {op.devs.length === 0 && (
            <div style={{ padding: '20px 16px', fontSize: 12, color: '#555', textAlign: 'center' }}>Nenhuma incorporadora na carteira</div>
          )}

          {op.devs.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr>
                <th style={css.th}>Incorporadora</th>
                <th style={{ ...css.th, textAlign: 'center' }}>Início onboarding</th>
                <th style={{ ...css.th, textAlign: 'center' }}>Dias</th>
                <th style={{ ...css.th, textAlign: 'center', width: 220 }}>Progresso</th>
                <th style={{ ...css.th, textAlign: 'center' }}>Fase</th>
                <th style={{ ...css.th, textAlign: 'center' }}>Status</th>
              </tr></thead>
              <tbody>{op.devs.map((d, di) => {
                const rec = onbRecords.find(r => String(r.dev_value) === String(d.value));
                // rec exists but pct=0 means "Em andamento 0%", not "Não iniciado"
                // null pct means no record at all → "Não iniciado"
                const hasRecord = rec !== undefined;
                const pct = hasRecord ? (rec.pct ?? 0) : null;
                const daysEl = rec?.daysElapsed ?? null;
                const overdue = rec?.overdue ?? false;
                const startDate = rec?.startDate ?? d.startDate ?? null;
                const fase = rec?.fase ?? null;

                // Bar color
                const barColor = pct === 100 ? '#22c55e' : overdue ? '#ef4444' : '#E8392A';

                // Phase pill colors
                const phaseColors = {
                  ONBOARDING: { bg: 'rgba(232,57,42,0.1)', color: '#E8392A' },
                  ATIVO: { bg: 'rgba(34,197,94,0.1)', color: '#22c55e' },
                  RISCO: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
                  PAUSADO: { bg: 'rgba(100,100,100,0.15)', color: '#888' },
                };
                const ph = fase ? (phaseColors[fase] || phaseColors.ONBOARDING) : null;

                return <tr key={di}>
                  <td style={{ padding: '12px 16px', color: '#f5f5f5', fontWeight: 600, borderBottom: '1px solid #1a1a1a' }}>{d.label}</td>

                  <td style={{ padding: '12px 16px', textAlign: 'center', fontFamily: mono, fontSize: 11, color: '#777', borderBottom: '1px solid #1a1a1a' }}>
                    {startDate ? new Date(startDate + 'T12:00:00').toLocaleDateString('pt-BR') : <span style={{ color: '#444' }}>—</span>}
                  </td>

                  <td style={{ padding: '12px 16px', textAlign: 'center', fontFamily: mono, fontSize: 12, borderBottom: '1px solid #1a1a1a',
                    color: daysEl === null ? '#444' : daysEl > 30 ? '#ef4444' : daysEl > 20 ? '#f59e0b' : '#22c55e' }}>
                    {daysEl !== null ? `${daysEl}d` : '—'}
                  </td>

                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a1a' }}>
                    {pct !== null ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#1a1a1a', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: barColor, transition: 'width .4s' }} />
                        </div>
                        <span style={{ fontFamily: mono, fontSize: 11, color: barColor, minWidth: 32, textAlign: 'right' }}>{pct}%</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#1a1a1a' }} />
                        <span style={{ fontFamily: mono, fontSize: 11, color: '#444', minWidth: 32, textAlign: 'right' }}>—</span>
                      </div>
                    )}
                  </td>

                  <td style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #1a1a1a' }}>
                    {fase && ph ? (
                      <span style={{ fontSize: 10, fontFamily: mono, letterSpacing: 0.5, padding: '2px 8px', borderRadius: 3, background: ph.bg, color: ph.color }}>
                        {fase}
                      </span>
                    ) : <span style={{ color: '#444', fontSize: 12 }}>—</span>}
                  </td>

                  <td style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #1a1a1a' }}>
                    {pct === 100 ? (
                      <span style={{ fontSize: 11, fontFamily: mono, padding: '2px 8px', borderRadius: 3, background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>✓ Concluído</span>
                    ) : overdue ? (
                      <span style={{ fontSize: 11, fontFamily: mono, padding: '2px 8px', borderRadius: 3, background: 'rgba(239,68,68,0.12)', color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: 4 }}>⚠ Em atraso</span>
                    ) : daysEl !== null && daysEl > 20 ? (
                      <span style={{ fontSize: 11, fontFamily: mono, padding: '2px 8px', borderRadius: 3, background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>⏱ Atenção</span>
                    ) : pct !== null ? (
                      <span style={{ fontSize: 11, fontFamily: mono, padding: '2px 8px', borderRadius: 3, background: 'rgba(232,57,42,0.08)', color: '#E8392A' }}>● Em andamento</span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#444' }}>Não iniciado</span>
                    )}
                  </td>
                </tr>;
              })}</tbody>
            </table>
          )}
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
// ONBOARDING — DATA
// ═══════════════════════════════════════════
const TRILHA_DWV = [
  { fase: 'Kick-off e Setup Inicial', tasks: [
    { id:'d1', text:'Realizar reunião de kick-off com toda a equipe do cliente', note:'Garantir presença: diretor, gerente, executivos, marketing e secretaria de vendas' },
    { id:'d2', text:'Mapear e documentar hierarquia de acessos', note:'Definir quem é master, gerencial e operacional' },
    { id:'d3', text:'Criar usuários e configurar níveis de acesso na plataforma' },
    { id:'d4', text:'Criar grupo de WhatsApp DWV + equipe do cliente', note:'Principal canal de comunicação durante o onboarding' },
    { id:'d5', text:'Configurar integração dos WhatsApps Business dos executivos', note:'Somente WhatsApp Business — não pessoal', badge:'block', badgeText:'Bloqueante' },
  ]},
  { fase: 'Engenharia de Dados', tasks: [
    { id:'d6', text:'Importar planilha de corretores para o CRM', note:'Formato mínimo: nome, telefone, e-mail, imobiliária', badge:'block', badgeText:'Bloqueante' },
    { id:'d7', text:'Criar imobiliárias no sistema e vincular corretores' },
    { id:'d8', text:'Classificar corretores em Ouro / Prata / Bronze', note:'Ouro = vendeu nos últimos 12m; Prata = engajado mas não vendeu; Bronze = inativo' },
    { id:'d9', text:'Distribuir carteiras por executivo', note:'Critério: por região, por imobiliária, ou roleta automática para novos leads' },
    { id:'d10', text:'Configurar Kanban com nomenclatura do cliente', note:'Sugestão: Diamante / Ouro / Prata / Bronze — ou adaptar ao vocabulário do cliente' },
  ]},
  { fase: 'Configuração de Produto', tasks: [
    { id:'d11', text:'Fazer upload das tabelas de preço no sistema', note:'Verificar produtos em tabela zero — configurar acesso restrito antes de subir' },
    { id:'d12', text:'Definir quais produtos entram em Tabela Zero e liberar apenas para Ouro', badge:'info', badgeText:'Atenção' },
    { id:'d13', text:'Fazer upload de materiais: plantas, fotos, vídeos, apresentação e book comercial' },
    { id:'d14', text:'Configurar espelho de vendas (disponível / reservado / vendido)' },
    { id:'d15', text:'Verificar e ajustar integração com CV (ou desvincular se necessário)', note:'Desvincular quando unidades ainda não têm registro de incorporação' },
    { id:'d16', text:'Validar tabela ao vivo com o cliente antes de liberar para corretores', badge:'block', badgeText:'Bloqueante' },
  ]},
  { fase: 'IA e Automação', tasks: [
    { id:'d17', text:'Configurar IA de atendimento com FAQ do produto', note:'Cobrir: disponibilidade, prazo, pagamento, como agendar visita, como solicitar tabela' },
    { id:'d18', text:'Testar fluxo completo: corretor pergunta → IA responde → escalonamento humano' },
    { id:'d19', text:'Configurar integração Meta Ads → CRM (se cliente tiver tráfego pago)', note:'Necessário ter pessoa de marketing do lado do cliente' },
    { id:'d20', text:'Configurar roleta de distribuição de leads ou definir regra manual' },
  ]},
  { fase: 'Primeiras Ativações', tasks: [
    { id:'d21', text:'Criar primeiro evento ou webinar de produto', note:'Treinamento, apresentação de lançamento ou café com corretores' },
    { id:'d22', text:'Gerar QR Codes para check-in: obras, decorado, stand de vendas, treinamentos' },
    { id:'d23', text:'Disparo do primeiro WhatsApp segmentado por tier', note:'Ouro → acesso exclusivo / Prata → novidade / Bronze → prova social' },
    { id:'d24', text:'Monitorar primeiros acessos, compartilhamentos e ações dos corretores' },
    { id:'d25', text:'Identificar corretores da base já na plataforma DWV e priorizá-los' },
  ]},
  { fase: 'Relatório e Ajuste (Fim do Mês 1)', tasks: [
    { id:'d26', text:'Apresentar relatório de performance do mês 1 ao diretor/gerente', note:'Incluir: TE atual, propostas, corretores ativados, imobiliárias integradas, acessos' },
    { id:'d27', text:'Revisar carteiras se necessário (redistribuição por performance)' },
    { id:'d28', text:'Ajustar comunicação por segmento com base nos resultados das primeiras campanhas' },
    { id:'d29', text:'Definir metas de proposta para o mês 2' },
    { id:'d30', text:'Avaliar viabilidade de campanha Meta para captação de corretores externos', note:'Indicado para regiões fora do litoral: Londrina, Curitiba, Campo Grande' },
  ]},
];

const TRILHA_CLI = [
  { fase: 'Cliente fornece — Setup', tasks: [
    { id:'c1', text:'Planilha de corretores: nome, telefone, e-mail e imobiliária', note:'Excel ou Google Sheets. Mínimo: nome + telefone', badge:'block', badgeText:'Bloqueante' },
    { id:'c2', text:'Lista de imobiliárias parceiras com classificação de prioridade', note:'Indicar meta (diamante), ouro, prata e bronze' },
    { id:'c3', text:'Números de WhatsApp Business de cada executivo', note:'Devem ser WhatsApp Business, não pessoal', badge:'block', badgeText:'Bloqueante' },
    { id:'c4', text:'Definir quem aprova tabela antes de subir (ponto de contato interno)' },
    { id:'c5', text:'Informar critério de distribuição de carteiras', note:'Por região, por imobiliária, rodízio automático ou definição manual' },
  ]},
  { fase: 'Cliente fornece — Produto', tasks: [
    { id:'c6', text:'Tabelas de preço atualizadas em formato editável', note:'Excel, Corel ou similar. Informar responsável por atualizar' },
    { id:'c7', text:'Materiais: plantas, renders 3D, fotos de obra, vídeo de apresentação', badge:'info', badgeText:'Quanto antes' },
    { id:'c8', text:'Book comercial / apresentação do empreendimento (PDF)' },
    { id:'c9', text:'Fotos e vídeos de acompanhamento de obra (mensal)' },
    { id:'c10', text:'Informar produtos em tabela zero e confirmar quais imobiliárias têm acesso', badge:'block', badgeText:'Crítico' },
  ]},
  { fase: 'Cliente fornece — Comunicação', tasks: [
    { id:'c11', text:'Definir tom de voz e preferências de comunicação com corretores', note:'Formal ou informal? Restrições de conteúdo? Concorrentes a não citar?' },
    { id:'c12', text:'Validar templates WhatsApp por tier (Ouro / Prata / Bronze) antes do primeiro disparo' },
    { id:'c13', text:'Indicar contato de marketing interno para alinhamento de stories e campanhas', note:'Quem produz criativos? Tem agência? Qual prazo de resposta?' },
    { id:'c14', text:'Fornecer acesso ao Meta Business (se tiver campanha de atração de corretor)' },
  ]},
  { fase: 'Cliente fornece — Ongoing', tasks: [
    { id:'c15', text:'Informar vendas realizadas para manter espelho atualizado', note:'A cada venda: unidade, data, corretor responsável' },
    { id:'c16', text:'Avisar de novos lançamentos ou mudanças de tabela com mínimo 3 dias de antecedência' },
    { id:'c17', text:'Participar de reunião quinzenal de alinhamento (mínimo 30 min)' },
    { id:'c18', text:'Validar e aprovar propostas enviadas por corretores dentro de 24h', note:'Propostas sem retorno em 24h afastam o corretor e travam o funil' },
  ]},
];

// ═══════════════════════════════════════════
// ONBOARDING TAB
// ═══════════════════════════════════════════
function OnboardingTab({ opName, operadoraName = '', devValue = '', devLabel = '', startDate = '' }) {
  const KEY = `dwv_onboarding_${opName}`;
  const defaultSt = { client: { operadora: devLabel, inicio: startDate, fase: 'ONBOARDING' }, diag: {}, checks: {}, tasks: [], notes: '', taskFilter: 'todas', _savedAt: 0 };

  const [st, setSt] = useState(() => {
    // Start with localStorage as fast cache while API loads
    try {
      const r = localStorage.getItem(KEY);
      if (r) {
        const parsed = JSON.parse(r);
        return { ...defaultSt, ...parsed, client: { operadora: devLabel, inicio: startDate, fase: 'ONBOARDING', ...parsed.client } };
      }
    } catch(e) {}
    return defaultSt;
  });
  const [apiLoading, setApiLoading] = useState(true);
  const saveTimer = useRef(null);
  // FIX: ref que guarda o estado PENDENTE de flush para a API
  // Usado pelo beforeunload para não depender do localStorage (que pode falhar em modo privado)
  const pendingSave = useRef(null);

  // Load from API on mount / when incorporadora changes
  useEffect(() => {
    if (!operadoraName || !devValue) { setApiLoading(false); return; }
    setApiLoading(true);

    // FIX: AbortController evita que fetch retornado após troca de incorporadora sobrescreva estado
    const abortCtrl = new AbortController();

    fetch(`/api/onboarding?op=${encodeURIComponent(operadoraName)}&dev=${encodeURIComponent(devValue)}`,
      { signal: abortCtrl.signal })
      .then(r => r.json())
      .then(json => {
        if (json.data) {
          // Remove false values from checks (legacy: before we removed false on uncheck)
          const rawChecks = json.data.checks || {};
          const cleanChecks = Object.fromEntries(Object.entries(rawChecks).filter(([, v]) => v === true));
          const apiUpdatedAt = json.data.updatedAt ? new Date(json.data.updatedAt).getTime() : 0;
          const apiSt = { ...defaultSt, ...json.data, checks: cleanChecks, client: { operadora: devLabel, inicio: startDate, fase: 'ONBOARDING', ...json.data.client }, _savedAt: apiUpdatedAt };
          setSt(prev => {
            if (pendingSave.current) return prev; // usuário modificou durante o load → mantém
            // FIX: se localStorage é mais novo que API (e.g. PUT ainda em voo por outro mount),
            // mantém estado local e dispara resave para sincronizar o banco
            if ((prev._savedAt || 0) > apiUpdatedAt) {
              setTimeout(() => flushToApi(buildPayload(prev)), 50);
              return prev;
            }
            return apiSt;
          });
          try { localStorage.setItem(KEY, JSON.stringify(apiSt)); } catch(e) {}
        } else {
          // No API record yet — try new key, then fall back to old key (pre-refactor migration)
          const OLD_KEY = `dwv_onboarding_${operadoraName}`; // key before per-incorporadora refactor
          try {
            const newRaw = localStorage.getItem(KEY);
            const oldRaw = !newRaw ? localStorage.getItem(OLD_KEY) : null;
            const raw = newRaw || oldRaw;
            if (raw) {
              const parsed = JSON.parse(raw);
              const localSt = { ...defaultSt, ...parsed, client: { operadora: devLabel, inicio: startDate, fase: 'ONBOARDING', ...parsed.client } };
              setSt(prev => pendingSave.current ? prev : localSt);
              try { localStorage.setItem(KEY, JSON.stringify(localSt)); } catch(e) {}
              // Auto-sync to API immediately
              if (operadoraName && devValue) {
                fetch('/api/onboarding', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    op: operadoraName, dev: String(devValue), devLabel,
                    checks: localSt.checks || {}, diag: localSt.diag || {},
                    client: localSt.client || {}, tasks: localSt.tasks || [], notes: localSt.notes || '',
                  }),
                }).catch(() => {});
              }
            } else {
              setSt(prev => pendingSave.current ? prev : defaultSt);
            }
          } catch(e) { setSt(prev => pendingSave.current ? prev : defaultSt); }
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') return; // troca de incorporadora — ignorar
        // API unavailable — fall back to localStorage
        try {
          const r = localStorage.getItem(KEY);
          if (r) {
            const parsed = JSON.parse(r);
            setSt(prev => pendingSave.current ? prev : { ...defaultSt, ...parsed, client: { operadora: devLabel, inicio: startDate, fase: 'ONBOARDING', ...parsed.client } });
          }
        } catch(e) {}
      })
      .finally(() => setApiLoading(false));

    // FIX: cancela fetch se incorporadora mudar antes da resposta chegar
    return () => abortCtrl.abort();
  }, [opName]);

  // FIX: flush imediato ao desmontar (troca de sub-aba Dados↔Onboarding)
  // operadoraName/devValue/devLabel não mudam dentro de uma instância (key prop garante remount)
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      if (pendingSave.current && operadoraName && devValue) {
        const s = pendingSave.current;
        fetch('/api/onboarding', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            op: operadoraName, dev: String(devValue), devLabel,
            checks: s.checks || {}, diag: s.diag || {},
            client: s.client || {}, tasks: s.tasks || [], notes: s.notes || '',
          }),
          keepalive: true,
        });
        pendingSave.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — deps são constantes por instância

  // Helper: monta payload para API
  const buildPayload = useCallback((s) => ({
    op: operadoraName,
    dev: String(devValue),
    devLabel,
    checks: s.checks || {},
    diag: s.diag || {},
    client: s.client || {},
    tasks: s.tasks || [],
    notes: s.notes || '',
  }), [operadoraName, devValue, devLabel]);

  // Helper: envia para API com keepalive (funciona mesmo no beforeunload)
  const flushToApi = useCallback((payload, silent = false) => {
    if (!payload?.op || !payload?.dev) return Promise.resolve(); // guarda: nunca envia payload vazio
    if (!silent) setSaveStatus('saving');
    return fetch('/api/onboarding', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true, // garante envio mesmo ao fechar aba
    })
    .then(r => {
      if (!silent) {
        setSaveStatus(r.ok ? 'saved' : 'error');
        clearTimeout(saveStatusTimer.current);
        if (r.ok) saveStatusTimer.current = setTimeout(() => setSaveStatus(''), 2500);
      }
    })
    .catch(() => {
      if (!silent) setSaveStatus('error');
    });
  }, []);

  // Debounced save: localStorage (instant) + API (1 s debounce)
  const save = useCallback((upd) => {
    setSt(prev => {
      const raw = typeof upd === 'function' ? upd(prev) : { ...prev, ...upd };
      const next = { ...raw, _savedAt: Date.now() }; // timestamp para comparar com API
      // Write-through to localStorage imediatamente
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch(e) {
        console.warn('[ONB] localStorage write failed:', e?.name);
      }
      // FIX: rastreia estado pendente via ref (não depende do localStorage para beforeunload)
      pendingSave.current = next;
      // Debounce API save
      if (operadoraName && devValue) {
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          saveTimer.current = null; // timer disparou; beforeunload não precisa cancelar
          const snapshot = next; // captura referência do estado sendo salvo
          flushToApi(buildPayload(next)).then(() => {
            // Só limpa se nenhuma nova alteração chegou depois que esse flush começou
            if (pendingSave.current === snapshot) pendingSave.current = null;
          });
        }, 1000);
      }
      return next;
    });
  }, [KEY, operadoraName, devValue, buildPayload, flushToApi]);

  // Force-save antes do usuário fechar a aba (evita perda de dados)
  useEffect(() => {
    if (!operadoraName || !devValue) return;
    const handleUnload = () => {
      // FIX: usa pendingSave.current (estado real pendente) em vez de localStorage
      // Evita enviar payload zerado se localStorage falhar (modo privado / quota)
      if (saveTimer.current && pendingSave.current) {
        clearTimeout(saveTimer.current);
        flushToApi(buildPayload(pendingSave.current), true); // silent: componente está desmontando
        pendingSave.current = null;
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [KEY, operadoraName, devValue, buildPayload, flushToApi]);

  const [showDiag, setShowDiag] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showTask, setShowTask] = useState(false);
  const [noteSaved, setNoteSaved] = useState('');
  const [saveStatus, setSaveStatus] = useState(''); // '' | 'saving' | 'saved' | 'error'
  const noteTimer = useRef(null);
  const saveStatusTimer = useRef(null);

  useEffect(() => {
    const fn = (e) => {
      if (e.key === 'Escape') { setShowDiag(false); setShowConfig(false); setShowTask(false); }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  // — computed
  const allChecks = [...TRILHA_DWV, ...TRILHA_CLI].flatMap(f => f.tasks);
  const doneCnt = allChecks.filter(t => st.checks[t.id]).length;
  const pct = allChecks.length ? Math.round(doneCnt / allChecks.length * 100) : 0;
  const dwvAll = TRILHA_DWV.flatMap(f => f.tasks);
  const cliAll = TRILHA_CLI.flatMap(f => f.tasks);
  const dwvDone = dwvAll.filter(t => st.checks[t.id]).length;
  const cliDone = cliAll.filter(t => st.checks[t.id]).length;
  const ptTotal = (st.tasks || []).length;
  const ptDone = (st.tasks || []).filter(t => t.done).length;

  const phColors = {
    ONBOARDING: { bg: 'rgba(232,57,42,0.12)', color: '#E8392A', border: 'rgba(232,57,42,0.3)' },
    ATIVO: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', border: 'rgba(34,197,94,0.3)' },
    RISCO: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'rgba(239,68,68,0.3)' },
    PAUSADO: { bg: 'rgba(100,100,100,0.2)', color: '#888', border: '#333' },
  };
  const ph = phColors[st.client.fase] || phColors.ONBOARDING;

  const mono = "'IBM Plex Mono', 'JetBrains Mono', monospace";
  const sans = "'IBM Plex Sans', 'DM Sans', sans-serif";
  const bebas = "'Bebas Neue', sans-serif";

  const sortedTasks = [...(st.tasks || [])].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const pm = { alta: 0, media: 1, baixa: 2 };
    return (pm[a.prio] || 1) - (pm[b.prio] || 1);
  });
  const filteredTasks = sortedTasks.filter(t =>
    st.taskFilter === 'abertas' ? !t.done : st.taskFilter === 'concluidas' ? t.done : true
  );

  const toggleCheck = (id) => save(p => {
    const newChecks = { ...p.checks };
    if (newChecks[id]) { delete newChecks[id]; } // desmarcar: remove a chave
    else { newChecks[id] = true; }              // marcar: true explícito
    return { ...p, checks: newChecks };
  });
  const toggleFase = (id) => save(p => ({ ...p, [id]: p[id] !== false ? false : true }));
  const isFaseOpen = (id) => st[id] !== false;

  // — badge component (inline)
  const Badge = ({ type, text }) => {
    const bc = type === 'block' ? { bg: 'rgba(232,57,42,0.15)', color: '#E8392A', border: 'rgba(232,57,42,0.3)' }
      : type === 'info' ? { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: 'rgba(59,130,246,0.3)' }
      : { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' };
    return <span style={{ fontSize: 9, fontFamily: mono, letterSpacing: 1, textTransform: 'uppercase', padding: '2px 7px', borderRadius: 2, background: bc.bg, color: bc.color, border: `1px solid ${bc.border}`, flexShrink: 0 }}>{text}</span>;
  };

  // — task row (trilha)
  const TaskRow = ({ task, isDwv }) => {
    const checked = !!st.checks[task.id];
    const accentColor = isDwv ? '#E8392A' : '#f59e0b';
    return (
      <div style={{ padding: '9px 14px', borderBottom: '1px solid #1a1a1a', opacity: checked ? 0.5 : 1, transition: 'opacity .2s' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div onClick={() => toggleCheck(task.id)} style={{ width: 15, height: 15, borderRadius: 3, border: `1.5px solid ${checked ? accentColor : '#333'}`, background: checked ? accentColor : 'transparent', flexShrink: 0, marginTop: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}>
            {checked && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontFamily: sans, color: checked ? '#555' : '#d4d4d4', textDecoration: checked ? 'line-through' : 'none', lineHeight: 1.4 }}>{task.text}</span>
              {task.badge && <Badge type={task.badge} text={task.badgeText} />}
            </div>
            {task.note && <div style={{ fontSize: 11, color: '#555', fontFamily: sans, marginTop: 3, lineHeight: 1.4 }}>{task.note}</div>}
          </div>
        </div>
      </div>
    );
  };

  // — fase column
  const FaseCol = ({ fase, faseIdx, isDwv }) => {
    if (!fase) return <div />;
    const faseId = `${isDwv ? 'dwv' : 'cli'}_fase_${faseIdx}`;
    const open = isFaseOpen(faseId);
    const tasks = fase.tasks;
    const done = tasks.filter(t => st.checks[t.id]).length;
    const accentColor = isDwv ? '#E8392A' : '#f59e0b';
    const hdrBg = isDwv ? '#111' : 'rgba(245,158,11,0.05)';
    const hdrBorder = isDwv ? '#1e1e1e' : 'rgba(245,158,11,0.15)';
    return (
      <div style={{ border: `1px solid ${hdrBorder}`, borderRadius: 6, overflow: 'hidden' }}>
        <div onClick={() => toggleFase(faseId)} style={{ background: hdrBg, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
          <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 600, color: accentColor, letterSpacing: 1 }}>F{faseIdx + 1}</span>
          <span style={{ fontSize: 12, fontFamily: sans, fontWeight: 600, color: '#ccc', flex: 1 }}>{fase.fase}</span>
          <span style={{ fontFamily: mono, fontSize: 10, color: done === tasks.length && tasks.length > 0 ? '#22c55e' : '#555' }}>{done}/{tasks.length}</span>
          <span style={{ color: '#444', fontSize: 10 }}>{open ? '▾' : '▸'}</span>
        </div>
        {open && <div>{tasks.map(t => <TaskRow key={t.id} task={t} isDwv={isDwv} />)}</div>}
      </div>
    );
  };

  // — modal base
  const Modal = ({ show, onClose, title, children, width = 520 }) => {
    if (!show) return null;
    return (
      <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#161616', border: '1px solid #272727', borderRadius: 6, padding: '28px 32px', width, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
          <div style={{ fontFamily: bebas, fontSize: 26, letterSpacing: 1, color: '#f0ede8', marginBottom: 20 }}>{title}</div>
          {children}
        </div>
      </div>
    );
  };

  const ModalField = ({ label, children }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#666', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
  const mInput = { background: '#1e1e1e', border: '1px solid #272727', borderRadius: 4, padding: '9px 12px', color: '#f0ede8', fontFamily: sans, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' };

  // — save diag modal
  const saveDiag = (e) => {
    e.preventDefault();
    const f = e.target;
    save(p => ({ ...p, diag: { ...p.diag,
      te: f['f-te'].value, base: f['f-base'].value, ativos: f['f-ativos'].value,
      ociosa: f['f-ociosa'].value, alvo: f['f-alvo'].value, vgv: f['f-vgv'].value,
      propostas: f['f-propostas'].value, imob: f['f-imob'].value, ticket: f['f-ticket'].value,
      diretor: f['f-diretor'].value, gerente: f['f-gerente'].value,
      executivos: f['f-executivos'].value, marketing: f['f-marketing'].value,
      produtos: f['f-produtos'].value, obs: f['f-obs'].value,
    }}));
    setShowDiag(false);
  };

  const saveConfig = (e) => {
    e.preventDefault();
    const f = e.target;
    save(p => ({ ...p, client: { ...p.client, operadora: f['fc-operadora'].value, inicio: f['fc-inicio'].value, fase: f['fc-fase'].value } }));
    setShowConfig(false);
  };

  const addTask = (e) => {
    e.preventDefault();
    const f = e.target;
    const titulo = f['ft-titulo'].value.trim();
    if (!titulo) return;
    const newTask = { id: Date.now().toString(), titulo, prio: f['ft-prio'].value, obs: f['ft-obs'].value, done: false, createdAt: new Date().toISOString() };
    save(p => ({ ...p, tasks: [...(p.tasks || []), newTask] }));
    setShowTask(false);
  };

  const d = st.diag || {};

  return (
    <div style={{ fontFamily: sans, background: '#080808', minHeight: 'calc(100vh - 60px)', color: '#f0ede8' }}>
      {/* ── TOP BAR ── */}
      <div style={{ background: 'rgba(8,8,8,0.97)', borderBottom: '1px solid #161616', padding: '0 24px', display: 'flex', alignItems: 'center', height: 48, gap: 16 }}>
        <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', padding: '2px 9px', borderRadius: 2, background: ph.bg, color: ph.color, border: `1px solid ${ph.border}` }}>{st.client.fase}</span>
        {st.client.inicio && (
          <span style={{ fontFamily: mono, fontSize: 10, color: '#555', letterSpacing: 0.5 }}>
            Início: {new Date(st.client.inicio + 'T12:00:00').toLocaleDateString('pt-BR')}
            {' · '}
            {Math.floor((Date.now() - new Date(st.client.inicio + 'T12:00:00').getTime()) / 86400000)}d
          </span>
        )}
        <div style={{ flex: 1 }} />
        {saveStatus === 'saving' && <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: '#555', letterSpacing: 0.5 }}>Salvando…</span>}
        {saveStatus === 'saved'  && <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: '#22c55e', letterSpacing: 0.5 }}>✓ Salvo</span>}
        {saveStatus === 'error'  && <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: '#E8392A', letterSpacing: 0.5 }}>⚠ Erro ao salvar</span>}
        <button onClick={() => setShowDiag(true)} style={{ background: '#161616', border: '1px solid #272727', borderRadius: 4, padding: '5px 12px', cursor: 'pointer', fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: '#666', display: 'flex', alignItems: 'center', gap: 6 }}>📊 Diagnóstico</button>
        <button onClick={() => setShowConfig(true)} style={{ background: '#161616', border: '1px solid #272727', borderRadius: 4, padding: '5px 12px', cursor: 'pointer', fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: '#666' }}>⚙ Config</button>
      </div>

      {/* ── DIAGNÓSTICO BAR ── */}
      <div style={{ background: '#0f0f0f', borderBottom: '1px solid #161616', padding: '10px 24px', display: 'flex', alignItems: 'center', overflowX: 'auto', gap: 0 }}>
        {[
          { id: 'd-te', label: 'TE Atual', val: d.te, color: '#E8392A' },
          { id: 'd-base', label: 'Base total', val: d.base },
          { id: 'd-ativos', label: 'Ativos', val: d.ativos, color: '#22c55e' },
          { id: 'd-ociosa', label: 'Base ociosa', val: d.ociosa, color: '#f59e0b' },
          { id: 'd-alvo', label: 'Alvo corretores', val: d.alvo },
          { id: 'd-vgv', label: 'VGV alvo 12m', val: d.vgv },
          { id: 'd-propostas', label: 'Propostas/mês', val: d.propostas },
          { id: 'd-imob', label: 'Imobiliárias', val: d.imob },
          { id: 'd-ticket', label: 'Ticket médio', val: d.ticket },
        ].map((item, i, arr) => (
          <div key={item.id} style={{ display: 'flex', flexDirection: 'column', padding: '0 20px', borderRight: i < arr.length - 1 ? '1px solid #1e1e1e' : 'none', flexShrink: 0 }}>
            <span style={{ fontFamily: mono, fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: '#666', marginBottom: 2 }}>{item.label}</span>
            <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 500, color: item.color || '#f0ede8' }}>{item.val || '—'}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', paddingLeft: 20, flexShrink: 0 }}>
          <button onClick={() => setShowDiag(true)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontFamily: mono, fontSize: 11 }}>editar ✎</button>
        </div>
      </div>

      {/* ── ORG PILLS ── */}
      <div style={{ background: '#0f0f0f', borderBottom: '1px solid #161616', padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {[
          { label: 'Diretor', val: d.diretor },
          { label: 'Gerente', val: d.gerente },
          { label: 'Executivos', val: d.executivos },
          { label: 'Marketing', val: d.marketing },
        ].map(({ label, val }) => (
          <div key={label} style={{ background: '#1e1e1e', border: '1px solid #272727', borderRadius: 20, padding: '4px 12px', fontFamily: mono, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: '#666' }}>
            {label}: <strong style={{ color: '#ccc' }}>{val || '—'}</strong>
          </div>
        ))}
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', minHeight: 'calc(100vh - 200px)' }}>
        {/* LEFT — fases */}
        <div style={{ borderRight: '1px solid #161616', padding: '20px 24px' }}>
          {/* Progress */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: '#555' }}>Progresso do Onboarding</span>
                <span style={{ fontFamily: bebas, fontSize: 22, color: pct === 100 ? '#22c55e' : '#E8392A', letterSpacing: 1 }}>{pct}%</span>
              </div>
              <span style={{ fontFamily: mono, fontSize: 11, color: '#555' }}>{doneCnt} / {allChecks.length} tarefas</span>
            </div>
            <div style={{ height: 4, background: '#1e1e1e', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: pct === 100 ? '#22c55e' : '#E8392A', width: pct + '%', transition: 'width .4s', borderRadius: 2 }} />
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
            <div style={{ background: 'rgba(232,57,42,0.06)', border: '1px solid rgba(232,57,42,0.15)', borderRadius: 6, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>⚙</span>
              <div>
                <div style={{ fontFamily: mono, fontSize: 9, color: '#E8392A', letterSpacing: 1, textTransform: 'uppercase' }}>DWV executa</div>
                <div style={{ fontFamily: mono, fontSize: 11, color: '#ccc', marginTop: 1 }}>{dwvDone}/{dwvAll.length}</div>
              </div>
            </div>
            <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 6, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>📋</span>
              <div>
                <div style={{ fontFamily: mono, fontSize: 9, color: '#f59e0b', letterSpacing: 1, textTransform: 'uppercase' }}>Cliente fornece</div>
                <div style={{ fontFamily: mono, fontSize: 11, color: '#ccc', marginTop: 1 }}>{cliDone}/{cliAll.length}</div>
              </div>
            </div>
          </div>

          {/* Paired phases */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: Math.max(TRILHA_DWV.length, TRILHA_CLI.length) }, (_, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <FaseCol fase={TRILHA_DWV[i]} faseIdx={i} isDwv={true} />
                <FaseCol fase={TRILHA_CLI[i]} faseIdx={i} isDwv={false} />
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — sidebar */}
        <div style={{ padding: '20px 20px', overflowY: 'auto' }}>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 20 }}>
            {[{ label: 'Total', val: ptTotal, color: '#f0ede8' }, { label: 'Feitas', val: ptDone, color: '#22c55e' }, { label: 'Abertas', val: ptTotal - ptDone, color: '#E8392A' }].map(s => (
              <div key={s.label} style={{ background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 6, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontFamily: bebas, fontSize: 22, color: s.color, letterSpacing: 1 }}>{s.val}</div>
                <div style={{ fontFamily: mono, fontSize: 9, color: '#555', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tarefas Pontuais */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: mono, fontSize: 10, color: '#555', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>02 Tarefas Pontuais</div>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              {['todas', 'abertas', 'concluidas'].map(f => (
                <button key={f} onClick={() => save(p => ({ ...p, taskFilter: f }))} style={{ fontFamily: mono, fontSize: 9, letterSpacing: 1, textTransform: 'capitalize', padding: '4px 10px', borderRadius: 3, border: 'none', cursor: 'pointer', background: st.taskFilter === f ? '#E8392A' : '#1e1e1e', color: st.taskFilter === f ? '#fff' : '#555', transition: 'all .15s' }}>
                  {f === 'todas' ? 'Todas' : f === 'abertas' ? 'Abertas' : 'Feitas'}
                </button>
              ))}
            </div>
            {/* Task list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredTasks.map(t => {
                const prioColor = t.prio === 'alta' ? '#E8392A' : t.prio === 'media' ? '#f59e0b' : '#555';
                const prioLabel = t.prio === 'alta' ? 'Alta' : t.prio === 'media' ? 'Média' : 'Baixa';
                return (
                  <div key={t.id} style={{ background: '#0f0f0f', border: '1px solid #1e1e1e', borderRadius: 5, padding: '10px 12px', opacity: t.done ? 0.4 : 1, transition: 'opacity .2s' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <div onClick={() => save(p => ({ ...p, tasks: p.tasks.map(x => x.id === t.id ? { ...x, done: !x.done } : x) }))} style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${t.done ? '#E8392A' : '#333'}`, background: t.done ? '#E8392A' : 'transparent', flexShrink: 0, marginTop: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {t.done && <span style={{ color: '#fff', fontSize: 9 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontFamily: sans, color: t.done ? '#444' : '#ccc', textDecoration: t.done ? 'line-through' : 'none', marginBottom: 4 }}>{t.titulo}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: prioColor, flexShrink: 0 }} />
                          <span style={{ fontFamily: mono, fontSize: 9, color: prioColor, letterSpacing: 0.5 }}>{prioLabel}</span>
                        </div>
                        {t.obs && <div style={{ fontSize: 11, color: '#444', fontFamily: sans, marginTop: 4 }}>{t.obs}</div>}
                      </div>
                      <button onClick={() => save(p => ({ ...p, tasks: p.tasks.filter(x => x.id !== t.id) }))} style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '0 2px', transition: 'color .15s' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#E8392A'} onMouseLeave={e => e.currentTarget.style.color = '#333'}>×</button>
                    </div>
                  </div>
                );
              })}
            </div>
            {filteredTasks.length === 0 && <div style={{ fontSize: 12, color: '#444', fontFamily: sans, textAlign: 'center', padding: '12px 0' }}>Nenhuma tarefa</div>}
            <button onClick={() => setShowTask(true)} style={{ width: '100%', marginTop: 10, padding: '8px 12px', background: 'none', border: '1px dashed #272727', borderRadius: 5, cursor: 'pointer', fontFamily: mono, fontSize: 10, letterSpacing: 1, color: '#444', textTransform: 'uppercase', transition: 'all .2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#E8392A'; e.currentTarget.style.color = '#E8392A'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#272727'; e.currentTarget.style.color = '#444'; }}>
              + Nova tarefa
            </button>
          </div>

          {/* Notes */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontFamily: mono, fontSize: 10, color: '#555', letterSpacing: 1.5, textTransform: 'uppercase' }}>Notas do cliente</div>
              {noteSaved && <span style={{ fontFamily: mono, fontSize: 9, color: '#444' }}>salvo · {noteSaved}</span>}
            </div>
            <textarea
              value={st.notes || ''}
              onChange={e => {
                const val = e.target.value;
                save(p => ({ ...p, notes: val }));
                clearTimeout(noteTimer.current);
                noteTimer.current = setTimeout(() => setNoteSaved(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })), 400);
              }}
              placeholder="Anotações sobre o cliente, pendências, contexto..."
              style={{ width: '100%', background: '#161616', border: '1px solid #272727', borderRadius: 5, padding: '10px 12px', color: '#ccc', fontFamily: sans, fontSize: 12, lineHeight: 1.6, resize: 'vertical', minHeight: 120, outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = '#E8392A'}
              onBlur={e => e.target.style.borderColor = '#272727'}
            />
          </div>
        </div>
      </div>

      {/* ── MODAL DIAGNÓSTICO ── */}
      <Modal show={showDiag} onClose={() => setShowDiag(false)} title="Diagnóstico Comercial" width={560}>
        <form onSubmit={saveDiag}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            {[['TE Atual (%)', 'f-te', d.te], ['Total de Corretores na Base', 'f-base', d.base], ['Corretores Ativos', 'f-ativos', d.ativos], ['Base Ociosa', 'f-ociosa', d.ociosa], ['Alvo de Corretores Ativos', 'f-alvo', d.alvo], ['VGV Alvo — Próximos 12 meses', 'f-vgv', d.vgv], ['Propostas recebidas por mês', 'f-propostas', d.propostas], ['Imobiliárias Parceiras', 'f-imob', d.imob], ['Ticket Médio', 'f-ticket', d.ticket]].map(([label, name, val]) => (
              <ModalField key={name} label={label}>
                <input name={name} defaultValue={val || ''} style={mInput} onFocus={e => e.target.style.borderColor = '#E8392A'} onBlur={e => e.target.style.borderColor = '#272727'} />
              </ModalField>
            ))}
          </div>
          <div style={{ borderTop: '1px solid #272727', margin: '16px 0' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            {[['Diretor', 'f-diretor', d.diretor], ['Gerente de Parceria', 'f-gerente', d.gerente], ['Executivos de Parceria', 'f-executivos', d.executivos], ['Equipe de Marketing', 'f-marketing', d.marketing]].map(([label, name, val]) => (
              <ModalField key={name} label={label}>
                <input name={name} defaultValue={val || ''} style={mInput} onFocus={e => e.target.style.borderColor = '#E8392A'} onBlur={e => e.target.style.borderColor = '#272727'} />
              </ModalField>
            ))}
          </div>
          <ModalField label="Produtos ativos e fases">
            <textarea name="f-produtos" defaultValue={d.produtos || ''} style={{ ...mInput, minHeight: 70, resize: 'vertical' }} onFocus={e => e.target.style.borderColor = '#E8392A'} onBlur={e => e.target.style.borderColor = '#272727'} />
          </ModalField>
          <ModalField label="Observações do diagnóstico">
            <textarea name="f-obs" defaultValue={d.obs || ''} style={{ ...mInput, minHeight: 70, resize: 'vertical' }} onFocus={e => e.target.style.borderColor = '#E8392A'} onBlur={e => e.target.style.borderColor = '#272727'} />
          </ModalField>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" onClick={() => setShowDiag(false)} style={{ background: 'transparent', border: '1px solid #444', borderRadius: 3, padding: '8px 18px', cursor: 'pointer', fontFamily: mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#666' }}>Cancelar</button>
            <button type="submit" style={{ background: '#E8392A', border: 'none', borderRadius: 3, padding: '8px 18px', cursor: 'pointer', fontFamily: mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#fff' }}>Salvar Diagnóstico</button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL CONFIG ── */}
      <Modal show={showConfig} onClose={() => setShowConfig(false)} title="Configurações">
        <form onSubmit={saveConfig}>
          <ModalField label="Operadora Responsável">
            <input name="fc-operadora" defaultValue={st.client.operadora || ''} style={mInput} onFocus={e => e.target.style.borderColor = '#E8392A'} onBlur={e => e.target.style.borderColor = '#272727'} />
          </ModalField>
          <ModalField label="Data de Início do Onboarding">
            <input type="date" name="fc-inicio" defaultValue={st.client.inicio || ''} style={{ ...mInput, colorScheme: 'dark' }} onFocus={e => e.target.style.borderColor = '#E8392A'} onBlur={e => e.target.style.borderColor = '#272727'} />
          </ModalField>
          <ModalField label="Fase Atual">
            <select name="fc-fase" defaultValue={st.client.fase || 'ONBOARDING'} style={{ ...mInput, cursor: 'pointer' }}>
              <option value="ONBOARDING">ONBOARDING</option>
              <option value="ATIVO">ATIVO</option>
              <option value="RISCO">RISCO</option>
              <option value="PAUSADO">PAUSADO</option>
            </select>
          </ModalField>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" onClick={() => setShowConfig(false)} style={{ background: 'transparent', border: '1px solid #444', borderRadius: 3, padding: '8px 18px', cursor: 'pointer', fontFamily: mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#666' }}>Cancelar</button>
            <button type="submit" style={{ background: '#E8392A', border: 'none', borderRadius: 3, padding: '8px 18px', cursor: 'pointer', fontFamily: mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#fff' }}>Salvar</button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL NOVA TAREFA ── */}
      <Modal show={showTask} onClose={() => setShowTask(false)} title="Nova Tarefa">
        <form onSubmit={addTask} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA' && (e.preventDefault(), e.currentTarget.requestSubmit())}>
          <ModalField label="Título da Tarefa">
            <input name="ft-titulo" autoFocus required style={mInput} placeholder="Descreva a tarefa..." onFocus={e => e.target.style.borderColor = '#E8392A'} onBlur={e => e.target.style.borderColor = '#272727'} />
          </ModalField>
          <ModalField label="Prioridade">
            <select name="ft-prio" defaultValue="media" style={{ ...mInput, cursor: 'pointer' }}>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </ModalField>
          <ModalField label="Observação (opcional)">
            <textarea name="ft-obs" style={{ ...mInput, minHeight: 70, resize: 'vertical' }} placeholder="Contexto ou detalhes..." onFocus={e => e.target.style.borderColor = '#E8392A'} onBlur={e => e.target.style.borderColor = '#272727'} />
          </ModalField>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" onClick={() => setShowTask(false)} style={{ background: 'transparent', border: '1px solid #444', borderRadius: 3, padding: '8px 18px', cursor: 'pointer', fontFamily: mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#666' }}>Cancelar</button>
            <button type="submit" style={{ background: '#E8392A', border: 'none', borderRadius: 3, padding: '8px 18px', cursor: 'pointer', fontFamily: mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#fff' }}>+ Adicionar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════
// AGENDA — TAREFA MODAL
// ═══════════════════════════════════════════
function TarefaModal({ task, defaultDate, operadoraName, devs, onClose, onSaved }) {
  const [titulo, setTitulo] = useState(task?.titulo || '');
  const [data, setData] = useState(
    task?.data ? String(task.data).split('T')[0] : (defaultDate || todayISO())
  );
  const [hora, setHora] = useState(task?.hora ? String(task.hora).slice(0, 5) : '');
  const [prioridade, setPrioridade] = useState(task?.prioridade || 'media');
  const [status, setStatus] = useState(task?.status || 'pendente');
  const [devValue, setDevValue] = useState(task?.dev_value ? String(task.dev_value) : '');
  const [descricao, setDescricao] = useState(task?.descricao || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selectedDev = devs.find(d => String(d.value) === devValue);

  const save = async () => {
    if (!titulo.trim() || !data) return;
    setSaving(true);
    try {
      const body = {
        operadora_name: operadoraName,
        titulo: titulo.trim(),
        data,
        hora: hora || null,
        prioridade,
        status,
        descricao: descricao.trim() || null,
        dev_value: selectedDev ? selectedDev.value : null,
        dev_label: selectedDev ? selectedDev.label : null,
      };
      if (task?.id) {
        await apiTarefas.update({ id: task.id, ...body });
      } else {
        await apiTarefas.create(body);
      }
      onSaved();
    } catch {} finally { setSaving(false); }
  };

  const remove = async () => {
    if (!task?.id) return;
    setDeleting(true);
    try { await apiTarefas.remove(task.id); onSaved(); }
    catch {} finally { setDeleting(false); }
  };

  const toggleStatus = async () => {
    if (!task?.id) return;
    const next = status === 'concluida' ? 'pendente' : 'concluida';
    setStatus(next);
    await apiTarefas.update({ id: task.id, status: next });
    onSaved();
  };

  const prioColor = { baixa: '#22c55e', media: '#f59e0b', alta: '#E8392A' };
  const lbl = { fontSize: 11, color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={onClose}>
      <div style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: 14, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{task ? 'Editar Tarefa' : 'Nova Tarefa'}</div>
          <button onClick={onClose} style={{ ...css.btn, background: 'transparent', color: '#555', border: 'none', fontSize: 18, padding: '0 6px', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={lbl}>Título *</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Descreva a tarefa..."
              autoFocus style={{ ...css.input, width: '100%', boxSizing: 'border-box' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Data *</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)}
                style={{ ...css.input, width: '100%', boxSizing: 'border-box', fontFamily: "'JetBrains Mono',monospace" }} />
            </div>
            <div>
              <label style={lbl}>Horário</label>
              <input type="time" value={hora} onChange={e => setHora(e.target.value)}
                style={{ ...css.input, width: '100%', boxSizing: 'border-box', fontFamily: "'JetBrains Mono',monospace" }} />
            </div>
          </div>

          {devs.length > 0 && <div>
            <label style={lbl}>Incorporadora</label>
            <select value={devValue} onChange={e => setDevValue(e.target.value)}
              style={{ ...css.input, width: '100%', boxSizing: 'border-box', cursor: 'pointer' }}>
              <option value="">Sem vinculação específica</option>
              {devs.map(d => <option key={d.value} value={String(d.value)}>{d.label}</option>)}
            </select>
          </div>}

          <div>
            <label style={lbl}>Prioridade</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {['baixa', 'media', 'alta'].map(p => (
                <button key={p} type="button" onClick={() => setPrioridade(p)}
                  style={{ ...css.btn, flex: 1,
                    background: prioridade === p ? `rgba(${p === 'alta' ? '232,57,42' : p === 'media' ? '245,158,11' : '34,197,94'},0.15)` : '#141414',
                    color: prioridade === p ? prioColor[p] : '#555',
                    border: `1px solid ${prioridade === p ? prioColor[p] + '44' : '#1a1a1a'}` }}>
                  {p === 'media' ? 'Média' : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={lbl}>Observação</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhes ou contexto..."
              style={{ ...css.input, width: '100%', boxSizing: 'border-box', minHeight: 70, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>

          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            {task && <>
              <button type="button" onClick={toggleStatus}
                style={{ ...css.btn, flex: 1,
                  background: status === 'concluida' ? 'rgba(34,197,94,0.12)' : '#141414',
                  color: status === 'concluida' ? '#22c55e' : '#555',
                  border: `1px solid ${status === 'concluida' ? 'rgba(34,197,94,0.25)' : '#1a1a1a'}` }}>
                {status === 'concluida' ? '✓ Concluída' : 'Marcar Concluída'}
              </button>
              <button type="button" onClick={remove} disabled={deleting}
                style={{ ...css.btn, background: 'rgba(232,57,42,0.08)', color: '#E8392A', border: '1px solid rgba(232,57,42,0.15)' }}>
                {deleting ? '...' : 'Excluir'}
              </button>
            </>}
            <button type="button" onClick={save} disabled={saving || !titulo.trim() || !data}
              style={{ ...css.btn, background: '#E8392A', color: '#fff', flex: task ? 0 : 1, opacity: (!titulo.trim() || !data) ? 0.5 : 1 }}>
              {saving ? 'Salvando...' : task ? 'Salvar' : 'Criar Tarefa'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// AGENDA — CALENDAR VIEW
// ═══════════════════════════════════════════
const MONTH_NAMES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEK_DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function AgendaView({ operadoraName, devs = [] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null); // null | { task? , date? }

  const loadTasks = useCallback(async () => {
    if (!operadoraName) return;
    setLoading(true);
    try {
      const data = await apiTarefas.list(operadoraName, year, month);
      if (Array.isArray(data)) setTasks(data);
    } catch {} finally { setLoading(false); }
  }, [operadoraName, year, month]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const goToday = () => { setMonth(today.getMonth() + 1); setYear(today.getFullYear()); };

  const daysInMonth = new Date(year, month, 0).getDate();
  const startWd = new Date(year, month - 1, 1).getDay();
  const cells = [...Array(startWd).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const tasksByDay = {};
  tasks.forEach(t => {
    const d = parseInt(String(t.data).split('T')[0].split('-')[2]);
    (tasksByDay[d] = tasksByDay[d] || []).push(t);
  });

  const isToday = (d) => d && year === today.getFullYear() && month === today.getMonth() + 1 && d === today.getDate();
  const dayStr = (d) => `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  const taskColor = (t) => {
    if (t.status === 'concluida') return { bg: 'rgba(34,197,94,0.1)', fg: '#22c55e' };
    if (t.tipo === 'onboarding') return { bg: 'rgba(99,102,241,0.12)', fg: '#818cf8' };
    return { bg: 'rgba(232,57,42,0.1)', fg: '#ff6b5b' };
  };

  const pendingCount = tasks.filter(t => t.status === 'pendente').length;
  const doneCount = tasks.filter(t => t.status === 'concluida').length;

  return (
    <div style={{ padding: '24px 28px', background: '#fff', minHeight: 'calc(100vh - 60px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={prevMonth} style={{ ...css.btn, background: '#fff', color: '#374151', border: '1px solid #e5e7eb', padding: '7px 13px' }}>←</button>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.5, minWidth: 200, color: '#111827' }}>
          {MONTH_NAMES_PT[month - 1]} {year}
        </div>
        <button onClick={nextMonth} style={{ ...css.btn, background: '#fff', color: '#374151', border: '1px solid #e5e7eb', padding: '7px 13px' }}>→</button>
        <button onClick={goToday} style={{ ...css.btn, background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb', fontSize: 11 }}>Hoje</button>
        {loading && <div style={{ width: 16, height: 16, border: '2px solid #e5e7eb', borderTopColor: '#E8392A', borderRadius: '50%', animation: 'sp .8s linear infinite' }} />}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}><span style={{ color: '#111827', fontWeight: 600 }}>{pendingCount}</span> pendentes</span>
          <span style={{ fontSize: 12, color: '#6b7280' }}><span style={{ color: '#16a34a', fontWeight: 600 }}>{doneCount}</span> concluídas</span>
          <button onClick={() => setModal({ date: todayISO() })}
            style={{ ...css.btn, background: '#E8392A', color: '#fff' }}>+ Nova Tarefa</button>
        </div>
      </div>

      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e5e7eb', marginBottom: 0 }}>
        {WEEK_DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#9ca3af', padding: '8px 0', textTransform: 'uppercase', letterSpacing: 0.8 }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
        {cells.map((d, i) => {
          const dayTasks = d ? (tasksByDay[d] || []) : [];
          const todayCell = isToday(d);
          const isLastRow = i >= cells.length - 7;
          return (
            <div key={i} onClick={() => d && setModal({ date: dayStr(d) })}
              style={{
                background: d ? '#fff' : '#fafafa',
                minHeight: 100, padding: 8,
                cursor: d ? 'pointer' : 'default',
                borderRight: (i + 1) % 7 !== 0 ? '1px solid #e5e7eb' : 'none',
                borderBottom: !isLastRow ? '1px solid #e5e7eb' : 'none',
                transition: 'background .1s',
              }}
              onMouseEnter={e => { if (d) e.currentTarget.style.background = '#f9fafb'; }}
              onMouseLeave={e => { if (d) e.currentTarget.style.background = '#fff'; }}>
              {d && <>
                <div style={{
                  fontSize: 12, fontWeight: todayCell ? 700 : 500,
                  color: todayCell ? '#fff' : '#374151',
                  width: 24, height: 24, borderRadius: '50%',
                  background: todayCell ? '#E8392A' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 4
                }}>{d}</div>
                {dayTasks.slice(0, 3).map((t, ti) => {
                  const { bg, fg } = taskColor(t);
                  return (
                    <div key={ti}
                      onClick={e => { e.stopPropagation(); setModal({ task: t }); }}
                      style={{ fontSize: 10, background: bg, color: fg, borderRadius: 4, padding: '2px 6px', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: t.status === 'concluida' ? 'line-through' : 'none', cursor: 'pointer', fontWeight: 500 }}
                      title={t.titulo}>
                      {t.hora ? t.hora.slice(0, 5) + ' ' : ''}{t.titulo}
                    </div>
                  );
                })}
                {dayTasks.length > 3 && <div style={{ fontSize: 9, color: '#9ca3af', paddingLeft: 4 }}>+{dayTasks.length - 3} mais</div>}
              </>}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
        <span style={{ fontSize: 11, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(232,57,42,0.5)', display: 'inline-block' }} /> Geral
        </span>
        <span style={{ fontSize: 11, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(99,102,241,0.5)', display: 'inline-block' }} /> Onboarding
        </span>
        <span style={{ fontSize: 11, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(34,197,94,0.5)', display: 'inline-block' }} /> Concluída
        </span>
      </div>

      {modal && (
        <TarefaModal
          task={modal.task}
          defaultDate={modal.date}
          operadoraName={operadoraName}
          devs={devs}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); loadTasks(); }}
        />
      )}
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
  const [subView, setSubView] = useState('dados'); // 'dados' | 'onboarding'

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

  // Reset sub-view when the selected incorporadora changes
  useEffect(() => { setSubView('dados'); }, [selDev?.value]);

  const filtered = incs.filter(d => d.label?.toLowerCase().includes(search.toLowerCase())).slice(0, 25);
  const isMaster = authUser?.role === 'master';
  const isAdmin = authUser?.role === 'admin';
  const isOperadora = authUser?.role === 'operadora';
  const canManage = isMaster || isAdmin;
  const canEditDate = canManage || isOperadora;

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
        {(canManage ? (isMaster ? ['operadora', 'agenda', 'diretoria', 'config', 'usuarios'] : ['operadora', 'agenda', 'diretoria', 'config']) : ['operadora', 'agenda']).map(v => (
          <button key={v} onClick={() => setView(v)} style={{ ...css.btn, background: view === v ? '#E8392A' : '#141414', color: view === v ? '#fff' : '#999', border: view === v ? 'none' : '1px solid #1a1a1a', textTransform: 'capitalize' }}>
            {v === 'config' ? '⚙ Config' : v === 'usuarios' ? '👥 Usuários' : v === 'agenda' ? '📅 Agenda' : v}
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
    {view === 'operadora' && <>
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
              {canEditDate && editingDate === d.value ? (
                <input type="date" defaultValue={d.startDate} autoFocus
                  onBlur={e => updateDevDate(d.value, e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && updateDevDate(d.value, e.target.value)}
                  style={{ ...css.input, fontSize: 10, padding: '3px 6px', width: 120, fontFamily: "'JetBrains Mono',monospace" }} />
              ) : (
                <span onClick={e => { if (!canEditDate) return; e.stopPropagation(); setEditingDate(d.value); }}
                  style={{ fontSize: 10, color: '#444', fontFamily: "'JetBrains Mono',monospace", cursor: canEditDate ? 'pointer' : 'default', borderBottom: canEditDate ? '1px dashed #333' : 'none' }}
                  title={canEditDate ? "Clique para editar a data de início" : undefined}>
                  Início: {d.startDate ? new Date(d.startDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'definir'}
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
            {/* Header: incorporadora name + sub-tabs + PDF button */}
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ padding: '6px 14px', background: 'rgba(232,57,42,0.07)', border: '1px solid rgba(232,57,42,0.2)', borderRadius: 20, fontSize: 13, fontWeight: 600, color: '#E8392A' }}>{selDev.label}</div>
              {selDev.startDate && <div style={{ fontSize: 11, color: '#555', fontFamily: "'JetBrains Mono',monospace" }}>Operando desde {new Date(selDev.startDate + 'T12:00:00').toLocaleDateString('pt-BR')}</div>}
              {/* Sub-tabs */}
              <div style={{ display: 'flex', gap: 4, background: '#0a0a0a', borderRadius: 8, padding: 3, border: '1px solid #1a1a1a' }}>
                <button onClick={() => setSubView('dados')} style={{ ...css.btn, padding: '5px 14px', fontSize: 12, background: subView === 'dados' ? '#E8392A' : 'transparent', color: subView === 'dados' ? '#fff' : '#555', border: 'none' }}>📊 Dados</button>
                <button onClick={() => setSubView('onboarding')} style={{ ...css.btn, padding: '5px 14px', fontSize: 12, background: subView === 'onboarding' ? '#E8392A' : 'transparent', color: subView === 'onboarding' ? '#fff' : '#555', border: 'none' }}>🎯 Onboarding</button>
              </div>
              {subView === 'dados' && <button onClick={() => {
                const qs = new URLSearchParams({ op: curOp.name, dev: selDev.value, devLabel: selDev.label, ...(selDev.startDate ? { startDate: selDev.startDate } : {}) });
                window.open(`/relatorio?${qs}`, '_blank');
              }} style={{ marginLeft: 'auto', padding: '6px 14px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#3b82f6', cursor: 'pointer', fontFamily: 'inherit' }}>
                📄 Relatório PDF
              </button>}
            </div>
            {subView === 'dados'
              ? <IncView dev={selDev} dateFrom={dateFrom} dateTo={dateTo} startDate={selDev.startDate} />
              : <OnboardingTab key={`${curOp?.name || authUser?.operadora_name}_${selDev.value}`} opName={`${curOp?.name || authUser?.operadora_name}_${selDev.value}`} operadoraName={curOp?.name || authUser?.operadora_name || ''} devValue={String(selDev.value)} devLabel={selDev.label} startDate={selDev.startDate} />
            }
          </> : <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>
            <div style={{ fontSize: 48, opacity: .3, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#999' }}>Selecione uma incorporadora na lateral</div>
          </div>}
        </main>
      </div>}
    </>}

    {/* DIRETORIA — master or admin */}
    {view === 'diretoria' && canManage && <DirView operadoras={ops} />}

    {/* AGENDA — todos os roles */}
    {view === 'agenda' && <>
      {canManage && ops.length > 0 && (
        <div style={{ padding: '12px 28px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#555', marginRight: 4 }}>Operadora:</span>
          {ops.map((op, i) => (
            <button key={i} onClick={() => setCurOp(op)}
              style={{ ...css.btn, padding: '5px 14px', fontSize: 12,
                background: curOp?.name === op.name ? '#E8392A' : '#141414',
                color: curOp?.name === op.name ? '#fff' : '#555',
                border: curOp?.name === op.name ? 'none' : '1px solid #1a1a1a' }}>
              {op.name}
            </button>
          ))}
        </div>
      )}
      {curOp
        ? <AgendaView operadoraName={curOp.name} devs={curOp.devs || []} />
        : <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 48, opacity: .3, marginBottom: 12 }}>📅</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#999' }}>
              {canManage ? 'Selecione uma operadora acima' : 'Sua operadora ainda não está configurada'}
            </div>
          </div>
      }
    </>}

    {showDD && <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setShowDD(false)} />}
    {showProfile && <ProfilePanel user={authUser} onClose={() => setShowProfile(false)} onUpdated={u => setAuthUser(prev => ({ ...prev, ...u }))} />}
  </div>;
}
