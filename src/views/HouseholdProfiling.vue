<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { supabase } from '@/utils/supabase.js'
import { calculateAge, getAgeGroupLabel, getAgeGroupKey } from '@/utils/ageClassification'
import { getEligibleServices } from '@/utils/serviceEligibility'

const toast = useToast()
const router = useRouter()
const showRecords = ref(false)
const activeMenu = ref('')
const showModal = ref(false)
const modalType = ref('')
const userRole = ref('')
const userBarangay = ref('')

const profilingTab = ref('services')

const householdHeads = ref([])
const selectedHeadId = ref('')
const headSearchQuery = ref('')
const showHeadDropdown = ref(false)
const loadingHeads = ref(false)

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

const eligibleServices = ref([])

watch(birthdate, (newVal) => {
  if (newVal) {
    const calculatedAge = calculateAge(newVal)
    age.value = calculatedAge !== null && calculatedAge >= 0 ? calculatedAge : ''

    ageGroup.value = getAgeGroupLabel(newVal)

    eligibleServices.value = getEligibleServices({
      birthdate: newVal,
      sex: sex.value,
      civil_status: civilStatus.value,
      lmp: lmp.value,
    })
  } else {
    age.value = ''
    ageGroup.value = ''
    eligibleServices.value = []
  }
})

watch([sex, civilStatus], () => {
  if (birthdate.value) {
    eligibleServices.value = getEligibleServices({
      birthdate: birthdate.value,
      sex: sex.value,
      civil_status: civilStatus.value,
      lmp: lmp.value,
    })
  }
})

const filteredHeads = computed(() => {
  if (!headSearchQuery.value) return householdHeads.value
  const q = headSearchQuery.value.toLowerCase()
  return householdHeads.value.filter((h) => {
    const label = `${h.lastname}, ${h.firstname} — ${h.purok || 'N/A'} (Head ID: ${h.head_id})`
    return label.toLowerCase().includes(q)
  })
})

const selectedHeadLabel = computed(() => {
  if (!selectedHeadId.value) return ''
  const head = householdHeads.value.find((h) => h.head_id === selectedHeadId.value)
  if (!head) return ''
  return `${head.lastname}, ${head.firstname} — ${head.purok || 'N/A'} (Head ID: ${head.head_id})`
})

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

const saveHead = async () => {
  try {
    const { data, error } = await supabase.from('household_heads').insert([
      {
        barangay: headBarangay.value,
        purok: headPurok.value,
        lastname: headLastname.value,
        firstname: headFirstname.value,
        middlename: headMiddlename.value,
        suffix: headSuffix.value,
        no_of_families: headFamilyCount.value ? parseInt(headFamilyCount.value) : null,
        birthdate: headBirthdate.value || null,
        age: headAge.value ? parseInt(headAge.value) : null,
        sex: headSex.value || null,
        civil_status: headCivilStatus.value || null,
        contact_number: headContactNumber.value || null,
        occupation: headOccupation.value || null,
        population: null,
        female_count: null,
        male_count: null,
      },
    ])

    if (error) throw error
    toast.success('Household head saved successfully!')
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
    console.error(err)
    toast.error('Error saving household head record.')
  }
}

const saveHousehold = async () => {
  try {
    if (!selectedHeadId.value) {
      toast.warning('Please select a Household Head from the dropdown.')
      return
    }

    const { data, error } = await supabase.from('household_members').insert([
      {
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
        sex: sex.value,
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
      },
    ])

    if (error) throw error
    toast.success('Household member saved successfully!')
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
    console.error(err)
    toast.error('Error saving household member record.')
  }
}

// Directory Tab
const directoryHeads = ref([])
const directoryMembers = ref({})
const expandedHeadIds = ref([])
const loadingDirectory = ref(false)
const directorySearch = ref('')

const filteredDirectoryHeads = computed(() => {
  if (!directorySearch.value.trim()) return directoryHeads.value
  const q = directorySearch.value.toLowerCase()
  return directoryHeads.value.filter(h => {
    const text = `${h.head_id} ${h.lastname} ${h.firstname} ${h.middlename || ''} ${h.purok || ''}`.toLowerCase()
    if (text.includes(q)) return true
    const members = directoryMembers.value[h.head_id] || []
    return members.some(m => `${m.lastname} ${m.firstname} ${m.middlename || ''}`.toLowerCase().includes(q))
  })
})

