<script setup>
import DashboardView from '@/components/DashboardView.vue'
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/utils/supabase.js'

const router = useRouter()
const showRecords = ref(false)
const activeMenu = ref('')
const showModal = ref(false)
const modalType = ref('')
const userRole = ref('')
const userBarangay = ref('')

const goPrevPage = () => router.push('/maternalservices')
const goNextPage = () => router.push('/preventivehealhservices')
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
    alert('Please fill in all required fields.')
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
    alert('Failed to save record.')
  } else {
    alert('Record saved successfully!')
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
  console.log('User role:', userRole.value)
  console.log('User barangay:', userBarangay.value)
  console.log('Full user metadata:', user?.user_metadata)
})
</script>

<template>
  <DashboardView>
    <div class="service-page">
      <div class="hs-page-header">
        <div class="hs-breadcrumb">
          <a href="#" @click.prevent="goPrevPage">Dashboard</a>
          <span class="separator">/</span>
          <span class="current">Child Care</span>
        </div>
        <h1>Child Care Services</h1>
        <p>Safeguard the health and development of children in the community</p>
      </div>

      <div class="service-cards">
        <div class="hs-card service-action-card">
          <div class="hs-card-body" style="text-align: center; padding: var(--hs-space-8);">
            <div class="hs-stat-icon hs-stat-icon-warning" style="margin: 0 auto var(--hs-space-4); width: 56px; height: 56px; font-size: 28px;">
              <span class="mdi mdi-pill"></span>
            </div>
            <h3 style="font-size: var(--hs-font-size-md); font-weight: 600; color: var(--hs-gray-900); margin-bottom: var(--hs-space-2);">Vitamin A Supplementation</h3>
            <p style="font-size: var(--hs-font-size-sm); color: var(--hs-gray-500); margin-bottom: var(--hs-space-5);">Record Vitamin A supplementation for children (1-4 yrs old)</p>
            <div style="display: flex; gap: var(--hs-space-2); justify-content: center; flex-wrap: wrap;">
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
          <div class="hs-gov-header" style="padding: var(--hs-space-3) var(--hs-space-6);">
            <img src="/images/agusanlogo.png" alt="Agusan" style="height: 60px;" />
            <div class="hs-gov-header-text">
              Republic of the Philippines<br />Province of Agusan del Norte<br />Municipality of Buenavista
              <div class="hs-gov-header-title">Vitamin A Supplementation (1-4 yrs old)</div>
            </div>
            <img v-if="userBarangay === 'Barangay 5'" src="/images/barangaylogo.png" alt="Barangay 5" style="height: 60px;" />
            <img v-else src="/images/barangay6.png" alt="Barangay 6" style="height: 60px;" />
          </div>
          <div class="hs-modal-body" style="max-height: 60vh; overflow-y: auto;">
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
                  <select v-model="gender" class="hs-select"><option value="">Select</option><option value="Female">Female</option><option value="Male">Male</option></select>
                </div>
              </div>
              <div class="hs-form-row">
                <div class="hs-form-group" style="flex:2;"><label class="hs-label">Full name of Mother</label><input type="text" v-model="motherName" class="hs-input" /></div>
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
</style>
