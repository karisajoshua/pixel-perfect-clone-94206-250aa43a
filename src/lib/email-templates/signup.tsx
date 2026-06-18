import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Hr,
  Text,
} from '@react-email/components'

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
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brand}>
          <img src="https://app.zestinsurance.co.ke/__l5e/assets-v1/eebb88a1-040c-4590-ba83-e847a4eed58e/zia-logo-red.png" alt="Zest Insurance Agency" height="60" style={{ display: 'block', border: 0 }} />
        </Section>
        <Heading style={h1}>Confirm your email</Heading>
        <Text style={text}>
          Thanks for signing up for{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          !
        </Text>
        <Text style={text}>
          Please confirm your email address (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) by clicking the button below:
        </Text>
        <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
          <Button style={button} href={confirmationUrl}>
            Verify Email
          </Button>
        </Section>
        <Hr style={hr} />
        <Text style={footer}>
          If you didn't create an account, you can safely ignore this email.
        </Text>
        <Text style={footer}>Zest Insurance · Nairobi, Kenya</Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { paddingBottom: '12px' }
const h1 = { color: '#0f172a', fontSize: '24px', fontWeight: 700 as const, margin: '16px 0 12px' }
const text = { color: '#334155', fontSize: '15px', lineHeight: '24px', margin: '12px 0' }
const link = { color: '#dc2626', textDecoration: 'underline' }
const button = { backgroundColor: '#dc2626', color: '#ffffff', fontSize: '15px', fontWeight: 600 as const, borderRadius: '8px', padding: '12px 24px', textDecoration: 'none' }
const hr = { borderColor: '#e2e8f0', margin: '28px 0 16px' }
const footer = { color: '#94a3b8', fontSize: '12px', margin: '4px 0' }
