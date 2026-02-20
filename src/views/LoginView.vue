<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/utils/supabase.js'
import { useToast } from '@/composables/useToast'

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const form = ref(null)
const loading = ref(false)
const router = useRouter()
const toast = useToast()

// handle login — auto-detect role from user_metadata (no manual role selection)
const handleLogin = async () => {
  const { valid } = await form.value.validate()
  if (!valid) return

  loading.value = true

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })

    if (error) throw error

    const user = data.user
    const userRole = user?.user_metadata?.role

    console.log('User data:', user)

    if (userRole === 'Admin' || userRole === 'BHW') {
      router.push('/home')
    } else {
      toast.error('Unknown role. Please contact admin.')
      await supabase.auth.signOut()
    }

  } catch (err) {
    console.error(err)
    toast.error(err.message || 'Login failed.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-container">
      <!-- Login form -->
      <div class="auth-form-panel">
        <div class="auth-form-card">
          <div class="auth-form-header">
            <img src="/images/logo.png" alt="HealthSync" class="auth-form-logo" />
            <h2>Welcome back</h2>
            <p>Sign in to your HealthSync account</p>
            <div class="auth-header-accent"></div>
          </div>

          <v-form ref="form" validate-on="submit" @submit.prevent="handleLogin">
            <div class="hs-form-group">
              <label class="hs-label">Email Address</label>
              <div class="hs-field-icon-wrapper">
                <span class="mdi mdi-email-outline auth-field-icon"></span>
                <input
                  v-model="email"
                  type="email"
                  class="hs-input auth-input-icon"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div class="hs-form-group">
              <label class="hs-label">Password</label>
              <div class="hs-field-icon-wrapper">
                <span class="mdi mdi-lock-outline auth-field-icon"></span>
                <input
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  class="hs-input auth-input-icon"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  class="auth-toggle-pw"
                  @click="showPassword = !showPassword"
                >
                  <span class="mdi" :class="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"></span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              class="hs-btn hs-btn-primary hs-btn-lg hs-w-full"
              :disabled="loading"
            >
              <span v-if="loading" class="hs-spinner hs-spinner-inline"></span>
              <span v-else>Sign In</span>
            </button>
          </v-form>

          <div class="auth-divider">
            <span>or</span>
          </div>

          <p class="auth-alt-action">
            Don't have an account?
            <router-link to="/adminregister" class="auth-alt-link">Create account</router-link>
          </p>

          <div class="public-link-row">
            <router-link to="/public" class="auth-alt-link">
              <span class="mdi mdi-earth"></span> View Public Dashboard
            </router-link>
          </div>
        </div>

        <p class="auth-footer-text">&copy; 2025 Buenavista HealthSync. All Rights Reserved.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f4f9ec 0%, var(--hs-gray-50) 40%, var(--hs-gray-50) 60%, #f4f9ec 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.auth-container {
  display: flex;
  min-height: 100vh;
  width: 100%;
  align-items: center;
  justify-content: center;
}

/* Form panel */
.auth-form-panel {
  width: 460px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 36px 36px 10px 36px;
  background: var(--hs-white);
  border-radius: var(--hs-radius-xl);
  box-shadow: var(--hs-shadow-lg);
  border-top: 3px solid var(--hs-primary);
}

.auth-form-card {
  width: 100%;
  max-width: 360px;
}

.auth-form-header {
  text-align: center;
  margin-bottom: 16px;
  margin-top: -40px;
}

.auth-form-logo {
  width: 150px;
  height: 150px;
  object-fit: contain;
  margin-bottom: -15px;
}

.auth-form-header h2 {
  font-size: var(--hs-font-size-2xl);
  font-weight: 600;
  color: var(--hs-gray-900);
  margin-bottom: 4px;
  letter-spacing: -0.01em;
}

.auth-form-header p {
  font-size: var(--hs-font-size-base);
  color: var(--hs-gray-500);
}

.auth-header-accent {
  width: 40px;
  height: 3px;
  background: var(--hs-primary);
  border-radius: 2px;
  margin: 14px auto 0;
}

.auth-field-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
  color: var(--hs-gray-400);
  pointer-events: none;
}

.auth-input-icon {
  padding-left: 38px !important;
}

.auth-toggle-pw {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: none;
  color: var(--hs-gray-400);
  cursor: pointer;
  padding: 4px;
  font-size: 18px;
}

.auth-toggle-pw:hover {
  color: var(--hs-gray-600);
}

.auth-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 20px 0;
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--hs-border);
}

.auth-divider span {
  font-size: var(--hs-font-size-xs);
  color: var(--hs-gray-400);
}

.auth-alt-action {
  text-align: center;
  font-size: var(--hs-font-size-sm);
  color: var(--hs-gray-500);
}

.auth-alt-link {
  color: var(--hs-primary);
  font-weight: 600;
  text-decoration: none;
  font-size: var(--hs-font-size-sm);
}

.auth-alt-link:hover {
  text-decoration: underline;
}

.public-link-row {
  text-align: center;
  margin-top: var(--hs-space-3);
}

.hs-spinner-inline {
  width: var(--hs-space-4);
  height: var(--hs-space-4);
  border-width: 2px;
}

.auth-footer-text {
  margin-top: auto;
  padding-top: 28px;
  font-size: var(--hs-font-size-xs);
  color: var(--hs-gray-400);
}

@media (max-width: 1024px) {
  .auth-page {
    background: var(--hs-white);
  }
  .auth-form-panel {
    width: 100%;
    min-width: 0;
    min-height: 100vh;
    border-radius: 0;
    box-shadow: none;
    border-top: none;
  }
}

@media (max-width: 480px) {
  .auth-form-panel {
    padding: 20px 16px;
  }
}
</style>
