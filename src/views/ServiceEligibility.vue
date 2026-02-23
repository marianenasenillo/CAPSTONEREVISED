<script setup>
// ServiceEligibility — auto-detects eligible health services per household member
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/utils/supabase'
import { useToast } from '@/composables/useToast'
import { usePagination } from '@/composables/usePagination'
import { calculateAge, getAgeGroupLabel } from '@/utils/ageClassification'
import {
  SERVICE_ELIGIBILITY_RULES,
  getEligibleServices,
  getServiceSummary,
} from '@/utils/serviceEligibility'

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
    { table: 'family_planning_records', fnCol: 'firstname', lnCol: 'surname' },
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

// Enrollment modal state
const enrollModal = ref({
  show: false,
  rule: null,
  member: null,
  saving: false,
  form: {},
})

function openEnrollModal(rule, member) {
  // Prevent double-entry: check if already enrolled
  if (isAlreadyEnrolled(member, rule)) {
    toast.warning(`${member.firstname} ${member.lastname} is already enrolled in ${rule.label}. Duplicate entry not allowed.`)
    return
  }

  const form = {
    firstname: member.firstname || '',
    lastname: member.lastname || '',
    middlename: member.middlename || '',
    suffix: member.suffix || '',
    purok: member.purok || '',
    age: member._age != null ? member._age : (member.age || ''),
    sex: member.sex || '',
    birthdate: member.birthdate || '',
    civil_status: member.civil_status || '',
    // Service-specific fields
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
  enrollModal.value = { show: true, rule, member, saving: false, form }
}

async function saveEnrollment() {
  const { rule, form } = enrollModal.value
  if (!rule || !form.firstname || !form.lastname) {
    toast.warning('Name is required.')
    return
  }

  enrollModal.value.saving = true
  try {
    const table = rule.table
    const lastNameCol = table === 'family_planning_records' ? 'surname' : 'lastname'
    const firstName = form.firstname.trim()
    const lastName = form.lastname.trim()

    // Duplicate check
    if (firstName && lastName) {
      const { count, error: checkErr } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .ilike(lastNameCol, lastName)
        .ilike('firstname', firstName)

      if (!checkErr && count > 0) {
        toast.error(`${firstName} ${lastName} already exists in ${rule.label} records.`)
        enrollModal.value.saving = false
        return
      }
    }

    const ageInt = form.age !== '' && form.age != null ? parseInt(form.age) : null
    let payload = {}

    if (table === 'childcare_vitamina_records') {
      payload = {
        purok: form.purok,
        lastname: form.lastname,
        firstname: form.firstname,
        middlename: form.middlename,
        suffix: form.suffix,
        age: ageInt,
        birthdate: form.birthdate || null,
        gender: form.sex || '',
        mother_name: form.mother_name,
      }
    } else if (table === 'deworming_records') {
      payload = {
        purok: form.purok,
        lastname: form.lastname,
        firstname: form.firstname,
        middlename: form.middlename,
        sex: form.sex || '',
        birthday: form.birthdate || null,
        age: ageInt,
        mother_name: form.mother_name,
      }
    } else if (table === 'wra_records') {
      payload = {
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
      payload = {
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
      payload = {
        purok: form.purok,
        surname: form.lastname,
        firstname: form.firstname,
        sex: form.sex || '',
        birthday: form.birthdate || null,
        age: ageInt,
        mother_name: form.mother_name,
      }
    }

    const { error } = await supabase.from(table).insert(payload)
    if (error) {
      console.error(`[enrollment] Supabase error for ${table}:`, error.code, error.message, '\nPayload:', JSON.stringify(payload, null, 2))
      throw error
    }

    toast.success(`${form.firstname} ${form.lastname} enrolled in ${rule.label} successfully.`)
    enrollModal.value.show = false
    // Update enrolled lookup so the tag turns gray immediately
    enrolledLookup.value.add(makeEnrolledKey(form.firstname, form.lastname, table))
  } catch (err) {
    console.error('[enrollment] Error:', err?.code, err?.message, err)
    toast.error(`Failed to enroll: ${err?.message || err}`)
  } finally {
    enrollModal.value.saving = false
  }
}

function clearFilters() {
  selectedService.value = ''
  searchQuery.value = ''
  purokFilter.value = ''
}

const infoPopup = ref({ show: false, rule: null, member: null })

function showServiceInfo(event, svc, member) {
  event.stopPropagation()
  const rule = SERVICE_ELIGIBILITY_RULES.find(r => r.key === svc.key)
  infoPopup.value = { show: true, rule, member }
}

function closeInfoPopup() {
  infoPopup.value.show = false
}

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

onMounted(loadMembers)
</script>

<template>
  <div class="hs-page">
    <div class="hs-page-header">
      <div>
        <h1 class="hs-page-title"><span class="mdi mdi-clipboard-check-outline"></span> Service Eligibility</h1>
        <p class="hs-page-subtitle">Auto-detected eligible services for household members based on age, sex, and profile data</p>
      </div>
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
                    <span :class="'mdi ' + svc.icon" @click="openEnrollModal(svc, m)"></span>
                    <span class="se-tag-label" @click="openEnrollModal(svc, m)">{{ svc.label }}</span>
                    <span v-if="isAlreadyEnrolled(m, svc)" class="se-tag-check">
                      <span class="mdi mdi-check-circle"></span>
                    </span>
                    <span v-else class="se-tag-info" :title="'Why eligible?'" @click.stop="showServiceInfo($event, svc, m)">
                      <span class="mdi mdi-information-outline"></span>
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

    <!-- Service Info Popup -->
    <div v-if="infoPopup.show" class="se-info-overlay" @click.self="closeInfoPopup">
      <div class="se-info-modal">
        <div class="se-info-header">
          <span :class="'mdi ' + infoPopup.rule?.icon + ' se-info-icon'"></span>
          <div>
            <h3>{{ infoPopup.rule?.label }}</h3>
            <p>{{ infoPopup.rule?.description }}</p>
          </div>
          <button class="hs-modal-close" @click="closeInfoPopup">&times;</button>
        </div>

        <div class="se-info-member">
          <span class="mdi mdi-account-circle"></span>
          <strong>{{ infoPopup.member?.firstname }} {{ infoPopup.member?.lastname }}</strong>
          <span class="hs-badge hs-badge-info" v-if="infoPopup.member?._isHead" style="font-size:10px;">Head</span>
          <span class="se-info-purok">{{ infoPopup.member?.purok || '' }}</span>
        </div>

        <div class="se-info-body">
          <p class="se-info-section-title"><span class="mdi mdi-check-decagram"></span> Eligibility Criteria Met</p>
          <div class="se-info-criteria">
            <div
              v-for="reason in getEligibilityReasons(infoPopup.rule, infoPopup.member)"
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
        </div>

        <div class="se-info-footer">
          <button class="hs-btn hs-btn-secondary hs-btn-sm" @click="closeInfoPopup">
            <span class="mdi mdi-close"></span> Close
          </button>
          <button class="hs-btn hs-btn-primary hs-btn-sm" @click="closeInfoPopup(); openEnrollModal(infoPopup.rule, infoPopup.member)">
            <span class="mdi mdi-arrow-right"></span> Enroll in Service
          </button>
        </div>
      </div>
    </div>

    <!-- Enrollment Modal -->
    <div v-if="enrollModal.show" class="hs-modal-overlay" @click.self="enrollModal.show = false">
      <div class="hs-modal hs-modal-lg">
        <div class="hs-modal-header">
          <span :class="'mdi ' + (enrollModal.rule?.icon || 'mdi-clipboard-plus') + ' se-enroll-icon'"></span>
          <h3>Enroll in {{ enrollModal.rule?.label }}</h3>
          <button class="hs-modal-close" @click="enrollModal.show = false">&times;</button>
        </div>
        <div class="hs-modal-body">
          <form @submit.prevent="saveEnrollment">
            <!-- Member Info Banner -->
            <div class="se-enroll-banner">
              <span class="mdi mdi-account-circle"></span>
              <div>
                <strong>{{ enrollModal.form.firstname }} {{ enrollModal.form.lastname }}</strong>
                <span v-if="enrollModal.member?._isHead" class="hs-badge hs-badge-info" style="font-size:10px;margin-left:4px;">Head</span>
                <div class="se-enroll-banner-sub">
                  {{ (enrollModal.form.sex === 'M' ? 'Male' : enrollModal.form.sex === 'F' ? 'Female' : enrollModal.form.sex) || '—' }} · {{ enrollModal.form.age != null && enrollModal.form.age !== '' ? enrollModal.form.age + ' yrs' : '—' }} · {{ enrollModal.form.purok || '—' }}
                </div>
              </div>
            </div>

            <!-- Basic Info (autofilled, editable) -->
            <div class="se-enroll-section-label">Personal Information</div>
            <div class="hs-form-row">
              <div class="hs-form-group">
                <label class="hs-label">Last Name <span class="hs-text-danger">*</span></label>
                <input v-model="enrollModal.form.lastname" type="text" class="hs-input" required>
              </div>
              <div class="hs-form-group">
                <label class="hs-label">First Name <span class="hs-text-danger">*</span></label>
                <input v-model="enrollModal.form.firstname" type="text" class="hs-input" required>
              </div>
            </div>
            <div class="hs-form-row">
              <div class="hs-form-group">
                <label class="hs-label">Middle Name</label>
                <input v-model="enrollModal.form.middlename" type="text" class="hs-input">
              </div>
              <div class="hs-form-group" v-if="enrollModal.rule?.table !== 'deworming_records' && enrollModal.rule?.table !== 'family_planning_records'">
                <label class="hs-label">Suffix</label>
                <input v-model="enrollModal.form.suffix" type="text" class="hs-input">
              </div>
              <div class="hs-form-group" v-else>
                <label class="hs-label">Sex</label>
                <select v-model="enrollModal.form.sex" class="hs-select">
                  <option value="">Select</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
            </div>
            <div class="hs-form-row">
              <div class="hs-form-group">
                <label class="hs-label">Birthdate</label>
                <input v-model="enrollModal.form.birthdate" type="date" class="hs-input">
              </div>
              <div class="hs-form-group">
                <label class="hs-label">Age</label>
                <input v-model.number="enrollModal.form.age" type="number" class="hs-input" min="0">
              </div>
            </div>
            <div class="hs-form-row">
              <div class="hs-form-group">
                <label class="hs-label">Purok</label>
                <input v-model="enrollModal.form.purok" type="text" class="hs-input">
              </div>
              <div class="hs-form-group" v-if="enrollModal.rule?.table === 'childcare_vitamina_records' || enrollModal.rule?.table === 'deworming_records' || enrollModal.rule?.table === 'family_planning_records'">
                <label class="hs-label">Mother's Name</label>
                <input v-model="enrollModal.form.mother_name" type="text" class="hs-input">
              </div>
              <div class="hs-form-group" v-else-if="enrollModal.rule?.table === 'wra_records'">
                <label class="hs-label">Civil Status</label>
                <select v-model="enrollModal.form.civil_status" class="hs-select">
                  <option value="">Select</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Widowed">Widowed</option>
                  <option value="Separated">Separated</option>
                  <option value="Live-in">Live-in</option>
                </select>
              </div>
              <div class="hs-form-group" v-else>
                <label class="hs-label">Sex</label>
                <select v-model="enrollModal.form.sex" class="hs-select">
                  <option value="">Select</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
            </div>

            <!-- WRA-specific fields -->
            <template v-if="enrollModal.rule?.table === 'wra_records'">
              <div class="se-enroll-section-label">WRA Information</div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">SE Status</label>
                  <input v-model="enrollModal.form.se_status" type="text" class="hs-input">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Plano Manganak</label>
                  <input v-model="enrollModal.form.plano_manganak" type="text" class="hs-input">
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">FB Method</label>
                  <input v-model="enrollModal.form.fb_method" type="text" class="hs-input">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">FB Type</label>
                  <input v-model="enrollModal.form.fb_type" type="text" class="hs-input">
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">FB Date</label>
                  <input v-model="enrollModal.form.fb_date" type="date" class="hs-input">
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">Change Method</label>
                  <input v-model="enrollModal.form.change_method" type="text" class="hs-input">
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">
                    <input type="checkbox" v-model="enrollModal.form.karun" style="margin-right:4px;"> Karun
                  </label>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">
                    <input type="checkbox" v-model="enrollModal.form.spacing" style="margin-right:4px;"> Spacing
                  </label>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">
                    <input type="checkbox" v-model="enrollModal.form.limiting" style="margin-right:4px;"> Limiting
                  </label>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">
                    <input type="checkbox" v-model="enrollModal.form.fecund" style="margin-right:4px;"> Fecund
                  </label>
                </div>
                <div class="hs-form-group">
                  <label class="hs-label">
                    <input type="checkbox" v-model="enrollModal.form.infecund" style="margin-right:4px;"> Infecund
                  </label>
                </div>
              </div>
            </template>

            <!-- Cervical Screening specific -->
            <template v-if="enrollModal.rule?.table === 'cervical_screening_records'">
              <div class="se-enroll-section-label">Screening Information</div>
              <div class="hs-form-row">
                <div class="hs-form-group">
                  <label class="hs-label">Screened</label>
                  <select v-model="enrollModal.form.screened" class="hs-select">
                    <option :value="false">No</option>
                    <option :value="true">Yes</option>
                  </select>
                </div>
              </div>
            </template>

            <div class="hs-modal-footer hs-modal-footer--flat">
              <button type="button" class="hs-btn hs-btn-secondary" @click="enrollModal.show = false">Cancel</button>
              <button type="submit" class="hs-btn hs-btn-primary" :disabled="enrollModal.saving">
                <span class="mdi" :class="enrollModal.saving ? 'mdi-loading mdi-spin' : 'mdi-check'"></span>
                {{ enrollModal.saving ? 'Enrolling...' : 'Enroll' }}
              </button>
            </div>
          </form>
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
</style>
