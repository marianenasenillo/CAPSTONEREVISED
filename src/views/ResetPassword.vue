<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/utils/supabase.js'
import { requiredValidator, passwordValidator } from '@/utils/validators.js'

const router = useRouter()
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const success = ref(false)

// Validation rules
const passwordRules = [requiredValidator, passwordValidator]
const confirmPasswordRules = [
  requiredValidator,
  (v) => v === newPassword.value || 'Passwords do not match'
]

const form = ref(null)

onMounted(() => {
  // Check if we have the hash parameters from the email link
  const hash = window.location.hash.substring(1)
  console.log('Reset password hash:', hash)

  const hashParams = new URLSearchParams(hash)

  // Check for errors first
  const errorParam = hashParams.get('error')
  if (errorParam) {
    const errorCode = hashParams.get('error_code')
    const errorDescription = hashParams.get('error_description')
    console.error('Reset password error:', { errorParam, errorCode, errorDescription })
    error.value = `Reset link error: ${errorDescription || errorParam}. Please request a new password reset.`
    return
  }

  const accessToken = hashParams.get('access_token')
  const refreshToken = hashParams.get('refresh_token')
  const type = hashParams.get('type')

  console.log('Reset password params:', { accessToken: !!accessToken, refreshToken: !!refreshToken, type })

  if (!accessToken || type !== 'recovery') {
    error.value = 'Invalid or expired reset link. Please request a new password reset.'
    return
  }

  // Set the session with the tokens from the email link
  supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  }).then(({ data, error: sessionError }) => {
    if (sessionError) {
      console.error('Session set error:', sessionError)
      error.value = 'Failed to authenticate reset link. Please request a new password reset.'
    } else {
      console.log('Session set successfully:', data)
    }
  })
})

const handleResetPassword = async () => {
  const { valid } = await form.value.validate()
  if (!valid) return

  if (newPassword.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword.value
    })

    if (updateError) throw updateError

    success.value = true

    // Redirect to login after a short delay
    setTimeout(() => {
      router.push('/')
    }, 3000)

  } catch (err) {
    console.error('Password reset error:', err)
    error.value = err.message || 'Failed to reset password. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-app class="yellow-background">
    <v-app-bar app color="#5b841e" height="90" class="d-flex align-center px-4" />

    <v-main class="main-no-scroll">
      <v-container fluid>
        <v-row class="fill-height d-flex align-center justify-center">
          <!-- LEFT SIDE (Logo Card) -->
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

          <!-- RIGHT SIDE (Reset Password Form Card) -->
          <v-col cols="12" md="4" class="d-flex justify-center">
            <v-card
              class="flex-grow-1 d-flex flex-column justify-center"
              elevation="4"
              color="#fff9c4"
              height="472"
            >
              <h3 class="text-center font-weight-bold mt-6"
                  style="text-decoration: underline; font-size: 28px; color: #2e4e1f">
                RESET PASSWORD
              </h3>
              <p class="text-center mb-6" style="color: #2e4e1f">
                Enter your new password below
              </p>

              <div v-if="error" class="alert alert-danger mx-4 mb-4">
                {{ error }}
              </div>

              <div v-if="success" class="alert alert-success mx-4 mb-4">
                Password reset successful! Redirecting to login...
              </div>

              <v-form v-else ref="form" validate-on="submit" @submit.prevent="handleResetPassword">
                <!-- New Password -->
                <v-text-field
                  v-model="newPassword"
                  label="New Password:"
                  type="password"
                  variant="filled"
                  bg-color="#5b841e"
                  color="white"
                  density="comfortable"
                  class="mx-12 text-white"
                  style="--v-theme-on-surface: white"
                  :rules="passwordRules"
                />

                <!-- Confirm Password -->
                <v-text-field
                  v-model="confirmPassword"
                  label="Confirm Password:"
                  type="password"
                  variant="filled"
                  bg-color="#5b841e"
                  color="white"
                  density="comfortable"
                  class="mx-12 text-white"
                  style="--v-theme-on-surface: white"
                  :rules="confirmPasswordRules"
                />

                <!-- Reset Button -->
                <div class="mx-16">
                  <v-btn
                    type="submit"
                    :loading="loading"
                    block
                    class="text-white text-lowercase font-weight-bold"
                    style="background-color: #5b841e"
                  >
                    reset password
                  </v-btn>
                </div>
              </v-form>

              <!-- Back to Login -->
              <p class="text-center mt-2">
                <router-link to="/" style="color: black; text-decoration: underline">Back to Login</router-link>
              </p>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>

    <v-footer app color="#5b841e" height="90" class="d-flex align-center justify-center">
      <span class="text-white text-decoration-underline">2025 All Rights Reserved</span>
    </v-footer>
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