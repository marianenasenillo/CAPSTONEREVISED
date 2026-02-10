<script setup>
// filepath: c:\Users\salar\OneDrive\Desktop\healths\src\views\HpsView.vue
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
const headPopulation = ref('')
const headFemale = ref('')
const headMale = ref('')

// Additional fields
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

// For multiple members (future use)
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

const headFields = [
  { label: 'Barangay:', model: 'headBarangay', ref: headBarangay, type: 'select' },
  { label: 'Purok:', model: 'headPurok', ref: headPurok, type: 'text' },
  { label: 'Last Name:', model: 'headLastname', ref: headLastname, type: 'text' },
  { label: 'First Name:', model: 'headFirstname', ref: headFirstname, type: 'text' },
  { label: 'Middle Name:', model: 'headMiddlename', ref: headMiddlename, type: 'text' },
  { label: 'Suffix:', model: 'headSuffix', ref: headSuffix, type: 'text' },
]

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
const fillIn = (type) => {
  modalType.value = type
  showModal.value = true
  closeMenu()
}
const viewRecords = (type) => {
 if (type === 'head') router.push('/hhpsrecords')
  closeMenu()
}
const closeModal = () => (showModal.value = false)

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
        population: headPopulation.value ? parseInt(headPopulation.value) : null,
        female_count: headFemale.value ? parseInt(headFemale.value) : null,
        male_count: headMale.value ? parseInt(headMale.value) : null,
      },
    ]);

    if (error) throw error;
    alert('Household head saved successfully!');
    closeModal();

    // Clear fields after save
    headBarangay.value = '';
    headPurok.value = '';
    headLastname.value = '';
    headFirstname.value = '';
    headMiddlename.value = '';
    headSuffix.value = '';
    headFamilyCount.value = '';
    headPopulation.value = '';
    headFemale.value = '';
    headMale.value = '';

  } catch (err) {
    console.error(err);
    alert('Error saving household head record.');
  }
};

