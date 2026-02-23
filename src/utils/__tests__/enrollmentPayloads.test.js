import { describe, it, expect } from 'vitest'
import { SERVICE_ELIGIBILITY_RULES } from '../serviceEligibility'

/**
 * Tests that validate the enrollment payload logic
 * from ServiceEligibility.vue's saveEnrollment() function.
 * We replicate the payload-building logic here to test it in isolation.
 */

function buildEnrollmentPayload(table, form) {
  const ageInt = form.age !== '' && form.age != null ? parseInt(form.age) : null

  if (table === 'childcare_vitamina_records') {
    return {
      purok: form.purok,
      lastname: form.lastname,
      firstname: form.firstname,
      middlename: form.middlename,
      suffix: form.suffix,
      age: ageInt,
      birthdate: form.birthdate || null,
      gender: form.sex === 'Male' ? 'M' : form.sex === 'Female' ? 'F' : form.sex,
      mother_name: form.mother_name,
    }
  } else if (table === 'deworming_records') {
    return {
      purok: form.purok,
      lastname: form.lastname,
      firstname: form.firstname,
      middlename: form.middlename,
      sex: form.sex === 'Male' ? 'M' : form.sex === 'Female' ? 'F' : form.sex,
      birthday: form.birthdate || null,
      age: ageInt,
      mother_name: form.mother_name,
    }
  } else if (table === 'wra_records') {
    return {
      purok: form.purok,
      lastname: form.lastname,
      firstname: form.firstname,
      middlename: form.middlename,
      suffix: form.suffix,
      age: ageInt,
      birthdate: form.birthdate || null,
      civil_status: form.civil_status,
      se_status: form.se_status,
      plano_manganak: form.plano_manganak,
      karun: form.karun,
      spacing: form.spacing,
      limiting: form.limiting,
      fecund: form.fecund,
      infecund: form.infecund,
      fb_method: form.fb_method,
      fb_type: form.fb_type,
      fb_date: form.fb_date || null,
      change_method: form.change_method,
    }
  } else if (table === 'cervical_screening_records') {
    return {
      purok: form.purok,
      lastname: form.lastname,
      firstname: form.firstname,
      middlename: form.middlename,
      suffix: form.suffix,
      age: ageInt,
      birthdate: form.birthdate || null,
      screened: form.screened,
    }
  } else if (table === 'family_planning_records') {
    return {
      purok: form.purok,
      surname: form.lastname,
      firstname: form.firstname,
      sex: form.sex === 'Male' ? 'M' : form.sex === 'Female' ? 'F' : form.sex,
      birthday: form.birthdate || null,
      age: ageInt,
      mother_name: form.mother_name,
    }
  }
  return {}
}

const baseForm = {
  firstname: 'Maria',
  lastname: 'Cruz',
  middlename: 'D',
  suffix: '',
  purok: 'Purok 1',
  age: 25,
  sex: 'Female',
  birthdate: '2001-01-15',
  civil_status: 'Married',
  mother_name: '',
  screened: false,
  se_status: '',
  plano_manganak: '',
  karun: false,
  spacing: false,
  limiting: false,
  fecund: false,
  infecund: false,
  fb_method: '',
  fb_type: '',
  fb_date: null,
  change_method: '',
}

describe('Enrollment Payload: childcare_vitamina_records', () => {
  it('maps sex to gender (M/F)', () => {
    const payload = buildEnrollmentPayload('childcare_vitamina_records', { ...baseForm, sex: 'Male' })
    expect(payload.gender).toBe('M')
    expect(payload).not.toHaveProperty('sex')
  })

  it('maps Female to F', () => {
    const payload = buildEnrollmentPayload('childcare_vitamina_records', baseForm)
    expect(payload.gender).toBe('F')
  })

  it('uses "birthdate" field name (not "birthday")', () => {
    const payload = buildEnrollmentPayload('childcare_vitamina_records', baseForm)
    expect(payload).toHaveProperty('birthdate')
    expect(payload).not.toHaveProperty('birthday')
  })

  it('includes mother_name', () => {
    const payload = buildEnrollmentPayload('childcare_vitamina_records', { ...baseForm, mother_name: 'Ana' })
    expect(payload.mother_name).toBe('Ana')
  })

  it('parses age as integer', () => {
    const payload = buildEnrollmentPayload('childcare_vitamina_records', { ...baseForm, age: '3' })
    expect(payload.age).toBe(3)
  })

  it('age is null when empty string', () => {
    const payload = buildEnrollmentPayload('childcare_vitamina_records', { ...baseForm, age: '' })
    expect(payload.age).toBe(null)
  })
})

