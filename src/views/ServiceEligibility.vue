<script setup>
// ServiceEligibility — auto-detects eligible health services per household member
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/utils/supabase'
import { useToast } from '@/composables/useToast'
import { usePagination } from '@/composables/usePagination'
import { calculateAge, getAgeGroupLabel } from '@/utils/ageClassification'
import {
  SERVICE_ELIGIBILITY_RULES,
  getEligibleServices,
  getServiceSummary,
} from '@/utils/serviceEligibility'

const router = useRouter()

const toast = useToast()

const loading = ref(true)
const members = ref([])
const userBarangay = ref('')
const selectedService = ref('')
const searchQuery = ref('')
const purokFilter = ref('')

// Tracks which name+table combos already have records (to prevent double-entry)
// Key format: "firstname|lastname|table" (all lowercased/trimmed)
const enrolledLookup = ref(new Set())

function makeEnrolledKey(firstname, lastname, table) {
  return `${(firstname || '').trim().toLowerCase()}|${(lastname || '').trim().toLowerCase()}|${table}`
}

function isAlreadyEnrolled(member, serviceRule) {
  const key = makeEnrolledKey(member.firstname, member.lastname, serviceRule.table)
  return enrolledLookup.value.has(key)
}

const enrichedMembers = computed(() => {
  return members.value.map(m => ({
    ...m,
    _age: calculateAge(m.birthdate),
    _ageGroup: getAgeGroupLabel(m.birthdate),
    _eligibleServices: getEligibleServices(m),
  }))
})

const filteredMembers = computed(() => {
  let result = enrichedMembers.value

  if (selectedService.value) {
    result = result.filter(m =>
      m._eligibleServices.some(s => s.key === selectedService.value)
    )
  }

  if (purokFilter.value) {
    result = result.filter(m => m.purok === purokFilter.value)
  }

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(m =>
      `${m.firstname} ${m.lastname} ${m.middlename}`.toLowerCase().includes(q)
    )
  }

  return result
})

const serviceSummary = computed(() => {
  return getServiceSummary(members.value)
})

const puroks = computed(() => {
  const set = new Set(members.value.map(m => m.purok).filter(Boolean))
  return Array.from(set).sort()
})

const { paginatedData, ...pagination } = usePagination(filteredMembers)

async function loadMembers() {
  try {
    loading.value = true
    const { data: { user } } = await supabase.auth.getUser()
    userBarangay.value = user?.user_metadata?.barangay || ''

    const { data: memberData, error: memberErr } = await supabase
      .from('household_members')
      .select('member_id, head_id, firstname, lastname, middlename, suffix, birthdate, age, sex, civil_status, barangay, lmp, is_4ps_member, is_pregnant, household_heads(purok)')
      .eq('barangay', userBarangay.value)
      .order('lastname', { ascending: true })

    if (memberErr) throw memberErr

    const { data: headData, error: headErr } = await supabase
      .from('household_heads')
      .select('head_id, firstname, lastname, middlename, suffix, purok, barangay, civil_status, birthdate, age, sex')
      .eq('barangay', userBarangay.value)
      .eq('is_archived', false)
      .order('lastname', { ascending: true })

    if (headErr) throw headErr

    const flatMembers = (memberData || []).map(m => ({
      ...m,
      purok: m.household_heads?.purok || '',
      household_heads: undefined,
      _isHead: false,
    }))

    const memberHeadIds = new Set(flatMembers.map(m => m.head_id).filter(Boolean))
    const headAsMembers = (headData || []).filter(h => !memberHeadIds.has(h.head_id) || true).map(h => ({
      member_id: null,
      head_id: h.head_id,
      firstname: h.firstname,
      lastname: h.lastname,
      middlename: h.middlename || '',
      suffix: h.suffix || '',
      birthdate: h.birthdate || null,
      age: h.age || null,
      sex: h.sex || null,
      civil_status: h.civil_status,
      barangay: h.barangay,
      purok: h.purok || '',
      lmp: null,
      is_4ps_member: false,
      is_pregnant: false,
      _isHead: true,
    }))

    members.value = [...flatMembers, ...headAsMembers]

    // Load existing records from all service tables to detect already-enrolled members
    await loadEnrolledRecords()
  } catch (err) {
    console.error('Failed to load members:', err)
    toast.error('Failed to load member data')
  } finally {
    loading.value = false
  }
}

