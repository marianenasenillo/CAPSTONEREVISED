import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Initialize Supabase Admin client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // use service role for admin access
)

serve(async (req) => {
  // Handle CORS preflight (OPTIONS request)
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*', // 👈 allow all origins (or specify localhost)
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    })
  }

  try {
    // Fetch all users
    const { data, error } = await supabase.auth.admin.listUsers()

    if (error) throw error

    // Filter only BHW users
    const bhwUsers = data.users
      .filter((u) => u.user_metadata?.role === 'BHW')
      .map((u) => ({
        id: u.id,
        name: u.user_metadata?.full_name || 'Unnamed',
        birthdate: u.user_metadata?.birthdate || 'N/A',
        contact: u.user_metadata?.contact || 'N/A',
        purok: u.user_metadata?.purok || 'N/A',
        barangay: u.user_metadata?.barangay || 'N/A',
        schedule: u.user_metadata?.schedule || 'N/A',
        photo: u.user_metadata?.avatar_url || '/images/default-avatar.png',
        role: u.user_metadata?.role || 'N/A',
      }))

    return new Response(JSON.stringify(bhwUsers), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // 👈 this line fixes your error
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
})
