import { useState, useEffect } from 'react'
import { formatDate, formatDateTime, minutesToHHMM, currentMonthYear, pauseLegaleMin, MONTH_OPTIONS } from '../../utils/dateUtils'
import { getUsers } from '../../lib/localData'
import { getPointagesByUserAndMonth, getAllConges } from '../../lib/db'
import { format, eachDayOfInterval, parseISO } from 'date-fns'
import { plannedMinutesFor, isOnApprovedLeave, monthDueMinutes, ferieName, workDaysFor, jourSemaine, DAY_MIN, HORAIRE_MATIN, HORAIRE_APREM } from '../../utils/horaires'
import { fr } from 'date-fns/locale'
import Breadcrumb from '../shared/Breadcrumb'
import { Progression, Situation } from '../shared/SituationHeures'
import './MonthlyExport.css'

const formatEcart = (min) => {
  if (min === 0) return '±0h'
  const sign = min > 0 ? '+' : '−'
  const abs  = Math.abs(min)
  const h    = Math.floor(abs / 60)
  const m    = abs % 60
  return `${sign}${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`
}

export default function MonthlyExport() {
  const { year: cy, month: cm } = currentMonthYear()
  const [year,  setYear]        = useState(cy)
  const [month, setMonth]       = useState(cm)
  const [selectedUser, setSelectedUser] = useState('all')
  const [allRecords,   setAllRecords]   = useState({})
  const [conges,       setConges]       = useState([])
  const [loading,      setLoading]      = useState(true)

  const todayStr       = format(new Date(), 'yyyy-MM-dd')
  const isCurrentMonth = year === cy && month === cm
  const collaborateurs = getUsers().filter(u => u.role !== 'admin')

  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to   = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [results, cg] = await Promise.all([
          Promise.all(collaborateurs.map(u => getPointagesByUserAndMonth(u.id, from, to))),
          getAllConges(),
        ])
        const byUser = {}
        collaborateurs.forEach((u, i) => { byUser[u.id] = results[i] })
        setAllRecords(byUser)
        setConges(cg)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [year, month])

  // Minutes dues pour un utilisateur sur un jour précis (horaires officiels, congé approuvé = 0)
  // Compte désactivé (ex. Talya) : rien n'est dû, seules les heures effectuées comptent
  const isInactive = (userId) => collaborateurs.find(u => u.id === userId)?.actif === false

  const getDayPlanned = (userId, dateStr) =>
    (isInactive(userId) || isOnApprovedLeave(userId, dateStr, conges)) ? 0 : plannedMinutesFor(userId, parseISO(dateStr))

  // Total planifié sur le mois complet (même règle que Soldes / Dashboard RH)
  // Mois en cours : heures dues jusqu'à aujourd'hui ; mois passé : mois complet
  const getMonthPlanned = (userId) => isInactive(userId) ? 0 : monthDueMinutes(userId, year, month, conges, isCurrentMonth ? todayStr : null)

  // Statut du congé pour un utilisateur à une date
  const getCongeStatus = (userId, dateStr) => {
    const c = conges.find(c =>
      c.user_id === userId && c.date_debut <= dateStr && c.date_fin >= dateStr
    )
    if (!c) return null
    if (c.statut === 'approuve')   return 'Congé approuvé'
    if (c.statut === 'en_attente') return 'Congé en attente'
    if (c.statut === 'refuse')     return 'Congé refusé'
    return null
  }

  const getSummary = (userId) => {
    const records    = allRecords[userId] || []
    const jours      = records.filter(r => r.heure_arrivee).length
    const totalMin   = records.reduce((s, r) => s + (r.duree_minutes || 0), 0)
    const plannedMin = getMonthPlanned(userId)
    const joursAttendus = eachDayOfInterval({ start: new Date(year, month - 1, 1), end: new Date(year, month, 0) })
      .filter(d => { const ds = format(d, 'yyyy-MM-dd'); return (!isCurrentMonth || ds <= todayStr) && getDayPlanned(userId, ds) > 0 }).length
    return { jours, totalMin, plannedMin, records, joursAttendus }
  }

  // ── Export CSV comptabilité ───────────────────────────────────
  const exportCSV = () => {
    const targets = selectedUser === 'all'
      ? collaborateurs
      : collaborateurs.filter(u => u.id === selectedUser)

    const headers = [
      'Nom', 'Rôle', 'Date', 'Jour',
      'Heure arrivée', 'Heure départ',
      'Durée (HH:MM)', 'Durée (min)',
      'Heures planifiées', 'Écart', 'Statut congé',
    ]
    const rows = [headers]

    targets.forEach(u => {
      const { records, jours, totalMin, plannedMin } = getSummary(u.id)
      const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))

      sorted.forEach(r => {
        const dayPlan = getDayPlanned(u.id, r.date)
        const ecart   = (r.duree_minutes || 0) - dayPlan
        rows.push([
          u.name,
          u.role === 'manager' ? 'Manager' : u.poste || 'Assistante',
          r.date,
          format(parseISO(r.date), 'EEEE', { locale: fr }),
          r.heure_arrivee ? format(new Date(r.heure_arrivee), 'HH:mm') : '',
          r.heure_depart  ? format(new Date(r.heure_depart),  'HH:mm') : '',
          minutesToHHMM(r.duree_minutes),
          r.duree_minutes ?? '',
          minutesToHHMM(dayPlan) === '—' ? '0h00' : minutesToHHMM(dayPlan),
          formatEcart(ecart),
          getCongeStatus(u.id, r.date) || '',
        ])
      })

      rows.push([
        `${u.name} — TOTAL`, '', '', '', '', '',
        minutesToHHMM(totalMin), totalMin,
        minutesToHHMM(plannedMin),
        formatEcart(totalMin - plannedMin),
        `${jours} jour${jours > 1 ? 's' : ''} travaillé${jours > 1 ? 's' : ''}`,
      ])
      rows.push([]) // séparateur entre personnes
    })

    const monthSlug = format(new Date(year, month - 1), 'MMMM_yyyy', { locale: fr })
    const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `export-compta_${monthSlug}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Export PDF (impression) ───────────────────────────────────
  // Document imprimable : synthèse de l'équipe, puis une page par collaborateur avec
  // le détail de chaque jour (arrivée, pauses, départ, heures dues, remarque) et les signatures.
  const exportPDF = () => {
    const targets    = selectedUser === 'all' ? collaborateurs : collaborateurs.filter(u => u.id === selectedUser)
    const monthLabel = format(new Date(year, month - 1), 'MMMM yyyy', { locale: fr })
    const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    const hhmm = (iso) => iso ? format(new Date(iso), 'HH:mm') : '—'
    const colorEcart = (e) => e > 0 ? '#15803d' : e < 0 ? '#b91c1c' : '#475569'
    const days = eachDayOfInterval({ start: new Date(year, month - 1, 1), end: new Date(year, month, 0) })

    const details = targets.map(u => {
      const { records, jours, totalMin, plannedMin } = getSummary(u.id)
      const byDate = {}
      records.forEach(r => { byDate[r.date] = r })
      const inactive = isInactive(u.id)
      let nbAnomalies = 0

      const rows = days.map(d => {
        const ds = format(d, 'yyyy-MM-dd')
        if (isCurrentMonth && ds > todayStr) return ''            // jours à venir : pas encore dus
        const r       = byDate[ds]
        const ferie   = ferieName(ds)
        const conge   = getCongeStatus(u.id, ds)
        const due     = getDayPlanned(u.id, ds)
        const weekend = !workDaysFor(u.id).includes(jourSemaine(d)) && !ferie
        if (!r && due === 0 && !ferie && !conge) return ''        // jour non travaillé, rien à signaler
        if (!r && weekend) return ''

        const notes = []
        if (ferie)  notes.push(`Férié : ${ferie}`)
        if (conge)  notes.push(conge)
        let warn = false
        if (r?.heure_arrivee && !r.heure_depart && ds < todayStr) { notes.push('Départ non pointé'); warn = true }
        if (r?.heure_arrivee && r.heure_depart) {
          const presence = Math.round((new Date(r.heure_depart) - new Date(r.heure_arrivee)) / 60000)
          const mini = pauseLegaleMin(presence)
          if ((r.pause_minutes || 0) < mini) { notes.push(`Pause ${r.pause_minutes || 0} min (minimum ${mini} min)`); warn = true }
        }
        if (!r && due > 0 && ds < todayStr && !conge) { notes.push('Absent / non pointé'); warn = true }
        if (warn) nbAnomalies++

        const worked = r?.duree_minutes ?? 0
        const ecart  = worked - due
        return `<tr${warn ? ' class="warn"' : ferie || conge ? ' class="off"' : ''}>
          <td>${format(d, 'EEE dd.MM', { locale: fr })}</td>
          <td>${hhmm(r?.heure_arrivee)}</td>
          <td>${r ? (r.pause_minutes ? r.pause_minutes + ' min' : '0') : '—'}</td>
          <td>${hhmm(r?.heure_depart)}</td>
          <td><strong>${r?.duree_minutes != null ? minutesToHHMM(worked) : '—'}</strong></td>
          <td>${due > 0 ? minutesToHHMM(due) : '—'}</td>
          <td style="color:${colorEcart(ecart)}">${(due > 0 || worked > 0) ? formatEcart(ecart) : '—'}</td>
          <td class="note">${esc(notes.join(' · '))}</td>
        </tr>`
      }).join('')

      const ecartTotal = totalMin - plannedMin
      return { u, jours, totalMin, plannedMin, ecartTotal, nbAnomalies, inactive, html: `
        <section class="page">
          <div class="who">
            <div><div class="name">${esc(u.name)}</div>
              <div class="role">${esc(u.role === 'manager' ? 'Manager' : (u.poste || 'Assistante médicale'))}${inactive ? ' · ancien collaborateur' : ''}</div></div>
            <div class="period">${monthLabel}</div>
          </div>
          <table>
            <thead><tr><th>Jour</th><th>Arrivée</th><th>Pauses</th><th>Départ</th><th>Travaillé</th><th>Dû</th><th>Écart</th><th>Remarque</th></tr></thead>
            <tbody>${rows}
              <tr class="total">
                <td colspan="4">TOTAL — ${jours} jour${jours > 1 ? 's' : ''} pointé${jours > 1 ? 's' : ''}</td>
                <td>${minutesToHHMM(totalMin)}</td>
                <td>${inactive ? '—' : minutesToHHMM(plannedMin)}</td>
                <td style="color:${colorEcart(ecartTotal)}">${inactive ? '—' : formatEcart(ecartTotal)}</td>
                <td class="note">${nbAnomalies ? nbAnomalies + ' point(s) à vérifier' : ''}</td>
              </tr>
            </tbody>
          </table>
          <div class="sign">
            <div>Employeur (Dr Bezioune)<span></span></div>
            <div>${esc(u.name)}<span></span></div>
          </div>
        </section>` }
    })

    const synthese = details.map(d => `<tr>
        <td><strong>${esc(d.u.name)}</strong><div class="role">${esc(d.u.poste || 'Assistante médicale')}${d.inactive ? ' · ancien collaborateur' : ''}</div></td>
        <td>${d.jours}</td>
        <td><strong>${minutesToHHMM(d.totalMin)}</strong></td>
        <td>${d.inactive ? '—' : minutesToHHMM(d.plannedMin)}</td>
        <td style="color:${colorEcart(d.ecartTotal)}"><strong>${d.inactive ? '—' : formatEcart(d.ecartTotal)}</strong></td>
        <td class="note">${d.nbAnomalies ? d.nbAnomalies + ' à vérifier' : 'OK'}</td></tr>`).join('')

    const dueLabel = isCurrentMonth ? `Heures dues au ${format(new Date(), 'dd.MM.yyyy')}` : 'Heures dues (mois complet)'
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
      <title>Heures de travail — ${monthLabel}</title>
      <style>
        @page { size: A4; margin: 14mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Inter, 'Segoe UI', Arial, sans-serif; color: #1E3329; font-size: 12px; line-height: 1.4; }
        .cover { padding-bottom: 14px; border-bottom: 3px solid #3A7560; margin-bottom: 16px; }
        .brand { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #3A7560; font-weight: 700; }
        h1 { font-size: 22px; margin-top: 2px; } .cap { text-transform: capitalize; }
        .meta { color: #5b6b63; font-size: 11px; margin-top: 4px; }
        h2 { font-size: 13px; margin: 14px 0 6px; color: #2E5E4D; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; font-size: 9.5px; text-transform: uppercase; letter-spacing: .05em; color: #fff; background: #3A7560; padding: 6px 8px; }
        td { padding: 5px 8px; border-bottom: 1px solid #dfe8e3; vertical-align: top; }
        tr.off td { background: #f2f8f5; color: #5b6b63; }
        tr.warn td { background: #fff4e5; }
        tr.total td { font-weight: 700; background: #E3F0EA; border-top: 2px solid #3A7560; }
        .note { font-size: 10.5px; color: #5b6b63; }
        .role { font-size: 10.5px; color: #5b6b63; font-weight: 400; }
        .legend { margin-top: 12px; padding: 8px 10px; background: #f2f8f5; border-radius: 6px; font-size: 10.5px; color: #40594D; }
        .page { break-before: page; }
        .who { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #3A7560; padding-bottom: 8px; margin-bottom: 10px; }
        .who .name { font-size: 18px; font-weight: 800; }
        .who .period { font-size: 14px; font-weight: 700; color: #3A7560; text-transform: capitalize; }
        .sign { display: flex; gap: 24px; margin-top: 36px; font-size: 11px; color: #40594D; }
        .sign div { flex: 1; } .sign span { display: block; border-bottom: 1px solid #1E3329; height: 34px; }
        tr { break-inside: avoid; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      </style></head><body>
      <div class="cover">
        <div class="brand">Centre Médical Dorigny</div>
        <h1>Heures de travail — <span class="cap">${monthLabel}</span></h1>
        <div class="meta">Établi le ${format(new Date(), 'dd.MM.yyyy à HH:mm')} · Journée type ${minutesToHHMM(DAY_MIN)} (${HORAIRE_MATIN}, pause 30 min, ${HORAIRE_APREM})</div>
      </div>
      <h2>Synthèse de l'équipe</h2>
      <table>
        <thead><tr><th>Collaborateur</th><th>Jours</th><th>Heures travaillées</th><th>${dueLabel}</th><th>Écart</th><th>Contrôle</th></tr></thead>
        <tbody>${synthese}</tbody>
      </table>
      <div class="legend">
        <strong>Comment lire ce document :</strong> heures travaillées = de l'arrivée au départ moins les pauses pointées ·
        heures dues = jours ouvrés × ${minutesToHHMM(DAY_MIN)}, jours fériés vaudois et congés approuvés déduits ·
        écart = travaillé − dû (positif = en avance, négatif = en retard).
        Les lignes orange sont à vérifier : départ non pointé, jour sans pointage ou pause inférieure au minimum légal indicatif.
      </div>
      ${details.map(d => d.html).join('')}
      <script>window.onload = () => { window.print() }<\/script>
    </body></html>`

    const w = window.open('', '_blank', 'width=960,height=720')
    if (!w) { alert("Le navigateur a bloqué la fenêtre d'impression. Autorisez les fenêtres pop-up pour ce site, puis réessayez."); return }
    w.document.write(html)
    w.document.close()
  }

  const monthLabel     = format(new Date(year, month - 1), 'MMMM yyyy', { locale: fr })
  const displayedUsers = selectedUser === 'all' ? collaborateurs : collaborateurs.filter(u => u.id === selectedUser)

  return (
    <div className="me-wrap">
      <Breadcrumb items={['Centre Médical Dorigny', 'Admin', 'Export comptabilité']} />
      {/* Barre de contrôle */}
      <div className="card">
        <div className="export-header">
          <div>
            <h2 className="section-title">Export mensuel — Comptabilité</h2>
            <p className="me-period">{monthLabel}</p>
          </div>
          <div className="export-controls">
            <select value={month} onChange={e => setMonth(Number(e.target.value))}>
              {MONTH_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select value={year} onChange={e => setYear(Number(e.target.value))}>
              {[cy - 1, cy, cy + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
              <option value="all">Tous les collaborateurs</option>
              {collaborateurs.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <button className="btn btn-outline" onClick={exportCSV}>
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
              CSV Comptabilité
            </button>
            <button className="btn btn-primary" onClick={exportPDF} title="Document à imprimer ou à enregistrer en PDF pour la comptabilité">
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              PDF
            </button>
          </div>
        </div>
      </div>

      {loading ? <div className="loading-center"><div className="spinner"/></div> : (
        <>
          {/* Une carte par personne : heures faites / attendues + situation */}
          <div className="summary-cards">
            {displayedUsers.map(u => {
              const { jours, totalMin, plannedMin, joursAttendus } = getSummary(u.id)
              const inactive = isInactive(u.id)
              return (
                <div key={u.id} className="card user-summary-card">
                  <div className="user-summary-header">
                    <div className="user-avatar">{u.name[0]}</div>
                    <div>
                      <div className="user-summary-name">{u.name}</div>
                      <div className="user-summary-role">
                        {inactive ? 'Ancien collaborateur' : u.role === 'manager' ? 'Manager' : u.poste || 'Assistante médicale'}
                      </div>
                    </div>
                  </div>
                  {inactive ? (
                    <div className="sit-figures"><span><strong>{minutesToHHMM(totalMin)}</strong> faites ce mois-ci</span></div>
                  ) : (
                    <>
                      <Progression workedMin={totalMin} plannedMin={plannedMin} joursPointes={jours} joursAttendus={joursAttendus} />
                      <Situation workedMin={totalMin} plannedMin={plannedMin} />
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* Tableaux de détail par collaborateur */}
          {displayedUsers.map(u => {
            const { records, jours, totalMin, plannedMin } = getSummary(u.id)
            const sorted      = [...records].sort((a, b) => a.date.localeCompare(b.date))
            const ecartTotal  = totalMin - plannedMin

            return (
              <div key={u.id} className="card">
                <div className="detail-header">
                  <h3>{u.name} — Détail du mois</h3>
                  <div className="me-detail-badges">
                    <span className="badge badge-blue">{jours} jours</span>
                    <span className="badge badge-green">{minutesToHHMM(totalMin)} travaillées</span>
                    <span className={`me-ecart-badge ${ecartTotal >= 0 ? 'ecart-pos' : 'ecart-neg'}`}>
                      {formatEcart(ecartTotal)}
                    </span>
                  </div>
                </div>

                {records.length === 0 ? (
                  <p className="me-empty">Aucun pointage ce mois-ci</p>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Arrivée</th>
                          <th>Départ</th>
                          <th>Heures faites</th>
                          <th>Attendu</th>
                          <th>Écart</th>
                          <th>Congé</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map(r => {
                          const dayPlan = getDayPlanned(u.id, r.date)
                          const ecart   = (r.duree_minutes || 0) - dayPlan
                          const conge   = getCongeStatus(u.id, r.date)
                          return (
                            <tr key={r.id}>
                              <td className="me-date-cell">
                                <span className="me-date">{formatDate(r.date)}</span>
                                <span className="me-dow">{format(parseISO(r.date), 'EEE', { locale: fr })}</span>
                              </td>
                              <td className="me-time me-arrive">{formatDateTime(r.heure_arrivee)}</td>
                              <td className="me-time me-depart">{r.heure_depart ? formatDateTime(r.heure_depart) : '—'}</td>
                              <td>
                                {r.duree_minutes != null
                                  ? <span className="badge badge-blue">{minutesToHHMM(r.duree_minutes)}</span>
                                  : '—'}
                              </td>
                              <td className="me-planned">{dayPlan > 0 ? minutesToHHMM(dayPlan) : <span className="me-dash">—</span>}</td>
                              <td>
                                {dayPlan > 0
                                  ? <span className={`me-ecart-cell ${ecart >= 0 ? 'ecart-pos' : 'ecart-neg'}`}>{formatEcart(ecart)}</span>
                                  : <span className="me-dash">—</span>}
                              </td>
                              <td>
                                {conge
                                  ? <span className={`me-conge-chip ${conge.includes('approuvé') ? 'me-conge-ok' : conge.includes('attente') ? 'me-conge-wait' : 'me-conge-refuse'}`}>{conge}</span>
                                  : <span className="me-dash">—</span>}
                              </td>
                            </tr>
                          )
                        })}
                        <tr className="total-row">
                          <td colSpan={3}><strong>TOTAL</strong></td>
                          <td><span className="badge badge-green">{minutesToHHMM(totalMin)}</span></td>
                          <td className="me-planned"><strong>{minutesToHHMM(plannedMin)}</strong></td>
                          <td>
                            <span className={`me-ecart-cell ${ecartTotal >= 0 ? 'ecart-pos' : 'ecart-neg'}`}>
                              <strong>{formatEcart(ecartTotal)}</strong>
                            </span>
                          </td>
                          <td><span className="me-total-jours">{jours} jours</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}

        </>
      )}
    </div>
  )
}
