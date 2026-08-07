import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api, fcfa, liste, referenceCommande } from '../api'
import BonLivraison from '../composants/BonLivraison'
import DetailLivreur from '../composants/DetailLivreur'
import ModalePaiement from '../composants/ModalePaiement'
import Recu from '../composants/Recu'

const PARCOURS = [
  { code: 'ouverte', libelle: 'Saisie', suivant: 'en_cuisine', action: 'Envoyer en cuisine' },
  { code: 'en_cuisine', libelle: '⏳ En cuisine', suivant: 'prete', action: 'Marquer prête' },
  { code: 'prete', libelle: '✅ Plat prêt', suivant: 'en_route', action: '🛵 En route' },
  { code: 'en_route', libelle: '🛵 En route', suivant: 'livree', action: 'Marquer livrée' },
  { code: 'livree', libelle: '🏠 Livrée', suivant: null, action: null },
]

const CLASSES_STATUT = {
  ouverte: 'b-neutre',
  en_cuisine: 'b-neutre',
  prete: 'b-ok',
  en_route: 'b-neutre',
  livree: 'b-bas',
}

function FormulaireLivreur({ onFerme, onErreur }) {
  const [nom, setNom] = useState('')
  const [telephone, setTelephone] = useState('')
  const [envoi, setEnvoi] = useState(false)

  async function creer(e) {
    e.preventDefault()
    setEnvoi(true)
    try {
      await api.post('/livreurs/', { nom, telephone, actif: true })
      onFerme()
    } catch (echec) {
      onErreur(echec.message)
      setEnvoi(false)
    }
  }

  return (
    <form className="card" onSubmit={creer} style={{ marginBottom: 20 }}>
      <h3>👤 Nouveau livreur</h3>
      <div className="grille-champs" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div>
          <label className="lbl">Nom du livreur</label>
          <input className="champ" value={nom} onChange={(e) => setNom(e.target.value)} required autoFocus placeholder="ex: Kossi Kodjo" />
        </div>
        <div>
          <label className="lbl">Numéro de téléphone</label>
          <input className="champ" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="ex: 90 12 34 56" />
        </div>
      </div>
      <div className="modal-act" style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-g" onClick={onFerme}>Annuler</button>
        <button className="btn btn-o" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer le livreur'}</button>
      </div>
    </form>
  )
}

