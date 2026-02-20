<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/utils/supabase'
import {
  requiredValidator,
  emailValidator,
  passwordValidator,
  confirmedValidator,
} from '@/utils/validators.js'

const router = useRouter()

const firstName = ref('')
const lastName = ref('')
const email = ref('')
const role = ref('BHW') // fixed role
const barangay = ref('')
const purok = ref('')
const password = ref('')
const confirmPassword = ref('')

const firstNameError = ref('')
const lastNameError = ref('')
const emailError = ref('')
const barangayError = ref('')
const purokError = ref('')
const passwordError = ref('')
const confirmPasswordError = ref('')

const isLoading = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const showSuccessSnackbar = ref(false)
const showErrorSnackbar = ref(false)
const userBarangay = ref('')

const barangayOptions = ['Barangay 5', 'Barangay 6']
const purokOptions = ['Purok 1', 'Purok 2', 'Purok 3', 'Purok 4']

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  userBarangay.value = user?.user_metadata?.barangay || ''
  barangay.value = userBarangay.value
})

const validateForm = () => {
  let isValid = true

  firstNameError.value = requiredValidator(firstName.value)
  lastNameError.value = requiredValidator(lastName.value)
  emailError.value =
    requiredValidator(email.value) === true
      ? emailValidator(email.value)
      : requiredValidator(email.value)
  barangayError.value = requiredValidator(barangay.value)
  purokError.value = requiredValidator(purok.value)
  passwordError.value =
    requiredValidator(password.value) === true
      ? passwordValidator(password.value)
      : requiredValidator(password.value)
  confirmPasswordError.value = confirmedValidator(confirmPassword.value, password.value)

  const errors = [
    firstNameError.value,
    lastNameError.value,
    emailError.value,
    barangayError.value,
    purokError.value,
    passwordError.value,
    confirmPasswordError.value,
  ]

  if (errors.some((e) => e !== true && e !== '')) isValid = false
  return isValid
}

