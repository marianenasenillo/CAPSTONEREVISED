<script setup>
import DashboardView from '@/components/DashboardView.vue'
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/utils/supabase.js'

const router = useRouter()
const showRecords = ref(false)
const activeMenu = ref('')
const showModal = ref(false)
const modalType = ref('')
const userRole = ref('')
const userBarangay = ref('')

const householdHeads = ref([])
const selectedHeadId = ref('')
const headSearchQuery = ref('')
const showHeadDropdown = ref(false)
const loadingHeads = ref(false)

// Household Profiling form fields
const barangay = ref('')
const purok = ref('')
const lastname = ref('')
const firstname = ref('')
const middlename = ref('')
const suffix = ref('')
const age = ref('')
const birthdate = ref('')
const seStatus = ref('')
const civilStatus = ref('')
const planoManganak = ref('')
const karun = ref(false)
const spacing = ref(false)
const limiting = ref(false)
const fecund = ref(false)
const infecund = ref(false)
const fbMethod = ref('')
const fbType = ref('')
const fbDate = ref('')
const changeMethod = ref('')

// Household Head Profiling form fields
const headBarangay = ref('')
const headPurok = ref('')
const headLastname = ref('')
const headFirstname = ref('')
const headMiddlename = ref('')
const headSuffix = ref('')
const headFamilyCount = ref('')
const headBirthdate = ref('')
const headAge = ref('')
const headSex = ref('')
const headCivilStatus = ref('')
const headContactNumber = ref('')
const headOccupation = ref('')

const dateVisit = ref('')
const householdNo = ref('')
const relationship = ref('')
const sex = ref('')
const education = ref('')
const religion = ref('')
const ethnicity = ref('')
const is4psMember = ref('')
const householdId4ps = ref('')
const philhealthId = ref('')
const membershipType = ref('')
const philhealthCategory = ref('')
const medicalHistory = ref('')
const ageGroup = ref('')
const lmp = ref('')
const usingFpMethod = ref('')
const fpMethodUsed = ref('')
const fpStatus = ref('')
const waterSource = ref('')
const toiletFacility = ref('')

const members = ref([
  {
    barangay: '',
    purok: '',
    dateVisit: '',
    householdNo: '',
    lastname: '',
    firstname: '',
    middlename: '',
    suffix: '',
    relationship: '',
    birthdate: '',
    age: '',
    sex: '',
    civilStatus: '',
    education: '',
    religion: '',
    ethnicity: '',
    is4psMember: '',
    householdId4ps: '',
    philhealthId: '',
    membershipType: '',
    philhealthCategory: '',
    medicalHistory: '',
    ageGroup: '',
    lmp: '',
    usingFpMethod: '',
    fpMethodUsed: '',
    fpStatus: '',
    waterSource: '',
    toiletFacility: ''
  }
])

// Auto-calculate age from birthdate
watch(birthdate, (newVal) => {
  if (newVal) {
    const birth = new Date(newVal)
    const today = new Date()
    let calculatedAge = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      calculatedAge--
    }
    age.value = calculatedAge >= 0 ? calculatedAge : ''
  } else {
    age.value = ''
  }
})

// Filtered heads based on search query
const filteredHeads = computed(() => {
  if (!headSearchQuery.value) return householdHeads.value
  const q = headSearchQuery.value.toLowerCase()
  return householdHeads.value.filter((h) => {
    const label = `${h.lastname}, ${h.firstname} — ${h.purok || 'N/A'} (Head ID: ${h.head_id})`
    return label.toLowerCase().includes(q)
  })
})

// Get display label for a selected head
const selectedHeadLabel = computed(() => {
  if (!selectedHeadId.value) return ''
  const head = householdHeads.value.find((h) => h.head_id === selectedHeadId.value)
  if (!head) return ''
  return `${head.lastname}, ${head.firstname} — ${head.purok || 'N/A'} (Head ID: ${head.head_id})`
})

