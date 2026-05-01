/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Html, Preview,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface OwnerEodDigestProps {
  subject?: string
  html?: string
}

const OwnerEodDigestEmail = ({ subject, html }: OwnerEodDigestProps) => (
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
  component: OwnerEodDigestEmail,
  subject: (data: Record<string, any>) => data.subject || 'Wrap-up do dia',
  displayName: 'Wrap-up do dia (Owner)',
  previewData: {
    subject: 'Wrap-up do dia — O Teu Negócio — 01/05/2026',
    html: '<div style="padding:24px 32px;font-family:DM Sans,Arial,sans-serif;background:#ffffff"><p style="font-size:13px;color:#6366f1;margin:0 0 4px;font-weight:600">Boa noite, Mariana! Aqui está o resumo do que aconteceu hoje.</p><p style="font-size:10px;color:#888;margin:0 0 18px">Sexta-feira, 1 de Maio</p><h3 style="font-size:14px;margin:18px 0 8px;color:#111">✅ Concluído hoje</h3><ul style="margin:0 0 14px;padding-left:18px;font-size:12px;color:#444"><li>4 reuniões realizadas</li><li>12 tarefas concluídas pela equipa</li><li>2 entregas enviadas a clientes</li><li>1 venda fechada — <strong>€2.400</strong> (Atlas Studio)</li></ul><h3 style="font-size:14px;margin:18px 0 8px;color:#111">⚠️ Ficou por fazer</h3><ul style="margin:0 0 14px;padding-left:18px;font-size:12px;color:#444"><li>3 tarefas tuas em atraso</li><li>1 reunião sem notas registadas</li></ul><h3 style="font-size:14px;margin:18px 0 8px;color:#111">💰 Movimento financeiro</h3><ul style="margin:0 0 14px;padding-left:18px;font-size:12px;color:#444"><li>Recebimentos: €3.850</li><li>Pagamentos: €420</li><li>Saldo do dia: <strong>+€3.430</strong></li></ul><h3 style="font-size:14px;margin:18px 0 8px;color:#111">🌅 Amanhã</h3><ul style="margin:0 0 14px;padding-left:18px;font-size:12px;color:#444"><li>2 reuniões marcadas</li><li>6 tarefas planeadas</li><li>1 entrega prevista</li></ul></div>',
  },
} satisfies TemplateEntry
