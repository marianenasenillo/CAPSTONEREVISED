import { supabase } from './supabase'

// Tools helper — uses `tools` and `tool_transactions` tables

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

export async function availTool({ tool_id, name, purok, quantity, daystoreturn = null }) {
  if (!tool_id) throw new Error('tool_id required')
  quantity = Number(quantity)
  if (!quantity || quantity <= 0) throw new Error('quantity must be > 0')

  const { data: tool, error: tErr } = await supabase.from('tools').select('quantity, name').eq('tool_id', tool_id).single()
  if (tErr) throw tErr
  if (!tool) throw new Error('Tool not found')
  if (tool.quantity < quantity) throw new Error('Insufficient stock')

  const { data: updated, error: updErr } = await supabase
    .from('tools')
    .update({ quantity: tool.quantity - quantity })
    .eq('tool_id', tool_id)
    .gte('quantity', quantity)
    .select()

  if (updErr) throw updErr
  if (!updated || updated.length === 0) throw new Error('Failed to reserve stock (concurrent update)')

  const insertPayload = {
    tool_id,
    tool_name: tool.name,
    quantity,
    transaction_type: 'borrow',
    status: 'borrowed',
    recipient_name: name || null,
    recipient_purok: purok || null,
    expected_return_date: daystoreturn || null,
  }

  const { data: txRow, error: txErr } = await supabase
    .from('tool_transactions')
    .insert(insertPayload)
    .select()
    .single()

  if (txErr) {
    try { await supabase.from('tools').update({ quantity: updated[0].quantity + quantity }).eq('tool_id', tool_id) } catch (e) { console.error('Rollback failed:', e) }
    throw txErr
  }

  return txRow
}

export async function listAvailedTools() {
  const { data, error } = await supabase.from('tool_transactions').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function updateTool(tool_id, updates) {
  if (!tool_id) throw new Error('tool_id required')
  const { data, error } = await supabase.from('tools').update(updates).eq('tool_id', tool_id).select().single()
  if (error) throw error
  return data
}

export async function deleteTool(tool_id) {
  if (!tool_id) throw new Error('tool_id required')

  // Delete related transactions first to avoid FK constraint
  const { error: txError } = await supabase
    .from('tool_transactions')
    .delete()
    .eq('tool_id', tool_id)
  if (txError) throw txError

  const { error } = await supabase
    .from('tools')
    .delete()
    .eq('tool_id', tool_id)
  if (error) throw error

  // Verify the record was actually deleted (RLS may silently block)
  const { data: check } = await supabase
    .from('tools')
    .select('tool_id')
    .eq('tool_id', tool_id)
    .maybeSingle()
  if (check) throw new Error('Delete was blocked by a database policy. Please contact your administrator.')

  return true
}

export async function getLowStockTools(threshold = 3) {
  const { data, error } = await supabase
    .from('tools')
    .select('*')
    .lte('quantity', threshold)
    .order('quantity', { ascending: true })

  if (error) throw error
  return data
}

export async function returnTool(transaction_id, return_quantity = null) {
  const { data: record, error: rErr } = await supabase
    .from('tool_transactions')
    .select('*')
    .eq('transaction_id', transaction_id)
    .single()

  if (rErr) throw rErr
  if (!record) throw new Error('Borrow record not found')
  if (record.status === 'returned') throw new Error('Tool already returned')

  const qty = return_quantity ? Number(return_quantity) : record.quantity

  const { data: tool } = await supabase.from('tools').select('quantity').eq('tool_id', record.tool_id).single()

  const { error: updErr } = await supabase
    .from('tools')
    .update({ quantity: (tool?.quantity || 0) + qty })
    .eq('tool_id', record.tool_id)

  if (updErr) throw updErr

  const { data: updated, error: upErr } = await supabase
    .from('tool_transactions')
    .update({ status: 'returned', return_date: new Date().toISOString(), return_quantity: qty })
    .eq('transaction_id', transaction_id)
    .select()
    .single()

  if (upErr) throw upErr
  return updated
}

export async function getActiveBorrows() {
  const { data, error } = await supabase
    .from('tool_transactions')
    .select('*')
    .or('status.is.null,status.eq.borrowed')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getOverdueBorrows() {
  const todayISO = new Date().toISOString()

  const { data, error } = await supabase
    .from('tool_transactions')
    .select('*')
    .or('status.is.null,status.eq.borrowed')
    .not('expected_return_date', 'is', null)
    .lt('expected_return_date', todayISO)
    .order('expected_return_date', { ascending: true })

  if (error) throw error
  return data
}

export async function stockInTool(tool_id, quantity) {
  if (!tool_id) throw new Error('tool_id required')
  quantity = Number(quantity)
  if (!quantity || quantity <= 0) throw new Error('quantity must be > 0')

  const { data: current } = await supabase.from('tools').select('quantity').eq('tool_id', tool_id).single()

  const { data, error } = await supabase
    .from('tools')
    .update({ quantity: (current?.quantity || 0) + quantity })
    .eq('tool_id', tool_id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateToolTransaction(transaction_id, updates) {
  if (!transaction_id) throw new Error('transaction_id required')
  const { data, error } = await supabase
    .from('tool_transactions')
    .update(updates)
    .eq('transaction_id', transaction_id)
    .select()
  if (error) throw error
  if (!data || data.length === 0) throw new Error('No transaction found or update not permitted')
  return data[0]
}

export default {
  listTools,
  createTool,
  getTool,
  availTool,
  listAvailedTools,
  updateTool,
  updateToolTransaction,
  deleteTool,
  getLowStockTools,
  returnTool,
  getActiveBorrows,
  getOverdueBorrows,
  stockInTool,
}
