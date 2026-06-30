import { NextResponse } from 'next/server';
import sql, { initDb } from '../../lib/db';
import { requireRole } from '../../lib/auth';

export const dynamic = 'force-dynamic';

// Tarefas da trilha DWV (o que a assessora precisa executar) — distribuídas por fase
const ONBOARDING_TASKS = [
  // Fase 1: Kick-off e Setup Inicial (dias 0-3)
  { titulo: '[DWV] Realizar reunião de kick-off com toda a equipe do cliente',             dias: 0 },
  { titulo: '[DWV] Mapear e documentar hierarquia de acessos',                            dias: 1 },
  { titulo: '[DWV] Criar usuários e configurar níveis de acesso na plataforma',            dias: 1 },
  { titulo: '[DWV] Criar grupo de WhatsApp DWV + equipe do cliente',                      dias: 2 },
  { titulo: '[DWV] Configurar integração dos WhatsApps Business dos executivos',           dias: 3 },
  // Fase 2: Engenharia de Dados (dias 4-8)
  { titulo: '[DWV] Importar planilha de corretores para o CRM',                           dias: 4 },
  { titulo: '[DWV] Criar imobiliárias no sistema e vincular corretores',                  dias: 5 },
  { titulo: '[DWV] Classificar corretores em Ouro / Prata / Bronze',                      dias: 6 },
  { titulo: '[DWV] Distribuir carteiras por executivo',                                   dias: 7 },
  { titulo: '[DWV] Configurar Kanban com nomenclatura do cliente',                        dias: 8 },
  // Fase 3: Configuração de Produto (dias 9-14)
  { titulo: '[DWV] Fazer upload das tabelas de preço no sistema',                         dias: 9  },
  { titulo: '[DWV] Definir produtos em Tabela Zero e liberar apenas para Ouro',           dias: 10 },
  { titulo: '[DWV] Fazer upload de materiais: plantas, fotos, vídeos e book comercial',   dias: 11 },
  { titulo: '[DWV] Configurar espelho de vendas (disponível / reservado / vendido)',      dias: 12 },
  { titulo: '[DWV] Verificar e ajustar integração com CV',                                dias: 13 },
  { titulo: '[DWV] Validar tabela ao vivo com o cliente antes de liberar corretores',     dias: 14 },
  // Fase 4: IA e Automação (dias 15-18)
  { titulo: '[DWV] Configurar IA de atendimento com FAQ do produto',                      dias: 15 },
  { titulo: '[DWV] Testar fluxo completo: corretor → IA → escalonamento humano',          dias: 16 },
  { titulo: '[DWV] Configurar integração Meta Ads → CRM',                                 dias: 17 },
  { titulo: '[DWV] Configurar roleta de leads ou definir regra manual',                   dias: 18 },
  // Fase 5: Primeiras Ativações (dias 19-23)
  { titulo: '[DWV] Criar primeiro evento ou webinar de produto',                          dias: 19 },
  { titulo: '[DWV] Gerar QR Codes para obras, decorado e stand de vendas',                dias: 20 },
  { titulo: '[DWV] Disparo do primeiro WhatsApp segmentado por tier',                     dias: 21 },
  { titulo: '[DWV] Monitorar primeiros acessos e ações dos corretores',                   dias: 22 },
  { titulo: '[DWV] Identificar corretores da base DWV e priorizá-los',                   dias: 23 },
  // Fase 6: Relatório e Ajuste — Mês 1 (dias 25-30)
  { titulo: '[DWV] Apresentar relatório de performance do mês 1 ao diretor/gerente',      dias: 25 },
  { titulo: '[DWV] Revisar carteiras se necessário (redistribuição por performance)',     dias: 26 },
  { titulo: '[DWV] Ajustar comunicação por segmento com base nas primeiras campanhas',    dias: 27 },
  { titulo: '[DWV] Definir metas de proposta para o mês 2',                               dias: 28 },
  { titulo: '[DWV] Avaliar viabilidade de campanha Meta para captação de corretores',     dias: 29 },
  // Trilha Cliente: o que a assessora precisa coletar/solicitar ao cliente
  { titulo: '[CLIENTE] Coletar planilha de corretores (nome, telefone, e-mail, imobiliária)', dias: 0 },
  { titulo: '[CLIENTE] Solicitar lista de imobiliárias parceiras com classificação',      dias: 1 },
  { titulo: '[CLIENTE] Coletar números de WhatsApp Business de cada executivo',           dias: 1 },
  { titulo: '[CLIENTE] Definir com cliente quem aprova tabela antes de subir',            dias: 2 },
  { titulo: '[CLIENTE] Alinhar critério de distribuição de carteiras com o cliente',      dias: 3 },
  { titulo: '[CLIENTE] Solicitar tabelas de preço em formato editável',                   dias: 5 },
  { titulo: '[CLIENTE] Solicitar materiais: plantas, renders 3D, fotos e vídeos',         dias: 6 },
  { titulo: '[CLIENTE] Solicitar book comercial / apresentação do empreendimento (PDF)',  dias: 7 },
  { titulo: '[CLIENTE] Solicitar fotos e vídeos de acompanhamento de obra',               dias: 8 },
  { titulo: '[CLIENTE] Confirmar produtos em tabela zero e imobiliárias com acesso',      dias: 9  },
  { titulo: '[CLIENTE] Alinhar tom de voz e preferências de comunicação com corretores',  dias: 11 },
  { titulo: '[CLIENTE] Validar templates WhatsApp por tier antes do primeiro disparo',    dias: 13 },
  { titulo: '[CLIENTE] Indicar contato de marketing interno para campanhas',               dias: 15 },
  { titulo: '[CLIENTE] Obter acesso ao Meta Business (se houver campanha)',                dias: 17 },
  { titulo: '[CLIENTE] Lembrar de informar vendas para manter espelho atualizado',        dias: 21 },
  { titulo: '[CLIENTE] Avisar sobre novos lançamentos ou mudanças de tabela',             dias: 24 },
  { titulo: '[CLIENTE] Agendar reunião quinzenal de alinhamento',                         dias: 14 },
  { titulo: '[CLIENTE] Cobrar aprovação de propostas pendentes em 24h',                   dias: 28 },
];

