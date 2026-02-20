// Age Classification Engine — auto-categorizes members by birthdate

export const AGE_CATEGORIES = [
  { key: 'infant', label: 'Infant', min: 0, max: 0, color: '#E8F5E9' },
  { key: 'under_five', label: 'Under-Five', min: 1, max: 4, color: '#C8E6C9' },
  { key: 'young_children', label: 'Young Children', min: 5, max: 9, color: '#A5D6A7' },
  { key: 'early_adolescents', label: 'Early Adolescents', min: 10, max: 14, color: '#81C784' },
  { key: 'adolescents', label: 'Adolescents', min: 15, max: 19, color: '#66BB6A' },
  { key: 'adults', label: 'Adults', min: 20, max: 59, color: '#43A047' },
  { key: 'senior', label: 'Senior', min: 60, max: Infinity, color: '#2E7D32' },
]

export function calculateAge(birthdate, referenceDate = new Date()) {
  if (!birthdate) return null

  const birth = new Date(birthdate)
  if (isNaN(birth.getTime())) return null

  let age = referenceDate.getFullYear() - birth.getFullYear()
  const monthDiff = referenceDate.getMonth() - birth.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < birth.getDate())) {
    age--
  }

  return Math.max(0, age)
}

export function classifyAge(birthdate, referenceDate) {
  const age = calculateAge(birthdate, referenceDate)
  if (age === null) return null

  const category = AGE_CATEGORIES.find(cat => age >= cat.min && age <= cat.max)
  return category ? { ...category, age } : null
}

export function getAgeGroupLabel(birthdate) {
  const result = classifyAge(birthdate)
  return result ? result.label : 'Unknown'
}

export function getAgeGroupKey(birthdate) {
  const result = classifyAge(birthdate)
  return result ? result.key : 'unknown'
}

export function classifyMembers(members) {
  const distribution = {}
  for (const cat of AGE_CATEGORIES) {
    distribution[cat.key] = []
  }
  distribution['unknown'] = []

  for (const member of members) {
    const result = classifyAge(member.birthdate)
    if (result) {
      distribution[result.key].push({ ...member, _age: result.age, _ageGroup: result.label })
    } else {
      distribution['unknown'].push(member)
    }
  }

  return distribution
}

export function getAgeDistribution(members) {
  const classified = classifyMembers(members)

  return AGE_CATEGORIES.map(cat => ({
    key: cat.key,
    label: cat.label,
    min: cat.min,
    max: cat.max === Infinity ? '60+' : cat.max,
    color: cat.color,
    count: classified[cat.key].length,
    members: classified[cat.key],
  }))
}

export function enrichMemberWithAge(member) {
  if (!member || !member.birthdate) return member

  const age = calculateAge(member.birthdate)
  const ageGroup = getAgeGroupLabel(member.birthdate)

  return {
    ...member,
    age,
    age_group: ageGroup,
  }
}

export function enrichMembersWithAge(members) {
  return members.map(enrichMemberWithAge)
}
