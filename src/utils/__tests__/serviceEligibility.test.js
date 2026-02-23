import { describe, it, expect } from 'vitest'
import {
  SERVICE_ELIGIBILITY_RULES,
  getEligibleServices,
  isEligibleFor,
  getEligibleMembersForService,
  generateEligibilityReport,
  getServiceSummary,
} from '../serviceEligibility'

// Helper: create a member with a birthdate that yields a specific age on 2026-02-24
function makeMember(overrides = {}) {
  return {
    firstname: 'Test',
    lastname: 'Member',
    sex: 'Female',
    civil_status: 'Married',
    birthdate: '2000-01-01', // age 26
    lmp: null,
    is_pregnant: false,
    purok: 'Purok 1',
    ...overrides,
  }
}

describe('SERVICE_ELIGIBILITY_RULES', () => {
  it('has unique keys', () => {
    const keys = SERVICE_ELIGIBILITY_RULES.map(r => r.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('each rule has required properties', () => {
    for (const rule of SERVICE_ELIGIBILITY_RULES) {
      expect(rule).toHaveProperty('key')
      expect(rule).toHaveProperty('label')
      expect(rule).toHaveProperty('table')
      expect(rule).toHaveProperty('route')
      expect(rule).toHaveProperty('ageMin')
      expect(rule).toHaveProperty('ageMax')
      expect(typeof rule.ageMin).toBe('number')
      expect(typeof rule.ageMax).toBe('number')
      expect(rule.ageMax).toBeGreaterThanOrEqual(rule.ageMin)
    }
  })

  it('all tables are valid known tables', () => {
    const validTables = [
      'childcare_vitamina_records',
      'deworming_records',
      'wra_records',
      'cervical_screening_records',
      'family_planning_records',
    ]
    for (const rule of SERVICE_ELIGIBILITY_RULES) {
      expect(validTables).toContain(rule.table)
    }
  })
})

describe('getEligibleServices', () => {
  it('returns empty array for null member', () => {
    expect(getEligibleServices(null)).toEqual([])
  })

  it('returns empty array for member without birthdate', () => {
    expect(getEligibleServices({ sex: 'Female' })).toEqual([])
  })

  it('returns empty array for member with invalid birthdate', () => {
    expect(getEligibleServices({ birthdate: 'invalid' })).toEqual([])
  })

  it('returns immunization/growth_monitoring/vitamin_a for infant (0 yrs)', () => {
    const member = makeMember({ birthdate: '2025-06-01', sex: 'Male', civil_status: '' })
    const services = getEligibleServices(member)
    const keys = services.map(s => s.key)
    expect(keys).toContain('immunization')
    expect(keys).toContain('growth_monitoring')
    expect(keys).toContain('vitamin_a')
    expect(keys).not.toContain('deworming_child')
  })

  it('returns deworming_child for child aged 1-14', () => {
    const member = makeMember({ birthdate: '2016-01-01', sex: 'Male', civil_status: '' })
    const services = getEligibleServices(member)
    const keys = services.map(s => s.key)
    expect(keys).toContain('deworming_child')
  })

  it('returns school_health for child aged 5-14', () => {
    const member = makeMember({ birthdate: '2016-01-01', sex: 'Male', civil_status: '' })
    const services = getEligibleServices(member)
    const keys = services.map(s => s.key)
    expect(keys).toContain('school_health')
  })

  it('returns WRA for female aged 15-49', () => {
    const member = makeMember({ birthdate: '2000-01-01', sex: 'Female', civil_status: '' })
    const services = getEligibleServices(member)
    const keys = services.map(s => s.key)
    expect(keys).toContain('wra')
  })

  it('does NOT return WRA for male', () => {
    const member = makeMember({ birthdate: '2000-01-01', sex: 'Male', civil_status: '' })
    const services = getEligibleServices(member)
    const keys = services.map(s => s.key)
    expect(keys).not.toContain('wra')
  })

  it('returns cervical_screening for female aged 25-65', () => {
    const member = makeMember({ birthdate: '2000-01-01', sex: 'Female' })
    const services = getEligibleServices(member)
    const keys = services.map(s => s.key)
    expect(keys).toContain('cervical_screening')
  })

  it('does NOT return cervical_screening for female aged 20 (too young)', () => {
    const member = makeMember({ birthdate: '2006-01-01', sex: 'Female' })
    const services = getEligibleServices(member)
    const keys = services.map(s => s.key)
    expect(keys).not.toContain('cervical_screening')
  })

  it('returns family_planning only for Married/Live-in, aged 15-49', () => {
    const married = makeMember({ birthdate: '2000-01-01', sex: 'Male', civil_status: 'Married' })
    expect(getEligibleServices(married).map(s => s.key)).toContain('family_planning')

    const livein = makeMember({ birthdate: '2000-01-01', sex: 'Male', civil_status: 'Live-in' })
    expect(getEligibleServices(livein).map(s => s.key)).toContain('family_planning')

    const single = makeMember({ birthdate: '2000-01-01', sex: 'Male', civil_status: 'Single' })
    expect(getEligibleServices(single).map(s => s.key)).not.toContain('family_planning')
  })

  it('returns maternal_care only for pregnant/LMP females', () => {
    const notPregnant = makeMember({ birthdate: '2000-01-01', is_pregnant: false, lmp: null })
    expect(getEligibleServices(notPregnant).map(s => s.key)).not.toContain('maternal_care')

    const pregnant = makeMember({ birthdate: '2000-01-01', is_pregnant: true })
    expect(getEligibleServices(pregnant).map(s => s.key)).toContain('maternal_care')

    const withLmp = makeMember({ birthdate: '2000-01-01', lmp: '2025-12-01' })
    expect(getEligibleServices(withLmp).map(s => s.key)).toContain('maternal_care')
  })

  it('returns preventive_health for adults 20+', () => {
    const member = makeMember({ birthdate: '2000-01-01', sex: 'Male', civil_status: '' })
    const services = getEligibleServices(member)
    expect(services.map(s => s.key)).toContain('preventive_health')
  })

  it('returns senior_health for 60+', () => {
    const member = makeMember({ birthdate: '1960-01-01', sex: 'Male', civil_status: '' })
    const services = getEligibleServices(member)
    expect(services.map(s => s.key)).toContain('senior_health')
  })

  it('does NOT return senior_health for non-senior', () => {
    const member = makeMember({ birthdate: '2000-01-01', sex: 'Male', civil_status: '' })
    expect(getEligibleServices(member).map(s => s.key)).not.toContain('senior_health')
  })

  it('sex comparison is case-insensitive', () => {
    const member = makeMember({ birthdate: '2000-01-01', sex: 'female' })
    expect(getEligibleServices(member).map(s => s.key)).toContain('wra')
  })

  it('sex shorthand "F" matches Female rules', () => {
    const member = makeMember({ birthdate: '2000-01-01', sex: 'F' })
    expect(getEligibleServices(member).map(s => s.key)).toContain('wra')
    expect(getEligibleServices(member).map(s => s.key)).toContain('cervical_screening')
  })

  it('sex shorthand "M" excludes Female-only rules', () => {
    const member = makeMember({ birthdate: '2000-01-01', sex: 'M' })
    expect(getEligibleServices(member).map(s => s.key)).not.toContain('wra')
    expect(getEligibleServices(member).map(s => s.key)).not.toContain('cervical_screening')
  })

  it('civil_status comparison is case-insensitive', () => {
    const member = makeMember({ birthdate: '2000-01-01', sex: 'Male', civil_status: 'married' })
    expect(getEligibleServices(member).map(s => s.key)).toContain('family_planning')
  })
})

describe('isEligibleFor', () => {
  it('returns true when member is eligible', () => {
    const member = makeMember({ birthdate: '2000-01-01', sex: 'Female' })
    expect(isEligibleFor(member, 'wra')).toBe(true)
  })

  it('returns false when member is NOT eligible', () => {
    const member = makeMember({ birthdate: '2000-01-01', sex: 'Male', civil_status: '' })
    expect(isEligibleFor(member, 'wra')).toBe(false)
  })
})

describe('getEligibleMembersForService', () => {
  it('filters members by service eligibility', () => {
    const members = [
      makeMember({ birthdate: '2000-01-01', sex: 'Female', firstname: 'Maria' }),
      makeMember({ birthdate: '2000-01-01', sex: 'Male', firstname: 'Juan', civil_status: '' }),
    ]
    const eligible = getEligibleMembersForService(members, 'wra')
    expect(eligible).toHaveLength(1)
    expect(eligible[0].firstname).toBe('Maria')
    expect(eligible[0]._age).toBeTypeOf('number')
  })
})

describe('generateEligibilityReport', () => {
  it('returns report with count for each rule', () => {
    const members = [
      makeMember({ birthdate: '2000-01-01', sex: 'Female' }),
    ]
    const report = generateEligibilityReport(members)
    for (const rule of SERVICE_ELIGIBILITY_RULES) {
      expect(report[rule.key]).toHaveProperty('count')
      expect(report[rule.key]).toHaveProperty('members')
      expect(report[rule.key]).toHaveProperty('rule')
    }
  })
})

describe('getServiceSummary', () => {
  it('returns summary with all rules', () => {
    const summary = getServiceSummary([])
    expect(summary).toHaveLength(SERVICE_ELIGIBILITY_RULES.length)
    for (const s of summary) {
      expect(s.count).toBe(0)
    }
  })

  it('counts eligible members correctly', () => {
    const members = [
      makeMember({ birthdate: '2000-01-01', sex: 'Female', is_pregnant: true }),
    ]
    const summary = getServiceSummary(members)
    const wra = summary.find(s => s.key === 'wra')
    expect(wra.count).toBe(1)
    const maternal = summary.find(s => s.key === 'maternal_care')
    expect(maternal.count).toBe(1)
  })
})

describe('Edge cases from screenshot (heads with missing data)', () => {
  it('returns no services for head with null birthdate, null sex', () => {
    const head = makeMember({
      birthdate: null,
      age: null,
      sex: null,
      civil_status: 'Single',
      purok: 'Purok 4',
      _isHead: true,
    })
    const services = getEligibleServices(head)
    expect(services).toEqual([])
  })

  it('returns correct services when head has birthdate and sex', () => {
    // Simulates a head like "Senillo, Jascel" (25 Female Purok 1)
    const head = makeMember({
      birthdate: '2001-01-01', // 25 years old
      sex: 'Female',
      civil_status: 'Single',
      is_pregnant: false,
      lmp: null,
    })
    const services = getEligibleServices(head)
    const keys = services.map(s => s.key)
    expect(keys).toContain('wra')
    expect(keys).toContain('cervical_screening')
    expect(keys).toContain('preventive_health')
    // Should NOT contain maternal_care (not pregnant)
    expect(keys).not.toContain('maternal_care')
  })
})