// Fetch household heads from Supabase filtered by barangay
const fetchHouseholdHeads = async () => {
  loadingHeads.value = true
  try {
    const { data, error } = await supabase
      .from('household_heads')
      .select('head_id, lastname, firstname, purok, barangay')
      .eq('barangay', userBarangay.value)
      .eq('is_archived', false)
      .order('lastname', { ascending: true })

    if (error) throw error
    householdHeads.value = data || []
  } catch (err) {
    console.error('Error fetching household heads:', err)
    householdHeads.value = []
  } finally {
    loadingHeads.value = false
  }
}

const selectHead = (head) => {
  selectedHeadId.value = head.head_id
  headSearchQuery.value = `${head.lastname}, ${head.firstname} — ${head.purok || 'N/A'} (Head ID: ${head.head_id})`
  showHeadDropdown.value = false
}

const clearHeadSelection = () => {
  selectedHeadId.value = ''
  headSearchQuery.value = ''
  showHeadDropdown.value = false
}

const onHeadSearchFocus = () => {
  showHeadDropdown.value = true
  if (selectedHeadId.value) {
    headSearchQuery.value = ''
  }
}

const onHeadSearchBlur = () => {
  setTimeout(() => {
    showHeadDropdown.value = false
    if (selectedHeadId.value && !headSearchQuery.value) {
      headSearchQuery.value = selectedHeadLabel.value
    }
  }, 200)
}

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  userRole.value = user?.user_metadata?.role || ''
  userBarangay.value = user?.user_metadata?.barangay || ''
  barangay.value = userBarangay.value
  headBarangay.value = userBarangay.value
})

const goPrevPage = () => router.push('/home')
const goNextPage = () => router.push('/maternalservices')
const toggleRecords = () => (showRecords.value = !showRecords.value)
const openMenu = (type) => (activeMenu.value = type)
const closeMenu = () => (activeMenu.value = '')
const fillIn = async (type) => {
  modalType.value = type
  showModal.value = true
  closeMenu()

  // When opening member modal, fetch household heads for dropdown
  if (type === 'household') {
    await fetchHouseholdHeads()
  }
}
const viewRecords = (type) => {
  if (type === 'head') router.push('/hhpsrecords')
  closeMenu()
}
const closeModal = () => {
  showModal.value = false
  showHeadDropdown.value = false
}

// Normalize sex value to single character for DB char(1) column
const normalizeSex = (val) => {
  if (!val) return null
  const v = val.toString().trim().toLowerCase()
  if (v === 'male' || v === 'm') return 'M'
  if (v === 'female' || v === 'f') return 'F'
  return val
}

const saveHead = async () => {
  try {
    const headPayload = {
      barangay: headBarangay.value,
      purok: headPurok.value,
      lastname: headLastname.value,
      firstname: headFirstname.value,
      middlename: headMiddlename.value,
      suffix: headSuffix.value,
      no_of_families: headFamilyCount.value ? parseInt(headFamilyCount.value) : null,
      birthdate: headBirthdate.value || null,
      age: headAge.value ? parseInt(headAge.value) : null,
      sex: normalizeSex(headSex.value),
      civil_status: headCivilStatus.value || null,
      contact_number: headContactNumber.value || null,
      occupation: headOccupation.value || null,
      population: null,
      female_count: null,
      male_count: null,
    }

    const { data, error } = await supabase.from('household_heads').insert([headPayload])

    if (error) {
      console.error('[saveHead] Supabase error:', error.code, error.message, '\nPayload:', JSON.stringify(headPayload, null, 2))
      throw error
    }
    alert('Household head saved successfully!')
    closeModal()

    headBarangay.value = userBarangay.value
    headPurok.value = ''
    headLastname.value = ''
    headFirstname.value = ''
    headMiddlename.value = ''
    headSuffix.value = ''
    headFamilyCount.value = ''
    headBirthdate.value = ''
    headAge.value = ''
    headSex.value = ''
    headCivilStatus.value = ''
    headContactNumber.value = ''
    headOccupation.value = ''
  } catch (err) {
    console.error('[saveHead] Error:', err?.code, err?.message, err)
    alert(`Error saving household head: ${err?.message || 'Unknown error'}`)
  }
}

