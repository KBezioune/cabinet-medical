import { supabase } from './supabase'
import { getUserById } from './localData'

const log = (fn, err) => console.error(`[db.${fn}]`, err?.code, err?.message, err)

// Test de connexion — appelé au démarrage pour diagnostiquer
export const testConnection = async () => {
  try {
    const { error } = await supabase.from('pointages').select('id').limit(1)
    if (error) { log('testConnection', error); return { ok: false, message: `${error.code}: ${error.message}` } }
    return { ok: true }
  } catch (e) {
    console.error('[db.testConnection] network error', e)
    return { ok: false, message: `Réseau: ${e.message}` }
  }
}

// ── POINTAGES ────────────────────────────────────────────────

export const getPointageByUserAndDate = async (userId, date) => {
  const { data, error } = await supabase
    .from('pointages')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle()
  if (error) { log('getPointageByUserAndDate', error); throw error }
  return data
}

export const getPointagesByUserAndMonth = async (userId, from, to) => {
  const { data, error } = await supabase.from('pointages').select('*')
    .eq('user_id', userId).gte('date', from).lte('date', to).order('date', { ascending: false })
  if (error) { log('getPointagesByUserAndMonth', error); throw error }
  return data || []
}

export const getPointagesByDateRange = async (userIds, from, to) => {
  const { data, error } = await supabase.from('pointages').select('*')
    .in('user_id', userIds).gte('date', from).lte('date', to)
  if (error) { log('getPointagesByDateRange', error); throw error }
  return data || []
}

export const getAllPointagesFiltered = async ({ userId, date } = {}) => {
  let q = supabase.from('pointages').select('*').order('date', { ascending: false }).limit(500)
  if (userId) q = q.eq('user_id', userId)
  if (date)   q = q.eq('date', date)
  const { data, error } = await q
  if (error) { log('getAllPointagesFiltered', error); throw error }
  return (data || []).map(p => ({ ...p, users: getUserById(p.user_id) }))
}

export const insertPointage = async (data) => {
  const { data: record, error } = await supabase.from('pointages').insert(data).select().single()
  if (error) { log('insertPointage', error); throw error }
  return record
}

export const updatePointage = async (id, data) => {
  const { data: record, error } = await supabase.from('pointages').update(data).eq('id', id).select().single()
  if (error) { log('updatePointage', error); throw error }
  return record
}

export const deletePointage = async (id) => {
  const { error } = await supabase.from('pointages').delete().eq('id', id)
  if (error) { log('deletePointage', error); throw error }
}

// ── USERS / PINS ─────────────────────────────────────────────

// Lit les PINs depuis Supabase et met à jour localStorage
export const syncPinsFromDb = async () => {
  const { data, error } = await supabase.from('users').select('id, pin')
  if (error) { log('syncPinsFromDb', error); return }
  const pins = {}
  ;(data || []).forEach(r => { pins[r.id] = r.pin })
  localStorage.setItem('cabinet_pins', JSON.stringify(pins))
}

// Met à jour le PIN d'un utilisateur dans Supabase
export const updateUserPinInDb = async (userId, newPin) => {
  const { error } = await supabase.from('users').update({ pin: newPin }).eq('id', userId)
  if (error) { log('updateUserPinInDb', error); throw error }
}

// ── PLANNING ─────────────────────────────────────────────────

export const getPlanningByUser = async (userId) => {
  const { data, error } = await supabase.from('planning').select('*').eq('user_id', userId).eq('actif', true)
  if (error) { log('getPlanningByUser', error); throw error }
  return data || []
}

export const getPlanningForUsers = async (userIds) => {
  const { data, error } = await supabase.from('planning').select('*').in('user_id', userIds)
  if (error) { log('getPlanningForUsers', error); throw error }
  return data || []
}

export const upsertPlanning = async (userId, jour_semaine, heure_debut, heure_fin) => {
  const { error } = await supabase.from('planning').upsert(
    { user_id: userId, jour_semaine, heure_debut: heure_debut || null, heure_fin: heure_fin || null, actif: !!(heure_debut && heure_fin) },
    { onConflict: 'user_id,jour_semaine' }
  )
  if (error) { log('upsertPlanning', error); throw error }
}
