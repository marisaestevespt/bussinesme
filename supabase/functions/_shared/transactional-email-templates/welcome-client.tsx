/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = '{{.SiteName}}'

interface WelcomeClientProps {
  clientName?: string
  productName?: string
  projectName?: string
  startDate?: string
  endDate?: string
  portalUrl?: string
  introText?: string
  nextSteps?: string[]
  supportHours?: string
  whatsappNumber?: string
  whatsappMessage?: string
  businessName?: string
  primaryColor?: string
  primaryForeground?: string
  fontDisplay?: string
  fontBody?: string
  logoUrl?: string
  bannerUrl?: string
}

function hslToCss(hsl: string | undefined, fallback: string): string {
  if (!hsl) return fallback
  return `hsl(${hsl.replace(/ /g, ', ')})`
}

function formatPtDate(iso?: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch {
    return iso
  }
}

function whatsappLink(num?: string, msg?: string): string {
  if (!num) return ''
  const clean = num.replace(/[^\d]/g, '')
  const text = msg ? `?text=${encodeURIComponent(msg)}` : ''
  return `https://wa.me/${clean}${text}`
}

const WelcomeClientEmail = ({
  clientName,
  productName,
  projectName,
  startDate,
  endDate,
  portalUrl,
  introText,
  nextSteps,
  supportHours,
  whatsappNumber,
  whatsappMessage,
  businessName,
  primaryColor,
  primaryForeground,
  fontDisplay,
  fontBody,
  logoUrl,
  bannerUrl,
}: WelcomeClientProps) => {
  const name = clientName || 'cliente'
  const biz = businessName || SITE_NAME
  const intro = introText || 'Estamos muito felizes por te ter connosco!'
  const steps = nextSteps && nextSteps.length > 0 ? nextSteps : []
  const wa = whatsappLink(whatsappNumber, whatsappMessage)

  const brandPrimary = hslToCss(primaryColor, '#1a1f36')
  const brandPrimaryFg = hslToCss(primaryForeground, '#ffffff')
  const brandText = '#1a1f36'
  const brandMuted = '#555770'
  const bodyFont = fontBody ? `'${fontBody}', Arial, sans-serif` : "'DM Sans', Arial, sans-serif"
  const displayFont = fontDisplay ? `'${fontDisplay}', Georgia, serif` : bodyFont

  const main = { backgroundColor: '#ffffff', fontFamily: bodyFont }
  const container = { maxWidth: '640px', margin: '0 auto', padding: '40px 24px' }
  const headerSection = { textAlign: 'center' as const, padding: '0 0 8px' }
  const headerEmoji = { fontSize: '48px', margin: '0 0 8px', lineHeight: '1' }
  const h1 = { fontSize: '24px', fontWeight: '700' as const, color: brandText, margin: '0 0 12px', lineHeight: '1.3', fontFamily: displayFont }
  const subtitle = { fontSize: '15px', color: brandMuted, lineHeight: '1.6', margin: '0' }
  const divider = { borderColor: '#e5e5e5', margin: '28px 0' }
  const h2 = { fontSize: '17px', fontWeight: '600' as const, color: brandText, margin: '0 0 16px', fontFamily: displayFont }
  const infoCard = { backgroundColor: '#f7f7f9', borderRadius: '10px', padding: '20px', marginBottom: '8px' }
  const infoRow = { fontSize: '14px', color: brandText, margin: '0 0 8px', lineHeight: '1.5' }
  const infoLabel = { color: brandMuted, fontWeight: '600' as const }
  const stepCard = { backgroundColor: '#f5f5f5', borderRadius: '10px', padding: '16px 20px', marginBottom: '10px' }
  const stepNumber = { display: 'inline-block' as const, backgroundColor: brandPrimary, color: brandPrimaryFg, width: '24px', height: '24px', borderRadius: '50%', textAlign: 'center' as const, lineHeight: '24px', fontSize: '12px', fontWeight: '700' as const, marginRight: '10px' }
  const stepText = { fontSize: '14px', color: brandText, lineHeight: '1.6', margin: '0', display: 'inline' as const }
  const ctaSection = { textAlign: 'center' as const, padding: '24px 0 4px' }
  const ctaButton = { backgroundColor: brandPrimary, color: brandPrimaryFg, fontSize: '15px', fontWeight: '600' as const, padding: '14px 36px', borderRadius: '8px', textDecoration: 'none', display: 'inline-block' as const }
  const supportSection = { backgroundColor: '#fefcf3', borderRadius: '10px', padding: '18px 20px', border: '1px solid #f5ecd5', textAlign: 'center' as const }
  const supportText = { fontSize: '14px', color: brandMuted, lineHeight: '1.6', margin: '0 0 12px' }
  const whatsappButton = { backgroundColor: '#25D366', color: '#ffffff', fontSize: '14px', fontWeight: '600' as const, padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', display: 'inline-block' as const }
  const footer = { fontSize: '13px', color: '#999', textAlign: 'center' as const, margin: '28px 0 0', lineHeight: '1.6' }
  const logoStyle = { width: '48px', height: '48px', borderRadius: '10px', margin: '0 auto 16px' }
  const bannerStyle = { width: '100%', height: 'auto', borderRadius: '12px', margin: '0 0 24px', display: 'block' as const }
  const introStyle = { fontSize: '15px', color: brandText, lineHeight: '1.7', margin: '0' }

  return (
    <Html lang="pt" dir="ltr">
      <Head />
      <Preview>Bem-vindo(a) — o teu acesso ao Portal está pronto</Preview>
      <Body style={main}>
        <Container style={container}>
          {bannerUrl && (
            <Img src={bannerUrl} alt={productName || biz} style={bannerStyle} />
          )}
          <Section style={headerSection}>
            {logoUrl ? (
              <Img src={logoUrl} alt={biz} style={logoStyle} />
            ) : (
              <Text style={headerEmoji}>🎉</Text>
            )}
            <Heading style={h1}>
              Bem-vindo(a), {name}!
            </Heading>
            <Text style={subtitle}>
              O teu projeto na {biz} arrancou — aqui ficam todas as informações para começares.
            </Text>
          </Section>

          <Hr style={divider} />

          <Section>
            <Text style={introStyle}>{intro}</Text>
          </Section>

          <Hr style={divider} />

          {(productName || projectName || startDate) && (
            <Section>
              <Heading as="h2" style={h2}>📋 O teu projeto</Heading>
              <Section style={infoCard}>
                {productName && (
                  <Text style={infoRow}>
                    <span style={infoLabel}>Produto:</span> {productName}
                  </Text>
                )}
                {projectName && (
                  <Text style={infoRow}>
                    <span style={infoLabel}>Projeto:</span> {projectName}
                  </Text>
                )}
                {startDate && (
                  <Text style={infoRow}>
                    <span style={infoLabel}>Início:</span> {formatPtDate(startDate)}
                  </Text>
                )}
                {endDate && (
                  <Text style={{ ...infoRow, margin: 0 }}>
                    <span style={infoLabel}>Fim previsto:</span> {formatPtDate(endDate)}
                  </Text>
                )}
              </Section>
            </Section>
          )}

          {portalUrl && (
            <Section style={ctaSection}>
              <Button style={ctaButton} href={portalUrl}>
                Aceder ao Portal →
              </Button>
              <Text style={{ ...subtitle, marginTop: '12px', fontSize: '13px' }}>
                Acede com o teu email — sem palavras-passe nem códigos.
              </Text>
            </Section>
          )}

          {steps.length > 0 && (
            <>
              <Hr style={divider} />
              <Section>
                <Heading as="h2" style={h2}>🚀 Próximos passos</Heading>
                {steps.map((step, i) => (
                  <Section key={i} style={stepCard}>
                    <Text style={stepNumber}>{i + 1}</Text>
                    <Text style={stepText}>{step}</Text>
                  </Section>
                ))}
              </Section>
            </>
          )}

          <Hr style={divider} />

          <Section style={supportSection}>
            <Text style={supportText}>
              💬 <strong>Precisas de falar connosco?</strong>
              {supportHours && (
                <>
                  <br />
                  Horário de atendimento: {supportHours}
                </>
              )}
            </Text>
            {wa && (
              <Button style={whatsappButton} href={wa}>
                💚 Falar no WhatsApp
              </Button>
            )}
          </Section>

          <Text style={footer}>
            Com entusiasmo,
            <br />
            A equipa {biz}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: WelcomeClientEmail,
  subject: '🎉 Bem-vindo(a) — o teu acesso ao Portal está pronto',
  displayName: 'Boas-vindas a novo cliente',
  previewData: {
    clientName: 'Joana',
    productName: 'Mentoria 1:1',
    projectName: 'Mentoria — Joana Silva',
    startDate: '2026-05-05',
    endDate: '2026-08-05',
    portalUrl: 'https://businessme.lyrata.pt/portal/dianabraga',
    introText: 'Estamos muito felizes por te ter connosco! Vamos trabalhar juntos para alcançar os teus objetivos.',
    nextSteps: [
      'Aceder ao Portal do Cliente e explorar o teu espaço',
      'Responder ao briefing inicial',
      'Confirmar a data da reunião de kickoff',
    ],
    supportHours: 'Segunda a Sexta, 9h-18h',
    whatsappNumber: '+351913544824',
    whatsappMessage: 'Olá! Sou cliente e gostaria de tirar uma dúvida.',
    businessName: 'O Teu Negócio',
    primaryColor: '351 56% 28%',
    primaryForeground: '0 0% 100%',
    fontDisplay: 'DM Serif Display',
    fontBody: 'DM Sans',
    bannerUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&h=400&fit=crop',
  },
} satisfies TemplateEntry
