import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api, fcfa, liste } from '../api'
import { useAuth } from '../auth-contexte'
import Modale from '../composants/Modale'

const LIBELLES_ETAT = { ok: 'En stock', bas: 'Bas', rupture: 'Rupture' }
const CLASSES_ETAT = { ok: 'b-ok', bas: 'b-bas', rupture: 'b-rup' }

const MOTIFS_SORTIE = [
  ['casse', 'Casse'],
  ['perte', 'Perte'],
  ['offert', 'Offert'],
]

export default function Bar() {
  const navigate = useNavigate()
  const { utilisateur } = useAuth()
  const estAdmin = Boolean(utilisateur?.is_admin || utilisateur?.role === 'admin')

  const [produits, setProduits] = useState([])
  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState('tous')
  const [categories, setCategories] = useState([])
  const [erreur, setErreur] = useState('')
  const [operation, setOperation] = useState(null)

  const [brouillonSession, setBrouillonSession] = useState(null)

  async function charger() {
    try {
      const [listeProduits, listeCategories, repBrouillon] = await Promise.all([
        liste('/produits/?categorie__rayon=bar&page_size=400'),
        liste('/categories/'),
        api.get('/sessions-inventaire/brouillon_en_cours/').catch(() => ({ brouillon: null })),
      ])
      setProduits(listeProduits)
      setCategories(listeCategories)
      setBrouillonSession(repBrouillon?.brouillon || null)
      setErreur('')
    } catch (echec) {
      setErreur(echec.message)
    }
  }

  useEffect(() => {
    charger()
  }, [])

  const filtres = useMemo(() => {
    const terme = recherche.trim().toLowerCase()
    return produits
      .filter((produit) => (terme ? produit.nom.toLowerCase().includes(terme) : true))
      .filter((produit) => (filtre === 'tous' ? true : produit.etat_stock === filtre))
  }, [produits, recherche, filtre])

  const alertes = produits.filter((produit) => produit.etat_stock !== 'ok').length

  return (
    <>
      <div className="top">
        <div>
          <h1>Bar — Stock</h1>
          <div className="sub">
            Le stock se recalcule à partir des mouvements : réceptions, ventes, casse, inventaire.
          </div>
        </div>
        {estAdmin && (
          <div className="actions-top">
            <button
              className="btn btn-g"
              onClick={() => navigate('/inventaires')}
            >
              Registre PV Inventaires
            </button>
            <button
              className="btn btn-g"
              onClick={() => navigate('/mouvements')}
            >
              Mouvements
            </button>
            <button className="btn btn-g" onClick={() => setOperation('sortie')}>
              Casse / perte
            </button>
            <button className="btn btn-g" onClick={() => setOperation('inventaire')}>
              Inventaire
            </button>
            <button className="btn btn-o" onClick={() => setOperation('reception')}>
              + Charger du stock
            </button>
          </div>
        )}
      </div>

      {erreur && <div className="erreur">{erreur}</div>}

      {brouillonSession && (
        <div
          style={{
            background: '#fff3cd',
            border: '1px solid #ffeeba',
            color: '#856404',
            padding: '12px 18px',
            borderRadius: 12,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div>
            <strong>Un inventaire est en cours de saisie ({brouillonSession.motif})</strong> —{' '}
            <span style={{ fontSize: 13 }}>
              Démarré le {new Date(brouillonSession.date).toLocaleDateString('fr-FR')}. Le stock n'a pas encore été modifié.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-o"
              style={{ fontSize: 13, padding: '6px 14px' }}
              onClick={() => setOperation('inventaire')}
            >
              Reprendre la saisie
            </button>
          </div>
        </div>
      )}

      <div className="selbar">
        {/* Pas de flex-basis en style en ligne : la barre passe en colonne sur
            téléphone, où « 180px » deviendrait une hauteur. */}
        <input
          className="champ champ-extensible"
          placeholder="Rechercher une boisson…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        <div className="seg">
          {[
            ['tous', 'Toutes'],
            ['bas', 'Stock bas'],
            ['rupture', 'Rupture'],
          ].map(([code, libelle]) => (
            <button
              key={code}
              className={`segb ${filtre === code ? 'on' : ''}`}
              onClick={() => setFiltre(code)}
            >
              {libelle}
            </button>
          ))}
        </div>
        <span className="pill alerte">{alertes} à surveiller</span>
      </div>

      <div className="card carte-tableau">
        <div className="tableau-defilant">
          <table className="grid cartes compacte">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Catégorie</th>
                <th style={{ textAlign: 'right' }}>Prix</th>
                <th style={{ textAlign: 'right' }}>Stock</th>
                <th style={{ textAlign: 'right' }}>Seuil</th>
                <th style={{ textAlign: 'right' }}>État</th>
              </tr>
            </thead>
            <tbody>
              {filtres.map((produit) => (
                <tr key={produit.id}>
                  <td data-titre style={{ fontWeight: 600 }}>{produit.nom}</td>
                  <td data-label="Catégorie">
                    {estAdmin ? (
                      <select
                        className="champ auto"
                        style={{ padding: '3px 8px', fontSize: 13, minWidth: 120 }}
                        value={produit.categorie || ''}
                        onChange={async (e) => {
                          const nouvelleCatId = e.target.value
                          try {
                            await api.patch(`/produits/${produit.id}/`, { categorie: nouvelleCatId })
                            await charger()
                          } catch (err) {
                            setErreur(err.message)
                          }
                        }}
                      >
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.nom}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span>{categories.find((cat) => String(cat.id) === String(produit.categorie))?.nom || '—'}</span>
                    )}
                  </td>
                  <td data-label="Prix" style={{ textAlign: 'right' }}>{fcfa(produit.prix_standard)}</td>
                  <td data-label="Stock" style={{ textAlign: 'right', fontWeight: 700 }}>{produit.stock}</td>
                  <td data-label="Seuil" data-secondaire style={{ textAlign: 'right', color: 'var(--mut)' }}>
                    {produit.seuil_alerte}
                  </td>
                  <td data-label="État" style={{ textAlign: 'right' }}>
                    <span className={`badge ${CLASSES_ETAT[produit.etat_stock]}`}>
                      {LIBELLES_ETAT[produit.etat_stock]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtres.length === 0 && <div className="etat">Aucune boisson ne correspond.</div>}
      </div>

      {operation && (
        <OperationStock
          type={operation}
          produits={produits}
          brouillonSession={brouillonSession}
          onFerme={() => setOperation(null)}
          onEnregistre={async () => {
            setOperation(null)
            await charger()
          }}
        />
      )}
    </>
  )
}

const TITRES = {
  reception: 'Réception de stock',
  sortie: 'Sortie de stock',
  inventaire: "Correction d'inventaire",
}

function OperationStock({ type, produits, brouillonSession, onFerme, onEnregistre }) {
  const [produit, setProduit] = useState('')
  const [quantite, setQuantite] = useState('')
  const [prix, setPrix] = useState('')
  const [fournisseur, setFournisseur] = useState('')
  const [motif, setMotif] = useState('casse')
  const [commentaire, setCommentaire] = useState('')
  const [majPrix, setMajPrix] = useState(false)
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)

  if (type === 'inventaire') {
    return <InventaireOfficielWorkflow brouillonSession={brouillonSession} onFerme={onFerme} onEnregistre={onEnregistre} />
  }

  const choisi = produits.find((entree) => String(entree.id) === String(produit))

  function choisirProduit(id) {
    setProduit(id)
    const p = produits.find((entree) => String(entree.id) === String(id))
    if (p && p.prix_standard !== null && p.prix_standard !== undefined) {
      setPrix(String(p.prix_standard))
    } else {
      setPrix('')
    }
  }

  async function enregistrer(evenement) {
    evenement.preventDefault()
    setErreur('')
    setEnvoi(true)
    try {
      const pid = !isNaN(Number(produit)) && String(Number(produit)) === String(produit) ? Number(produit) : produit
      if (type === 'reception') {
        await api.post('/mouvements-stock/reception/', {
          produit: pid,
          quantite: Number(quantite),
          prix_unitaire: prix !== '' && prix !== null ? Number(prix) : null,
          fournisseur: fournisseur ? fournisseur.trim() : '',
          maj_prix_vente: Boolean(majPrix),
        })
      } else if (type === 'sortie') {
        await api.post('/mouvements-stock/sortie/', {
          produit: pid,
          quantite: Number(quantite),
          motif,
          commentaire: commentaire ? commentaire.trim() : '',
        })
      }
      await onEnregistre()
    } catch (echec) {
      setErreur(echec.message)
      setEnvoi(false)
    }
  }

  const ecart = choisi && quantite !== '' ? Number(quantite) - choisi.stock : null

  return (
    <Modale titre={TITRES[type]} largeur={420} onFerme={onFerme}>
      {erreur && <div className="erreur">{erreur}</div>}
      <form onSubmit={enregistrer}>
        <label className="lbl">Produit</label>
        <select
          className="champ"
          value={produit}
          onChange={(e) => choisirProduit(e.target.value)}
          required
          autoFocus
        >
          <option value="">— choisir —</option>
          {produits.map((entree) => (
            <option key={entree.id} value={entree.id}>
              {entree.nom} (stock {entree.stock})
            </option>
          ))}
        </select>

        {type === 'inventaire' ? (
          <>
            <label className="lbl">Stock réellement compté</label>
            <input
              className="champ"
              type="number"
              min="0"
              value={quantite}
              onChange={(e) => setQuantite(e.target.value)}
              required
            />
            {choisi && quantite !== '' && (
              <div className="tot" style={{ fontSize: 14 }}>
                <span>Écart avec le théorique ({choisi.stock})</span>
                <span style={{ color: ecart === 0 ? 'var(--vert)' : 'var(--orange-dk)' }}>
                  {ecart > 0 ? '+' : ''}
                  {ecart}
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            <label className="lbl">Quantité</label>
            <input
              className="champ"
              type="number"
              min="1"
              value={quantite}
              onChange={(e) => setQuantite(e.target.value)}
              required
            />
          </>
        )}

        {type === 'reception' && (
          <>
            <label className="lbl">Prix d'achat unitaire (facultatif)</label>
            <input
              className="champ"
              type="number"
              min="0"
              value={prix}
              onChange={(e) => setPrix(e.target.value)}
            />
            <label className="case">
              <input
                type="checkbox"
                checked={majPrix}
                onChange={(e) => setMajPrix(e.target.checked)}
              />
              <span>Utiliser aussi ce montant comme nouveau prix de vente</span>
            </label>
            <label className="lbl">Fournisseur (facultatif)</label>
            <input
              className="champ"
              value={fournisseur}
              onChange={(e) => setFournisseur(e.target.value)}
            />
          </>
        )}

        {type === 'sortie' && (
          <>
            <label className="lbl">Motif</label>
            <select className="champ" value={motif} onChange={(e) => setMotif(e.target.value)}>
              {MOTIFS_SORTIE.map(([code, libelle]) => (
                <option key={code} value={code}>
                  {libelle}
                </option>
              ))}
            </select>
          </>
        )}

        {type !== 'reception' && (
          <>
            <label className="lbl">Commentaire</label>
            <input
              className="champ"
              placeholder={type === 'inventaire' ? 'ex. comptage du soir' : 'ex. casier renversé'}
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
            />
          </>
        )}

        <div className="modal-act" style={{ marginTop: 18 }}>
          <button type="button" className="btn btn-g" onClick={onFerme}>
            Annuler
          </button>
          <button className="btn btn-o" disabled={envoi}>
            {envoi ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modale>
  )
}

function InventaireOfficielWorkflow({ brouillonSession, onFerme, onEnregistre }) {
  const dateAujourdhui = new Date().toISOString().substring(0, 10)
  const [date, setDate] = useState(dateAujourdhui)
  const [motif, setMotif] = useState(`Inventaire semaine du ${new Date().toLocaleDateString('fr-FR')}`)

  const [sessionActive, setSessionActive] = useState(null)
  const [saisies, setSaisies] = useState({}) // { [ligneId]: stringValue }
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState('')
  const [recherche, setRecherche] = useState('')
  const [filtreCategorie, setFiltreCategorie] = useState('')
  const [confirmValidation, setConfirmValidation] = useState(false)
  const [envoi, setEnvoi] = useState(false)

  // Charger la session en brouillon si elle existe
  useEffect(() => {
    if (brouillonSession?.id) {
      chargerSession(brouillonSession.id)
    }
  }, [brouillonSession])

  async function chargerSession(sessionId) {
    setChargement(true)
    try {
      const details = await api.get(`/sessions-inventaire/${sessionId}/`)
      setSessionActive(details)
      // Initialiser les saisies locales
      const mapSaisies = {}
      details.lignes.forEach((ligne) => {
        mapSaisies[ligne.id] = ligne.stock_physique !== null && ligne.stock_physique !== undefined ? String(ligne.stock_physique) : ''
      })
      setSaisies(mapSaisies)
      setErreur('')
    } catch (err) {
      setErreur(err.message || 'Erreur lors du chargement de la session inventaire')
    } finally {
      setChargement(false)
    }
  }

  async function demarrerInventaire(e) {
    e.preventDefault()
    setChargement(true)
    setErreur('')
    try {
      const nouvelleSession = await api.post('/sessions-inventaire/', {
        date,
        motif: motif.trim() || `Inventaire du ${date}`,
      })
      await chargerSession(nouvelleSession.id)
    } catch (err) {
      setErreur(err.message || "Erreur lors du démarrage de l'inventaire")
    } finally {
      setChargement(false)
    }
  }

  function changerStock(ligneId, valStr) {
    setSaisies((prev) => ({
      ...prev,
      [ligneId]: valStr,
    }))
  }

  async function sauvegarderProgression() {
    if (!sessionActive) return
    setEnvoi(true)
    setErreur('')
    try {
      const payloadSaisies = Object.entries(saisies).map(([ligneId, val]) => ({
        ligne_id: ligneId,
        stock_physique: val !== '' && val !== null && !isNaN(Number(val)) ? Number(val) : null,
      }))
      const miseAJour = await api.post(`/sessions-inventaire/${sessionActive.id}/sauvegarder_brouillon/`, {
        saisies: payloadSaisies,
      })
      setSessionActive(miseAJour)
    } catch (err) {
      setErreur(err.message || 'Erreur lors de la sauvegarde du brouillon')
    } finally {
      setEnvoi(false)
    }
  }

  async function annulerInventaire() {
    if (!sessionActive) return
    if (!window.confirm("Êtes-vous sûr de vouloir abandonner cet inventaire ? Aucun changement ne sera apporté au stock.")) {
      return
    }
    setEnvoi(true)
    try {
      await api.post(`/sessions-inventaire/${sessionActive.id}/annuler/`)
      await onEnregistre()
    } catch (err) {
      setErreur(err.message || "Erreur lors de l'annulation")
      setEnvoi(false)
    }
  }

  async function validerDefinitivement() {
    if (!sessionActive) return
    setEnvoi(true)
    setErreur('')
    try {
      const payloadSaisies = Object.entries(saisies).map(([ligneId, val]) => ({
        ligne_id: ligneId,
        stock_physique: val !== '' && val !== null && !isNaN(Number(val)) ? Number(val) : null,
      }))
      await api.post(`/sessions-inventaire/${sessionActive.id}/valider/`, {
        saisies: payloadSaisies,
      })
      setConfirmValidation(false)
      await onEnregistre()
    } catch (err) {
      setErreur(err.message || "Erreur lors de la validation de l'inventaire")
      setEnvoi(false)
    }
  }

  // Si pas de session active, afficher le formulaire de démarrage
  if (!sessionActive) {
    return (
      <Modale titre="Démarrer un Inventaire Officiel" largeur={480} onFerme={onFerme}>
        {erreur && <div className="erreur">{erreur}</div>}
        <form onSubmit={demarrerInventaire}>
          <div style={{ background: 'var(--tint)', padding: 14, borderRadius: 10, marginBottom: 16, fontSize: 13, color: 'var(--txt-sombre)' }}>
            📋 <strong>Session d'inventaire sécurisée :</strong><br />
            Le stock théorique de tout le catalogue sera figé à cet instant. Vos saisies seront conservées en brouillon et <strong>aucun mouvement de stock ne sera créé tant que vous ne validez pas</strong>.
          </div>

          <label className="lbl">Date de l'inventaire</label>
          <input
            className="champ"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />

          <label className="lbl">Nom / Motif de l'inventaire</label>
          <input
            className="champ"
            placeholder="ex. Inventaire semaine du 10/08/2026"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            required
          />

          <div className="modal-act" style={{ marginTop: 20 }}>
            <button type="button" className="btn btn-g" onClick={onFerme}>
              Annuler
            </button>
            <button className="btn btn-o" disabled={chargement}>
              {chargement ? 'Démarrage…' : 'Commencer le comptage'}
            </button>
          </div>
        </form>
      </Modale>
    )
  }

  // Calculs des lignes et des catégories
  const lignes = sessionActive.lignes || []
  const categoriesObj = Array.from(
    new Set(lignes.map((l) => l.produit_categorie_nom).filter(Boolean)),
  )

  const lignesFiltrees = lignes.filter((l) => {
    const terme = recherche.trim().toLowerCase()
    // Si recherche active -> cherche dans toutes les catégories
    if (terme) return l.produit_nom.toLowerCase().includes(terme)
    // Sinon -> applique le filtre catégorie
    if (filtreCategorie) return String(l.produit_categorie_nom) === String(filtreCategorie)
    return true
  })

  // Statistiques en direct
  let comptés = 0
  let avecEcart = 0
  let totalManquants = 0
  let totalSurplus = 0
  let valeurFinanciereEcarts = 0

  lignes.forEach((l) => {
    const val = saisies[l.id]
    if (val !== '' && val !== null && val !== undefined) {
      comptés++
      const phys = Number(val)
      const ecart = phys - l.stock_theorique
      if (ecart !== 0) {
        avecEcart++
        if (ecart < 0) totalManquants += Math.abs(ecart)
        else totalSurplus += ecart
        valeurFinanciereEcarts += Math.abs(ecart) * (l.produit_prix || 0)
      }
    }
  })

  return (
    <>
      <Modale titre={`Saisie Inventaire Officiel — ${sessionActive.motif}`} largeur={920} onFerme={onFerme}>
        {erreur && <div className="erreur">{erreur}</div>}

        {/* Barre de statut et de progression */}
        <div
          style={{
            background: 'var(--tint)',
            border: '1px solid var(--tint-bd)',
            padding: '12px 16px',
            borderRadius: 12,
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--noir)' }}>
              Session du {new Date(sessionActive.date).toLocaleDateString('fr-FR')} &nbsp;•&nbsp;{' '}
              <span style={{ color: '#d97706', background: '#fef3c7', padding: '2px 8px', borderRadius: 8, fontSize: 12 }}>
                🟡 Brouillon (Stock boutique non modifié)
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--mut)', marginTop: 2 }}>
              Progression : <strong>{comptés} / {lignes.length}</strong> articles comptés
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, fontSize: 13, fontWeight: 700 }}>
            {totalManquants > 0 && (
              <span style={{ color: 'var(--rouge)', background: 'rgba(244, 67, 54, 0.1)', padding: '4px 10px', borderRadius: 8 }}>
                -{totalManquants} manquants
              </span>
            )}
            {totalSurplus > 0 && (
              <span style={{ color: 'var(--vert)', background: 'rgba(76, 175, 80, 0.1)', padding: '4px 10px', borderRadius: 8 }}>
                +{totalSurplus} surplus
              </span>
            )}
          </div>
        </div>

        {/* Barre de recherche + Filtres boutons par catégorie */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              className="champ"
              style={{ flex: 1 }}
              placeholder="Rechercher une boisson dans toutes les catégories…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
            {recherche && (
              <button
                type="button"
                className="btn btn-g"
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => setRecherche('')}
              >
                Effacer
              </button>
            )}
          </div>

          {!recherche && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', marginRight: 4 }}>
                Catégories :
              </span>
              <button
                type="button"
                className={`segb ${filtreCategorie === '' ? 'on' : ''}`}
                onClick={() => setFiltreCategorie('')}
              >
                Toutes ({lignes.length})
              </button>
              {categoriesObj.map((catNom) => {
                const countCat = lignes.filter((l) => l.produit_categorie_nom === catNom).length
                return (
                  <button
                    key={catNom}
                    type="button"
                    className={`segb ${filtreCategorie === catNom ? 'on' : ''}`}
                    onClick={() => setFiltreCategorie(catNom)}
                  >
                    {catNom} ({countCat})
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Tableau de saisie */}
        <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid var(--bord)', borderRadius: 'var(--radius)' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Catégorie</th>
                <th style={{ textAlign: 'right' }}>Prix</th>
                <th style={{ textAlign: 'center' }}>Stock Théorique</th>
                <th style={{ textAlign: 'center', width: 170 }}>Stock Physique</th>
                <th style={{ textAlign: 'center' }}>Écart</th>
              </tr>
            </thead>
            <tbody>
              {lignesFiltrees.map((ligne) => {
                const valStr = saisies[ligne.id] ?? ''
                const phys = valStr !== '' ? Number(valStr) : null
                const ecart = phys !== null && !isNaN(phys) ? phys - ligne.stock_theorique : null

                return (
                  <tr
                    key={ligne.id}
                    style={{
                      background: ecart !== null && ecart !== 0 ? 'rgba(255, 152, 0, 0.08)' : undefined,
                    }}
                  >
                    <td style={{ fontWeight: 600 }}>{ligne.produit_nom}</td>
                    <td style={{ color: 'var(--mut)' }}>{ligne.produit_categorie_nom || '—'}</td>
                    <td style={{ textAlign: 'right', color: 'var(--mut)' }}>{fcfa(ligne.produit_prix)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge b-ok" style={{ fontWeight: 700 }}>
                        {ligne.stock_theorique}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        className="champ"
                        type="number"
                        min="0"
                        placeholder="Saisir..."
                        style={{
                          margin: 0,
                          padding: '4px 8px',
                          textAlign: 'center',
                          fontWeight: 'bold',
                          fontSize: 14,
                          borderColor: valStr !== '' && ecart !== 0 ? 'var(--orange-dk)' : undefined,
                        }}
                        value={valStr}
                        onChange={(e) => changerStock(ligne.id, e.target.value)}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {ecart === null ? (
                        <span style={{ color: 'var(--mut)', fontSize: 13 }}>— non compté</span>
                      ) : ecart === 0 ? (
                        <span style={{ color: '#2e7d32', fontSize: 13, fontWeight: 'bold' }}>0 (Conforme)</span>
                      ) : (
                        <span
                          className="badge"
                          style={{
                            background: ecart > 0 ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)',
                            color: ecart > 0 ? '#2e7d32' : '#c62828',
                            fontWeight: 'bold',
                          }}
                        >
                          {ecart > 0 ? `+${ecart} (Surplus)` : `${ecart} (Manquant)`}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Actions principales */}
        <div className="modal-act" style={{ marginTop: 18, justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-g"
            style={{ color: 'var(--rouge)' }}
            onClick={annulerInventaire}
            disabled={envoi}
          >
            Abandonner cet inventaire
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-g"
              onClick={sauvegarderProgression}
              disabled={envoi}
            >
              {envoi ? 'Sauvegarde…' : 'Sauvegarder le brouillon'}
            </button>

            <button
              type="button"
              className="btn btn-o"
              style={{ fontWeight: 700 }}
              onClick={() => setConfirmValidation(true)}
              disabled={envoi || comptés === 0}
            >
              Valider et enregistrer définitivement ({comptés})
            </button>
          </div>
        </div>
      </Modale>

      {/* Pop-up de confirmation finale */}
      {confirmValidation && (
        <Modale titre="Confirmation de Validation de l'Inventaire" largeur={500} onFerme={() => setConfirmValidation(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', padding: 14, borderRadius: 10, fontSize: 13 }}>
              ⚠️ <strong>ATTENTION :</strong><br />
              Vous allez valider définitivement l'inventaire du <strong>{new Date(sessionActive.date).toLocaleDateString('fr-FR')}</strong>.<br />
              Cette action va écrire les corrections au livre de stock et mettre à jour le stock disponible du Bar.
            </div>

            <div style={{ background: 'var(--tint)', padding: 14, borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total des articles comptés :</span>
                <strong>{comptés} articles</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Articles avec écart de stock :</span>
                <strong style={{ color: avecEcart > 0 ? 'var(--orange-dk)' : 'var(--vert)' }}>{avecEcart} articles</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Bouteilles manquantes :</span>
                <strong style={{ color: 'var(--rouge)' }}>-{totalManquants}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Bouteilles en surplus :</span>
                <strong style={{ color: 'var(--vert)' }}>+{totalSurplus}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--bord)', paddingTop: 6, marginTop: 4 }}>
                <span>Valeur financière des écarts :</span>
                <strong style={{ fontSize: 14 }}>{fcfa(valeurFinanciereEcarts)}</strong>
              </div>
            </div>

            <div className="modal-act" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="btn btn-g"
                onClick={() => setConfirmValidation(false)}
                disabled={envoi}
              >
                Retour aux modifications
              </button>
              <button
                type="button"
                className="btn btn-o"
                style={{ fontWeight: 800 }}
                onClick={validerDefinitivement}
                disabled={envoi}
              >
                {envoi ? 'Validation en cours…' : 'Oui, Valider définitivement'}
              </button>
            </div>
          </div>
        </Modale>
      )}
    </>
  )
}
