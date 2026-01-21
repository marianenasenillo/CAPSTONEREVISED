import { supabase } from './supabase'

/**
 * Medicine helper for interacting with `medicine` and `availed_medicine` tables.
 *
 * Exports:
 * - listMedicine()
 * - createMedicine({ name, quantity })
 * - getMedicine(medicine_id)
 * - availMedicine({ medicine_id, name, purok, quantity })
 * - listAvailedMedicine()
 *
 * Notes:
 * - availMedicine uses a conditional update (quantity >= requested) before inserting
 *   an availed_medicine row to reduce the chance of race conditions. For strict
 *   transactional guarantees, create a Postgres function (RPC) server-side.
 */

export async function listMedicine() {
  const { data, error } = await supabase.from('medicine').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getMedicine(medicine_id) {
  const { data, error } = await supabase.from('medicine').select('*').eq('medicine_id', medicine_id).single()
  if (error) throw error
  return data
}

export async function createMedicine({ name, quantity = 0 }) {
  if (!name) throw new Error('name is required')
  if (quantity == null || Number(quantity) < 0) throw new Error('quantity must be >= 0')

  const { data, error } = await supabase.from('medicine').insert({ name, quantity }).select().single()
  if (error) throw error
  return data
}

/**
 * Avail a medicine (decrease stock and log the avail transaction).
 * Attempts a conditional update to decrement the stock only if the current
 * quantity is >= requested amount. If the conditional update affects 0 rows,
 * the operation is considered failed (insufficient stock or concurrent change).
 *
 * Returns the inserted availed_medicine row on success.
 */
export async function availMedicine({ medicine_id, name, purok, quantity, expectedtoreturn = null }) {
  if (!medicine_id) throw new Error('medicine_id required')
  quantity = Number(quantity)
  if (!quantity || quantity <= 0) throw new Error('quantity must be > 0')

  // Step 1: fetch current quantity
  const { data: medicine, error: tErr } = await supabase.from('medicine').select('quantity').eq('medicine_id', medicine_id).single()
  if (tErr) throw tErr
  if (!medicine) throw new Error('Medicine not found')
  if (medicine.quantity < quantity) throw new Error('Insufficient stock')

  // Step 2: conditional update (decrement only if quantity >= requested)
  const { data: updated, error: updErr } = await supabase
    .from('medicine')
    .update({ quantity: medicine.quantity - quantity })
    .eq('medicine_id', medicine_id)
    .gte('quantity', quantity)
    .select()

  if (updErr) throw updErr
  // If no rows updated, treat as failure (concurrent update)
  if (!updated || updated.length === 0) {
    throw new Error('Failed to reserve stock (concurrent update)')
  }

  // Step 3: insert availed_medicine log
  const insertPayload = { medicine_id, name, purok, quantity }
  if (expectedtoreturn) insertPayload.expectedtoreturn = expectedtoreturn

  const { data: availRow, error: availErr } = await supabase
    .from('availed_medicine')
    .insert(insertPayload)
    .select()
    .single()

  if (availErr) {
    // Attempt to rollback the decrement (best-effort)
    try {
      await supabase.from('medicine').update({ quantity: updated[0].quantity + quantity }).eq('medicine_id', medicine_id)
    } catch (rollbackErr) {
      console.error('Rollback failed after availed_medicine insert error:', rollbackErr)
    }
    throw availErr
  }

  return availRow
}

export async function listAvailedMedicine() {
  const { data, error } = await supabase.from('availed_medicine').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export default {
  listMedicine,
  createMedicine,
  getMedicine,
  availMedicine,
  listAvailedMedicine,
}