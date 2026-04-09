type PdfTextLine = {
  text: string
  size?: number
  bold?: boolean
  lineHeight?: number
}

type PdfPage = {
  lines: PdfTextLine[]
}

function escapePdfText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function sanitizeLine(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, '  ')
    .replace(/[^\x20-\x7E\n]/g, '')
}

function wrapText(value: string, maxChars: number) {
  const normalizedValue = sanitizeLine(value)
  const paragraphs = normalizedValue.split('\n')
  const lines: string[] = []

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim()

    if (!trimmedParagraph) {
      lines.push('')
      continue
    }

    const words = trimmedParagraph.split(/\s+/)
    let currentLine = ''

    for (const word of words) {
      if (!currentLine) {
        currentLine = word
        continue
      }

      const nextLine = `${currentLine} ${word}`

      if (nextLine.length <= maxChars) {
        currentLine = nextLine
        continue
      }

      lines.push(currentLine)
      currentLine = word
    }

    if (currentLine) {
      lines.push(currentLine)
    }
  }

  return lines
}

export function createSimplePdf(pages: PdfPage[]) {
  const pdfParts = ['%PDF-1.4\n']
  const objectOffsets: number[] = []

  const pushObject = (objectNumber: number, content: string) => {
    objectOffsets[objectNumber] = pdfParts.join('').length
    pdfParts.push(`${objectNumber} 0 obj\n${content}\nendobj\n`)
  }

  const fontRegularObject = 3
  const fontBoldObject = 4
  const firstPageObject = 5
  const firstContentObject = firstPageObject + pages.length
  const catalogObject = 1
  const pagesObject = 2

  const pageObjectNumbers = pages.map((_, index) => firstPageObject + index)
  const contentObjectNumbers = pages.map((_, index) => firstContentObject + index)

  pushObject(
    fontRegularObject,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  )
  pushObject(
    fontBoldObject,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'
  )

  for (const [index, page] of pages.entries()) {
    const contentCommands: string[] = ['BT']
    let currentY = 744

    for (const line of page.lines) {
      const fontSize = line.size ?? 11
      const x = 48
      const y = currentY
      const fontKey = line.bold ? 'F2' : 'F1'

      contentCommands.push(`/${fontKey} ${fontSize} Tf`)
      contentCommands.push(`1 0 0 1 ${x} ${y} Tm`)
      contentCommands.push(`(${escapePdfText(line.text)}) Tj`)
      currentY -= line.lineHeight ?? (fontSize >= 18 ? 24 : fontSize >= 14 ? 20 : 16)
    }

    contentCommands.push('ET')

    const contentStream = contentCommands.join('\n')
    pushObject(
      contentObjectNumbers[index]!,
      `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`
    )
  }

  const pageKids = pageObjectNumbers.map((objectNumber) => `${objectNumber} 0 R`).join(' ')
  pushObject(
    pagesObject,
    `<< /Type /Pages /Count ${pages.length} /Kids [${pageKids}] >>`
  )

  for (const [index, pageObjectNumber] of pageObjectNumbers.entries()) {
    pushObject(
      pageObjectNumber,
      `<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontRegularObject} 0 R /F2 ${fontBoldObject} 0 R >> >> /Contents ${contentObjectNumbers[index]} 0 R >>`
    )
  }

  pushObject(catalogObject, `<< /Type /Catalog /Pages ${pagesObject} 0 R >>`)

  const highestObjectNumber = firstContentObject + pages.length - 1
  const xrefOffset = pdfParts.join('').length
  pdfParts.push(`xref\n0 ${highestObjectNumber + 1}\n`)
  pdfParts.push('0000000000 65535 f \n')

  for (let objectNumber = 1; objectNumber <= highestObjectNumber; objectNumber += 1) {
    const offset = objectOffsets[objectNumber] ?? 0
    pdfParts.push(`${String(offset).padStart(10, '0')} 00000 n \n`)
  }

  pdfParts.push(
    `trailer\n<< /Size ${highestObjectNumber + 1} /Root ${catalogObject} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  )

  return Buffer.from(pdfParts.join(''), 'binary')
}

export function buildSimplePdfPages(lines: PdfTextLine[]) {
  const pages: PdfPage[] = []
  let currentPage: PdfPage = { lines: [] }
  let currentLineCount = 0
  const maxLinesPerPage = 44

  const pushLine = (line: PdfTextLine) => {
    if (currentLineCount >= maxLinesPerPage) {
      pages.push(currentPage)
      currentPage = { lines: [] }
      currentLineCount = 0
    }

    currentPage.lines.push(line)
    currentLineCount += 1
  }

  for (const line of lines) {
    const fontSize = line.size ?? 11
    const maxChars =
      fontSize >= 16 ? 48 : fontSize >= 13 ? 62 : fontSize >= 12 ? 72 : 88

    if (!line.text) {
      pushLine({ ...line, text: '' })
      continue
    }

    const wrappedLines = wrapText(line.text, maxChars)

    if (wrappedLines.length === 0) {
      pushLine({ ...line, text: '' })
      continue
    }

    for (const wrappedLine of wrappedLines) {
      pushLine({
        ...line,
        text: wrappedLine,
      })
    }
  }

  if (currentPage.lines.length > 0 || pages.length === 0) {
    pages.push(currentPage)
  }

  return pages
}
