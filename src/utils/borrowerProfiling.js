// Borrower & Patient Profiling — links household members to medicine/tool transactions
import { supabase } from './supabase'

// Create or get existing borrower profile for a household member
export async function getOrCreateBorrowerProfile({
  member_id,
  head_id,
  firstname,
  lastname,
  middlename = '',
  suffix = '',
  purok,
  barangay,
}) {
  if (member_id) {
    const { data: existing } = await supabase
      .from('borrower_profiles')
      .select('*')
      .eq('member_id', member_id)
      .maybeSingle()

    if (existing) return existing
  }

  const { data, error } = await supabase
    .from('borrower_profiles')
    .insert({
      member_id: member_id || null,
      head_id: head_id || null,
      firstname,
      lastname,
      middlename,
      suffix,
      purok,
      barangay,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function listBorrowerProfiles(filters = {}) {
  let query = supabase
    .from('borrower_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters.barangay) {
    query = query.eq('barangay', filters.barangay)
  }
  if (filters.purok) {
    query = query.eq('purok', filters.purok)
  }
  if (filters.search) {
    query = query.or(
      `firstname.ilike.%${filters.search}%,lastname.ilike.%${filters.search}%`
    )
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getBorrowerWithHistory(borrower_id) {
  const { data: profile, error: pErr } = await supabase
    .from('borrower_profiles')
    .select('*')
    .eq('borrower_id', borrower_id)
    .single()

  if (pErr) throw pErr

  const { data: medTx, error: medErr } = await supabase
    .from('medicine_transactions')
    .select('*, medicine(name)')
    .eq('borrower_id', borrower_id)
    .order('created_at', { ascending: false })

  if (medErr) throw medErr

  const { data: toolTx, error: toolErr } = await supabase
    .from('tool_transactions')
    .select('*, tools(name)')
    .eq('borrower_id', borrower_id)
    .order('created_at', { ascending: false })

  if (toolErr) throw toolErr

  return {
    ...profile,
    medicine_transactions: medTx || [],
    tool_transactions: toolTx || [],
  }
}

export async function createMedicineTransaction({
  borrower_id,
  medicine_id,
  quantity,
  purpose = '',
  prescribed_by = '',
}) {
  if (!borrower_id) throw new Error('borrower_id required')
  if (!medicine_id) throw new Error('medicine_id required')
  quantity = Number(quantity)
  if (!quantity || quantity <= 0) throw new Error('quantity must be > 0')

  const { data: med, error: medErr } = await supabase
    .from('medicine')
    .select('quantity, name')
    .eq('medicine_id', medicine_id)
    .single()

  if (medErr) throw medErr
  if (!med) throw new Error('Medicine not found')
  if (med.quantity < quantity) throw new Error('Insufficient medicine stock')

  const { data: updated, error: updErr } = await supabase
    .from('medicine')
    .update({ quantity: med.quantity - quantity })
    .eq('medicine_id', medicine_id)
    .gte('quantity', quantity)
    .select()

  if (updErr) throw updErr
  if (!updated || updated.length === 0) {
    throw new Error('Failed to reserve stock (concurrent update)')
  }

  // Look up borrower profile to populate recipient fields
  let recipientName = null
  let recipientPurok = null
  const { data: bp, error: bpErr } = await supabase
    .from('borrower_profiles')
    .select('firstname, lastname, purok')
    .eq('borrower_id', borrower_id)
    .maybeSingle()
  if (!bpErr && bp) {
    recipientName = [bp.firstname, bp.lastname].filter(Boolean).join(' ') || null
    recipientPurok = bp.purok || null
  }

  const { data: tx, error: txErr } = await supabase
    .from('medicine_transactions')
    .insert({
      borrower_id,
      medicine_id,
      medicine_name: med.name,
      quantity,
      purpose,
      prescribed_by,
      transaction_type: 'request',
      recipient_name: recipientName,
      recipient_purok: recipientPurok,
    })
    .select()
    .single()

  if (txErr) {
    try {
      await supabase
        .from('medicine')
        .update({ quantity: updated[0].quantity + quantity })
        .eq('medicine_id', medicine_id)
    } catch (e) {
      console.error('Rollback failed:', e)
    }
    throw txErr
  }

  return tx
}

export async function listMedicineTransactions(filters = {}) {
  let query = supabase
    .from('medicine_transactions')
    .select('*, borrower_profiles(firstname, lastname, purok)')
    .order('created_at', { ascending: false })

  if (filters.borrower_id) {
    query = query.eq('borrower_id', filters.borrower_id)
  }
  if (filters.medicine_id) {
    query = query.eq('medicine_id', filters.medicine_id)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createToolBorrowTransaction({
  borrower_id,
  tool_id,
  quantity,
  purpose = '',
  expected_return_date = null,
}) {
  if (!borrower_id) throw new Error('borrower_id required')
  if (!tool_id) throw new Error('tool_id required')
  quantity = Number(quantity)
  if (!quantity || quantity <= 0) throw new Error('quantity must be > 0')

  const { data: tool, error: toolErr } = await supabase
    .from('tools')
    .select('quantity, name')
    .eq('tool_id', tool_id)
    .single()

  if (toolErr) throw toolErr
  if (!tool) throw new Error('Tool not found')
  if (tool.quantity < quantity) throw new Error('Insufficient tool stock')

  const { data: updated, error: updErr } = await supabase
    .from('tools')
    .update({ quantity: tool.quantity - quantity })
    .eq('tool_id', tool_id)
    .gte('quantity', quantity)
    .select()

  if (updErr) throw updErr
  if (!updated || updated.length === 0) {
    throw new Error('Failed to reserve stock (concurrent update)')
  }

  // Look up borrower profile to populate recipient fields
  let recipientName = null
  let recipientPurok = null
  const { data: bp2, error: bp2Err } = await supabase
    .from('borrower_profiles')
    .select('firstname, lastname, purok')
    .eq('borrower_id', borrower_id)
    .maybeSingle()
  if (!bp2Err && bp2) {
    recipientName = [bp2.firstname, bp2.lastname].filter(Boolean).join(' ') || null
    recipientPurok = bp2.purok || null
  }

  const { data: tx, error: txErr } = await supabase
    .from('tool_transactions')
    .insert({
      borrower_id,
      tool_id,
      tool_name: tool.name,
      quantity,
      purpose,
      expected_return_date,
      status: 'borrowed',
      transaction_type: 'borrow',
      recipient_name: recipientName,
      recipient_purok: recipientPurok,
    })
    .select()
    .single()

  if (txErr) {
    try {
      await supabase
        .from('tools')
        .update({ quantity: updated[0].quantity + quantity })
        .eq('tool_id', tool_id)
    } catch (e) {
      console.error('Rollback failed:', e)
    }
    throw txErr
  }

  return tx
}

export async function returnTool(transaction_id, return_quantity = null) {
  // Get borrow transaction
  const { data: tx, error: txErr } = await supabase
    .from('tool_transactions')
    .select('*')
    .eq('transaction_id', transaction_id)
    .single()

  if (txErr) throw txErr
  if (!tx) throw new Error('Transaction not found')
  if (tx.status === 'returned') throw new Error('Tool already returned')

  const qty = return_quantity ? Number(return_quantity) : tx.quantity

  const { data: tool } = await supabase
    .from('tools')
    .select('quantity')
    .eq('tool_id', tx.tool_id)
    .single()

  const { error: updErr } = await supabase
    .from('tools')
    .update({ quantity: (tool?.quantity || 0) + qty })
    .eq('tool_id', tx.tool_id)

  if (updErr) throw updErr

  // Update transaction status
  const { data: updated, error: upTxErr } = await supabase
    .from('tool_transactions')
    .update({
      status: 'returned',
      return_date: new Date().toISOString(),
      return_quantity: qty,
    })
    .eq('transaction_id', transaction_id)
    .select()
    .single()

  if (upTxErr) throw upTxErr
  return updated
}

export async function listToolTransactions(filters = {}) {
  let query = supabase
    .from('tool_transactions')
    .select('*, borrower_profiles(firstname, lastname, purok)')
    .order('created_at', { ascending: false })

  if (filters.borrower_id) {
    query = query.eq('borrower_id', filters.borrower_id)
  }
  if (filters.tool_id) {
    query = query.eq('tool_id', filters.tool_id)
  }
  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getActiveBorrows(filters = {}) {
  return listToolTransactions({ ...filters, status: 'borrowed' })
}

export async function getMostRequestedMedicines(limit = 10) {
  const { data, error } = await supabase
    .from('medicine_transactions')
    .select('medicine_name, medicine_id, quantity')
    .order('created_at', { ascending: false })

  if (error) throw error

  const agg = {}
  for (const tx of data) {
    const key = tx.medicine_id
    if (!agg[key]) {
      agg[key] = { medicine_id: key, medicine_name: tx.medicine_name, total_quantity: 0, request_count: 0 }
    }
    agg[key].total_quantity += tx.quantity
    agg[key].request_count++
  }

  return Object.values(agg)
    .sort((a, b) => b.total_quantity - a.total_quantity)
    .slice(0, limit)
}

export async function getMostBorrowedTools(limit = 10) {
  const { data, error } = await supabase
    .from('tool_transactions')
    .select('tool_name, tool_id, quantity')
    .eq('transaction_type', 'borrow')
    .order('created_at', { ascending: false })

  if (error) throw error

  const agg = {}
  for (const tx of data) {
    const key = tx.tool_id
    if (!agg[key]) {
      agg[key] = { tool_id: key, tool_name: tx.tool_name, total_quantity: 0, borrow_count: 0 }
    }
    agg[key].total_quantity += tx.quantity
    agg[key].borrow_count++
  }

  return Object.values(agg)
    .sort((a, b) => b.total_quantity - a.total_quantity)
    .slice(0, limit)
}

export async function getMonthlyUsageTrends(months = 6) {
  const since = new Date()
  since.setMonth(since.getMonth() - months)
  const sinceISO = since.toISOString()

  const [medResult, toolResult] = await Promise.all([
    supabase
      .from('medicine_transactions')
      .select('quantity, created_at')
      .gte('created_at', sinceISO)
      .order('created_at', { ascending: true }),
    supabase
      .from('tool_transactions')
      .select('quantity, created_at')
      .gte('created_at', sinceISO)
      .order('created_at', { ascending: true }),
  ])

  if (medResult.error) throw medResult.error
  if (toolResult.error) throw toolResult.error

  function aggregateByMonth(records) {
    const monthly = {}
    for (const r of records) {
      const d = new Date(r.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!monthly[key]) monthly[key] = { month: key, total_quantity: 0, count: 0 }
      monthly[key].total_quantity += r.quantity
      monthly[key].count++
    }
    return Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month))
  }

  return {
    medicine: aggregateByMonth(medResult.data || []),
    tools: aggregateByMonth(toolResult.data || []),
  }
}
