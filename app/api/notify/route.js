import { NextResponse } from 'next/server';
import { sendEmail } from '../../lib/email';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.APP_URL || 'https://dashboard-operadora-de-parcerias.vercel.app';

function buildEmailHtml({ nome, role }) {
  const isGestor = role === 'gestor';
  const isMaster = role === 'master';

  const gestorBlock = (isGestor || isMaster) ? `
    <div style="background:#111;border-radius:8px;padding:20px 24px;margin:20px 0">
      <div style="color:#E8392A;font-weight:700;font-size:14px;margin-bottom:12px">
        ${isMaster ? '👑 Suas permissoes (Master)' : '🎯 Suas permissoes (Gestor)'}
      </div>
      <ul style="margin:0;padding-left:20px;color:#ccc;font-size:14px;line-height:2">
        ${isMaster ? `
          <li>Criar, editar e excluir <strong>materiais</strong> do playbook</li>
          <li>Ver o <strong>desempenho de todos os usuarios</strong></li>
          <li>Criar e gerenciar <strong>trilhas de conhecimento</strong></li>
          <li>Adicionar e remover usuarios</li>
          <li>Acesso total ao painel</li>
        ` : `
          <li>Adicionar e remover <strong>usuarios</strong> (apenas os que voce cadastrou)</li>
          <li>Ver o <strong>desempenho</strong> dos seus usuarios (acessos, progresso, materiais faltantes)</li>
          <li>Criar e modificar <strong>trilhas de conhecimento</strong></li>
          <li>Atribuir trilhas aos seus usuarios</li>
        `}
      </ul>
    </div>
  ` : '';

  const trilhasBlock = `
    <div style="background:#111;border-radius:8px;padding:20px 24px;margin:20px 0">
      <div style="color:#f59e0b;font-weight:700;font-size:14px;margin-bottom:12px">🎯 Trilhas de Conhecimento — O que sao?</div>
      <p style="color:#ccc;font-size:14px;line-height:1.7;margin:0 0 12px">
        Trilhas sao <strong>selecoes personalizadas de materiais</strong> que voce monta e atribui a usuarios especificos.
      </p>
      <p style="color:#ccc;font-size:14px;line-height:1.7;margin:0 0 12px">
        <strong>Exemplo:</strong> Voce cria uma trilha chamada "Onboarding" e seleciona os 10 materiais essenciais para novos membros.
        Depois, atribui essa trilha aos usuarios recem-cadastrados. Eles verao a trilha na aba "Minhas Trilhas" com uma barra de progresso.
      </p>
      <div style="background:#0a0a0a;border:1px solid #222;border-radius:6px;padding:16px;margin-top:12px">
        <div style="color:#999;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Como criar uma trilha:</div>
        <ol style="margin:0;padding-left:20px;color:#ccc;font-size:13px;line-height:2">
          <li>Acesse o <strong>Painel da Operadora</strong> e clique em <strong>"📚 Playbook"</strong></li>
          <li>Va na aba <strong>"🎯 Trilhas"</strong></li>
          <li>Clique em <strong>"+ Nova Trilha"</strong></li>
          <li>De um nome (ex: Onboarding, Treinamento Avancado)</li>
          <li>Selecione os <strong>materiais</strong> que compoem a trilha</li>
          <li>Selecione os <strong>usuarios</strong> que receberao essa trilha</li>
          <li>Clique em <strong>"Criar Trilha"</strong> — pronto!</li>
        </ol>
      </div>
      <p style="color:#888;font-size:13px;margin-top:12px">
        Depois de criar, voce pode abrir a trilha para adicionar/remover materiais e usuarios a qualquer momento.
      </p>
    </div>
  `;

  const trackingBlock = `
    <div style="background:#111;border-radius:8px;padding:20px 24px;margin:20px 0">
      <div style="color:#22c55e;font-weight:700;font-size:14px;margin-bottom:12px">📊 Acompanhamento de Desempenho</div>
      <p style="color:#ccc;font-size:14px;line-height:1.7;margin:0 0 12px">
        Na aba <strong>"📊 Acessos por Usuario"</strong> voce ve:
      </p>
      <ul style="margin:0;padding-left:20px;color:#ccc;font-size:13px;line-height:2">
        <li>Quantas vezes cada usuario acessou cada material</li>
        <li>Total de acessos no playbook</li>
        <li>Quantos materiais ja viu vs. quantos faltam</li>
        <li>Barra de progresso visual</li>
        <li>Clique no usuario para ver o detalhamento completo</li>
      </ul>
    </div>
  `;

  return `
    <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;max-width:560px;margin:auto;background:#0a0a0a;color:#f5f5f5">
      <div style="background:#E8392A;padding:28px 32px;text-align:center;border-radius:10px 10px 0 0">
        <div style="font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.5px">Playbook DWV</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.7);margin-top:6px">Atualizacao do Sistema</div>
      </div>
      <div style="padding:28px 32px;border:1px solid #1a1a1a;border-top:none;border-radius:0 0 10px 10px">
        <p style="font-size:16px;margin:0 0 8px">Ola <strong>${nome}</strong>,</p>
        <p style="color:#ccc;font-size:14px;line-height:1.7;margin:0 0 20px">
          O Playbook DWV recebeu atualizacoes importantes. Agora temos um sistema completo de
          <strong>trilhas de conhecimento</strong>, <strong>tracking de acessos</strong> e
          <strong>permissoes por perfil</strong>. Veja abaixo o que mudou:
        </p>

        <div style="background:#111;border-radius:8px;padding:20px 24px;margin:20px 0">
          <div style="color:#3b82f6;font-weight:700;font-size:14px;margin-bottom:12px">🆕 O que ha de novo</div>
          <ul style="margin:0;padding-left:20px;color:#ccc;font-size:14px;line-height:2">
            <li><strong>3 perfis de usuario</strong> — Master, Gestor e Usuario</li>
            <li><strong>Trilhas de Conhecimento</strong> — selecoes personalizadas de materiais</li>
            <li><strong>Tracking de acessos</strong> — veja quem esta acessando o que</li>
            <li><strong>Progresso por usuario</strong> — acessos, materiais vistos e faltantes</li>
            <li><strong>Gestao de usuarios por gestor</strong> — cada gestor gerencia seus usuarios</li>
          </ul>
        </div>

        ${gestorBlock}
        ${trilhasBlock}
        ${trackingBlock}

        <div style="text-align:center;margin:28px 0">
          <a href="${APP_URL}" style="background:#E8392A;color:#fff;text-decoration:none;padding:14px 40px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block">
            Acessar o Painel
          </a>
        </div>

        <div style="border-top:1px solid #1a1a1a;padding-top:16px;margin-top:24px">
          <p style="color:#555;font-size:12px;margin:0;text-align:center">
            DWV — Gestao de Parcerias Imobiliarias<br>
            Este email foi enviado automaticamente. Nao responda.
          </p>
        </div>
      </div>
    </div>
  `;
}

export async function POST(req) {
  try {
    const secret = req.headers.get('x-notify-secret');
    if (secret !== 'dwv-notify-2026')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const recipients = [
      { email: 'diogowoliveira@gmail.com', nome: 'Diogo', role: 'master' },
      { email: 'danilorealgarcia@gmail.com', nome: 'Danilo', role: 'gestor' },
      { email: 'michelldwv@gmail.com', nome: 'Michel', role: 'gestor' },
    ];

    const results = [];
    for (const r of recipients) {
      try {
        await sendEmail({
          to: r.email,
          subject: '🆕 Playbook DWV — Novas funcionalidades disponíveis',
          html: buildEmailHtml(r),
        });
        results.push({ email: r.email, ok: true });
      } catch (err) {
        results.push({ email: r.email, ok: false, error: err.message });
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
