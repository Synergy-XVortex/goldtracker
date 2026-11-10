import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatEuros,
  formatGrams,
  formatMonth,
  formatSignedEuros,
  formatSignedPercent,
  ofName,
} from './format'

// Intl uses narrow no-break spaces in French output; compare on plain spaces.
const plain = (text: string) => text.replace(/[  ]/g, ' ')

describe('format', () => {
  it('formats euros the French way', () => {
    expect(plain(formatEuros(1_669_800))).toBe('16 698,00 €')
    expect(plain(formatEuros(4_581))).toBe('45,81 €')
  })

  it('shows the sign of gains and losses', () => {
    expect(plain(formatSignedEuros(219_450))).toBe('+2 194,50 €')
    expect(plain(formatSignedEuros(-4_581))).toBe('-45,81 €')
    expect(plain(formatSignedEuros(0))).toBe('0,00 €')
  })

  it('formats ratios as signed percentages', () => {
    expect(plain(formatSignedPercent(0.2878))).toBe('+28,8 %')
    expect(plain(formatSignedPercent(-0.1309))).toBe('-13,1 %')
  })

  it('formats grams with two decimals', () => {
    expect(plain(formatGrams(104.3))).toBe('104,30 g')
  })

  it('formats calendar dates without time zone shifts', () => {
    expect(formatDate('2026-11-09')).toBe('09/11/2026')
    expect(formatMonth('2024-02-20')).toBe('févr. 24')
  })

  it('elides "de" before a vowel or a silent h', () => {
    expect(ofName('Clément')).toBe('de Clément')
    expect(ofName('Alice')).toBe("d'Alice")
    expect(ofName('Éric')).toBe("d'Éric")
  })
})
