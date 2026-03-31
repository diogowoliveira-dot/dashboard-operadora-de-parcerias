const GRAFANA_URL = process.env.GRAFANA_URL || 'https://dwv.grafana.net';
const GRAFANA_TOKEN = process.env.GRAFANA_TOKEN;

const DS_CLICKHOUSE = 'a7fde48d-2017-4163-a130-13ba91a76649';
const DS_POSTGRES = 'cxHJf2Y4k';
const DS_MYSQL = 'w-h_AsY7z';

export { DS_CLICKHOUSE, DS_POSTGRES, DS_MYSQL };

export async function grafanaQuery(datasourceUid, datasourceType, rawSql, from = 'now-30d', to = 'now') {
  const res = await fetch(`${GRAFANA_URL}/api/ds/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GRAFANA_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      queries: [{
        refId: 'A',
        datasource: { type: datasourceType, uid: datasourceUid },
        rawSql,
        format: 1,
      }],
      from,
      to,
    }),
  });

  if (!res.ok) {
    throw new Error(`Grafana API error: ${res.status}`);
  }

  const data = await res.json();
  const result = data?.results?.A;

  if (result?.error) {
    throw new Error(`Query error: ${result.error}`);
  }

  const frames = result?.frames || [];
  if (frames.length === 0) return { fields: [], rows: [] };

  const schema = frames[0].schema?.fields || [];
  const values = frames[0].data?.values || [];

  const fields = schema.map(f => f.name);
  const rowCount = values[0]?.length || 0;
  const rows = [];

  for (let i = 0; i < rowCount; i++) {
    const row = {};
    fields.forEach((f, idx) => {
      row[f] = values[idx]?.[i] ?? null;
    });
    rows.push(row);
  }

  return { fields, rows };
}
