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
    html: '<div style="padding:24px 32px;font-family:DM Sans,Arial,sans-serif;background:#ffffff"><p style="font-size:13px;color:#6366f1;margin:0 0 4px;font-weight:600">Bom dia, Mariana! Aqui está o teu briefing para hoje.</p><p style="font-size:10px;color:#888;margin:0 0 18px">Sexta-feira, 1 de Maio</p><h3 style="font-size:14px;margin:18px 0 8px;color:#111">📅 Reuniões de hoje</h3><ul style="margin:0 0 14px;padding-left:18px;font-size:12px;color:#444"><li>09:30 — Onboarding com <strong>Inês Silva</strong> (45min)</li><li>14:00 — Weekly Align — Equipa Marketing</li><li>16:30 — Comercial — chamada com lead "Atlas Studio"</li></ul><h3 style="font-size:14px;margin:18px 0 8px;color:#111">✅ Tarefas para hoje (5)</h3><ul style="margin:0 0 14px;padding-left:18px;font-size:12px;color:#444"><li>📌 Rever proposta do projeto Lirah</li><li>📌 Aprovar entregas da semana — Marketing</li><li>🟡 Validar copy do funnel principal</li><li>🟡 Check-in com Tiago (dev)</li><li>🟡 Responder a 3 emails pendentes</li></ul><h3 style="font-size:14px;margin:18px 0 8px;color:#111">💰 Financeiro</h3><ul style="margin:0 0 14px;padding-left:18px;font-size:12px;color:#444"><li>2 faturas vencem hoje (€1.450)</li><li>1 pagamento a fornecedor — Vodafone (€89)</li><li>Saldo previsto fim do mês: <strong>€8.230</strong></li></ul><h3 style="font-size:14px;margin:18px 0 8px;color:#111">📋 Prazos Fiscais</h3><ul style="margin:0 0 14px;padding-left:18px;font-size:12px;color:#444"><li>🟡 IVA 1º Trim 2026 — em 14 dias</li><li>🟡 Pagamento SS — Maio 2026 — em 19 dias</li></ul><h3 style="font-size:14px;margin:18px 0 8px;color:#111">👥 Equipa</h3><ul style="margin:0 0 14px;padding-left:18px;font-size:12px;color:#444"><li>3 membros ativos hoje · 1 a aguardar onboarding</li><li>Ana entregou 4 tarefas ontem 🌟</li></ul></div>',
  },
} satisfies TemplateEntry
