/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>Confirma o teu email no {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={brand}>Lyrata</Heading>
        <Heading style={h1}>Confirma o teu email</Heading>
        <Text style={text}>
          Obrigada por te juntares ao{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          .
        </Text>
        <Text style={text}>
          Confirma o teu endereço (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) carregando no botão abaixo:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirmar email
        </Button>
        <Text style={footer}>
          Se não criaste uma conta, podes ignorar este email em segurança.
        </Text>
        <Text style={signature}>by Lyrata®</Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: '"Plus Jakarta Sans", "Helvetica Neue", Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brand = { fontSize: '14px', fontWeight: 600 as const, color: 'hsl(351, 56%, 28%)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, margin: '0 0 24px' }
const h1 = {
  fontSize: '24px',
  fontWeight: 700 as const,
  color: 'hsl(0, 0%, 16%)',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: 'hsl(0, 0%, 32%)',
  lineHeight: '1.5',
  margin: '0 0 20px',
}
const link = { color: 'hsl(351, 56%, 28%)', textDecoration: 'underline' }
const button = {
  backgroundColor: 'hsl(351, 56%, 28%)',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600 as const,
  borderRadius: '8px',
  padding: '14px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '13px', color: 'hsl(0, 0%, 55%)', margin: '32px 0 0', lineHeight: '1.5' }
const signature = { fontSize: '12px', color: 'hsl(351, 56%, 28%)', margin: '24px 0 0', fontWeight: 500 as const }
