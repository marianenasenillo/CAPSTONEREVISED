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
  <div class="auth-page">
    <div class="auth-container">
      <div class="auth-branding">
        <div class="auth-branding-inner">
          <img src="/images/logo.png" alt="HealthSync" class="auth-brand-logo" />
          <h1 class="auth-brand-title">Buenavista HealthSync</h1>
          <p class="auth-brand-desc">Secure password reset</p>
        </div>
      </div>

      <div class="auth-form-panel">
        <div class="auth-form-card">
          <div class="auth-form-header">
            <img src="/images/logo.png" alt="HealthSync" class="auth-form-logo" />
            <h2>Reset Password</h2>
            <p>Enter your new password below</p>
          </div>

          <div v-if="error" class="hs-alert hs-alert-error">{{ error }}</div>

          <div v-if="success" class="hs-alert hs-alert-success">
            Password reset successful! Redirecting to login...
          </div>

          <form v-else @submit.prevent="handleResetPassword">
            <div class="hs-form-group">
              <label class="hs-label">New Password</label>
              <div class="hs-field-icon-wrapper">
                <span class="mdi mdi-lock-outline auth-field-icon"></span>
                <input v-model="newPassword" type="password" class="hs-input auth-input-icon" placeholder="Enter new password" />
              </div>
            </div>

            <div class="hs-form-group">
              <label class="hs-label">Confirm Password</label>
              <div class="hs-field-icon-wrapper">
                <span class="mdi mdi-lock-check-outline auth-field-icon"></span>
                <input v-model="confirmPassword" type="password" class="hs-input auth-input-icon" placeholder="Confirm new password" />
              </div>
            </div>

            <button
              type="submit"
              class="hs-btn hs-btn-primary hs-btn-lg hs-w-full"
              :disabled="loading"
            >
              <span v-if="loading" class="hs-spinner hs-spinner-inline"></span>
              <span v-else>Reset Password</span>
            </button>
          </form>

          <p class="auth-alt-action">
            <router-link to="/" class="auth-alt-link">Back to Login</router-link>
          </p>
        </div>

        <p class="auth-footer-text">&copy; 2025 Buenavista HealthSync. All Rights Reserved.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page { min-height: 100vh; background: var(--hs-gray-50); }
.auth-container { display: flex; min-height: 100vh; }
.auth-branding {
  flex: 1;
  background: linear-gradient(135deg, var(--hs-primary) 0%, var(--hs-primary-dark) 50%, var(--hs-primary-darker) 100%);
  display: flex; align-items: center; justify-content: center;
  padding: 40px; position: relative; overflow: hidden;
}
.auth-branding::before {
  content: ''; position: absolute; inset: 0;
  background: url('/images/logo.png') center/36% no-repeat; opacity: 0.04;
}
.auth-branding-inner { position: relative; text-align: center; max-width: 400px; }
.auth-brand-logo { width: 100px; height: 100px; object-fit: contain; margin-bottom: 20px; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.15)); }
.auth-brand-title { font-size: var(--hs-font-size-3xl); font-weight: 600; color: var(--hs-white); margin-bottom: 10px; letter-spacing: -0.02em; }
.auth-brand-desc { font-size: var(--hs-font-size-sm); color: rgba(255,255,255,0.75); line-height: 1.6; }
.auth-form-panel {
  width: 460px; min-width: 460px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 36px; background: var(--hs-white);
}
.auth-form-card { width: 100%; max-width: 360px; }
.auth-form-header { text-align: center; margin-bottom: 28px; }
.auth-form-logo { width: 40px; height: 40px; object-fit: contain; margin-bottom: 14px; }
.auth-form-header h2 { font-size: var(--hs-font-size-xl); font-weight: 600; color: var(--hs-gray-900); margin-bottom: 4px; letter-spacing: -0.01em; }
.auth-form-header p { font-size: var(--hs-font-size-sm); color: var(--hs-gray-500); }
.auth-field-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 16px; color: var(--hs-gray-400); pointer-events: none; }
.auth-input-icon { padding-left: 34px !important; }
.auth-alt-action { text-align: center; font-size: var(--hs-font-size-sm); color: var(--hs-gray-500); margin-top: var(--hs-space-5); }
.hs-spinner-inline { width: var(--hs-space-4); height: var(--hs-space-4); border-width: 2px; }
.auth-alt-link { color: var(--hs-primary); font-weight: 600; text-decoration: none; }
.auth-alt-link:hover { text-decoration: underline; }
.auth-footer-text { margin-top: auto; padding-top: 28px; font-size: var(--hs-font-size-xs); color: var(--hs-gray-400); }
.hs-alert { padding: 8px 12px; border-radius: var(--hs-radius-md); font-size: var(--hs-font-size-xs); margin-bottom: 12px; }
.hs-alert-success { background: var(--hs-success-bg); color: var(--hs-success); border: 1px solid var(--hs-success-border); }
.hs-alert-error { background: var(--hs-danger-bg); color: var(--hs-danger); border: 1px solid var(--hs-danger-border); }
@media (max-width: 1024px) { .auth-branding { display: none; } .auth-form-panel { width: 100%; min-width: 0; } }
@media (max-width: 480px) { .auth-form-panel { padding: 20px 16px; } }
</style>
