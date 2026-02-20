<script setup>
import DashboardView from '@/components/DashboardView.vue'
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/utils/supabase.js'

const router = useRouter()
const showRecords = ref(false)
const showModal = ref(false)
const activeMenu = ref('')
const modalType = ref('')
const userRole = ref('')
const userBarangay = ref('')

// WRA form fields
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

// Cervical Cancer Screening form fields
const cervicalPurok = ref('')
const cervicalLastname = ref('')
const cervicalFirstname = ref('')
const cervicalMiddlename = ref('')
const cervicalSuffix = ref('')
const cervicalAge = ref('')
const cervicalBirthdate = ref('')
const cervicalScreened = ref('')

const purokOptions = ['Purok 1', 'Purok 2', 'Purok 3', 'Purok 4']

const goPrevPage = () => router.push('/householdprofile')
const goNextPage = () => router.push('/childcare')
const toggleRecords = () => (showRecords.value = !showRecords.value)
const openMenu = (type) => (activeMenu.value = type)
const closeMenu = () => (activeMenu.value = '')
const closeModal = () => (showModal.value = false)

const fillIn = (type) => {
  modalType.value = type
  showModal.value = true
  closeMenu()
}

const viewRecords = (type) => {
  if (type === 'wra') router.push('/maternalwrarecords')
  else if (type === 'cervical') router.push('/maternalccsrecords')
  closeMenu()
}

// Save WRA Record to Supabase
const saveWra = async () => {
  try {
    const { error } = await supabase.from('wra_records').insert([
      {
        purok: purok.value,
        lastname: lastname.value,
        firstname: firstname.value,
        middlename: middlename.value,
        suffix: suffix.value,
        age: age.value,
        birthdate: birthdate.value,
        se_status: seStatus.value,
        civil_status: civilStatus.value,
        plano_manganak: planoManganak.value,
        karun: karun.value,
        spacing: spacing.value,
        limiting: limiting.value,
        fecund: fecund.value,
        infecund: infecund.value,
        fb_method: fbMethod.value,
        fb_type: fbType.value,
        fb_date: fbDate.value || null,
        change_method: changeMethod.value,
      },
    ])

    if (error) throw error
    alert('WRA record saved successfully!')
    closeModal()
    resetWraForm()
  } catch (err) {
    console.error('Error saving WRA:', err.message)
    alert('Failed to save WRA record.')
  }
}

// Save Cervical Screening Record
const saveCervical = async () => {
  try {
    const { error } = await supabase.from('cervical_screening_records').insert([
      {
        purok: cervicalPurok.value,
        lastname: cervicalLastname.value,
        firstname: cervicalFirstname.value,
        middlename: cervicalMiddlename.value,
        suffix: cervicalSuffix.value,
        age: cervicalAge.value,
        birthdate: cervicalBirthdate.value,
        screened: cervicalScreened.value,
      },
    ])

    if (error) throw error
    alert('Cervical record saved successfully!')
    closeModal()
    resetCervicalForm()
  } catch (err) {
    console.error('Error saving Cervical:', err.message)
    alert('Failed to save Cervical record.')
  }
}

// Reset helper functions
const resetWraForm = () => {
  purok.value = ''
  lastname.value = ''
  firstname.value = ''
  middlename.value = ''
  suffix.value = ''
  age.value = ''
  birthdate.value = ''
  seStatus.value = ''
  civilStatus.value = ''
  planoManganak.value = ''
  karun.value = false
  spacing.value = false
  limiting.value = false
  fecund.value = false
  infecund.value = false
  fbMethod.value = ''
  fbType.value = ''
  fbDate.value = ''
  changeMethod.value = ''
}

const resetCervicalForm = () => {
  cervicalPurok.value = ''
  cervicalLastname.value = ''
  cervicalFirstname.value = ''
  cervicalMiddlename.value = ''
  cervicalSuffix.value = ''
  cervicalAge.value = ''
  cervicalBirthdate.value = ''
  cervicalScreened.value = ''
}

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  userRole.value = user?.user_metadata?.role || ''
  userBarangay.value = user?.user_metadata?.barangay || ''
})
</script>