async function loadEnrolledRecords() {
  const lookup = new Set()
  // Each unique table from SERVICE_ELIGIBILITY_RULES
  const tableConfigs = [
    { table: 'childcare_vitamina_records', fnCol: 'firstname', lnCol: 'lastname' },
    { table: 'deworming_records', fnCol: 'firstname', lnCol: 'lastname' },
    { table: 'wra_records', fnCol: 'firstname', lnCol: 'lastname' },
    { table: 'cervical_screening_records', fnCol: 'firstname', lnCol: 'lastname' },
  ]

  const queries = tableConfigs.map(async ({ table, fnCol, lnCol }) => {
    try {
      const { data, error } = await supabase
        .from(table)
        .select(`${fnCol}, ${lnCol}`)
      if (error) {
        console.warn(`[enrollment check] Failed to query ${table}:`, error.message)
        return
      }
      for (const row of data || []) {
        const key = makeEnrolledKey(row[fnCol], row[lnCol], table)
        lookup.add(key)
      }
    } catch (err) {
      console.warn(`[enrollment check] Error querying ${table}:`, err)
    }
  })

  await Promise.all(queries)
  enrolledLookup.value = lookup
}

function selectService(serviceKey) {
  selectedService.value = selectedService.value === serviceKey ? '' : serviceKey
}

function clearFilters() {
  selectedService.value = ''
  searchQuery.value = ''
  purokFilter.value = ''
}

const showEligibilityGuide = ref(false)

function getEligibilityReasons(rule, member) {
  if (!rule) return []
  const reasons = []

  const age = member._age
  if (rule.ageMax >= 120) {
    reasons.push({ icon: 'mdi-calendar-account', label: 'Age requirement', match: `${rule.ageMin}+ years`, value: age !== null ? `${age} yrs` : 'No birthdate' })
  } else {
    reasons.push({ icon: 'mdi-calendar-account', label: 'Age requirement', match: `${rule.ageMin}–${rule.ageMax} years`, value: age !== null ? `${age} yrs` : 'No birthdate' })
  }

  if (rule.sex) {
    reasons.push({ icon: 'mdi-gender-male-female', label: 'Sex requirement', match: rule.sex, value: member.sex || 'Unknown' })
  }

  if (rule.civilStatus && rule.civilStatus.length > 0) {
    reasons.push({ icon: 'mdi-ring', label: 'Civil status', match: rule.civilStatus.join(' or '), value: member.civil_status || 'Unknown' })
  }

  if (rule.condition) {
    if (member.lmp) reasons.push({ icon: 'mdi-calendar-heart', label: 'Has LMP recorded', match: 'LMP on file', value: member.lmp })
    if (member.is_pregnant) reasons.push({ icon: 'mdi-baby-carriage', label: 'Pregnancy status', match: 'Marked as pregnant', value: 'Yes' })
  }

  return reasons
}

async function deleteEnrolledRecord(member, svc) {
  const rule = SERVICE_ELIGIBILITY_RULES.find(r => r.key === svc.key)
  if (!rule) return
  const table = rule.table
  if (!confirm(`Remove ${member.firstname} ${member.lastname} from ${rule.label}? This will delete their record from ${table}.`)) return
  try {
    const { error } = await supabase
      .from(table)
      .delete()
      .ilike('firstname', member.firstname.trim())
      .ilike('lastname', member.lastname.trim())
    if (error) throw error
    toast.success(`Removed from ${rule.label}`)
    await loadEnrolledRecords()
  } catch (err) {
    console.error('Failed to delete enrolled record:', err)
    toast.error('Failed to delete: ' + (err.message || err))
  }
}

