import { describe, it, expect } from 'vitest'
import { SERVICE_ELIGIBILITY_RULES } from '../serviceEligibility'
import { calculateAge } from '../ageClassification'

/**
 * Tests that validate the enrollment payload logic
 * from ServiceEligibility.vue's buildEnrollPayload() function.
 * We replicate the payload-building logic here to test it in isolation.
 *
 * The Vue component's buildEnrollPayload(member, rule) takes a member object
 * (with _age pre-computed) and a rule from SERVICE_ELIGIBILITY_RULES,
 * plus reads extra fields from a reactive enrollFormData object.
 * We simulate enrollFormData as a plain object parameter.
 */

// Mirrors the ENROLL_FIELDS config from ServiceEligibility.vue
const ENROLL_FIELDS = {
  childcare_vitamina_records: [
    { key: 'mother_name', label: "Mother's Name", type: 'text' },
  ],
  deworming_records: [
    { key: 'mother_name', label: "Mother's Name", type: 'text', showIf: (m) => m._age != null && m._age < 18 },
  ],
  wra_records: [
    { key: 'se_status', label: 'SE Status', type: 'select', options: ['P', 'NP'] },
    { key: 'plano_manganak', label: 'Plano Manganak', type: 'text' },
    { key: 'karun', label: 'Karun', type: 'checkbox' },
    { key: 'spacing', label: 'Spacing', type: 'checkbox' },
    { key: 'limiting', label: 'Limiting', type: 'checkbox' },
    { key: 'fecund', label: 'Fecund', type: 'checkbox' },
    { key: 'infecund', label: 'Infecund', type: 'checkbox' },
    { key: 'fb_method', label: 'FB Method', type: 'text' },
    { key: 'fb_type', label: 'FB Type', type: 'text' },
    { key: 'fb_date', label: 'FB Date', type: 'date' },
    { key: 'change_method', label: 'Change Method', type: 'text' },
  ],
  cervical_screening_records: [
    { key: 'screened', label: 'Screened', type: 'select', options: ['Yes', 'No'] },
  ],
}

// Mirrors getEnrollFields from ServiceEligibility.vue
function getEnrollFields(table, member) {
  const fields = ENROLL_FIELDS[table] || []
  return fields.filter(f => !f.showIf || f.showIf(member))
}

// Mirrors buildEnrollPayload from ServiceEligibility.vue
function buildEnrollPayload(member, rule, enrollFormData = {}) {
  const base = {
    purok: member.purok || '',
    lastname: member.lastname || '',
    firstname: member.firstname || '',
    middlename: member.middlename || '',
    suffix: member.suffix || '',
    age: member._age,
    birthdate: member.birthdate || null,
  }

  if (rule.table === 'childcare_vitamina_records') {
    return { ...base, gender: member.sex || '', mother_name: enrollFormData.mother_name || '' }
  }
  if (rule.table === 'deworming_records') {
    return {
      purok: member.purok || '',
      lastname: member.lastname || '',
      firstname: member.firstname || '',
      middlename: member.middlename || '',
      age: member._age,
      sex: member.sex || null,
      birthday: member.birthdate || null,
      mother_name: enrollFormData.mother_name || null,
    }
  }
  if (rule.table === 'wra_records') {
    return {
      ...base,
      civil_status: member.civil_status || '',
      se_status: enrollFormData.se_status || '',
      plano_manganak: enrollFormData.plano_manganak || '',
      karun: enrollFormData.karun || false,
      spacing: enrollFormData.spacing || false,
      limiting: enrollFormData.limiting || false,
      fecund: enrollFormData.fecund || false,
      infecund: enrollFormData.infecund || false,
      fb_method: enrollFormData.fb_method || '',
      fb_type: enrollFormData.fb_type || '',
      fb_date: enrollFormData.fb_date || null,
      change_method: enrollFormData.change_method || '',
    }
  }
  if (rule.table === 'cervical_screening_records') {
    return { ...base, screened: enrollFormData.screened || '' }
  }
  return base
}

// Mirrors the enrollment form initialization from openEnrollModal
function initEnrollFormData(rule) {
  const formData = {}
  const fields = ENROLL_FIELDS[rule.table] || []
  for (const f of fields) {
    formData[f.key] = f.type === 'checkbox' ? false : ''
  }
  return formData
}

function makeMember(overrides = {}) {
  const m = {
    firstname: 'Maria',
    lastname: 'Cruz',
    middlename: 'D',
    suffix: '',
    purok: 'Purok 1',
    sex: 'Female',
    birthdate: '2001-01-15',
    civil_status: 'Married',
    lmp: null,
    is_pregnant: false,
    ...overrides,
  }
  m._age = m.birthdate ? calculateAge(m.birthdate) : null
  return m
}

