<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from '@/utils/supabase.js'

const router = useRouter()
const route = useRoute()
const showRecords = ref(false)
const activeMenu = ref('')
const showModal = ref(false)
const modalType = ref('')
const userRole = ref('')
const userBarangay = ref('')

// Form fields for Deworming
const firstname = ref('')
const middlename = ref('')
const motherName = ref('')
const sex = ref('')
const birthday = ref('')
const age = ref('')
const lastname = ref('')
const purok = ref('')

const dewormingRecords = ref([])

const goPrevPage = () => {
  router.push('/childcare')
}
const toggleRecords = () => {
  showRecords.value = !showRecords.value
}
const openMenu = (type) => {
  activeMenu.value = type
}
const closeMenu = () => {
  activeMenu.value = ''
}
const fillIn = (type) => {
  modalType.value = type
  showModal.value = true
  closeMenu()
}
const viewRecords = (type) => {
  if (type === 'deworming') {
    router.push('/phsrecords')
  }
  closeMenu()
}
const closeModal = () => {
  showModal.value = false
  resetForm()
}

// Fetch deworming records from Supabase
const fetchRecords = async () => {
  const { data, error } = await supabase
    .from('deworming_records')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return console.error('Error fetching records:', error)
  dewormingRecords.value = data
}

// Insert a new record
const saveRecord = async () => {
  const { data, error } = await supabase
    .from('deworming_records')
    .insert([
      {
        firstname: firstname.value,
        middlename: middlename.value,
        mother_name: motherName.value,
        sex: sex.value,
        birthday: birthday.value,
        age: age.value,
        lastname: lastname.value,
        purok: purok.value
      }
    ])
  if (error) return console.error('Error saving record:', error)

  fetchRecords()
  closeModal()
}

// Reset form fields
const resetForm = () => {
  firstname.value = ''
  middlename.value = ''
  motherName.value = ''
  sex.value = ''
  birthday.value = ''
  age.value = ''
  lastname.value = ''
  purok.value = ''
}

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  userRole.value = user?.user_metadata?.role || ''
  userBarangay.value = user?.user_metadata?.barangay || ''

  // Auto-open modal from ServiceEligibility
  if (route.query.autoOpen === '1') {
    try {
      const raw = sessionStorage.getItem('hs_eligible_member')
      if (raw) {
        const m = JSON.parse(raw)
        lastname.value = m.lastname || ''
        firstname.value = m.firstname || ''
        middlename.value = m.middlename || ''
        sex.value = m.sex || ''
        birthday.value = m.birthdate || ''
        age.value = m.age || ''
        purok.value = m.purok || ''
        sessionStorage.removeItem('hs_eligible_member')
      }
    } catch (_) { /* ignore */ }
    await nextTick()
    fillIn('deworming')
    router.replace({ path: route.path })
  }
})
</script>

<template>
    <div class="service-page">
      <div class="hs-page-header">
        <div class="hs-breadcrumb">
          <a href="#" @click.prevent="goPrevPage">Dashboard</a>
          <span class="separator">/</span>
          <span class="current">Preventive Health</span>
        </div>
        <h1>Preventive Health Services</h1>
        <p>Protect the community by promoting healthy practices and preventing disease</p>
        <p class="hs-module-desc">Track deworming and preventive health services for community members.</p>
      </div>

      <div class="service-cards">
        <div class="hs-card service-action-card">
          <div class="hs-card-body phs-hero">
            <div class="hs-stat-icon hs-stat-icon-success phs-hero-icon">
              <span class="mdi mdi-medical-bag"></span>
            </div>
            <h3 class="phs-hero-title">Deworming (10-19 yrs old)</h3>
            <p class="phs-hero-desc">Record and manage deworming data for adolescents</p>
            <div class="phs-hero-actions">
              <button v-if="userRole === 'BHW'" class="hs-btn hs-btn-primary" @click="fillIn('deworming')">
                <span class="mdi mdi-plus"></span> Fill In
              </button>
              <button class="hs-btn hs-btn-secondary" @click="viewRecords('deworming')">
                <span class="mdi mdi-eye-outline"></span> View Records
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="showModal && modalType === 'deworming'" class="hs-modal-overlay" @click.self="closeModal">
        <div class="hs-modal hs-modal-lg">
          <div class="hs-modal-header">
            <h3>Deworming (10-19 yrs old)</h3>
            <button class="hs-modal-close" @click="closeModal">&times;</button>
          </div>
          <div class="hs-gov-header">
            <img src="/images/agusanlogo.png" alt="Agusan" class="gov-logo" />
            <div class="hs-gov-header-text">
              Republic of the Philippines<br />Province of Agusan del Norte<br />Municipality of Buenavista
              <div class="hs-gov-header-title">Deworming (10-19 yrs old)</div>
            </div>
            <img v-if="userBarangay === 'Barangay 5'" src="/images/barangaylogo.png" alt="Barangay 5" class="gov-logo" />
            <img v-else src="/images/barangay6.png" alt="Barangay 6" class="gov-logo" />
          </div>
          <div class="hs-modal-body hs-modal-body--scroll">
            <form @submit.prevent="saveRecord">
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">First Name</label><input type="text" v-model="firstname" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Middle Name</label><input type="text" v-model="middlename" class="hs-input" /></div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Name of Mother</label><input type="text" v-model="motherName" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Last Name</label><input type="text" v-model="lastname" class="hs-input" /></div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Sex</label>
                  <select v-model="sex" class="hs-select"><option value="">Select</option><option value="F">Female</option><option value="M">Male</option></select>
                </div>
                <div class="hs-form-group"><label class="hs-label">Birthday</label><input type="date" v-model="birthday" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Age</label><input type="number" v-model="age" class="hs-input" min="0" /></div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Purok</label>
                  <select v-model="purok" class="hs-select"><option value="">Select Purok</option><option value="Purok 1">Purok 1</option><option value="Purok 2">Purok 2</option><option value="Purok 3">Purok 3</option><option value="Purok 4">Purok 4</option></select>
                </div>
              </div>
              <div class="hs-modal-footer hs-modal-footer--flat">
                <button type="button" class="hs-btn hs-btn-secondary" @click="closeModal">Cancel</button>
                <button type="submit" class="hs-btn hs-btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
</template>

<style scoped>
.service-page { max-width: var(--hs-content-max-width); }
.service-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--hs-space-6); }
.service-action-card { transition: transform var(--hs-transition-fast), box-shadow var(--hs-transition-fast); }
.service-action-card:hover { transform: translateY(-2px); box-shadow: var(--hs-shadow-md); }
.phs-hero { text-align: center; padding: var(--hs-space-8); }
.phs-hero-icon { margin: 0 auto var(--hs-space-4); width: 56px; height: 56px; font-size: 28px; }
.phs-hero-title { font-size: var(--hs-font-size-md); font-weight: 600; color: var(--hs-gray-900); margin-bottom: var(--hs-space-2); }
.phs-hero-desc { font-size: var(--hs-font-size-sm); color: var(--hs-gray-500); margin-bottom: var(--hs-space-5); }
.phs-hero-actions { display: flex; gap: var(--hs-space-2); justify-content: center; flex-wrap: wrap; }
.gov-logo { height: 60px; }
</style>