const loadDirectory = async () => {
  loadingDirectory.value = true
  try {
    const { data: heads, error: hErr } = await supabase.from('household_heads')
      .select('*')
      .eq('barangay', userBarangay.value)
      .eq('is_archived', false)
      .order('lastname', { ascending: true })
    if (hErr) throw hErr
    directoryHeads.value = heads || []

    const headIds = directoryHeads.value.map(h => h.head_id)
    if (headIds.length > 0) {
      const { data: members, error: mErr } = await supabase.from('household_members')
        .select('*')
        .in('head_id', headIds)
        .order('lastname', { ascending: true })
      if (mErr) throw mErr
      const grouped = {}
      for (const m of members || []) {
        if (!grouped[m.head_id]) grouped[m.head_id] = []
        grouped[m.head_id].push(m)
      }
      directoryMembers.value = grouped
    }
  } catch (err) {
    console.error('Failed to load directory', err)
    toast.error('Failed to load directory data.')
  } finally {
    loadingDirectory.value = false
  }
}

const toggleHead = (headId) => {
  const idx = expandedHeadIds.value.indexOf(headId)
  if (idx >= 0) expandedHeadIds.value.splice(idx, 1)
  else expandedHeadIds.value.push(headId)
}

watch(profilingTab, (val) => {
  if (val === 'directory' && directoryHeads.value.length === 0) {
    loadDirectory()
  }
})

// Quick-Add Record
const showRecordSelector = ref(false)
const quickAddPerson = ref(null)
const selectedRecordType = ref('')
const showQuickAddForm = ref(false)
const quickAddForm = ref({})
const savingQuickAdd = ref(false)

const recordTypeOptions = [
  { value: 'wra', label: 'WRA Record', icon: 'mdi-human-female', desc: 'Women of Reproductive Age' },
  { value: 'cervical', label: 'Cervical Screening', icon: 'mdi-shield-check', desc: 'Cervical Cancer Screening' },
  { value: 'familyplanning', label: 'Family Planning', icon: 'mdi-account-heart', desc: 'Family Planning Services' },
  { value: 'childcare', label: 'Childcare (Vitamin A)', icon: 'mdi-baby-face-outline', desc: 'Vitamin A Supplementation' },
  { value: 'deworming', label: 'Deworming', icon: 'mdi-medical-bag', desc: 'Preventive Health / Deworming' },
]

const openRecordSelector = (person, type, headPurok) => {
  quickAddPerson.value = { type, data: { ...person }, headPurok: headPurok || person.purok || '' }
  selectedRecordType.value = ''
  showRecordSelector.value = true
}

const proceedToForm = () => {
  if (!selectedRecordType.value) { toast.warning('Please select a record type.'); return }
  showRecordSelector.value = false

  const p = quickAddPerson.value.data
  const purok = quickAddPerson.value.headPurok

  if (selectedRecordType.value === 'wra') {
    quickAddForm.value = {
      purok: purok, lastname: p.lastname || '', firstname: p.firstname || '',
      middlename: p.middlename || '', suffix: p.suffix || '',
      age: p.age != null ? p.age : '', birthdate: p.birthdate || '',
      seStatus: '', civilStatus: p.civil_status || '',
      planoManganak: '', karun: false, spacing: false, limiting: false,
      fecund: false, infecund: false,
      fbMethod: '', fbType: '', fbDate: '', changeMethod: ''
    }
  } else if (selectedRecordType.value === 'cervical') {
    quickAddForm.value = {
      purok: purok, lastname: p.lastname || '', firstname: p.firstname || '',
      middlename: p.middlename || '', suffix: p.suffix || '',
      age: p.age != null ? p.age : '', birthdate: p.birthdate || '',
      screened: ''
    }
  } else if (selectedRecordType.value === 'familyplanning') {
    quickAddForm.value = {
      purok: purok, surname: p.lastname || '', firstname: p.firstname || '',
      motherName: '', sex: p.sex || '', birthday: p.birthdate || '',
      age: p.age != null ? p.age : ''
    }
  } else if (selectedRecordType.value === 'childcare') {
    quickAddForm.value = {
      purok: purok, lastname: p.lastname || '', firstname: p.firstname || '',
      middlename: p.middlename || '', suffix: p.suffix || '',
      age: p.age != null ? p.age : '', birthdate: p.birthdate || '',
      gender: p.sex || '', motherName: ''
    }
  } else if (selectedRecordType.value === 'deworming') {
    quickAddForm.value = {
      purok: purok, lastname: p.lastname || '', firstname: p.firstname || '',
      middlename: p.middlename || '', motherName: '',
      sex: p.sex || '', birthday: p.birthdate || '',
      age: p.age != null ? p.age : ''
    }
  }

  showQuickAddForm.value = true
}

