import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval,
  startOfMonth, endOfMonth, differenceInMinutes } from 'date-fns'
import { fr } from 'date-fns/locale'

export const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export const formatDate = (date) =>
  format(typeof date === 'string' ? parseISO(date) : date, 'dd/MM/yyyy', { locale: fr })

export const formatDateTime = (date) => {
  if (!date) return '—'
  return format(typeof date === 'string' ? parseISO(date) : date, 'HH:mm', { locale: fr })
}

export const formatDateLong = (date) =>
  format(typeof date === 'string' ? parseISO(date) : date, 'EEEE dd MMMM yyyy', { locale: fr })

export const formatMonthYear = (date) =>
  format(typeof date === 'string' ? parseISO(date) : date, 'MMMM yyyy', { locale: fr })

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

export const getMonthDays = (year, month) => {
  const start = startOfMonth(new Date(year, month - 1))
  const end = endOfMonth(new Date(year, month - 1))
  return eachDayOfInterval({ start, end })
}

export const calcDuree = (arrivee, depart) => {
  if (!arrivee || !depart) return null
  const a = typeof arrivee === 'string' ? parseISO(arrivee) : arrivee
  const d = typeof depart === 'string' ? parseISO(depart) : depart
  return differenceInMinutes(d, a)
}

export const currentMonthYear = () => {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

export const isoToLocalTime = (isoString) => {
  if (!isoString) return ''
  return format(parseISO(isoString), 'HH:mm')
}
