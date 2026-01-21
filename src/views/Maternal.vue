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

// Purok options
const purokOptions = ['Purok 1', 'Purok 2', 'Purok 3', 'Purok 4']

// Navigation
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

// ✅ Save WRA Record to Supabase
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

// ✅ Save Cervical Screening Record
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

// ✅ Reset helper functions
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
    <div class="maternal-bg justify-content-between">
      <!-- Previous Arrow -->
      <button class="arrow-btn prev-btn" @click="goPrevPage">❮</button>

      <!-- Overlay Content -->
      <div class="overlay-content text-white text-start ms-5">

        <h1 class="fw-bold">Maternal & Women Care Services</h1>
        <p>Click to view and manage maternal services records efficiently.</p>

        <!-- View Records Button -->
        <button class="btn view-btn mt-3 d-block mx-auto" @click="toggleRecords">View Records</button>
      </div>

      <!-- Next Arrow -->
      <button class="arrow-btn next-btn" @click="goNextPage">❯</button>
    </div>

    <!-- Records Overlay -->
    <div v-if="showRecords" class="records-overlay">
      <div class="records-box d-flex align-items-center">
        <!-- Back button -->
        <button class="back-btn" @click="toggleRecords">← back</button>

        <img src="/images/maternalserviceslogo.png" alt="Maternal Services Logo" class="maternal-logo" />

        <!-- Text + Buttons -->
        <div class="records-content">
          <p>
            <em>
              “Maternal and Women Care Services” in the Barangay Health Station aim to promote the health and
              well-being of mothers and women in the community.
            </em>
          </p>

          <!-- Women of Reproductive Age Button with Dropdown -->
          <div class="dropdown-container">
            <button class="record-btn" @click="openMenu('wra')">
              Women of Reproductive Age <span>⋮</span>
            </button>
            <div v-if="activeMenu === 'wra'" class="dropdown-menu">
              <button v-if="userRole === 'BHW'" @click="fillIn('wra')">Fill In</button>
              <button @click="viewRecords('wra')">View Records</button>
            </div>
          </div>

          <!-- Cervical Cancer Screening Button with Dropdown -->
          <div class="dropdown-container">
            <button class="record-btn" @click="openMenu('cervical')">
              Cervical Cancer Screening <span>⋮</span>
            </button>
            <div v-if="activeMenu === 'cervical'" class="dropdown-menu">
              <button v-if="userRole === 'BHW'" @click="fillIn('cervical')">Fill In</button>
              <button @click="viewRecords('cervical')">View Records</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal for WRA Fill In Form -->
    <div v-if="showModal && modalType === 'wra'" class="modal-overlay">
      <div class="modal-box wide-modal">
        <button class="modal-close" @click="closeModal" style="float:right;">✕</button>
        <div style="display: flex; align-items: center; justify-content: center; gap: 1.2rem; margin-bottom: 0.3rem;">
          <img src="/images/agusanlogo.png" alt="Agusan Logo" style="height: 80px;" />
          <div style="min-width:180px; flex:1; text-align: center;">
            <h4 style="margin: 0; font-size: 0.9rem; font-weight: 600; line-height: 1.1;">
              Republic of the Philippines<br />
              Province of Agusan del Norte<br />
              Municipality of Buenavista<br />
              Barangay Poblacion ___
            </h4>
            <h2 style="margin: 0.2rem 0 0.1rem 0; font-size: 0.95rem; font-weight: 700;">
              WRA LIST _____ (10-49 YEARS OLD)
            </h2>
          </div>
          <img v-if="userBarangay === 'Barangay 5'" src="/images/barangaylogo.png" alt="Barangay 5" style="height: 80px;" />
          <img v-else src="/images/barangay6.png" alt="Barangay 6" style="height: 80px;" />
        </div>
        <hr />
        <form @submit.prevent="saveWra" class="wra-form">
          <div class="row-fields">
            <div class="form-group">
              <label>Purok:</label>
              <select v-model="purok" class="input-stroke">
                <option value="">Select Purok</option>
                <option value="Purok 1">Purok 1</option>
                <option value="Purok 2">Purok 2</option>
                <option value="Purok 3">Purok 3</option>
                <option value="Purok 4">Purok 4</option>
              </select>
            </div>
          </div>
          <div class="row-fields">
            <div class="form-group">
              <label>Last Name:</label>
              <input type="text" v-model="lastname" class="input-stroke" />
            </div>
            <div class="form-group">
              <label>First Name:</label>
              <input type="text" v-model="firstname" class="input-stroke" />
            </div>
            <div class="form-group">
              <label>Middle Name:</label>
              <input type="text" v-model="middlename" class="input-stroke" />
            </div>
            <div class="form-group">
              <label>Suffix:</label>
              <input type="text" v-model="suffix" class="input-stroke" />
            </div>
          </div>
          <div class="row-fields">
            <div class="form-group">
              <label>Age:</label>
              <input type="number" v-model="age" class="input-stroke" min="1" />
            </div>
            <div class="form-group">
              <label>Birthdate:</label>
              <input type="date" v-model="birthdate" class="input-stroke" />
            </div>
            <div class="form-group">
              <label>SE Status:</label>
              <input type="text" v-model="seStatus" class="input-stroke" />
            </div>
            <div class="form-group">
              <label>Civil Status:</label>
              <select v-model="civilStatus" class="input-stroke">
                <option value="">Select</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Widowed">Widowed</option>
                <option value="Separated">Separated</option>
              </select>
            </div>
          </div>
          <div class="row-fields">
            <div class="form-group">
              <label>Nag plano manganak:</label>
              <select v-model="planoManganak" class="input-stroke">
                <option value="">Select</option>
                <option value="Oo">Oo</option>
                <option value="Dili">Dili</option>
              </select>
            </div>
            <div class="form-group checkbox-group">
              <label>Karun</label>
              <input type="checkbox" v-model="karun" />
            </div>
            <div class="form-group checkbox-group">
              <label>Spacing</label>
              <input type="checkbox" v-model="spacing" />
            </div>
            <div class="form-group checkbox-group">
              <label>Limiting</label>
              <input type="checkbox" v-model="limiting" />
            </div>
            <div class="form-group checkbox-group">
              <label>Fecund</label>
              <input type="checkbox" v-model="fecund" />
            </div>
            <div class="form-group checkbox-group">
              <label>Infecund</label>
              <input type="checkbox" v-model="infecund" />
            </div>
          </div>
          <div class="row-fields">
            <div class="form-group">
              <label>FB method used:</label>
              <select v-model="fbMethod" class="input-stroke">
                <option value="">Select</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div class="form-group">
              <label>Type:</label>
              <input type="text" v-model="fbType" class="input-stroke" />
            </div>
            <div class="form-group">
              <label>Date:</label>
              <input type="date" v-model="fbDate" class="input-stroke" />
            </div>
            <div class="form-group">
              <label>Gusto mo balhin ug Method</label>
              <div>
                <label><input type="radio" value="Yes" v-model="changeMethod" /> Yes</label>
                <label style="margin-left:1rem;"><input type="radio" value="No" v-model="changeMethod" /> No</label>
              </div>
            </div>
          </div>
          <div class="form-actions-left">
            <button type="button" class="modal-btn cancel-btn" @click="closeModal">Cancel</button>
            <button type="submit" class="modal-btn">Save</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal for Cervical Cancer Screening Fill In Form -->
    <div v-if="showModal && modalType === 'cervical'" class="modal-overlay">
      <div class="modal-box wide-modal">
        <button class="modal-close" @click="closeModal" style="float:right;">✕</button>
        <div style="display: flex; align-items: center; justify-content: center; gap: 1.2rem; margin-bottom: 0.3rem;">
          <img src="/images/agusanlogo.png" alt="Agusan Logo" style="height: 80px;" />
          <div style="min-width:180px; flex:1; text-align: center;">
            <h4 style="margin: 0; font-size: 0.9rem; font-weight: 600; line-height: 1.1;">
              Republic of the Philippines<br />
              Province of Agusan del Norte<br />
              Municipality of Buenavista<br />
              Barangay Poblacion ___
            </h4>
            <h2 style="margin: 0.2rem 0 0.1rem 0; font-size: 0.95rem; font-weight: 700;">
              Cervical Cancer Screening<br />
          <span style="font-weight:400; font-size:0.95rem;">
            Eligible Target 30 yrs.old - 65 yrs.old Women
          </span>
            </h2>
          </div>
          <img v-if="userBarangay === 'Barangay 5'" src="/images/barangaylogo.png" alt="Barangay 5" style="height: 80px;" />
          <img v-else src="/images/barangay6.png" alt="Barangay 6" style="height: 80px;" />
        </div>
        <hr />
        <form @submit.prevent="saveCervical" class="cervical-form">
          <div class="row-fields">
            <div class="form-group">
              <label>Purok:</label>
              <select v-model="cervicalPurok" class="input-stroke">
                <option value="">Select Purok</option>
                <option value="Purok 1">Purok 1</option>
                <option value="Purok 2">Purok 2</option>
                <option value="Purok 3">Purok 3</option>
                <option value="Purok 4">Purok 4</option>
              </select>
            </div>
          </div>
          <div class="row-fields">
            <div class="form-group">
              <label>Last Name:</label>
              <input type="text" v-model="cervicalLastname" class="input-stroke" />
            </div>
            <div class="form-group">
              <label>First Name:</label>
              <input type="text" v-model="cervicalFirstname" class="input-stroke" />
            </div>
            <div class="form-group">
              <label>Middle Name:</label>
              <input type="text" v-model="cervicalMiddlename" class="input-stroke" />
            </div>
            <div class="form-group">
              <label>Suffix:</label>
              <input type="text" v-model="cervicalSuffix" class="input-stroke" />
            </div>
          </div>
          <div class="row-fields">
            <div class="form-group">
              <label>Age:</label>
              <input type="number" v-model="cervicalAge" class="input-stroke" min="1" />
            </div>
            <div class="form-group">
              <label>Birthdate:</label>
              <input type="date" v-model="cervicalBirthdate" class="input-stroke" />
            </div>
            <div class="form-group">
              <label>Screened</label>
              <div>
                <label><input type="radio" value="Yes" v-model="cervicalScreened" /> Yes</label>
                <label style="margin-left:1rem;"><input type="radio" value="No" v-model="cervicalScreened" /> No</label>
              </div>
            </div>
          </div>
          <div class="form-actions-left">
            <button type="button" class="modal-btn cancel-btn" @click="closeModal">Cancel</button>
            <button type="submit" class="modal-btn">Save</button>
          </div>
        </form>
      </div>
    </div>
  </DashboardView>
