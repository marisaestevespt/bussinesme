/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
  brandColor?: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl, brandColor }: RecoveryEmailProps) => {
  const __brand = brandColor ? `hsl(${brandColor.replace(/ /g, ', ')})` : 'hsl(351, 56%, 28%)';
  // styles inlined
  const main = { backgroundColor: '#ffffff', fontFamily: '"Plus Jakarta Sans", "Helvetica Neue", Arial, sans-serif' }
  const container = { padding: '32px 28px', maxWidth: '640px' }
  const brand = { fontSize: '14px', fontWeight: 600 as const, color: __brand, letterSpacing: '0.08em', textTransform: 'uppercase' as const, margin: '0 0 24px' }
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
  const button = {
    backgroundColor: __brand,
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 600 as const,
    borderRadius: '8px',
    padding: '14px 24px',
    textDecoration: 'none',
  }
  const footer = { fontSize: '13px', color: 'hsl(0, 0%, 55%)', margin: '32px 0 0', lineHeight: '1.5' }
  const signature = { fontSize: '12px', color: __brand, margin: '24px 0 0', fontWeight: 500 as const }

  return (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>Redefinir a tua password no {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={brand}>Lyrata</Heading>
        <Heading style={h1}>Redefinir password</Heading>
        <Text style={text}>
          Recebemos um pedido para redefinir a tua password no {siteName}.
          Carrega no botão abaixo para escolher uma nova.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Redefinir password
        </Button>
        <Text style={footer}>
          Se não pediste esta alteração, ignora este email — a tua password
          permanece inalterada.
        </Text>
        <Text style={signature}>by Lyrata®</Text>
      </Container>
    </Body>
  </Html>
);
}

export default RecoveryEmail