const saveQuickAddRecord = async () => {
  savingQuickAdd.value = true
  try {
    const f = quickAddForm.value
    let table, payload

    if (selectedRecordType.value === 'wra') {
      table = 'wra_records'
      payload = {
        purok: f.purok, lastname: f.lastname, firstname: f.firstname,
        middlename: f.middlename, suffix: f.suffix,
        age: f.age !== '' ? parseInt(f.age) : null,
        birthdate: f.birthdate || null, se_status: f.seStatus,
        civil_status: f.civilStatus, plano_manganak: f.planoManganak,
        karun: f.karun, spacing: f.spacing, limiting: f.limiting,
        fecund: f.fecund, infecund: f.infecund,
        fb_method: f.fbMethod, fb_type: f.fbType,
        fb_date: f.fbDate || null, change_method: f.changeMethod
      }
    } else if (selectedRecordType.value === 'cervical') {
      table = 'cervical_screening_records'
      payload = {
        purok: f.purok, lastname: f.lastname, firstname: f.firstname,
        middlename: f.middlename, suffix: f.suffix,
        age: f.age !== '' ? parseInt(f.age) : null,
        birthdate: f.birthdate || null, screened: f.screened
      }
    } else if (selectedRecordType.value === 'familyplanning') {
      table = 'family_planning_records'
      payload = {
        purok: f.purok, surname: f.surname, firstname: f.firstname,
        mother_name: f.motherName, sex: f.sex,
        birthday: f.birthday || null,
        age: f.age !== '' ? parseInt(f.age) : null
      }
    } else if (selectedRecordType.value === 'childcare') {
      table = 'childcare_vitamina_records'
      payload = {
        purok: f.purok, lastname: f.lastname, firstname: f.firstname,
        middlename: f.middlename, suffix: f.suffix,
        age: f.age !== '' ? parseInt(f.age) : null,
        birthdate: f.birthdate || null, gender: f.gender,
        mother_name: f.motherName
      }
    } else if (selectedRecordType.value === 'deworming') {
      table = 'deworming_records'
      payload = {
        purok: f.purok, lastname: f.lastname, firstname: f.firstname,
        middlename: f.middlename, mother_name: f.motherName,
        sex: f.sex, birthday: f.birthday || null,
        age: f.age !== '' ? parseInt(f.age) : null
      }
    }

    const { error } = await supabase.from(table).insert([payload])
    if (error) throw error

    const labels = { wra: 'WRA', cervical: 'Cervical Screening', familyplanning: 'Family Planning', childcare: 'Childcare', deworming: 'Deworming' }
    toast.success(`${labels[selectedRecordType.value]} record saved successfully!`)
    showQuickAddForm.value = false
  } catch (err) {
    console.error('Failed to save quick-add record', err)
    toast.error('Failed to save record: ' + (err.message || err))
  } finally {
    savingQuickAdd.value = false
  }
}
</script>