function addDays(baseDate, n) {
  const d = new Date(baseDate + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

// POST /api/carteira → adiciona incorporadora — master ou admin
export async function POST(req) {
  try {
    await initDb();
    const me = await requireRole(req, 'master', 'admin');
    if (!me) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const { operadora_name, dev_value, dev_label, start_date } = await req.json();
    if (!operadora_name || !dev_value || !dev_label || !start_date)
      return NextResponse.json({ error: 'campos obrigatórios faltando' }, { status: 400 });

    const rows = await sql`
      INSERT INTO carteira (operadora_name, dev_value, dev_label, start_date)
      VALUES (${operadora_name}, ${dev_value}, ${dev_label}, ${start_date})
      ON CONFLICT (operadora_name, dev_value) DO UPDATE SET start_date = ${start_date}
      RETURNING (xmax = 0) AS inserted
    `;

    // Auto-cria tarefas de onboarding somente para novas entradas
    if (rows[0]?.inserted) {
      for (const t of ONBOARDING_TASKS) {
        await sql`
          INSERT INTO tarefas (operadora_name, dev_value, dev_label, titulo, data, prioridade, tipo)
          VALUES (
            ${operadora_name}, ${dev_value}, ${dev_label},
            ${t.titulo}, ${addDays(start_date, t.dias)},
            'media', 'onboarding'
          )
        `;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/carteira → atualiza data de início — master, admin ou operadora (só a própria carteira)
export async function PATCH(req) {
  try {
    const me = await requireRole(req, 'master', 'admin', 'operadora');
    if (!me) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const { operadora_name, dev_value, start_date } = await req.json();
    if (!operadora_name || !dev_value || !start_date)
      return NextResponse.json({ error: 'campos obrigatórios faltando' }, { status: 400 });

    // Operadoras só podem editar a própria carteira
    if (me.role === 'operadora' && me.operadora_name !== operadora_name)
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    await sql`
      UPDATE carteira SET start_date = ${start_date}
      WHERE operadora_name = ${operadora_name} AND dev_value = ${dev_value}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/carteira?operadora_name=X&dev_value=Y — master ou admin
export async function DELETE(req) {
  try {
    const me = await requireRole(req, 'master', 'admin');
    if (!me) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const operadora_name = searchParams.get('operadora_name');
    const dev_value = searchParams.get('dev_value');
    if (!operadora_name || !dev_value)
      return NextResponse.json({ error: 'campos obrigatórios faltando' }, { status: 400 });

    await sql`DELETE FROM carteira WHERE operadora_name = ${operadora_name} AND dev_value = ${dev_value}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
