import { supabase } from './supabase'

/**
 * Recalculate population, male_count, and female_count for a household head.
 * Counts all non-archived members + the head itself.
 */
export async function recalcPopulation(head_id) {
  if (!head_id) return
  try {
    const { data: head } = await supabase
      .from('household_heads')
      .select('sex')
      .eq('head_id', head_id)
      .single()
    const { data: mems } = await supabase
      .from('household_members')
      .select('sex')
      .eq('head_id', head_id)
      .eq('is_archived', false)
    const allPeople = [...(mems || [])]
    if (head) allPeople.push({ sex: head.sex })
    const population = allPeople.length
    const male_count = allPeople.filter(p => p.sex === 'M' || p.sex === 'Male').length
    const female_count = allPeople.filter(p => p.sex === 'F' || p.sex === 'Female').length
    await supabase
      .from('household_heads')
      .update({ population, male_count, female_count })
      .eq('head_id', head_id)
  } catch (e) {
    console.error('recalcPopulation error:', e)
  }
}