<template>
    <div class="service-page">
      <!-- Page Header -->
      <div class="hs-page-header">
        <div class="hs-breadcrumb">
          <a href="#" @click.prevent="goPrevPage">Dashboard</a>
          <span class="separator">/</span>
          <span class="current">Household Profiling</span>
        </div>
        <h1>Household Profiling Services</h1>
        <p class="hs-module-desc">Manage household head information and family members within the barangay.</p>
        <p>Gather and organize essential information about families in the community</p>
      </div>

      <!-- Tab Navigation -->
      <div class="hs-tabs">
        <button class="hs-tab" :class="{ active: profilingTab === 'services' }" @click="profilingTab = 'services'">
          <span class="mdi mdi-clipboard-text-outline"></span> Services
        </button>
        <button class="hs-tab" :class="{ active: profilingTab === 'directory' }" @click="profilingTab = 'directory'">
          <span class="mdi mdi-account-group"></span> Members &amp; Heads Directory
        </button>
      </div>

      <!-- Services Tab -->
      <div v-if="profilingTab === 'services'">
      <!-- Action Cards -->
      <div class="service-cards">
        <div class="hs-card service-action-card">
          <div class="hs-card-body svc-hero">
            <div class="hs-stat-icon hs-stat-icon-primary svc-hero-icon">
              <span class="mdi mdi-account-multiple-plus"></span>
            </div>
            <h3 class="svc-hero-title">Household Member Profiling</h3>
            <p class="svc-hero-desc">Add individual household member records and profiling data</p>
            <button v-if="userRole === 'BHW'" class="hs-btn hs-btn-primary" @click="fillIn('household')">
              <span class="mdi mdi-plus"></span> Fill In Form
            </button>
          </div>
        </div>

        <div class="hs-card service-action-card">
          <div class="hs-card-body svc-hero">
            <div class="hs-stat-icon hs-stat-icon-info svc-hero-icon">
              <span class="mdi mdi-home-account"></span>
            </div>
            <h3 class="svc-hero-title">Household Head Profiling</h3>
            <p class="svc-hero-desc">Register and manage household head information</p>
            <div class="svc-hero-actions">
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
      </div><!-- end services tab -->

      <!-- Directory Tab -->
      <div v-if="profilingTab === 'directory'">
        <div class="inv-toolbar">
          <div class="inv-toolbar-left">
            <div class="hs-search-box">
              <span class="mdi mdi-magnify"></span>
              <input v-model="directorySearch" type="search" placeholder="Search..." />
            </div>
          </div>
          <div class="inv-toolbar-right">
            <span class="inv-count-label">{{ filteredDirectoryHeads.length }} household(s)</span>
            <button class="hs-btn hs-btn-secondary" @click="loadDirectory">
              <span class="mdi mdi-refresh"></span> Refresh
            </button>
          </div>
        </div>

        <div v-if="loadingDirectory" class="dir-loading">
          <span class="mdi mdi-loading mdi-spin"></span> Loading directory...
        </div>

        <div v-else-if="filteredDirectoryHeads.length === 0" class="dir-empty">
          <span class="mdi mdi-account-group-outline"></span>
          <p>No household heads found.</p>
        </div>

        <div v-else class="dir-list">
          <div v-for="head in filteredDirectoryHeads" :key="head.head_id" class="dir-head-card">
            <div class="dir-head-row" @click="toggleHead(head.head_id)">
              <span class="mdi" :class="expandedHeadIds.includes(head.head_id) ? 'mdi-chevron-down' : 'mdi-chevron-right'" style="font-size:18px;color:var(--hs-gray-400);"></span>
              <div class="dir-head-icon"><span class="mdi mdi-home-account"></span></div>
              <div class="dir-head-info">
                <strong>{{ head.lastname }}, {{ head.firstname }} {{ head.middlename || '' }} {{ head.suffix || '' }}</strong>
                <span class="dir-head-meta">{{ head.purok || 'No Purok' }} &bull; Head ID: {{ head.head_id }} &bull; {{ (directoryMembers[head.head_id] || []).length }} member(s)</span>
              </div>
              <button v-if="userRole === 'BHW'" class="hs-btn hs-btn-sm hs-btn-primary" @click.stop="openRecordSelector(head, 'head', head.purok)" title="Quick Add Record">
                <span class="mdi mdi-plus-circle-outline"></span> Add Record
              </button>
            </div>

            <div v-if="expandedHeadIds.includes(head.head_id)" class="dir-members">
              <div v-if="!directoryMembers[head.head_id] || directoryMembers[head.head_id].length === 0" class="dir-member-empty">
                No members registered under this household head.
              </div>
              <div v-for="member in (directoryMembers[head.head_id] || [])" :key="member.member_id" class="dir-member-row">
                <div class="dir-member-icon"><span class="mdi mdi-account"></span></div>
                <div class="dir-member-info">
                  <strong>{{ member.lastname }}, {{ member.firstname }} {{ member.middlename || '' }}</strong>
                  <span class="dir-member-meta">
                    {{ member.sex || '—' }} &bull; Age: {{ member.age ?? '—' }} &bull; {{ member.relationship || '—' }} &bull; {{ member.civil_status || '—' }}
                  </span>
                </div>
                <button v-if="userRole === 'BHW'" class="hs-btn hs-btn-sm hs-btn-primary" @click.stop="openRecordSelector(member, 'member', head.purok)" title="Quick Add Record">
                  <span class="mdi mdi-plus-circle-outline"></span> Add Record
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Record Type Selector Modal -->
      <div v-if="showRecordSelector" class="hs-modal-overlay" @click.self="showRecordSelector = false">
        <div class="hs-modal hs-modal-md">
          <div class="hs-modal-header">
            <h3>Select Record Type</h3>
            <button class="hs-modal-close" @click="showRecordSelector = false">&times;</button>
          </div>
          <div class="hs-modal-body">
            <p class="hs-text-sm" style="margin-bottom:12px;color:var(--hs-gray-500);">
              Adding record for: <strong>{{ quickAddPerson?.data?.lastname }}, {{ quickAddPerson?.data?.firstname }}</strong>
            </p>
            <div class="record-type-grid">
              <div v-for="opt in recordTypeOptions" :key="opt.value"
                class="record-type-option"
                :class="{ 'record-type-option--active': selectedRecordType === opt.value }"
                @click="selectedRecordType = opt.value">
                <span class="mdi" :class="opt.icon" style="font-size:24px;"></span>
                <strong>{{ opt.label }}</strong>
                <span class="record-type-desc">{{ opt.desc }}</span>
              </div>
            </div>
          </div>
          <div class="hs-modal-footer">
            <button class="hs-btn hs-btn-secondary" @click="showRecordSelector = false">Cancel</button>
            <button class="hs-btn hs-btn-primary" :disabled="!selectedRecordType" @click="proceedToForm">
              <span class="mdi mdi-arrow-right"></span> Proceed
            </button>
          </div>
        </div>
      </div>

      <!-- Quick Add Form Modal -->
      <div v-if="showQuickAddForm" class="hs-modal-overlay" @click.self="showQuickAddForm = false">
        <div class="hs-modal hs-modal-xl">
          <div class="hs-modal-header">
            <h3>
              {{ selectedRecordType === 'wra' ? 'WRA Record' :
                 selectedRecordType === 'cervical' ? 'Cervical Screening' :
                 selectedRecordType === 'familyplanning' ? 'Family Planning' :
                 selectedRecordType === 'childcare' ? 'Childcare (Vitamin A)' : 'Deworming' }}
              — Quick Add
            </h3>
            <button class="hs-modal-close" @click="showQuickAddForm = false">&times;</button>
          </div>
          <div class="hs-modal-body hs-modal-body--scroll">

            <!-- WRA Form -->
            <form v-if="selectedRecordType === 'wra'" @submit.prevent="saveQuickAddRecord">
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Purok</label><input v-model="quickAddForm.purok" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Last Name</label><input v-model="quickAddForm.lastname" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">First Name</label><input v-model="quickAddForm.firstname" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Middle Name</label><input v-model="quickAddForm.middlename" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Suffix</label><input v-model="quickAddForm.suffix" class="hs-input" /></div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Age</label><input v-model.number="quickAddForm.age" type="number" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Birthdate</label><input v-model="quickAddForm.birthdate" type="date" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">SE Status</label>
                  <select v-model="quickAddForm.seStatus" class="hs-select"><option value="">Select</option><option value="P">P</option><option value="NP">NP</option></select>
                </div>
                <div class="hs-form-group"><label class="hs-label">Civil Status</label>
                  <select v-model="quickAddForm.civilStatus" class="hs-select"><option value="">Select</option><option value="Single">Single</option><option value="Married">Married</option><option value="Widowed">Widowed</option><option value="Separated">Separated</option><option value="Live-in">Live-in</option></select>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Plano Manganak</label><input v-model="quickAddForm.planoManganak" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">FB Method</label><input v-model="quickAddForm.fbMethod" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">FB Type</label><input v-model="quickAddForm.fbType" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">FB Date</label><input v-model="quickAddForm.fbDate" type="date" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Change Method</label><input v-model="quickAddForm.changeMethod" class="hs-input" /></div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-checkbox-label"><input type="checkbox" v-model="quickAddForm.karun" /> Karun</label></div>
                <div class="hs-form-group"><label class="hs-checkbox-label"><input type="checkbox" v-model="quickAddForm.spacing" /> Spacing</label></div>
                <div class="hs-form-group"><label class="hs-checkbox-label"><input type="checkbox" v-model="quickAddForm.limiting" /> Limiting</label></div>
                <div class="hs-form-group"><label class="hs-checkbox-label"><input type="checkbox" v-model="quickAddForm.fecund" /> Fecund</label></div>
                <div class="hs-form-group"><label class="hs-checkbox-label"><input type="checkbox" v-model="quickAddForm.infecund" /> Infecund</label></div>
              </div>
              <div class="hs-modal-footer hs-modal-footer--flat">
                <button type="button" class="hs-btn hs-btn-secondary" @click="showQuickAddForm = false">Cancel</button>
                <button type="submit" class="hs-btn hs-btn-primary" :disabled="savingQuickAdd"><span class="mdi mdi-content-save"></span> Save WRA Record</button>
              </div>
            </form>

            <!-- Cervical Form -->
            <form v-else-if="selectedRecordType === 'cervical'" @submit.prevent="saveQuickAddRecord">
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Purok</label><input v-model="quickAddForm.purok" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Last Name</label><input v-model="quickAddForm.lastname" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">First Name</label><input v-model="quickAddForm.firstname" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Middle Name</label><input v-model="quickAddForm.middlename" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Suffix</label><input v-model="quickAddForm.suffix" class="hs-input" /></div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Age</label><input v-model.number="quickAddForm.age" type="number" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Birthdate</label><input v-model="quickAddForm.birthdate" type="date" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Screened</label>
                  <select v-model="quickAddForm.screened" class="hs-select"><option value="">Select</option><option value="Yes">Yes</option><option value="No">No</option></select>
                </div>
              </div>
              <div class="hs-modal-footer hs-modal-footer--flat">
                <button type="button" class="hs-btn hs-btn-secondary" @click="showQuickAddForm = false">Cancel</button>
                <button type="submit" class="hs-btn hs-btn-primary" :disabled="savingQuickAdd"><span class="mdi mdi-content-save"></span> Save Cervical Record</button>
              </div>
            </form>

            <!-- Family Planning Form -->
            <form v-else-if="selectedRecordType === 'familyplanning'" @submit.prevent="saveQuickAddRecord">
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Purok</label><input v-model="quickAddForm.purok" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Surname</label><input v-model="quickAddForm.surname" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">First Name</label><input v-model="quickAddForm.firstname" class="hs-input" /></div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Mother Name</label><input v-model="quickAddForm.motherName" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Sex</label>
                  <select v-model="quickAddForm.sex" class="hs-select"><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option></select>
                </div>
                <div class="hs-form-group"><label class="hs-label">Birthday</label><input v-model="quickAddForm.birthday" type="date" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Age</label><input v-model.number="quickAddForm.age" type="number" class="hs-input" /></div>
              </div>
              <div class="hs-modal-footer hs-modal-footer--flat">
                <button type="button" class="hs-btn hs-btn-secondary" @click="showQuickAddForm = false">Cancel</button>
                <button type="submit" class="hs-btn hs-btn-primary" :disabled="savingQuickAdd"><span class="mdi mdi-content-save"></span> Save Family Planning Record</button>
              </div>
            </form>

            <!-- Childcare Form -->
            <form v-else-if="selectedRecordType === 'childcare'" @submit.prevent="saveQuickAddRecord">
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Purok</label><input v-model="quickAddForm.purok" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Last Name</label><input v-model="quickAddForm.lastname" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">First Name</label><input v-model="quickAddForm.firstname" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Middle Name</label><input v-model="quickAddForm.middlename" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Suffix</label><input v-model="quickAddForm.suffix" class="hs-input" /></div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Age</label><input v-model.number="quickAddForm.age" type="number" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Birthdate</label><input v-model="quickAddForm.birthdate" type="date" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Gender</label>
                  <select v-model="quickAddForm.gender" class="hs-select"><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option></select>
                </div>
                <div class="hs-form-group"><label class="hs-label">Mother Name</label><input v-model="quickAddForm.motherName" class="hs-input" /></div>
              </div>
              <div class="hs-modal-footer hs-modal-footer--flat">
                <button type="button" class="hs-btn hs-btn-secondary" @click="showQuickAddForm = false">Cancel</button>
                <button type="submit" class="hs-btn hs-btn-primary" :disabled="savingQuickAdd"><span class="mdi mdi-content-save"></span> Save Childcare Record</button>
              </div>
            </form>

            <!-- Deworming Form -->
            <form v-else-if="selectedRecordType === 'deworming'" @submit.prevent="saveQuickAddRecord">
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Purok</label><input v-model="quickAddForm.purok" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Last Name</label><input v-model="quickAddForm.lastname" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">First Name</label><input v-model="quickAddForm.firstname" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Middle Name</label><input v-model="quickAddForm.middlename" class="hs-input" /></div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Mother Name</label><input v-model="quickAddForm.motherName" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Sex</label>
                  <select v-model="quickAddForm.sex" class="hs-select"><option value="">Select</option><option value="M">Male</option><option value="F">Female</option></select>
                </div>
                <div class="hs-form-group"><label class="hs-label">Birthday</label><input v-model="quickAddForm.birthday" type="date" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Age</label><input v-model.number="quickAddForm.age" type="number" class="hs-input" /></div>
              </div>
              <div class="hs-modal-footer hs-modal-footer--flat">
                <button type="button" class="hs-btn hs-btn-secondary" @click="showQuickAddForm = false">Cancel</button>
                <button type="submit" class="hs-btn hs-btn-primary" :disabled="savingQuickAdd"><span class="mdi mdi-content-save"></span> Save Deworming Record</button>
              </div>
            </form>

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
          <div class="hs-gov-header">
            <img src="/images/agusanlogo.png" alt="Agusan" class="gov-logo" />
            <div class="hs-gov-header-text">
              Republic of the Philippines<br />Province of Agusan del Norte<br />Municipality of Buenavista
              <div class="hs-gov-header-title">
                {{ modalType === 'household' ? 'Household Profiling' : 'Household Head Profiling' }}
              </div>
            </div>
            <img v-if="userBarangay === 'Barangay 5'" src="/images/barangaylogo.png" alt="Barangay 5" class="gov-logo" />
            <img v-else src="/images/barangay6.png" alt="Barangay 6" class="gov-logo" />
          </div>

          <div class="hs-modal-body hs-modal-body--scroll">
            <!-- Household Member Form -->
            <template v-if="modalType === 'household'">
              <form @submit.prevent="saveHousehold">
                <!-- Household Head Selection -->
                <div class="hs-form-row">
                  <div class="hs-form-group form-group-full">
                    <label class="hs-label">Household Head <span class="hs-text-danger">*</span></label>
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
                        <span class="mdi mdi-check-circle hs-text-success"></span>
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
                          :key="head.head_id"
                          class="head-dropdown-item"
                          :class="{ 'head-dropdown-item-active': head.head_id === selectedHeadId }"
                          @mousedown.prevent="selectHead(head)"
                        >
                          <span class="mdi mdi-account hs-text-muted"></span>
                          {{ head.lastname }}, {{ head.firstname }} &mdash; {{ head.purok || 'N/A' }}
                          <span class="purok-label">
                            Head ID: {{ head.head_id }}
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
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
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
                    <input type="text" v-model="ageGroup" class="hs-input" readonly :style="{ backgroundColor: '#f5f5f5' }" />
                    <small v-if="ageGroup" class="hs-hint" style="color: var(--hs-success); margin-top: 2px;">
                      <span class="mdi mdi-check-circle"></span> Auto-classified from birthdate
                    </small>
                  </div>
                </div>

                <!-- Eligible Services (auto-detected) -->
                <div v-if="eligibleServices.length > 0" class="hs-eligible-services" style="margin: 12px 0; padding: 12px 16px; background: #f0f7ff; border-radius: 8px; border-left: 3px solid var(--hs-primary);">
                  <div style="font-weight: 600; font-size: 13px; margin-bottom: 6px; color: var(--hs-primary);">
                    <span class="mdi mdi-clipboard-check-outline"></span> Eligible Services (Auto-Detected)
                  </div>
                  <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                    <span
                      v-for="svc in eligibleServices"
                      :key="svc.key"
                      style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; background: white; border-radius: 14px; font-size: 12px; font-weight: 500; border: 1px solid #e0e0e0;"
                    >
                      <span :class="'mdi ' + svc.icon" style="font-size: 14px;"></span>
                      {{ svc.label }}
                    </span>
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

                <div class="hs-modal-footer hs-modal-footer--flat">
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
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
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

                <div class="hs-modal-footer hs-modal-footer--flat">
                  <button type="button" class="hs-btn hs-btn-secondary" @click="closeModal">Cancel</button>
                  <button type="submit" class="hs-btn hs-btn-primary">Save Record</button>
                </div>
              </form>
            </template>
          </div>
        </div>
      </div>
    </div>
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
.svc-hero { text-align: center; padding: var(--hs-space-8); }
.svc-hero-icon { margin: 0 auto var(--hs-space-4); width: 56px; height: 56px; font-size: 28px; }
.svc-hero-title { font-size: var(--hs-font-size-md); font-weight: 600; color: var(--hs-gray-900); margin-bottom: var(--hs-space-2); }
.svc-hero-desc { font-size: var(--hs-font-size-sm); color: var(--hs-gray-500); margin-bottom: var(--hs-space-5); }
.svc-hero-actions { display: flex; gap: var(--hs-space-2); justify-content: center; flex-wrap: wrap; }
.gov-logo { height: 60px; }
.form-group-full { grid-column: 1 / -1; }
.hs-text-danger { color: var(--hs-danger); }
.hs-text-success { color: var(--hs-success); }
.hs-text-muted { color: var(--hs-gray-400); }
.purok-label { color: var(--hs-gray-400); margin-left: auto; font-size: var(--hs-font-size-xs); }

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

