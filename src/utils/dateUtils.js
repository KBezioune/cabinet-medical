import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns'
import { fr } from 'date-fns/locale'

// Liste des 12 mois pour les sélecteurs (Dashboard RH, Soldes, Export, Mon solde)
export const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: format(new Date(2024, i, 1), 'MMMM', { locale: fr }),
}))

export const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export const formatDate = (date) =>
  format(typeof date === 'string' ? parseISO(date) : date, 'dd/MM/yyyy', { locale: fr })

export const formatDateTime = (date) => {
  if (!date) return '—'
  return format(typeof date === 'string' ? parseISO(date) : date, 'HH:mm', { locale: fr })
}

export const formatDateLong = (date) =>
  format(typeof date === 'string' ? parseISO(date) : date, 'EEEE dd MMMM yyyy', { locale: fr })

export const todayISO = () => format(new Date(), 'yyyy-MM-dd')

export const minutesToHHMM = (minutes) => {
  if (minutes == null) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h${m.toString().padStart(2, '0')}`
}

export const getWeekDays = (date = new Date()) => {
  const start = startOfWeek(date, { weekStartsOn: 1 })
  const end = endOfWeek(date, { weekStartsOn: 1 })
  return eachDayOfInterval({ start, end })
}

// Agrège le journal d'événements d'une journée (arrivée / pause_debut / pause_fin / départ,
// nombre illimité de pauses) en un résumé exploitable par l'UI et les calculs de paie.
export const summarizePointageEvents = (events) => {
  const sorted = [...events].sort((a, b) => new Date(a.heure) - new Date(b.heure))

  const heure_arrivee = sorted.find(e => e.type === 'arrivee')?.heure ?? null
  const departEvents  = sorted.filter(e => e.type === 'depart')
  const heure_depart  = departEvents.length ? departEvents[departEvents.length - 1].heure : null

  const pauses = []
  let openPause = null
  sorted.forEach(e => {
    // un 2e pause_debut sans fin ne doit pas écraser la pause déjà ouverte
    if (e.type === 'pause_debut') openPause = openPause ?? e.heure
    else if (e.type === 'pause_fin' && openPause) {
      pauses.push({ debut: openPause, fin: e.heure })
      openPause = null
    }
  })
  // Pause restée ouverte au départ : on la clôture à l'heure du départ
  if (openPause && heure_depart && new Date(heure_depart) > new Date(openPause)) {
    pauses.push({ debut: openPause, fin: heure_depart })
    openPause = null
  }
  // Somme en millisecondes puis arrondi unique (évite de perdre ~1 min par pause)
  const pauseMs = pauses.reduce((s, p) => s + (parseISO(p.fin) - parseISO(p.debut)), 0)
  const pause_minutes = Math.round(pauseMs / 60000)

  const duree_minutes = (heure_arrivee && heure_depart)
    ? Math.round((parseISO(heure_depart) - parseISO(heure_arrivee) - pauseMs) / 60000)
    : null

  return {
    heure_arrivee, heure_depart, duree_minutes,
    pauses, pause_minutes,
    en_pause: !!openPause,
    pause_debut_courante: openPause,
    events: sorted,
  }
}

// Statut courant d'une journée à partir de son résumé — 'absent' | 'present' | 'pause' | 'done'
export const pointageStatus = (summary) => {
  if (!summary?.heure_arrivee) return 'absent'
  if (summary.heure_depart)    return 'done'
  if (summary.en_pause)        return 'pause'
  return 'present'
}

export const currentMonthYear = () => {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}
