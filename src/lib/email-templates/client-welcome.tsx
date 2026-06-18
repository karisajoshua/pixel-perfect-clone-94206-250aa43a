import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  clientName?: string
}

const Email = ({ clientName = 'Valued Client' }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to Zest Insurance Agency</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brand}><img src="https://app.zestinsurance.co.ke/__l5e/assets-v1/eebb88a1-040c-4590-ba83-e847a4eed58e/zia-logo-red.png" alt="Zest Insurance Agency" height="60" style={{ display: "block", border: 0 }} /></Section>
        <Heading style={h1}>Welcome to Zest</Heading>
        <Text style={text}>Hi {clientName},</Text>
        <Text style={text}>
          Thanks for choosing Zest Insurance Agency. Your account has been created and our team will reach out shortly with quotations and policy options tailored to your needs.
        </Text>
        <Section style={card}>
          <Text style={rowText}>What happens next:</Text>
          <Text style={rowText}>• We confirm your cover requirements</Text>
          <Text style={rowText}>• You receive quotations from top insurers</Text>
          <Text style={rowText}>• We issue your policy and share documents</Text>
        </Section>
        <Text style={text}>Reply to this email any time you have questions.</Text>
        <Hr style={hr} />
        <Text style={footer}>Zest Insurance · Nairobi, Kenya</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Welcome to Zest Insurance',
  displayName: 'Client Welcome',
  previewData: { clientName: 'Jane Doe' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { paddingBottom: '12px' }
const h1 = { color: '#0f172a', fontSize: '24px', fontWeight: 700 as const, margin: '16px 0 12px' }
const text = { color: '#334155', fontSize: '15px', lineHeight: '24px', margin: '12px 0' }
const card = { backgroundColor: '#f8fafc', borderRadius: '10px', padding: '16px 18px', margin: '16px 0' }
const rowText = { color: '#0f172a', fontSize: '14px', lineHeight: '22px', margin: '4px 0' }
const hr = { borderColor: '#e2e8f0', margin: '28px 0 16px' }
const footer = { color: '#94a3b8', fontSize: '12px', margin: 0 }