/* Directory Tab styles */
.inv-toolbar { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; flex-wrap: wrap; gap: 8px; }
.inv-toolbar-left { display: flex; align-items: center; gap: 8px; }
.inv-toolbar-right { display: flex; align-items: center; gap: 10px; }
.inv-count-label { font-size: var(--hs-font-size-xs); color: var(--hs-gray-400); }

.dir-loading { text-align: center; padding: 48px 20px; color: var(--hs-gray-400); font-size: var(--hs-font-size-sm); }
.dir-loading .mdi { font-size: 24px; margin-right: 6px; }
.dir-empty { text-align: center; padding: 48px 20px; color: var(--hs-gray-400); }
.dir-empty .mdi { font-size: 40px; display: block; margin-bottom: 8px; opacity: 0.4; }
.dir-empty p { font-size: var(--hs-font-size-sm); margin: 0; }

.dir-list { display: flex; flex-direction: column; gap: 8px; }

.dir-head-card {
  background: var(--hs-white);
  border: 1px solid var(--hs-gray-100);
  border-radius: var(--hs-radius-lg);
  overflow: hidden;
}
.dir-head-row {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px; cursor: pointer;
  transition: background 100ms ease;
}
.dir-head-row:hover { background: var(--hs-gray-50); }
.dir-head-icon {
  width: 34px; height: 34px; border-radius: var(--hs-radius-md);
  background: var(--hs-primary-bg); color: var(--hs-primary);
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; flex-shrink: 0;
}
.dir-head-info { flex: 1; min-width: 0; }
.dir-head-info strong { display: block; font-size: var(--hs-font-size-sm); color: var(--hs-gray-800); }
.dir-head-meta { font-size: 11px; color: var(--hs-gray-400); }