</template>

<style scoped>
/* Main background and overlay content */
.maternal-bg {
  background: url('/images/maternal.jpg') no-repeat center center;
 background-size: cover;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4rem;
}
.overlay-content {
  background: rgba(131, 189, 45, 0.65);
  padding: 2rem;
  border-radius: 1rem;
  max-width: 480px;
  margin-left: 6rem;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
}

/* Search bar */
.search-box .form-control {
  border-radius: 0.5rem 0 0 0.5rem;
}
.search-box .btn-light {
  border-radius: 0 0.5rem 0.5rem 0;
}

/* View Records button */
.view-btn {
  background-color: #ffcc00;
  color: #000;
  font-weight: 600;
  border: none;
  padding: 0.6rem 1.5rem;
  border-radius: 8px;
  transition: 0.3s;
  width: 50%;
}
.view-btn:hover {
  background-color: #e6b800;
}

/* Arrows */
.arrow-btn {
  background: rgba(0, 0, 0, 0.5);
  border: none;
  color: white;
  font-size: 2.5rem;
  font-weight: bold;
  width: 65px;
  height: 65px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.3s;
}
.arrow-btn:hover {
  background: rgba(0, 0, 0, 0.8);
}
.prev-btn {
  position: absolute;
  left: 20px;
}
.next-btn {
  position: absolute;
  right: 20px;
}