const saveHousehold = async () => {
  try {
    if (!selectedHeadId.value) {
      alert('Please select a Household Head from the dropdown.')
      return
    }

    const memberPayload = {
      head_id: selectedHeadId.value,
      barangay: barangay.value,
      date_visit: dateVisit.value || null,
      relationship: relationship.value,
      lastname: lastname.value,
      firstname: firstname.value,
      middlename: middlename.value,
      suffix: suffix.value,
      birthdate: birthdate.value || null,
      age: age.value !== '' ? parseInt(age.value) : null,
      sex: normalizeSex(sex.value),
      civil_status: civilStatus.value,
      education: education.value,
      religion: religion.value,
      ethnicity: ethnicity.value,
      is_4ps_member: is4psMember.value === 'Yes',
      household_id_4ps: householdId4ps.value,
      philhealth_id: philhealthId.value,
      membership_type: membershipType.value,
      philhealth_category: philhealthCategory.value,
      medical_history: medicalHistory.value,
      age_group: ageGroup.value,
      lmp: lmp.value || null,
      using_fp_method: usingFpMethod.value === 'Yes',
      fp_method_used: fpMethodUsed.value,
      fp_status: fpStatus.value,
      water_source: waterSource.value,
      toilet_facility: toiletFacility.value,
    }

    const { data, error } = await supabase.from('household_members').insert([memberPayload])

    if (error) {
      console.error('[saveMember] Supabase error:', error.code, error.message, '\nPayload:', JSON.stringify(memberPayload, null, 2))
      throw error
    }
    alert('Household member saved successfully!')
    closeModal()

    selectedHeadId.value = ''
    headSearchQuery.value = ''
    dateVisit.value = ''
    householdNo.value = ''
    barangay.value = userBarangay.value
    purok.value = ''
    lastname.value = ''
    firstname.value = ''
    middlename.value = ''
    suffix.value = ''
    relationship.value = ''
    birthdate.value = ''
    age.value = ''
    sex.value = ''
    civilStatus.value = ''
    education.value = ''
    religion.value = ''
    ethnicity.value = ''
    is4psMember.value = ''
    householdId4ps.value = ''
    philhealthId.value = ''
    membershipType.value = ''
    philhealthCategory.value = ''
    medicalHistory.value = ''
    ageGroup.value = ''
    lmp.value = ''
    usingFpMethod.value = ''
    fpMethodUsed.value = ''
    fpStatus.value = ''
    waterSource.value = ''
    toiletFacility.value = ''
  } catch (err) {
    console.error('[saveMember] Error:', err?.code, err?.message, err)
    alert(`Error saving member: ${err?.message || 'Unknown error'}`)
  }
}
</script>

