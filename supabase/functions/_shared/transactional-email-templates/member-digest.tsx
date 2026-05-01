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
    html: '<div style="background:#f5f5f7;padding:24px;font-family:\'DM Sans\',Arial,sans-serif;color:#1c1c1e"><div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04),0 8px 24px rgba(0,0,0,0.06)"><div style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:32px 28px;color:#ffffff"><p style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;opacity:0.78;margin:0 0 8px;font-weight:500">Briefing do dia</p><h1 style="font-size:24px;line-height:1.3;margin:0 0 6px;font-weight:600">Bom dia, Ana!</h1><p style="font-size:13px;opacity:0.82;margin:0">Sexta-feira, 1 de Maio</p></div><div style="padding:8px 28px 28px"><div style="margin:18px 0 0;border-radius:14px;background:#fafafa;border:1px solid #efeff1;overflow:hidden"><div style="padding:18px 22px 16px;border-left:3px solid #6366f1"><h2 style="font-size:13px;font-weight:600;color:#1c1c1e;margin:0 0 12px;letter-spacing:0.2px">📅 Reuniões de hoje</h2><div style="font-size:14px;color:#3a3a3c;line-height:1.6"><div style="padding:8px 0;border-bottom:1px solid #efeff1"><strong>10:00</strong> · Sync diário equipa <span style="color:#86868b">(15min)</span></div><div style="padding:8px 0;"><strong>14:00</strong> · Weekly Align — Marketing</div></div></div></div><div style="margin:18px 0 0;border-radius:14px;background:#fafafa;border:1px solid #efeff1;overflow:hidden"><div style="padding:18px 22px 16px;border-left:3px solid #6366f1"><h2 style="font-size:13px;font-weight:600;color:#1c1c1e;margin:0 0 12px;letter-spacing:0.2px">✅ As tuas tarefas hoje (5)</h2><table style="width:100%;border-collapse:collapse;margin-top:4px"><thead><tr><th style="text-align:left;font-size:11px;font-weight:600;color:#86868b;text-transform:uppercase;letter-spacing:0.5px;padding:10px 8px;border-bottom:1px solid #efeff1">Tarefa</th><th style="text-align:left;font-size:11px;font-weight:600;color:#86868b;text-transform:uppercase;letter-spacing:0.5px;padding:10px 8px;border-bottom:1px solid #efeff1">Prioridade</th></tr></thead><tbody><tr><td style="text-align:left;font-size:13px;color:#1c1c1e;padding:10px 8px;border-bottom:1px solid #f3f4f6;vertical-align:middle">Validar copy do funnel principal</td><td style="text-align:left;font-size:13px;color:#1c1c1e;padding:10px 8px;border-bottom:1px solid #f3f4f6;vertical-align:middle"><span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#fef2f2;color:#b91c1c;font-size:11px;font-weight:600;letter-spacing:0.2px">Alta</span></td></tr><tr><td style="text-align:left;font-size:13px;color:#1c1c1e;padding:10px 8px;border-bottom:1px solid #f3f4f6;vertical-align:middle">Publicar campanha LinkedIn</td><td style="text-align:left;font-size:13px;color:#1c1c1e;padding:10px 8px;border-bottom:1px solid #f3f4f6;vertical-align:middle"><span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#fef2f2;color:#b91c1c;font-size:11px;font-weight:600;letter-spacing:0.2px">Alta</span></td></tr><tr><td style="text-align:left;font-size:13px;color:#1c1c1e;padding:10px 8px;border-bottom:1px solid #f3f4f6;vertical-align:middle">Rever criativos Atlas</td><td style="text-align:left;font-size:13px;color:#1c1c1e;padding:10px 8px;border-bottom:1px solid #f3f4f6;vertical-align:middle"><span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#fffbeb;color:#b45309;font-size:11px;font-weight:600;letter-spacing:0.2px">Média</span></td></tr><tr><td style="text-align:left;font-size:13px;color:#1c1c1e;padding:10px 8px;border-bottom:1px solid #f3f4f6;vertical-align:middle">Atualizar dashboard semanal</td><td style="text-align:left;font-size:13px;color:#1c1c1e;padding:10px 8px;border-bottom:1px solid #f3f4f6;vertical-align:middle"><span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#fffbeb;color:#b45309;font-size:11px;font-weight:600;letter-spacing:0.2px">Média</span></td></tr><tr><td style="text-align:left;font-size:13px;color:#1c1c1e;padding:10px 8px;border-bottom:1px solid #f3f4f6;vertical-align:middle">Organizar pasta de assets</td><td style="text-align:left;font-size:13px;color:#1c1c1e;padding:10px 8px;border-bottom:1px solid #f3f4f6;vertical-align:middle"><span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#f3f4f6;color:#4b5563;font-size:11px;font-weight:600;letter-spacing:0.2px">Baixa</span></td></tr></tbody></table></div></div><div style="margin:18px 0 0;border-radius:14px;background:#fafafa;border:1px solid #efeff1;overflow:hidden"><div style="padding:18px 22px 16px;border-left:3px solid #6366f1"><h2 style="font-size:13px;font-weight:600;color:#1c1c1e;margin:0 0 12px;letter-spacing:0.2px">⏰ Em atraso (1)</h2><table style="width:100%;border-collapse:collapse;margin-top:4px"><thead><tr><th style="text-align:left;font-size:11px;font-weight:600;color:#86868b;text-transform:uppercase;letter-spacing:0.5px;padding:10px 8px;border-bottom:1px solid #efeff1">Tarefa</th><th style="text-align:left;font-size:11px;font-weight:600;color:#86868b;text-transform:uppercase;letter-spacing:0.5px;padding:10px 8px;border-bottom:1px solid #efeff1">Prioridade</th><th style="text-align:right;font-size:11px;font-weight:600;color:#86868b;text-transform:uppercase;letter-spacing:0.5px;padding:10px 8px;border-bottom:1px solid #efeff1">Atraso</th></tr></thead><tbody><tr><td style="text-align:left;font-size:13px;color:#1c1c1e;padding:10px 8px;border-bottom:1px solid #f3f4f6;vertical-align:middle">Enviar feedback ao designer</td><td style="text-align:left;font-size:13px;color:#1c1c1e;padding:10px 8px;border-bottom:1px solid #f3f4f6;vertical-align:middle"><span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#fffbeb;color:#b45309;font-size:11px;font-weight:600;letter-spacing:0.2px">Média</span></td><td style="text-align:right;font-size:13px;color:#1c1c1e;padding:10px 8px;border-bottom:1px solid #f3f4f6;vertical-align:middle"><span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#fffbeb;color:#b45309;font-size:11px;font-weight:600;letter-spacing:0.2px">2 dias</span></td></tr></tbody></table></div></div><div style="margin:18px 0 0;border-radius:14px;background:#fafafa;border:1px solid #efeff1;overflow:hidden"><div style="padding:18px 22px 16px;border-left:3px solid #6366f1"><h2 style="font-size:13px;font-weight:600;color:#1c1c1e;margin:0 0 12px;letter-spacing:0.2px">🎯 Foco da semana</h2><div style="font-size:14px;color:#3a3a3c;line-height:1.6"><div style="padding:8px 0;border-bottom:1px solid #efeff1">Lançamento campanha Maio — entrega quinta</div><div style="padding:8px 0;">2 entregas pendentes para clientes</div></div></div></div></div></div></div>',
  },
} satisfies TemplateEntry
