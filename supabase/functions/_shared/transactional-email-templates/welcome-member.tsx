/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = '{{.SiteName}}'

interface WelcomeMemberProps {
  memberName?: string
  inviteUrl?: string
  ownerName?: string
  supportEmail?: string
  businessName?: string
}

const WelcomeMemberEmail = ({
  memberName,
  inviteUrl,
  ownerName,
  supportEmail,
  businessName,
}: WelcomeMemberProps) => {
  const name = memberName || 'colega'
  const biz = businessName || SITE_NAME
  const owner = ownerName || 'a equipa'
  const support = supportEmail || ''

  return (
    <Html lang="pt" dir="ltr">
      <Head />
      <Preview>🎉 Bem-vindo(a) à equipa — o teu acesso está pronto!</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={headerSection}>
            <Text style={headerEmoji}>🚀</Text>
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
          <Section style={stepsSection}>
            <Heading as="h2" style={h2}>
              O teu passo-a-passo de primeiro acesso:
            </Heading>

            {/* Step 1 */}
            <Section style={stepCard}>
              <Text style={stepNumber}>1</Text>
              <Text style={stepTitle}>Define a tua password</Text>
              <Text style={stepDescription}>
                Clica no botão abaixo para acederes pela primeira vez. 
                Vai ser-te pedido para criares a tua password pessoal — escolhe algo seguro que consigas lembrar! 🔐
              </Text>
            </Section>

            {/* Step 2 */}
            <Section style={stepCard}>
              <Text style={stepNumber}>2</Text>
              <Text style={stepTitle}>Preenche a tua apresentação</Text>
              <Text style={stepDescription}>
                Depois de entrares, vai à página <strong>"Começa Aqui"</strong> no menu lateral. 
                Lá podes preencher a tua apresentação para a equipa te conhecer melhor — conta-nos quem és! ✨
              </Text>
            </Section>

            {/* Step 3 */}
            <Section style={stepCard}>
              <Text style={stepNumber}>3</Text>
              <Text style={stepTitle}>Verifica as tuas tarefas de onboarding</Text>
              <Text style={stepDescription}>
                Já tens tarefas de onboarding atribuídas para te ajudar a integrar. 
                Vai a <strong>"Tarefas"</strong> para veres o que preparámos para ti — passo a passo, sem stress! 📋
              </Text>
            </Section>
          </Section>

          {/* CTA Button */}
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

          {/* Footer */}
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
    businessName: 'HQ Studio',
  },
} satisfies TemplateEntry

/* ── Styles ── */

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'DM Sans', 'Inter', Arial, sans-serif",
}

const container = {
  maxWidth: '540px',
  margin: '0 auto',
  padding: '40px 24px',
}

const headerSection = {
  textAlign: 'center' as const,
  padding: '0 0 8px',
}

const headerEmoji = {
  fontSize: '48px',
  margin: '0 0 8px',
  lineHeight: '1',
}

const h1 = {
  fontSize: '24px',
  fontWeight: '700',
  color: '#1a1f36',
  margin: '0 0 12px',
  lineHeight: '1.3',
}

const subtitle = {
  fontSize: '15px',
  color: '#555770',
  lineHeight: '1.6',
  margin: '0',
}

const divider = {
  borderColor: '#e8e8ed',
  margin: '28px 0',
}

const stepsSection = {
  padding: '0',
}

const h2 = {
  fontSize: '17px',
  fontWeight: '600',
  color: '#1a1f36',
  margin: '0 0 20px',
}

const stepCard = {
  backgroundColor: '#f7f7fa',
  borderRadius: '10px',
  padding: '18px 20px',
  marginBottom: '12px',
}

const stepNumber = {
  display: 'inline-block' as const,
  backgroundColor: '#1a1f36',
  color: '#ffffff',
  width: '26px',
  height: '26px',
  borderRadius: '50%',
  textAlign: 'center' as const,
  lineHeight: '26px',
  fontSize: '13px',
  fontWeight: '700',
  margin: '0 0 8px',
}

const stepTitle = {
  fontSize: '15px',
  fontWeight: '600',
  color: '#1a1f36',
  margin: '0 0 6px',
}

const stepDescription = {
  fontSize: '14px',
  color: '#555770',
  lineHeight: '1.6',
  margin: '0',
}

const ctaSection = {
  textAlign: 'center' as const,
  padding: '24px 0 4px',
}

const ctaButton = {
  backgroundColor: '#1a1f36',
  color: '#f0f4ff',
  fontSize: '15px',
  fontWeight: '600',
  padding: '14px 36px',
  borderRadius: '8px',
  textDecoration: 'none',
  display: 'inline-block' as const,
}

const supportSection = {
  backgroundColor: '#fefcf3',
  borderRadius: '10px',
  padding: '18px 20px',
  border: '1px solid #f5ecd5',
}

const supportText = {
  fontSize: '14px',
  color: '#555770',
  lineHeight: '1.6',
  margin: '0',
}

const linkStyle = {
  color: '#1a1f36',
  textDecoration: 'underline',
}

const footer = {
  fontSize: '13px',
  color: '#999',
  textAlign: 'center' as const,
  margin: '28px 0 0',
  lineHeight: '1.6',
}
