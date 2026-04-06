import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Wait for the Supabase client to restore the session from localStorage.
// Without this, router guards that call getSession() immediately on page
// refresh may see a null session before the token has been read/refreshed,
// causing an unwanted redirect to the login page.
export const authReady = new Promise((resolve) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    resolve(session)
    // Unsubscribe after the first event (INITIAL_SESSION) so we don't leak
    subscription.unsubscribe()
  })
})

