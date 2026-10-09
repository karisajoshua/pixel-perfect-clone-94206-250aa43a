import DefaultTheme from 'vitepress/theme'
import mermaid from 'mermaid'
import './custom.css'

mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' })

async function renderDiagrams() {
  if (typeof document === 'undefined') return
  const blocks = document.querySelectorAll<HTMLElement>('div.language-mermaid')
  blocks.forEach((block) => {
    if (block.dataset.diagramReady) return
    const source = block.querySelector('code')?.textContent
    if (!source) return
    block.dataset.diagramReady = 'true'
    block.classList.add('mermaid')
    block.textContent = source
  })
  try {
    await mermaid.run({ querySelector: '.language-mermaid.mermaid:not([data-processed])' })
  } catch (error) {
    console.warn('Could not render a documentation diagram', error)
  }
}

export default {
  extends: DefaultTheme,
  enhanceApp({ router }) {
    if (typeof window === 'undefined') return
    router.onAfterRouteChanged = () => {
      window.setTimeout(() => { void renderDiagrams() }, 100)
    }
    window.addEventListener('load', () => { void renderDiagrams() }, { once: true })
  }
}
