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
    html: '<div style="padding:24px 32px;font-family:DM Sans,Arial,sans-serif;background:#ffffff"><p style="font-size:13px;color:#6366f1;margin:0 0 4px;font-weight:600">Bom dia, Tiago! Aqui está o teu briefing para hoje.</p><p style="font-size:10px;color:#888;margin:0 0 18px">Sexta-feira, 1 de Maio</p><h3 style="font-size:14px;margin:18px 0 8px;color:#111">📅 As tuas reuniões</h3><ul style="margin:0 0 14px;padding-left:18px;font-size:12px;color:#444"><li>10:00 — Daily da equipa Dev (15min)</li><li>15:00 — Code review com Mariana (30min)</li></ul><h3 style="font-size:14px;margin:18px 0 8px;color:#111">✅ As tuas tarefas (4)</h3><ul style="margin:0 0 14px;padding-left:18px;font-size:12px;color:#444"><li>📌 HOJE — Implementar página de pagamentos</li><li>📌 HOJE — Fix bug no formulário de login</li><li>🟡 Esta semana — Refactor componente de tabela</li><li>🟡 Esta semana — Atualizar docs API</li></ul><h3 style="font-size:14px;margin:18px 0 8px;color:#111">🎯 Bloco de foco sugerido</h3><ul style="margin:0 0 14px;padding-left:18px;font-size:12px;color:#444"><li>Manhã (2h): Projeto Atlas — 3 tarefas agrupadas</li></ul><h3 style="font-size:14px;margin:18px 0 8px;color:#111">📢 Mural</h3><ul style="margin:0 0 14px;padding-left:18px;font-size:12px;color:#444"><li>Nova rotina semanal: Weekly Align às sextas 11h</li></ul></div>',
  },
} satisfies TemplateEntry
