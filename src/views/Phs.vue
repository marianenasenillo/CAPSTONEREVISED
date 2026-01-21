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

// Form fields for Deworming
const firstname = ref('')
const middlename = ref('')
const motherName = ref('')
const sex = ref('')
const birthday = ref('')
const age = ref('')
const lastname = ref('')
const purok = ref('')

// Deworming records table
const dewormingRecords = ref([])

const goPrevPage = () => {
  router.push('/familyplanning')
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
  
  // Refresh table and close modal
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
})
</script>


<template>
  <DashboardView>
    <div class="preventive-bg justify-content-between">
      <!-- Previous Arrow -->
      <button class="arrow-btn prev-btn" @click="goPrevPage">❮</button>

      <!-- Overlay Content -->
      <div class="overlay-content text-white text-start ms-5">
        <h1 class="fw-bold">Preventive Health Services</h1>
        <p>Click to view and manage Preventive Health Services records efficiently.</p>

        <!-- View Records Button -->
        <button class="btn view-btn mt-3 d-block mx-auto" @click="toggleRecords">View Records</button>
      </div>
    </div>

    <!-- Records Overlay -->
    <div v-if="showRecords" class="records-overlay">
      <div class="records-box d-flex align-items-center">
        <!-- Back button -->
        <button class="back-btn" @click="toggleRecords">← back</button>

        <img src="/images/preventivehealthlogo.png" alt="Preventive Health Logo" class="preventive-logo" />

        <!-- Text + Buttons -->
        <div class="records-content">
          <p>
            <em>
              “Preventive Health Services” in the Barangay Health Station aim to protect the community by promoting healthy practices and preventing the spread of diseases.
            </em>
          </p>

          <!-- Deworming Button with Dropdown -->
          <div class="dropdown-container">
            <button class="record-btn" @click="openMenu('deworming')">
              Deworming (10–19 yrs old) <span>⋮</span>
            </button>
            <div v-if="activeMenu === 'deworming'" class="dropdown-menu">
              <button v-if="userRole === 'BHW'" @click="fillIn('deworming')">Fill In</button>
              <button @click="viewRecords('deworming')">View Records</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal for Deworming Fill In Form -->
    <div v-if="showModal && modalType === 'deworming'" class="modal-overlay">
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
             Deworming (10-19 yrs old)
            </h2>
          </div>
          <img v-if="userBarangay === 'Barangay 5'" src="/images/barangaylogo.png" alt="Barangay 5" style="height: 80px;" />
          <img v-else src="/images/barangay6.png" alt="Barangay 6" style="height: 80px;" />
        </div>
        <hr />
        <form @submit.prevent="saveRecord" class="deworming-form">
          <div class="row-fields">
            <div class="form-group">
              <label>First Name:</label>
              <input type="text" v-model="firstname" class="input-stroke" />
            </div>
            <div class="form-group">
              <label>Middle Name:</label>
              <input type="text" v-model="middlename" class="input-stroke" />
            </div>
          </div>
          <div class="row-fields">
            <div class="form-group">
              <label>Name of Mother:</label>
              <input type="text" v-model="motherName" class="input-stroke" />
            </div>
            <div class="form-group">
              <label>Last Name:</label>
              <input type="text" v-model="lastname" class="input-stroke" />
            </div>
          </div>
          <div class="row-fields">
            <div class="form-group">
              <label>Sex:</label>
              <select v-model="sex" class="input-stroke">
                <option value="">Select</option>
                <option value="F">Female</option>
                <option value="M">Male</option>
              </select>
            </div>
            <div class="form-group">
              <label>Birthday:</label>
              <input type="date" v-model="birthday" class="input-stroke" />
            </div>
            <div class="form-group">
              <label>Age:</label>
              <input type="number" v-model="age" class="input-stroke" min="0" />
            </div>
          </div>
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
/* Background */
.preventive-bg {
  background: url('/images/preventivehealth.jpg') no-repeat center center;
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

/* Overlay with transparent green */
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


/* Records overlay (fullscreen) */
.records-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  padding: 2rem;
}

/* Records box */
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

/* Back button */
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

/* Logo */
.preventive-logo {
  width: 520px;
  flex-shrink: 0;
}

