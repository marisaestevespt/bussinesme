/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = '{{.SiteName}}'

interface WelcomeMemberProps {
  memberName?: string
  inviteUrl?: string
  ownerName?: string
  supportEmail?: string
  businessName?: string
  // WhatsApp group links
  whatsappTeamUrl?: string
  whatsappDeptUrl?: string
  departmentName?: string
  // Brand settings (fetched from business_settings at send time)
  primaryColor?: string
  primaryForeground?: string
  textColor?: string
  accentColor?: string
  fontDisplay?: string
  fontBody?: string
  logoUrl?: string
}

function hslToCss(hsl: string | undefined, fallback: string): string {
  if (!hsl) return fallback
  return `hsl(${hsl.replace(/ /g, ', ')})`
}

const WelcomeMemberEmail = ({
  memberName,
  inviteUrl,
  ownerName,
  supportEmail,
  businessName,
  whatsappTeamUrl,
  whatsappDeptUrl,
  departmentName,
  primaryColor,
  primaryForeground,
  textColor,
  accentColor,
  fontDisplay,
  fontBody,
  logoUrl,
}: WelcomeMemberProps) => {
  const name = memberName || 'colega'
  const biz = businessName || SITE_NAME
  const owner = ownerName || 'a equipa'
  const support = supportEmail || ''

  // Resolve brand colors
  const brandPrimary = hslToCss(primaryColor, '#1a1f36')
  const brandPrimaryFg = hslToCss(primaryForeground, '#f0f4ff')
  const brandText = '#1a1f36' // neutral dark, ignores textColor to avoid washed-out text
  const brandMuted = '#555770' // neutral muted gray, ignores accentColor to avoid pink/light text
  const bodyFont = fontBody ? `'${fontBody}', Arial, sans-serif` : "'DM Sans', Arial, sans-serif"
  const displayFont = fontDisplay ? `'${fontDisplay}', Georgia, serif` : bodyFont

  const main = { backgroundColor: '#ffffff', fontFamily: bodyFont }
  const container = { maxWidth: '540px', margin: '0 auto', padding: '40px 24px' }
  const headerSection = { textAlign: 'center' as const, padding: '0 0 8px' }
  const headerEmoji = { fontSize: '48px', margin: '0 0 8px', lineHeight: '1' }
  const h1 = { fontSize: '24px', fontWeight: '700' as const, color: brandText, margin: '0 0 12px', lineHeight: '1.3', fontFamily: displayFont }
  const subtitle = { fontSize: '15px', color: brandMuted, lineHeight: '1.6', margin: '0' }
  const divider = { borderColor: '#e5e5e5', margin: '28px 0' }
  const h2 = { fontSize: '17px', fontWeight: '600' as const, color: brandText, margin: '0 0 20px', fontFamily: displayFont }
  const stepCard = { backgroundColor: '#f5f5f5', borderRadius: '10px', padding: '18px 20px', marginBottom: '12px' }
  const stepNumber = { display: 'inline-block' as const, backgroundColor: brandPrimary, color: brandPrimaryFg, width: '26px', height: '26px', borderRadius: '50%', textAlign: 'center' as const, lineHeight: '26px', fontSize: '13px', fontWeight: '700' as const, margin: '0 0 8px' }
  const stepTitle = { fontSize: '15px', fontWeight: '600' as const, color: brandText, margin: '0 0 6px' }
  const stepDesc = { fontSize: '14px', color: brandMuted, lineHeight: '1.6', margin: '0' }
  const ctaSection = { textAlign: 'center' as const, padding: '24px 0 4px' }
  const ctaButton = { backgroundColor: brandPrimary, color: brandPrimaryFg, fontSize: '15px', fontWeight: '600' as const, padding: '14px 36px', borderRadius: '8px', textDecoration: 'none', display: 'inline-block' as const }
  const supportSection = { backgroundColor: '#fefcf3', borderRadius: '10px', padding: '18px 20px', border: '1px solid #f5ecd5' }
  const supportText = { fontSize: '14px', color: brandMuted, lineHeight: '1.6', margin: '0' }
  const linkStyle = { color: brandPrimary, textDecoration: 'underline' as const }
  const footer = { fontSize: '13px', color: '#999', textAlign: 'center' as const, margin: '28px 0 0', lineHeight: '1.6' }
  const whatsappButton = { backgroundColor: '#25D366', color: '#ffffff', fontSize: '13px', fontWeight: '600' as const, padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', display: 'inline-block' as const }
  const logoStyle = { width: '48px', height: '48px', borderRadius: '10px', margin: '0 auto 16px' }

  return (
    <Html lang="pt" dir="ltr">
      <Head />
      <Preview>🎉 Bem-vindo(a) à equipa — o teu acesso está pronto!</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={headerSection}>
            {logoUrl ? (
              <Img src={logoUrl} alt={biz} style={logoStyle} />
            ) : (
              <Text style={headerEmoji}>🚀</Text>
            )}
            <Heading style={h1}>
              Olá {name}, bem-vindo(a) à equipa!
            </Heading>
            <Text style={subtitle}>
              Estamos muito contentes por te ter connosco. 💛
              <br />
              O teu acesso ao {biz} está pronto — vamos pôr-te a andar!
            </Text>
          </Section>

          <Hr style={divider} />

          {/* Steps */}
          <Section>
            <Heading as="h2" style={h2}>
              O teu passo-a-passo de primeiro acesso:
            </Heading>

            <Section style={stepCard}>
              <Text style={stepNumber}>1</Text>
              <Text style={stepTitle}>Define a tua password</Text>
              <Text style={stepDesc}>
                Clica no botão abaixo para acederes pela primeira vez.
                Vai ser-te pedido para criares a tua password pessoal — escolhe algo seguro que consigas lembrar! 🔐
              </Text>
            </Section>

            <Section style={stepCard}>
              <Text style={stepNumber}>2</Text>
              <Text style={stepTitle}>Acede à Secretária</Text>
              <Text style={stepDesc}>
                Vai à <strong>"Secretária"</strong> — já tens tarefas preparadas para os teus primeiros dias, incluindo o teu onboarding. Passo a passo, sem stress! 📋
              </Text>
            </Section>

            <Section style={stepCard}>
              <Text style={stepNumber}>3</Text>
              <Text style={stepTitle}>Entra nos grupos de WhatsApp</Text>
              <Text style={stepDesc}>
                Junta-te aos grupos de WhatsApp da equipa para ficares ligado(a) desde o primeiro dia! 💬
              </Text>
              {whatsappTeamUrl && (
                <Button style={{ ...whatsappButton, marginTop: '10px' }} href={whatsappTeamUrl}>
                  👥 Grupo Geral da Equipa
                </Button>
              )}
              {whatsappDeptUrl && departmentName && (
                <Button style={{ ...whatsappButton, marginTop: '8px' }} href={whatsappDeptUrl}>
                  📂 Grupo {departmentName}
                </Button>
              )}
              {!whatsappTeamUrl && !whatsappDeptUrl && (
                <Text style={stepDesc}>Os links foram-te enviados separadamente.</Text>
              )}
            </Section>
          </Section>

          {/* CTA */}
          {inviteUrl && (
            <Section style={ctaSection}>
              <Button style={ctaButton} href={inviteUrl}>
                Aceder à plataforma →
              </Button>
            </Section>
          )}

          <Hr style={divider} />

          {/* Support */}
          <Section style={supportSection}>
            <Text style={supportText}>
              💬 <strong>Tens dúvidas?</strong> É completamente normal nos primeiros dias!
              {support ? (
                <>
                  <br />
                  Envia um email para <a href={`mailto:${support}`} style={linkStyle}>{support}</a> ou
                  fala diretamente com {owner} — estamos aqui para te ajudar.
                </>
              ) : (
                <>
                  <br />
                  Fala diretamente com {owner} — estamos aqui para te ajudar.
                </>
              )}
            </Text>
          </Section>

          <Text style={footer}>
            Com entusiasmo,
            <br />
            A equipa {biz} 🤍
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: WelcomeMemberEmail,
  subject: '🎉 Bem-vindo(a) à equipa — o teu acesso está pronto!',
  displayName: 'Boas-vindas a novo membro',
  previewData: {
    memberName: 'Ana',
    inviteUrl: 'https://app.exemplo.com/invite',
    ownerName: 'Mariana',
    supportEmail: 'suporte@exemplo.com',
    businessName: 'O Teu Negócio',
    whatsappTeamUrl: 'https://chat.whatsapp.com/example-team',
    whatsappDeptUrl: 'https://chat.whatsapp.com/example-dept',
    departmentName: 'Marketing',
    primaryColor: '351 56% 28%',
    primaryForeground: '0 0% 100%',
    textColor: '222 84% 5%',
    accentColor: '3 42% 74%',
    fontDisplay: 'DM Serif Display',
    fontBody: 'DM Sans',
  },
} satisfies TemplateEntry
