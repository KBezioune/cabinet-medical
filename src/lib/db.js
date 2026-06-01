import { supabase } from './supabase'
import { getUserById } from './localData'

const log = (fn, err) => console.error(`[db.${fn}]`, err?.code, err?.message, err)

// ── MODE TEST ─────────────────────────────────────────────────
export const TEST_USER_ID = '00000000-0000-0000-0000-000000000099'

const isTestMode = () => {
  try {
    const u = JSON.parse(sessionStorage.getItem('cabinet_user') || 'null')
    return u?.id === TEST_USER_ID
  } catch { return false }
}

// Renvoie un enregistrement fictif pour les inserts/updates en mode test
const mockRec = (data = {}) => ({
  ...data,
  id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  created_at: new Date().toISOString(),
})

// ── CONNEXION ─────────────────────────────────────────────────

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
    .from('pointages').select('*').eq('user_id', userId).eq('date', date).maybeSingle()
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
  if (isTestMode()) return mockRec({ ...data, duree_minutes: null })
  const { data: record, error } = await supabase.from('pointages').insert(data).select().single()
  if (error) { log('insertPointage', error); throw error }
  return record
}

export const updatePointage = async (id, data) => {
  if (isTestMode()) return mockRec({ id, ...data })
  const { data: record, error } = await supabase.from('pointages').update(data).eq('id', id).select().single()
  if (error) { log('updatePointage', error); throw error }
  return record
}

export const deletePointage = async (id) => {
  if (isTestMode()) return
  const { error } = await supabase.from('pointages').delete().eq('id', id)
  if (error) { log('deletePointage', error); throw error }
}

// Nettoyage des pointages de test — bypass du guard intentionnel
export const deleteTestUserPointages = async () => {
  const { error } = await supabase.from('pointages').delete().eq('user_id', TEST_USER_ID)
  if (error) { log('deleteTestUserPointages', error); throw error }
}

// Réinitialisation d'un pointage (compte test uniquement) — bypass intentionnel
export const deletePointageReal = async (id) => {
  const { error } = await supabase.from('pointages').delete().eq('id', id)
  if (error) { log('deletePointageReal', error); throw error }
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
  if (isTestMode()) return
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
  if (isTestMode()) return
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
  if (isTestMode()) return mockRec(event)
  const { data, error } = await supabase.from('planning_events')
    .upsert(event, { onConflict: 'user_id,date' }).select().single()
  if (error) { log('upsertPlanningEvent', error); throw error }
  return data
}

export const deletePlanningEvent = async (userId, date) => {
  if (isTestMode()) return
  const { error } = await supabase.from('planning_events')
    .delete().eq('user_id', userId).eq('date', date)
  if (error) { log('deletePlanningEvent', error); throw error }
}

// ── CONGÉS ────────────────────────────────────────────────────

export const getCongesByUser = async (userId) => {
  const { data, error } = await supabase.from('conges').select('*')
    .eq('user_id', userId).order('created_at', { ascending: false })
  if (error) { log('getCongesByUser', error); throw error }
  return data || []
}

export const getAllConges = async () => {
  const { data, error } = await supabase.from('conges').select('*').order('created_at', { ascending: false })
  if (error) { log('getAllConges', error); throw error }
  return data || []
}

export const getCongesPending = async () => {
  const { data, error } = await supabase.from('conges').select('*')
    .eq('statut', 'en_attente').order('created_at', { ascending: true })
  if (error) { log('getCongesPending', error); throw error }
  return data || []
}

export const insertConge = async (conge) => {
  if (isTestMode()) return mockRec({ ...conge, statut: 'en_attente' })
  const { data, error } = await supabase.from('conges').insert(conge).select().single()
  if (error) { log('insertConge', error); throw error }
  return data
}

export const updateCongeStatut = async (id, statut, traitePar, commentaire = '') => {
  if (isTestMode()) return mockRec({ id, statut, traite_par: traitePar, commentaire })
  const { data, error } = await supabase.from('conges')
    .update({ statut, traite_par: traitePar, traite_le: new Date().toISOString(), commentaire })
    .eq('id', id).select().single()
  if (error) { log('updateCongeStatut', error); throw error }
  return data
}

export const deleteConge = async (id) => {
  if (isTestMode()) return
  const { error } = await supabase.from('conges').delete().eq('id', id)
  if (error) { log('deleteConge', error); throw error }
}

// ── LOGS D'ACCÈS ─────────────────────────────────────────────

export const getAccessLogs = async (limit = 50) => {
  const { data, error } = await supabase.from('access_logs').select('*')
    .order('created_at', { ascending: false }).limit(limit)
  if (error) { log('getAccessLogs', error); throw error }
  return data || []
}

export const logAccess = async ({ userId, action, userAgent }) => {
  if (isTestMode()) return
  try {
    await supabase.from('access_logs').insert({
      user_id: userId ?? null, action, ip: null, user_agent: userAgent ?? null,
    })
  } catch {}
}

// ── NOTIFICATIONS ─────────────────────────────────────────────

