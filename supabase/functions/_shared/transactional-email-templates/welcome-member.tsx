/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = '{{.SiteName}}'

interface WelcomeMemberProps {
  memberName?: string
  fullName?: string
  roleTitle?: string
  inviteUrl?: string
  businessName?: string
  whatsappTeamUrl?: string
  whatsappDeptUrl?: string
  departmentName?: string
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
  fullName,
  roleTitle,
  inviteUrl,
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
  const name = memberName || fullName || 'bem-vindo/a'
  const biz = businessName || SITE_NAME
  const brandPrimary = hslToCss(primaryColor, '#6b1f2b')
  const brandPrimaryFg = hslToCss(primaryForeground, '#ffffff')
  const brandText = hslToCss(textColor, '#1f1a17')
  const brandAccent = hslToCss(accentColor, '#eee5d8')
  const bodyFont = fontBody ? `'${fontBody}', Arial, sans-serif` : 'Arial, sans-serif'
  const displayFont = fontDisplay ? `'${fontDisplay}', Georgia, serif` : bodyFont

  const main = { backgroundColor: '#ffffff', fontFamily: bodyFont }
  const container = { maxWidth: '620px', margin: '0 auto', padding: '40px 24px' }
  const logo = { width: '52px', height: '52px', borderRadius: '10px', objectFit: 'contain' as const, margin: '0 0 20px' }
  const eyebrow = { color: brandPrimary, fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontWeight: 700, margin: '0 0 10px' }
  const h1 = { color: brandText, fontFamily: displayFont, fontSize: '28px', lineHeight: '1.2', margin: '0 0 14px', fontWeight: 700 }
  const text = { color: '#4f4a45', fontSize: '15px', lineHeight: '1.65', margin: '0 0 16px' }
  const card = { backgroundColor: '#faf8f5', border: '1px solid #eee5d8', borderRadius: '8px', padding: '18px 20px', margin: '22px 0' }
  const label = { color: '#7b6f65', fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' as const, margin: '0 0 4px' }
  const value = { color: brandText, fontSize: '15px', fontWeight: 600, margin: '0 0 12px' }
  const buttonWrap = { textAlign: 'center' as const, margin: '28px 0 10px' }
  const button = { backgroundColor: brandPrimary, color: brandPrimaryFg, borderRadius: '8px', padding: '14px 28px', textDecoration: 'none', fontSize: '15px', fontWeight: 700, display: 'inline-block' as const }
  const note = { color: '#7b6f65', fontSize: '13px', lineHeight: '1.55', margin: '14px 0 0', textAlign: 'center' as const }
  const support = { backgroundColor: brandAccent, borderRadius: '8px', padding: '16px 18px', margin: '24px 0 0' }
  const supportLink = { color: brandPrimary, fontWeight: 700, textDecoration: 'none' }
  const hr = { borderColor: '#eee5d8', margin: '30px 0 18px' }
  const footer = { color: '#8c8278', fontSize: '13px', lineHeight: '1.55', margin: 0 }

  return (
    <Html lang="pt" dir="ltr">
      <Head />
      <Preview>O teu acesso à equipa {biz} está pronto</Preview>
      <Body style={main}>
        <Container style={container}>
          {logoUrl ? <Img src={logoUrl} alt={biz} style={logo} /> : null}
          <Text style={eyebrow}>Acesso à plataforma</Text>
          <Heading style={h1}>Bem-vindo/a, {name}.</Heading>
          <Text style={text}>
            A tua conta de equipa na {biz} foi criada. Usa o botão abaixo para definir a tua palavra-passe e entrar na plataforma.
          </Text>

          <Section style={card}>
            <Text style={label}>Nome</Text>
            <Text style={value}>{fullName || name}</Text>
            {roleTitle ? (
              <>
                <Text style={label}>Função</Text>
                <Text style={{ ...value, marginBottom: 0 }}>{roleTitle}</Text>
              </>
            ) : null}
          </Section>

          {inviteUrl ? (
            <Section style={buttonWrap}>
              <Button href={inviteUrl} style={button}>Definir palavra-passe</Button>
              <Text style={note}>Este link é pessoal e só deve ser usado por ti. Se expirar, pede um novo convite à equipa.</Text>
            </Section>
          ) : null}

          {(whatsappTeamUrl || whatsappDeptUrl) ? (
            <Section style={support}>
              <Text style={{ ...text, margin: 0 }}>
                Também podes entrar no WhatsApp da equipa{departmentName ? ` de ${departmentName}` : ''}: {' '}
                {whatsappDeptUrl ? <a href={whatsappDeptUrl} style={supportLink}>grupo do departamento</a> : null}
                {whatsappDeptUrl && whatsappTeamUrl ? ' · ' : null}
                {whatsappTeamUrl ? <a href={whatsappTeamUrl} style={supportLink}>grupo geral</a> : null}
              </Text>
            </Section>
          ) : null}

          <Hr style={hr} />
          <Text style={footer}>Até já,<br />Equipa {biz}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: WelcomeMemberEmail,
  subject: (data: Record<string, any>) => `Bem-vindo/a à ${data.businessName || SITE_NAME}`,
  displayName: 'Boas-vindas membro',
  previewData: {
    memberName: 'Jéssica',
    fullName: 'Jéssica Silva',
    roleTitle: 'Contabilista',
    inviteUrl: 'https://businessme.lyrata.pt/reset-password',
    businessName: 'BusinessMe',
    whatsappTeamUrl: 'https://chat.whatsapp.com/example',
    primaryColor: '351 60% 26%',
    primaryForeground: '0 0% 100%',
    textColor: '25 18% 14%',
    accentColor: '38 45% 78%',
    fontDisplay: 'Cormorant Garamond',
    fontBody: 'Inter',
  },
} satisfies TemplateEntry