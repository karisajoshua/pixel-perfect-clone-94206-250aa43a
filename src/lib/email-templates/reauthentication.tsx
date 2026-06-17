import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Hr,
  Text,
} from '@react-email/components'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brand}>
          <img src="https://pixel-perfect-clone-94206.lovable.app/__l5e/assets-v1/eebb88a1-040c-4590-ba83-e847a4eed58e/zia-logo-red.png" alt="Zest Insurance Agency" height="60" style={{ display: 'block', border: 0 }} />
        </Section>
        <Heading style={h1}>Confirm reauthentication</Heading>
        <Text style={text}>Use the code below to confirm your identity:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Hr style={hr} />
        <Text style={footer}>
          This code will expire shortly. If you didn't request this, you can
          safely ignore this email.
        </Text>
        <Text style={footer}>Zest Insurance · Nairobi, Kenya</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { paddingBottom: '12px' }
const h1 = { color: '#0f172a', fontSize: '24px', fontWeight: 700 as const, margin: '16px 0 12px' }
const text = { color: '#334155', fontSize: '15px', lineHeight: '24px', margin: '12px 0' }
const codeStyle = { fontFamily: 'Courier, monospace', fontSize: '28px', fontWeight: 700 as const, color: '#dc2626', letterSpacing: '4px', margin: '16px 0 24px', textAlign: 'center' as const, backgroundColor: '#f8fafc', padding: '16px', borderRadius: '10px' }
const hr = { borderColor: '#e2e8f0', margin: '28px 0 16px' }
const footer = { color: '#94a3b8', fontSize: '12px', margin: '4px 0' }
