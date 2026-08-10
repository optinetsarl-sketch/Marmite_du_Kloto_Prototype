import { useEffect, useMemo, useState } from 'react'

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
  const { utilisateur } = useAuth()
  const estAdmin = Boolean(utilisateur?.is_admin || utilisateur?.role === 'admin')

  const [produits, setProduits] = useState([])
  const [mouvements, setMouvements] = useState([])
  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState('tous')
  const [categories, setCategories] = useState([])
  const [erreur, setErreur] = useState('')
  const [operation, setOperation] = useState(null)

  async function charger() {
    try {
      const [listeProduits, historique, listeCategories] = await Promise.all([
        liste('/produits/?categorie__rayon=bar&page_size=400'),
        liste('/mouvements-stock/?page_size=500'),
        liste('/categories/'),
      ])
      setProduits(listeProduits)
      setMouvements(historique)
      setCategories(listeCategories)
      setErreur('')
    } catch (echec) {
      setErreur(echec.message)
    }
  }

  useEffect(() => {
    charger()
  }, [])

  const [ongletMouvements, setOngletMouvements] = useState('tous') // 'tous' | 'inventaires'

  const [groupesOuverts, setGroupesOuverts] = useState({})

  // Regroupement des mouvements d'inventaires en "Sessions d'inventaire"
  const sessionsInventaire = useMemo(() => {
    const mvtInventaires = mouvements.filter((m) => m.motif === 'inventaire')
    const sessionsMap = {}

    mvtInventaires.forEach((mvt) => {
      // Clé par date (minute) + commentaire pour regrouper la même session d'inventaire
      const dateMinute = mvt.cree_le ? mvt.cree_le.substring(0, 16) : 'inconnu'
      const key = `${dateMinute}_${mvt.commentaire || 'sans_note'}`

      if (!sessionsMap[key]) {
        sessionsMap[key] = {
          id: key,
          date: mvt.cree_le,
          commentaire: mvt.commentaire || "Correction d'inventaire",
          mouvements: [],
          totalPositifs: 0,
          totalNegatifs: 0,
          totalEcart: 0,
        }
      }

      sessionsMap[key].mouvements.push(mvt)
      const q = Number(mvt.quantite || 0)
      sessionsMap[key].totalEcart += q
      if (q > 0) sessionsMap[key].totalPositifs += q
      else sessionsMap[key].totalNegatifs += Math.abs(q)
    })

    return Object.values(sessionsMap).sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [mouvements])

  const mouvementsGroupes = useMemo(() => {
    const map = {}
    mouvements.forEach((mvt) => {
      const nom = mvt.produit_nom || 'Autre'
      if (!map[nom]) {
        map[nom] = {
          nom,
          liste: [],
          totalVariation: 0,
        }
      }
      map[nom].liste.push(mvt)
      map[nom].totalVariation += Number(mvt.quantite || 0)
    })
    return Object.values(map)
  }, [mouvements])

  function basculerGroupe(nom) {
    setGroupesOuverts((prev) => ({
      ...prev,
      [nom]: !prev[nom],
    }))
  }

  function toutBasculer(ouvrir) {
    const nv = {}
    mouvementsGroupes.forEach((grp) => {
      nv[grp.nom] = ouvrir
    })
    setGroupesOuverts(nv)
  }

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
              onClick={() => {
                setOngletMouvements('inventaires')
                document.getElementById('section-mouvements')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              📜 Historique inventaires ({sessionsInventaire.length})
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

      <div className="card" id="section-mouvements">
        {/* Onglets de navigation entre Mouvements et Historique d'Inventaire */}
        <div
          style={{
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div className="seg" style={{ background: 'var(--tint)', padding: 4, borderRadius: 10 }}>
            <button
              type="button"
              className={`segb ${ongletMouvements === 'tous' ? 'on' : ''}`}
              onClick={() => setOngletMouvements('tous')}
              style={{ fontWeight: 700, fontSize: 13 }}
            >
              📋 Tous les mouvements ({mouvements.length})
            </button>
            <button
              type="button"
              className={`segb ${ongletMouvements === 'inventaires' ? 'on' : ''}`}
              onClick={() => setOngletMouvements('inventaires')}
              style={{ fontWeight: 700, fontSize: 13 }}
            >
              📊 Historique des inventaires passés ({sessionsInventaire.length})
            </button>
          </div>

          {ongletMouvements === 'tous' && mouvementsGroupes.length > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-g"
                style={{ padding: '4px 10px', fontSize: 12 }}
                onClick={() => toutBasculer(true)}
              >
                Développer tout
              </button>
              <button
                type="button"
                className="btn btn-g"
                style={{ padding: '4px 10px', fontSize: 12 }}
                onClick={() => toutBasculer(false)}
              >
                Réduire tout
              </button>
            </div>
          )}
        </div>
        {ongletMouvements === 'inventaires' ? (
          sessionsInventaire.length === 0 ? (
            <div className="etat">Aucun inventaire antérieur enregistré.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {sessionsInventaire.map((session) => {
                const estOuvert = !!groupesOuverts[session.id]
                return (
                  <div
                    key={session.id}
                    style={{
                      border: '1px solid var(--bord)',
                      borderRadius: 12,
                      overflow: 'hidden',
                      background: 'var(--bg-app, #fff)',
                      transition: 'all 0.15s ease',
                      borderLeft: '5px solid var(--orange)',
                    }}
                  >
                    <div
                      onClick={() => basculerGroupe(session.id)}
                      style={{
                        padding: '14px 18px',
                        background: estOuvert ? 'var(--tint)' : 'var(--bg-app, #fff)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        userSelect: 'none',
                        flexWrap: 'wrap',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--noir)' }}>
                            📅 {new Date(session.date).toLocaleString('fr-FR', {
                              weekday: 'long',
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              padding: '2px 10px',
                              borderRadius: 12,
                              background: 'var(--bg-app, #fff)',
                              border: '1px solid var(--bord)',
                              color: 'var(--mut)',
                            }}
                          >
                            {session.mouvements.length} article{session.mouvements.length > 1 ? 's' : ''} ajusté{session.mouvements.length > 1 ? 's' : ''}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--mut)', fontWeight: 600 }}>
                          📝 Motif : <span style={{ color: 'var(--noir)' }}>{session.commentaire}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ display: 'flex', gap: 8, fontSize: 12, fontWeight: 700 }}>
                          {session.totalPositifs > 0 && (
                            <span style={{ color: 'var(--vert)', background: 'rgba(76, 175, 80, 0.12)', padding: '3px 8px', borderRadius: 8 }}>
                              +{session.totalPositifs} (surplus)
                            </span>
                          )}
                          {session.totalNegatifs > 0 && (
                            <span style={{ color: 'var(--rouge)', background: 'rgba(244, 67, 54, 0.12)', padding: '3px 8px', borderRadius: 8 }}>
                              -{session.totalNegatifs} (manquants)
                            </span>
                          )}
                        </div>

                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: 'var(--orange-dk)',
                            background: 'rgba(244,124,32,0.1)',
                            padding: '4px 10px',
                            borderRadius: 8,
                          }}
                        >
                          {estOuvert ? 'Masquer ▲' : 'Voir le rapport ▼'}
                        </span>
                      </div>
                    </div>

                    {estOuvert && (
                      <div className="tableau-defilant" style={{ padding: '8px 12px 12px', borderTop: '1px solid var(--bord)' }}>
                        <table className="grid cartes compacte">
                          <thead>
                            <tr>
                              <th>Boisson / Produit</th>
                              <th style={{ textAlign: 'right' }}>Ajustement (Écart)</th>
                              <th>Commentaire / Remarque</th>
                            </tr>
                          </thead>
                          <tbody>
                            {session.mouvements.map((mvt) => (
                              <tr key={mvt.id}>
                                <td data-label="Produit" style={{ fontWeight: 700, color: 'var(--noir)' }}>
                                  {mvt.produit_nom}
                                </td>
                                <td
                                  data-label="Ajustement"
                                  style={{
                                    textAlign: 'right',
                                    fontWeight: 800,
                                    fontSize: 14,
                                    color: mvt.quantite < 0 ? 'var(--rouge)' : 'var(--vert)',
                                  }}
                                >
                                  {mvt.quantite > 0 ? `+${mvt.quantite}` : mvt.quantite}
                                </td>
                                <td data-label="Remarque" style={{ color: 'var(--mut)' }}>
                                  {mvt.commentaire || '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        ) : mouvementsGroupes.length === 0 ? (
          <div className="etat">Aucun mouvement enregistré.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mouvementsGroupes.map((grp) => {
              const estOuvert = !!groupesOuverts[grp.nom]
              return (
                <div
                  key={grp.nom}
                  style={{
                    border: '1px solid var(--bord)',
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: 'var(--bg-app, #fff)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* En-tête cliquable du groupe de produit */}
                  <div
                    onClick={() => basculerGroupe(grp.nom)}
                    style={{
                      padding: '14px 18px',
                      background: estOuvert ? 'var(--tint)' : 'var(--bg-app, #fff)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      userSelect: 'none',
                      borderBottom: estOuvert ? '1px solid var(--tint-bd)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 800,
                          color: 'var(--noir)',
                        }}
                      >
                        {grp.nom}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 12,
                          background: 'var(--bg-app, #fff)',
                          border: '1px solid var(--bord)',
                          color: 'var(--mut)',
                        }}
                      >
                        {grp.liste.length} mouvement{grp.liste.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: grp.totalVariation >= 0 ? 'var(--vert)' : 'var(--rouge)',
                        }}
                      >
                        Total : {grp.totalVariation > 0 ? '+' : ''}
                        {grp.totalVariation}
                      </span>

                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'var(--orange-dk)',
                          background: 'rgba(244,124,32,0.1)',
                          padding: '4px 10px',
                          borderRadius: 8,
                        }}
                      >
                        {estOuvert ? 'Masquer ▲' : 'Voir détails ▼'}
                      </span>
                    </div>
                  </div>

                  {/* Liste déroulante des détails du produit */}
                  {estOuvert && (
                    <div className="tableau-defilant" style={{ padding: '4px 8px 8px' }}>
                      <table className="grid cartes compacte">
                        <thead>
                          <tr>
                            <th>Date &amp; heure</th>
                            <th>Motif</th>
                            <th style={{ textAlign: 'right' }}>Quantité</th>
                            <th>Fournisseur / Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grp.liste.map((mouvement) => (
                            <tr key={mouvement.id}>
                              <td
                                data-label="Date"
                                style={{ fontWeight: 600, color: 'var(--noir)', whiteSpace: 'nowrap' }}
                              >
                                {new Date(mouvement.cree_le).toLocaleString('fr-FR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td data-label="Motif" style={{ color: 'var(--mut)' }}>
                                {mouvement.motif_libelle}
                              </td>
                              <td
                                data-label="Quantité"
                                style={{
                                  textAlign: 'right',
                                  fontWeight: 700,
                                  color: mouvement.quantite < 0 ? 'var(--rouge)' : 'var(--vert)',
                                }}
                              >
                                {mouvement.quantite > 0 ? '+' : ''}
                                {mouvement.quantite}
                              </td>
                              <td data-label="Fournisseur / note" style={{ color: 'var(--mut)' }}>
                                {mouvement.fournisseur_nom || mouvement.commentaire || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {operation && (
        <OperationStock
          type={operation}
          produits={produits}
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

function OperationStock({ type, produits, onFerme, onEnregistre }) {
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
    return <InventaireGlobal produits={produits} onFerme={onFerme} onEnregistre={onEnregistre} />
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

function InventaireGlobal({ produits, onFerme, onEnregistre }) {
  const [recherche, setRecherche] = useState('')
  const [categorieFiltre, setCategorieFiltre] = useState('')
  const [stocksReels, setStocksReels] = useState(() => {
    const init = {}
    produits.forEach((p) => {
      init[p.id] = p.stock
    })
    return init
  })
  const [commentaire, setCommentaire] = useState('Correction / Stock de début')
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)

  // Extraire les catégories uniques pour le filtre
  const categories = Array.from(
    new Set(produits.map((p) => p.categorie?.nom || p.categorie_nom).filter(Boolean)),
  )

  const produitsFiltres = produits.filter((p) => {
    const matchNom = p.nom.toLowerCase().includes(recherche.toLowerCase())
    const catNom = p.categorie?.nom || p.categorie_nom || ''
    const matchCat = !categorieFiltre || catNom === categorieFiltre
    return matchNom && matchCat
  })

  function changerStock(id, valeur) {
    setStocksReels((prev) => ({
      ...prev,
      [id]: valeur,
    }))
  }

  // Articles ayant eu une modification par rapport au stock actuel
  const modifications = produits.filter((p) => {
    const sReel = Number(stocksReels[p.id])
    return !isNaN(sReel) && sReel !== p.stock
  })

  async function enregistrer(e) {
    e.preventDefault()
    setErreur('')
    if (modifications.length === 0) {
      onFerme()
      return
    }
    setEnvoi(true)
    try {
      for (const p of modifications) {
        const sReel = Number(stocksReels[p.id])
        await api.post('/mouvements-stock/inventaire/', {
          produit: p.id,
          stock_reel: sReel,
          commentaire: commentaire || 'Correction / Stock de début',
        })
      }
      await onEnregistre()
    } catch (echec) {
      setErreur(echec.message || "Erreur lors de l'enregistrement de l'inventaire")
      setEnvoi(false)
    }
  }

  return (
    <Modale titre="Correction d'inventaire — Saisie du Stock de Début / Boutique" largeur={850} onFerme={onFerme}>
      {erreur && <div className="erreur">{erreur}</div>}
      <form onSubmit={enregistrer}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <input
            className="champ"
            style={{ flex: 2, minWidth: 180 }}
            placeholder="🔍 Rechercher un article…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
          <select
            className="champ"
            style={{ flex: 1, minWidth: 150 }}
            value={categorieFiltre}
            onChange={(e) => setCategorieFiltre(e.target.value)}
          >
            <option value="">Toutes les catégories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <input
            className="champ"
            style={{ flex: 2, minWidth: 180 }}
            placeholder="Motif / Commentaire (ex: Stock de début boutique)"
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
          />
        </div>

        <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid var(--bord)', borderRadius: 'var(--radius)' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Catégorie</th>
                <th>Prix Standard</th>
                <th>Stock Théorique</th>
                <th>Stock en Boutique (Stock de début)</th>
                <th>Écart</th>
              </tr>
            </thead>
            <tbody>
              {produitsFiltres.map((p) => {
                const valSaisie = stocksReels[p.id] !== undefined ? stocksReels[p.id] : p.stock
                const sReel = Number(valSaisie)
                const ecart = !isNaN(sReel) ? sReel - p.stock : 0

                return (
                  <tr key={p.id} style={{ background: ecart !== 0 ? 'rgba(255, 152, 0, 0.06)' : undefined }}>
                    <td style={{ fontWeight: 600 }}>{p.nom}</td>
                    <td>{p.categorie?.nom || p.categorie_nom || '—'}</td>
                    <td>{p.prix_standard ? `${p.prix_standard} F` : 'Prix libre'}</td>
                    <td>
                      <span className={`badge ${p.stock <= 0 ? 'b-rup' : p.stock <= p.seuil_alerte ? 'b-bas' : 'b-ok'}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td style={{ width: 170 }}>
                      <input
                        className="champ"
                        type="number"
                        min="0"
                        style={{ margin: 0, padding: '4px 8px', textAlign: 'center', fontWeight: 'bold', fontSize: 14, borderColor: ecart !== 0 ? 'var(--orange-dk)' : undefined }}
                        value={valSaisie}
                        onChange={(e) => changerStock(p.id, e.target.value)}
                      />
                    </td>
                    <td>
                      {ecart === 0 ? (
                        <span style={{ color: 'var(--txt-clair)', fontSize: 13 }}>0</span>
                      ) : (
                        <span
                          className="badge"
                          style={{
                            background: ecart > 0 ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)',
                            color: ecart > 0 ? '#2e7d32' : '#c62828',
                            fontWeight: 'bold',
                          }}
                        >
                          {ecart > 0 ? `+${ecart}` : ecart}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="modal-act" style={{ marginTop: 18, justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--txt-sombre)' }}>
            {modifications.length === 0 ? (
              <span>Aucun ajustement de stock</span>
            ) : (
              <span style={{ color: 'var(--orange-dk)', fontWeight: 600 }}>
                {modifications.length} article(s) à réajuster
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-g" onClick={onFerme}>
              Annuler
            </button>
            <button className="btn btn-o" disabled={envoi}>
              {envoi ? 'Enregistrement…' : `Valider l'inventaire (${modifications.length})`}
            </button>
          </div>
        </div>
      </form>
    </Modale>
  )
}
