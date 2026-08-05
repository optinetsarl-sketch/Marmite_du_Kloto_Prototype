import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api, fcfa, liste, referenceCommande } from '../api'
import ModalePaiement from '../composants/ModalePaiement'
import Recu from '../composants/Recu'

const STATUTS = {
  ouverte: { libelle: 'Saisie', classe: 'b-neutre', couleur: '#718096', fond: 'rgba(113,128,150,0.1)' },
  en_cuisine: { libelle: 'En cuisine', classe: 'b-neutre', couleur: '#dd6b20', fond: 'rgba(221,107,32,0.1)' },
  prete: { libelle: 'Plat prêt', classe: 'b-ok', couleur: '#38a169', fond: 'rgba(56,161,105,0.12)' },
  payee: { libelle: 'Encaissée', classe: 'b-ok', couleur: '#2b6cb0', fond: 'rgba(43,108,176,0.1)' },
  annulee: { libelle: 'Annulée', classe: 'b-rup', couleur: '#e53e3e', fond: 'rgba(229,62,62,0.1)' },
}

function ModaleEncaissementGroupeEmporter({ cibles, onConfirme, onFerme }) {
  const [mode, setMode] = useState('especes')
  const [envoi, setEnvoi] = useState(false)
  const totalCumule = cibles.reduce((sum, c) => sum + (c.total || 0), 0)

  async function valider(e) {
    e.preventDefault()
    setEnvoi(true)
    try {
      await onConfirme({
        commande_ids: cibles.map((c) => c.id),
        mode,
      })
      onFerme()
    } catch (err) {
      alert(err.message)
      setEnvoi(false)
    }
  }

  return (
    <div className="modal-bg" onClick={onFerme}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-hd">
          <span>🛍️ Encaissement groupé des commandes à emporter</span>
          <button className="btn btn-g btn-mini" onClick={onFerme}>✕</button>
        </div>
        <form onSubmit={valider}>
          <div style={{ padding: '10px 0 14px', fontSize: 14 }}>
            Encaissement simultané de <strong style={{ color: 'var(--orange-dk)' }}>{cibles.length} commande(s) à emporter</strong>.
          </div>

          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--bord)', borderRadius: 8, padding: 8, marginBottom: 14, background: '#fafafa' }}>
            {cibles.map((c) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderBottom: '1px solid #eee', fontSize: 13 }}>
                <div>
                  <strong style={{ color: 'var(--orange-dk)' }}>{referenceCommande(c)}</strong> · {c.client_nom || 'Client à emporter'}
                </div>
                <strong style={{ color: '#000' }}>{fcfa(c.total)}</strong>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--noir)', color: '#fff', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
            <span style={{ fontWeight: 600 }}>TOTAL À ENCAISSER</span>
            <strong style={{ fontSize: 20, color: 'var(--orange)' }}>{fcfa(totalCumule)}</strong>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="lbl" style={{ marginBottom: 6, display: 'block' }}>Mode de règlement</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { code: 'especes', label: '💵 Espèces' },
                { code: 'mobile_money', label: '📱 Mobile Money' },
                { code: 'carte', label: '💳 Carte' },
              ].map((m) => (
                <button
                  key={m.code}
                  type="button"
                  className={`btn ${mode === m.code ? 'btn-o' : 'btn-g'}`}
                  style={{ flex: 1, padding: '8px 12px', fontSize: 13 }}
                  onClick={() => setMode(m.code)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-act">
            <button type="button" className="btn btn-g" onClick={onFerme}>Annuler</button>
            <button className="btn btn-o" disabled={envoi} style={{ fontWeight: 800 }}>
              {envoi ? 'Encaissement en cours…' : `Valider l'encaissement (${fcfa(totalCumule)})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Emporter() {
  const naviguer = useNavigate()
  const [commandes, setCommandes] = useState([])
  const [erreur, setErreur] = useState('')
  const [aEncaisser, setAEncaisser] = useState(null)
  const [groupeAEncaisser, setGroupeAEncaisser] = useState(null)
  const [recu, setRecu] = useState(null)
  const [vue, setVue] = useState('cartes')
  const [filtreStatut, setFiltreStatut] = useState('tous')
  const [recherche, setRecherche] = useState('')
  const [derniereMaj, setDerniereMaj] = useState(new Date())

  function dateAujourd() {
    return new Date().toLocaleDateString('fr-CA')
  }

  const [dateHistorique, setDateHistorique] = useState(dateAujourd())
  const [historique, setHistorique] = useState([])

  async function chargerHistorique(date) {
    try {
      const url = date === dateAujourd()
        ? '/commandes/?historique_emporter=1&aujourdhui=1&page_size=100'
        : `/commandes/?historique_emporter=1&date=${date}&page_size=100`
      setHistorique(await liste(url))
    } catch (e) {
      console.error('Erreur chargement historique emporter', e)
    }
  }

  async function charger() {
    try {
      const ouvertes = await liste('/commandes/?type=emporter&ouvertes=1&page_size=100')
      setCommandes(ouvertes)
      await chargerHistorique(dateHistorique)
      setErreur('')
      setDerniereMaj(new Date())
    } catch (e) {
      setErreur(e.message)
    }
  }

  function naviguerDate(delta) {
    const d = new Date(dateHistorique + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    const nouvelleDate = d.toLocaleDateString('fr-CA')
    if (nouvelleDate <= dateAujourd()) {
      setDateHistorique(nouvelleDate)
    }
  }

  useEffect(() => {
    chargerHistorique(dateHistorique)
  }, [dateHistorique])

  useEffect(() => {
    charger()
    const intervalle = setInterval(() => {
      liste('/commandes/?type=emporter&ouvertes=1&page_size=100').then(setCommandes).catch(() => {})
      if (dateHistorique === dateAujourd()) {
        chargerHistorique(dateHistorique)
      }
    }, 10000)
    return () => clearInterval(intervalle)
  }, [dateHistorique])

  async function encaisser(paiements) {
    try {
      const encaissee = await api.post(`/commandes/${aEncaisser.id}/encaisser/`, { paiements })
      setAEncaisser(null)
      setRecu(encaissee)
      await charger()
    } catch (e) {
      setErreur(e.message)
    }
  }

  async function encaisserGroupe({ commande_ids, mode }) {
    try {
      await api.post('/commandes/encaisser_tout/', {
        type: 'emporter',
        commande_ids,
        mode,
      })
      setGroupeAEncaisser(null)
      await charger()
    } catch (err) {
      setErreur(err.message)
    }
  }

  async function marquerPrete(commande) {
    try {
      await api.post(`/commandes/${commande.id}/changer_statut/`, { statut: 'prete' })
      await charger()
    } catch (e) {
      setErreur(e.message)
    }
  }

  const enAttente = useMemo(() => commandes.filter((c) => c.statut === 'en_cuisine'), [commandes])
  const pretes = useMemo(() => commandes.filter((c) => c.statut === 'prete'), [commandes])
  const totalCumule = useMemo(() => commandes.reduce((s, c) => s + (c.total || 0), 0), [commandes])

  const commandesFiltrees = useMemo(() => {
    return commandes.filter((cmd) => {
      const ref = referenceCommande(cmd).toLowerCase()
      const client = (cmd.client_nom || '').toLowerCase()
      const tel = (cmd.client_telephone || '').toLowerCase()
      const q = recherche.toLowerCase()

      const matchRecherche = !recherche || ref.includes(q) || client.includes(q) || tel.includes(q)
      const matchStatut = filtreStatut === 'tous' || cmd.statut === filtreStatut

      return matchRecherche && matchStatut
    })
  }, [commandes, recherche, filtreStatut])

  return (
    <>
      {/* En-tête de la page */}
      <div className="top">
        <div>
          <h1>Commandes À Emporter</h1>
          <div className="sub">Suivi des commandes à emporter — en temps réel</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: 'var(--mut)',
              background: 'var(--fond-sub, #f8f9fa)',
              padding: '6px 12px',
              borderRadius: 20,
              border: '1px solid var(--bord)',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#38a169',
                display: 'inline-block',
              }}
            />
            <span>
              MAJ à {derniereMaj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          {commandes.length > 0 && (
            <button
              className="btn btn-o"
              style={{ fontWeight: 800, padding: '8px 16px', fontSize: 13 }}
              onClick={() => setGroupeAEncaisser(commandes)}
            >
              ⚡ Tout encaisser ({commandes.length} commandes · {fcfa(totalCumule)})
            </button>
          )}

          <button className="btn btn-o" onClick={() => naviguer('/ventes?type=emporter')}>
            + Nouvelle commande
          </button>
        </div>
      </div>

      {erreur && <div className="erreur" style={{ marginBottom: 16, borderRadius: 10 }}>{erreur}</div>}

      {/* Cartes de Synthèse (KPIs) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div
          className="card"
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, rgba(230,81,0,0.05) 0%, rgba(230,81,0,0.01) 100%)',
            borderLeft: '4px solid var(--orange-dk, #e65100)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--mut)', letterSpacing: 0.5 }}>
            Commandes en cours
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--orange-dk)', marginTop: 4 }}>
            {commandes.length}
          </div>
          <div style={{ fontSize: 12, color: 'var(--mut)', marginTop: 2 }}>
            À emporter au total
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, rgba(221,107,32,0.06) 0%, rgba(221,107,32,0.01) 100%)',
            borderLeft: '4px solid #dd6b20',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--mut)', letterSpacing: 0.5 }}>
            En cuisine
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#dd6b20', marginTop: 4 }}>
            {enAttente.length}
          </div>
          <div style={{ fontSize: 12, color: 'var(--mut)', marginTop: 2 }}>
            En cours de préparation
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, rgba(56,161,105,0.06) 0%, rgba(56,161,105,0.01) 100%)',
            borderLeft: '4px solid #38a169',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--mut)', letterSpacing: 0.5 }}>
            Plats prêts
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#38a169', marginTop: 4 }}>
            {pretes.length}
          </div>
          <div style={{ fontSize: 12, color: 'var(--mut)', marginTop: 2 }}>
            Prêts pour encaissement / remise
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, rgba(43,108,176,0.06) 0%, rgba(43,108,176,0.01) 100%)',
            borderLeft: '4px solid #2b6cb0',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--mut)', letterSpacing: 0.5 }}>
            Total valeur en attente
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#2b6cb0', marginTop: 4 }}>
            {fcfa(totalCumule)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--mut)', marginTop: 2 }}>
            Recettes à encaisser
          </div>
        </div>
      </div>

      {/* Barre de contrôle : Filtres, Recherche, Changement de Vue */}
      <div
        className="card"
        style={{
          marginBottom: 20,
          padding: '12px 16px',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        {/* Onglets filtres statut */}
        <div className="seg">
          <button
            className={`segb ${filtreStatut === 'tous' ? 'on' : ''}`}
            onClick={() => setFiltreStatut('tous')}
          >
            Toutes ({commandes.length})
          </button>
          <button
            className={`segb ${filtreStatut === 'en_cuisine' ? 'on' : ''}`}
            onClick={() => setFiltreStatut('en_cuisine')}
          >
            En cuisine ({enAttente.length})
          </button>
          <button
            className={`segb ${filtreStatut === 'prete' ? 'on' : ''}`}
            onClick={() => setFiltreStatut('prete')}
          >
            Prêts ({pretes.length})
          </button>
        </div>

        {/* Barre de recherche & Commutateur de Vue */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            className="champ"
            style={{ width: 220, padding: '7px 12px', fontSize: 13 }}
            placeholder="Nom, tél, référence..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />

          <div className="seg">
            <button
              className={`segb ${vue === 'cartes' ? 'on' : ''}`}
              onClick={() => setVue('cartes')}
              title="Affichage en grille de cartes"
            >
              Cartes
            </button>
            <button
              className={`segb ${vue === 'tableau' ? 'on' : ''}`}
              onClick={() => setVue('tableau')}
              title="Affichage en tableau compact"
            >
              Tableau
            </button>
          </div>
        </div>
      </div>

      {/* --- VUE EN CARTES (Grille Moderne) --- */}
      {vue === 'cartes' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          {commandesFiltrees.map((cmd) => {
            const st = STATUTS[cmd.statut] || { libelle: cmd.statut, classe: 'b-neutre', couleur: '#555', fond: '#f5f5f5' }
            const estPrete = cmd.statut === 'prete'

            return (
              <div
                key={cmd.id}
                className="card"
                style={{
                  padding: '18px 20px',
                  borderRadius: 14,
                  border: `2px solid ${estPrete ? '#38a169' : 'var(--bord)'}`,
                  background: estPrete ? 'rgba(56,161,105,0.02)' : 'var(--bg-app, #fff)',
                  boxShadow: estPrete ? '0 6px 20px rgba(56,161,105,0.12)' : '0 2px 8px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  justify: 'space-between',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* En-tête de la carte */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <span
                        style={{
                          background: 'rgba(245,124,0,0.12)',
                          color: 'var(--orange-dk)',
                          fontSize: 13,
                          fontWeight: 800,
                          padding: '4px 10px',
                          borderRadius: 8,
                          letterSpacing: 0.5,
                        }}
                      >
                        {referenceCommande(cmd)}
                      </span>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--noir)', marginTop: 8 }}>
                        {cmd.client_nom || 'Client à emporter'}
                      </div>
                      {cmd.client_telephone && (
                        <div style={{ fontSize: 13, color: 'var(--mut)', marginTop: 2 }}>
                          {cmd.client_telephone}
                        </div>
                      )}
                    </div>

                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '5px 12px',
                        borderRadius: 20,
                        background: st.fond,
                        color: st.couleur,
                        border: `1px solid ${st.couleur}44`,
                      }}
                    >
                      {st.libelle}
                    </span>
                  </div>

                  {/* Heure de la commande */}
                  {cmd.cree_le && (
                    <div style={{ fontSize: 11, color: 'var(--mut)', marginBottom: 12 }}>
                      Commandé à {new Date(cmd.cree_le).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}

                  {/* Liste des plats commandés */}
                  <div
                    style={{
                      background: 'var(--fond-sub, #f8f9fa)',
                      borderRadius: 10,
                      padding: '10px 12px',
                      fontSize: 13,
                      marginBottom: 16,
                      border: '1px solid var(--bord)',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--mut)', marginBottom: 6 }}>
                      Plats commandés :
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 16, listStyleType: 'square', color: 'var(--noir)' }}>
                      {(cmd.lignes || []).map((l, idx) => (
                        <li key={idx} style={{ marginBottom: 4 }}>
                          <span style={{ fontWeight: 600 }}>{l.libelle}</span>
                          {l.quantite > 1 && (
                            <span style={{ color: 'var(--orange-dk)', fontWeight: 700, marginLeft: 6 }}>
                              ×{l.quantite}
                            </span>
                          )}
                          {l.prix_unitaire > 0 && (
                            <span style={{ color: 'var(--mut)', fontSize: 12, marginLeft: 6 }}>
                              ({fcfa(l.prix_unitaire)})
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Bas de carte : Montant & Actions */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justify: 'space-between',
                      alignItems: 'center',
                      paddingTop: 12,
                      borderTop: '1px dashed var(--bord)',
                      marginBottom: 14,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mut)' }}>Total à payer</span>
                    <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--orange-dk)' }}>
                      {fcfa(cmd.total)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    {cmd.statut === 'en_cuisine' && (
                      <button
                        className="btn btn-g"
                        style={{ flex: 1, padding: '10px', fontSize: 13, fontWeight: 700 }}
                        onClick={() => marquerPrete(cmd)}
                      >
                        Marquer prêt
                      </button>
                    )}
                    <button
                      className="btn btn-o"
                      style={{ flex: 1, padding: '10px', fontSize: 13, fontWeight: 700 }}
                      onClick={() => setAEncaisser(cmd)}
                    >
                      Encaisser
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* --- VUE EN TABLEAU (Compact) --- */}
      {vue === 'tableau' && (
        <div className="card">
          <table className="grid cartes">
            <thead>
              <tr>
                <th>Réf &amp; Client</th>
                <th>Plats commandés</th>
                <th style={{ textAlign: 'right' }}>Montant</th>
                <th style={{ textAlign: 'center' }}>Statut</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {commandesFiltrees.map((cmd) => {
                const st = STATUTS[cmd.statut] || { libelle: cmd.statut, classe: 'b-neutre' }
                const plats = (cmd.lignes || [])
                  .map((l) => `${l.libelle}${l.quantite > 1 ? ` ×${l.quantite}` : ''}`)
                  .join(' · ')

                return (
                  <tr key={cmd.id}>
                    <td data-titre style={{ fontWeight: 600 }}>
                      <div>
                        <span style={{ color: 'var(--orange-dk)', fontSize: 13, marginRight: 6, fontWeight: 700 }}>
                          {referenceCommande(cmd)}
                        </span>
                        {cmd.client_nom || '—'}
                      </div>
                      {cmd.client_telephone && (
                        <div style={{ fontSize: 12, color: 'var(--mut)', fontWeight: 400 }}>
                          {cmd.client_telephone}
                        </div>
                      )}
                    </td>
                    <td data-label="Plats" style={{ fontSize: 13 }}>
                      {plats || '—'}
                    </td>
                    <td data-label="Montant" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--orange-dk)' }}>
                      {fcfa(cmd.total)}
                    </td>
                    <td data-label="Statut" style={{ textAlign: 'center' }}>
                      <span className={`badge ${st.classe}`}>{st.libelle}</span>
                    </td>
                    <td data-actions style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        {cmd.statut === 'en_cuisine' && (
                          <button className="btn btn-g btn-mini" onClick={() => marquerPrete(cmd)}>
                            Marquer prêt
                          </button>
                        )}
                        <button className="btn btn-o btn-mini" onClick={() => setAEncaisser(cmd)}>
                          Encaisser
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* État vide si aucune commande ne correspond */}
      {commandesFiltrees.length === 0 && (
        <div className="card" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--noir)' }}>
            Aucune commande à emporter en cours
          </div>
          <div style={{ fontSize: 13, color: 'var(--mut)', marginTop: 4, marginBottom: 16 }}>
            {commandes.length === 0
              ? 'Toutes les commandes à emporter ont été encaisées ou servies.'
              : 'Aucune commande ne correspond aux filtres de recherche.'}
          </div>
          <button className="btn btn-o" onClick={() => naviguer('/ventes?type=emporter')}>
            + Saisir une nouvelle commande à emporter
          </button>
        </div>
      )}

      {/* Historique des commandes à emporter par date */}
      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>🛍️ Historique des commandes à emporter</span>
            <span style={{ fontWeight: 400, fontSize: 14, color: 'var(--mut)' }}>
              {dateHistorique === dateAujourd() ? "(Aujourd'hui)" : `du ${new Date(dateHistorique + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
            </span>
            <span className="pill" style={{ fontSize: 12 }}>
              {historique.length} clôturée{historique.length > 1 ? 's' : ''}
            </span>
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              className="btn btn-g"
              style={{ padding: '4px 10px', fontSize: 16, lineHeight: 1 }}
              onClick={() => naviguerDate(-1)}
              title="Jour précédent"
            >
              ‹
            </button>
            <input
              type="date"
              className="champ auto"
              value={dateHistorique}
              max={dateAujourd()}
              onChange={(e) => setDateHistorique(e.target.value)}
              style={{ fontSize: 13, padding: '4px 10px', cursor: 'pointer' }}
              title="Choisir une date pour consulter l'historique à emporter"
            />
            <button
              className="btn btn-g"
              style={{ padding: '4px 10px', fontSize: 16, lineHeight: 1 }}
              onClick={() => naviguerDate(1)}
              disabled={dateHistorique >= dateAujourd()}
              title="Jour suivant"
            >
              ›
            </button>
            {dateHistorique !== dateAujourd() && (
              <button
                className="btn btn-g"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => setDateHistorique(dateAujourd())}
              >
                ↩ Aujourd'hui
              </button>
            )}
          </div>
        </div>

        {historique.length === 0 ? (
          <div className="etat">Aucune commande à emporter clôturée {dateHistorique === dateAujourd() ? "aujourd'hui" : 'à cette date'}.</div>
        ) : (
          <table className="grid cartes">
            <thead>
              <tr>
                <th>Référence &amp; Client</th>
                <th>Heure clôture</th>
                <th>Articles commandés</th>
                <th style={{ textAlign: 'right' }}>Total encaissé</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {historique.map((cmd) => {
                const ref = referenceCommande(cmd)
                const nbPlats = (cmd.lignes || []).reduce((s, l) => s + l.quantite, 0)
                const articles = (cmd.lignes || [])
                  .map((l) => `${l.libelle}${l.quantite > 1 ? ` ×${l.quantite}` : ''}`)
                  .join(' · ')

                return (
                  <tr key={`hist-${cmd.id}`}>
                    <td data-titre style={{ fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: 'var(--orange-dk)', fontSize: 13, fontWeight: 700 }}>
                          {ref}
                        </span>
                        <span>{cmd.client_nom || 'Client à emporter'}</span>
                      </div>
                      {cmd.client_telephone && (
                        <div style={{ fontSize: 12, color: 'var(--mut)', fontWeight: 400 }}>
                          {cmd.client_telephone}
                        </div>
                      )}
                    </td>
                    <td data-label="Heure" style={{ color: 'var(--mut)', fontSize: 13 }}>
                      {cmd.cloturee_le
                        ? new Date(cmd.cloturee_le).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                    <td data-label="Articles" style={{ fontSize: 13 }}>
                      <div>{articles || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--mut)' }}>{nbPlats} article(s)</div>
                    </td>
                    <td data-label="Total" style={{ textAlign: 'right', fontWeight: 800, color: 'var(--noir)' }}>
                      {fcfa(cmd.total)}
                    </td>
                    <td data-actions style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-g btn-mini"
                        onClick={() => setRecu(cmd)}
                        title="Imprimer le reçu de cette vente"
                      >
                        📄 Reçu
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modale d'encaissement individuel */}
      {aEncaisser && (
        <ModalePaiement
          total={aEncaisser.total}
          onEncaisse={encaisser}
          onFerme={() => setAEncaisser(null)}
        />
      )}

      {/* Modale d'encaissement groupé */}
      {groupeAEncaisser && (
        <ModaleEncaissementGroupeEmporter
          cibles={groupeAEncaisser}
          onConfirme={encaisserGroupe}
          onFerme={() => setGroupeAEncaisser(null)}
        />
      )}

      {/* Reçu imprimable / téléchargeable après encaissement */}
      {recu && <Recu commande={recu} onFerme={() => setRecu(null)} />}
    </>
  )
}
