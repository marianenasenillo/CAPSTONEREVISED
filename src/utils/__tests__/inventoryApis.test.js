import { describe, it, expect, vi } from 'vitest'

// Mock supabase before importing modules that use it
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}))

describe('medicine.js', () => {
  it('createMedicine throws if name is missing', async () => {
    const { createMedicine } = await import('../medicine')
    await expect(createMedicine({ name: '', quantity: 10 })).rejects.toThrow('name is required')
  })

  it('createMedicine throws if quantity < 0', async () => {
    const { createMedicine } = await import('../medicine')
    await expect(createMedicine({ name: 'Aspirin', quantity: -1 })).rejects.toThrow('quantity must be >= 0')
  })

  it('availMedicine throws if medicine_id is missing', async () => {
    const { availMedicine } = await import('../medicine')
    await expect(availMedicine({ medicine_id: null, quantity: 1 })).rejects.toThrow('medicine_id required')
  })

  it('availMedicine throws if quantity <= 0', async () => {
    const { availMedicine } = await import('../medicine')
    await expect(availMedicine({ medicine_id: 'abc', quantity: 0 })).rejects.toThrow('quantity must be > 0')
    await expect(availMedicine({ medicine_id: 'abc', quantity: -5 })).rejects.toThrow('quantity must be > 0')
  })

  it('updateMedicine throws if medicine_id is missing', async () => {
    const { updateMedicine } = await import('../medicine')
    await expect(updateMedicine(null, { name: 'x' })).rejects.toThrow('medicine_id required')
  })

  it('deleteMedicine throws if medicine_id is missing', async () => {
    const { deleteMedicine } = await import('../medicine')
    await expect(deleteMedicine(null)).rejects.toThrow('medicine_id required')
  })
})

describe('tools.js', () => {
  it('createTool throws if name is missing', async () => {
    const { createTool } = await import('../tools')
    await expect(createTool({ name: '', quantity: 5 })).rejects.toThrow('name is required')
  })

  it('createTool throws if quantity < 0', async () => {
    const { createTool } = await import('../tools')
    await expect(createTool({ name: 'Hammer', quantity: -1 })).rejects.toThrow('quantity must be >= 0')
  })

  it('availTool throws if tool_id is missing', async () => {
    const { availTool } = await import('../tools')
    await expect(availTool({ tool_id: null, quantity: 1 })).rejects.toThrow('tool_id required')
  })

  it('availTool throws if quantity <= 0', async () => {
    const { availTool } = await import('../tools')
    await expect(availTool({ tool_id: 'abc', quantity: 0 })).rejects.toThrow('quantity must be > 0')
  })

  it('updateTool throws if tool_id is missing', async () => {
    const { updateTool } = await import('../tools')
    await expect(updateTool(null, {})).rejects.toThrow('tool_id required')
  })

  it('deleteTool throws if tool_id is missing', async () => {
    const { deleteTool } = await import('../tools')
    await expect(deleteTool(null)).rejects.toThrow('tool_id required')
  })
})
