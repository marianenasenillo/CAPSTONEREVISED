import { supabase } from './supabase'

// Medicine helper — uses `medicine` and `medicine_transactions` tables

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

export async function createMedicine({ name, quantity = 0, expiration = null }) {
  if (!name) throw new Error('name is required')
  if (quantity == null || Number(quantity) < 0) throw new Error('quantity must be >= 0')

  const { data, error } = await supabase.from('medicine').insert({ name, quantity, expiration }).select().single()
  if (error) throw error
  return data
}

export async function availMedicine({ medicine_id, name, purok, quantity }) {
  if (!medicine_id) throw new Error('medicine_id required')
  quantity = Number(quantity)
  if (!quantity || quantity <= 0) throw new Error('quantity must be > 0')

  const { data: medicine, error: tErr } = await supabase.from('medicine').select('quantity, name').eq('medicine_id', medicine_id).single()
  if (tErr) throw tErr
  if (!medicine) throw new Error('Medicine not found')
  if (medicine.quantity < quantity) throw new Error('Insufficient stock')

  const { data: updated, error: updErr } = await supabase
    .from('medicine')
    .update({ quantity: medicine.quantity - quantity })
    .eq('medicine_id', medicine_id)
    .gte('quantity', quantity)
    .select()

  if (updErr) throw updErr
  if (!updated || updated.length === 0) throw new Error('Failed to reserve stock (concurrent update)')

  const insertPayload = {
    medicine_id,
    medicine_name: medicine.name,
    quantity,
    transaction_type: 'request',
    recipient_name: name || null,
    recipient_purok: purok || null,
  }

  const { data: txRow, error: txErr } = await supabase
    .from('medicine_transactions')
    .insert(insertPayload)
    .select()
    .single()

  if (txErr) {
    try { await supabase.from('medicine').update({ quantity: updated[0].quantity + quantity }).eq('medicine_id', medicine_id) } catch (e) { console.error('Rollback failed:', e) }
    throw txErr
  }

  return txRow
}

export async function listAvailedMedicine() {
  const { data, error } = await supabase.from('medicine_transactions').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function updateMedicine(medicine_id, updates) {
  if (!medicine_id) throw new Error('medicine_id required')
  const { data, error } = await supabase.from('medicine').update(updates).eq('medicine_id', medicine_id).select().single()
  if (error) throw error
  return data
}

export async function deleteMedicine(medicine_id) {
  if (!medicine_id) throw new Error('medicine_id required')
  const { error } = await supabase.from('medicine').delete().eq('medicine_id', medicine_id)
  if (error) throw error
}

export async function getLowStockMedicine(threshold = 5) {
  const { data, error } = await supabase
    .from('medicine')
    .select('*')
    .lte('quantity', threshold)
    .order('quantity', { ascending: true })

  if (error) throw error
  return data
}

export async function getExpiringMedicine(days = 30) {
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + days)
  const futureDateISO = futureDate.toISOString().split('T')[0]
  const todayISO = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('medicine')
    .select('*')
    .not('expiration', 'is', null)
    .lte('expiration', futureDateISO)
    .gte('expiration', todayISO)
    .order('expiration', { ascending: true })

  if (error) throw error
  return data
}

export async function getExpiredMedicine() {
  const todayISO = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('medicine')
    .select('*')
    .not('expiration', 'is', null)
    .lt('expiration', todayISO)
    .order('expiration', { ascending: true })

  if (error) throw error
  return data
}

export async function stockInMedicine(medicine_id, quantity, expiration = null) {
  if (!medicine_id) throw new Error('medicine_id required')
  quantity = Number(quantity)
  if (!quantity || quantity <= 0) throw new Error('quantity must be > 0')

  const { data: current } = await supabase
    .from('medicine')
    .select('quantity')
    .eq('medicine_id', medicine_id)
    .single()

  const updates = { quantity: (current?.quantity || 0) + quantity }
  if (expiration) updates.expiration = expiration

  const { data, error } = await supabase
    .from('medicine')
    .update(updates)
    .eq('medicine_id', medicine_id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getMedicineAlerts() {
  const [lowStock, expiring, expired] = await Promise.all([
    getLowStockMedicine(),
    getExpiringMedicine(),
    getExpiredMedicine(),
  ])
  return { lowStock, expiring, expired }
}

export async function updateMedicineTransaction(transaction_id, updates) {
  if (!transaction_id) throw new Error('transaction_id required')
  const { data, error } = await supabase
    .from('medicine_transactions')
    .update(updates)
    .eq('transaction_id', transaction_id)
    .select()
    .single()
  if (error) throw error
  return data
}

export default {
  listMedicine,
  createMedicine,
  getMedicine,
  availMedicine,
  listAvailedMedicine,
  updateMedicine,
  updateMedicineTransaction,
  deleteMedicine,
  getLowStockMedicine,
  getExpiringMedicine,
  getExpiredMedicine,
  stockInMedicine,
  getMedicineAlerts,
}
