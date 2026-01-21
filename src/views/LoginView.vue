<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/utils/supabase.js'
import { requiredValidator, passwordValidator, emailValidator } from '@/utils/validators.js'

// form fields
const email = ref('')
const password = ref('')
const role = ref('')
const showPassword = ref(false)



// options
const roleOptions = ['BHW', 'Admin']


// validation rules
const emailRules = [requiredValidator, emailValidator]
const passwordRules = [requiredValidator, passwordValidator]
const roleRules = [requiredValidator]


// refs
const form = ref(null)
const loading = ref(false)
const router = useRouter()

// handle login
const handleLogin = async () => {
  const { valid } = await form.value.validate()
  if (!valid) return

  loading.value = true

  try {
    // 1️⃣ Try to sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })

    if (error) throw error

    // 2️⃣ Fetch user metadata to check role
    const user = data.user
    const userRole = user?.user_metadata?.role

    console.log('User data:', user)

    // 3️⃣ Validate role match (only allow correct role)
    if (userRole !== role.value) {
      alert('Invalid role for this account.')
      await supabase.auth.signOut()
      return
    }

    // 4️⃣ Redirect based on role
    if (userRole === 'Admin') {
      router.push('/home')
    } else if (userRole === 'BHW') {
      router.push('/home')
    } else {
      alert('Unknown role. Please contact admin.')
    }

  } catch (err) {
    console.error(err)
    alert(err.message || 'Login failed.')
  } finally {
    loading.value = false
  }
}

// handle forgot password
const handleForgotPassword = async () => {
  if (!email.value) {
    alert('Please enter your email address first.')
    return
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.value, {
      redirectTo: `${window.location.origin}/reset-password`
    })

    if (error) throw error

    alert('Password reset email sent! Check your inbox.')
  } catch (err) {
    console.error(err)
    alert(err.message || 'Failed to send reset email.')
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

          <!-- RIGHT SIDE (Login Form Card) -->
          <v-col cols="12" md="4" class="d-flex justify-center">
            <v-card
              class="flex-grow-1 d-flex flex-column justify-center"
              elevation="4"
              color="#fff9c4"
              height="472"
            >
              <h3 class="text-center font-weight-bold mt-6"
                  style="text-decoration: underline; font-size: 28px; color: #2e4e1f">
                USER LOGIN
              </h3>
              <p class="text-center mb-6" style="color: #2e4e1f">
                Welcome to Buenavista HealthSync
              </p>

              <v-form ref="form" validate-on="submit" @submit.prevent="handleLogin">
                <!-- Email -->
                <v-text-field
                  v-model="email"
                  label="Email:"
                  variant="filled"
                  bg-color="#5b841e"
                  color="white"
                  density="comfortable"
                  class="mx-12 text-white"
                  style="--v-theme-on-surface: white"
                  :rules="emailRules"
                />

                <!-- Password -->
                <v-text-field
                  v-model="password"
                  label="Password:"
                  :type="showPassword ? 'text' : 'password'"
                  variant="filled"
                  bg-color="#5b841e"
                  color="white"
                  density="comfortable"
                  class="mx-12 text-white"
                  style="--v-theme-on-surface: white"
                  :rules="passwordRules"
                >
                  <template #append-inner>
                    <v-icon
                      :icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                      color="white"
                      @click="showPassword = !showPassword"
                      style="cursor: pointer;"
                    />
                  </template>
                </v-text-field>

                <!-- Select fields -->
                <v-row class="mx-9">
                  <v-col cols="12">
                    <v-select
                      v-model="role"
                      label="Role"
                      :items="roleOptions"
                      variant="filled"
                      bg-color="#5b841e"
                      color="white"
                      density="comfortable"
                      class="text-white"
                      style="--v-theme-on-surface: white"
                      :rules="roleRules"
                    />
                  </v-col>
                </v-row>

                <!-- Login Button -->
                <div class="text-center">
                  <v-btn
                    type="submit"
                    :loading="loading"
                    class="text-white text-lowercase font-weight-bold"
                    style="background-color: #5b841e"
                  >
                    log in
                  </v-btn>
                </div>
              </v-form>
              
              <!-- Forgot Password -->
              <p class="text-center " >
                <a href="#" @click.prevent="handleForgotPassword" style="color: black; text-decoration: underline; cursor: pointer;">Forgot password?</a>
              </p>

              <v-divider ></v-divider>

              <p class="text-center " >
                Don't have an account? <a href="/adminregister" style=" text-decoration: underline; cursor: pointer;">Sign up</a>
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
