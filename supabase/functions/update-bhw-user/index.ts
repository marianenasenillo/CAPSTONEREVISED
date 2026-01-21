import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the current user (admin)
    const authHeader = req.headers.get('Authorization')!
    const { data: { user: adminUser }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError) throw new Error('Not authenticated')
    if (adminUser?.user_metadata?.role !== 'Admin') throw new Error('Not authorized')

    // Get update data from request
    const { userId, userData } = await req.json()
    if (!userId || !userData) throw new Error('Missing required data')

    // Update the BHW user
    const { data, error } = await supabase.auth.admin.updateUserById(
      userId,
      {
        user_metadata: userData
      }
    )

    if (error) throw error

    return new Response(JSON.stringify({ data, error: null }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({
        data: null,
        error: err.message
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
      }
    )
  }
})