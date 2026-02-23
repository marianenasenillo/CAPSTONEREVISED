<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from '@/utils/supabase.js'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const router = useRouter()
const route = useRoute()
const showRecords = ref(false)
const activeMenu = ref('')
const showModal = ref(false)
const modalType = ref('')
const userRole = ref('')
const userBarangay = ref('')

const goPrevPage = () => router.push('/maternalservices')
const goNextPage = () => router.push('/preventivehealthservices')
const toggleRecords = () => showRecords.value = !showRecords.value
const openMenu = (type) => activeMenu.value = type
const closeMenu = () => activeMenu.value = ''
const fillIn = (type) => { modalType.value = type; showModal.value = true; closeMenu() }
const viewRecords = (type) => { if (type === 'vitamina') router.push('/childcarerecords'); closeMenu() }
const closeModal = () => showModal.value = false

// Vitamin A Supplementation form fields
const purok = ref('')
const lastname = ref('')
const firstname = ref('')
const middlename = ref('')
const suffix = ref('')
const age = ref('')
const birthdate = ref('')
const gender = ref('')
const motherName = ref('')

// Function to save form to database
const saveVitaminaRecord = async () => {
  if (!lastname.value || !firstname.value || !age.value || !birthdate.value || !gender.value || !motherName.value) {
    toast.warning('Please fill in all required fields.')
    return
  }

  const { data, error } = await supabase
    .from('childcare_vitamina_records')
    .insert([{
      purok: purok.value,
      lastname: lastname.value,
      firstname: firstname.value,
      middlename: middlename.value,
      suffix: suffix.value,
      age: age.value,
      birthdate: birthdate.value,
      gender: gender.value,
      mother_name: motherName.value
    }])

  if (error) {
    console.error('Error saving record:', error)
    toast.error('Failed to save record.')
  } else {
    toast.success('Record saved successfully!')
    purok.value = ''
    lastname.value = ''
    firstname.value = ''
    middlename.value = ''
    suffix.value = ''
    age.value = ''
    birthdate.value = ''
    gender.value = ''
    motherName.value = ''
    closeModal()
  }
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
        purok.value = m.purok || ''
        lastname.value = m.lastname || ''
        firstname.value = m.firstname || ''
        middlename.value = m.middlename || ''
        suffix.value = m.suffix || ''
        age.value = m.age || ''
        birthdate.value = m.birthdate || ''
        gender.value = m.sex || ''
        sessionStorage.removeItem('hs_eligible_member')
      }
    } catch (_) { /* ignore */ }
    await nextTick()
    fillIn('vitamina')
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
          <span class="current">Child Care</span>
        </div>
        <h1>Child Care Services</h1>
        <p class="hs-module-desc">Track immunization, nutrition, and health monitoring for children.</p>
        <p>Safeguard the health and development of children in the community</p>
      </div>

      <div class="service-cards">
        <div class="hs-card service-action-card">
          <div class="hs-card-body svc-hero">
            <div class="hs-stat-icon hs-stat-icon-warning svc-hero-icon">
              <span class="mdi mdi-pill"></span>
            </div>
            <h3 class="svc-hero-title">Vitamin A Supplementation</h3>
            <p class="svc-hero-desc">Record Vitamin A supplementation for children (1-4 yrs old)</p>
            <div class="svc-hero-actions">
              <button v-if="userRole === 'BHW'" class="hs-btn hs-btn-primary" @click="fillIn('vitamina')">
                <span class="mdi mdi-plus"></span> Fill In
              </button>
              <button class="hs-btn hs-btn-secondary" @click="viewRecords('vitamina')">
                <span class="mdi mdi-eye-outline"></span> View Records
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="showModal && modalType === 'vitamina'" class="hs-modal-overlay" @click.self="closeModal">
        <div class="hs-modal hs-modal-lg">
          <div class="hs-modal-header">
            <h3>Vitamin A Supplementation</h3>
            <button class="hs-modal-close" @click="closeModal">&times;</button>
          </div>
          <div class="hs-gov-header">
            <img src="/images/agusanlogo.png" alt="Agusan" class="gov-logo" />
            <div class="hs-gov-header-text">
              Republic of the Philippines<br />Province of Agusan del Norte<br />Municipality of Buenavista
              <div class="hs-gov-header-title">Vitamin A Supplementation (1-4 yrs old)</div>
            </div>
            <img v-if="userBarangay === 'Barangay 5'" src="/images/barangaylogo.png" alt="Barangay 5" class="gov-logo" />
            <img v-else src="/images/barangay6.png" alt="Barangay 6" class="gov-logo" />
          </div>
          <div class="hs-modal-body hs-modal-body--scroll">
            <form @submit.prevent="saveVitaminaRecord">
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Purok</label><input type="text" v-model="purok" class="hs-input" /></div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Last Name</label><input type="text" v-model="lastname" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">First Name</label><input type="text" v-model="firstname" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Middle Name</label><input type="text" v-model="middlename" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Suffix</label><input type="text" v-model="suffix" class="hs-input" /></div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Age</label><input type="number" v-model="age" class="hs-input" min="0" /></div>
                <div class="hs-form-group"><label class="hs-label">Birthdate</label><input type="date" v-model="birthdate" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Gender</label>
                  <select v-model="gender" class="hs-select"><option value="">Select</option><option value="F">Female</option><option value="M">Male</option></select>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group" style="flex:2;"><label class="hs-label">Full name of Mother</label><input type="text" v-model="motherName" class="hs-input" /></div>
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
.svc-hero { text-align: center; padding: var(--hs-space-8); }
.svc-hero-icon { margin: 0 auto var(--hs-space-4); width: 56px; height: 56px; font-size: 28px; }
.svc-hero-title { font-size: var(--hs-font-size-md); font-weight: 600; color: var(--hs-gray-900); margin-bottom: var(--hs-space-2); }
.svc-hero-desc { font-size: var(--hs-font-size-sm); color: var(--hs-gray-500); margin-bottom: var(--hs-space-5); }
.svc-hero-actions { display: flex; gap: var(--hs-space-2); justify-content: center; flex-wrap: wrap; }
.gov-logo { height: 60px; }
</style>
