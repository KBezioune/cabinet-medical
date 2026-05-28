import { supabase } from './supabase'

const KEEP_ALIVE_KEY = 'supabase_last_ping'
const INTERVAL_MS = 4 * 24 * 60 * 60 * 1000 // 4 jours

export async function pingSupabase() {
  try {
    const { error } = await supabase.from('users').select('id').limit(1)
    if (error) throw error
    localStorage.setItem(KEEP_ALIVE_KEY, Date.now().toString())
  } catch (err) {
    console.warn('[keep-alive] ping échoué :', err.message)
  }
}

export function startKeepAlive() {
  const last = parseInt(localStorage.getItem(KEEP_ALIVE_KEY) || '0', 10)
  if (Date.now() - last > INTERVAL_MS) {
    pingSupabase()
  }
  setInterval(pingSupabase, INTERVAL_MS)
}