.dir-members {
  border-top: 1px solid var(--hs-gray-100);
  background: var(--hs-gray-50);
  padding: 8px 16px 8px 60px;
}
.dir-member-empty {
  font-size: var(--hs-font-size-xs); color: var(--hs-gray-400);
  font-style: italic; padding: 8px 0;
}
.dir-member-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--hs-gray-100);
}
.dir-member-row:last-child { border-bottom: none; }
.dir-member-icon {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--hs-info-bg); color: var(--hs-info);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; flex-shrink: 0;
}
.dir-member-info { flex: 1; min-width: 0; }
.dir-member-info strong { display: block; font-size: var(--hs-font-size-xs); color: var(--hs-gray-700); }
.dir-member-meta { font-size: 10px; color: var(--hs-gray-400); }

/* Record Type Selector Grid */
.record-type-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px;
}
.record-type-option {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 16px 10px; border: 2px solid var(--hs-gray-100);
  border-radius: var(--hs-radius-lg); cursor: pointer; text-align: center;
  transition: border-color 100ms, background 100ms;
}
.record-type-option:hover { border-color: var(--hs-gray-300); background: var(--hs-gray-50); }
.record-type-option--active { border-color: var(--hs-primary); background: var(--hs-primary-bg); }
.record-type-option strong { font-size: var(--hs-font-size-xs); color: var(--hs-gray-800); }
.record-type-desc { font-size: 10px; color: var(--hs-gray-400); }

.hs-checkbox-label { display: flex; align-items: center; gap: 6px; font-size: var(--hs-font-size-sm); cursor: pointer; }
.hs-text-sm { font-size: var(--hs-font-size-sm); }

@media (max-width: 640px) {
  .dir-members { padding-left: 16px; }
  .record-type-grid { grid-template-columns: 1fr 1fr; }
  .inv-toolbar { flex-direction: column; align-items: stretch; }
}
</style>
