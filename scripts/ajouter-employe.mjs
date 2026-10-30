// Ajoute une employée dans la base Supabase (même effet que Annuaire → « Ajouter une employée »).
// Usage : node scripts/ajouter-employe.mjs "Prénom" MOTDEPASSE [assistant|admin]
// Le mot de passe doit être différent de celui de tous les autres comptes (contrainte UNIQUE).
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const [name, pin, role = 'assistant'] = process.argv.slice(2)
if (!name || !pin) {
  console.error('Usage : node scripts/ajouter-employe.mjs "Prénom" MOTDEPASSE [assistant|admin]')
  process.exit(1)
}

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const base = env.VITE_SUPABASE_URL
const headers = { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' }

// 1. Vérifier qu'elle n'existe pas déjà et que le mot de passe est libre
const existing = await (await fetch(`${base}/rest/v1/users?select=name,pin`, { headers })).json()
if (!Array.isArray(existing)) { console.error('Lecture impossible :', existing); process.exit(1) }
if (existing.some(u => u.name.toLowerCase() === name.toLowerCase())) { console.error(`${name} existe déjà.`); process.exit(1) }
if (existing.some(u => u.pin === pin)) { console.error('Ce mot de passe est déjà utilisé par un autre compte : choisissez-en un autre.'); process.exit(1) }

// 2. Créer le compte
const res = await fetch(`${base}/rest/v1/users`, {
  method: 'POST',
  headers: { ...headers, Prefer: 'return=representation' },
  body: JSON.stringify({ id: randomUUID(), name, pin, role }),
})
const out = await res.json()
if (!res.ok) { console.error('Échec :', out); process.exit(1) }
console.log(`Compte créé : ${out[0].name} (${out[0].role}) — id ${out[0].id}`)
