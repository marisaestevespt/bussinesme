/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Html, Preview,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface MemberEodDigestProps {
  subject?: string
  html?: string
}

const MemberEodDigestEmail = ({ subject, html }: MemberEodDigestProps) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>{subject || 'Wrap-up do dia'}</Preview>
    <Body style={{ backgroundColor: '#ffffff', margin: 0, padding: 0 }}>
      <Container style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div dangerouslySetInnerHTML={{ __html: html || '<p>Sem conteúdo disponível.</p>'  }} />
        </Container>
    </Body>
  </Html>
)

export const template = {
  component: MemberEodDigestEmail,
  subject: (data: Record<string, any>) => data.subject || 'Wrap-up do dia',
  displayName: 'Wrap-up do dia (Membro)',
  previewData: {
    subject: 'Wrap-up do dia — 01/05/2026',
    html: '<div style="padding:24px 32px;font-family:DM Sans,Arial,sans-serif;background:#ffffff"><p style="font-size:13px;color:#6366f1;margin:0 0 4px;font-weight:600">Boa noite, Tiago! Aqui está o resumo do que fizeste hoje.</p><p style="font-size:10px;color:#888;margin:0 0 18px">Sexta-feira, 1 de Maio</p><h3 style="font-size:14px;margin:18px 0 8px;color:#111">✅ Concluído hoje</h3><ul style="margin:0 0 14px;padding-left:18px;font-size:12px;color:#444"><li>3 tarefas concluídas 🌟</li><li>2 reuniões participadas</li><li>1 entrega submetida — Página de pagamentos</li></ul><h3 style="font-size:14px;margin:18px 0 8px;color:#111">⚠️ Por terminar</h3><ul style="margin:0 0 14px;padding-left:18px;font-size:12px;color:#444"><li>1 tarefa em atraso — Fix bug login</li><li>1 tarefa para amanhã — Refactor tabela</li></ul><h3 style="font-size:14px;margin:18px 0 8px;color:#111">🌅 Amanhã</h3><ul style="margin:0 0 14px;padding-left:18px;font-size:12px;color:#444"><li>1 reunião marcada — Sprint planning 10h</li><li>4 tarefas no plano do dia</li></ul></div>',
  },
} satisfies TemplateEntry
