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

export const syncPinsFromDb = async () => {
  const { data, error } = await supabase.from('users').select('id, pin')
  if (error) { log('syncPinsFromDb', error); return }
  const pins = {}
  ;(data || []).forEach(r => { pins[r.id] = r.pin })
  localStorage.setItem('cabinet_pins', JSON.stringify(pins))
}

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

// ── PLANNING EVENTS ──────────────────────────────────────────

export const getPlanningEvents = async (userIds, from, to) => {
  const { data, error } = await supabase.from('planning_events').select('*')
    .in('user_id', userIds).gte('date', from).lte('date', to)
  if (error) { log('getPlanningEvents', error); throw error }
  return data || []
}

export const getPlanningEventsByUser = async (userId, from, to) => {
  const { data, error } = await supabase.from('planning_events').select('*')
    .eq('user_id', userId).gte('date', from).lte('date', to).order('date', { ascending: true })
  if (error) { log('getPlanningEventsByUser', error); throw error }
  return data || []
}

export const upsertPlanningEvent = async (event) => {
  const { data, error } = await supabase.from('planning_events')
    .upsert(event, { onConflict: 'user_id,date' }).select().single()
  if (error) { log('upsertPlanningEvent', error); throw error }
  return data
}

export const deletePlanningEvent = async (userId, date) => {
  const { error } = await supabase.from('planning_events')
    .delete().eq('user_id', userId).eq('date', date)
  if (error) { log('deletePlanningEvent', error); throw error }
}

// ── CONGÉS ────────────────────────────────────────────────────

export const getCongesByUser = async (userId) => {
  const { data, error } = await supabase
    .from('conges')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) { log('getCongesByUser', error); throw error }
  return data || []
}

export const getAllConges = async () => {
  const { data, error } = await supabase
    .from('conges')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { log('getAllConges', error); throw error }
  return data || []
}

export const getCongesPending = async () => {
  const { data, error } = await supabase
    .from('conges')
    .select('*')
    .eq('statut', 'en_attente')
    .order('created_at', { ascending: true })
  if (error) { log('getCongesPending', error); throw error }
  return data || []
}

export const insertConge = async (conge) => {
  const { data, error } = await supabase
    .from('conges')
    .insert(conge)
    .select()
    .single()
  if (error) { log('insertConge', error); throw error }
  return data
}

export const updateCongeStatut = async (id, statut, traitePar, commentaire = '') => {
  const { data, error } = await supabase
    .from('conges')
    .update({
      statut,
      traite_par: traitePar,
      traite_le: new Date().toISOString(),
      commentaire,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) { log('updateCongeStatut', error); throw error }
  return data
}

export const deleteConge = async (id) => {
  const { error } = await supabase.from('conges').delete().eq('id', id)
  if (error) { log('deleteConge', error); throw error }
}

// ── LOGS D'ACCÈS ─────────────────────────────────────────────

export const logAccess = async ({ userId, action, userAgent }) => {
  try {
    await supabase.from('access_logs').insert({
      user_id:    userId ?? null,
      action,
      ip:         null, // non disponible côté client
      user_agent: userAgent ?? null,
    })
  } catch {} // non bloquant — ne doit jamais interrompre le flux de connexion
}

// ── NOTIFICATIONS ─────────────────────────────────────────────

export const insertNotification = async (notif) => {
  const { error } = await supabase.from('notifications').insert(notif)
  if (error) { log('insertNotification', error); throw error }
}

export const getNotificationsForUser = async (userId) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(40)
  if (error) { log('getNotificationsForUser', error); throw error }
  return data || []
}

export const markNotificationRead = async (id) => {
  const { error } = await supabase
    .from('notifications')
    .update({ lu: true })
    .eq('id', id)
  if (error) { log('markNotificationRead', error); throw error }
}

export const markAllNotificationsRead = async (userId) => {
  const { error } = await supabase
    .from('notifications')
    .update({ lu: true })
    .eq('user_id', userId)
    .eq('lu', false)
  if (error) { log('markAllNotificationsRead', error); throw error }
}

// ── PLANNING TÂCHES ───────────────────────────────────────────

export const getPlanningTaches = async (userIds, from, to) => {
  const { data, error } = await supabase.from('planning_taches').select('*')
    .in('user_id', userIds).gte('date', from).lte('date', to)
    .order('heure_debut', { ascending: true })
  if (error) { log('getPlanningTaches', error); throw error }
  return data || []
}

export const getPlanningTachesByUser = async (userId, from, to) => {
  const { data, error } = await supabase.from('planning_taches').select('*')
    .eq('user_id', userId).gte('date', from).lte('date', to)
    .order('heure_debut', { ascending: true })
  if (error) { log('getPlanningTachesByUser', error); throw error }
  return data || []
}

export const insertPlanningTache = async (tache) => {
  const { data, error } = await supabase.from('planning_taches').insert(tache).select().single()
  if (error) { log('insertPlanningTache', error); throw error }
  return data
}

export const updatePlanningTache = async (id, data) => {
  const { data: rec, error } = await supabase.from('planning_taches').update(data).eq('id', id).select().single()
  if (error) { log('updatePlanningTache', error); throw error }
  return rec
}

export const deletePlanningTache = async (id) => {
  const { error } = await supabase.from('planning_taches').delete().eq('id', id)
  if (error) { log('deletePlanningTache', error); throw error }
}
