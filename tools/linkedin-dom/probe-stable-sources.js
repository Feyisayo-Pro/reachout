// ─────────────────────────────────────────────────────────────────────────────
// LinkedIn STABLE-SOURCE probe
//
// LinkedIn's CSS classes are build-hashed (gflkzy, gflkxo...) and change on
// every deploy, so class-based selectors are useless. This checks the sources
// that are stable by design: document.title, og:/meta tags, JSON-LD, and
// heading-text-anchored sections.
//
// Run on a LinkedIn profile (linkedin.com/in/...). Read-only.
// ─────────────────────────────────────────────────────────────────────────────

(() => {
  const out = {}

  // ── 1. document.title ──────────────────────────────────────────────────────
  out.documentTitle = document.title

  // ── 2. meta tags ───────────────────────────────────────────────────────────
  const metas = {}
  document.querySelectorAll('meta[property], meta[name]').forEach(m => {
    const k = m.getAttribute('property') || m.getAttribute('name')
    const v = m.getAttribute('content')
    if (!k || !v) return
    if (/^(og:|twitter:|description|profile:)/i.test(k)) metas[k] = v.slice(0, 300)
  })
  out.metaTags = metas

  // ── 3. JSON-LD structured data ─────────────────────────────────────────────
  const ld = []
  document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
    try { ld.push(JSON.parse(s.textContent)) }
    catch (e) { ld.push({ parseError: true, raw: s.textContent.slice(0, 200) }) }
  })
  out.jsonLdCount = ld.length
  out.jsonLd = ld

  // ── 4. Heading-anchored sections (About, Experience) ───────────────────────
  // Find a heading whose text is exactly "About", then grab nearby text.
  function sectionByHeading(headingText) {
    const heads = Array.from(document.querySelectorAll('h2, h3, [role="heading"], span'))
      .filter(el => el.innerText && el.innerText.trim().toLowerCase() === headingText.toLowerCase())
    for (const h of heads) {
      let node = h
      for (let i = 0; i < 6 && node; i++) {
        node = node.parentElement
        if (!node) break
        const t = (node.innerText || '').trim()
        // a real section has substantially more text than just the heading
        if (t.length > headingText.length + 80) {
          return { found: true, tag: node.tagName.toLowerCase(), text: t.slice(0, 400) }
        }
      }
    }
    return { found: false }
  }
  out.aboutSection = sectionByHeading('About')

  // ── 5. Does an h1 appear anywhere (incl. visually hidden)? ─────────────────
  out.h1Count   = document.querySelectorAll('h1').length
  out.viewport  = window.innerWidth

  console.log('%c LINKEDIN STABLE-SOURCE PROBE ', 'background:#4338ca;color:#fff;font-weight:bold')
  console.log('viewport     :', out.viewport)
  console.log('h1 count     :', out.h1Count)
  console.log('document.title:', out.documentTitle)
  console.log('\n%c META TAGS ', 'background:#047857;color:#fff')
  console.table(out.metaTags)
  console.log('\n%c JSON-LD ', 'background:#047857;color:#fff', `(${out.jsonLdCount} block(s))`)
  console.log(out.jsonLd)
  console.log('\n%c ABOUT SECTION ', 'background:#047857;color:#fff')
  console.log(out.aboutSection)
  console.log('\n%c Screenshot this back to Claude ', 'background:#b45309;color:#fff')
  return out
})()
