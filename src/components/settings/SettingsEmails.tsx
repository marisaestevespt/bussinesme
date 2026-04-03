import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Mail, Eye } from 'lucide-react';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';

const TEMPLATES = [
  {
    key: 'invoice-available',
    label: 'Fatura disponível',
    description: 'Enviado quando uma fatura é adicionada a uma venda',
    previewData: {
      clientName: 'Ana Silva',
      productName: 'Consultoria Digital',
      amount: '350.00',
      portalUrl: '#',
    },
  },
  {
    key: 'payment-reminder',
    label: 'Lembrete de pagamento',
    description: 'Enviado automaticamente antes do vencimento',
    previewData: {
      clientName: 'Ana Silva',
      productName: 'Consultoria Digital',
      amount: '350',
      dueDate: '15/04/2026',
      daysUntil: 3,
    },
  },
  {
    key: 'welcome-member',
    label: 'Boas-vindas membro',
    description: 'Enviado quando um novo membro é adicionado à equipa',
    previewData: {
      memberName: 'João Santos',
      inviteUrl: '#',
      ownerName: 'Maria',
    },
  },
  {
    key: 'client-offboarding',
    label: 'Offboarding cliente',
    description: 'Enviado ao cliente quando inicia o processo de saída',
    previewData: {
      clientName: 'Ana Silva',
      portalUrl: '#',
      portalDays: 30,
    },
  },
] as const;

function hslToCss(hsl: string | undefined, fallback: string): string {
  if (!hsl) return fallback;
  return `hsl(${hsl.replace(/ /g, ', ')})`;
}

function renderEmailPreview(
  templateKey: string,
  previewData: Record<string, any>,
  settings: {
    business_name?: string;
    primary_color?: string;
    text_color?: string;
    accent_color?: string;
    font_display?: string;
    font_body?: string;
    logo_url?: string | null;
  }
) {
  const biz = settings.business_name || 'O teu Negócio';
  const brandPrimary = hslToCss(settings.primary_color, '#e04a2f');
  const brandText = hslToCss(settings.text_color, '#1a1f36');
  const brandMuted = hslToCss(settings.accent_color, '#555770');
  const bodyFont = settings.font_body ? `'${settings.font_body}', Arial, sans-serif` : "'DM Sans', Arial, sans-serif";
  const displayFont = settings.font_display ? `'${settings.font_display}', Georgia, serif` : bodyFont;
  const logoUrl = settings.logo_url || null;

  const name = previewData.clientName || previewData.memberName || 'Cliente';

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${biz}" style="width:48px;height:48px;border-radius:10px;margin:0 auto 16px;display:block" />`
    : `<p style="font-size:48px;margin:0 0 8px;line-height:1;text-align:center">${getEmoji(templateKey)}</p>`;

  const bodyContent = getTemplateBody(templateKey, previewData, { biz, brandPrimary, brandText, brandMuted, bodyFont, displayFont, name });

  return `
    <div style="background:#ffffff;font-family:${bodyFont};max-width:540px;margin:0 auto;padding:32px 20px">
      <div style="text-align:center;padding:0 0 8px">
        ${logoHtml}
        <h1 style="font-size:20px;font-weight:700;color:${brandText};margin:0 0 10px;line-height:1.3;font-family:${displayFont}">
          ${getTitle(templateKey, name)}
        </h1>
        <p style="font-size:14px;color:${brandMuted};line-height:1.6;margin:0">
          ${getSubtitle(templateKey, previewData)}
        </p>
      </div>
      <hr style="border:none;border-top:1px solid #e8e8ed;margin:24px 0">
      ${bodyContent}
      <hr style="border:none;border-top:1px solid #e8e8ed;margin:24px 0">
      <p style="font-size:12px;color:#999;text-align:center;margin:20px 0 0;line-height:1.6">
        Com os melhores cumprimentos,<br>A equipa ${biz}
      </p>
    </div>
  `;
}

function getEmoji(key: string) {
  switch (key) {
    case 'invoice-available': return '📄';
    case 'payment-reminder': return '🔔';
    case 'welcome-member': return '👋';
    case 'client-offboarding': return '📋';
    default: return '📧';
  }
}

function getTitle(key: string, name: string) {
  switch (key) {
    case 'invoice-available': return `${name}, a sua fatura já está disponível`;
    case 'payment-reminder': return `${name}, lembrete de pagamento`;
    case 'welcome-member': return `Bem-vindo/a, ${name}!`;
    case 'client-offboarding': return `${name}, informações sobre a sua transição`;
    default: return '';
  }
}