/* Records overlay (fullscreen) */
.records-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  padding: 2rem;
}
.records-box {
  background: rgba(255, 255, 255, 0.95);
  padding: 3rem 4rem;
  border-radius: 1rem;
  max-width: 1300px;
  width: 100%;
  position: relative;
  display: flex;
  align-items: center;
  gap: 4rem;
}
.back-btn {
  position: absolute;
  top: 15px;
  left: 15px;
  background: transparent;
  border: none;
  font-weight: bold;
  color: #000;
  font-size: 1.35rem;
  padding: 0.5rem 0.9rem;
  cursor: pointer;
  transition: transform 0.2s;
}
.back-btn:hover {
  transform: scale(1.1);
}
.maternal-logo {
  width: 520px;
  max-width: 100%;
  flex-shrink: 0;
}
.records-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.records-content p {
  font-size: 1.15rem;
  line-height: 1.7;
  margin-bottom: 2rem;
}

/* Buttons */
.record-btn {
  background-color: #5b841e;
  color: #fff;
  font-weight: 600;
  padding: 1rem 1.3rem;
  border-radius: 8px;
  width: 100%;
  margin-bottom: 1rem;
  text-align: left;
  display: flex;
  justify-content: space-between;
  font-size: 1.1rem;
  transition: 0.3s;
}
.record-btn:hover {
  background-color: #4a6d18;
}

/* Dropdown styles */
.dropdown-container {
  position: relative;
  width: 100%;
}
.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.15);
  padding: 0.5rem 0.7rem;
  min-width: 140px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.dropdown-menu button {
  background: none;
  border: none;
  color: #5b841e;
  font-weight: 600;
  text-align: left;
  padding: 0.5rem 0.7rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}
.dropdown-menu button:hover {
  background: #e6f3d2;
}

