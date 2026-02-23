import { describe, it, expect } from 'vitest'
import {
  HOUSEHOLD_CLASSIFICATIONS,
  autoClassifyHousehold,
  getClassificationDetails,
  getClassificationSummary,
  hasClassification,
} from '../householdClassification'

describe('HOUSEHOLD_CLASSIFICATIONS', () => {
  it('has unique keys', () => {
    const keys = HOUSEHOLD_CLASSIFICATIONS.map(c => c.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('each classification has required properties', () => {
    for (const c of HOUSEHOLD_CLASSIFICATIONS) {
      expect(c).toHaveProperty('key')
      expect(c).toHaveProperty('label')
      expect(c).toHaveProperty('icon')
      expect(c).toHaveProperty('priority')
      expect(typeof c.autoDetect).toBe('function')
    }
  })
})

describe('autoClassifyHousehold', () => {
  it('detects 4Ps household', () => {
    const head = { civil_status: 'Married' }
    const members = [{ is_4ps_member: true, birthdate: '2000-01-01' }]
    const keys = autoClassifyHousehold(head, members)
    expect(keys).toContain('4ps')
  })

  it('detects 4Ps with string "Yes" value', () => {
    const head = { civil_status: 'Married' }
    const members = [{ is_4ps_member: 'Yes', birthdate: '2000-01-01' }]
    const keys = autoClassifyHousehold(head, members)
    expect(keys).toContain('4ps')
  })

  it('detects senior-only household', () => {
    const head = { civil_status: 'Married' }
    const members = [
      { birthdate: '1960-01-01' },
      { birthdate: '1955-01-01' },
    ]
    const keys = autoClassifyHousehold(head, members)
    expect(keys).toContain('senior_only')
  })

  it('does NOT detect senior-only if one member is young', () => {
    const head = { civil_status: 'Married' }
    const members = [
      { birthdate: '1960-01-01' },
      { birthdate: '2000-01-01' },
    ]
    const keys = autoClassifyHousehold(head, members)
    expect(keys).not.toContain('senior_only')
  })

  it('detects pregnant member', () => {
    const head = { civil_status: 'Married' }
    const members = [{ is_pregnant: true, birthdate: '2000-01-01' }]
    const keys = autoClassifyHousehold(head, members)
    expect(keys).toContain('with_pregnant')
  })

  it('detects pregnant via LMP', () => {
    const head = { civil_status: 'Married' }
    const members = [{ lmp: '2025-12-01', birthdate: '2000-01-01' }]
    const keys = autoClassifyHousehold(head, members)
    expect(keys).toContain('with_pregnant')
  })

  it('detects under-five children', () => {
    const head = { civil_status: 'Married' }
    const members = [{ birthdate: '2023-01-01' }]
    const keys = autoClassifyHousehold(head, members)
    expect(keys).toContain('with_under_five')
  })

  it('detects PWD member', () => {
    const head = { civil_status: 'Married' }
    const members = [{ is_pwd: true, birthdate: '2000-01-01' }]
    const keys = autoClassifyHousehold(head, members)
    expect(keys).toContain('with_pwd')
  })

  it('detects single parent', () => {
    const head = { civil_status: 'Single' }
    const members = [{ relationship: 'Son', birthdate: '2020-01-01' }]
    const keys = autoClassifyHousehold(head, members)
    expect(keys).toContain('single_parent')
  })

  it('detects single parent (widowed)', () => {
    const head = { civil_status: 'Widowed' }
    const members = [{ relationship: 'Daughter', birthdate: '2020-01-01' }]
    const keys = autoClassifyHousehold(head, members)
    expect(keys).toContain('single_parent')
  })

  it('does NOT detect single parent for married head', () => {
    const head = { civil_status: 'Married' }
    const members = [{ relationship: 'Son', birthdate: '2020-01-01' }]
    const keys = autoClassifyHousehold(head, members)
    expect(keys).not.toContain('single_parent')
  })

  it('returns empty for empty members', () => {
    const head = { civil_status: 'Single' }
    const keys = autoClassifyHousehold(head, [])
    // senior_only is false for empty, single_parent false (no children)
    expect(keys).not.toContain('senior_only')
    expect(keys).not.toContain('single_parent')
  })

  it('preserves existing manual classifications', () => {
    const head = { civil_status: 'Married' }
    const members = []
    const keys = autoClassifyHousehold(head, members, ['indigent'])
    expect(keys).toContain('indigent')
  })

  it('merges auto and manual without duplicates', () => {
    const head = { civil_status: 'Single' }
    const members = [{ relationship: 'Son', birthdate: '2020-01-01' }]
    const keys = autoClassifyHousehold(head, members, ['single_parent'])
    const count = keys.filter(k => k === 'single_parent').length
    expect(count).toBe(1)
  })
})

describe('getClassificationDetails', () => {
  it('returns details sorted by priority', () => {
    const details = getClassificationDetails(['single_parent', '4ps'])
    expect(details[0].key).toBe('4ps') // priority 1
    expect(details[1].key).toBe('single_parent') // priority 7
  })

  it('returns empty for empty keys', () => {
    expect(getClassificationDetails([])).toEqual([])
  })
})

describe('getClassificationSummary', () => {
  it('counts classifications across households', () => {
    const households = [
      { classifications: ['4ps', 'with_under_five'] },
      { classifications: ['4ps'] },
      { classifications: [] },
    ]
    const summary = getClassificationSummary(households)
    const fourPs = summary.find(s => s.key === '4ps')
    expect(fourPs.count).toBe(2)
    const under5 = summary.find(s => s.key === 'with_under_five')
    expect(under5.count).toBe(1)
  })

  it('excludes "other" from summary', () => {
    const summary = getClassificationSummary([])
    expect(summary.find(s => s.key === 'other')).toBeUndefined()
  })
})

describe('hasClassification', () => {
  it('returns true when household has classification', () => {
    expect(hasClassification({ classifications: ['4ps', 'indigent'] }, '4ps')).toBe(true)
  })

  it('returns false when household lacks classification', () => {
    expect(hasClassification({ classifications: ['4ps'] }, 'indigent')).toBe(false)
  })

  it('returns false when no classifications array', () => {
    expect(hasClassification({}, 'anything')).toBe(false)
  })
})
