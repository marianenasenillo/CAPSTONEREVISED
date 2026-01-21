import { supabase } from './supabase'

/**
 * Tools helper for interacting with `tools` and `availed_tools` tables.
 *
 * Exports:
 * - listTools()
 * - createTool({ name, quantity })
 * - getTool(tool_id)
 * - availTool({ tool_id, name, purok, quantity })
 * - listAvailedTools()
 *
 * Notes:
 * - availTool uses a conditional update (quantity >= requested) before inserting
 *   an availed_tools row to reduce the chance of race conditions. For strict
 *   transactional guarantees, create a Postgres function (RPC) server-side.
 */

export async function listTools() {
  const { data, error } = await supabase.from('tools').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getTool(tool_id) {
  const { data, error } = await supabase.from('tools').select('*').eq('tool_id', tool_id).single()
  if (error) throw error
  return data
}

export async function createTool({ name, quantity = 0 }) {
  if (!name) throw new Error('name is required')
  if (quantity == null || Number(quantity) < 0) throw new Error('quantity must be >= 0')

  const { data, error } = await supabase.from('tools').insert({ name, quantity }).select().single()
  if (error) throw error
  return data
}

/**
 * Avail a tool (decrease stock and log the avail transaction).
 * Attempts a conditional update to decrement the stock only if the current
 * quantity is >= requested amount. If the conditional update affects 0 rows,
 * the operation is considered failed (insufficient stock or concurrent change).
 *
 * Returns the inserted availed_tools row on success.
 */
export async function availTool({ tool_id, name, purok, quantity, expectedtoreturn = null }) {
  if (!tool_id) throw new Error('tool_id required')
  quantity = Number(quantity)
  if (!quantity || quantity <= 0) throw new Error('quantity must be > 0')

  // Step 1: fetch current quantity
  const { data: tool, error: tErr } = await supabase.from('tools').select('quantity').eq('tool_id', tool_id).single()
  if (tErr) throw tErr
  if (!tool) throw new Error('Tool not found')
  if (tool.quantity < quantity) throw new Error('Insufficient stock')

  // Step 2: conditional update (decrement only if quantity >= requested)
  const { data: updated, error: updErr } = await supabase
    .from('tools')
    .update({ quantity: tool.quantity - quantity })
    .eq('tool_id', tool_id)
    .gte('quantity', quantity)
    .select()

  if (updErr) throw updErr
  // If no rows updated, treat as failure (concurrent update)
  if (!updated || updated.length === 0) {
    throw new Error('Failed to reserve stock (concurrent update)')
  }

  // Step 3: insert availed_tools log
  const insertPayload = { tool_id, name, purok, quantity }
  if (expectedtoreturn) insertPayload.expectedtoreturn = expectedtoreturn

  const { data: availRow, error: availErr } = await supabase
    .from('availed_tools')
    .insert(insertPayload)
    .select()
    .single()

  if (availErr) {
    // Attempt to rollback the decrement (best-effort)
    try {
      await supabase.from('tools').update({ quantity: updated[0].quantity + quantity }).eq('tool_id', tool_id)
    } catch (rollbackErr) {
      console.error('Rollback failed after availed_tools insert error:', rollbackErr)
    }
    throw availErr
  }

  return availRow
}

export async function listAvailedTools() {
  const { data, error } = await supabase.from('availed_tools').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export default {
  listTools,
  createTool,
  getTool,
  availTool,
  listAvailedTools,
}
