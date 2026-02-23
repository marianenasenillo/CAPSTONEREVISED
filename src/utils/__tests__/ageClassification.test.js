import { describe, it, expect } from 'vitest'
import {
  calculateAge,
  classifyAge,
  getAgeGroupLabel,
  getAgeGroupKey,
  classifyMembers,
  getAgeDistribution,
  enrichMemberWithAge,
  enrichMembersWithAge,
  AGE_CATEGORIES,
} from '../ageClassification'

// Use a fixed reference date to keep tests deterministic
const REF = new Date('2026-02-24')

describe('calculateAge', () => {
  it('returns null for falsy birthdate', () => {
    expect(calculateAge(null)).toBe(null)
    expect(calculateAge(undefined)).toBe(null)
    expect(calculateAge('')).toBe(null)
  })

  it('returns null for invalid date string', () => {
    expect(calculateAge('not-a-date')).toBe(null)
  })

  it('calculates age correctly before birthday this year', () => {
    // Born 2000-06-15 → on 2026-02-24 hasn't had birthday yet → 25
    expect(calculateAge('2000-06-15', REF)).toBe(25)
  })

  it('calculates age correctly after birthday this year', () => {
    // Born 2000-01-01 → on 2026-02-24 already had birthday → 26
    expect(calculateAge('2000-01-01', REF)).toBe(26)
  })

  it('calculates age on exact birthday', () => {
    expect(calculateAge('2000-02-24', REF)).toBe(26)
  })

  it('returns age 0 for newborn', () => {
    expect(calculateAge('2026-01-01', REF)).toBe(0)
  })

  it('returns 0 (not negative) when birthdate is in the future', () => {
    expect(calculateAge('2027-01-01', REF)).toBe(0)
  })

  it('handles leap year birthdate (Feb 29)', () => {
    // Born 2000-02-29, ref 2026-02-24 → hasn't had birthday → 25
    expect(calculateAge('2000-02-29', REF)).toBe(25)
  })
})

describe('classifyAge', () => {
  it('returns null for null birthdate', () => {
    expect(classifyAge(null)).toBe(null)
  })

  it('classifies infant (0 years)', () => {
    const result = classifyAge('2026-01-01', REF)
    expect(result.key).toBe('infant')
    expect(result.age).toBe(0)
  })

  it('classifies under-five (1-4)', () => {
    const result = classifyAge('2023-01-01', REF)
    expect(result.key).toBe('under_five')
    expect(result.age).toBe(3)
  })

  it('classifies young children (5-9)', () => {
    const result = classifyAge('2019-01-01', REF)
    expect(result.key).toBe('young_children')
    expect(result.age).toBe(7)
  })

  it('classifies early adolescents (10-14)', () => {
    const result = classifyAge('2014-01-01', REF)
    expect(result.key).toBe('early_adolescents')
    expect(result.age).toBe(12)
  })

  it('classifies adolescents (15-19)', () => {
    const result = classifyAge('2009-01-01', REF)
    expect(result.key).toBe('adolescents')
    expect(result.age).toBe(17)
  })

  it('classifies adults (20-59)', () => {
    const result = classifyAge('2000-01-01', REF)
    expect(result.key).toBe('adults')
    expect(result.age).toBe(26)
  })

  it('classifies seniors (60+)', () => {
    const result = classifyAge('1960-01-01', REF)
    expect(result.key).toBe('senior')
    expect(result.age).toBe(66)
  })
})

describe('getAgeGroupLabel', () => {
  it('returns "Unknown" for null birthdate', () => {
    expect(getAgeGroupLabel(null)).toBe('Unknown')
  })

  it('returns correct label for valid birthdate', () => {
    expect(getAgeGroupLabel('2000-01-01')).toBe('Adults')
  })
})

describe('getAgeGroupKey', () => {
  it('returns "unknown" for null birthdate', () => {
    expect(getAgeGroupKey(null)).toBe('unknown')
  })

  it('returns correct key for valid birthdate', () => {
    expect(getAgeGroupKey('2000-01-01')).toBe('adults')
  })
})

describe('classifyMembers', () => {
  it('distributes members into correct age groups', () => {
    const members = [
      { birthdate: '2026-01-01' }, // infant
      { birthdate: '2023-01-01' }, // under_five
      { birthdate: '2000-01-01' }, // adults
      { birthdate: null },          // unknown
    ]
    const dist = classifyMembers(members)
    expect(dist.infant.length).toBe(1)
    expect(dist.under_five.length).toBe(1)
    expect(dist.adults.length).toBe(1)
    expect(dist.unknown.length).toBe(1)
  })

  it('returns empty arrays for empty input', () => {
    const dist = classifyMembers([])
    for (const cat of AGE_CATEGORIES) {
      expect(dist[cat.key]).toEqual([])
    }
    expect(dist.unknown).toEqual([])
  })
})

describe('getAgeDistribution', () => {
  it('returns distribution with count for each category', () => {
    const members = [
      { birthdate: '2026-01-01' },
      { birthdate: '2000-01-01' },
    ]
    const dist = getAgeDistribution(members)
    expect(dist).toHaveLength(AGE_CATEGORIES.length)
    const infant = dist.find(d => d.key === 'infant')
    expect(infant.count).toBe(1)
  })
})

describe('enrichMemberWithAge', () => {
  it('returns member unchanged if no birthdate', () => {
    const m = { firstname: 'Test' }
    expect(enrichMemberWithAge(m)).toEqual(m)
  })

  it('adds age and age_group to member', () => {
    const m = { firstname: 'Test', birthdate: '2000-01-01' }
    const enriched = enrichMemberWithAge(m)
    expect(enriched.age).toBeTypeOf('number')
    expect(enriched.age_group).toBeTypeOf('string')
    expect(enriched.firstname).toBe('Test')
  })
})

describe('enrichMembersWithAge', () => {
  it('enriches all members in array', () => {
    const members = [
      { birthdate: '2000-01-01' },
      { birthdate: null },
    ]
    const enriched = enrichMembersWithAge(members)
    expect(enriched[0].age).toBeTypeOf('number')
    expect(enriched[1].age).toBeUndefined()
  })
})

describe('AGE_CATEGORIES coverage', () => {
  it('has no gaps in age ranges', () => {
    // Verify categories cover 0 to Infinity with no gaps
    const sorted = [...AGE_CATEGORIES].sort((a, b) => a.min - b.min)
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i + 1].min).toBe(sorted[i].max + 1)
    }
    expect(sorted[sorted.length - 1].max).toBe(Infinity)
  })
})
