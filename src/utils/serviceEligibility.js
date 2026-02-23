// Service Eligibility Engine — determines eligible health services by age, sex, and profile data
import { calculateAge } from './ageClassification'

export const SERVICE_ELIGIBILITY_RULES = [
  {
    key: 'immunization',
    label: 'Immunization',
    description: 'Routine immunization for infants',
    ageMin: 0,
    ageMax: 1,
    sex: null,
    civilStatus: null,
    route: '/childcare',
    table: 'childcare_vitamina_records',
    icon: 'mdi-needle',
  },
  {
    key: 'growth_monitoring',
    label: 'Growth Monitoring',
    description: 'Growth monitoring for infants and toddlers',
    ageMin: 0,
    ageMax: 4,
    sex: null,
    civilStatus: null,
    route: '/childcare',
    table: 'childcare_vitamina_records',
    icon: 'mdi-chart-line',
  },
  {
    key: 'vitamin_a',
    label: 'Vitamin A Supplement',
    description: 'Vitamin A supplementation for children under 5',
    ageMin: 0,
    ageMax: 4,
    sex: null,
    civilStatus: null,
    route: '/childcare',
    table: 'childcare_vitamina_records',
    icon: 'mdi-pill',
  },
  {
    key: 'deworming_child',
    label: 'Deworming (Child)',
    description: 'Deworming for children aged 1–14',
    ageMin: 1,
    ageMax: 14,
    sex: null,
    civilStatus: null,
    route: '/preventivehealthservices',
    table: 'deworming_records',
    icon: 'mdi-medical-bag',
  },
  {
    key: 'school_health',
    label: 'School-Based Health Check',
    description: 'Health screening for school-age children',
    ageMin: 5,
    ageMax: 14,
    sex: null,
    civilStatus: null,
    route: '/preventivehealthservices',
    table: 'deworming_records',
    icon: 'mdi-school',
  },
  {
    key: 'wra',
    label: 'Women of Reproductive Age (WRA)',
    description: 'Reproductive health services for women aged 15–49',
    ageMin: 15,
    ageMax: 49,
    sex: 'Female',
    civilStatus: null,
    route: '/maternalservices',
    table: 'wra_records',
    icon: 'mdi-human-female',
  },
  {
    key: 'cervical_screening',
    label: 'Cervical Cancer Screening',
    description: 'Cervical cancer screening for women aged 25–65',
    ageMin: 25,
    ageMax: 65,
    sex: 'Female',
    civilStatus: null,
    route: '/maternalservices',
    table: 'cervical_screening_records',
    icon: 'mdi-ribbon',
  },
  {
    key: 'family_planning',
    label: 'Family Planning',
    description: 'Family planning services for reproductive-age individuals',
    ageMin: 15,
    ageMax: 49,
    sex: null,
    civilStatus: ['Married', 'Live-in'],
    route: '/familyplanning',
    table: 'family_planning_records',
    icon: 'mdi-account-group',
  },
  {
    key: 'maternal_care',
    label: 'Maternal Care',
    description: 'Prenatal and postnatal care for pregnant women',
    ageMin: 15,
    ageMax: 49,
    sex: 'Female',
    civilStatus: null,
    condition: (member) => member.lmp || member.is_pregnant,
    route: '/maternalservices',
    table: 'wra_records',
    icon: 'mdi-baby-carriage',
  },
  {
    key: 'preventive_health',
    label: 'Preventive Health Services',
    description: 'General preventive health check-ups for adults',
    ageMin: 20,
    ageMax: 120,
    sex: null,
    civilStatus: null,
    route: '/preventivehealthservices',
    table: 'deworming_records',
    icon: 'mdi-stethoscope',
  },
  {
    key: 'senior_health',
    label: 'Senior Health Check',
    description: 'Health monitoring for senior citizens',
    ageMin: 60,
    ageMax: 120,
    sex: null,
    civilStatus: null,
    route: '/preventivehealthservices',
    table: 'deworming_records',
    icon: 'mdi-account-clock',
  },
]

export function getEligibleServices(member, rules = SERVICE_ELIGIBILITY_RULES) {
  if (!member || !member.birthdate) return []

  const age = calculateAge(member.birthdate)
  if (age === null) return []

  const rawSex = (member.sex || '').trim().toLowerCase()
  const sex = (rawSex === 'm' || rawSex === 'male') ? 'male' : (rawSex === 'f' || rawSex === 'female') ? 'female' : rawSex
  const civilStatus = (member.civil_status || '').trim()

  return rules.filter(rule => {
    if (age < rule.ageMin || age > rule.ageMax) return false
    if (rule.sex && rule.sex.toLowerCase() !== sex) return false
    if (rule.civilStatus && rule.civilStatus.length > 0) {
      const matched = rule.civilStatus.some(
        s => s.toLowerCase() === civilStatus.toLowerCase()
      )
      if (!matched) return false
    }

    if (rule.condition && typeof rule.condition === 'function') {
      if (!rule.condition(member)) return false
    }

    return true
  })
}

export function isEligibleFor(member, serviceKey) {
  const eligible = getEligibleServices(member)
  return eligible.some(s => s.key === serviceKey)
}

export function getEligibleMembersForService(members, serviceKey) {
  return members.filter(m => isEligibleFor(m, serviceKey)).map(m => ({
    ...m,
    _age: calculateAge(m.birthdate),
  }))
}

export function generateEligibilityReport(members) {
  const report = {}

  for (const rule of SERVICE_ELIGIBILITY_RULES) {
    const eligible = getEligibleMembersForService(members, rule.key)
    report[rule.key] = {
      rule,
      count: eligible.length,
      members: eligible,
    }
  }

  return report
}

export function getServiceSummary(members) {
  const report = generateEligibilityReport(members)
  return SERVICE_ELIGIBILITY_RULES.map(rule => ({
    key: rule.key,
    label: rule.label,
    icon: rule.icon,
    count: report[rule.key].count,
    description: rule.description,
  }))
}
