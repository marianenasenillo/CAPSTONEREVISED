<script setup>
import { ref } from 'vue'
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
const role = ref('Admin') // fixed role
const barangay = ref('')
const purok = ref('')
const password = ref('')
const confirmPassword = ref('')

// errors
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

// options
const barangayOptions = ['Barangay 5', 'Barangay 6']
const purokOptions = ['Purok 1', 'Purok 2', 'Purok 3', 'Purok 4']

// validate form fields
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

// handle register (Admin only)
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
          role: 'Admin',
          barangay: barangay.value,
          purok: purok.value,
        },
      },
    })

    if (error) throw error

    successMessage.value =
      '✅ Registration successful! Please check your email to confirm your account.'
    showSuccessSnackbar.value = true

    // reset fields
    firstName.value = ''
    lastName.value = ''
    email.value = ''
    barangay.value = ''
    purok.value = ''
    password.value = ''
    confirmPassword.value = ''

    // ⏳ wait 5 seconds, then redirect to '/'
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
  <v-app class="yellow-background">
    <v-app-bar app color="#5b841e" height="90" class="d-flex align-center px-4" />

    <v-main class="main-no-scroll">
      <v-container fluid>
        <v-row class="fill-height d-flex align-center justify-center">
          <v-col cols="12" md="7" class="hide-on-mobile">
            <v-card
              class="pa-7 flex-grow-1 d-flex align-center justify-center"
              height="472"
              elevation="4"
              color="#fff9c4"
            >
              <v-img src="/images/logo.png" contain max-width="700" />
            </v-card>
          </v-col>

          <v-col cols="12" md="4" class="d-flex justify-center">
            <v-card
              class="flex-grow-1 d-flex flex-column justify-center"
              elevation="4"
              color="#fff9c4"
              height="472"
            >
              <h3
                class="text-center font-weight-bold mt-5"
                style="text-decoration: underline; font-size: 28px; color: #2e4e1f"
              >
                USER REGISTRATION
              </h3>
              <p class="text-center mb-6" style="color: #2e4e1f">
                Create your Buenavista HealthSync Admin account
              </p>

              <v-row class="mx-4 d-flex justify-center">
                <v-col cols="12" md="5">
                  <v-text-field
                    v-model="firstName"
                    :error-messages="firstNameError !== true ? firstNameError : ''"
                    label="First Name"
                    variant="filled"
                    bg-color="#5b841e"
                    color="white"
                    density="comfortable"
                    class="text-white"
                    style="--v-theme-on-surface: white"
                  />
                  <v-text-field
                    v-model="email"
                    :error-messages="emailError !== true ? emailError : ''"
                    label="Email Address"
                    type="email"
                    variant="filled"
                    bg-color="#5b841e"
                    color="white"
                    density="comfortable"
                    class="text-white"
                    style="--v-theme-on-surface: white"
                  />
                  <v-select
                    v-model="barangay"
                    :error-messages="barangayError !== true ? barangayError : ''"
                    label="Barangay"
                    :items="barangayOptions"
                    variant="filled"
                    bg-color="#5b841e"
                    color="white"
                    density="comfortable"
                    class="text-white"
                    style="--v-theme-on-surface: white"
                  />
                  <v-text-field
                    v-model="password"
                    :error-messages="passwordError !== true ? passwordError : ''"
                    label="Password"
                    type="password"
                    variant="filled"
                    bg-color="#5b841e"
                    color="white"
                    density="comfortable"
                    class="text-white"
                    style="--v-theme-on-surface: white"
                  />
                </v-col>

                <v-col cols="12" md="5">
                  <v-text-field
                    v-model="lastName"
                    :error-messages="lastNameError !== true ? lastNameError : ''"
                    label="Last Name"
                    variant="filled"
                    bg-color="#5b841e"
                    color="white"
                    density="comfortable"
                    class="text-white"
                    style="--v-theme-on-surface: white"
                  />

                  <!-- Fixed Admin Role -->
                  <v-text-field
                    v-model="role"
                    label="Role"
                    readonly
                    variant="filled"
                    bg-color="#5b841e"
                    color="white"
                    density="comfortable"
                    class="text-white"
                    style="--v-theme-on-surface: white"
                  />

                  <v-select
                    v-model="purok"
                    :error-messages="purokError !== true ? purokError : ''"
                    label="Purok"
                    :items="purokOptions"
                    variant="filled"
                    bg-color="#5b841e"
                    color="white"
                    density="comfortable"
                    class="text-white"
                    style="--v-theme-on-surface: white"
                  />
                  <v-text-field
                    v-model="confirmPassword"
                    :error-messages="confirmPasswordError !== true ? confirmPasswordError : ''"
                    label="Confirm Password"
                    type="password"
                    variant="filled"
                    bg-color="#5b841e"
                    color="white"
                    density="comfortable"
                    class="text-white"
                    style="--v-theme-on-surface: white"
                  />
                </v-col>
              </v-row>

              <div class="mx-16 mb-5">
                <v-btn
                  block
                  class="text-white text-lowercase font-weight-bold mb-2"
                  style="background-color: #5b841e"
                  :loading="isLoading"
                  @click="handleRegister"
                >
                  register
                </v-btn>

                <v-btn
                  block
                  class="text-white text-lowercase font-weight-bold"
                  style="background-color: #466a17"
                  @click="router.push('/dashboard')"
                >
                  back
                </v-btn>
              </div>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>

    <v-footer app color="#5b841e" height="90" class="d-flex align-center justify-center">
      <span class="text-white text-decoration-underline">2025 All Rights Reserved</span>
    </v-footer>

    <v-snackbar v-model="showSuccessSnackbar" color="success" timeout="5000" top>
      {{ successMessage }}
      <template v-slot:action="{ attrs }">
        <v-btn color="white" text v-bind="attrs" @click="showSuccessSnackbar = false">Close</v-btn>
      </template>
    </v-snackbar>

    <v-snackbar v-model="showErrorSnackbar" color="error" timeout="5000" top>
      {{ errorMessage }}
      <template v-slot:action="{ attrs }">
        <v-btn color="white" text v-bind="attrs" @click="showErrorSnackbar = false">Close</v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<style scoped>
.yellow-background {
  background-color: #ffeb3b;
  min-height: 100vh;
}
.main-no-scroll {
  min-height: calc(100vh - 90px - 90px);
  display: flex;
  align-items: center;
  justify-content: center;
}
@media (max-width: 1264px) {
  .hide-on-mobile {
    display: none !important;
  }
}
</style>