function ruleFor(key) {
  return SERVICE_ELIGIBILITY_RULES.find(r => r.key === key)
}

// ─── ENROLL_FIELDS config tests ───

describe('ENROLL_FIELDS configuration', () => {
  it('covers all unique service tables from rules', () => {
    const ruleTables = new Set(SERVICE_ELIGIBILITY_RULES.map(r => r.table))
    for (const table of ruleTables) {
      expect(ENROLL_FIELDS).toHaveProperty(table)
    }
  })

  it('each field has key, label, and type', () => {
    for (const [, fields] of Object.entries(ENROLL_FIELDS)) {
      for (const f of fields) {
        expect(f).toHaveProperty('key')
        expect(f).toHaveProperty('label')
        expect(f).toHaveProperty('type')
        expect(['text', 'date', 'select', 'checkbox']).toContain(f.type)
      }
    }
  })

  it('select fields have options array', () => {
    for (const [, fields] of Object.entries(ENROLL_FIELDS)) {
      for (const f of fields) {
        if (f.type === 'select') {
          expect(Array.isArray(f.options)).toBe(true)
          expect(f.options.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('field keys are unique within each table', () => {
    for (const [, fields] of Object.entries(ENROLL_FIELDS)) {
      const keys = fields.map(f => f.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })
})

// ─── getEnrollFields tests ───

describe('getEnrollFields', () => {
  it('returns all fields for childcare (no showIf)', () => {
    const member = makeMember()
    const fields = getEnrollFields('childcare_vitamina_records', member)
    expect(fields).toHaveLength(1)
    expect(fields[0].key).toBe('mother_name')
  })

  it('returns mother_name for deworming when member is a child (age < 18)', () => {
    const child = makeMember({ birthdate: '2015-01-01' })
    const fields = getEnrollFields('deworming_records', child)
    expect(fields.map(f => f.key)).toContain('mother_name')
  })

  it('hides mother_name for deworming when member is adult (age >= 18)', () => {
    const adult = makeMember({ birthdate: '2000-01-01' })
    const fields = getEnrollFields('deworming_records', adult)
    expect(fields.map(f => f.key)).not.toContain('mother_name')
  })

  it('returns all 11 fields for wra_records', () => {
    const member = makeMember()
    const fields = getEnrollFields('wra_records', member)
    expect(fields).toHaveLength(11)
  })

  it('returns screened field for cervical_screening_records', () => {
    const member = makeMember()
    const fields = getEnrollFields('cervical_screening_records', member)
    expect(fields).toHaveLength(1)
    expect(fields[0].key).toBe('screened')
  })

  it('returns empty array for unknown table', () => {
    expect(getEnrollFields('unknown_table', makeMember())).toEqual([])
  })
})

// ─── initEnrollFormData tests ───

describe('initEnrollFormData', () => {
  it('initializes checkbox fields to false', () => {
    const rule = ruleFor('wra')
    const formData = initEnrollFormData(rule)
    expect(formData.karun).toBe(false)
    expect(formData.spacing).toBe(false)
    expect(formData.limiting).toBe(false)
    expect(formData.fecund).toBe(false)
    expect(formData.infecund).toBe(false)
  })

  it('initializes text/select/date fields to empty string', () => {
    const rule = ruleFor('wra')
    const formData = initEnrollFormData(rule)
    expect(formData.se_status).toBe('')
    expect(formData.plano_manganak).toBe('')
    expect(formData.fb_method).toBe('')
    expect(formData.fb_date).toBe('')
  })

  it('initializes childcare form with mother_name', () => {
    const rule = ruleFor('vitamin_a')
    const formData = initEnrollFormData(rule)
    expect(formData).toEqual({ mother_name: '' })
  })

  it('initializes cervical form with screened', () => {
    const rule = ruleFor('cervical_screening')
    const formData = initEnrollFormData(rule)
    expect(formData).toEqual({ screened: '' })
  })
})

// ─── buildEnrollPayload tests ───

describe('Enrollment Payload: base fields', () => {
  it('includes purok, lastname, firstname, middlename, suffix, age, birthdate', () => {
    const member = makeMember()
    const rule = ruleFor('vitamin_a')
    const payload = buildEnrollPayload(member, rule)
    expect(payload.purok).toBe('Purok 1')
    expect(payload.lastname).toBe('Cruz')
    expect(payload.firstname).toBe('Maria')
    expect(payload.middlename).toBe('D')
    expect(payload.suffix).toBe('')
    expect(payload.age).toBe(member._age)
    expect(payload.birthdate).toBe('2001-01-15')
  })

  it('defaults missing fields to empty strings or null', () => {
    const member = makeMember({ purok: undefined, lastname: undefined, middlename: undefined, suffix: undefined, birthdate: null })
    const rule = ruleFor('vitamin_a')
    const payload = buildEnrollPayload(member, rule)
    expect(payload.purok).toBe('')
    expect(payload.lastname).toBe('')
    expect(payload.middlename).toBe('')
    expect(payload.suffix).toBe('')
    expect(payload.birthdate).toBe(null)
  })
})

describe('Enrollment Payload: childcare_vitamina_records', () => {
  it('uses gender field with raw sex value', () => {
    const member = makeMember({ sex: 'Female' })
    const rule = ruleFor('vitamin_a')
    const payload = buildEnrollPayload(member, rule)
    expect(payload.gender).toBe('Female')
    expect(payload).not.toHaveProperty('sex')
  })

  it('includes mother_name from form data', () => {
    const member = makeMember()
    const rule = ruleFor('vitamin_a')
    const payload = buildEnrollPayload(member, rule, { mother_name: 'Ana Cruz' })
    expect(payload.mother_name).toBe('Ana Cruz')
  })

  it('defaults mother_name to empty string when not provided', () => {
    const member = makeMember()
    const rule = ruleFor('vitamin_a')
    const payload = buildEnrollPayload(member, rule, {})
    expect(payload.mother_name).toBe('')
  })

  it('does not include deworming or wra fields', () => {
    const member = makeMember()
    const rule = ruleFor('vitamin_a')
    const payload = buildEnrollPayload(member, rule)
    expect(payload).not.toHaveProperty('civil_status')
    expect(payload).not.toHaveProperty('se_status')
    expect(payload).not.toHaveProperty('screened')
    expect(payload).not.toHaveProperty('birthday')
  })
})

describe('Enrollment Payload: deworming_records', () => {
  it('uses sex field (not gender)', () => {
    const member = makeMember({ sex: 'Male' })
    const rule = ruleFor('deworming_child')
    const payload = buildEnrollPayload(member, rule)
    expect(payload.sex).toBe('Male')
    expect(payload).not.toHaveProperty('gender')
  })

  it('uses birthday field (not birthdate)', () => {
    const member = makeMember({ birthdate: '2015-06-01' })
    const rule = ruleFor('deworming_child')
    const payload = buildEnrollPayload(member, rule)
    expect(payload.birthday).toBe('2015-06-01')
    expect(payload).not.toHaveProperty('birthdate')
  })

  it('does not include suffix', () => {
    const member = makeMember({ suffix: 'Jr' })
    const rule = ruleFor('deworming_child')
    const payload = buildEnrollPayload(member, rule)
    expect(payload).not.toHaveProperty('suffix')
  })

  it('includes mother_name from form data (null default)', () => {
    const member = makeMember()
    const rule = ruleFor('deworming_child')
    const payload = buildEnrollPayload(member, rule, {})
    expect(payload.mother_name).toBe(null)
  })

  it('passes mother_name when provided', () => {
    const member = makeMember()
    const rule = ruleFor('deworming_child')
    const payload = buildEnrollPayload(member, rule, { mother_name: 'Test Mom' })
    expect(payload.mother_name).toBe('Test Mom')
  })

  it('sex defaults to null when missing', () => {
    const member = makeMember({ sex: '' })
    const rule = ruleFor('deworming_child')
    const payload = buildEnrollPayload(member, rule)
    expect(payload.sex).toBe(null)
  })
})

describe('Enrollment Payload: wra_records', () => {
  it('includes civil_status from member', () => {
    const member = makeMember({ civil_status: 'Single' })
    const rule = ruleFor('wra')
    const payload = buildEnrollPayload(member, rule)
    expect(payload.civil_status).toBe('Single')
  })

  it('includes all WRA-specific form fields', () => {
    const formData = {
      se_status: 'P',
      plano_manganak: 'Yes',
      karun: true,
      spacing: true,
      limiting: false,
      fecund: true,
      infecund: false,
      fb_method: 'pills',
      fb_type: 'modern',
      fb_date: '2026-01-15',
      change_method: 'switch',
    }
    const member = makeMember()
    const rule = ruleFor('wra')
    const payload = buildEnrollPayload(member, rule, formData)
    expect(payload.se_status).toBe('P')
    expect(payload.plano_manganak).toBe('Yes')
    expect(payload.karun).toBe(true)
    expect(payload.spacing).toBe(true)
    expect(payload.limiting).toBe(false)
    expect(payload.fecund).toBe(true)
    expect(payload.infecund).toBe(false)
    expect(payload.fb_method).toBe('pills')
    expect(payload.fb_type).toBe('modern')
    expect(payload.fb_date).toBe('2026-01-15')
    expect(payload.change_method).toBe('switch')
  })

  it('defaults empty form to false/empty strings/null', () => {
    const member = makeMember()
    const rule = ruleFor('wra')
    const payload = buildEnrollPayload(member, rule, {})
    expect(payload.se_status).toBe('')
    expect(payload.karun).toBe(false)
    expect(payload.fb_date).toBe(null)
    expect(payload.fb_method).toBe('')
  })

  it('does not include gender or screened', () => {
    const member = makeMember()
    const rule = ruleFor('wra')
    const payload = buildEnrollPayload(member, rule)
    expect(payload).not.toHaveProperty('gender')
    expect(payload).not.toHaveProperty('screened')
    expect(payload).not.toHaveProperty('birthday')
  })
})

describe('Enrollment Payload: cervical_screening_records', () => {
  it('includes screened from form data', () => {
    const member = makeMember()
    const rule = ruleFor('cervical_screening')
    const payload = buildEnrollPayload(member, rule, { screened: 'Yes' })
    expect(payload.screened).toBe('Yes')
  })

  it('defaults screened to empty string', () => {
    const member = makeMember()
    const rule = ruleFor('cervical_screening')
    const payload = buildEnrollPayload(member, rule, {})
    expect(payload.screened).toBe('')
  })

  it('does not include wra-specific fields', () => {
    const member = makeMember()
    const rule = ruleFor('cervical_screening')
    const payload = buildEnrollPayload(member, rule)
    expect(payload).not.toHaveProperty('civil_status')
    expect(payload).not.toHaveProperty('se_status')
    expect(payload).not.toHaveProperty('gender')
  })
})

// ─── Table mapping coverage ───

describe('Payload table mapping matches all rules', () => {
  it('every rule table produces a non-empty payload', () => {
    const member = makeMember()
    for (const rule of SERVICE_ELIGIBILITY_RULES) {
      const payload = buildEnrollPayload(member, rule)
      expect(Object.keys(payload).length).toBeGreaterThan(0)
    }
  })

  it('every ENROLL_FIELDS key is consumed by buildEnrollPayload for that table', () => {
    const member = makeMember({ birthdate: '2015-01-01' }) // child for showIf
    for (const [table, fields] of Object.entries(ENROLL_FIELDS)) {
      const rule = SERVICE_ELIGIBILITY_RULES.find(r => r.table === table)
      if (!rule) continue
      const formData = {}
      for (const f of fields) {
        formData[f.key] = f.type === 'checkbox' ? true : 'test_value'
      }
      const payload = buildEnrollPayload(member, rule, formData)
      for (const f of fields) {
        expect(payload).toHaveProperty(f.key)
      }
    }
  })
})

// ─── Edge cases ───

describe('Edge cases', () => {
  it('handles null birthdate gracefully', () => {
    const member = makeMember({ birthdate: null })
    const rule = ruleFor('vitamin_a')
    const payload = buildEnrollPayload(member, rule)
    expect(payload.birthdate).toBe(null)
    expect(payload.age).toBe(null)
  })

  it('handles empty string birthdate', () => {
    const member = makeMember({ birthdate: '' })
    const rule = ruleFor('deworming_child')
    const payload = buildEnrollPayload(member, rule)
    expect(payload.birthday).toBe(null)
    expect(payload).not.toHaveProperty('birthdate')
  })

  it('handles member with no optional fields', () => {
    const member = {
      firstname: 'Test',
      lastname: 'User',
      birthdate: '2020-01-01',
      _age: 6,
    }
    const rule = ruleFor('vitamin_a')
    const payload = buildEnrollPayload(member, rule)
    expect(payload.firstname).toBe('Test')
    expect(payload.lastname).toBe('User')
    expect(payload.middlename).toBe('')
    expect(payload.suffix).toBe('')
    expect(payload.purok).toBe('')
  })

  it('handles unknown table by returning base payload only', () => {
    const member = makeMember()
    const fakeRule = { table: 'nonexistent_table' }
    const payload = buildEnrollPayload(member, fakeRule)
    expect(payload).toHaveProperty('firstname')
    expect(payload).toHaveProperty('lastname')
    expect(payload).not.toHaveProperty('gender')
    expect(payload).not.toHaveProperty('screened')
  })

  it('whitespace-only member fields default properly', () => {
    const member = makeMember({ sex: '   ' })
    const rule = ruleFor('deworming_child')
    const payload = buildEnrollPayload(member, rule)
    expect(payload.sex).toBe('   ')
  })
})
