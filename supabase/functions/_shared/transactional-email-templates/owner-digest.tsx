/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Html, Preview,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

/**
 * Owner Digest template — receives pre-built HTML from the send-digest edge function.
 * The digest builder already produces a full styled email body, so this template
 * acts as a thin wrapper to satisfy the registry contract.
 */
interface OwnerDigestProps {
  subject?: string
  html?: string
}

const OwnerDigestEmail = ({ subject, html }: OwnerDigestProps) => {
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
  component: OwnerDigestEmail,
  subject: (data: Record<string, any>) => data.subject || 'Briefing do dia',
  displayName: 'Resumo diário (Owner)',
  previewData: {
    subject: 'Briefing do dia — O Teu Negócio — 01/05/2026',
    html: '<div style="background:#f5f5f7;padding:24px;font-family:DM Sans,Arial,sans-serif"><div style="max-width:584px;margin:0 auto;background:#ffffff;border-radius:20px;padding:8px 28px 28px;box-shadow:0 1px 2px rgba(0,0,0,0.04),0 8px 24px rgba(0,0,0,0.06)"><div style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:32px 28px;color:#ffffff;border-radius:16px 16px 0 0;margin:-8px -28px 0"><p style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;opacity:0.78;margin:0 0 8px;font-weight:500">Briefing do dia</p><h1 style="font-size:24px;line-height:1.3;margin:0 0 6px;font-weight:600">Bom dia, Mariana!</h1><p style="font-size:13px;opacity:0.82;margin:0">Sexta-feira, 1 de Maio</p></div><div style="margin:18px 0 0;border-radius:14px;background:#fafafa;border:1px solid #efeff1;overflow:hidden"><div style="padding:18px 22px 16px;border-left:3px solid #6366f1"><h2 style="font-size:13px;font-weight:600;color:#1c1c1e;margin:0 0 12px;letter-spacing:0.2px">📅 Reuniões de hoje</h2><div style="font-size:14px;color:#3a3a3c;line-height:1.6"><div style="padding:8px 0;border-bottom:1px solid #efeff1"><strong>09:30</strong> · Onboarding com Inês Silva <span style="color:#86868b">(45min)</span></div><div style="padding:8px 0;border-bottom:1px solid #efeff1"><strong>14:00</strong> · Weekly Align — Equipa Marketing</div><div style="padding:8px 0"><strong>16:30</strong> · Comercial — Atlas Studio</div></div></div></div><div style="margin:18px 0 0;border-radius:14px;background:#fafafa;border:1px solid #efeff1;overflow:hidden"><div style="padding:18px 22px 16px;border-left:3px solid #6366f1"><h2 style="font-size:13px;font-weight:600;color:#1c1c1e;margin:0 0 12px;letter-spacing:0.2px">✅ Tarefas para hoje (5)</h2><div style="font-size:14px;color:#3a3a3c;line-height:1.6"><div style="padding:8px 0;border-bottom:1px solid #efeff1">📌 Rever proposta do projeto Lirah</div><div style="padding:8px 0;border-bottom:1px solid #efeff1">📌 Aprovar entregas da semana — Marketing</div><div style="padding:8px 0;border-bottom:1px solid #efeff1">🟡 Validar copy do funnel principal</div><div style="padding:8px 0;border-bottom:1px solid #efeff1">🟡 Check-in com Tiago (dev)</div><div style="padding:8px 0">🟡 Responder a 3 emails pendentes</div></div></div></div><div style="margin:18px 0 0;border-radius:14px;background:#fafafa;border:1px solid #efeff1;overflow:hidden"><div style="padding:18px 22px 16px;border-left:3px solid #6366f1"><h2 style="font-size:13px;font-weight:600;color:#1c1c1e;margin:0 0 12px;letter-spacing:0.2px">💰 Financeiro</h2><div style="font-size:14px;color:#3a3a3c;line-height:1.6"><div style="padding:8px 0;border-bottom:1px solid #efeff1">2 faturas vencem hoje · <strong>€1.450</strong></div><div style="padding:8px 0;border-bottom:1px solid #efeff1">1 pagamento a fornecedor · €89</div><div style="padding:8px 0">Saldo previsto fim do mês: <strong>€8.230</strong></div></div></div></div><div style="margin:18px 0 0;border-radius:14px;background:#fafafa;border:1px solid #efeff1;overflow:hidden"><div style="padding:18px 22px 16px;border-left:3px solid #6366f1"><h2 style="font-size:13px;font-weight:600;color:#1c1c1e;margin:0 0 12px;letter-spacing:0.2px">📋 Prazos Fiscais</h2><div style="font-size:14px;color:#3a3a3c;line-height:1.6"><div style="padding:8px 0;border-bottom:1px solid #efeff1">🟡 IVA 1º Trim 2026 — <strong>em 14 dias</strong></div><div style="padding:8px 0">🟡 Pagamento SS Maio 2026 — <strong>em 19 dias</strong></div></div></div></div><div style="margin:18px 0 0;border-radius:14px;background:#fafafa;border:1px solid #efeff1;overflow:hidden"><div style="padding:18px 22px 16px;border-left:3px solid #6366f1"><h2 style="font-size:13px;font-weight:600;color:#1c1c1e;margin:0 0 12px;letter-spacing:0.2px">👥 Equipa</h2><div style="font-size:14px;color:#3a3a3c;line-height:1.6"><div style="padding:8px 0;border-bottom:1px solid #efeff1">3 membros ativos hoje · 1 a aguardar onboarding</div><div style="padding:8px 0">Ana entregou 4 tarefas ontem 🌟</div></div></div></div></div></div>',
  },
} satisfies TemplateEntry
