// content.js — extracts recruiter context from the LinkedIn page the user is
// currently viewing.
//
// SCOPE: this reads only the page already open in front of the user. It does
// not crawl, does not collect in bulk, and never sends a message. It is a
// drafting aid.
//
// WHY NO CSS SELECTORS: LinkedIn ships build-hashed class names (gflkzy,
// gflkxo, ...) that change on every deploy, renders no <h1> on profiles,
// strips og:/meta tags for logged-in views, and emits no JSON-LD. Verified
// against a live profile. Everything below therefore anchors on
// document.title, literal heading text, and positional parsing.

if (!window.__reachout_loaded) {
  window.__reachout_loaded = true

  function runtimeOk() {
    try { return !!(chrome.runtime && chrome.runtime.id) } catch (e) { return false }
  }

  // ── name: from document.title ────────────────────────────────────────────
  // "(3) Laura Baron | LinkedIn" -> "Laura Baron"
  function getName() {
    return (document.title || '')
      .replace(/^\(\d+\+?\)\s*/, '')
      .replace(/\s*[|–-]\s*LinkedIn\s*$/i, '')
      .trim()
  }

  // ── a section, found by its literal heading text ─────────────────────────
  function sectionByHeading(headingText) {
    const heads = Array.from(document.querySelectorAll('h2, h3, [role="heading"], span, div'))
      .filter(el => {
        const t = el.innerText && el.innerText.trim()
        return t && t.toLowerCase() === headingText.toLowerCase()
      })
    for (const h of heads) {
      let node = h
      for (let k = 0; k < 6 && node; k++) {
        node = node.parentElement
        if (!node) break
        const t = (node.innerText || '').trim()
        if (t.length > headingText.length + 80) return t
      }
    }
    return ''
  }

  function getAbout() {
    const raw = sectionByHeading('About')
    if (!raw) return ''
    return raw.replace(/^About\s*/i, '')
              .replace(/\s*…?\s*see more\s*$/i, '')
              .trim()
  }

  const NOISE = /^(·|\d|Contact info|followers?|connections?|Follow|Message|More|Open to|Verified)/i

  // ── headline: nearest container holding the name plus real content ───────
  function getHeadline(name) {
    if (!name) return ''
    const cand = Array.from(document.querySelectorAll('body *')).filter(el => {
      const t = el.innerText && el.innerText.trim()
      if (t !== name) return false
      return !Array.from(el.children).some(c => (c.innerText || '').trim() === name)
    })
    let node = cand[0]
    if (!node) return ''
    for (let k = 0; k < 8 && node.parentElement; k++) {
      node = node.parentElement
      const lines = (node.innerText || '').split('\n').map(x => x.trim()).filter(Boolean)
      if (!lines.includes(name)) continue
      if (lines.length > 40) break
      const after = lines.slice(lines.indexOf(name) + 1)
        .filter(l => l !== name && !NOISE.test(l))
      if (after.length) return after[0]
    }
    return ''
  }

  // ── location: anchored on the literal "Contact info" link ────────────────
  // LinkedIn renders "<Location> · Contact info" together. Walking up from the
  // name element missed it, because the innermost container holding the name
  // has only name/headline/More/Message/Follow.
  function getLocation() {
    const ci = Array.from(document.querySelectorAll('a, span, button'))
      .find(el => (el.innerText || '').trim().toLowerCase() === 'contact info')
    if (!ci) return ''
    let node = ci
    for (let k = 0; k < 4 && node.parentElement; k++) {
      node = node.parentElement
      const lines = (node.innerText || '').split('\n').map(x => x.trim()).filter(Boolean)
      const loc = lines.find(l =>
        l && !/^contact info$/i.test(l) && l !== '·' && l.length > 2 && l.length < 80)
      if (loc) return loc.replace(/\s*·\s*Contact info\s*$/i, '').trim()
    }
    return ''
  }

  // ── company: from "@ Company" in the headline, else Experience ───────────
  function getCompany(headline) {
    const at = (headline || '').match(/@\s*([A-Za-z0-9&.,'\- ]{2,40})/)
    if (at) return at[1].trim().replace(/\s*\|.*$/, '').trim()
    const exp = sectionByHeading('Experience')
    if (exp) {
      const lines = exp.split('\n').map(x => x.trim()).filter(Boolean)
      const cand = lines.slice(1).find(l =>
        l && !/^(Experience|Full-time|Part-time|Present|\d{4})/i.test(l) && l.length < 80)
      if (cand) return cand
    }
    return ''
  }

  function cleanHref() {
    try { const u = new URL(window.location.href); return u.origin + u.pathname }
    catch (e) { return window.location.href }
  }

  function getProfile() {
    const name     = getName()
    const headline = getHeadline(name)
    return {
      kind: 'profile',
      name,
      headline,
      location: getLocation(),
      company:  getCompany(headline),
      about:    getAbout(),
      postText: '',
      profileUrl: cleanHref(),
    }
  }

  function getPost() {
    const post = document.querySelector('.feed-shared-update-v2, [data-urn*="activity"], article')
    if (!post) return null
    const lines = (post.innerText || '').split('\n').map(x => x.trim()).filter(Boolean)
    if (!lines.length) return null
    return {
      kind: 'post',
      name: lines[0] || '',
      headline: lines[1] || '',
      location: '', company: '', about: '',
      postText: (post.innerText || '').trim().slice(0, 3000),
      profileUrl: cleanHref(),
    }
  }

  function extract() {
    if (!window.location.hostname.includes('linkedin.com')) return null
    const path = window.location.pathname
    if (path.startsWith('/in/')) return getProfile()
    if (path.startsWith('/posts/') || path.startsWith('/feed/')) return getPost()
    return null
  }

  // ── messaging ────────────────────────────────────────────────────────────
  if (window.__reachout_listener) {
    try { chrome.runtime.onMessage.removeListener(window.__reachout_listener) } catch (e) {}
  }
  window.__reachout_listener = function (msg, _sender, sendResponse) {
    if (msg.type === 'GET_RECRUITER') sendResponse(extract())
    return true
  }
  chrome.runtime.onMessage.addListener(window.__reachout_listener)

  // ── push on navigation (LinkedIn is a SPA) ───────────────────────────────
  let lastKey = ''
  function push() {
    if (!runtimeOk()) return
    const r = extract()
    if (!r || !r.name) return
    const key = r.kind + '|' + r.name + '|' + r.profileUrl
    if (key === lastKey) return
    lastKey = key
    try { chrome.runtime.sendMessage({ type: 'RECRUITER_UPDATED', recruiter: r }).catch(() => {}) }
    catch (e) {}
  }

  setTimeout(push, 1200)
  setTimeout(push, 3000)

  let lastHref = location.href
  setInterval(() => {
    if (!runtimeOk()) return
    if (location.href !== lastHref) {
      lastHref = location.href
      setTimeout(push, 1500)
    }
  }, 800)
}
