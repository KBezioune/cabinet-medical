import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Variables Supabase manquantes' })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { error } = await supabase.from('users').select('id').limit(1)

    if (error) throw error

    return res.status(200).json({ ok: true, timestamp: new Date().toISOString() })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