function getSubtitle(key: string, data: Record<string, any>) {
  switch (key) {
    case 'invoice-available':
      return `A fatura no valor de ${data.amount || '—'}€ referente a ${data.productName || 'o seu serviço'} já se encontra disponível para consulta no seu portal de cliente.`;
    case 'payment-reminder':
      return `Enviamos este lembrete para que possa organizar o pagamento referente a ${data.productName || 'o seu serviço'}, que vence em breve.`;
    case 'welcome-member':
      return 'Foste adicionado/a à equipa. Clica no botão abaixo para aceder à plataforma.';
    case 'client-offboarding':
      return `Estamos a preparar a sua transição. O acesso ao portal permanecerá ativo durante ${data.portalDays || 30} dias.`;
    default: return '';
  }
}

function getTemplateBody(
  key: string,
  data: Record<string, any>,
  style: { biz: string; brandPrimary: string; brandText: string; brandMuted: string; bodyFont: string; displayFont: string; name: string }
) {
  const cardStyle = 'background-color:#f7f7fa;border-radius:10px;padding:16px 20px;margin-bottom:12px';
  const rowStyle = `font-size:13px;color:${style.brandMuted};line-height:2;margin:0`;
  const labelStyle = `font-weight:600;color:${style.brandText}`;
  const btnStyle = `background-color:${style.brandPrimary};color:#ffffff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;display:inline-block`;

  switch (key) {
    case 'invoice-available':
      return `
        <div style="${cardStyle}">
          <p style="${rowStyle}"><span style="${labelStyle}">Serviço: </span>${data.productName || '—'}</p>
          <p style="${rowStyle}"><span style="${labelStyle}">Valor: </span>${data.amount || '—'}€</p>
        </div>
        <div style="text-align:center;margin:20px 0">
          <a href="#" style="${btnStyle}">Consultar no Portal</a>
        </div>
        <p style="font-size:13px;color:${style.brandMuted};line-height:1.6;margin:0;text-align:center">
          Pode aceder ao seu portal de cliente a qualquer momento para consultar as suas faturas e documentos.
        </p>
      `;
    case 'payment-reminder':
      return `
        <div style="${cardStyle}">
          <p style="font-size:24px;font-weight:700;color:${style.brandPrimary};text-align:center;margin:12px 0 4px;font-family:${style.displayFont}">${data.amount || '—'}€</p>
          <p style="font-size:11px;color:${style.brandMuted};text-align:center;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.5px">Valor a pagar</p>
          <p style="${rowStyle}"><span style="${labelStyle}">Serviço: </span>${data.productName || '—'}</p>
          <p style="${rowStyle}"><span style="${labelStyle}">Data de vencimento: </span>${data.dueDate || '—'}</p>
        </div>
        <p style="font-size:13px;color:${style.brandMuted};line-height:1.6;margin:0;text-align:center">
          Se já efetuou o pagamento, por favor ignore este email.
        </p>
      `;
    case 'welcome-member':
      return `
        <div style="text-align:center;margin:20px 0">
          <a href="#" style="${btnStyle}">Aceder à Plataforma</a>
        </div>
        <p style="font-size:13px;color:${style.brandMuted};line-height:1.6;margin:0;text-align:center">
          Se tiveres dúvidas, não hesites em contactar a equipa.
        </p>
      `;
    case 'client-offboarding':
      return `
        <div style="${cardStyle}">
          <p style="${rowStyle}"><span style="${labelStyle}">Acesso ao portal: </span>${data.portalDays || 30} dias restantes</p>
        </div>
        <div style="text-align:center;margin:20px 0">
          <a href="#" style="${btnStyle}">Aceder ao Portal</a>
        </div>
        <p style="font-size:13px;color:${style.brandMuted};line-height:1.6;margin:0;text-align:center">
          Obrigado pela confiança durante o período que trabalhámos juntos.
        </p>
      `;
    default:
      return '';
  }
}

export function SettingsEmails() {
  const { settings } = useBusinessSettings();
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].key);

  const template = TEMPLATES.find(t => t.key === selectedTemplate) || TEMPLATES[0];
  const previewHtml = renderEmailPreview(selectedTemplate, template.previewData as Record<string, any>, {
    business_name: settings?.business_name,
    primary_color: settings?.primary_color,
    text_color: settings?.text_color,
    accent_color: settings?.accent_color,
    font_display: settings?.font_display,
    font_body: settings?.font_body,
    logo_url: settings?.logo_url,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            Templates de Email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Os emails utilizam automaticamente a identidade visual configurada em <strong>Identidade</strong> (logo, cores e fontes).
            Para alterar o design, ajusta as definições na tab Identidade.
          </p>

          <div className="space-y-2">
            <Label>Selecionar template</Label>
            <Select value={selectedTemplate} onValueChange={(v) => setSelectedTemplate(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATES.map(t => (
                  <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{template.label}</Badge>
            <span className="text-xs text-muted-foreground">{template.description}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-4 w-4" />
            Pré-visualização
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-white overflow-hidden">
            <div
              className="mx-auto"
              style={{ maxWidth: 600 }}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
