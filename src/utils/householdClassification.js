// Household Classification Engine — auto-classifies households based on member data
import { calculateAge } from './ageClassification'

export const HOUSEHOLD_CLASSIFICATIONS = [
  {
    key: '4ps',
    label: '4Ps Beneficiary',
    description: 'Pantawid Pamilyang Pilipino Program beneficiary',
    icon: 'mdi-hand-heart',
    color: '#4CAF50',
    priority: 1,
    autoDetect: (_head, members) => {
      return members.some(m => m.is_4ps_member === true || m.is_4ps_member === 'Yes')
    },
  },
  {
    key: 'senior_only',
    label: 'Senior-Only Household',
    description: 'All members are aged 60 or above',
    icon: 'mdi-account-clock',
    color: '#FF9800',
    priority: 2,
    autoDetect: (_head, members) => {
      if (members.length === 0) return false
      return members.every(m => {
        const age = calculateAge(m.birthdate)
        return age !== null && age >= 60
      })
    },
  },
  {
    key: 'with_pregnant',
    label: 'With Pregnant Member',
    description: 'Household has at least one pregnant member',
    icon: 'mdi-baby-carriage',
    color: '#E91E63',
    priority: 3,
    autoDetect: (_head, members) => {
      return members.some(m => m.is_pregnant || m.lmp)
    },
  },
  {
    key: 'with_under_five',
    label: 'With Under-Five Children',
    description: 'Household has at least one child under 5 years old',
    icon: 'mdi-baby-face-outline',
    color: '#2196F3',
    priority: 4,
    autoDetect: (_head, members) => {
      return members.some(m => {
        const age = calculateAge(m.birthdate)
        return age !== null && age < 5
      })
    },
  },
  {
    key: 'with_pwd',
    label: 'With PWD Member',
    description: 'Household has a person with disability',
    icon: 'mdi-wheelchair-accessibility',
    color: '#9C27B0',
    priority: 5,
    autoDetect: (_head, members) => {
      return members.some(m => m.is_pwd === true || m.is_pwd === 'Yes')
    },
  },
  {
    key: 'indigent',
    label: 'Indigent',
    description: 'Identified as indigent household',
    icon: 'mdi-home-alert',
    color: '#795548',
    priority: 6,
    autoDetect: () => false,
  },
  {
    key: 'single_parent',
    label: 'Single-Parent Household',
    description: 'Head of household is a single parent',
    icon: 'mdi-account-child',
    color: '#607D8B',
    priority: 7,
    autoDetect: (head, members) => {
      const hasChildren = members.some(m => {
        const rel = (m.relationship || '').toLowerCase()
        return rel === 'son' || rel === 'daughter' || rel === 'child'
      })
      const headStatus = (head.civil_status || '').toLowerCase()
      return hasChildren && (headStatus === 'single' || headStatus === 'widowed' || headStatus === 'separated')
    },
  },
  {
    key: 'other',
    label: 'Other',
    description: 'Other classification (admin-defined)',
    icon: 'mdi-tag',
    color: '#9E9E9E',
    priority: 99,
    autoDetect: () => false,
  },
]

export function autoClassifyHousehold(head, members, existingManual = []) {
  const autoKeys = HOUSEHOLD_CLASSIFICATIONS
    .filter(c => c.autoDetect(head, members))
    .map(c => c.key)

  const allKeys = new Set([...autoKeys, ...existingManual])
  return Array.from(allKeys)
}

export function getClassificationDetails(keys) {
  return HOUSEHOLD_CLASSIFICATIONS
    .filter(c => keys.includes(c.key))
    .sort((a, b) => a.priority - b.priority)
}

export function getClassificationSummary(households) {
  const counts = {}
  for (const c of HOUSEHOLD_CLASSIFICATIONS) {
    counts[c.key] = 0
  }

  for (const h of households) {
    const classifications = h.classifications || []
    for (const key of classifications) {
      if (counts[key] !== undefined) {
        counts[key]++
      }
    }
  }

  return HOUSEHOLD_CLASSIFICATIONS
    .filter(c => c.key !== 'other')
    .map(c => ({
      key: c.key,
      label: c.label,
      icon: c.icon,
      color: c.color,
      count: counts[c.key],
    }))
    .sort((a, b) => b.count - a.count)
}

export function hasClassification(household, classificationKey) {
  return (household.classifications || []).includes(classificationKey)
}
