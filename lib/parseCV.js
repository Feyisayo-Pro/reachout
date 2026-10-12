// Extracts plain text from a CV in the browser. The file itself is never
// uploaded or stored anywhere: only the extracted text is saved, which is all
// that drafting needs. This keeps sensitive documents off our servers and
// avoids any file-storage dependency.

export const MAX_CV_CHARS = 60000   // must match the Firestore rule

export async function parseCV(file) {
  if (file.size > 8 * 1024 * 1024) throw new Error('That file is over 8 MB.')
  const ab = await file.arrayBuffer()

  if (/\.pdf$/i.test(file.name)) {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc =
      new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
    const pdf = await pdfjs.getDocument({ data: ab }).promise
    let out = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      out += content.items.map(it => it.str).join(' ') + '\n'
    }
    return clean(out)
  }

  if (/\.docx$/i.test(file.name)) {
    const mod = await import('mammoth')
    const mammoth = mod.default || mod
    const res = await mammoth.extractRawText({ arrayBuffer: ab })
    return clean(res?.value || '')
  }

  throw new Error('Upload a PDF or DOCX file.')
}

function clean(t) {
  const s = t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  if (!s) throw new Error('No readable text found. Scanned PDFs need OCR first.')
  return s.slice(0, MAX_CV_CHARS)
}