// --- Enrollment Modal ---
const enrollModal = ref({ show: false, member: null, rule: null })
const enrollFormData = reactive({})

// Extra fields config per service table
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

function getEnrollFields(table, member) {
  const fields = ENROLL_FIELDS[table] || []
  return fields.filter(f => !f.showIf || f.showIf(member))
}

function openEnrollModal(member, svc) {
  const rule = SERVICE_ELIGIBILITY_RULES.find(r => r.key === svc.key)
  if (!rule) return
  enrollModal.value = { show: true, member, rule }
  // Reset form data
  const fields = ENROLL_FIELDS[rule.table] || []
  for (const key of Object.keys(enrollFormData)) delete enrollFormData[key]
  for (const f of fields) {
    enrollFormData[f.key] = f.type === 'checkbox' ? false : ''
  }
}

function closeEnrollModal() {
  enrollModal.value = { show: false, member: null, rule: null }
}

function buildEnrollPayload(member, rule) {
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
    return { ...base, sex: member.sex || null, birthday: member.birthdate || null, mother_name: enrollFormData.mother_name || null }
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

async function submitEnrollment() {
  const { member, rule } = enrollModal.value
  if (!member || !rule) return
  const payload = buildEnrollPayload(member, rule)
  try {
    const { error } = await supabase.from(rule.table).insert([payload])
    if (error) throw error
    toast.success(`${member.firstname} ${member.lastname} enrolled in ${rule.label}`)
    closeEnrollModal()
    await loadEnrolledRecords()
  } catch (err) {
    console.error('Enrollment failed:', err)
    toast.error('Failed to enroll: ' + (err.message || err))
  }
}

function goToServicePage() {
  const { rule } = enrollModal.value
  if (!rule || !rule.route) return
  closeEnrollModal()
  router.push(rule.route)
}

onMounted(loadMembers)
</script>

<template>
  <div class="hs-page">
    <div class="hs-page-header">
      <div class="hs-page-header-title-row">
        <h1 class="hs-page-title"><span class="mdi mdi-clipboard-check-outline"></span> Service Eligibility</h1>
        <button class="hs-btn hs-btn-secondary hs-btn-sm" @click="showEligibilityGuide = true">
          <span class="mdi mdi-information-outline"></span> Eligibility Guide
        </button>
      </div>
      <p class="hs-page-subtitle">Auto-detected eligible services for household members based on age, sex, and profile data</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="hs-empty-state" style="padding: 80px 0;">
      <div class="hs-spinner"></div>
      <p>Analyzing member eligibility...</p>
    </div>

    <template v-else>
      <!-- Service Summary Cards -->
      <section class="se-summary">
        <div class="se-summary-grid">
          <div
            v-for="svc in serviceSummary"
            :key="svc.key"
            class="se-summary-card"
            :class="{ active: selectedService === svc.key }"
            @click="selectService(svc.key)"
          >
            <div class="se-summary-icon">
              <span :class="'mdi ' + svc.icon"></span>
            </div>
            <div class="se-summary-body">
              <div class="se-summary-count">{{ svc.count }}</div>
              <div class="se-summary-label">{{ svc.label }}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Filters -->
      <div class="hs-toolbar">
        <div class="hs-search-box">
          <span class="mdi mdi-magnify"></span>
          <input v-model="searchQuery" type="search" placeholder="Search by name..." />
        </div>
        <select v-model="purokFilter" class="hs-select" style="max-width: 200px;">
          <option value="">All Puroks</option>
          <option v-for="p in puroks" :key="p" :value="p">{{ p }}</option>
        </select>
        <select v-model="selectedService" class="hs-select" style="max-width: 260px;">
          <option value="">All Services</option>
          <option v-for="rule in SERVICE_ELIGIBILITY_RULES" :key="rule.key" :value="rule.key">{{ rule.label }}</option>
        </select>
        <button v-if="selectedService || searchQuery || purokFilter" class="hs-btn hs-btn-ghost hs-btn-sm" @click="clearFilters">
          <span class="mdi mdi-close"></span> Clear
        </button>
      </div>

      <!-- Results info -->
      <div class="se-results-info">
        <span>{{ filteredMembers.length }} eligible member{{ filteredMembers.length !== 1 ? 's' : '' }} found</span>
        <span v-if="selectedService" class="se-active-filter">
          <span class="mdi mdi-filter"></span> {{ SERVICE_ELIGIBILITY_RULES.find(r => r.key === selectedService)?.label }}
        </span>
      </div>

      <!-- Members Table -->
      <div v-if="filteredMembers.length === 0" class="hs-empty-state" style="padding: 60px 0;">
        <span class="mdi mdi-account-search-outline" style="font-size: 48px; color: var(--hs-gray-300);"></span>
        <p>No eligible members found for the current filters</p>
        <button class="hs-btn hs-btn-ghost" @click="clearFilters">Clear Filters</button>
      </div>

      <div v-else class="hs-table-wrap">
        <table class="hs-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Age</th>
              <th>Sex</th>
              <th>Age Group</th>
              <th>Purok</th>
              <th>Eligible Services</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in paginatedData" :key="m.member_id">
              <td>
                <strong>{{ m.lastname }}, {{ m.firstname }}</strong> {{ m.middlename }} {{ m.suffix }}
                <span v-if="m._isHead" class="hs-badge hs-badge-info" style="margin-left:4px;font-size:10px;">Head</span>
              </td>
              <td>{{ m._age !== null ? m._age : '—' }}</td>
              <td>{{ m.sex === 'M' ? 'Male' : m.sex === 'F' ? 'Female' : (m.sex || '—') }}</td>
              <td>
                <span class="se-age-badge">{{ m._ageGroup }}</span>
              </td>
              <td>{{ m.purok || '—' }}</td>
              <td>
                <div class="se-service-tags">
                  <span
                    v-for="svc in m._eligibleServices"
                    :key="svc.key"
                    class="se-service-tag"
                    :class="{ 'se-service-tag--enrolled': isAlreadyEnrolled(m, svc) }"
                    :title="isAlreadyEnrolled(m, svc) ? 'Already enrolled' : svc.description"
                  >
                    <span :class="'mdi ' + svc.icon"></span>
                    <span class="se-tag-label">{{ svc.label }}</span>
                    <span v-if="isAlreadyEnrolled(m, svc)" class="se-tag-check">
                      <span class="mdi mdi-check-circle"></span>
                    </span>
                    <span v-if="isAlreadyEnrolled(m, svc)" class="se-tag-delete" title="Remove record" @click.stop="deleteEnrolledRecord(m, svc)">
                      <span class="mdi mdi-close-circle"></span>
                    </span>
                    <span v-else class="se-tag-info" :title="'Enroll in this service'" @click.stop="openEnrollModal(m, svc)">
                      <span class="mdi mdi-plus-circle-outline"></span>
                    </span>
                  </span>
                  <span v-if="m._eligibleServices.length === 0" class="hs-text-muted">None</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="pagination.totalPages.value > 1" class="hs-pagination">
        <button class="hs-btn hs-btn-ghost hs-btn-sm" :disabled="pagination.currentPage.value === 1" @click="pagination.prevPage()">
          <span class="mdi mdi-chevron-left"></span>
        </button>
        <span v-for="p in pagination.visiblePages.value" :key="p">
          <button
            class="hs-btn hs-btn-sm"
            :class="pagination.currentPage.value === p ? 'hs-btn-primary' : 'hs-btn-ghost'"
            @click="pagination.goToPage(p)"
          >{{ p }}</button>
        </span>
        <button class="hs-btn hs-btn-ghost hs-btn-sm" :disabled="pagination.currentPage.value >= pagination.totalPages.value" @click="pagination.nextPage()">
          <span class="mdi mdi-chevron-right"></span>
        </button>
        <span class="hs-pagination-info">
          {{ pagination.startIndex.value }}–{{ pagination.endIndex.value }} of {{ pagination.totalItems.value }}
        </span>
      </div>
    </template>

    <!-- Eligibility Guide Modal -->
    <div v-if="showEligibilityGuide" class="se-info-overlay" @click.self="showEligibilityGuide = false">
      <div class="se-info-modal" style="max-width:600px;">
        <div class="se-info-header">
          <span class="mdi mdi-clipboard-check-outline se-info-icon"></span>
          <div>
            <h3>Service Eligibility Guide</h3>
            <p>Complete breakdown of all eligibility criteria</p>
          </div>
          <button class="hs-modal-close" @click="showEligibilityGuide = false">&times;</button>
        </div>
        <div class="se-info-body" style="max-height:60vh;overflow-y:auto;">
          <div v-for="rule in SERVICE_ELIGIBILITY_RULES" :key="rule.key" class="se-guide-item">
            <div class="se-guide-header">
              <span :class="'mdi ' + rule.icon" style="font-size:20px;color:var(--hs-primary);"></span>
              <div style="flex:1;">
                <strong>{{ rule.label }}</strong>
                <div style="font-size:12px;color:var(--hs-gray-500);">{{ rule.description }}</div>
              </div>
            </div>
            <div class="se-guide-criteria">
              <div class="se-guide-criterion">
                <span class="mdi mdi-calendar-account" style="color:var(--hs-primary);"></span>
                <span>Age: <strong>{{ rule.ageMax >= 120 ? rule.ageMin + '+ years' : rule.ageMin + '–' + rule.ageMax + ' years' }}</strong></span>
              </div>
              <div v-if="rule.sex" class="se-guide-criterion">
                <span class="mdi mdi-gender-male-female" style="color:var(--hs-primary);"></span>
                <span>Sex: <strong>{{ rule.sex }}</strong></span>
              </div>
              <div v-if="rule.civilStatus && rule.civilStatus.length" class="se-guide-criterion">
                <span class="mdi mdi-ring" style="color:var(--hs-primary);"></span>
                <span>Civil Status: <strong>{{ rule.civilStatus.join(' or ') }}</strong></span>
              </div>
              <div v-if="rule.condition" class="se-guide-criterion">
                <span class="mdi mdi-baby-carriage" style="color:var(--hs-primary);"></span>
                <span>Special: <strong>Must have LMP recorded or marked as pregnant</strong></span>
              </div>
              <div v-if="!rule.sex && !rule.condition && !(rule.civilStatus && rule.civilStatus.length)" class="se-guide-criterion">
                <span class="mdi mdi-check-circle" style="color:var(--hs-success);"></span>
                <span>Open to <strong>all sexes</strong></span>
              </div>
            </div>
          </div>
        </div>
        <div class="se-info-footer">
          <button class="hs-btn hs-btn-secondary hs-btn-sm" @click="showEligibilityGuide = false">
            <span class="mdi mdi-close"></span> Close
          </button>
        </div>
      </div>
    </div>

    <!-- Enrollment Modal -->
    <div v-if="enrollModal.show" class="se-info-overlay" @click.self="closeEnrollModal">
      <div class="se-info-modal" style="max-width:560px;">
        <div class="se-info-header">
          <span :class="'mdi ' + enrollModal.rule?.icon + ' se-info-icon'"></span>
          <div>
            <h3>Enroll in {{ enrollModal.rule?.label }}</h3>
            <p>{{ enrollModal.rule?.description }}</p>
          </div>
          <button class="hs-modal-close" @click="closeEnrollModal">&times;</button>
        </div>

        <!-- Autofilled Member Info -->
        <div class="se-info-member">
          <span class="mdi mdi-account-circle"></span>
          <strong>{{ enrollModal.member?.firstname }} {{ enrollModal.member?.lastname }}</strong>
          <span class="hs-badge hs-badge-info" v-if="enrollModal.member?._isHead" style="font-size:10px;">Head</span>
          <span class="se-info-purok">{{ enrollModal.member?.purok || '' }}</span>
        </div>

        <div class="se-info-body" style="max-height:55vh;overflow-y:auto;">
          <!-- Autofilled fields summary -->
          <p class="se-info-section-title"><span class="mdi mdi-account-check"></span> Autofilled Information</p>
          <div class="se-enroll-autofill">
            <div class="se-enroll-field-row">
              <span class="se-enroll-label">Name:</span>
              <span>{{ enrollModal.member?.firstname }} {{ enrollModal.member?.middlename }} {{ enrollModal.member?.lastname }} {{ enrollModal.member?.suffix }}</span>
            </div>
            <div class="se-enroll-field-row">
              <span class="se-enroll-label">Age:</span>
              <span>{{ enrollModal.member?._age !== null ? enrollModal.member?._age + ' yrs' : '—' }}</span>
            </div>
            <div class="se-enroll-field-row">
              <span class="se-enroll-label">Sex:</span>
              <span>{{ enrollModal.member?.sex === 'M' ? 'Male' : enrollModal.member?.sex === 'F' ? 'Female' : (enrollModal.member?.sex || '—') }}</span>
            </div>
            <div class="se-enroll-field-row">
              <span class="se-enroll-label">Birthdate:</span>
              <span>{{ enrollModal.member?.birthdate || '—' }}</span>
            </div>
            <div class="se-enroll-field-row">
              <span class="se-enroll-label">Purok:</span>
              <span>{{ enrollModal.member?.purok || '—' }}</span>
            </div>
            <div v-if="enrollModal.member?.civil_status" class="se-enroll-field-row">
              <span class="se-enroll-label">Civil Status:</span>
              <span>{{ enrollModal.member?.civil_status }}</span>
            </div>
          </div>

          <!-- Eligibility Criteria -->
          <p class="se-info-section-title" style="margin-top:16px;"><span class="mdi mdi-check-decagram"></span> Eligibility Criteria Met</p>
          <div class="se-info-criteria">
            <div
              v-for="reason in getEligibilityReasons(enrollModal.rule, enrollModal.member)"
              :key="reason.label"
              class="se-info-criterion"
            >
              <span :class="'mdi ' + reason.icon + ' se-criterion-icon'"></span>
              <div class="se-criterion-body">
                <span class="se-criterion-label">{{ reason.label }}</span>
                <div class="se-criterion-row">
                  <span class="se-criterion-required">Required: {{ reason.match }}</span>
                  <span class="se-criterion-divider">·</span>
                  <span class="se-criterion-actual">Member: {{ reason.value }}</span>
                </div>
              </div>
              <span class="mdi mdi-check-circle se-criterion-check"></span>
            </div>
          </div>

          <!-- Extra Form Fields -->
          <template v-if="getEnrollFields(enrollModal.rule?.table, enrollModal.member).length">
            <p class="se-info-section-title" style="margin-top:16px;"><span class="mdi mdi-form-textbox"></span> Additional Information</p>
            <div class="se-enroll-extra-fields">
              <div
                v-for="field in getEnrollFields(enrollModal.rule?.table, enrollModal.member)"
                :key="field.key"
                class="se-enroll-field"
              >
                <template v-if="field.type === 'checkbox'">
                  <label class="se-enroll-checkbox">
                    <input type="checkbox" v-model="enrollFormData[field.key]" />
                    <span>{{ field.label }}</span>
                  </label>
                </template>
                <template v-else-if="field.type === 'select'">
                  <label class="se-enroll-input-label">{{ field.label }}</label>
                  <select v-model="enrollFormData[field.key]" class="hs-select">
                    <option value="">Select...</option>
                    <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
                  </select>
                </template>
                <template v-else>
                  <label class="se-enroll-input-label">{{ field.label }}</label>
                  <input
                    :type="field.type || 'text'"
                    v-model="enrollFormData[field.key]"
                    class="hs-input"
                    :placeholder="field.label"
                  />
                </template>
              </div>
            </div>
          </template>
        </div>

        <div class="se-info-footer" style="gap:8px;">
          <button class="hs-btn hs-btn-secondary hs-btn-sm" @click="goToServicePage">
            <span class="mdi mdi-open-in-new"></span> Go to Service Page
          </button>
          <button class="hs-btn hs-btn-primary hs-btn-sm" @click="submitEnrollment">
            <span class="mdi mdi-plus-circle"></span> Create Record
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* Service Eligibility Styles */

.se-summary {
  margin-bottom: 20px;
}
.se-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 12px;
}
.se-summary-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--hs-white);
  border-radius: var(--hs-radius-lg);
  border: 2px solid var(--hs-border);
  cursor: pointer;
  transition: all 0.2s;
}
.se-summary-card:hover {
  border-color: var(--hs-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
.se-summary-card.active {
  border-color: var(--hs-primary);
  background: var(--hs-primary-bg, #e3f2fd);
}
.se-summary-icon {
  font-size: 24px;
  color: var(--hs-primary);
  flex-shrink: 0;
}
.se-summary-count {
  font-size: var(--hs-font-size-xl, 20px);
  font-weight: 700;
  color: var(--hs-gray-900);
  line-height: 1;
}
.se-summary-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--hs-gray-500);
  line-height: 1.2;
  margin-top: 2px;
}

/* Results info */
.se-results-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  font-size: var(--hs-font-size-sm);
  color: var(--hs-gray-600);
}
.se-active-filter {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  background: var(--hs-primary-bg, #e3f2fd);
  color: var(--hs-primary);
  border-radius: 14px;
  font-weight: 500;
  font-size: 12px;
}

/* Age badge */
.se-age-badge {
  display: inline-block;
  padding: 2px 10px;
  background: var(--hs-gray-100);
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--hs-gray-700);
}