describe('Enrollment Payload: deworming_records', () => {
  it('uses "birthday" (not "birthdate")', () => {
    const payload = buildEnrollmentPayload('deworming_records', baseForm)
    expect(payload).toHaveProperty('birthday')
    expect(payload).not.toHaveProperty('birthdate')
    expect(payload.birthday).toBe('2001-01-15')
  })

  it('maps sex to M/F short form', () => {
    const payload = buildEnrollmentPayload('deworming_records', { ...baseForm, sex: 'Male' })
    expect(payload.sex).toBe('M')
  })

  it('does NOT include suffix', () => {
    const payload = buildEnrollmentPayload('deworming_records', baseForm)
    expect(payload).not.toHaveProperty('suffix')
  })
})

describe('Enrollment Payload: wra_records', () => {
  it('uses "birthdate" (not "birthday")', () => {
    const payload = buildEnrollmentPayload('wra_records', baseForm)
    expect(payload).toHaveProperty('birthdate')
    expect(payload).not.toHaveProperty('birthday')
  })

  it('includes all WRA-specific fields', () => {
    const payload = buildEnrollmentPayload('wra_records', {
      ...baseForm,
      se_status: 'active',
      karun: true,
      fb_method: 'pills',
    })
    expect(payload.se_status).toBe('active')
    expect(payload.karun).toBe(true)
    expect(payload.fb_method).toBe('pills')
    expect(payload).toHaveProperty('plano_manganak')
    expect(payload).toHaveProperty('spacing')
    expect(payload).toHaveProperty('limiting')
    expect(payload).toHaveProperty('fecund')
    expect(payload).toHaveProperty('infecund')
    expect(payload).toHaveProperty('fb_type')
    expect(payload).toHaveProperty('fb_date')
    expect(payload).toHaveProperty('change_method')
  })

  it('uses lastname (not surname)', () => {
    const payload = buildEnrollmentPayload('wra_records', baseForm)
    expect(payload).toHaveProperty('lastname')
    expect(payload).not.toHaveProperty('surname')
  })
})

describe('Enrollment Payload: cervical_screening_records', () => {
  it('includes screened field', () => {
    const payload = buildEnrollmentPayload('cervical_screening_records', { ...baseForm, screened: true })
    expect(payload.screened).toBe(true)
  })

  it('uses "birthdate" (not "birthday")', () => {
    const payload = buildEnrollmentPayload('cervical_screening_records', baseForm)
    expect(payload).toHaveProperty('birthdate')
    expect(payload).not.toHaveProperty('birthday')
  })
})

describe('Enrollment Payload: family_planning_records', () => {
  it('uses "surname" (not "lastname")', () => {
    const payload = buildEnrollmentPayload('family_planning_records', baseForm)
    expect(payload).toHaveProperty('surname')
    expect(payload.surname).toBe('Cruz')
    expect(payload).not.toHaveProperty('lastname')
  })

  it('uses "birthday" (not "birthdate")', () => {
    const payload = buildEnrollmentPayload('family_planning_records', baseForm)
    expect(payload).toHaveProperty('birthday')
    expect(payload).not.toHaveProperty('birthdate')
  })

  it('maps sex to M/F short form', () => {
    const payload = buildEnrollmentPayload('family_planning_records', { ...baseForm, sex: 'Female' })
    expect(payload.sex).toBe('F')
  })

  it('does NOT include middlename or suffix', () => {
    const payload = buildEnrollmentPayload('family_planning_records', baseForm)
    expect(payload).not.toHaveProperty('middlename')
    expect(payload).not.toHaveProperty('suffix')
  })
})

describe('Payload table mapping matches rules', () => {
  it('every rule table has a corresponding payload builder', () => {
    const supportedTables = [
      'childcare_vitamina_records',
      'deworming_records',
      'wra_records',
      'cervical_screening_records',
      'family_planning_records',
    ]
    for (const rule of SERVICE_ELIGIBILITY_RULES) {
      expect(supportedTables).toContain(rule.table)
      const payload = buildEnrollmentPayload(rule.table, baseForm)
      expect(Object.keys(payload).length).toBeGreaterThan(0)
    }
  })
})

describe('Edge cases', () => {
  it('handles null birthdate gracefully', () => {
    const form = { ...baseForm, birthdate: null }
    const payload = buildEnrollmentPayload('childcare_vitamina_records', form)
    expect(payload.birthdate).toBe(null)
  })

  it('handles empty string birthdate', () => {
    const form = { ...baseForm, birthdate: '' }
    const payload = buildEnrollmentPayload('deworming_records', form)
    expect(payload.birthday).toBe(null)
  })

  it('handles undefined age', () => {
    const form = { ...baseForm, age: undefined }
    const payload = buildEnrollmentPayload('wra_records', form)
    expect(payload.age).toBe(null)
  })

  it('handles sex that is not Male/Female', () => {
    const form = { ...baseForm, sex: '' }
    const payload = buildEnrollmentPayload('childcare_vitamina_records', form)
    expect(payload.gender).toBe('')
  })
})
