import { defineConfig } from 'vitepress'

const base = '/pixel-perfect-clone-94206-250aa43a/'

export default defineConfig({
  title: 'Zest Insurance Docs',
  description: 'Technical documentation, insurance operations, integrations and administrator guides.',
  base,
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: false,
  sitemap: { hostname: 'https://karisajoshua.github.io' + base },
  head: [
    ['meta', { name: 'theme-color', content: '#092c40' }],
    ['meta', { property: 'og:title', content: 'Zest Insurance Documentation' }],
    ['meta', { property: 'og:description', content: 'Insurance operations, integration architecture and engineering documentation.' }]
  ],
  themeConfig: {
    siteTitle: 'Zest / Docs',
    logo: undefined,
    search: { provider: 'local' },
    nav: [
      { text: 'Overview', link: '/' },
      { text: 'Guides', link: '/USER_GUIDE' },
      { text: 'Architecture', link: '/ARCHITECTURE' },
      { text: 'GitHub', link: 'https://github.com/karisajoshua/pixel-perfect-clone-94206-250aa43a' }
    ],
    sidebar: [
      { text: 'Getting started', items: [
        { text: 'Documentation home', link: '/' },
        { text: 'Documentation index', link: '/README' },
        { text: 'Features', link: '/FEATURES' },
        { text: 'Roadmap', link: '/ROADMAP' }
      ] },
      { text: 'Insurance operations', collapsed: false, items: [
        { text: 'Staff user manual', link: '/USER_GUIDE' },
        { text: 'Clients, policies & billing', link: '/CLIENT_POLICY_BILLING' },
        { text: 'Insurance workflows', link: '/INSURANCE_WORKFLOWS' },
        { text: 'Administrator manual', link: '/ADMIN_GUIDE' },
        { text: 'Roles and access', link: '/ACCESS_ROLES' }
      ] },
      { text: 'Integrations & automation', collapsed: false, items: [
        { text: 'Integrations overview', link: '/INTEGRATIONS' },
        { text: 'DMVIC and IPEN', link: '/DMVIC_IPEN' },
        { text: 'WhatsApp and email', link: '/WHATSAPP_EMAIL' },
        { text: 'Renewal email runbook', link: '/RENEWAL_EMAIL_RUNBOOK' },
        { text: 'Automation', link: '/AUTOMATION' },
        { text: 'AI assistant', link: '/AI_ASSISTANT' }
      ] },
      { text: 'Engineering', collapsed: false, items: [
        { text: 'Architecture', link: '/ARCHITECTURE' },
        { text: 'Database & tenancy', link: '/DATABASE' },
        { text: 'Security', link: '/SECURITY' },
        { text: 'Deployment', link: '/DEPLOYMENT' },
        { text: 'Verification matrix', link: '/VERIFICATION_MATRIX' }
      ] },
      { text: 'Architecture diagrams', collapsed: false, items: [
        { text: 'System architecture', link: '/diagrams/system-architecture' },
        { text: 'Policy lifecycle', link: '/diagrams/policy-lifecycle' },
        { text: 'Payment flow', link: '/diagrams/payment-flow' }
      ] },
      { text: 'Project & releases', collapsed: true, items: [
        { text: 'Brand assets', link: '/BRAND_ASSETS' },
        { text: 'Documentation changelog', link: '/CHANGELOG' },
        { text: 'Release template', link: '/RELEASE_TEMPLATE' },
        { text: 'Phase 3 acceptance', link: '/PHASE3_ACCEPTANCE' }
      ] }
    ],
    outline: { level: [2, 3], label: 'On this page' },
    editLink: {
      pattern: 'https://github.com/karisajoshua/pixel-perfect-clone-94206-250aa43a/edit/main/docs/:path',
      text: 'Suggest an edit on GitHub'
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/karisajoshua/pixel-perfect-clone-94206-250aa43a' }],
    footer: { message: 'Zest Insurance — Documentation based on reviewed source. Validate integrations before production use.', copyright: 'Zest Insurance' },
    docFooter: { prev: 'Previous', next: 'Next' }
  }
})
