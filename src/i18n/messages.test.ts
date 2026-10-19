import { describe, expect, it } from 'vitest'
import { LANGUAGES, interpolate, makeTranslate } from './config'
import hi from './messages/hi'
import bn from './messages/bn'
import mr from './messages/mr'
import gu from './messages/gu'
import pa from './messages/pa'
import ta from './messages/ta'
import te from './messages/te'
import kn from './messages/kn'
import ml from './messages/ml'

const FILES = { hi, bn, mr, gu, pa, ta, te, kn, ml }
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('languages', () => {
  it('has a file for every language except English', () => {
    const codes = LANGUAGES.map((l) => l.code).filter((c) => c !== 'en')
    expect(Object.keys(FILES).sort()).toEqual([...codes].sort())
  })

  it('every language has exactly the same sentences', () => {
    const reference = Object.keys(hi).sort()
    expect(reference.length).toBeGreaterThan(150)
    for (const [code, messages] of Object.entries(FILES)) {
      expect(Object.keys(messages).sort(), code).toEqual(reference)
    }
  })

  it('every translation keeps its {placeholders}, and no sentence is left empty', () => {
    for (const [code, messages] of Object.entries(FILES)) {
      for (const [english, text] of Object.entries(messages)) {
        expect(text.trim(), `${code}: ${english}`).not.toBe('')
        expect(placeholders(text), `${code}: ${english}`).toEqual(placeholders(english))
      }
    }
  })
})

describe('translate', () => {
  it('fills in placeholders', () => {
    expect(interpolate('{done} of {total} done', { done: 2, total: 5 })).toBe('2 of 5 done')
    expect(interpolate('Hello', { x: 1 })).toBe('Hello')
    expect(interpolate('{missing} stays', {})).toBe('{missing} stays')
  })

  it('shows English when a sentence has no translation', () => {
    const t = makeTranslate({ Done: 'पूरा हुआ' })
    expect(t('Done')).toBe('पूरा हुआ')
    expect(t('Never translated')).toBe('Never translated')
    expect(t('{n} left', { n: 3 })).toBe('3 left')
  })

  it('translates with placeholders', () => {
    expect(makeTranslate(hi)('{done} of {total} done', { done: 2, total: 5 })).toBe(
      '5 में से 2 पूरे',
    )
  })
})