const saveHousehold = async () => {
  try {
    // ⚠️ For now, you must specify an existing head_id manually or link dynamically
    const headId = prompt('Enter the Head ID this member belongs to:');

    if (!headId) {
      alert('Head ID is required!');
      return;
    }

    const { data, error } = await supabase.from('household_members').insert([
      {
        head_id: headId,
        barangay: barangay.value,
        date_visit: dateVisit.value || null,
        relationship: relationship.value,
        lastname: lastname.value,
        firstname: firstname.value,
        middlename: middlename.value,
        suffix: suffix.value,
        birthdate: birthdate.value || null,
        age: age.value ? parseInt(age.value) : null,
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
    ]);

    if (error) throw error;
    alert('Household member saved successfully!');
    closeModal();

    // Clear fields
    dateVisit.value = '';
    householdNo.value = '';
    barangay.value = '';
    purok.value = '';
    lastname.value = '';
    firstname.value = '';
    middlename.value = '';
    suffix.value = '';
    relationship.value = '';
    birthdate.value = '';
    age.value = '';
    sex.value = '';
    civilStatus.value = '';
    education.value = '';
    religion.value = '';
    ethnicity.value = '';
    is4psMember.value = '';
    householdId4ps.value = '';
    philhealthId.value = '';
    membershipType.value = '';
    philhealthCategory.value = '';
    medicalHistory.value = '';
    ageGroup.value = '';
    lmp.value = '';
    usingFpMethod.value = '';
    fpMethodUsed.value = '';
    fpStatus.value = '';
    waterSource.value = '';
    toiletFacility.value = '';

  } catch (err) {
    console.error(err);
    alert('Error saving household member record.');
  }
};

</script>

<template>
  <DashboardView>
    <div class="hps-bg  justify-content-between ">
      <!-- Previous Arrow -->
      <button class="arrow-btn prev-btn" @click="goPrevPage">❮</button>

      <!-- Overlay Content -->
      <div class="overlay-content text-white text-start ms-5">
        <h1 class="fw-bold">Household Profiling Services</h1>
        <p>Click to view and manage household records efficiently.</p>

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

        <img src="/images/hpslogo.png" alt="Household Logo" class="hps-logo" />

        <!-- Text + Buttons -->
        <div class="records-content">
          <p>
            <em>"Household Profiling"</em> in the Barangay Health Station aims to gather and
            organize essential information about families in the community to support health
            planning, monitoring, and delivery of services.
          </p>

          <!-- Household Profiling Button with Dropdown -->
          <div class="dropdown-container">
            <button class="record-btn" @click="openMenu('household')">
              Household Profiling <span>⋮</span>
            </button>
            <div v-if="activeMenu === 'household'" class="dropdown-menu">
              <button v-if="userRole === 'BHW'" @click="fillIn('household')">Fill In</button>
            </div>
          </div>

          <!-- Household Head Profiling Button with Dropdown -->
          <div class="dropdown-container">
            <button class="record-btn" @click="openMenu('head')">
              Household Head Profiling <span>⋮</span>
            </button>
            <div v-if="activeMenu === 'head'" class="dropdown-menu">
              <button v-if="userRole === 'BHW'" @click="fillIn('head')">Fill In</button>
              <button  @click="viewRecords('head')">View Records</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal for Fill In Form -->
    <div v-if="showModal" class="modal-overlay">
      <div class="modal-box wide-modal">
        <button class="modal-close" @click="closeModal" style="float:right;">✕</button>
       <!-- Centered logos and header text -->
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
              {{ modalType === 'household' ? 'Household Profiling' : 'Household Head Profiling' }}
            </h2>
          </div>
          <img v-if="userBarangay === 'Barangay 5'" src="/images/barangaylogo.png" alt="Barangay 5" style="height: 80px;" />
          <img v-else src="/images/barangay6.png" alt="Barangay 6" style="height: 80px;" />
        </div>
        <hr />
        <template v-if="modalType === 'household'">
          <div class="modal-form-wrap">
          <form @submit.prevent="saveHousehold" class="household-form wide-form">
            <div class="row-fields">
              <div class="form-group">
                <label>Date of Visit</label>
                <input type="date" v-model="dateVisit" class="input-stroke" />
              </div>
              <div class="form-group">
                <label>Barangay</label>
                <input type="text" v-model="barangay" class="input-stroke" readonly />
              </div>
              <div class="form-group">
                <label>Purok</label>
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
                <label>Last Name</label>
                <input type="text" v-model="lastname" class="input-stroke" />
              </div>
              <div class="form-group">
                <label>First Name</label>
                <input type="text" v-model="firstname" class="input-stroke" />
              </div>
              <div class="form-group">
                <label>Middle Name</label>
                <input type="text" v-model="middlename" class="input-stroke" />
              </div>
              <div class="form-group">
                <label>Suffix</label>
                <input type="text" v-model="suffix" class="input-stroke" />
              </div>
            </div>
            <div class="row-fields">
              <div class="form-group">
                <label>Relationship to HH Head</label>
                <select v-model="relationship" class="input-stroke">
                  <option value="">Select</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Son">Son</option>
                  <option value="Daughter">Daughter</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div class="form-group">
                <label>Date of Birth</label>
                <input type="date" v-model="birthdate" class="input-stroke" />
              </div>
              <div class="form-group">
                <label>Age in years</label>
                <input type="number" v-model="age" class="input-stroke" min="0" />
              </div>
              <div class="form-group">
                <label>Sex</label>
                <select v-model="sex" class="input-stroke">
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div class="form-group">
                <label>Civil Status</label>
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
                <label>Education Attainment</label>
                <select v-model="education" class="input-stroke">
                  <option value="">Select</option>
                  <option value="Elementary">Elementary</option>
                  <option value="High School">High School</option>
                  <option value="College">College</option>
                  <option value="Vocational">Vocational</option>
                  <option value="None">None</option>
                </select>
              </div>
              <div class="form-group">
                <label>Religion</label>
                <select v-model="religion" class="input-stroke">
                  <option value="">Select</option>
                  <option value="Catholic">Catholic</option>
                  <option value="Islam">Islam</option>
                  <option value="Protestant">Protestant</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div class="form-group">
                <label>Ethnicity</label>
                <select v-model="ethnicity" class="input-stroke">
                  <option value="">Select</option>
                  <option value="IP">IP</option>
                  <option value="Non-IP">Non-IP</option>
                </select>
              </div>
              <div class="form-group">
                <label>4PS Member</label>
                <select v-model="is4psMember" class="input-stroke">
                  <option value="">Select</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
              <div class="form-group">
                <label>4PS Household ID</label>
                <input type="text" v-model="householdId4ps" class="input-stroke" />
              </div>
              <div class="form-group">
                <label>Philhealth ID No</label>
                <input type="text" v-model="philhealthId" class="input-stroke" />
              </div>
            </div>
            <div class="row-fields">
              <div class="form-group">
                <label>Membership Type</label>
                <select v-model="membershipType" class="input-stroke">
                  <option value="">Select</option>
                  <option value="M-member">M-member</option>
                  <option value="D-dependent">D-dependent</option>
                </select>
              </div>
              <div class="form-group">
                <label>Philhealth Category</label>
                <select v-model="philhealthCategory" class="input-stroke">
                  <option value="">Select</option>
                  <option value="DC">Direct Contributor</option>
                  <option value="IC">Indirect Contributor</option>
                  <option value="U">Unknown</option>
                </select>
              </div>
              <div class="form-group">
                <label>Medical History</label>
                <select v-model="medicalHistory" class="input-stroke">
                  <option value="">Select</option>
                  <option value="HPN">Hypertension</option>
                  <option value="DM">Diabetes</option>
                  <option value="TB">Tuberculosis</option>
                  <option value="O">Others</option>
                </select>
              </div>
              <div class="form-group">
                <label>Classification by Age/Health Risk Group</label>
                <input type="text" v-model="ageGroup" class="input-stroke" />
              </div>
            </div>
            <div class="row-fields">
              <div class="form-group">
                <label>LMP (Last Menstrual Period)</label>
                <input type="date" v-model="lmp" class="input-stroke" />
              </div>
              <div class="form-group">
                <label>Using any FP Method?</label>
                <select v-model="usingFpMethod" class="input-stroke">
                  <option value="">Select</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
              <div class="form-group">
                <label>Family Planning Method Used</label>
                <input type="text" v-model="fpMethodUsed" class="input-stroke" />
              </div>
              <div class="form-group">
                <label>FP Status (if applicable)</label>
                <input type="text" v-model="fpStatus" class="input-stroke" />
              </div>
            </div>
            <div class="row-fields">
              <div class="form-group">
                <label>Type of Water Source</label>
                <input type="text" v-model="waterSource" class="input-stroke" />
              </div>
              <div class="form-group">
                <label>Type of Toilet Facility</label>
                <input type="text" v-model="toiletFacility" class="input-stroke" />
              </div>
            </div>
            <div class="form-actions-left">
              <button type="button" class="modal-btn cancel-btn" @click="closeModal">Cancel</button>
              <button type="submit" class="modal-btn" >+ Add new member</button>
            </div>
          </form>
          </div>
        </template>
        <template v-else-if="modalType === 'head'">
          <!-- Household Head Profiling Form (shortened and responsive) -->
          <div class="modal-form-wrap">
          <form @submit.prevent="saveHead" class="compact-head-form">
            <div class="row-fields">
              <div class="form-group">
                <label for="head-barangay">Barangay</label>
                <input id="head-barangay" v-model="headBarangay" type="text" class="input-stroke" readonly />
              </div>
              <div class="form-group">
                <label for="head-purok">Purok</label>
                <select id="head-purok" v-model="headPurok" class="input-stroke">
                  <option value="">Select Purok</option>
                  <option value="Purok 1">Purok 1</option>
                  <option value="Purok 2">Purok 2</option>
                  <option value="Purok 3">Purok 3</option>
                  <option value="Purok 4">Purok 4</option>
                </select>
              </div>
              <div class="form-group">
                <label for="head-lastname">Last Name</label>
                <input id="head-lastname" v-model="headLastname" type="text" class="input-stroke" />
              </div>
              <div class="form-group">
                <label for="head-firstname">First Name</label>
                <input id="head-firstname" v-model="headFirstname" type="text" class="input-stroke" />
              </div>
              <div class="form-group">
                <label for="head-middlename">Middle Name</label>
                <input id="head-middlename" v-model="headMiddlename" type="text" class="input-stroke" />
              </div>
              <div class="form-group">
                <label for="head-suffix">Suffix</label>
                <input id="head-suffix" v-model="headSuffix" type="text" class="input-stroke" />
              </div>
            </div>
            <div class="row-fields">
              <div class="form-group">
                <label for="head-familycount">No. of Family per Household</label>
                <input id="head-familycount" v-model="headFamilyCount" type="number" class="input-stroke" min="0" />
              </div>
              <div class="form-group">
                <label for="head-population">Population per Household</label>
                <input id="head-population" v-model="headPopulation" type="number" class="input-stroke" min="0" />
              </div>
              <div class="form-group">
                <label for="head-female">No. of Female</label>
                <input id="head-female" v-model="headFemale" type="number" class="input-stroke" min="0" />
              </div>
              <div class="form-group">
                <label for="head-male">No. of Male</label>
                <input id="head-male" v-model="headMale" type="number" class="input-stroke" min="0" />
              </div>
            </div>
            <div style="display: flex; gap: 0.7rem; margin-top:0.5rem;">
              <button type="button" class="modal-btn cancel-btn" @click="closeModal" style="font-size:0.95rem; padding:0.4rem 1rem;">Cancel</button>
              <button type="submit" class="modal-btn" style="font-size:0.95rem; padding:0.4rem 1rem;">Save</button>
            </div>
          </form>
          </div>
        </template>
      </div>
    </div>
  </DashboardView>
</template>

<style scoped>
/* Main background and overlay content */
.hps-bg {
  background: url('/images/householdprofiling.jpg') no-repeat center center;
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
  width: 60px;
  height: 60px;
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
  font-size: 1.25rem;
  padding: 0.4rem 0.8rem;
  cursor: pointer;
  transition: transform 0.2s;
}
.back-btn:hover {
  transform: scale(1.1);
}
.hps-logo {
  width: 500px;
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

/* Modal styles */
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
.wide-form {
  width: 100%;
  max-width: 1000px;
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

/* Responsive adjustments copied from Childcare */
@media (max-width: 1024px) {
  .overlay-content {
    margin-left: 0 !important;
    margin-right: 0 !important;
    max-width: 92%;
    text-align: center !important;
    margin: 0 auto !important;
  }

  .hps-bg { padding: 0 1.5rem; }

  .records-box {
    padding: 2rem;
    gap: 2rem;
    flex-direction: column;
    align-items: center;
    max-width: 720px;
  }

  .hps-logo { width: 220px; height: auto; margin: 0 auto; }
}

@media (max-width: 767px) {
  .overlay-content {
    padding: 1rem !important;
     max-width: 65% !important;
    margin-left: 18% !important;
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

  .hps-logo { width: 160px; }

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

  .wide-form .row-fields { display: flex; flex-direction: column; }

  .modal-title-col h4 { font-size: 0.85rem; }
  .modal-title-col h2 { font-size: 0.9rem; }
}


</style>
