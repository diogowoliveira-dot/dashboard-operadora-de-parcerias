import { NextResponse } from 'next/server';
import { grafanaQuery, DS_CLICKHOUSE, DS_POSTGRES } from '../../lib/grafana';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const devId = searchParams.get('devId');
  const from = searchParams.get('from') || 'now-30d';
  const to = searchParams.get('to') || 'now';
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');

  try {
    let result;

    switch (type) {
      case 'acessos-construtora': {
        if (!devId) return NextResponse.json({ error: 'devId required' }, { status: 400 });
        const df = dateFrom && dateTo
          ? `created_at >= '${dateFrom}' AND created_at < '${dateTo}'`
          : `created_at >= DATE(NOW() - INTERVAL 12 MONTH)`;
        result = await grafanaQuery(DS_CLICKHOUSE, 'grafana-clickhouse-datasource',
          `SELECT formatDateTime(created_at, '%Y/%c') AS month, count(tracks.id) AS acessos
           FROM tracks WHERE ${df} AND event_type = 'acessou' AND parameter = 'construtora'
           AND parameter_value = '${devId}' GROUP BY month ORDER BY month ASC`, from, to);
        break;
      }

      case 'stories': {
        const devFilter = devId ? `AND parameter_value = '${devId}'` : '';
        const df = dateFrom && dateTo
          ? `created_at >= '${dateFrom}' AND created_at < '${dateTo}'`
          : `created_at >= NOW() - INTERVAL 90 DAY`;
        result = await grafanaQuery(DS_CLICKHOUSE, 'grafana-clickhouse-datasource',
          `SELECT view_value AS story_id, re_developers.name AS construtora, count(id) AS views
           FROM tracks LEFT JOIN re_developers ON tracks.parameter_value = CAST(re_developers.legacy_id AS String)
           WHERE ${df} AND view = 'story' ${devFilter} GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 100`, from, to);
        break;
      }

      case 'stories-titles': {
        const ids = searchParams.get('ids');
        if (!ids) return NextResponse.json({ error: 'ids required' }, { status: 400 });
        const idList = ids.split(',').map(Number).filter(n => !isNaN(n));
        if (idList.length === 0) return NextResponse.json({ fields: [], rows: [] });
        result = await grafanaQuery(DS_POSTGRES, 'grafana-postgresql-datasource',
          `SELECT legacy_id, title FROM stories WHERE legacy_id IN (${idList.join(',')})`);
        break;
      }

      case 'lps-total': {
        if (!devId) return NextResponse.json({ error: 'devId required' }, { status: 400 });
        const df = dateFrom && dateTo ? `AND tracked_links.inserted_at >= '${dateFrom}' AND tracked_links.inserted_at < '${dateTo}'` : '';
        result = await grafanaQuery(DS_POSTGRES, 'grafana-postgresql-datasource',
          `SELECT CAST(COUNT(tracked_links.id) AS VARCHAR) AS total_generated,
            CAST(COALESCE(SUM(tracked_links.views), 0) AS VARCHAR) AS total_access
           FROM tracked_links
           LEFT JOIN properties ON properties.id = tracked_links.property_id
           LEFT JOIN re_developments ON properties.re_development_id = re_developments.id
           LEFT JOIN re_developers ON re_developments.re_developer_id = re_developers.id
           LEFT JOIN re_developments AS rt ON tracked_links.re_development_id = rt.id
           LEFT JOIN re_developers AS rdt ON rdt.id = rt.re_developer_id
           WHERE (re_developers.legacy_id = ${devId} OR rdt.legacy_id = ${devId}) ${df}`, from, to);
        break;
      }

      case 'lps-empreendimentos': {
        if (!devId) return NextResponse.json({ error: 'devId required' }, { status: 400 });
        const df = dateFrom && dateTo ? `AND tracked_links.inserted_at >= '${dateFrom}' AND tracked_links.inserted_at < '${dateTo}'` : '';
        result = await grafanaQuery(DS_POSTGRES, 'grafana-postgresql-datasource',
          `SELECT COALESCE(re_developments.name, rt.name) AS empreendimento,
            COUNT(tracked_links.id) AS total_generated, COALESCE(SUM(tracked_links.views), 0) AS total_access
           FROM tracked_links
           LEFT JOIN properties ON properties.id = tracked_links.property_id
           LEFT JOIN re_developments ON properties.re_development_id = re_developments.id
           LEFT JOIN re_developers ON re_developments.re_developer_id = re_developers.id
           LEFT JOIN re_developments AS rt ON tracked_links.re_development_id = rt.id
           LEFT JOIN re_developers AS rdt ON rdt.id = rt.re_developer_id
           WHERE (re_developers.legacy_id = ${devId} OR rdt.legacy_id = ${devId}) ${df}
           GROUP BY empreendimento ORDER BY total_access DESC`, from, to);
        break;
      }

      case 'lps-mensal': {
        if (!devId) return NextResponse.json({ error: 'devId required' }, { status: 400 });
        const sd = dateFrom || '2025-01-01';
        const ef = dateTo ? `AND tracked_links.inserted_at < '${dateTo}'` : `AND tracked_links.inserted_at < DATE_TRUNC('month', NOW()) + INTERVAL '1 month'`;
        result = await grafanaQuery(DS_POSTGRES, 'grafana-postgresql-datasource',
          `SELECT TO_CHAR(DATE_TRUNC('month', tracked_links.inserted_at), 'YYYY/MM') AS month,
            COUNT(tracked_links.id)::bigint AS total_links
           FROM tracked_links
           LEFT JOIN properties ON properties.id = tracked_links.property_id
           LEFT JOIN re_developments ON re_developments.id = properties.re_development_id
           LEFT JOIN re_developers ON re_developers.id = re_developments.re_developer_id
           LEFT JOIN re_developments AS rt ON rt.id = tracked_links.re_development_id
           LEFT JOIN re_developers AS rdt ON rdt.id = rt.re_developer_id
           WHERE (re_developers.legacy_id = ${devId} OR rdt.legacy_id = ${devId})
           AND tracked_links.inserted_at >= '${sd}' ${ef}
           GROUP BY DATE_TRUNC('month', tracked_links.inserted_at)
           ORDER BY DATE_TRUNC('month', tracked_links.inserted_at) ASC`, from, to);
        break;
      }

      case 'imobiliarias-total': {
        if (!devId) return NextResponse.json({ error: 'devId required' }, { status: 400 });
        const df = dateFrom && dateTo ? `AND cards.inserted_at >= '${dateFrom}' AND cards.inserted_at < '${dateTo}'` : '';
        result = await grafanaQuery(DS_POSTGRES, 'grafana-postgresql-datasource',
          `SELECT COUNT(cards.id) AS qt, COUNT(DISTINCT re_agencies.id) AS imobiliarias
           FROM cards INNER JOIN re_agencies ON re_agencies.id = cards.re_agency_id
           LEFT JOIN (SELECT properties.id, re_developers.legacy_id FROM properties INNER JOIN re_developments ON re_developments.id = properties.re_development_id INNER JOIN re_developers ON re_developers.id = re_developments.re_developer_id) cd ON cd.id = cards.property_id
           LEFT JOIN (SELECT properties.id, re_developers.legacy_id FROM properties INNER JOIN re_developers ON re_developers.id = properties.re_developer_id) ct ON ct.id = cards.property_id
           WHERE (cd.legacy_id = ${devId} OR ct.legacy_id = ${devId}) ${df}`, from, to);
        break;
      }

      case 'imobiliarias-lista': {
        if (!devId) return NextResponse.json({ error: 'devId required' }, { status: 400 });
        const df = dateFrom && dateTo ? `AND cards.inserted_at >= '${dateFrom}' AND cards.inserted_at < '${dateTo}'` : '';
        result = await grafanaQuery(DS_POSTGRES, 'grafana-postgresql-datasource',
          `SELECT count(cards.id) AS qt, re_agencies.name AS imobiliaria
           FROM cards INNER JOIN re_agencies ON re_agencies.id = cards.re_agency_id
           LEFT JOIN (SELECT properties.id, re_developers.legacy_id FROM properties INNER JOIN re_developments ON re_developments.id = properties.re_development_id INNER JOIN re_developers ON re_developers.id = re_developments.re_developer_id) cd ON cd.id = cards.property_id
           LEFT JOIN (SELECT properties.id, re_developers.legacy_id FROM properties INNER JOIN re_developers ON re_developers.id = properties.re_developer_id) ct ON ct.id = cards.property_id
           WHERE (cd.legacy_id = ${devId} OR ct.legacy_id = ${devId}) ${df}
           GROUP BY re_agencies.name ORDER BY qt DESC`, from, to);
        break;
      }

      case 'imobiliarias-mensal': {
        if (!devId) return NextResponse.json({ error: 'devId required' }, { status: 400 });
        const sd = dateFrom || '2025-01-01';
        const ef = dateTo ? `AND cards.inserted_at < '${dateTo}'` : '';
        result = await grafanaQuery(DS_POSTGRES, 'grafana-postgresql-datasource',
          `SELECT TO_CHAR(DATE_TRUNC('month', cards.inserted_at), 'YYYY/MM') AS month,
            COUNT(DISTINCT re_agencies.id) AS imobiliarias, COUNT(cards.id) AS unidades
           FROM cards INNER JOIN re_agencies ON re_agencies.id = cards.re_agency_id
           LEFT JOIN (SELECT properties.id, re_developers.legacy_id FROM properties INNER JOIN re_developments ON re_developments.id = properties.re_development_id INNER JOIN re_developers ON re_developers.id = re_developments.re_developer_id) cd ON cd.id = cards.property_id
           LEFT JOIN (SELECT properties.id, re_developers.legacy_id FROM properties INNER JOIN re_developers ON re_developers.id = properties.re_developer_id) ct ON ct.id = cards.property_id
           WHERE (cd.legacy_id = ${devId} OR ct.legacy_id = ${devId})
           AND cards.inserted_at >= '${sd}' ${ef}
           GROUP BY DATE_TRUNC('month', cards.inserted_at)
           ORDER BY DATE_TRUNC('month', cards.inserted_at) ASC`, from, to);
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
