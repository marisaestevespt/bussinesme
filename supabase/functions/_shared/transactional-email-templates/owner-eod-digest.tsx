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
    html: '<div style="background:#f5f5f7;padding:24px;font-family:\'DM Sans\',Arial,sans-serif;color:#1c1c1e"><div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04),0 8px 24px rgba(0,0,0,0.06)"><div style="background:linear-gradient(135deg,#6f1f2b 0%,#d9a4a1 100%);padding:32px 28px;color:#ffffff"><p style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;opacity:0.78;margin:0 0 8px;font-weight:500">Wrap-up do dia</p><h1 style="font-size:24px;line-height:1.3;margin:0 0 6px;font-weight:600">Boa noite, Mariana!</h1><p style="font-size:13px;opacity:0.82;margin:0">Sexta-feira, 1 de Maio</p></div><div style="padding:8px 28px 28px"><div style="margin:18px 0 0;border-radius:14px;background:#fafafa;border:1px solid #efeff1;overflow:hidden"><div style="padding:18px 22px 16px;border-left:3px solid #6f1f2b"><h2 style="font-size:13px;font-weight:600;color:#1c1c1e;margin:0 0 12px;letter-spacing:0.2px">✅ Concluído hoje</h2><div style="font-size:14px;color:#3a3a3c;line-height:1.6"><div style="padding:8px 0;border-bottom:1px solid #efeff1">4 reuniões realizadas</div><div style="padding:8px 0;border-bottom:1px solid #efeff1">12 tarefas concluídas pela equipa</div><div style="padding:8px 0;border-bottom:1px solid #efeff1">2 entregas enviadas a clientes</div><div style="padding:8px 0;">1 venda fechada · <strong>€2.400</strong> (Atlas Studio)</div></div></div></div><div style="margin:18px 0 0;border-radius:14px;background:#fafafa;border:1px solid #efeff1;overflow:hidden"><div style="padding:18px 22px 16px;border-left:3px solid #6f1f2b"><h2 style="font-size:13px;font-weight:600;color:#1c1c1e;margin:0 0 12px;letter-spacing:0.2px">⚠️ Ficou por fazer</h2><table style="width:100%;border-collapse:collapse;margin-top:4px"><thead><tr><th style="text-align:left;font-size:11px;font-weight:600;color:#86868b;text-transform:uppercase;letter-spacing:0.5px;padding:10px 8px;border-bottom:1px solid #efeff1">Tarefa</th><th style="text-align:left;font-size:11px;font-weight:600;color:#86868b;text-transform:uppercase;letter-spacing:0.5px;padding:10px 8px;border-bottom:1px solid #efeff1">Responsável</th><th style="text-align:left;font-size:11px;font-weight:600;color:#86868b;text-transform:uppercase;letter-spacing:0.5px;padding:10px 8px;border-bottom:1px solid #efeff1">Prioridade</th></tr></thead><tbody><tr><td style="text-align:left;font-size:13px;color:#1c1c1e;padding:10px 8px;border-bottom:1px solid #f3f4f6;vertical-align:middle">Rever apresentação Q2</td><td style="text-align:left;font-size:13px;color:#1c1c1e;padding:10px 8px;border-bottom:1px solid #f3f4f6;vertical-align:middle">Mariana</td><td style="text-align:left;font-size:13px;color:#1c1c1e;padding:10px 8px;border-bottom:1px solid #f3f4f6;vertical-align:middle"><span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#fef2f2;color:#b91c1c;font-size:11px;font-weight:600;letter-spacing:0.2px">Alta</span></td></tr><tr><td style="text-align:left;font-size:13px;color:#1c1c1e;padding:10px 8px;border-bottom:1px solid #f3f4f6;vertical-align:middle">Fechar relatório semanal</td><td style="text-align:left;font-size:13px;color:#1c1c1e;padding:10px 8px;border-bottom:1px solid #f3f4f6;vertical-align:middle">Tiago</td><td style="text-align:left;font-size:13px;color:#1c1c1e;padding:10px 8px;border-bottom:1px solid #f3f4f6;vertical-align:middle"><span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#fef2f2;color:#b91c1c;font-size:11px;font-weight:600;letter-spacing:0.2px">Alta</span></td></tr><tr><td style="text-align:left;font-size:13px;color:#1c1c1e;padding:10px 8px;border-bottom:1px solid #f3f4f6;vertical-align:middle">Responder email cliente Z</td><td style="text-align:left;font-size:13px;color:#1c1c1e;padding:10px 8px;border-bottom:1px solid #f3f4f6;vertical-align:middle">Ana</td><td style="text-align:left;font-size:13px;color:#1c1c1e;padding:10px 8px;border-bottom:1px solid #f3f4f6;vertical-align:middle"><span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#fffbeb;color:#b45309;font-size:11px;font-weight:600;letter-spacing:0.2px">Média</span></td></tr></tbody></table></div></div><div style="margin:18px 0 0;border-radius:14px;background:#fafafa;border:1px solid #efeff1;overflow:hidden"><div style="padding:18px 22px 16px;border-left:3px solid #6f1f2b"><h2 style="font-size:13px;font-weight:600;color:#1c1c1e;margin:0 0 12px;letter-spacing:0.2px">💰 Movimento financeiro</h2><div style="font-size:14px;color:#3a3a3c;line-height:1.6"><div style="padding:8px 0;border-bottom:1px solid #efeff1">Recebimentos: <strong>€3.850</strong></div><div style="padding:8px 0;border-bottom:1px solid #efeff1">Pagamentos: €420</div><div style="padding:8px 0;">Saldo do dia: <strong style="color:#16a34a">+€3.430</strong></div></div></div></div><div style="margin:18px 0 0;border-radius:14px;background:#fafafa;border:1px solid #efeff1;overflow:hidden"><div style="padding:18px 22px 16px;border-left:3px solid #6f1f2b"><h2 style="font-size:13px;font-weight:600;color:#1c1c1e;margin:0 0 12px;letter-spacing:0.2px">🌅 Amanhã</h2><div style="font-size:14px;color:#3a3a3c;line-height:1.6"><div style="padding:8px 0;border-bottom:1px solid #efeff1">2 reuniões marcadas</div><div style="padding:8px 0;border-bottom:1px solid #efeff1">6 tarefas planeadas</div><div style="padding:8px 0;">1 entrega prevista</div></div></div></div></div></div></div>',
  },
} satisfies TemplateEntry
