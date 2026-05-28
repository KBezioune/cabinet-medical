import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, format, startOfYear } from 'date-fns'
import { fr } from 'date-fns/locale'
import { getUsers } from '../../lib/localData'
import { getPointagesByDateRange, getPlanningForUsers, getAllConges } from '../../lib/db'
import Breadcrumb from '../shared/Breadcrumb'
import './Statistiques.css'

const PIE_COLORS = ['#4f8ef7', '#e2e8f0']
const PRESENCE_COLOR = '#4f8ef7'
const WORKED_COLOR   = '#059669'
const PLANNED_COLOR  = '#e2e8f0'

const timeToH = t => {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h + m / 60
}

const workingDaysInMonth = (year, month) => {
  const start = startOfMonth(new Date(year, month - 1))
  const end   = endOfMonth(start)
  return eachDayOfInterval({ start, end }).filter(d => !isWeekend(d)).length
}

const daysBetween = (a, b) => {
  const ms = new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')
  return Math.round(ms / 86400000) + 1
}

export default function Statistiques() {
  const now      = new Date()
  const year     = now.getFullYear()
  const month    = now.getMonth() + 1
  const users    = getUsers().filter(u => u.role !== 'admin')

  const [loading,    setLoading]    = useState(true)
  const [presence,   setPresence]   = useState([])
  const [heures,     setHeures]     = useState([])
  const [congesPie,  setCongesPie]  = useState([])
  const [globalTaux, setGlobalTaux] = useState(0)

  useEffect(() => {
    const load = async () => {
      try {
        const ids        = users.map(u => u.id)
        const monthStart = format(startOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd')
        const monthEnd   = format(endOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd')
        const yearStart  = `${year}-01-01`
        const yearEnd    = `${year}-12-31`

        const [pointages, planning, conges] = await Promise.all([
          getPointagesByDateRange(ids, monthStart, monthEnd),
          getPlanningForUsers(ids),
          getAllConges(),
        ])

        const wdays = workingDaysInMonth(year, month)

        // Taux de présence
        const presenceData = users.map(u => {
          const nb = new Set(pointages.filter(p => p.user_id === u.id).map(p => p.date)).size
          return { name: u.name.split(' ')[0], taux: Math.min(100, Math.round((nb / wdays) * 100)), color: u.color }
        })
        setPresence(presenceData)

        // Heures travaillées vs planifiées
        const heuresData = users.map(u => {
          const worked = pointages
            .filter(p => p.user_id === u.id && p.heure_debut && p.heure_fin)
            .reduce((acc, p) => acc + (timeToH(p.heure_fin) - timeToH(p.heure_debut)), 0)

          const userPlan = planning.filter(p => p.user_id === u.id && p.actif)
          const dailyH   = userPlan.reduce((acc, p) => acc + (timeToH(p.heure_fin) - timeToH(p.heure_debut)), 0)
          const weeks    = wdays / 5
          const planned  = Math.round(dailyH * weeks * 10) / 10

          return {
            name: u.name.split(' ')[0],
            travaillées: Math.round(worked * 10) / 10,
            planifiées: planned,
          }
        })
        setHeures(heuresData)

        // Congés pris cette année
        const approvedConges = conges.filter(c =>
          c.statut === 'approuve' &&
          (c.type === 'vacances' || c.type === 'conge') &&
          c.date_debut >= yearStart && c.date_debut <= yearEnd
        )

        let totalPris = 0
        let totalDroit = 0
        users.forEach(u => {
          const taken = approvedConges
            .filter(c => c.user_id === u.id)
            .reduce((acc, c) => acc + daysBetween(c.date_debut, c.date_fin), 0)
          totalPris  += taken
          totalDroit += (u.droit_vacances ?? 25)
        })
        const restant = Math.max(0, totalDroit - totalPris)
        setCongesPie([
          { name: 'Pris', value: totalPris },
          { name: 'Restants', value: restant },
        ])

        // Taux d'activité global
        const avg = users.reduce((acc, u) => acc + (u.taux_activite ?? 100), 0) / users.length
        setGlobalTaux(Math.round(avg))
      } catch (err) {
        console.error('[Statistiques]', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const monthLabel = format(new Date(year, month - 1), 'MMMM yyyy', { locale: fr })

  if (loading) {
    return (
      <div className="stats-wrap">
        <Breadcrumb items={['Cabinet Médical', 'Statistiques']} />
        <div className="loading-center" style={{ padding: '3rem' }}><div className="spinner" /></div>
      </div>
    )
  }

  const CustomBar = (props) => {
    const { x, y, width, height, fill, index } = props
    const user = users[index]
    return <rect x={x} y={y} width={width} height={height} fill={user?.color || fill} rx={4} />
  }

  return (
    <div className="stats-wrap">
      <Breadcrumb items={['Cabinet Médical', 'Statistiques']} />

      <div className="stats-kpi-row">
        <div className="card stats-kpi">
          <span className="stats-kpi-label">Taux d'activité équipe</span>
          <span className="stats-kpi-value">{globalTaux} %</span>
          <span className="stats-kpi-sub">{users.length} collaborateurs</span>
        </div>
        <div className="card stats-kpi">
          <span className="stats-kpi-label">Présence moyenne</span>
          <span className="stats-kpi-value">
            {presence.length > 0
              ? Math.round(presence.reduce((a, p) => a + p.taux, 0) / presence.length)
              : 0} %
          </span>
          <span className="stats-kpi-sub">{monthLabel}</span>
        </div>
        <div className="card stats-kpi">
          <span className="stats-kpi-label">Congés pris / An</span>
          <span className="stats-kpi-value">
            {congesPie[0]?.value ?? 0} j
          </span>
          <span className="stats-kpi-sub">sur {(congesPie[0]?.value ?? 0) + (congesPie[1]?.value ?? 0)} j de droit</span>
        </div>
      </div>

      <div className="stats-charts-grid">
        {/* Taux de présence */}
        <div className="card stats-chart-card">
          <h3 className="stats-chart-title">Taux de présence — {monthLabel}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={presence} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => [`${v} %`, 'Présence']} />
              <Bar dataKey="taux" radius={[4, 4, 0, 0]} shape={<CustomBar />} name="Taux de présence">
                {presence.map((_, i) => (
                  <Cell key={i} fill={users[i]?.color || PRESENCE_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Heures travaillées vs planifiées */}
        <div className="card stats-chart-card">
          <h3 className="stats-chart-title">Heures travaillées vs planifiées</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={heures} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, n) => [`${v} h`, n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="planifiées" fill={PLANNED_COLOR} radius={[4, 4, 0, 0]} name="Planifiées" />
              <Bar dataKey="travaillées" fill={WORKED_COLOR} radius={[4, 4, 0, 0]} name="Travaillées" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Congés camembert */}
        <div className="card stats-chart-card stats-chart-pie">
          <h3 className="stats-chart-title">Congés équipe — {year}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={congesPie}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
                label={({ name, value }) => value > 0 ? `${name}: ${value}j` : ''}
                labelLine={false}
              >
                {congesPie.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [`${v} jours`, n]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Taux d'activité par employée */}
        <div className="card stats-chart-card">
          <h3 className="stats-chart-title">Taux d'activité par employée</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={users.map(u => ({ name: u.name.split(' ')[0], taux: u.taux_activite ?? 100 }))}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => [`${v} %`, "Taux d'activité"]} />
              <Bar dataKey="taux" radius={[4, 4, 0, 0]} name="Taux d'activité">
                {users.map((u, i) => (
                  <Cell key={i} fill={u.color || PRESENCE_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
