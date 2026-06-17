import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  clientName?: string
  invoiceNo?: string
  amount?: string
  dueDate?: string
  issueDate?: string
  policyNo?: string
}

const Email = ({
  clientName = 'Valued Client',
  invoiceNo = 'INV-XXXX',
  amount = '',
  dueDate = '',
  issueDate = '',
  policyNo = '',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Invoice ${invoiceNo} from Zest Insurance`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brand}><img src="https://pixel-perfect-clone-94206.lovable.app/__l5e/assets-v1/eebb88a1-040c-4590-ba83-e847a4eed58e/zia-logo-red.png" alt="Zest Insurance Agency" height="60" style={{ display: "block", border: 0 }} /></Section>
        <Heading style={h1}>New invoice</Heading>
        <Text style={text}>Hi {clientName},</Text>
        <Text style={text}>
          A new invoice <strong>{invoiceNo}</strong> has been issued for your account.
        </Text>
        <Section style={card}>
          <Row label="Invoice" value={invoiceNo} />
          {amount && <Row label="Amount due" value={amount} />}
          {issueDate && <Row label="Issued" value={issueDate} />}
          {dueDate && <Row label="Due" value={dueDate} />}
          {policyNo && <Row label="Policy" value={policyNo} />}
        </Section>
        <Text style={text}>You can pay via M-Pesa, bank transfer, or cheque. Reply to this email if you need payment instructions or a copy of the invoice.</Text>
        <Hr style={hr} />
        <Text style={footer}>Zest Insurance · Nairobi, Kenya</Text>
      </Container>
    </Body>
  </Html>
)

const Row = ({ label, value }: { label: string; value: string }) => (
  <Text style={rowText}><span style={rowLabel}>{label}: </span><strong>{value}</strong></Text>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Invoice ${d.invoiceNo ?? ''} from Zest Insurance`,
  displayName: 'Invoice Issued',
  previewData: {
    clientName: 'Jane Doe',
    invoiceNo: 'INV-2026-00345',
    amount: 'KES 45,000',
    dueDate: '2026-07-01',
    issueDate: '2026-06-17',
    policyNo: 'POL-2026-00123',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { paddingBottom: '12px' }
const h1 = { color: '#0f172a', fontSize: '24px', fontWeight: 700 as const, margin: '16px 0 12px' }
const text = { color: '#334155', fontSize: '15px', lineHeight: '24px', margin: '12px 0' }
const card = { backgroundColor: '#f8fafc', borderRadius: '10px', padding: '16px 18px', margin: '16px 0' }
const rowText = { color: '#0f172a', fontSize: '14px', lineHeight: '22px', margin: '4px 0' }
const rowLabel = { color: '#64748b' }
const hr = { borderColor: '#e2e8f0', margin: '28px 0 16px' }
const footer = { color: '#94a3b8', fontSize: '12px', margin: 0 }