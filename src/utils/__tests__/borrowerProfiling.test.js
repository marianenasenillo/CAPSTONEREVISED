import { describe, it, expect, vi, beforeEach } from 'vitest'

// Chainable mock builder — each Supabase method returns the chain itself
function createChain(resolvedValue = { data: null, error: null }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
    maybeSingle: vi.fn().mockResolvedValue(resolvedValue),
    then: vi.fn((resolve) => resolve(resolvedValue)),
  }
  // Make chain itself thenable so `await query` works
  chain[Symbol.for('vitest:thenable')] = true
  // Provide a default resolution for `await query` (no .single / .maybeSingle)
  chain.then = (resolve, reject) => Promise.resolve(resolvedValue).then(resolve, reject)
  return chain
}

let mockChain

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(() => mockChain),
  },
}))

beforeEach(() => {
  vi.resetModules()
  mockChain = createChain()
})

// ---------- createMedicineTransaction ----------
describe('createMedicineTransaction', () => {
  it('throws if borrower_id is missing', async () => {
    const { createMedicineTransaction } = await import('../borrowerProfiling')
    await expect(
      createMedicineTransaction({ borrower_id: '', medicine_id: 'x', quantity: 1 }),
    ).rejects.toThrow('borrower_id required')
  })

  it('throws if neither medicine_id nor medicine_name_manual is provided', async () => {
    const { createMedicineTransaction } = await import('../borrowerProfiling')
    await expect(
      createMedicineTransaction({ borrower_id: 'b1', medicine_id: '', medicine_name_manual: '', quantity: 1 }),
    ).rejects.toThrow('medicine_id or medicine name required')
  })

  it('throws if quantity is 0 or negative', async () => {
    const { createMedicineTransaction } = await import('../borrowerProfiling')
    await expect(
      createMedicineTransaction({ borrower_id: 'b1', medicine_id: 'x', quantity: 0 }),
    ).rejects.toThrow('quantity must be > 0')
    await expect(
      createMedicineTransaction({ borrower_id: 'b1', medicine_id: 'x', quantity: -3 }),
    ).rejects.toThrow('quantity must be > 0')
  })
})

// ---------- createToolBorrowTransaction ----------
describe('createToolBorrowTransaction', () => {
  it('throws if borrower_id is missing', async () => {
    const { createToolBorrowTransaction } = await import('../borrowerProfiling')
    await expect(
      createToolBorrowTransaction({ borrower_id: '', tool_id: 'x', quantity: 1 }),
    ).rejects.toThrow('borrower_id required')
  })

  it('throws if neither tool_id nor tool_name_manual is provided', async () => {
    const { createToolBorrowTransaction } = await import('../borrowerProfiling')
    await expect(
      createToolBorrowTransaction({ borrower_id: 'b1', tool_id: '', tool_name_manual: '', quantity: 1 }),
    ).rejects.toThrow('tool_id or tool name required')
  })

  it('throws if quantity is 0 or negative', async () => {
    const { createToolBorrowTransaction } = await import('../borrowerProfiling')
    await expect(
      createToolBorrowTransaction({ borrower_id: 'b1', tool_id: 'x', quantity: 0 }),
    ).rejects.toThrow('quantity must be > 0')
  })
})

// ---------- archiveBorrowerProfile ----------
describe('archiveBorrowerProfile', () => {
  it('throws if borrower_id is missing', async () => {
    const { archiveBorrowerProfile } = await import('../borrowerProfiling')
    await expect(archiveBorrowerProfile(null)).rejects.toThrow('borrower_id required')
    await expect(archiveBorrowerProfile('')).rejects.toThrow('borrower_id required')
  })
})

// ---------- listBorrowerProfiles ----------
describe('listBorrowerProfiles', () => {
  it('calls supabase with is_archived = false filter', async () => {
    const { supabase } = await import('../supabase')
    const { listBorrowerProfiles } = await import('../borrowerProfiling')
    await listBorrowerProfiles({ barangay: 'Test' })
    // Verify .eq was called (chain includes is_archived filter)
    expect(supabase.from).toHaveBeenCalledWith('borrower_profiles')
    expect(mockChain.eq).toHaveBeenCalledWith('is_archived', false)
  })
})
