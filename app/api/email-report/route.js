import { NextResponse } from 'next/server';
import sql, { initDb } from '../../lib/db';
import { grafanaQuery, DS_CLICKHOUSE, DS_POSTGRES } from '../../lib/grafana';
import { sendEmail } from '../../lib/email';
import { requireRole } from '../../lib/auth';

export const dynamic = 'force-dynamic';

// Calcula intervalo de um mês específico
function monthRange(year, month) {
  const from = new Date(year, month, 1).toISOString().split('T')[0];
  const to = new Date(year, month + 1, 1).toISOString().split('T')[0];
  return { from, to };
}

// Mês anterior ao startDate (ANTES fixo)
function antesRange(startDate) {
  const d = new Date(startDate + 'T12:00:00');
  return monthRange(d.getFullYear(), d.getMonth() - 1);
}

// Último mês fechado (DEPOIS)
function depoisRange() {
  const today = new Date();
  return monthRange(today.getFullYear(), today.getMonth() - 1);
}

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
function monthLabel(isoDate) {
  const d = new Date(isoDate + 'T12:00:00');
  return `${MESES[d.getMonth()]}/${d.getFullYear()}`;
}

function delta(before, after) {
  if (!before || before === 0) return null;
  return ((after - before) / before * 100).toFixed(1);
}

function fmt(n) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.0', '') + 'K';
  return Number(n).toLocaleString('pt-BR');
}

async function fetchMetrics(devId, startDate) {
  const antes = antesRange(startDate);
  const depois = depoisRange();

  const [acAntes, acDepois, lpsAntes, lpsDepois, imobAntes, imobDepois] = await Promise.all([
    grafanaQuery(DS_CLICKHOUSE, 'grafana-clickhouse-datasource',
      `SELECT count(tracks.id) AS acessos FROM tracks
       WHERE created_at >= '${antes.from}' AND created_at < '${antes.to}'
       AND event_type = 'acessou' AND parameter = 'construtora' AND parameter_value = '${devId}'`),
    grafanaQuery(DS_CLICKHOUSE, 'grafana-clickhouse-datasource',
      `SELECT count(tracks.id) AS acessos FROM tracks
       WHERE created_at >= '${depois.from}' AND created_at < '${depois.to}'
       AND event_type = 'acessou' AND parameter = 'construtora' AND parameter_value = '${devId}'`),
    grafanaQuery(DS_POSTGRES, 'grafana-postgresql-datasource',
      `SELECT CAST(COUNT(tracked_links.id) AS VARCHAR) AS total_generated, CAST(COALESCE(SUM(tracked_links.views),0) AS VARCHAR) AS total_access
       FROM tracked_links LEFT JOIN properties ON properties.id = tracked_links.property_id
       LEFT JOIN re_developments ON properties.re_development_id = re_developments.id
       LEFT JOIN re_developers ON re_developments.re_developer_id = re_developers.id
       LEFT JOIN re_developments AS rt ON tracked_links.re_development_id = rt.id
       LEFT JOIN re_developers AS rdt ON rdt.id = rt.re_developer_id
       WHERE (re_developers.legacy_id = ${devId} OR rdt.legacy_id = ${devId})
       AND tracked_links.inserted_at >= '${antes.from}' AND tracked_links.inserted_at < '${antes.to}'`),
    grafanaQuery(DS_POSTGRES, 'grafana-postgresql-datasource',
      `SELECT CAST(COUNT(tracked_links.id) AS VARCHAR) AS total_generated, CAST(COALESCE(SUM(tracked_links.views),0) AS VARCHAR) AS total_access
       FROM tracked_links LEFT JOIN properties ON properties.id = tracked_links.property_id
       LEFT JOIN re_developments ON properties.re_development_id = re_developments.id
       LEFT JOIN re_developers ON re_developments.re_developer_id = re_developers.id
       LEFT JOIN re_developments AS rt ON tracked_links.re_development_id = rt.id
       LEFT JOIN re_developers AS rdt ON rdt.id = rt.re_developer_id
       WHERE (re_developers.legacy_id = ${devId} OR rdt.legacy_id = ${devId})
       AND tracked_links.inserted_at >= '${depois.from}' AND tracked_links.inserted_at < '${depois.to}'`),
    grafanaQuery(DS_POSTGRES, 'grafana-postgresql-datasource',
      `SELECT COUNT(cards.id) AS qt, COUNT(DISTINCT re_agencies.id) AS imobiliarias
       FROM cards INNER JOIN re_agencies ON re_agencies.id = cards.re_agency_id
       LEFT JOIN (SELECT properties.id, re_developers.legacy_id FROM properties INNER JOIN re_developments ON re_developments.id = properties.re_development_id INNER JOIN re_developers ON re_developers.id = re_developments.re_developer_id) cd ON cd.id = cards.property_id
       LEFT JOIN (SELECT properties.id, re_developers.legacy_id FROM properties INNER JOIN re_developers ON re_developers.id = properties.re_developer_id) ct ON ct.id = cards.property_id
       WHERE (cd.legacy_id = ${devId} OR ct.legacy_id = ${devId})
       AND cards.inserted_at >= '${antes.from}' AND cards.inserted_at < '${antes.to}'`),
    grafanaQuery(DS_POSTGRES, 'grafana-postgresql-datasource',
      `SELECT COUNT(cards.id) AS qt, COUNT(DISTINCT re_agencies.id) AS imobiliarias
       FROM cards INNER JOIN re_agencies ON re_agencies.id = cards.re_agency_id
       LEFT JOIN (SELECT properties.id, re_developers.legacy_id FROM properties INNER JOIN re_developments ON re_developments.id = properties.re_development_id INNER JOIN re_developers ON re_developers.id = re_developments.re_developer_id) cd ON cd.id = cards.property_id
       LEFT JOIN (SELECT properties.id, re_developers.legacy_id FROM properties INNER JOIN re_developers ON re_developers.id = properties.re_developer_id) ct ON ct.id = cards.property_id
       WHERE (cd.legacy_id = ${devId} OR ct.legacy_id = ${devId})
       AND cards.inserted_at >= '${depois.from}' AND cards.inserted_at < '${depois.to}'`),
  ]);

  return {
    acessos: {
      antes: Number(acAntes.rows?.[0]?.acessos || 0),
      depois: Number(acDepois.rows?.[0]?.acessos || 0),
    },
    lps: {
      antes: Number(lpsAntes.rows?.[0]?.total_generated || 0),
      depois: Number(lpsDepois.rows?.[0]?.total_generated || 0),
    },
    imob: {
      antes: Number(imobAntes.rows?.[0]?.imobiliarias || 0),
      depois: Number(imobDepois.rows?.[0]?.imobiliarias || 0),
    },
  };
}