/* Content */
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

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 3000;
  padding: 1rem;
}
.modal-box {
  background: #fff;
  padding: 2rem;
  border-radius: 1rem;
  max-width: 800px;
  width: 100%;
  position: relative;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}
.modal-close {
  background: none;
  border: none;
  color: #000;
  font-size: 1.5rem;
  cursor: pointer;
  transition: transform 0.2s;
}
.modal-close:hover {
  transform: scale(1.1);
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}
.modal-logo-col {
  flex: 0 0 80px;
}
.modal-title-col {
  flex: 1;
  text-align: center;
}
.modal-title-col h4 {
  font-size: 0.9rem;
  margin: 0;
  line-height: 1.2;
}
.modal-title-col h2 {
  font-size: 1.5rem;
  margin: 0.3rem 0 0;
  font-weight: 600;
}
.deworming-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.row-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}
.form-group {
  flex: 1;
  min-width: 220px;
}
.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}
.input-stroke {
  border: 1px solid #ccc;
  border-radius: 0.5rem;
  padding: 0.8rem;
  font-size: 1rem;
  width: 100%;
  transition: border-color 0.3s;
}
.input-stroke:focus {
  border-color: #5b841e;
  outline: none;
}
.form-actions-left {
  display: flex;
  justify-content: flex-start;
  gap: 1rem;
}
.modal-btn {
  background-color: #5b841e;
  color: #fff;
  font-weight: 600;
  padding: 0.8rem 1.2rem;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: background 0.3s;
}
.modal-btn:hover {
  background-color: #4a6d18;
}
.cancel-btn {
  background-color: #ccc;
  color: #333;
}
.cancel-btn:hover {
  background-color: #bbb;
}
/* Center overlay-content on tablets and phones */
@media (max-width: 1024px) {
  .overlay-content {
    margin-left: 0 !important;
    margin-right: 0 !important;
    max-width: 640px;
    margin: 0 auto;
    text-align: center;
  }
  .family-bg {
    align-items: flex-start;
    padding-top: 1.5rem;
    padding-bottom: 1.5rem;
  }
  .arrow-btn {
    width: 48px;
    height: 48px;
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
  .family-bg {
    align-items: flex-start;
    padding-top: 1rem;
    padding-bottom: 1rem;
  }
  .overlay-content .search-box {
    margin-bottom: 0.5rem;
  }
}

/* Make modal and form scrollable on small screens */
@media (max-width: 1024px) {
  .modal-box {
    max-width: 720px;
    padding: 1.25rem;
    max-height: calc(100vh - 120px);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .deworming-form {
    max-height: calc(100vh - 200px);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding-right: 8px;
  }

  .modal-overlay {
    align-items: flex-start;
    padding-top: 18px;
    padding-bottom: 18px;
    overflow-y: auto;
  }
}

@media (max-width: 767px) {
  .modal-box {
    max-width: 96%;
    padding: 0.9rem;
    max-height: calc(100vh - 80px);
  }

  .deworming-form {
    max-height: calc(100vh - 160px);
  }
}

/* Responsive adjustments for the records overlay */
@media (max-width: 1024px) {
  .records-box {
    padding: 1.5rem;
    gap: 1rem;
    flex-direction: column;
    align-items: stretch;
    max-width: 720px;
  }

  .family-logo {
    width: 240px;
    margin: 0 auto;
    display: block;
  }

  .records-content {
    padding: 0 0.5rem;
    text-align: center;
  }

  .back-btn {
    top: 10px;
    left: 10px;
  }
}

@media (max-width: 767px) {
  .records-overlay {
    align-items: flex-start;
    padding: 1rem;
    overflow-y: auto;
  }

  .records-box {
    padding: 1rem;
    gap: 0.8rem;
    border-radius: 0.8rem;
    max-width: 96%;
    max-height: calc(100vh - 80px);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .family-logo {
    width: 160px;
  }

  /* Modal header logos */
  .modal-box img {
    height: 45px !important;
  }

  .records-content p {
    font-size: 1rem;
    line-height: 1.4;
  }

  .record-btn {
    padding: 0.7rem;
    font-size: 0.95rem;
  }

  .dropdown-menu {
    position: static;
    box-shadow: none;
    background: transparent;
    padding: 0;
  }
}
</style>
