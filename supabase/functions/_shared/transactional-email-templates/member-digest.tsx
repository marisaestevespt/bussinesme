/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Html, Preview,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

/**
 * Member Digest template — receives pre-built HTML from the send-digest edge function.
 * The digest builder already produces a full styled email body, so this template
 * acts as a thin wrapper to satisfy the registry contract.
 */
interface MemberDigestProps {
  subject?: string
  html?: string
}

const MemberDigestEmail = ({ subject, html }: MemberDigestProps) => {
  const previewText = subject || 'Briefing do dia'

  return (
    <Html lang="pt" dir="ltr">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: '#ffffff', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div dangerouslySetInnerHTML={{ __html: html || '<p>Sem conteúdo disponível.</p>'  }} />
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: MemberDigestEmail,
  subject: (data: Record<string, any>) => data.subject || 'Briefing do dia',
  displayName: 'Resumo diário (Membro)',
  previewData: {
    subject: 'Briefing do dia — 01/05/2026',
    html: '<div style="background:#f5f5f7;padding:24px;font-family:DM Sans,Arial,sans-serif"><div style="max-width:584px;margin:0 auto;background:#ffffff;border-radius:20px;padding:8px 28px 28px;box-shadow:0 1px 2px rgba(0,0,0,0.04),0 8px 24px rgba(0,0,0,0.06)"><div style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:32px 28px;color:#ffffff;border-radius:16px 16px 0 0;margin:-8px -28px 0"><p style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;opacity:0.78;margin:0 0 8px;font-weight:500">Briefing do dia</p><h1 style="font-size:24px;line-height:1.3;margin:0 0 6px;font-weight:600">Bom dia, Tiago!</h1><p style="font-size:13px;opacity:0.82;margin:0">Sexta-feira, 1 de Maio</p></div><div style="margin:18px 0 0;border-radius:14px;background:#fafafa;border:1px solid #efeff1;overflow:hidden"><div style="padding:18px 22px 16px;border-left:3px solid #6366f1"><h2 style="font-size:13px;font-weight:600;color:#1c1c1e;margin:0 0 12px;letter-spacing:0.2px">📅 As tuas reuniões</h2><div style="font-size:14px;color:#3a3a3c;line-height:1.6"><div style="padding:8px 0;border-bottom:1px solid #efeff1"><strong>10:00</strong> · Daily da equipa Dev (15min)</div><div style="padding:8px 0"><strong>15:00</strong> · Code review com Mariana (30min)</div></div></div></div><div style="margin:18px 0 0;border-radius:14px;background:#fafafa;border:1px solid #efeff1;overflow:hidden"><div style="padding:18px 22px 16px;border-left:3px solid #6366f1"><h2 style="font-size:13px;font-weight:600;color:#1c1c1e;margin:0 0 12px;letter-spacing:0.2px">✅ As tuas tarefas (4)</h2><div style="font-size:14px;color:#3a3a3c;line-height:1.6"><div style="padding:8px 0;border-bottom:1px solid #efeff1">📌 <strong>HOJE</strong> — Implementar página de pagamentos</div><div style="padding:8px 0;border-bottom:1px solid #efeff1">📌 <strong>HOJE</strong> — Fix bug no formulário de login</div><div style="padding:8px 0;border-bottom:1px solid #efeff1">🟡 Esta semana — Refactor componente de tabela</div><div style="padding:8px 0">🟡 Esta semana — Atualizar docs API</div></div></div></div><div style="margin:18px 0 0;border-radius:14px;background:#fafafa;border:1px solid #efeff1;overflow:hidden"><div style="padding:18px 22px 16px;border-left:3px solid #6366f1"><h2 style="font-size:13px;font-weight:600;color:#1c1c1e;margin:0 0 12px;letter-spacing:0.2px">🎯 Bloco de foco sugerido</h2><div style="font-size:14px;color:#3a3a3c;line-height:1.6"><div style="padding:8px 0"><strong>Manhã (2h)</strong> · Projeto Atlas — 3 tarefas agrupadas</div></div></div></div><div style="margin:18px 0 0;border-radius:14px;background:#fafafa;border:1px solid #efeff1;overflow:hidden"><div style="padding:18px 22px 16px;border-left:3px solid #6366f1"><h2 style="font-size:13px;font-weight:600;color:#1c1c1e;margin:0 0 12px;letter-spacing:0.2px">📢 Mural</h2><div style="font-size:14px;color:#3a3a3c;line-height:1.6"><div style="padding:8px 0">Nova rotina semanal: Weekly Align às sextas 11h</div></div></div></div></div></div>',
  },
} satisfies TemplateEntry