/* ─── Modal de sélection du livreur ─────────────────────────────── */
function ModaleConfierLivreur({ commande, livreurs, onConfirme, onFerme, onErreur }) {
  const [livreurId, setLivreurId] = useState(livreurs[0]?.id ?? '')
  const [nouveauNom, setNouveauNom] = useState('')
  const [nouveauTel, setNouveauTel] = useState('')
  const [creerNouveau, setCreerNouveau] = useState(livreurs.length === 0)
  const [envoi, setEnvoi] = useState(false)

  async function confirmer(e) {
    e.preventDefault()
    setEnvoi(true)
    try {
      let idFinal = livreurId
      if (creerNouveau) {
        const res = await api.post('/livreurs/', { nom: nouveauNom, telephone: nouveauTel, actif: true })
        idFinal = res.id
      }
      await onConfirme(commande, idFinal)
    } catch (err) {
      onErreur(err.message)
      setEnvoi(false)
    }
  }

  return (
    <div className="modal-bg" onClick={onFerme}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-hd">
          <span>🛵 Confier au livreur</span>
          <button className="btn btn-g btn-mini" onClick={onFerme}>✕</button>
        </div>
        <form onSubmit={confirmer}>
          <div style={{ padding: '12px 0', fontSize: 14, color: 'var(--mut)' }}>
            Commande <strong style={{ color: 'var(--orange-dk)' }}>{commande.client_nom || 'sans nom'}</strong>
            {' — '}{fcfa(commande.total)}
          </div>

          {livreurs.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <label className="lbl" style={{ marginBottom: 8, display: 'block' }}>Choisir un livreur</label>
              <select
                className="champ"
                value={creerNouveau ? '__nouveau__' : livreurId}
                onChange={(e) => {
                  if (e.target.value === '__nouveau__') {
                    setCreerNouveau(true)
                  } else {
                    setCreerNouveau(false)
                    setLivreurId(e.target.value)
                  }
                }}
              >
                {livreurs.map((l) => (
                  <option key={l.id} value={l.id}>{l.nom}{l.telephone ? ` · ${l.telephone}` : ''}</option>
                ))}
                <option value="__nouveau__">➕ Nouveau livreur…</option>
              </select>
            </div>
          )}

          {creerNouveau && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label className="lbl">Nom du livreur *</label>
                <input className="champ" required value={nouveauNom} onChange={(e) => setNouveauNom(e.target.value)} placeholder="ex: Kossi Kodjo" autoFocus />
              </div>
              <div>
                <label className="lbl">Téléphone</label>
                <input className="champ" value={nouveauTel} onChange={(e) => setNouveauTel(e.target.value)} placeholder="ex: 90 12 34 56" />
              </div>
            </div>
          )}

          <div className="modal-act">
            <button type="button" className="btn btn-g" onClick={onFerme}>Annuler</button>
            <button className="btn btn-o" disabled={envoi || (creerNouveau && !nouveauNom.trim())}>
              {envoi ? 'En cours…' : '🛵 Confier la course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─── Modal d'encaissement groupé (par livreur ou global) ───────── */
function ModaleEncaissementGroupe({ cibles, livreurNom, onConfirme, onFerme }) {
  const totalCumule = cibles.reduce((sum, c) => sum + (c.total || 0), 0)

  async function validerPaiement(paiements) {
    await onConfirme({
      livreur_id: cibles[0]?.livreur_id,
      commande_ids: cibles.map((c) => c.id),
      paiements,
      mode: paiements[0]?.mode || 'especes',
    })
    onFerme()
  }

  return (
    <ModalePaiement
      total={totalCumule}
      titre={`⚡ Encaissement ${livreurNom ? `pour ${livreurNom}` : 'groupé'} (${cibles.length} courses)`}
      onEncaisse={validerPaiement}
      onFerme={onFerme}
    />
  )
}

export default function Livraison() {
  const naviguer = useNavigate()
  const [courses, setCourses] = useState([])
  const [comptes, setComptes] = useState([])
  const [showFormLivreur, setShowFormLivreur] = useState(false)
  const [erreur, setErreur] = useState('')
  const [bon, setBon] = useState(null)
  const [aEncaisser, setAEncaisser] = useState(null)
  const [groupeAEncaisser, setGroupeAEncaisser] = useState(null)
  const [recu, setRecu] = useState(null)
  const [detailLivreur, setDetailLivreur] = useState(null)
  const [filtreLivreurEncaissement, setFiltreLivreurEncaissement] = useState('__tous__')

  function dateAujourd() {
    return new Date().toLocaleDateString('fr-CA')
  }

  const [dateComptes, setDateComptes] = useState(dateAujourd())

  async function chargerComptes(dateC) {
    try {
      const tableau = await api.get(`/livreurs/comptes_du_jour/?date=${dateC}`)
      setComptes(tableau)
    } catch (echec) {
      console.error('Erreur chargement comptes livreurs', echec)
    }
  }

  async function charger() {
    try {
      const [enCours] = await Promise.all([
        liste('/commandes/?a_livrer=1&page_size=100'),
      ])
      setCourses(enCours)
      await chargerComptes(dateComptes)
      setErreur('')
    } catch (echec) {
      setErreur(echec.message)
    }
  }

  function naviguerDateComptes(delta) {
    const d = new Date(dateComptes + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    const nouvelleDate = d.toLocaleDateString('fr-CA')
    if (nouvelleDate <= dateAujourd()) {
      setDateComptes(nouvelleDate)
    }
  }

  useEffect(() => {
    chargerComptes(dateComptes)
  }, [dateComptes])

  useEffect(() => {
    charger()
    const intervalle = setInterval(() => {
      liste('/commandes/?a_livrer=1&page_size=100').then(setCourses).catch(() => {})
      if (dateComptes === dateAujourd()) {
        chargerComptes(dateComptes)
      }
    }, 10000)
    return () => clearInterval(intervalle)
  }, [dateComptes])

  async function avancer(commande, statut) {
    try {
      const res = await api.post(`/commandes/${commande.id}/changer_statut/`, { statut })
      await charger()
      if (statut === 'en_route') {
        setBon(res)
      }
    } catch (echec) {
      setErreur(echec.message)
    }
  }

  async function encaisser(paiements) {
    const encaissee = await api.post(`/commandes/${aEncaisser.id}/encaisser/`, { paiements })
    setAEncaisser(null)
    setRecu(encaissee)
    await charger()
  }

  async function encaisserGroupe({ livreur_id, commande_ids, mode }) {
    try {
      await api.post('/commandes/encaisser_tout/', {
        livreur_id,
        commande_ids,
        mode,
      })
      setGroupeAEncaisser(null)
      await charger()
    } catch (err) {
      setErreur(err.message)
    }
  }

  const enRoute = courses.filter((c) => c.statut === 'en_route').length
  const pretes = courses.filter((c) => c.statut === 'prete').length
  const totalToutesCourses = courses.reduce((s, c) => s + (c.total || 0), 0)

  // Regroupement des courses par livreur
  const parLivreur = {}
  courses.forEach((c) => {
    const key = c.livreur_id || '__sans__'
    const nom = c.livreur_nom || '⚠ Non attribué'
    if (!parLivreur[key]) parLivreur[key] = { key, nom, courses: [], total: 0 }
    parLivreur[key].courses.push(c)
    parLivreur[key].total += c.total || 0
  })
  const listeGroupesLivreurs = Object.values(parLivreur)

  return (
    <>
      <div className="top">
        <div>
          <h1>Livraison</h1>
          <div className="sub">Suivi des courses en direct &amp; comptes des livreurs</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-o" onClick={() => naviguer('/ventes?type=livraison')}>
            ➕ Nouvelle livraison
          </button>
          <button className="btn btn-g" onClick={() => setShowFormLivreur(!showFormLivreur)}>
            👤 {showFormLivreur ? 'Masquer formulaire' : 'Ajouter un livreur'}
          </button>
        </div>
      </div>

      {erreur && <div className="erreur">{erreur}</div>}

      {showFormLivreur && (
        <FormulaireLivreur
          onFerme={() => {
            setShowFormLivreur(false)
            charger()
          }}
          onErreur={setErreur}
        />
      )}

      {/* Résumé des statistiques */}
      {courses.length > 0 && (
        <div className="stats stats-3" style={{ marginBottom: 16 }}>
          <div className="stat wht">
            <div className="l">Courses en préparation / prêtes</div>
            <div className="v">{pretes}</div>
          </div>
          <div className="stat wht">
            <div className="l">En cours de livraison</div>
            <div className="v" style={{ color: 'var(--orange-dk)' }}>{enRoute}</div>
          </div>
          <div className="stat dark">
            <div className="l">Total des courses en cours</div>
            <div className="v">
              {fcfa(totalToutesCourses)}
            </div>
          </div>
        </div>
      )}

      {/* Courses en cours */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Courses en cours ({courses.length})</h3>
          {courses.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {listeGroupesLivreurs.length > 1 && (
                <select
                  className="champ auto"
                  style={{ fontSize: 13, padding: '5px 10px' }}
                  value={filtreLivreurEncaissement}
                  onChange={(e) => setFiltreLivreurEncaissement(e.target.value)}
                >
                  <option value="__tous__">Tous les livreurs ({courses.length} courses · {fcfa(totalToutesCourses)})</option>
                  {listeGroupesLivreurs.map((g) => (
                    <option key={g.key} value={g.key}>
                      🛵 {g.nom} ({g.courses.length} courses · {fcfa(g.total)})
                    </option>
                  ))}
                </select>
              )}

              <button
                className="btn btn-o"
                style={{ fontWeight: 800, padding: '7px 14px', fontSize: 13 }}
                onClick={() => {
                  const cibles = filtreLivreurEncaissement === '__tous__'
                    ? courses
                    : (parLivreur[filtreLivreurEncaissement]?.courses || [])
                  const nom = filtreLivreurEncaissement === '__tous__'
                    ? null
                    : parLivreur[filtreLivreurEncaissement]?.nom
                  setGroupeAEncaisser({ cibles, livreurNom: nom })
                }}
              >
                ⚡ Tout encaisser {filtreLivreurEncaissement !== '__tous__' ? `(${fcfa(parLivreur[filtreLivreurEncaissement]?.total || 0)})` : `(${fcfa(totalToutesCourses)})`}
              </button>
            </div>
          )}
        </div>

        {courses.length === 0 ? (
          <div className="etat">Aucune course de livraison en cours actuellement.</div>
        ) : (
          <table className="grid cartes">
            <thead>
              <tr>
                <th>Réf, Client &amp; Destination</th>
                <th>Plats</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'center' }}>Statut</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => {
                const etape = PARCOURS.find((e) => e.code === course.statut) ?? PARCOURS[0]
                const plats = (course.lignes || [])
                  .map((l) => `${l.libelle}${l.quantite > 1 ? ` ×${l.quantite}` : ''}`)
                  .join(' · ')
                return (
                  <tr key={course.id}>
                    <td data-titre style={{ fontWeight: 600 }}>
                      <div>
                        <span style={{ color: 'var(--orange-dk)', fontSize: 13, marginRight: 6, fontWeight: 700 }}>
                          {referenceCommande(course)}
                        </span>
                        {course.client_nom || 'Client anonyme'}
                      </div>
                      {course.client_telephone && (
                        <div style={{ fontSize: 12, color: 'var(--mut)', fontWeight: 400 }}>
                          {course.client_telephone}
                        </div>
                      )}
                      {course.livreur_nom && (
                        <div style={{ fontSize: 12, color: 'var(--orange-dk)', fontWeight: 500 }}>
                          🛵 {course.livreur_nom}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: 'var(--mut)', fontWeight: 400 }}>
                        {course.client_adresse || 'Adresse non spécifiée'}
                      </div>
                    </td>
                    <td data-label="Plats" style={{ fontSize: 13 }}>
                      {plats || '—'}
                    </td>
                    <td data-label="Total" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--orange-dk)' }}>
                      {fcfa(course.total)}
                    </td>
                    <td data-label="Statut" style={{ textAlign: 'center' }}>
                      <span className={`badge ${CLASSES_STATUT[course.statut]}`}>
                        {etape.libelle}
                      </span>
                    </td>
                    <td data-actions style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <button className="btn btn-g btn-mini" onClick={() => setBon(course)} title="Imprimer le bon de livraison">
                          📄 Bon
                        </button>
                        {etape.suivant ? (
                          <button
                            className="btn btn-o btn-mini"
                            onClick={() => avancer(course, etape.suivant)}
                          >
                            {etape.suivant === 'en_route' && course.livreur_nom
                              ? `🛵 ${course.livreur_nom}`
                              : etape.action}
                          </button>
                        ) : (
                          <button className="btn btn-o btn-mini" onClick={() => setAEncaisser(course)}>
                            💰 Encaisser
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Comptes des livreurs */}
      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>
            Comptes des livreurs
            <span style={{ fontWeight: 400, fontSize: 14, color: 'var(--mut)', marginLeft: 8 }}>
              {dateComptes === dateAujourd() ? "(Aujourd'hui)" : `du ${new Date(dateComptes + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
            </span>
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              className="btn btn-g"
              style={{ padding: '4px 10px', fontSize: 16, lineHeight: 1 }}
              onClick={() => naviguerDateComptes(-1)}
              title="Jour précédent"
            >
              ‹
            </button>
            <input
              type="date"
              className="champ auto"
              value={dateComptes}
              max={dateAujourd()}
              onChange={(e) => setDateComptes(e.target.value)}
              style={{ fontSize: 13, padding: '4px 10px', cursor: 'pointer' }}
              title="Choisir une date pour consulter les comptes livreurs"
            />
            <button
              className="btn btn-g"
              style={{ padding: '4px 10px', fontSize: 16, lineHeight: 1 }}
              onClick={() => naviguerDateComptes(1)}
              disabled={dateComptes >= dateAujourd()}
              title="Jour suivant"
            >
              ›
            </button>
            {dateComptes !== dateAujourd() && (
              <button
                className="btn btn-g"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => setDateComptes(dateAujourd())}
              >
                ↩ Aujourd'hui
              </button>
            )}
          </div>
        </div>

        {comptes.length === 0 ? (
          <div className="etat">Aucune course livrée {dateComptes === dateAujourd() ? "aujourd'hui" : 'à cette date'}.</div>
        ) : (
          <table className="grid cartes">
            <thead>
              <tr>
                <th>Livreur</th>
                <th style={{ textAlign: 'center' }}>Courses effectuées</th>
                <th style={{ textAlign: 'right' }}>À remettre (Espèces)</th>
                <th style={{ textAlign: 'right' }}>Déjà remis (Encaissement)</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {comptes.map((compte) => {
                const targetKey = compte.livreur_id || '__sans__'
                const coursesLivreur = courses.filter((c) => (c.livreur_id || '__sans__') === targetKey)
                return (
                  <tr key={compte.livreur_id ?? '__sans__'}>
                    <td data-titre style={{ fontWeight: 600 }}>
                      {compte.livreur_nom}
                    </td>
                    <td data-label="Courses" style={{ textAlign: 'center', fontWeight: 600 }}>
                      {compte.courses_du_jour} course(s)
                    </td>
                    <td
                      data-label="À remettre"
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: compte.a_remettre > 0 ? 'var(--orange-dk)' : 'var(--mut)',
                      }}
                    >
                      {fcfa(compte.a_remettre)}
                    </td>
                    <td data-label="Déjà remis" style={{ textAlign: 'right', color: 'var(--mut)' }}>
                      {fcfa(compte.deja_remis)}
                    </td>
                    <td data-actions style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        {compte.a_remettre > 0 && (
                          <button
                            className="btn btn-o btn-mini"
                            style={{ fontWeight: 800 }}
                            onClick={() => {
                              if (coursesLivreur.length > 0) {
                                setGroupeAEncaisser({ cibles: coursesLivreur, livreurNom: compte.livreur_nom })
                              } else {
                                encaisserGroupe({ livreur_id: compte.livreur_id, mode: 'especes' })
                              }
                            }}
                            title={`Tout encaisser pour ${compte.livreur_nom}`}
                          >
                            ⚡ Encaisser tout ({fcfa(compte.a_remettre)})
                          </button>
                        )}
                        <button
                          className="btn btn-g btn-mini"
                          onClick={() => setDetailLivreur(compte.livreur_id || '__sans__')}
                        >
                          Voir le détail
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <div className="note" style={{ marginTop: 12 }}>
          💡 <strong>« À remettre »</strong> représente les espèces encaissées par le livreur sur le terrain et non encore versées en caisse. Cliquez sur <strong>« ⚡ Encaisser tout »</strong> pour valider la totalité du versement du livreur d'un seul clic.
        </div>
      </div>

      {bon && <BonLivraison commande={bon} onFerme={() => setBon(null)} />}
      {aEncaisser && (
        <ModalePaiement
          total={aEncaisser.total}
          onEncaisse={encaisser}
          onFerme={() => setAEncaisser(null)}
        />
      )}
      {groupeAEncaisser && (
        <ModaleEncaissementGroupe
          cibles={groupeAEncaisser.cibles}
          livreurNom={groupeAEncaisser.livreurNom}
          onConfirme={encaisserGroupe}
          onFerme={() => setGroupeAEncaisser(null)}
        />
      )}
      {recu && <Recu commande={recu} onFerme={() => setRecu(null)} />}
      {detailLivreur && (
        <DetailLivreur livreurId={detailLivreur} date={dateComptes} onFerme={() => setDetailLivreur(null)} />
      )}
    </>
  )
}
