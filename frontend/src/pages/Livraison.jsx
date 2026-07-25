import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api, fcfa, liste } from '../api'
import BonLivraison from '../composants/BonLivraison'
import DetailLivreur from '../composants/DetailLivreur'
import ModalePaiement from '../composants/ModalePaiement'
import Recu from '../composants/Recu'

// L'ordre dans lequel une course avance. Le bouton propose toujours l'étape suivante.
const PARCOURS = [
  { code: 'ouverte', libelle: 'Saisie', suivant: 'en_cuisine', action: 'Envoyer en cuisine' },
  { code: 'en_cuisine', libelle: 'En préparation', suivant: 'prete', action: 'Marquer prête' },
  { code: 'prete', libelle: 'Prête', suivant: 'en_route', action: 'Confier au livreur' },
  { code: 'en_route', libelle: 'En route', suivant: 'livree', action: 'Marquer livrée' },
  { code: 'livree', libelle: 'Livrée', suivant: null, action: null },
]

// Le rouge est réservé aux anomalies : une course livrée est une étape normale,
// simplement en attente d'encaissement — d'où le jaune, qui appelle une action.
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
    <form className="card" onSubmit={creer} style={{ marginTop: 10 }}>
      <h3>Nouveau livreur</h3>
      <div className="grille-champs">
        <div>
          <label className="lbl">Nom</label>
          <input className="champ" value={nom} onChange={(e) => setNom(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="lbl">Téléphone</label>
          <input className="champ" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
        </div>
      </div>
      <div className="modal-act" style={{ marginTop: 12 }}>
        <button type="button" className="btn btn-g" onClick={onFerme}>Annuler</button>
        <button className="btn btn-o" disabled={envoi}>{envoi ? 'Création…' : 'Créer'}</button>
      </div>
    </form>
  )
}

