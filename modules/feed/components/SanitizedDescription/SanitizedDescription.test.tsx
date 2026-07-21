import { render, screen } from '@test-utils'
import { SanitizedDescription, sanitizeDescription } from './SanitizedDescription'

describe('sanitizeDescription', () => {
  it('strips script tags and their content', () => {
    const out = sanitizeDescription('<p>Hello</p><script>alert(1)</script>')
    expect(out).toBe('<p>Hello</p>')
  })

  it('strips img, picture, iframe, svg and style entirely', () => {
    const out = sanitizeDescription(
      '<p>Text</p><img src="https://evil.example/pixel.png"><picture><source srcset="x"></picture>' +
        '<iframe src="https://evil.example"></iframe><svg onload="alert(1)"></svg>' +
        '<style>body { display: none }</style>',
    )
    expect(out).toContain('<p>Text</p>')
    for (const fragment of ['img', 'picture', 'iframe', 'svg', 'style', 'evil.example']) {
      expect(out).not.toContain(fragment)
    }
  })

  it('keeps anchors with href only — target and handlers are stripped', () => {
    const out = sanitizeDescription(
      '<a href="https://example.com/job" target="_blank" rel="opener" onclick="alert(1)">Apply</a>',
    )
    expect(out).toBe('<a href="https://example.com/job">Apply</a>')
  })

  it('neutralizes javascript: hrefs', () => {
    const out = sanitizeDescription('<a href="javascript:alert(1)">Apply</a>')
    expect(out).not.toContain('javascript:')
  })

  it('keeps the formatting allowlist intact', () => {
    const input =
      '<h2>Role</h2><ul><li><strong>TypeScript</strong></li><li><em>React</em></li></ul>' +
      '<pre><code>pnpm dev</code></pre><blockquote>Quote</blockquote>'
    expect(sanitizeDescription(input)).toBe(input)
  })

  it('leaves entities intact', () => {
    expect(sanitizeDescription('<p>Fisch &amp; Chips &lt;3</p>')).toBe(
      '<p>Fisch &amp; Chips &lt;3</p>',
    )
  })

  it('drops attributes beyond href everywhere', () => {
    const out = sanitizeDescription('<p class="huge" style="color:red" data-x="1">Text</p>')
    expect(out).toBe('<p>Text</p>')
  })
})

describe('SanitizedDescription', () => {
  it('renders sanitized markup with entities decoded', () => {
    render(<SanitizedDescription html="<p>Fisch &amp; Chips</p><script>alert(1)</script>" />)
    expect(screen.getByText('Fisch & Chips')).toBeInTheDocument()
    expect(document.querySelector('script')).toBeNull()
  })

  it('renders anchors without target', () => {
    render(<SanitizedDescription html='<a href="https://example.com" target="_blank">Apply</a>' />)
    const anchor = screen.getByRole('link', { name: 'Apply' })
    expect(anchor).toHaveAttribute('href', 'https://example.com')
    expect(anchor).not.toHaveAttribute('target')
  })
})