<template>
  <DashboardView>
    <div class="service-page">
      <div class="hs-page-header">
        <div class="hs-breadcrumb">
          <a href="#" @click.prevent="goPrevPage">Dashboard</a>
          <span class="separator">/</span>
          <span class="current">Maternal &amp; Women Care</span>
        </div>
        <h1>Maternal &amp; Women Care Services</h1>
        <p>Promote the health and well-being of mothers and women in the community</p>
      </div>

      <div class="service-cards">
        <div class="hs-card service-action-card">
          <div class="hs-card-body" style="text-align: center; padding: var(--hs-space-8);">
            <div class="hs-stat-icon hs-stat-icon-primary" style="margin: 0 auto var(--hs-space-4); width: 56px; height: 56px; font-size: 28px;">
              <span class="mdi mdi-human-female"></span>
            </div>
            <h3 style="font-size: var(--hs-font-size-md); font-weight: 600; color: var(--hs-gray-900); margin-bottom: var(--hs-space-2);">Women of Reproductive Age</h3>
            <p style="font-size: var(--hs-font-size-sm); color: var(--hs-gray-500); margin-bottom: var(--hs-space-5);">Manage WRA records (10-49 years old)</p>
            <div style="display: flex; gap: var(--hs-space-2); justify-content: center; flex-wrap: wrap;">
              <button v-if="userRole === 'BHW'" class="hs-btn hs-btn-primary" @click="fillIn('wra')">
                <span class="mdi mdi-plus"></span> Fill In
              </button>
              <button class="hs-btn hs-btn-secondary" @click="viewRecords('wra')">
                <span class="mdi mdi-eye-outline"></span> View Records
              </button>
            </div>
          </div>
        </div>

        <div class="hs-card service-action-card">
          <div class="hs-card-body" style="text-align: center; padding: var(--hs-space-8);">
            <div class="hs-stat-icon hs-stat-icon-warning" style="margin: 0 auto var(--hs-space-4); width: 56px; height: 56px; font-size: 28px;">
              <span class="mdi mdi-ribbon"></span>
            </div>
            <h3 style="font-size: var(--hs-font-size-md); font-weight: 600; color: var(--hs-gray-900); margin-bottom: var(--hs-space-2);">Cervical Cancer Screening</h3>
            <p style="font-size: var(--hs-font-size-sm); color: var(--hs-gray-500); margin-bottom: var(--hs-space-5);">Eligible target: 30-65 year old women</p>
            <div style="display: flex; gap: var(--hs-space-2); justify-content: center; flex-wrap: wrap;">
              <button v-if="userRole === 'BHW'" class="hs-btn hs-btn-primary" @click="fillIn('cervical')">
                <span class="mdi mdi-plus"></span> Fill In
              </button>
              <button class="hs-btn hs-btn-secondary" @click="viewRecords('cervical')">
                <span class="mdi mdi-eye-outline"></span> View Records
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="showModal && modalType === 'wra'" class="hs-modal-overlay" @click.self="closeModal">
        <div class="hs-modal hs-modal-xl">
          <div class="hs-modal-header">
            <h3>Women of Reproductive Age</h3>
            <button class="hs-modal-close" @click="closeModal">&times;</button>
          </div>
          <div class="hs-gov-header" style="padding: var(--hs-space-3) var(--hs-space-6);">
            <img src="/images/agusanlogo.png" alt="Agusan" style="height: 60px;" />
            <div class="hs-gov-header-text">
              Republic of the Philippines<br />Province of Agusan del Norte<br />Municipality of Buenavista
              <div class="hs-gov-header-title">WRA LIST (10-49 YEARS OLD)</div>
            </div>
            <img v-if="userBarangay === 'Barangay 5'" src="/images/barangaylogo.png" alt="Barangay 5" style="height: 60px;" />
            <img v-else src="/images/barangay6.png" alt="Barangay 6" style="height: 60px;" />
          </div>
          <div class="hs-modal-body" style="max-height: 60vh; overflow-y: auto;">
            <form @submit.prevent="saveWra">
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Purok</label>
                  <select v-model="purok" class="hs-select"><option value="">Select Purok</option><option value="Purok 1">Purok 1</option><option value="Purok 2">Purok 2</option><option value="Purok 3">Purok 3</option><option value="Purok 4">Purok 4</option></select>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Last Name</label><input type="text" v-model="lastname" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">First Name</label><input type="text" v-model="firstname" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Middle Name</label><input type="text" v-model="middlename" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Suffix</label><input type="text" v-model="suffix" class="hs-input" /></div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Age</label><input type="number" v-model="age" class="hs-input" min="1" /></div>
                <div class="hs-form-group"><label class="hs-label">Birthdate</label><input type="date" v-model="birthdate" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">SE Status</label><input type="text" v-model="seStatus" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Civil Status</label>
                  <select v-model="civilStatus" class="hs-select"><option value="">Select</option><option value="Single">Single</option><option value="Married">Married</option><option value="Widowed">Widowed</option><option value="Separated">Separated</option></select>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Nag plano manganak</label>
                  <select v-model="planoManganak" class="hs-select"><option value="">Select</option><option value="Oo">Oo</option><option value="Dili">Dili</option></select>
                </div>
                <div class="hs-form-group hs-checkbox-row">
                  <label class="hs-label">Karun</label><input type="checkbox" v-model="karun" />
                </div>
                <div class="hs-form-group hs-checkbox-row">
                  <label class="hs-label">Spacing</label><input type="checkbox" v-model="spacing" />
                </div>
                <div class="hs-form-group hs-checkbox-row">
                  <label class="hs-label">Limiting</label><input type="checkbox" v-model="limiting" />
                </div>
                <div class="hs-form-group hs-checkbox-row">
                  <label class="hs-label">Fecund</label><input type="checkbox" v-model="fecund" />
                </div>
                <div class="hs-form-group hs-checkbox-row">
                  <label class="hs-label">Infecund</label><input type="checkbox" v-model="infecund" />
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">FB method used</label>
                  <select v-model="fbMethod" class="hs-select"><option value="">Select</option><option value="Yes">Yes</option><option value="No">No</option></select>
                </div>
                <div class="hs-form-group"><label class="hs-label">Type</label><input type="text" v-model="fbType" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Date</label><input type="date" v-model="fbDate" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Gusto mo balhin ug Method</label>
                  <div style="display:flex;gap:var(--hs-space-4);padding-top:var(--hs-space-2);">
                    <label><input type="radio" value="Yes" v-model="changeMethod" /> Yes</label>
                    <label><input type="radio" value="No" v-model="changeMethod" /> No</label>
                  </div>
                </div>
              </div>
              <div class="hs-modal-footer" style="border:none;padding:var(--hs-space-4) 0 0;">
                <button type="button" class="hs-btn hs-btn-secondary" @click="closeModal">Cancel</button>
                <button type="submit" class="hs-btn hs-btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div v-if="showModal && modalType === 'cervical'" class="hs-modal-overlay" @click.self="closeModal">
        <div class="hs-modal hs-modal-lg">
          <div class="hs-modal-header">
            <h3>Cervical Cancer Screening</h3>
            <button class="hs-modal-close" @click="closeModal">&times;</button>
          </div>
          <div class="hs-gov-header" style="padding: var(--hs-space-3) var(--hs-space-6);">
            <img src="/images/agusanlogo.png" alt="Agusan" style="height: 60px;" />
            <div class="hs-gov-header-text">
              Republic of the Philippines<br />Province of Agusan del Norte<br />Municipality of Buenavista
              <div class="hs-gov-header-title">Cervical Cancer Screening<br /><span style="font-weight:400;font-size:var(--hs-font-size-md);">Eligible Target 30-65 yrs old Women</span></div>
            </div>
            <img v-if="userBarangay === 'Barangay 5'" src="/images/barangaylogo.png" alt="Barangay 5" style="height: 60px;" />
            <img v-else src="/images/barangay6.png" alt="Barangay 6" style="height: 60px;" />
          </div>
          <div class="hs-modal-body" style="max-height: 60vh; overflow-y: auto;">
            <form @submit.prevent="saveCervical">
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Purok</label>
                  <select v-model="cervicalPurok" class="hs-select"><option value="">Select Purok</option><option value="Purok 1">Purok 1</option><option value="Purok 2">Purok 2</option><option value="Purok 3">Purok 3</option><option value="Purok 4">Purok 4</option></select>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Last Name</label><input type="text" v-model="cervicalLastname" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">First Name</label><input type="text" v-model="cervicalFirstname" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Middle Name</label><input type="text" v-model="cervicalMiddlename" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Suffix</label><input type="text" v-model="cervicalSuffix" class="hs-input" /></div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Age</label><input type="number" v-model="cervicalAge" class="hs-input" min="1" /></div>
                <div class="hs-form-group"><label class="hs-label">Birthdate</label><input type="date" v-model="cervicalBirthdate" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Screened</label>
                  <div style="display:flex;gap:var(--hs-space-4);padding-top:var(--hs-space-2);">
                    <label><input type="radio" value="Yes" v-model="cervicalScreened" /> Yes</label>
                    <label><input type="radio" value="No" v-model="cervicalScreened" /> No</label>
                  </div>
                </div>
              </div>
              <div class="hs-modal-footer" style="border:none;padding:var(--hs-space-4) 0 0;">
                <button type="button" class="hs-btn hs-btn-secondary" @click="closeModal">Cancel</button>
                <button type="submit" class="hs-btn hs-btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </DashboardView>
</template>

<style scoped>
.service-page { max-width: var(--hs-content-max-width); }
.service-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--hs-space-6); }
.service-action-card { transition: transform var(--hs-transition-fast), box-shadow var(--hs-transition-fast); }
.service-action-card:hover { transform: translateY(-2px); box-shadow: var(--hs-shadow-md); }
.hs-checkbox-row { flex-direction: row; align-items: center; gap: var(--hs-space-2); }
</style>
