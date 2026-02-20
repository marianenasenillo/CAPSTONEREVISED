<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from '@/utils/supabase.js'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const showRecords = ref(false)
const activeMenu = ref('')
const showModal = ref(false)
const modalType = ref('')
const userRole = ref('')
const userBarangay = ref('')

const surname = ref('')
const firstname = ref('')
const motherName = ref('')
const sex = ref('')
const birthday = ref('')
const age = ref('')
const purok = ref('')

const goPrevPage = () => router.push('/childcare')
const goNextPage = () => router.push('/preventivehealthservices')
const toggleRecords = () => (showRecords.value = !showRecords.value)
const openMenu = (type) => (activeMenu.value = type)
const closeMenu = () => (activeMenu.value = '')
const fillIn = (type) => { modalType.value = type; showModal.value = true; closeMenu() }
const viewRecords = (type) => { if (type === 'responsible') router.push('/fpsrecords'); closeMenu() }
const closeModal = () => (showModal.value = false)

// Save form to Supabase
const saveRecord = async () => {
  const { data, error } = await supabase
    .from('family_planning_records')
    .insert([
      {
        surname: surname.value,
        firstname: firstname.value,
        mother_name: motherName.value,
        sex: sex.value,
        birthday: birthday.value,
        age: age.value,
        purok: purok.value
      }
    ])

  if (error) {
    toast.error('Error saving record: ' + error.message)
    return
  }

  toast.success('Record saved successfully!')
  surname.value = ''
  firstname.value = ''
  motherName.value = ''
  sex.value = ''
  birthday.value = ''
  age.value = ''
  purok.value = ''
  closeModal()
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
        surname.value = m.lastname || ''
        firstname.value = m.firstname || ''
        sex.value = m.sex || ''
        birthday.value = m.birthdate || ''
        age.value = m.age || ''
        purok.value = m.purok || ''
        sessionStorage.removeItem('hs_eligible_member')
      }
    } catch (_) { /* ignore */ }
    await nextTick()
    fillIn('responsible')
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
          <span class="current">Family Planning</span>
        </div>
        <h1>Family Planning Services</h1>
        <p class="hs-module-desc">Document family planning consultations and methods provided to clients.</p>
        <p>Help families make informed choices in managing reproductive health</p>
      </div>

      <div class="service-cards">
        <div class="hs-card service-action-card">
          <div class="hs-card-body svc-hero">
            <div class="hs-stat-icon hs-stat-icon-info svc-hero-icon">
              <span class="mdi mdi-human-male-female-child"></span>
            </div>
            <h3 class="svc-hero-title">Responsible Parenthood and Planning</h3>
            <p class="svc-hero-desc">Record and manage family planning data</p>
            <div class="svc-hero-actions">
              <button v-if="userRole === 'BHW'" class="hs-btn hs-btn-primary" @click="fillIn('responsible')">
                <span class="mdi mdi-plus"></span> Fill In
              </button>
              <button class="hs-btn hs-btn-secondary" @click="viewRecords('responsible')">
                <span class="mdi mdi-eye-outline"></span> View Records
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="showModal && modalType === 'responsible'" class="hs-modal-overlay" @click.self="closeModal">
        <div class="hs-modal hs-modal-lg">
          <div class="hs-modal-header">
            <h3>Responsible Parenthood and Planning</h3>
            <button class="hs-modal-close" @click="closeModal">&times;</button>
          </div>
          <div class="hs-gov-header">
            <img src="/images/agusanlogo.png" alt="Agusan" class="gov-logo" />
            <div class="hs-gov-header-text">
              Republic of the Philippines<br />Province of Agusan del Norte<br />Municipality of Buenavista
              <div class="hs-gov-header-title">Responsible Parenthood and Planning</div>
            </div>
            <img v-if="userBarangay === 'Barangay 5'" src="/images/barangaylogo.png" alt="Barangay 5" class="gov-logo" />
            <img v-else src="/images/barangay6.png" alt="Barangay 6" class="gov-logo" />
          </div>
          <div class="hs-modal-body hs-modal-body--scroll">
            <form @submit.prevent="saveRecord">
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Surname</label><input type="text" v-model="surname" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">First Name</label><input type="text" v-model="firstname" class="hs-input" /></div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Name of Mother</label><input type="text" v-model="motherName" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Sex</label>
                  <select v-model="sex" class="hs-select"><option value="">Select</option><option value="F">Female</option><option value="M">Male</option></select>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group"><label class="hs-label">Birthday</label><input type="date" v-model="birthday" class="hs-input" /></div>
                <div class="hs-form-group"><label class="hs-label">Age in years</label><input type="number" v-model="age" class="hs-input" min="0" /></div>
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
.svc-hero { text-align: center; padding: var(--hs-space-8); }
.svc-hero-icon { margin: 0 auto var(--hs-space-4); width: 56px; height: 56px; font-size: 28px; }
.svc-hero-title { font-size: var(--hs-font-size-md); font-weight: 600; color: var(--hs-gray-900); margin-bottom: var(--hs-space-2); }
.svc-hero-desc { font-size: var(--hs-font-size-sm); color: var(--hs-gray-500); margin-bottom: var(--hs-space-5); }
.svc-hero-actions { display: flex; gap: var(--hs-space-2); justify-content: center; flex-wrap: wrap; }
.gov-logo { height: 60px; }
</style>
