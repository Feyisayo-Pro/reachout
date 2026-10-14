// ─────────────────────────────────────────────────────────────────────────────
// LinkedIn selector DISCOVERY
//
// Instead of guessing selectors, this finds the real elements that actually
// contain the text you can see on screen, and reports how to target them.
//
// BEFORE RUNNING:
//   * Turn OFF responsive/device mode in DevTools (the phone/tablet icon),
//     so you're testing the real desktop layout.
//   * Be on a LinkedIn profile page (linkedin.com/in/...).
//
// Read-only. Changes nothing.
// ─────────────────────────────────────────────────────────────────────────────

(() => {
  // Edit these to match what you can literally SEE on the profile you're on.
  const TARGETS = {
    name:     'FULL NAME EXACTLY AS SHOWN',
    headline: 'A DISTINCTIVE PHRASE FROM THE HEADLINE',
    location: 'CITY OR REGION AS SHOWN',
    company:  'COMPANY NAME AS SHOWN',
    about:    'THE FIRST FEW WORDS OF THE ABOUT SECTION',
  }

  function cssPath(el) {
    const parts = []
    let node = el
    while (node && node.nodeType === 1 && parts.length < 5) {
      let part = node.tagName.toLowerCase()
      if (node.id) { part += `#${node.id}`; parts.unshift(part); break }
      const cls = (node.className || '').toString().trim().split(/\s+/)
        .filter(c => c && !/^(ember|artdeco-)/.test(c)).slice(0, 3)
      if (cls.length) part += '.' + cls.join('.')
      parts.unshift(part)
      node = node.parentElement
    }
    return parts.join(' > ')
  }

  function deepestWith(text) {
    if (!text) return null
    const all = Array.from(document.querySelectorAll('body *'))
    const hits = all.filter(el => {
      if (!el.innerText) return false
      if (!el.innerText.includes(text)) return false
      // deepest = no child element also contains it
      return !Array.from(el.children).some(c => c.innerText && c.innerText.includes(text))
    })
    return hits[0] || null
  }

  console.log('%c LINKEDIN SELECTOR DISCOVERY ', 'background:#4338ca;color:#fff;font-weight:bold')
  console.log('URL:', location.href)
  console.log('Viewport width:', window.innerWidth, '(should be >1000 for desktop layout)')
  console.log('<main> exists:', !!document.querySelector('main'))
  console.log('h1 count:', document.querySelectorAll('h1').length,
              '| first h1 text:', document.querySelector('h1')?.innerText?.slice(0, 60) || '(none)')

  const out = {}
  for (const [field, text] of Object.entries(TARGETS)) {
    const el = deepestWith(text)
    if (!el) { out[field] = { found: false }; continue }
    out[field] = {
      found:   true,
      tag:     el.tagName.toLowerCase(),
      id:      el.id || '',
      classes: (el.className || '').toString().slice(0, 120),
      path:    cssPath(el),
      sample:  el.innerText.slice(0, 60).replace(/\n/g, ' '),
    }
  }

  console.log('%c RESULTS ', 'background:#047857;color:#fff')
  for (const [field, info] of Object.entries(out)) {
    console.log(`\n── ${field} ──`)
    if (!info.found) { console.log('   NOT FOUND (check the TARGETS text matches the page)'); continue }
    console.log('   tag    :', info.tag)
    console.log('   id     :', info.id || '(none)')
    console.log('   classes:', info.classes || '(none)')
    console.log('   path   :', info.path)
    console.log('   sample :', info.sample)
  }
  console.log('\n%c Screenshot this whole output back to Claude ', 'background:#b45309;color:#fff')
  return out
})()