/* Modal styles for forms */
.modal-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 3000;
}
.modal-box {
  background: #fff;
  padding: 2rem 2.5rem;
  border-radius: 1rem;
  box-shadow: 0 4px 24px rgba(0,0,0,0.2);
  min-width: 320px;
  text-align: center;
  max-width: 1100px;
  width: 98vw;
  min-height: 320px;
  max-height: 80vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.2rem;
  margin-bottom: 0.3rem;
  flex-wrap: wrap;
}
.modal-logo-col {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-title-col {
  flex: 1 1 300px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.modal-title-col h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.2;
}
.modal-title-col h2 {
  margin: 0.2rem 0 0.1rem 0;
  font-size: 1.1rem;
  font-weight: 700;
}
.modal-logo {
  height: 50px;
  max-width: 60px;
  width: 100%;
}
.wra-form,
.cervical-form {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}
.row-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
}
.form-group {
  flex: 1 1 180px;
  min-width: 140px;
  display: flex;
  flex-direction: column;
}
.form-group label {
  font-weight: 600;
  font-size: 0.97rem;
  margin-bottom: 0.1rem;
}
.input-stroke {
  font-size: 1rem;
  padding: 0.35rem 0.7rem;
  border: 2px solid #222;
  border-radius: 6px;
  background: #fff;
  color: #222;
  outline: none;
  margin-top: 0.2rem;
  margin-bottom: 0.5rem;
  width: 100%;
  box-sizing: border-box;
}
.input-stroke:focus {
  border-color: #5b841e;
}
.checkbox-group {
  flex-direction: row;
  align-items: center;
  gap: 0.3rem;
}
.form-actions-left {
  display: flex;
  justify-content: flex-start;
  gap: 0.7rem;
  margin-top: 0.8rem;
}
.cancel-btn {
  background: #888 !important;
  color: #fff !important;
}
.cancel-btn:hover {
  background: #555 !important;
}
.modal-btn {
  background: #5b841e;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.7rem 1.5rem;
  margin: 0.5rem 0;
  font-weight: 600;
  width: 100%;
  font-size: 1rem;
  transition: 0.3s;
}
.modal-btn:hover {
  background: #4a6d18;
}
.modal-close {
  background: transparent;
  color: #333;
  border: none;
  margin-top: 1rem;
  font-size: 1rem;
  cursor: pointer;
}

/* Responsive for tablet and mobile */
@media (max-width: 1100px) {
  .overlay-content {
    margin-left: 0 !important;
    margin-right: 0 !important;
    max-width: 640px;
    margin: 0 auto;
    text-align: center;
  }
  .maternal-bg {
    align-items: flex-start;
    padding-top: 1.5rem;
    padding-bottom: 1.5rem;
  }
  .arrow-btn {
    width: 48px;
    height: 48px;
  }
  .maternal-logo {
    max-width: 300px;
    width: 100%;
  }
  .modal-box {
    max-width: 98vw;
    padding: 1rem 0.5rem;
  }
  .wra-form,
  .cervical-form {
    max-width: 98vw;
    padding: 0 0.2rem;
  }
  .row-fields {
    gap: 0.4rem;
  }
}

@media (max-width: 767px) {
  .overlay-content {
    margin-left: 0 !important;
    margin-right: 0 !important;
    max-width: 92%;
    margin: 0 auto;
    text-align: center;
    padding: 1rem;
    border-radius: 0.6rem;
  }
  .materbal-bg {
    align-items: flex-start;
    padding-top: 1rem;
    padding-bottom: 1rem;
  }
  .overlay-content .search-box {
    margin-bottom: 0.5rem;
  }
  .records-box {
    flex-direction: column;
    gap: 1rem;
    padding: 1rem 0.2rem;
    max-width: 100vw;
  }
  .maternal-logo {
    max-width: 180px;
    width: 100%;
    margin-bottom: 1rem;
  }
  .modal-box {
    max-width: 100vw;
    padding: 0.5rem 0.2rem;
    min-width: 0;
  }
  .modal-header {
    flex-direction: column;
    gap: 0.5rem;
  }
  .modal-logo {
    height: 36px;
    max-width: 44px;
  }
  .wra-form,
  .cervical-form {
    max-width: 100vw;
    padding: 0 0.1rem;
  }
  .row-fields {
    flex-direction: column;
    gap: 0.2rem;
  }
  .form-group {
    min-width: 0;
    width: 100%;
  }
  .form-actions-left {
    flex-direction: column;
    gap: 0.3rem;
    width: 100%;
  }
  .modal-btn {
    width: 100%;
    font-size: 0.95rem;
    padding: 0.5rem 0.7rem;
  }
}
</style>