<template>
  <DashboardView>
    <div class="service-page">
      <!-- Page Header -->
      <div class="hs-page-header">
        <div class="hs-breadcrumb">
          <a href="#" @click.prevent="goPrevPage">Dashboard</a>
          <span class="separator">/</span>
          <span class="current">Household Profiling</span>
        </div>
        <h1>Household Profiling Services</h1>
        <p>Gather and organize essential information about families in the community</p>
      </div>

      <!-- Action Cards -->
      <div class="service-cards">
        <div class="hs-card service-action-card">
          <div class="hs-card-body" style="text-align: center; padding: var(--hs-space-8);">
            <div class="hs-stat-icon hs-stat-icon-primary" style="margin: 0 auto var(--hs-space-4); width: 56px; height: 56px; font-size: 28px;">
              <span class="mdi mdi-account-multiple-plus"></span>
            </div>
            <h3 style="font-size: var(--hs-font-size-md); font-weight: 600; color: var(--hs-gray-900); margin-bottom: var(--hs-space-2);">Household Member Profiling</h3>
            <p style="font-size: var(--hs-font-size-sm); color: var(--hs-gray-500); margin-bottom: var(--hs-space-5);">Add individual household member records and profiling data</p>
            <button v-if="userRole === 'BHW'" class="hs-btn hs-btn-primary" @click="fillIn('household')">
              <span class="mdi mdi-plus"></span> Fill In Form
            </button>
          </div>
        </div>

        <div class="hs-card service-action-card">
          <div class="hs-card-body" style="text-align: center; padding: var(--hs-space-8);">
            <div class="hs-stat-icon hs-stat-icon-info" style="margin: 0 auto var(--hs-space-4); width: 56px; height: 56px; font-size: 28px;">
              <span class="mdi mdi-home-account"></span>
            </div>
            <h3 style="font-size: var(--hs-font-size-md); font-weight: 600; color: var(--hs-gray-900); margin-bottom: var(--hs-space-2);">Household Head Profiling</h3>
            <p style="font-size: var(--hs-font-size-sm); color: var(--hs-gray-500); margin-bottom: var(--hs-space-5);">Register and manage household head information</p>
            <div style="display: flex; gap: var(--hs-space-2); justify-content: center; flex-wrap: wrap;">
              <button v-if="userRole === 'BHW'" class="hs-btn hs-btn-primary" @click="fillIn('head')">
                <span class="mdi mdi-plus"></span> Fill In
              </button>
              <button class="hs-btn hs-btn-secondary" @click="viewRecords('head')">
                <span class="mdi mdi-eye-outline"></span> View Records
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal for Fill In Form -->
      <div v-if="showModal" class="hs-modal-overlay" @click.self="closeModal">
        <div class="hs-modal hs-modal-xl">
          <div class="hs-modal-header">
            <h3>{{ modalType === 'household' ? 'Household Member Profiling' : 'Household Head Profiling' }}</h3>
            <button class="hs-modal-close" @click="closeModal">&times;</button>
          </div>

          <!-- Government Header -->
          <div class="hs-gov-header" style="padding: var(--hs-space-3) var(--hs-space-6);">
            <img src="/images/agusanlogo.png" alt="Agusan" style="height: 60px;" />
            <div class="hs-gov-header-text">
              Republic of the Philippines<br />Province of Agusan del Norte<br />Municipality of Buenavista
              <div class="hs-gov-header-title">
                {{ modalType === 'household' ? 'Household Profiling' : 'Household Head Profiling' }}
              </div>
            </div>
            <img v-if="userBarangay === 'Barangay 5'" src="/images/barangaylogo.png" alt="Barangay 5" style="height: 60px;" />
            <img v-else src="/images/barangay6.png" alt="Barangay 6" style="height: 60px;" />
          </div>

          <div class="hs-modal-body" style="max-height: 60vh; overflow-y: auto;">
            <!-- Household Member Form -->
            <template v-if="modalType === 'household'">
              <form @submit.prevent="saveHousehold">
                <!-- Household Head Selection -->
                <div class="hs-form-row">
                  <div class="hs-form-group" style="grid-column: 1 / -1;">
                    <label class="hs-label">Household Head <span style="color: var(--hs-danger);">*</span></label>
                    <div class="head-search-wrapper">
                      <div class="head-search-input-row">
                        <input
                          type="text"
                          v-model="headSearchQuery"
                          class="hs-input"
                          placeholder="Search household head by name or purok..."
                          @focus="onHeadSearchFocus"
                          @blur="onHeadSearchBlur"
                          autocomplete="off"
                        />
                        <button
                          v-if="selectedHeadId"
                          type="button"
                          class="head-clear-btn"
                          @click="clearHeadSelection"
                          title="Clear selection"
                        >&times;</button>
                      </div>
                      <div v-if="selectedHeadId && !showHeadDropdown" class="head-selected-badge">
                        <span class="mdi mdi-check-circle" style="color: var(--hs-success); margin-right: 4px;"></span>
                        {{ selectedHeadLabel }}
                      </div>
                      <div v-if="showHeadDropdown" class="head-dropdown">
                        <div v-if="loadingHeads" class="head-dropdown-item head-dropdown-empty">
                          Loading household heads...
                        </div>
                        <div v-else-if="filteredHeads.length === 0" class="head-dropdown-item head-dropdown-empty">
                          No household heads found. Register one first.
                        </div>
                        <div
                          v-else
                          v-for="head in filteredHeads"
                          :key="head.id"
                          class="head-dropdown-item"
                          :class="{ 'head-dropdown-item-active': head.id === selectedHeadId }"
                          @mousedown.prevent="selectHead(head)"
                        >
                          <span class="mdi mdi-account" style="margin-right: 6px; color: var(--hs-gray-400);"></span>
                          {{ head.lastname }}, {{ head.firstname }} &mdash; {{ head.purok || 'N/A' }}
                          <span style="color: var(--hs-gray-400); margin-left: auto; font-size: var(--hs-font-size-xs);">
                            Head ID: {{ head.id }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="hs-form-row">
                  <div class="hs-form-group">
                    <label class="hs-label">Date of Visit</label>
                    <input type="date" v-model="dateVisit" class="hs-input" />
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">Barangay</label>
                    <input type="text" v-model="barangay" class="hs-input" readonly />
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">Purok</label>
                    <select v-model="purok" class="hs-select">
                      <option value="">Select Purok</option>
                      <option value="Purok 1">Purok 1</option>
                      <option value="Purok 2">Purok 2</option>
                      <option value="Purok 3">Purok 3</option>
                      <option value="Purok 4">Purok 4</option>
                    </select>
                  </div>
                </div>

                <div class="hs-form-row">
                  <div class="hs-form-group">
                    <label class="hs-label">Last Name</label>
                    <input type="text" v-model="lastname" class="hs-input" />
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">First Name</label>
                    <input type="text" v-model="firstname" class="hs-input" />
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">Middle Name</label>
                    <input type="text" v-model="middlename" class="hs-input" />
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">Suffix</label>
                    <input type="text" v-model="suffix" class="hs-input" />
                  </div>
                </div>

                <div class="hs-form-row">
                  <div class="hs-form-group">
                    <label class="hs-label">Relationship to HH Head</label>
                    <select v-model="relationship" class="hs-select">
                      <option value="">Select</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Son">Son</option>
                      <option value="Daughter">Daughter</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">Date of Birth</label>
                    <input type="date" v-model="birthdate" class="hs-input" />
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">Age</label>
                    <input type="number" v-model="age" class="hs-input" min="0" readonly />
                    <span class="hs-form-hint">Auto-calculated from birthdate</span>
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">Sex</label>
                    <select v-model="sex" class="hs-select">
                      <option value="">Select</option>
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                    </select>
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">Civil Status</label>
                    <select v-model="civilStatus" class="hs-select">
                      <option value="">Select</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Widowed">Widowed</option>
                      <option value="Separated">Separated</option>
                    </select>
                  </div>
                </div>

                <div class="hs-form-row">
                  <div class="hs-form-group">
                    <label class="hs-label">Education</label>
                    <select v-model="education" class="hs-select">
                      <option value="">Select</option>
                      <option value="Elementary">Elementary</option>
                      <option value="High School">High School</option>
                      <option value="College">College</option>
                      <option value="Vocational">Vocational</option>
                      <option value="None">None</option>
                    </select>
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">Religion</label>
                    <select v-model="religion" class="hs-select">
                      <option value="">Select</option>
                      <option value="Catholic">Catholic</option>
                      <option value="Islam">Islam</option>
                      <option value="Protestant">Protestant</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">Ethnicity</label>
                    <select v-model="ethnicity" class="hs-select">
                      <option value="">Select</option>
                      <option value="IP">IP</option>
                      <option value="Non-IP">Non-IP</option>
                    </select>
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">4PS Member</label>
                    <select v-model="is4psMember" class="hs-select">
                      <option value="">Select</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">4PS Household ID</label>
                    <input type="text" v-model="householdId4ps" class="hs-input" />
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">Philhealth ID No</label>
                    <input type="text" v-model="philhealthId" class="hs-input" />
                  </div>
                </div>

                <div class="hs-form-row">
                  <div class="hs-form-group">
                    <label class="hs-label">Membership Type</label>
                    <select v-model="membershipType" class="hs-select">
                      <option value="">Select</option>
                      <option value="M-member">M-member</option>
                      <option value="D-dependent">D-dependent</option>
                    </select>
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">Philhealth Category</label>
                    <select v-model="philhealthCategory" class="hs-select">
                      <option value="">Select</option>
                      <option value="DC">Direct Contributor</option>
                      <option value="IC">Indirect Contributor</option>
                      <option value="U">Unknown</option>
                    </select>
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">Medical History</label>
                    <select v-model="medicalHistory" class="hs-select">
                      <option value="">Select</option>
                      <option value="HPN">Hypertension</option>
                      <option value="DM">Diabetes</option>
                      <option value="TB">Tuberculosis</option>
                      <option value="O">Others</option>
                    </select>
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">Age/Health Risk Group</label>
                    <input type="text" v-model="ageGroup" class="hs-input" />
                  </div>
                </div>

                <div class="hs-form-row">
                  <div class="hs-form-group">
                    <label class="hs-label">LMP</label>
                    <input type="date" v-model="lmp" class="hs-input" />
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">Using FP Method?</label>
                    <select v-model="usingFpMethod" class="hs-select">
                      <option value="">Select</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">FP Method Used</label>
                    <input type="text" v-model="fpMethodUsed" class="hs-input" />
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">FP Status</label>
                    <input type="text" v-model="fpStatus" class="hs-input" />
                  </div>
                </div>

                <div class="hs-form-row">
                  <div class="hs-form-group">
                    <label class="hs-label">Water Source</label>
                    <input type="text" v-model="waterSource" class="hs-input" />
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">Toilet Facility</label>
                    <input type="text" v-model="toiletFacility" class="hs-input" />
                  </div>
                </div>

                <div class="hs-modal-footer" style="border: none; padding: var(--hs-space-4) 0 0;">
                  <button type="button" class="hs-btn hs-btn-secondary" @click="closeModal">Cancel</button>
                  <button type="submit" class="hs-btn hs-btn-primary">
                    <span class="mdi mdi-plus"></span> Add Member
                  </button>
                </div>
              </form>
            </template>

            <!-- Household Head Form -->
            <template v-else-if="modalType === 'head'">
              <form @submit.prevent="saveHead">
                <div class="hs-form-row">
                  <div class="hs-form-group">
                    <label class="hs-label">Barangay</label>
                    <input v-model="headBarangay" type="text" class="hs-input" readonly />
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">Purok</label>
                    <select v-model="headPurok" class="hs-select">
                      <option value="">Select Purok</option>
                      <option value="Purok 1">Purok 1</option>
                      <option value="Purok 2">Purok 2</option>
                      <option value="Purok 3">Purok 3</option>
                      <option value="Purok 4">Purok 4</option>
                    </select>
                  </div>
                </div>
                <div class="hs-form-row">
                  <div class="hs-form-group">
                    <label class="hs-label">Last Name</label>
                    <input v-model="headLastname" type="text" class="hs-input" />
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">First Name</label>
                    <input v-model="headFirstname" type="text" class="hs-input" />
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">Middle Name</label>
                    <input v-model="headMiddlename" type="text" class="hs-input" />
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">Suffix</label>
                    <input v-model="headSuffix" type="text" class="hs-input" />
                  </div>
                </div>

                <div class="hs-form-row">
                  <div class="hs-form-group">
                    <label class="hs-label">Birthdate</label>
                    <input v-model="headBirthdate" type="date" class="hs-input" />
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">Age</label>
                    <input v-model.number="headAge" type="number" class="hs-input" min="0" />
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">Sex</label>
                    <select v-model="headSex" class="hs-select">
                      <option value="">Select</option>
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                    </select>
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">Civil Status</label>
                    <select v-model="headCivilStatus" class="hs-select">
                      <option value="">Select</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Widowed">Widowed</option>
                      <option value="Separated">Separated</option>
                      <option value="Live-in">Live-in</option>
                    </select>
                  </div>
                </div>

                <div class="hs-form-row">
                  <div class="hs-form-group">
                    <label class="hs-label">Contact Number</label>
                    <input v-model="headContactNumber" type="text" class="hs-input" placeholder="e.g. 09xxxxxxxxx" />
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">Occupation</label>
                    <input v-model="headOccupation" type="text" class="hs-input" />
                  </div>
                  <div class="hs-form-group">
                    <label class="hs-label">No. of Families</label>
                    <input v-model="headFamilyCount" type="number" class="hs-input" min="0" />
                  </div>
                </div>

                <!-- Auto-calculation info note -->
                <div class="auto-calc-note">
                  <span class="mdi mdi-information-outline" style="margin-right: 6px; font-size: 16px;"></span>
                  <div>
                    <strong>Population, Female Count, and Male Count</strong> are automatically calculated from the household members added under this head. You do not need to enter them manually.
                  </div>
                </div>

                <div class="hs-modal-footer" style="border: none; padding: var(--hs-space-4) 0 0;">
                  <button type="button" class="hs-btn hs-btn-secondary" @click="closeModal">Cancel</button>
                  <button type="submit" class="hs-btn hs-btn-primary">Save Record</button>
                </div>
              </form>
            </template>
          </div>
        </div>
      </div>
    </div>
  </DashboardView>
</template>

<style scoped>
.service-page {
  max-width: var(--hs-content-max-width);
}
.service-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--hs-space-6);
}
.service-action-card {
  transition: transform var(--hs-transition-fast), box-shadow var(--hs-transition-fast);
}
.service-action-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--hs-shadow-md);
}

