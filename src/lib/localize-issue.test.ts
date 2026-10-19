import { describe, expect, it } from 'vitest'
import { makeTranslate } from '../i18n/config'
import { localizeIssueHtml } from './localize-issue'

const hi = makeTranslate({
  'Garbage detection found {count} items in project "{project}".':
    '{count} कचरे की वस्तुएँ मिलीं, प्रोजेक्ट "{project}".',
  'Garbage detection found {count} item in project "{project}".':
    '{count} कचरा वस्तु मिली, प्रोजेक्ट "{project}".',
  'Location:': 'स्थान:',
  'Mostly:': 'ज़्यादातर:',
  'Plastic packaging': 'प्लास्टिक पैकेजिंग',
  '({count} detected locations)': '({count} जगहें मिलीं)',
})

describe('localizeIssueHtml', () => {
  const english = makeTranslate({})

  it('leaves English exactly as it was', () => {
    const html =
      '<p>Garbage detection found <strong>12</strong> items in project "North".</p><p><strong>Location:</strong> 29.95, 78.17 (3 detected locations)</p>'
    expect(localizeIssueHtml(html, english)).toBe(html)
  })

  it('translates the known sentences and keeps the numbers and names', () => {
    const out = localizeIssueHtml(
      '<p>Garbage detection found <strong>12</strong> items in project "North".</p>',
      hi,
    )
    expect(out).toBe('<p><strong>12</strong> कचरे की वस्तुएँ मिलीं, प्रोजेक्ट "North".</p>')
  })

  it('uses the singular sentence for one item', () => {
    expect(
      localizeIssueHtml(
        '<p>Garbage detection found <strong>1</strong> item in project "A".</p>',
        hi,
      ),
    ).toContain('कचरा वस्तु मिली')
  })

  it('translates labels and the kinds, and keeps the counts', () => {
    const out = localizeIssueHtml(
      '<p><strong>Mostly:</strong> Plastic packaging (4), Rubble (2)</p><p><strong>Location:</strong> 1, 2 (5 detected locations)</p>',
      hi,
    )
    expect(out).toContain('<strong>ज़्यादातर:</strong> प्लास्टिक पैकेजिंग (4), Rubble (2)')
    expect(out).toContain('<strong>स्थान:</strong> 1, 2 (5 जगहें मिलीं)')
  })

  it('leaves a typed note alone', () => {
    const html = '<p>Please check near the temple gate.</p>'
    expect(localizeIssueHtml(html, hi)).toBe(html)
  })
})
