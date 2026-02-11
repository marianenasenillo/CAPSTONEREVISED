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

// Navigation
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
  // Validation (simple)
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
    // Reset form
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
    <div class="childcare-bg justify-content-between">
      <!-- Previous Arrow -->
      <button class="arrow-btn prev-btn" @click="goPrevPage">❮</button>

      <!-- Overlay Content -->
      <div class="overlay-content text-white text-start ms-5">
        <h1 class="fw-bold">Child Care Services</h1>
        <p>Click to view and manage Child Care Services records efficiently.</p>

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

        <img src="/images/childcarelogo.png" alt="Child Care Logo" class="childcare-logo" />

        <!-- Text + Dropdown Button -->
        <div class="records-content">
          <p>
            <em>
              “Child Care Services” in the Barangay Health Station aim to safeguard the health and
              development of children in the community.
            </em>
          </p>
          <!-- Vitamin A Supplementation Dropdown -->
          <div class="dropdown-container">
            <button class="record-btn" @click="openMenu('vitamina')">
              Vitamin A Supplementation <span>⋮</span>
            </button>
            <div v-if="activeMenu === 'vitamina'" class="dropdown-menu">
              <button v-if="userRole === 'BHW'" @click="fillIn('vitamina')">Fill In</button>
              <button @click="viewRecords('vitamina')">View Records</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal for Vitamin A Supplementation Fill In Form -->
    <div v-if="showModal && modalType === 'vitamina'" class="modal-overlay">
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
              Vitamin A Supplementation _____  (1-4 yrs old)
            </h2>
          </div>
          <img v-if="userBarangay === 'Barangay 5'" src="/images/barangaylogo.png" alt="Barangay 5" style="height: 80px;" />
          <img v-else src="/images/barangay6.png" alt="Barangay 6" style="height: 80px;" />
        </div>
        <hr />
  <div class="modal-form-wrap">
  <form @submit.prevent="saveVitaminaRecord" class="vitamina-form">
          <div class="row-fields">
            <div class="form-group">
              <label>Purok:</label>
              <input type="text" v-model="purok" class="input-stroke" />
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
              <input type="number" v-model="age" class="input-stroke" min="0" />
            </div>
            <div class="form-group">
              <label>Birthdate:</label>
              <input type="date" v-model="birthdate" class="input-stroke" />
            </div>
            <div class="form-group">
              <label>Gender:</label>
              <select v-model="gender" class="input-stroke">
                <option value="">Select</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
            </div>
          </div>
          <div class="row-fields">
            <div class="form-group" style="flex:2;">
              <label>Full name of Mother:</label>
              <input type="text" v-model="motherName" class="input-stroke" />
            </div>
          </div>
          <div class="form-actions-left">
                <button type="button" class="modal-btn cancel-btn" @click="closeModal">Cancel</button>
                <button type="submit" class="modal-btn">Save</button>
          </div>
        </form>
        </div>
      </div>
    </div>
  </DashboardView>
</template>

<style scoped>
/* Background */
.childcare-bg {
  background: url('/images/childcare.jpg') no-repeat center center;
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

/* Overlay */
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

/* Records overlay */
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
  max-width: 1100px;
  width: 100%;
  position: relative;
  display: flex;
  align-items: center;
  gap: 3rem;
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
.childcare-logo {
  width: 350px;
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
}

/* Dropdown styles */
.dropdown-container {
  position: relative;
  width: 100%;
}
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
  max-width: 700px;
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
.vitamina-form {
  width: 100%;
  max-width: 600px;
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
@media (max-width: 1024px) {
  .overlay-content {
    margin-left: 0 !important;
    margin-right: 0 !important;
    max-width: 92%;
    text-align: center !important;
    margin: 0 auto !important;
  }

  .childcare-bg { padding: 0 1.5rem; }

  .records-box {
    padding: 2rem;
    gap: 2rem;
    flex-direction: column;
    align-items: center;
    max-width: 720px;
  }

  .childcare-logo { width: 220px; height: auto; margin: 0 auto; }
}

@media (max-width: 767px) {
  .overlay-content {
    padding: 1rem !important;
    max-width: 60% !important;
    margin-left: 20% !important;
    text-align: center !important;
  }

  .records-box {
    padding: 1rem;
    max-width: 100%;
    width: 100%;
    height: 90vh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    border-radius: 0.75rem;
  }

  .childcare-logo { width: 160px; }

  .modal-box {
    padding: 1rem 1rem;
    max-width: 98vw;
    width: 98vw;
    max-height: 94vh;
    align-items: stretch;
  }

  .modal-form-wrap {
    max-height: calc(94vh - 140px);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding-right: 0.25rem;
  }

  .vitamina-form .row-fields { display: flex; flex-direction: column; }

  .modal-title-col h4 { font-size: 0.85rem; }
  .modal-title-col h2 { font-size: 0.95rem; }
}



</style>