function buildHtml(operadoraName, antesLabel, depoisLabel, devs) {
  const rows = devs.map(({ label, startDate, metrics }) => {
    const ac = delta(metrics.acessos.antes, metrics.acessos.depois);
    const lp = delta(metrics.lps.antes, metrics.lps.depois);
    const im = delta(metrics.imob.antes, metrics.imob.depois);

    const d = (v) => v === null ? '<span style="color:#999">—</span>'
      : `<span style="color:${Number(v) >= 0 ? '#22c55e' : '#E8392A'}">${Number(v) >= 0 ? '↑' : '↓'} ${v}%</span>`;

    return `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #1a1a1a;font-weight:600;color:#f5f5f5">${label}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #1a1a1a;color:#555;font-size:12px;font-family:monospace">${new Date(startDate).toLocaleDateString('pt-BR')}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #1a1a1a;text-align:right;font-family:monospace;color:#666">${fmt(metrics.acessos.antes)}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #1a1a1a;text-align:right;font-family:monospace;color:#f5f5f5">${fmt(metrics.acessos.depois)}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #1a1a1a;text-align:right;font-family:monospace">${d(ac)}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #1a1a1a;text-align:right;font-family:monospace;color:#666">${fmt(metrics.lps.antes)}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #1a1a1a;text-align:right;font-family:monospace;color:#3b82f6">${fmt(metrics.lps.depois)}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #1a1a1a;text-align:right;font-family:monospace">${d(lp)}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #1a1a1a;text-align:right;font-family:monospace;color:#666">${fmt(metrics.imob.antes)}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #1a1a1a;text-align:right;font-family:monospace;color:#f59e0b">${fmt(metrics.imob.depois)}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #1a1a1a;text-align:right;font-family:monospace">${d(im)}</td>
      </tr>`;
  }).join('');

  const th = (t) => `<th style="padding:10px 16px;text-align:right;color:#555;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #1a1a1a;white-space:nowrap">${t}</th>`;
  const thL = (t) => `<th style="padding:10px 16px;text-align:left;color:#555;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #1a1a1a">${t}</th>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#050505;color:#f5f5f5;font-family:'DM Sans',Arial,sans-serif">
  <div style="max-width:900px;margin:0 auto;padding:32px 24px">

    <div style="display:flex;align-items:center;gap:12px;margin-bottom:32px">
      <div style="width:36px;height:36px;background:#E8392A;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:#fff">DW</div>
      <div>
        <div style="font-size:18px;font-weight:600">Relatório Mensal de Parcerias</div>
        <div style="font-size:13px;color:#555;margin-top:2px">Operadora: ${operadoraName}</div>
      </div>
    </div>

    <div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:10px;padding:16px 20px;margin-bottom:24px;display:flex;gap:32px">
      <div><div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.5px">ANTES (referência)</div><div style="font-size:20px;font-weight:700;font-family:monospace;color:#666;margin-top:4px">${antesLabel}</div></div>
      <div><div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.5px">DEPOIS (último mês fechado)</div><div style="font-size:20px;font-weight:700;font-family:monospace;color:#f5f5f5;margin-top:4px">${depoisLabel}</div></div>
    </div>

    <div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:10px;overflow:hidden">
      <div style="padding:14px 20px;border-bottom:1px solid #1a1a1a;font-size:13px;font-weight:600;color:#999">📐 Antes vs Depois — ${devs.length} incorporadora${devs.length !== 1 ? 's' : ''}</div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#080808">
              ${thL('Incorporadora')}
              ${thL('Início')}
              ${th(`Acessos<br><span style="color:#444">${antesLabel}</span>`)}
              ${th(`Acessos<br><span style="color:#E8392A">${depoisLabel}</span>`)}
              ${th('Δ')}
              ${th(`LPs<br><span style="color:#444">${antesLabel}</span>`)}
              ${th(`LPs<br><span style="color:#3b82f6">${depoisLabel}</span>`)}
              ${th('Δ')}
              ${th(`Imobs<br><span style="color:#444">${antesLabel}</span>`)}
              ${th(`Imobs<br><span style="color:#f59e0b">${depoisLabel}</span>`)}
              ${th('Δ')}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>

    <div style="margin-top:24px;font-size:12px;color:#555;text-align:center">
      DWV Gestão de Parcerias · Gerado em ${new Date().toLocaleDateString('pt-BR')}
    </div>
  </div>
</body>
</html>`;
}