export const insertNotification = async (notif) => {
  if (isTestMode()) return
  const { error } = await supabase.from('notifications').insert(notif)
  if (error) { log('insertNotification', error); throw error }
}

export const getNotificationsForUser = async (userId) => {
  const { data, error } = await supabase.from('notifications').select('*')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(40)
  if (error) { log('getNotificationsForUser', error); throw error }
  return data || []
}

export const markNotificationRead = async (id) => {
  if (isTestMode()) return
  const { error } = await supabase.from('notifications').update({ lu: true }).eq('id', id)
  if (error) { log('markNotificationRead', error); throw error }
}

export const markAllNotificationsRead = async (userId) => {
  if (isTestMode()) return
  const { error } = await supabase.from('notifications').update({ lu: true })
    .eq('user_id', userId).eq('lu', false)
  if (error) { log('markAllNotificationsRead', error); throw error }
}

// ── NOTES DE FRAIS ────────────────────────────────────────────

export const getExpenseReports = async () => {
  const { data, error } = await supabase.from('expense_reports').select('*').order('created_at', { ascending: false })
  if (error) { log('getExpenseReports', error); throw error }
  return data || []
}

export const getExpenseReportsByUser = async (userId) => {
  const { data, error } = await supabase.from('expense_reports').select('*')
    .eq('user_id', userId).order('created_at', { ascending: false })
  if (error) { log('getExpenseReportsByUser', error); throw error }
  return data || []
}

export const insertExpenseReport = async (report) => {
  if (isTestMode()) return mockRec({ ...report, statut: 'en_attente' })
  const { data, error } = await supabase.from('expense_reports').insert(report).select().single()
  if (error) { log('insertExpenseReport', error); throw error }
  return data
}

export const updateExpenseReportStatut = async (id, statut, traitePar, commentaire = '') => {
  if (isTestMode()) return mockRec({ id, statut, traite_par: traitePar, commentaire })
  const { data, error } = await supabase.from('expense_reports')
    .update({ statut, traite_par: traitePar, traite_le: new Date().toISOString(), commentaire })
    .eq('id', id).select().single()
  if (error) { log('updateExpenseReportStatut', error); throw error }
  return data
}

export const deleteExpenseReport = async (id) => {
  if (isTestMode()) return
  const { error } = await supabase.from('expense_reports').delete().eq('id', id)
  if (error) { log('deleteExpenseReport', error); throw error }
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
  if (isTestMode()) return mockRec(tache)
  const { data, error } = await supabase.from('planning_taches').insert(tache).select().single()
  if (error) { log('insertPlanningTache', error); throw error }
  return data
}

export const updatePlanningTache = async (id, data) => {
  if (isTestMode()) return mockRec({ id, ...data })
  const { data: rec, error } = await supabase.from('planning_taches').update(data).eq('id', id).select().single()
  if (error) { log('updatePlanningTache', error); throw error }
  return rec
}

export const deletePlanningTache = async (id) => {
  if (isTestMode()) return
  const { error } = await supabase.from('planning_taches').delete().eq('id', id)
  if (error) { log('deletePlanningTache', error); throw error }
}

// ── PLANNING SHIFTS ───────────────────────────────────────────

export const getPlanningShifts = async (userIds, from, to) => {
  const { data, error } = await supabase.from('planning_shifts').select('*')
    .in('user_id', userIds).gte('date', from).lte('date', to)
  if (error) { log('getPlanningShifts', error); throw error }
  return data || []
}

export const upsertPlanningShift = async (shift) => {
  if (isTestMode()) return mockRec(shift)
  const { data, error } = await supabase.from('planning_shifts').insert(shift).select().single()
  if (error) { log('upsertPlanningShift', error); throw error }
  return data
}

export const deletePlanningShift = async (userId, date) => {
  if (isTestMode()) return
  const { error } = await supabase.from('planning_shifts').delete().eq('user_id', userId).eq('date', date)
  if (error) { log('deletePlanningShift', error); throw error }
}

export const updatePlanningShiftById = async (id, data) => {
  if (isTestMode()) return mockRec({ id, ...data })
  const { data: rec, error } = await supabase.from('planning_shifts')
    .update(data).eq('id', id).select().single()
  if (error) { log('updatePlanningShiftById', error); throw error }
  return rec
}

export const deletePlanningShiftById = async (id) => {
  if (isTestMode()) return
  const { error } = await supabase.from('planning_shifts').delete().eq('id', id)
  if (error) { log('deletePlanningShiftById', error); throw error }
}

// ── CONTRATS ──────────────────────────────────────────────────

export const getUserContract = async (userId) => {
  const { data, error } = await supabase.from('users')
    .select('taux_activite, heures_par_jour, date_entree, type_contrat, droit_vacances, salaire_brut')
    .eq('id', userId).maybeSingle()
  if (error) { log('getUserContract', error); return null }
  return data
}

export const updateUserContract = async (userId, contractData) => {
  if (isTestMode()) return
  const { error } = await supabase.from('users').update(contractData).eq('id', userId)
  if (error) { log('updateUserContract', error); throw error }
}