export default function Livraison() {
  const naviguer = useNavigate()
  const [courses, setCourses] = useState([])
  const [comptes, setComptes] = useState([])
  const [livreurs, setLivreurs] = useState([])
  const [showFormLivreur, setShowFormLivreur] = useState(false)
  const [erreur, setErreur] = useState('')
  const [bon, setBon] = useState(null)
  const [aEncaisser, setAEncaisser] = useState(null)
  const [recu, setRecu] = useState(null)
  const [detailLivreur, setDetailLivreur] = useState(null)

  async function charger() {
    try {
      const [enCours, tableau, liste_livreurs] = await Promise.all([
        liste('/commandes/?a_livrer=1&page_size=100'),
        api.get('/livreurs/comptes_du_jour/'),
        liste('/livreurs/?actif=true'),
      ])
      setCourses(enCours)
      setComptes(tableau)
      setLivreurs(liste_livreurs)
      setErreur('')
    } catch (echec) {
      setErreur(echec.message)
    }
  }

  async function assignerLivreur(commande, livreurId) {
    try {
      await api.patch(`/commandes/${commande.id}/`, { livreur: livreurId || null })
      await charger()
    } catch (echec) {
      setErreur(echec.message)
    }
  }

  useEffect(() => {
    charger()
  }, [])

  async function avancer(commande, statut) {
    try {
      await api.post(`/commandes/${commande.id}/changer_statut/`, { statut })
      await charger()
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

  return (
    <>
      <div className="top">
        <div>
          <h1>Livraison</h1>
          <div className="sub">
            Commandes WhatsApp saisies à la main · suivi des courses et de l'argent des livreurs
          </div>
        </div>
        <div className="pill">{courses.length} course(s) en cours</div>
      </div>

      {erreur && <div className="erreur">{erreur}</div>}

      <FormulaireWhatsApp
        livreurs={livreurs}
        onErreur={setErreur}
        onCreee={(commande) => naviguer(`/ventes?commande=${commande.id}`)}
      />

      <div className="card">
        <h3>Courses en cours</h3>
        {courses.length === 0 ? (
          <div className="etat">Aucune course en cours.</div>
        ) : (
          <table className="grid cartes">
            <thead>
              <tr>
                <th>Client</th>
                <th>Livreur</th>
                <th style={{ textAlign: 'right' }}>À encaisser</th>
                <th style={{ textAlign: 'center' }}>Statut</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => {
                const etape = PARCOURS.find((e) => e.code === course.statut) ?? PARCOURS[0]
                return (
                  <tr key={course.id}>
                    <td data-titre>
                      <div style={{ fontWeight: 600 }}>{course.client_nom || 'Sans nom'}</div>
                      <div style={{ fontSize: 12, color: 'var(--mut)', fontWeight: 400 }}>
                        {course.client_adresse || 'adresse non renseignée'}
                      </div>
                    </td>
                    <td data-label="Livreur">{course.livreur_nom || '—'}</td>
                    <td data-label="À encaisser" style={{ textAlign: 'right', fontWeight: 600 }}>
                      {fcfa(course.total)}
                    </td>
                    <td data-label="Statut" style={{ textAlign: 'center' }}>
                      <span className={`badge ${CLASSES_STATUT[course.statut]}`}>
                        {etape.libelle}
                      </span>
                    </td>
                    <td data-actions style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                        <button className="btn btn-g btn-mini" onClick={() => setBon(course)}>
                          Bon
                        </button>
                        <select
                          className="champ"
                          value={course.livreur ?? ''}
                          onChange={(e) => assignerLivreur(course, e.target.value ? Number(e.target.value) : null)}
                          style={{ minWidth: 140, padding: '6px 8px' }}
                        >
                          <option value="">— aucun —</option>
                          {livreurs.map((l) => (
                            <option key={l.id} value={l.id}>{l.nom}</option>
                          ))}
                        </select>
                        {etape.suivant ? (
                          <button
                            className="btn btn-o btn-mini"
                            onClick={() => avancer(course, etape.suivant)}
                          >
                            {etape.action}
                          </button>
                        ) : (
                          <button className="btn btn-o btn-mini" onClick={() => setAEncaisser(course)}>
                            Encaisser
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

      <div className="card">
        <h3>Comptes des livreurs (fin de journée)</h3>
        {comptes.length === 0 ? (
          <div className="etat">Aucune course livrée aujourd'hui.</div>
        ) : (
          <table className="grid cartes">
            <thead>
              <tr>
                <th>Livreur</th>
                <th style={{ textAlign: 'center' }}>Courses du jour</th>
                <th style={{ textAlign: 'right' }}>À remettre</th>
                <th style={{ textAlign: 'right' }}>Déjà remis</th>
              </tr>
            </thead>
            <tbody>
              {comptes.map((compte) => (
                <tr key={compte.livreur_id}>
                  <td data-titre style={{ fontWeight: 600 }}>
                    <button className="lien" onClick={() => setDetailLivreur(compte.livreur_id)}>
                      {compte.livreur_nom}
                    </button>
                  </td>
                  <td data-label="Courses du jour" style={{ textAlign: 'center' }}>
                    {compte.courses_du_jour}
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="note">
          Touchez le nom d'un livreur pour voir le détail de ses courses, plat par plat.
          « À remettre » est l'argent qu'il a encore en poche : des courses livrées mais pas
          encore encaissées. L'encaissement les fait basculer en « déjà remis ». Le mobile
          money n'y figure pas, il arrive directement sur le compte.
        </div>
      </div>

      {showFormLivreur ? (
        <FormulaireLivreur
          onFerme={() => { setShowFormLivreur(false); charger() }}
          onErreur={setErreur}
        />
      ) : (
        <div style={{ marginTop: 10 }}>
          <button className="btn btn-o" onClick={() => setShowFormLivreur(true)}>+ Ajouter un livreur</button>
        </div>
      )}

      {bon && <BonLivraison commande={bon} onFerme={() => setBon(null)} />}
      {aEncaisser && (
        <ModalePaiement
          total={aEncaisser.total}
          onEncaisse={encaisser}
          onFerme={() => setAEncaisser(null)}
        />
      )}
      {recu && <Recu commande={recu} onFerme={() => setRecu(null)} />}
      {detailLivreur && (
        <DetailLivreur livreurId={detailLivreur} onFerme={() => setDetailLivreur(null)} />
      )}
    </>
  )
}

function FormulaireWhatsApp({ livreurs, onCreee, onErreur }) {
  const [ouvert, setOuvert] = useState(false)
  const [nom, setNom] = useState('')
  const [telephone, setTelephone] = useState('')
  const [adresse, setAdresse] = useState('')
  const [note, setNote] = useState('')
  const [livreur, setLivreur] = useState('')
  const [envoi, setEnvoi] = useState(false)

  async function creer(evenement) {
    evenement.preventDefault()
    setEnvoi(true)
    try {
      const commande = await api.post('/commandes/', {
        type: 'livraison',
        origine: 'whatsapp',
        client_nom: nom,
        client_telephone: telephone,
        client_adresse: adresse,
        note,
        livreur: Number(livreur) || null,
      })
      onCreee(commande)
    } catch (echec) {
      onErreur(echec.message)
      setEnvoi(false)
    }
  }

  if (!ouvert) {
    return (
      <div className="selbar">
        <span style={{ fontSize: 13, color: 'var(--mut)' }}>
          Une commande reçue par WhatsApp se saisit à la main, comme une commande au comptoir.
        </span>
        <button className="btn btn-o" style={{ marginLeft: 'auto' }} onClick={() => setOuvert(true)}>
          + Commande WhatsApp
        </button>
      </div>
    )
  }

  return (
    <form className="card" onSubmit={creer}>
      <h3>Nouvelle commande WhatsApp</h3>
      <div className="grille-champs">
        <div>
          <label className="lbl">Nom du client</label>
          <input className="champ" value={nom} onChange={(e) => setNom(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="lbl">Téléphone</label>
          <input className="champ" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
        </div>
        <div>
          <label className="lbl">Adresse de livraison</label>
          <input className="champ" value={adresse} onChange={(e) => setAdresse(e.target.value)} required />
        </div>
        <div>
          <label className="lbl">Livreur</label>
          <select className="champ" value={livreur} onChange={(e) => setLivreur(e.target.value)} required>
            <option value="">— choisir —</option>
            {livreurs.map((entree) => (
              <option key={entree.id} value={entree.id}>
                {entree.nom}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label className="lbl">Note pour la cuisine</label>
      <input
        className="champ"
        placeholder="ex. peu pimenté"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="modal-act" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-g" onClick={() => setOuvert(false)}>
          Annuler
        </button>
        <button className="btn btn-o" disabled={envoi}>
          {envoi ? 'Création…' : 'Saisir les plats'}
        </button>
      </div>
      <div className="note">
        La commande est créée, puis on ajoute les plats depuis l'écran de vente.
      </div>
    </form>
  )
}