/* Searchable Head Dropdown */
.head-search-wrapper {
  position: relative;
}
.head-search-input-row {
  position: relative;
  display: flex;
  align-items: center;
}
.head-search-input-row .hs-input {
  padding-right: 36px;
}
.head-clear-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: var(--hs-gray-400);
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  border-radius: var(--hs-radius-sm);
  transition: color var(--hs-transition-fast);
}
.head-clear-btn:hover {
  color: var(--hs-danger);
}
.head-selected-badge {
  display: flex;
  align-items: center;
  margin-top: 5px;
  padding: 5px 8px;
  background: var(--hs-gray-50);
  border: 1px solid var(--hs-border);
  border-radius: var(--hs-radius-md);
  font-size: var(--hs-font-size-xs);
  color: var(--hs-gray-700);
}
.head-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 100;
  background: var(--hs-white);
  border: 1px solid var(--hs-border);
  border-radius: var(--hs-radius-md);
  box-shadow: var(--hs-shadow-md);
  max-height: 200px;
  overflow-y: auto;
  margin-top: 4px;
}
.head-dropdown-item {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  font-size: var(--hs-font-size-sm);
  color: var(--hs-gray-700);
  cursor: pointer;
  transition: background var(--hs-transition-fast);
}
.head-dropdown-item:hover {
  background: var(--hs-gray-50);
}
.head-dropdown-item-active {
  background: rgba(91, 132, 30, 0.08);
  font-weight: 500;
}
.head-dropdown-empty {
  color: var(--hs-gray-400);
  cursor: default;
  font-style: italic;
}
.head-dropdown-empty:hover {
  background: transparent;
}

/* Auto-calculation info note */
.auto-calc-note {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding: 10px 12px;
  margin-top: 4px;
  margin-bottom: 6px;
  background: var(--hs-info-bg);
  border: 1px solid var(--hs-info);
  border-radius: var(--hs-radius-md);
  font-size: var(--hs-font-size-xs);
  color: var(--hs-info);
  line-height: 1.5;
}
</style>