export const getAllUserContracts = async () => {
  const { data, error } = await supabase.from('users')
    .select('id, taux_activite, heures_par_jour, date_entree, type_contrat, droit_vacances, salaire_brut')
  if (error) { log('getAllUserContracts', error); return [] }
  return data || []
}

// ── MESSAGES ──────────────────────────────────────────────────

export const getMessages = async (userId, isAdmin) => {
  let q
  if (isAdmin) {
    q = supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(200)
  } else {
    q = supabase.from('messages').select('*')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId},to_user_id.is.null`)
      .order('created_at', { ascending: false }).limit(200)
  }
  const { data, error } = await q
  if (error) { log('getMessages', error); throw error }
  return data || []
}

export const sendMessage = async (message) => {
  if (isTestMode()) return mockRec({ ...message, read: false })
  const { data, error } = await supabase.from('messages').insert(message).select().single()
  if (error) { log('sendMessage', error); throw error }
  return data
}

export const markMessageRead = async (id) => {
  if (isTestMode()) return
  const { error } = await supabase.from('messages').update({ read: true }).eq('id', id)
  if (error) { log('markMessageRead', error) }
}

export const getUnreadMessageCount = async (userId, isAdmin) => {
  let q
  if (isAdmin) {
    q = supabase.from('messages').select('*', { count: 'exact', head: true })
      .eq('read', false).neq('from_user_id', userId)
  } else {
    q = supabase.from('messages').select('*', { count: 'exact', head: true })
      .eq('read', false).neq('from_user_id', userId)
      .or(`to_user_id.eq.${userId},to_user_id.is.null`)
  }
  const { count, error } = await q
  if (error) { return 0 }
  return count || 0
}

// ── PLANNING TASKS (texte libre — planning équipe) ────────────

export const getPlanningTasks = async (userIds, from, to) => {
  const { data, error } = await supabase.from('planning_tasks').select('*')
    .in('user_id', userIds).gte('date', from).lte('date', to)
    .order('created_at', { ascending: true })
  if (error) { log('getPlanningTasks', error); throw error }
  return data || []
}

export const insertPlanningTask = async (task) => {
  if (isTestMode()) return mockRec(task)
  const { data, error } = await supabase.from('planning_tasks').insert(task).select().single()
  if (error) { log('insertPlanningTask', error); throw error }
  return data
}

export const updatePlanningTask = async (id, data) => {
  if (isTestMode()) return mockRec({ id, ...data })
  const { data: rec, error } = await supabase.from('planning_tasks').update(data).eq('id', id).select().single()
  if (error) { log('updatePlanningTask', error); throw error }
  return rec
}

export const deletePlanningTask = async (id) => {
  if (isTestMode()) return
  const { error } = await supabase.from('planning_tasks').delete().eq('id', id)
  if (error) { log('deletePlanningTask', error); throw error }
}

// ── DOSSIERS RH — documents ──────────────────────────────────

export const getDocumentsByUser = async (userId) => {
  const { data, error } = await supabase.from('documents').select('*')
    .eq('user_id', userId).order('created_at', { ascending: false })
  if (error) { log('getDocumentsByUser', error); throw error }
  return data || []
}

export const insertDocument = async (doc) => {
  if (isTestMode()) return mockRec(doc)
  const { data, error } = await supabase.from('documents').insert(doc).select().single()
  if (error) { log('insertDocument', error); throw error }
  return data
}

export const deleteDocument = async (id) => {
  if (isTestMode()) return
  const { error } = await supabase.from('documents').delete().eq('id', id)
  if (error) { log('deleteDocument', error); throw error }
}

// ── DOSSIERS RH — Supabase Storage ───────────────────────────

export const uploadToStorage = async (file, path) => {
  if (isTestMode()) return { path }
  const { data, error } = await supabase.storage.from('dossiers-rh').upload(path, file, { upsert: false })
  if (error) { log('uploadToStorage', error); throw error }
  return data
}

export const getStorageUrl = (path) => {
  const { data } = supabase.storage.from('dossiers-rh').getPublicUrl(path)
  return data.publicUrl
}

export const deleteFromStorage = async (path) => {
  if (isTestMode()) return
  const { error } = await supabase.storage.from('dossiers-rh').remove([path])
  if (error) { log('deleteFromStorage', error); throw error }
}

// ── GESTION EMPLOYÉES ─────────────────────────────────────────

export const insertUserInDb = async ({ id, name, pin, role }) => {
  if (isTestMode()) return
  const { error } = await supabase.from('users').upsert({ id, name, pin, role }, { onConflict: 'id' })
  if (error) { log('insertUserInDb', error); throw error }
}

export const updateUserInDb = async (id, data) => {
  if (isTestMode()) return
  const { error } = await supabase.from('users').update(data).eq('id', id)
  if (error) { log('updateUserInDb', error); throw error }
}

export const deleteUserInDb = async (id) => {
  if (isTestMode()) return
  const { error } = await supabase.from('users').delete().eq('id', id)
  if (error) { log('deleteUserInDb', error); throw error }
}