// GET /api/email-report?operadora_name=X → returns metrics JSON for PDF
export async function GET(req) {
  try {
    await initDb();
    const me = await requireRole(req, 'master', 'admin', 'operadora');
    if (!me) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const operadora_name = searchParams.get('operadora_name');
    if (!operadora_name) return NextResponse.json({ error: 'operadora_name required' }, { status: 400 });

    // Operadora só pode ver os próprios dados
    if (me.role === 'operadora' && me.operadora_name !== operadora_name)
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const carteira = await sql`
      SELECT dev_value, dev_label, start_date::text FROM carteira
      WHERE operadora_name = ${operadora_name} ORDER BY created_at ASC
    `;
    if (!carteira.length) return NextResponse.json({ error: 'Carteira vazia' }, { status: 400 });

    const depois = depoisRange();
    const depoisLabel = monthLabel(depois.from);

    const devsWithMetrics = await Promise.all(
      carteira.map(async (c) => {
        const ar = antesRange(c.start_date);
        const aLabel = monthLabel(ar.from);
        const metrics = await fetchMetrics(c.dev_value, c.start_date);
        return { label: c.dev_label, startDate: c.start_date, antesLabel: aLabel, metrics };
      })
    );

    return NextResponse.json({
      operadora_name,
      depoisLabel,
      devsWithMetrics,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/email-report → { operadora_name }
export async function POST(req) {
  try {
    await initDb();
    const me = await requireRole(req, 'master', 'admin', 'operadora');
    if (!me) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { operadora_name } = await req.json();
    if (!operadora_name) return NextResponse.json({ error: 'operadora_name required' }, { status: 400 });

    // Operadora só pode disparar o relatório da própria operadora
    if (me.role === 'operadora' && me.operadora_name !== operadora_name)
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const [opRows, carteira] = await Promise.all([
      sql`SELECT name, email FROM operadoras WHERE name = ${operadora_name}`,
      sql`SELECT dev_value, dev_label, start_date::text FROM carteira WHERE operadora_name = ${operadora_name} ORDER BY created_at ASC`,
    ]);

    const op = opRows[0];
    if (!op) return NextResponse.json({ error: 'Operadora não encontrada' }, { status: 404 });
    if (!op.email) return NextResponse.json({ error: 'Operadora sem e-mail cadastrado' }, { status: 400 });
    if (!carteira.length) return NextResponse.json({ error: 'Carteira vazia' }, { status: 400 });

    const depois = depoisRange();
    const depoisLabel = monthLabel(depois.from);

    const devsWithMetrics = await Promise.all(
      carteira.map(async (c) => {
        const antesLabel = monthLabel(antesRange(c.start_date).from);
        const metrics = await fetchMetrics(c.dev_value, c.start_date);
        return { label: c.dev_label, startDate: c.start_date, antesLabel, metrics };
      })
    );

    // Use the antesLabel from the first dev as the report's reference (or mix if different)
    const antesLabel = devsWithMetrics[0]?.antesLabel || '—';

    const html = buildHtml(operadora_name, antesLabel, depoisLabel, devsWithMetrics);

    await sendEmail({
      to: op.email,
      subject: `Relatório Mensal de Parcerias — ${operadora_name} (${depoisLabel})`,
      html,
    });

    return NextResponse.json({ ok: true, sentTo: op.email });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
