import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Mail, Eye, Save, RotateCcw, Braces, Info } from 'lucide-react';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EmailSafetyPanel } from './EmailSafetyPanel';
import { DEFAULT_WELCOME_CLIENT_EMAIL_SETTINGS, WelcomeClientEmailSettings, type WelcomeClientEmailSettingsData } from './WelcomeClientEmailSettings';

interface TemplateVariable {
  token: string;
  label: string;
  example: string;
}

interface TemplateDefaults {
  key: string;
  label: string;
  description: string;
  emoji: string;
  title: string;
  subtitle: string;
  ctaText: string;
  footer: string;
  variables: TemplateVariable[];
  paymentMethodNote?: string;
  bodyBuilder: (data: TemplateCustom, style: StyleCtx) => string;
}

interface TemplateCustom {
  emoji: string;
  title_text: string;
  subtitle_text: string;
  cta_text: string;
  footer_text: string;
  primary_color: string;
  primary_foreground: string;
  text_color: string;
  muted_color: string;
  font_display: string;
  font_body: string;
}

interface StyleCtx {
  brandPrimary: string;
  brandPrimaryFg: string;
  brandText: string;
  brandMuted: string;
  bodyFont: string;
  displayFont: string;
}

function hslToCss(hsl: string | undefined, fallback: string): string {
  if (!hsl) return fallback;
  return `hsl(${hsl.replace(/ /g, ', ')})`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const FONT_OPTIONS = [
  'Plus Jakarta Sans', 'Inter', 'DM Sans', 'Nunito', 'Raleway',
  'Cormorant Garamond', 'Playfair Display', 'Merriweather', 'Lora', 'DM Serif Display',
];

const COMMON_VARS: TemplateVariable[] = [
  { token: '{name}', label: 'Nome do destinatário', example: 'Ana Silva' },
];
const PAYMENT_VARS: TemplateVariable[] = [
  ...COMMON_VARS,
  { token: '{amount}', label: 'Valor do pagamento', example: '350.00' },
  { token: '{product}', label: 'Nome do produto', example: 'Consultoria Digital' },
];

const TEMPLATES: TemplateDefaults[] = [
  {
    key: 'welcome-client',
    label: 'Boas-vindas ao cliente',
    description: 'Enviado manualmente quando o projeto está pronto para o cliente entrar',
    emoji: '🎉',
    title: 'Bem-vindo(a), {name}!',
    subtitle: 'O teu projeto arrancou — aqui ficam todas as informações para começares.',
    ctaText: 'Aceder ao Portal',
    footer: 'Com entusiasmo, a equipa',
    variables: [
      ...COMMON_VARS,
      { token: '{product}', label: 'Produto comprado', example: 'Mentoria 1:1' },
      { token: '{project}', label: 'Nome do projeto', example: 'Mentoria — Ana Silva' },
      { token: '{start_date}', label: 'Data de início', example: '05 de maio de 2026' },
      { token: '{end_date}', label: 'Data prevista de fim', example: '05 de agosto de 2026' },
    ],
    bodyBuilder: () => '',
  },
  {
    key: 'invoice-available',
    label: 'Fatura disponível',
    description: 'Enviado quando uma fatura é adicionada a uma venda',
    emoji: '📄',
    title: '{name}, a sua fatura já está disponível',
    subtitle: 'A fatura no valor de {amount}€ referente a {product} já se encontra disponível para consulta no seu portal de cliente.',
    ctaText: 'Consultar no Portal',
    footer: 'Pode aceder ao seu portal de cliente a qualquer momento para consultar as suas faturas e documentos.',
    variables: PAYMENT_VARS,
    bodyBuilder: (data, style) => {
      const cardStyle = `background-color:#f7f7fa;border-radius:10px;padding:16px 20px;margin-bottom:12px`;
      const rowStyle = `font-size:13px;color:${style.brandMuted};line-height:2;margin:0`;
      const labelStyle = `font-weight:600;color:${style.brandText}`;
      return `
        <div style="${cardStyle}">
          <p style="${rowStyle}"><span style="${labelStyle}">Serviço: </span>Consultoria Digital</p>
          <p style="${rowStyle}"><span style="${labelStyle}">Valor: </span>350.00€</p>
        </div>
      `;
    },
  },
  {
    key: 'payment-reminder',
    label: 'Lembrete de pagamento (3 dias antes)',
    description: 'Enviado 3 dias antes do vencimento para o cliente se organizar',
    emoji: '🔔',
    title: '{name}, lembrete de pagamento',
    subtitle: 'Enviamos este lembrete para que possa organizar o pagamento referente a {product}, que vence em breve.',
    ctaText: '',
    footer: 'Se já efetuou o pagamento, por favor ignore este email.',
    variables: PAYMENT_VARS,
    bodyBuilder: (data, style) => {
      const cardStyle = `background-color:#f7f7fa;border-radius:10px;padding:16px 20px;margin-bottom:12px`;
      const rowStyle = `font-size:13px;color:${style.brandMuted};line-height:2;margin:0`;
      const labelStyle = `font-weight:600;color:${style.brandText}`;
      return `
        <div style="${cardStyle}">
          <p style="font-size:24px;font-weight:700;color:${style.brandPrimary};text-align:center;margin:12px 0 4px;font-family:${style.displayFont}">350€</p>
          <p style="font-size:11px;color:${style.brandMuted};text-align:center;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.5px">Valor a pagar</p>
          <p style="${rowStyle}"><span style="${labelStyle}">Serviço: </span>Consultoria Digital</p>
          <p style="${rowStyle}"><span style="${labelStyle}">Data de vencimento: </span>15/04/2026</p>
        </div>
      `;
    },
  },
  {
    key: 'payment-due-today',
    label: 'Pagamento no dia do vencimento',
    description: 'Enviado no dia do vencimento com método de pagamento e IBAN/MBWay conforme o cliente',
    emoji: '📩',
    title: '{name}, o pagamento vence hoje',
    subtitle: 'Passa por aqui um lembrete gentil — o pagamento referente a {product} vence hoje.',
    ctaText: '',
    footer: 'Se já efetuou o pagamento, por favor ignore este email.',
    variables: PAYMENT_VARS,
    paymentMethodNote: 'O bloco de pagamento adapta-se automaticamente ao método de pagamento do cliente (transferência → IBAN, MB WAY → nº telefone, cartão/débito direto → cobrança automática). Os dados são lidos do Setup do Negócio → Métodos de Pagamento.',
    bodyBuilder: (data, style) => {
      const cardStyle = `background-color:#f7f7fa;border-radius:10px;padding:16px 20px;margin-bottom:12px`;
      const rowStyle = `font-size:13px;color:${style.brandMuted};line-height:2;margin:0`;
      const labelStyle = `font-weight:600;color:${style.brandText}`;
      const paymentCardStyle = `background-color:#f0f4ff;border-radius:10px;padding:16px 20px;margin-top:12px;border:1px solid ${style.brandPrimary}22`;
      const ibanStyle = `font-size:18px;font-weight:700;color:${style.brandPrimary};margin:8px 0 4px;letter-spacing:1px;font-family:'Courier New',monospace`;
      return `
        <div style="${cardStyle}">
          <p style="font-size:24px;font-weight:700;color:${style.brandPrimary};text-align:center;margin:12px 0 4px;font-family:${style.displayFont}">350€</p>
          <p style="font-size:11px;color:${style.brandMuted};text-align:center;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.5px">Valor a pagar</p>
          <p style="${rowStyle}"><span style="${labelStyle}">Serviço: </span>Consultoria Digital</p>
          <p style="${rowStyle}"><span style="${labelStyle}">Data de vencimento: </span>15/04/2026</p>
          <p style="${rowStyle}"><span style="${labelStyle}">Método de pagamento: </span>Transferência bancária</p>
        </div>
        <div style="${paymentCardStyle}">
          <p style="font-size:13px;font-weight:700;color:${style.brandText};margin:0 0 8px;text-transform:uppercase;letter-spacing:0.5px">🏦 Dados para transferência</p>
          <p style="font-size:13px;color:${style.brandMuted};line-height:1.6;margin:0 0 8px">Para efetuar o pagamento, transfira o valor para o IBAN abaixo:</p>
          <p style="${ibanStyle}">PT50 0000 0000 0000 0000 0001 2</p>
          <p style="font-size:12px;color:${style.brandMuted};margin:4px 0 0">Valor: 350€</p>
        </div>
      `;
    },
  },
  {
    key: 'welcome-member',
    label: 'Boas-vindas membro',
    description: 'Enviado quando um novo membro é adicionado à equipa',
    emoji: '👋',
    title: 'Bem-vindo/a, {name}!',
    subtitle: 'Foste adicionado/a à equipa. Clica no botão abaixo para aceder à plataforma.',
    ctaText: 'Aceder à Plataforma',
    footer: 'Se tiveres dúvidas, não hesites em contactar a equipa.',
    variables: COMMON_VARS,
    bodyBuilder: () => '',
  },
  {
    key: 'client-offboarding',
    label: 'Offboarding cliente',
    description: 'Enviado ao cliente quando inicia o processo de saída',
    emoji: '📋',
    title: '{name}, informações sobre a sua transição',
    subtitle: 'Estamos a preparar a sua transição. O acesso ao portal permanecerá ativo durante 30 dias.',
    ctaText: 'Aceder ao Portal',
    footer: 'Obrigado pela confiança durante o período que trabalhámos juntos.',
    variables: COMMON_VARS,
    bodyBuilder: (data, style) => {
      const cardStyle = `background-color:#f7f7fa;border-radius:10px;padding:16px 20px;margin-bottom:12px`;
      const rowStyle = `font-size:13px;color:${style.brandMuted};line-height:2;margin:0`;
      const labelStyle = `font-weight:600;color:${style.brandText}`;
      return `
        <div style="${cardStyle}">
          <p style="${rowStyle}"><span style="${labelStyle}">Acesso ao portal: </span>30 dias restantes</p>
        </div>
      `;
    },
  },
];

function buildWelcomeClientPreview(custom: TemplateCustom, biz: string, welcome: WelcomeClientEmailSettingsData): string {
  const brandPrimary = hslToCss(custom.primary_color || undefined, '#1a1f36');
  const brandPrimaryFg = hslToCss(custom.primary_foreground || undefined, '#ffffff');
  const brandText = hslToCss(custom.text_color || undefined, '#1a1f36');
  const brandMuted = hslToCss(custom.muted_color || undefined, '#555770');
  const bodyFont = custom.font_body ? `'${custom.font_body}', Arial, sans-serif` : "'DM Sans', Arial, sans-serif";
  const displayFont = custom.font_display ? `'${custom.font_display}', Georgia, serif` : bodyFont;
  const intro = escapeHtml(welcome.intro_text).replace(/\n/g, '<br>');
  const steps = welcome.next_steps.map((step) => step.trim()).filter(Boolean);
  const waNumber = welcome.whatsapp_number.replace(/[^\d]/g, '');
  const waMessage = welcome.whatsapp_message ? `?text=${encodeURIComponent(welcome.whatsapp_message)}` : '';
  const btnStyle = `background-color:${brandPrimary};color:${brandPrimaryFg};padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;display:inline-block`;

  return `
    <div style="background:#ffffff;font-family:${bodyFont};max-width:640px;margin:0 auto;padding:40px 24px;color:${brandText}">
      <div style="text-align:center;padding:0 0 8px">
        <p style="font-size:48px;margin:0 0 8px;line-height:1">🎉</p>
        <h1 style="font-size:24px;font-weight:700;color:${brandText};margin:0 0 12px;line-height:1.3;font-family:${displayFont}">Bem-vindo(a), Ana!</h1>
        <p style="font-size:15px;color:${brandMuted};line-height:1.6;margin:0">O teu projeto na ${escapeHtml(biz)} arrancou — aqui ficam todas as informações para começares.</p>
      </div>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:28px 0">
      <p style="font-size:15px;color:${brandText};line-height:1.7;margin:0">${intro}</p>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:28px 0">
      <h2 style="font-size:17px;font-weight:600;color:${brandText};margin:0 0 16px;font-family:${displayFont}">📋 O teu projeto</h2>
      <div style="background-color:#f7f7f9;border-radius:10px;padding:20px;margin-bottom:8px">
        <p style="font-size:14px;color:${brandText};margin:0 0 8px;line-height:1.5"><span style="color:${brandMuted};font-weight:600">Produto:</span> Mentoria 1:1</p>
        <p style="font-size:14px;color:${brandText};margin:0 0 8px;line-height:1.5"><span style="color:${brandMuted};font-weight:600">Projeto:</span> Mentoria — Ana Silva</p>
        <p style="font-size:14px;color:${brandText};margin:0 0 8px;line-height:1.5"><span style="color:${brandMuted};font-weight:600">Início:</span> 05 de maio de 2026</p>
        <p style="font-size:14px;color:${brandText};margin:0;line-height:1.5"><span style="color:${brandMuted};font-weight:600">Fim previsto:</span> 05 de agosto de 2026</p>
      </div>
      <div style="text-align:center;padding:24px 0 4px">
        <a href="#" style="${btnStyle}">Aceder ao Portal →</a>
        <p style="font-size:13px;color:${brandMuted};line-height:1.6;margin:12px 0 0">Vais introduzir o teu email e receber um código de acesso.</p>
      </div>
      ${steps.length ? `<hr style="border:none;border-top:1px solid #e5e5e5;margin:28px 0"><h2 style="font-size:17px;font-weight:600;color:${brandText};margin:0 0 16px;font-family:${displayFont}">🚀 Próximos passos</h2>${steps.map((step, i) => `<div style="background-color:#f5f5f5;border-radius:10px;padding:16px 20px;margin-bottom:10px"><span style="display:inline-block;background-color:${brandPrimary};color:${brandPrimaryFg};width:24px;height:24px;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;margin-right:10px">${i + 1}</span><span style="font-size:14px;color:${brandText};line-height:1.6">${escapeHtml(step)}</span></div>`).join('')}` : ''}
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:28px 0">
      <div style="background-color:#fefcf3;border-radius:10px;padding:18px 20px;border:1px solid #f5ecd5;text-align:center">
        <p style="font-size:14px;color:${brandMuted};line-height:1.6;margin:0 0 12px">💬 <strong>Precisas de falar connosco?</strong><br>Horário de atendimento: ${escapeHtml(welcome.support_hours)}</p>
        ${waNumber ? `<a href="https://wa.me/${waNumber}${waMessage}" style="background-color:#25D366;color:#ffffff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">💚 Falar no WhatsApp</a>` : ''}
      </div>
      <p style="font-size:13px;color:#999;text-align:center;margin:28px 0 0;line-height:1.6">Com entusiasmo,<br>A equipa ${escapeHtml(biz)}</p>
    </div>
  `;
}

function buildPreview(tmpl: TemplateDefaults, custom: TemplateCustom, biz: string, welcomeSettings: WelcomeClientEmailSettingsData): string {
  if (tmpl.key === 'welcome-client') {
    return buildWelcomeClientPreview(custom, biz, welcomeSettings);
  }

  const brandPrimary = hslToCss(custom.primary_color || undefined, '#e04a2f');
  const brandPrimaryFg = hslToCss(custom.primary_foreground || undefined, '#ffffff');
  const brandText = hslToCss(custom.text_color || undefined, '#1a1f36');
  const brandMuted = hslToCss(custom.muted_color || undefined, '#555770');
  const bodyFont = custom.font_body ? `'${custom.font_body}', Arial, sans-serif` : "'DM Sans', Arial, sans-serif";
  const displayFont = custom.font_display ? `'${custom.font_display}', Georgia, serif` : bodyFont;

  const styleCtx: StyleCtx = { brandPrimary, brandPrimaryFg, brandText, brandMuted, bodyFont, displayFont };

  const title = (custom.title_text || tmpl.title).replace('{name}', 'Ana Silva').replace('{amount}', '350.00').replace('{product}', 'Consultoria Digital');
  const subtitle = (custom.subtitle_text || tmpl.subtitle).replace('{name}', 'Ana Silva').replace('{amount}', '350.00').replace('{product}', 'Consultoria Digital');
  const ctaText = custom.cta_text || tmpl.ctaText;
  const footerText = custom.footer_text || tmpl.footer;
  const emoji = custom.emoji || tmpl.emoji;
  const btnStyle = `background-color:${brandPrimary};color:${brandPrimaryFg};padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;display:inline-block`;

  const bodyContent = tmpl.bodyBuilder(custom, styleCtx);

  return `
    <div style="background:#ffffff;font-family:${bodyFont};max-width:540px;margin:0 auto;padding:32px 20px">
      <div style="text-align:center;padding:0 0 8px">
        <p style="font-size:48px;margin:0 0 8px;line-height:1">${emoji}</p>
        <h1 style="font-size:20px;font-weight:700;color:${brandText};margin:0 0 10px;line-height:1.3;font-family:${displayFont}">
          ${title}
        </h1>
        <p style="font-size:14px;color:${brandMuted};line-height:1.6;margin:0">
          ${subtitle}
        </p>
      </div>
      <hr style="border:none;border-top:1px solid #e8e8ed;margin:24px 0">
      ${bodyContent}
      ${ctaText ? `<div style="text-align:center;margin:20px 0"><a href="#" style="${btnStyle}">${ctaText}</a></div>` : ''}
      <hr style="border:none;border-top:1px solid #e8e8ed;margin:24px 0">
      <p style="font-size:13px;color:${brandMuted};line-height:1.6;margin:0;text-align:center">${footerText}</p>
      <p style="font-size:12px;color:#999;text-align:center;margin:20px 0 0;line-height:1.6">
        Com os melhores cumprimentos,<br>A equipa ${biz}
      </p>
    </div>
  `;
}

function VariablesPopover({ variables, onInsert }: { variables: TemplateVariable[]; onInsert: (token: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] gap-1 text-muted-foreground">
          <Braces className="h-3 w-3" />
          Variáveis
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Clica para inserir</p>
        <div className="space-y-1">
          {variables.map(v => (
            <button
              key={v.token}
              type="button"
              onClick={() => onInsert(v.token)}
              className="w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted transition-colors"
            >
              <div>
                <span className="text-xs font-mono font-medium text-foreground">{v.token}</span>
                <span className="text-[11px] text-muted-foreground ml-2">{v.label}</span>
              </div>
              <span className="text-[10px] text-muted-foreground italic">{v.example}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EmailPreviewFrame({ html }: { html: string }) {
  const srcDoc = useMemo(() => {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&family=DM+Sans:wght@400;500;600&family=Inter:wght@400;500;600;700&family=DM+Serif+Display&family=Nunito:wght@400;600;700&family=Raleway:wght@400;600;700&family=Cormorant+Garamond:wght@400;600;700&family=Playfair+Display:wght@400;600;700&family=Merriweather:wght@400;700&family=Lora:wght@400;600;700&display=swap" rel="stylesheet"></head><body style="margin:0;padding:0;background:#ffffff">${html}</body></html>`;
  }, [html]);

  return (
    <div className="rounded-lg border overflow-hidden" style={{ background: '#ffffff' }}>
      <iframe
        srcDoc={srcDoc}
        className="w-full border-0"
        style={{ minHeight: 520, background: '#ffffff' }}
        title="Email preview"
      />
    </div>
  );
}

function getDefaults(tmpl: TemplateDefaults, settings: any): TemplateCustom {
  return {
    emoji: tmpl.emoji,
    title_text: tmpl.title,
    subtitle_text: tmpl.subtitle,
    cta_text: tmpl.ctaText,
    footer_text: tmpl.footer,
    primary_color: settings?.primary_color || '12 76% 52%',
    primary_foreground: '0 0% 100%',
    text_color: settings?.text_color || '20 25% 10%',
    muted_color: settings?.accent_color || '20 10% 46%',
    font_display: settings?.font_display || 'Plus Jakarta Sans',
    font_body: settings?.font_body || 'DM Sans',
  };
}

export function SettingsEmails() {
  const { settings } = useBusinessSettings();
  const qc = useQueryClient();
  const [selectedKey, setSelectedKey] = useState<string>('welcome-client');
  const [form, setForm] = useState<TemplateCustom | null>(null);
  const [welcomePreviewSettings, setWelcomePreviewSettings] = useState<WelcomeClientEmailSettingsData>(DEFAULT_WELCOME_CLIENT_EMAIL_SETTINGS);
  const [saving, setSaving] = useState(false);

  const isWelcomeClient = selectedKey === 'welcome-client';
  const tmpl = TEMPLATES.find(t => t.key === selectedKey) || TEMPLATES[0];

  const { data: savedSettings } = useQuery({
    queryKey: ['email-template-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('email_template_settings').select('*');
      return data || [];
    },
  });

  const savedForTemplate = savedSettings?.find((s: any) => s.template_key === selectedKey);

  // Reset form when template changes
  useEffect(() => {
    const defaults = getDefaults(tmpl, settings);
    if (savedForTemplate) {
      setForm({
        emoji: savedForTemplate.emoji || defaults.emoji,
        title_text: savedForTemplate.title_text || defaults.title_text,
        subtitle_text: savedForTemplate.subtitle_text || defaults.subtitle_text,
        cta_text: savedForTemplate.cta_text || defaults.cta_text,
        footer_text: savedForTemplate.footer_text || defaults.footer_text,
        primary_color: savedForTemplate.primary_color || defaults.primary_color,
        primary_foreground: savedForTemplate.primary_foreground || defaults.primary_foreground,
        text_color: savedForTemplate.text_color || defaults.text_color,
        muted_color: savedForTemplate.muted_color || defaults.muted_color,
        font_display: savedForTemplate.font_display || defaults.font_display,
        font_body: savedForTemplate.font_body || defaults.font_body,
      });
    } else {
      setForm(defaults);
    }
  }, [selectedKey, savedForTemplate?.id, settings?.primary_color]);

  const update = useCallback((field: keyof TemplateCustom, value: string) => {
    setForm(f => f ? { ...f, [field]: value } : f);
  }, []);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const payload = { template_key: selectedKey, ...form, updated_at: new Date().toISOString() };
      if (savedForTemplate) {
        await supabase.from('email_template_settings').update(payload).eq('id', savedForTemplate.id);
      } else {
        await supabase.from('email_template_settings').insert(payload);
      }
      qc.invalidateQueries({ queryKey: ['email-template-settings'] });
      toast.success('Template guardado');
    } catch {
      toast.error('Não consegui guardar a configuração de email. Tenta novamente.');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    setForm(getDefaults(tmpl, settings));
  };

  const biz = settings?.business_name || 'O teu Negócio';
  const previewHtml = form ? buildPreview(tmpl, form, biz, welcomePreviewSettings) : '';

  if (!form) return null;

  return (
    <div className="space-y-6">
      {/* Safety controls — always render at the top */}
      <EmailSafetyPanel />

      {/* Template selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            Templates de Email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Selecionar template</Label>
            <Select value={selectedKey} onValueChange={setSelectedKey}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATES.map(t => (
                  <SelectItem key={t.key} value={t.key}>
                    <div className="flex flex-col items-start">
                      <span>{t.label}</span>
                      <span className="text-[11px] text-muted-foreground font-normal">{t.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!isWelcomeClient && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{tmpl.label}</Badge>
              <span className="text-xs text-muted-foreground">{tmpl.description}</span>
            </div>
          )}
          {isWelcomeClient && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Boas-vindas ao cliente</Badge>
              <span className="text-xs text-muted-foreground">Enviado manualmente quando o projeto está pronto</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor */}
        {isWelcomeClient ? (
          <WelcomeClientEmailSettings onPreviewChange={setWelcomePreviewSettings} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personalizar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
            {/* Emoji */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Emoji / Ícone</Label>
              <Input value={form.emoji} onChange={e => update('emoji', e.target.value)} className="w-24 text-2xl text-center" />
            </div>

            {/* Title */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Título</Label>
                <VariablesPopover variables={tmpl.variables} onInsert={(token) => update('title_text', (form.title_text || '') + token)} />
              </div>
              <Input value={form.title_text} onChange={e => update('title_text', e.target.value)} />
            </div>

            {/* Subtitle */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Subtítulo</Label>
                <VariablesPopover variables={tmpl.variables} onInsert={(token) => update('subtitle_text', (form.subtitle_text || '') + token)} />
              </div>
              <Textarea value={form.subtitle_text} onChange={e => update('subtitle_text', e.target.value)} rows={3} />
            </div>

            {/* CTA */}
            {tmpl.ctaText && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Texto do botão</Label>
                <Input value={form.cta_text} onChange={e => update('cta_text', e.target.value)} />
              </div>
            )}

            {/* Footer */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Texto de rodapé</Label>
                <VariablesPopover variables={tmpl.variables} onInsert={(token) => update('footer_text', (form.footer_text || '') + token)} />
              </div>
              <Textarea value={form.footer_text} onChange={e => update('footer_text', e.target.value)} rows={2} />
            </div>

            {/* Payment method note */}
            {tmpl.paymentMethodNote && (
              <div className="flex gap-2 p-3 rounded-lg bg-muted/50 border">
                <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">{tmpl.paymentMethodNote}</p>
              </div>
            )}

            {/* Colors */}
            <div className="border-t pt-4 mt-4">
              <Label className="eyebrowr">Cores e Fontes</Label>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Cor primária (HSL)</Label>
                  <div className="flex gap-2 items-center">
                    <Input value={form.primary_color} onChange={e => update('primary_color', e.target.value)} className="text-xs" />
                    <div className="w-6 h-6 rounded-md border flex-shrink-0" style={{ backgroundColor: hslToCss(form.primary_color, '#e04a2f') }} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Cor do texto (HSL)</Label>
                  <div className="flex gap-2 items-center">
                    <Input value={form.text_color} onChange={e => update('text_color', e.target.value)} className="text-xs" />
                    <div className="w-6 h-6 rounded-md border flex-shrink-0" style={{ backgroundColor: hslToCss(form.text_color, '#1a1f36') }} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Cor secundária (HSL)</Label>
                  <div className="flex gap-2 items-center">
                    <Input value={form.muted_color} onChange={e => update('muted_color', e.target.value)} className="text-xs" />
                    <div className="w-6 h-6 rounded-md border flex-shrink-0" style={{ backgroundColor: hslToCss(form.muted_color, '#555770') }} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Fonte títulos</Label>
                  <Select value={form.font_display} onValueChange={v => update('font_display', v)}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map(f => (
                        <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Fonte corpo</Label>
                  <Select value={form.font_body} onValueChange={v => update('font_body', v)}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map(f => (
                        <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t">
              <Button onClick={save} disabled={saving} size="sm" className="gap-2">
                <Save className="h-3.5 w-3.5" />
                {saving ? 'A guardar...' : 'Guardar'}
              </Button>
              <Button onClick={resetToDefaults} variant="outline" size="sm" className="gap-2">
                <RotateCcw className="h-3.5 w-3.5" />
                Repor original
              </Button>
            </div>
            </CardContent>
          </Card>
        )}

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4" />
              Pré-visualização
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmailPreviewFrame html={previewHtml} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