/* Service tags */
.se-service-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.se-service-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  background: #f0f7ff;
  color: var(--hs-primary);
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
}
.se-service-tag:hover {
  background: var(--hs-primary);
  color: white;
}
/* Already-enrolled service tag: gray instead of green */
.se-service-tag--enrolled {
  background: var(--hs-gray-100);
  color: var(--hs-gray-400);
  cursor: default;
}
.se-service-tag--enrolled:hover {
  background: var(--hs-gray-200);
  color: var(--hs-gray-500);
}
.se-tag-check {
  display: inline-flex;
  align-items: center;
  margin-left: 2px;
  opacity: 0.7;
}
.se-tag-check .mdi {
  font-size: 12px;
}
.se-tag-delete {
  display: inline-flex;
  align-items: center;
  margin-left: 2px;
  opacity: 0;
  cursor: pointer;
  color: var(--hs-danger, #e53935);
  transition: opacity 0.15s;
}
.se-tag-delete .mdi {
  font-size: 12px;
}
.se-service-tag:hover .se-tag-delete {
  opacity: 0.7;
}
.se-tag-delete:hover {
  opacity: 1 !important;
}
.se-service-tag .mdi {
  font-size: 13px;
}

@media (max-width: 768px) {
  .se-summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Service tag split layout */
.se-tag-label {
  flex: 1;
}
.se-tag-info {
  display: inline-flex;
  align-items: center;
  margin-left: 4px;
  padding: 0 2px;
  opacity: 0.55;
  border-left: 1px solid currentColor;
  transition: opacity 0.15s;
}
.se-tag-info:hover {
  opacity: 1;
}
.se-tag-info .mdi {
  font-size: 12px;
}

/* Info popup overlay */
.se-info-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.se-info-modal {
  background: var(--hs-white);
  border-radius: var(--hs-radius-lg);
  max-width: 480px;
  width: 100%;
  box-shadow: 0 12px 40px rgba(0,0,0,0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.se-info-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 20px 20px 14px;
  border-bottom: 1px solid var(--hs-border);
}
.se-info-icon {
  font-size: 28px;
  color: var(--hs-primary);
  flex-shrink: 0;
  margin-top: 2px;
}
.se-info-header h3 {
  margin: 0 0 2px;
  font-size: var(--hs-font-size-base);
  font-weight: 700;
  color: var(--hs-gray-900);
}
.se-info-header p {
  margin: 0;
  font-size: 12px;
  color: var(--hs-gray-500);
}
.se-info-header .hs-modal-close {
  margin-left: auto;
  flex-shrink: 0;
  background: none;
  border: none;
  font-size: 20px;
  color: var(--hs-gray-400);
  cursor: pointer;
  line-height: 1;
  padding: 0 4px;
}
.se-info-header .hs-modal-close:hover { color: var(--hs-gray-800); }

.se-info-member {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: var(--hs-gray-50, #f8f9fa);
  font-size: 13px;
  color: var(--hs-gray-700);
  border-bottom: 1px solid var(--hs-border);
}
.se-info-member .mdi {
  font-size: 20px;
  color: var(--hs-gray-400);
}
.se-info-purok {
  margin-left: auto;
  font-size: 12px;
  color: var(--hs-gray-400);
}

.se-info-body {
  padding: 16px 20px;
  flex: 1;
}
.se-info-section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--hs-gray-500);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.se-info-section-title .mdi { color: var(--hs-success, #4caf50); }

.se-info-criteria {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.se-info-criterion {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--hs-gray-50, #f8f9fa);
  border-radius: var(--hs-radius);
  border: 1px solid var(--hs-border);
}
.se-criterion-icon {
  font-size: 18px;
  color: var(--hs-primary);
  flex-shrink: 0;
}
.se-criterion-body {
  flex: 1;
  min-width: 0;
}
.se-criterion-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--hs-gray-700);
  margin-bottom: 2px;
}
.se-criterion-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.se-criterion-required {
  color: var(--hs-gray-500);
}
.se-criterion-divider {
  color: var(--hs-gray-300);
}
.se-criterion-actual {
  color: var(--hs-primary);
  font-weight: 600;
}
.se-criterion-check {
  font-size: 16px;
  color: var(--hs-success, #4caf50);
  flex-shrink: 0;
}

.se-info-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--hs-border);
}

/* Enrollment Modal Styles */
.se-enroll-icon {
  font-size: 20px;
  color: var(--hs-primary);
  margin-right: 4px;
}
.se-enroll-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--hs-primary-bg, #e8f5e9);
  border-radius: var(--hs-radius);
  margin-bottom: 16px;
  border: 1px solid var(--hs-primary-lighter, #c8e6c9);
}
.se-enroll-banner .mdi {
  font-size: 28px;
  color: var(--hs-primary);
}
.se-enroll-banner strong {
  font-size: 14px;
  color: var(--hs-gray-900);
}
.se-enroll-banner-sub {
  font-size: 12px;
  color: var(--hs-gray-500);
  margin-top: 2px;
}

/* Eligibility Guide Modal */
.se-guide-item {
  padding: 14px 0;
  border-bottom: 1px solid var(--hs-border);
}
.se-guide-item:last-child { border-bottom: none; }
.se-guide-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.se-guide-criteria {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-left: 30px;
}
.se-guide-criterion {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  background: var(--hs-gray-50, #f8f9fa);
  border-radius: var(--hs-radius);
  font-size: 12px;
  color: var(--hs-gray-700);
  border: 1px solid var(--hs-border);
}

.se-enroll-section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--hs-gray-500);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 16px 0 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--hs-gray-100);
}

/* Enrollment modal autofill & extra fields */
.se-enroll-autofill {
  background: var(--hs-gray-50, #f8f9fa);
  border-radius: var(--hs-radius);
  border: 1px solid var(--hs-border);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.se-enroll-field-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--hs-gray-700);
}
.se-enroll-label {
  font-weight: 600;
  color: var(--hs-gray-500);
  min-width: 90px;
  font-size: 12px;
}
.se-enroll-extra-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.se-enroll-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.se-enroll-input-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--hs-gray-600);
}
.se-enroll-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--hs-gray-700);
  cursor: pointer;
}
.se-enroll-checkbox input[type="checkbox"] {
  accent-color: var(--hs-primary);
}
</style>
