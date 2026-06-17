import React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  clientName?: string
  portalUrl?: string
}

const Email = ({
  clientName = 'Valued Client',
  portalUrl = 'https://app.zestinsurance.co.ke/portal',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Zest client portal is ready</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brand}><img src="https://pixel-perfect-clone-94206.lovable.app/__l5e/assets-v1/eebb88a1-040c-4590-ba83-e847a4eed58e/zia-logo-red.png" alt="Zest Insurance Agency" height="60" style={{ display: "block", border: 0 }} /></Section>
        <Heading style={h1}>Your client portal is ready</Heading>
        <Text style={text}>Hi {clientName},</Text>
        <Text style={text}>
          You can now sign in to view your policies, download documents, see invoices, and track claims any time.
        </Text>
        <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
          <Button href={portalUrl} style={btn}>Open your portal</Button>
        </Section>
        <Text style={text}>If the button doesn't work, paste this link into your browser:</Text>
        <Text style={{ ...text, fontSize: '13px', color: '#64748b', wordBreak: 'break-all' as const }}>{portalUrl}</Text>
        <Hr style={hr} />
        <Text style={footer}>Zest Insurance · Nairobi, Kenya</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Your Zest client portal is ready',
  displayName: 'Portal Invite',
  previewData: {
    clientName: 'Jane Doe',
    portalUrl: 'https://app.zestinsurance.co.ke/portal',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { paddingBottom: '12px' }
const h1 = { color: '#0f172a', fontSize: '24px', fontWeight: 700 as const, margin: '16px 0 12px' }
const text = { color: '#334155', fontSize: '15px', lineHeight: '24px', margin: '12px 0' }
const btn = { backgroundColor: '#dc2626', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 as const, fontSize: '15px' }
const hr = { borderColor: '#e2e8f0', margin: '28px 0 16px' }
const footer = { color: '#94a3b8', fontSize: '12px', margin: 0 }