// handle register (BHW only)
const handleRegister = async () => {
  successMessage.value = ''
  errorMessage.value = ''

  if (!validateForm()) {
    errorMessage.value = '⚠️ Please fix the validation errors before proceeding.'
    return
  }

  try {
    isLoading.value = true

    const { error } = await supabase.auth.signUp({
      email: email.value,
      password: password.value,
      options: {
        data: {
          full_name: `${firstName.value} ${lastName.value}`,
          role: 'BHW',
          barangay: barangay.value,
          purok: purok.value,
        },
      },
    })

    if (error) throw error

    successMessage.value =
      '✅ Registration successful! Please check your email to confirm your account.'
    showSuccessSnackbar.value = true

    firstName.value = ''
    lastName.value = ''
    email.value = ''
    barangay.value = ''
    purok.value = ''
    password.value = ''
    confirmPassword.value = ''

    // wait 5 seconds, then redirect to '/'
    setTimeout(() => {
      router.push('/')
    }, 5000)
  } catch (err) {
    console.error(err)
    errorMessage.value = err.message || 'Registration failed. Please try again.'
    showErrorSnackbar.value = true
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-container">
      <div class="auth-form-panel">
        <div class="auth-form-card auth-form-card-wide">
          <div class="auth-form-header">
            <img src="/images/logo.png" alt="HealthSync" class="auth-form-logo" />
            <h2>Register BHW Account</h2>
            <p>Fill in the details below</p>
            <div class="auth-header-accent"></div>
          </div>

          <div v-if="successMessage" class="hs-alert hs-alert-success">{{ successMessage }}</div>
          <div v-if="errorMessage" class="hs-alert hs-alert-error">{{ errorMessage }}</div>

          <div class="hs-form-row">
            <div class="hs-form-group">
              <label class="hs-label">First Name</label>
              <input v-model="firstName" type="text" class="hs-input" placeholder="First name" />
              <span v-if="firstNameError && firstNameError !== true" class="hs-form-error">{{ firstNameError }}</span>
            </div>
            <div class="hs-form-group">
              <label class="hs-label">Last Name</label>
              <input v-model="lastName" type="text" class="hs-input" placeholder="Last name" />
              <span v-if="lastNameError && lastNameError !== true" class="hs-form-error">{{ lastNameError }}</span>
            </div>
          </div>

          <div class="hs-form-row">
            <div class="hs-form-group">
              <label class="hs-label">Email Address</label>
              <input v-model="email" type="email" class="hs-input" placeholder="you@example.com" />
              <span v-if="emailError && emailError !== true" class="hs-form-error">{{ emailError }}</span>
            </div>
            <div class="hs-form-group">
              <label class="hs-label">Role</label>
              <input :value="role" type="text" class="hs-input" readonly style="background: var(--hs-gray-50); cursor: not-allowed;" />
            </div>
          </div>

          <div class="hs-form-row">
            <div class="hs-form-group">
              <label class="hs-label">Barangay</label>
              <input v-model="barangay" type="text" class="hs-input" readonly style="background: var(--hs-gray-50); cursor: not-allowed;" />
              <span v-if="barangayError && barangayError !== true" class="hs-form-error">{{ barangayError }}</span>
            </div>
            <div class="hs-form-group">
              <label class="hs-label">Purok</label>
              <select v-model="purok" class="hs-select">
                <option value="" disabled>Select purok</option>
                <option v-for="p in purokOptions" :key="p" :value="p">{{ p }}</option>
              </select>
              <span v-if="purokError && purokError !== true" class="hs-form-error">{{ purokError }}</span>
            </div>
          </div>

          <div class="hs-form-row">
            <div class="hs-form-group">
              <label class="hs-label">Password</label>
              <input v-model="password" type="password" class="hs-input" placeholder="Create password" />
              <span v-if="passwordError && passwordError !== true" class="hs-form-error">{{ passwordError }}</span>
            </div>
            <div class="hs-form-group">
              <label class="hs-label">Confirm Password</label>
              <input v-model="confirmPassword" type="password" class="hs-input" placeholder="Confirm password" />
              <span v-if="confirmPasswordError && confirmPasswordError !== true" class="hs-form-error">{{ confirmPasswordError }}</span>
            </div>
          </div>

          <div style="display: flex; gap: var(--hs-space-3); margin-top: var(--hs-space-2);">
            <button class="hs-btn hs-btn-secondary hs-btn-lg" style="flex: 1;" @click="router.push('/bhw')">
              Back
            </button>
            <button class="hs-btn hs-btn-primary hs-btn-lg" style="flex: 2;" :disabled="isLoading" @click="handleRegister">
              <span v-if="isLoading" class="hs-spinner" style="width: var(--hs-space-4); height: var(--hs-space-4); border-width: 2px;"></span>
              <span v-else>Register BHW</span>
            </button>
          </div>
        </div>

        <p class="auth-footer-text">&copy; 2025 Buenavista HealthSync. All Rights Reserved.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page { min-height: 100vh; background: linear-gradient(135deg, #f4f9ec 0%, var(--hs-gray-50) 40%, var(--hs-gray-50) 60%, #f4f9ec 100%); }
.auth-container { display: flex; min-height: 100vh; align-items: center; justify-content: center; }
.auth-form-panel {
  width: 520px; min-width: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 36px; background: var(--hs-white); overflow-y: auto;
  border-radius: var(--hs-radius-xl); box-shadow: var(--hs-shadow-lg);
  border-top: 3px solid var(--hs-primary);
}
.auth-form-card-wide { width: 100%; max-width: 440px; }
.auth-form-header { text-align: center; margin-bottom: 16px; }
.auth-form-logo { width: 120px; height: 120px; object-fit: contain; margin-bottom: 6px; }
.auth-form-header h2 { font-size: var(--hs-font-size-xl); font-weight: 700; color: var(--hs-gray-900); margin-bottom: 4px; letter-spacing: -0.01em; }
.auth-form-header p { font-size: var(--hs-font-size-sm); color: var(--hs-gray-500); }
.auth-header-accent { width: 40px; height: 3px; background: var(--hs-primary); border-radius: 2px; margin: 14px auto 0; }
.auth-footer-text { margin-top: auto; padding-top: 28px; font-size: var(--hs-font-size-xs); color: var(--hs-gray-400); }
.hs-alert { padding: 8px 12px; border-radius: var(--hs-radius-md); font-size: var(--hs-font-size-xs); margin-bottom: 12px; }
.hs-alert-success { background: var(--hs-success-bg); color: var(--hs-success); border: 1px solid var(--hs-success-border); }
.hs-alert-error { background: var(--hs-danger-bg); color: var(--hs-danger); border: 1px solid var(--hs-danger-border); }
@media (max-width: 1024px) { .auth-page { background: var(--hs-white); } .auth-form-panel { width: 100%; min-width: 0; border-radius: 0; box-shadow: none; border-top: none; } }
@media (max-width: 480px) { .auth-form-panel { padding: 20px 16px; } }
</style>
