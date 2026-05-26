import { Fragment, type ReactNode } from 'react'

type MarkdownBodyProps = {
  content: string | null | undefined
  className?: string
}

function renderInlineMarkdown(text: string, keyPrefix: string) {
  const nodes: ReactNode[] = []
  let cursor = 0
  let strongIndex = 0

  while (cursor < text.length) {
    const start = text.indexOf('**', cursor)

    if (start === -1) {
      nodes.push(text.slice(cursor))
      break
    }

    const end = text.indexOf('**', start + 2)

    if (end === -1) {
      nodes.push(text.slice(cursor))
      break
    }

    if (start > cursor) {
      nodes.push(text.slice(cursor, start))
    }

    const strongText = text.slice(start + 2, end)

    if (strongText) {
      nodes.push(
        <strong key={`${keyPrefix}-strong-${strongIndex}`}>
          {strongText}
        </strong>
      )
      strongIndex += 1
    } else {
      nodes.push('****')
    }

    cursor = end + 2
  }

  return nodes
}

function isHeadingLine(line: string) {
  return /^#{1,6}\s+/.test(line)
}

function isUnorderedListLine(line: string) {
  return /^[-*+]\s+/.test(line)
}

function isOrderedListLine(line: string) {
  return /^\d+\.\s+/.test(line)
}

function renderHeading(line: string, key: string) {
  const match = /^(#{1,6})\s+(.+)$/.exec(line)

  if (!match) {
    return null
  }

  const level = match[1].length
  const content = renderInlineMarkdown(match[2].trim(), key)

  if (level === 1) {
    return <h1 key={key}>{content}</h1>
  }

  if (level === 2) {
    return <h2 key={key}>{content}</h2>
  }

  if (level === 3) {
    return <h3 key={key}>{content}</h3>
  }

  if (level === 4) {
    return <h4 key={key}>{content}</h4>
  }

  if (level === 5) {
    return <h5 key={key}>{content}</h5>
  }

  return <h6 key={key}>{content}</h6>
}

function renderParagraph(lines: string[], key: string) {
  return (
    <p key={key}>
      {lines.map((line, index) => (
        <Fragment key={`${key}-line-${index}`}>
          {index > 0 ? <br /> : null}
          {renderInlineMarkdown(line, `${key}-line-${index}`)}
        </Fragment>
      ))}
    </p>
  )
}

function renderUnorderedList(lines: string[], key: string) {
  return (
    <ul key={key}>
      {lines.map((line, index) => (
        <li key={`${key}-item-${index}`}>
          {renderInlineMarkdown(line.replace(/^[-*+]\s+/, ''), `${key}-item-${index}`)}
        </li>
      ))}
    </ul>
  )
}

function renderOrderedList(lines: string[], key: string) {
  return (
    <ol key={key}>
      {lines.map((line, index) => (
        <li key={`${key}-item-${index}`}>
          {renderInlineMarkdown(line.replace(/^\d+\.\s+/, ''), `${key}-item-${index}`)}
        </li>
      ))}
    </ol>
  )
}

function parseMarkdown(content: string) {
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalizedContent.split('\n')
  const blocks: ReactNode[] = []
  let index = 0
  let blockIndex = 0

  while (index < lines.length) {
    const line = lines[index]
    const trimmedLine = line.trim()

    if (!trimmedLine) {
      index += 1
      continue
    }

    const key = `markdown-block-${blockIndex}`
    blockIndex += 1

    if (isHeadingLine(trimmedLine)) {
      blocks.push(renderHeading(trimmedLine, key))
      index += 1
      continue
    }

    if (isUnorderedListLine(trimmedLine)) {
      const listLines: string[] = []

      while (index < lines.length && isUnorderedListLine(lines[index].trim())) {
        listLines.push(lines[index].trim())
        index += 1
      }

      blocks.push(renderUnorderedList(listLines, key))
      continue
    }

    if (isOrderedListLine(trimmedLine)) {
      const listLines: string[] = []

      while (index < lines.length && isOrderedListLine(lines[index].trim())) {
        listLines.push(lines[index].trim())
        index += 1
      }

      blocks.push(renderOrderedList(listLines, key))
      continue
    }

    const paragraphLines: string[] = []

    while (index < lines.length) {
      const currentLine = lines[index]
      const currentTrimmedLine = currentLine.trim()

      if (
        !currentTrimmedLine ||
        isHeadingLine(currentTrimmedLine) ||
        isUnorderedListLine(currentTrimmedLine) ||
        isOrderedListLine(currentTrimmedLine)
      ) {
        break
      }

      paragraphLines.push(currentLine)
      index += 1
    }

    blocks.push(renderParagraph(paragraphLines, key))
  }

  return blocks
}

export default function MarkdownBody({ content, className = '' }: MarkdownBodyProps) {
  const markdown = content?.trim()

  if (!markdown) {
    return null
  }

  return (
    <div className={`app-markdown ${className}`.trim()}>
      {parseMarkdown(markdown)}
    </div>
  )
}
