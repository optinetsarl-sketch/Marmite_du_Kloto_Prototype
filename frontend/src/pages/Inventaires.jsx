import { useEffect, useMemo, useState } from 'react'
import { api, fcfa, liste } from '../api'
import { useAuth } from '../auth-contexte'

export default function Inventaires() {
  const { utilisateur } = useAuth()
  const estAdmin = Boolean(utilisateur?.is_admin || utilisateur?.role === 'admin')

  const [mouvements, setMouvements] = useState([])
  const [produits, setProduits] = useState([])
  const [categories, setCategories] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')

  // Filtres de sélection de session d'inventaire
  const [sessionSelectionneeId, setSessionSelectionneeId] = useState('')
  const [filtreDate, setFiltreDate] = useState('')
  const [filtreMois, setFiltreMois] = useState('')
  const [recherche, setRecherche] = useState('')

  async function charger() {
    setChargement(true)
    try {
      const [listeMvts, listeProduits, listeCats] = await Promise.all([
        liste('/mouvements-stock/?page_size=5000'),
        liste('/produits/?page_size=1000'),
        liste('/categories/'),
      ])
      setMouvements(listeMvts)
      setProduits(listeProduits)
      setCategories(listeCats)
      setErreur('')
    } catch (err) {
      setErreur(err.message || 'Erreur lors du chargement du registre des inventaires')
    } finally {
      setChargement(false)
    }
  }

  useEffect(() => {
    charger()
  }, [])

  // Map des produits par ID pour accès rapide au prix standard et catégorie
  const mapProduits = useMemo(() => {
    const map = {}
    produits.forEach((p) => {
      map[p.id] = p
    })
    return map
  }, [produits])

  // Map des catégories par ID
  const mapCategories = useMemo(() => {
    const map = {}
    categories.forEach((c) => {
      map[c.id] = c.nom
    })
    return map
  }, [categories])

  // Regroupement de TOUS les mouvements d'inventaire en sessions de comptage
  const sessionsInventaire = useMemo(() => {
    // Tous les mouvements avec motif inventaire
    const mvtInventaires = mouvements.filter((m) => m.motif === 'inventaire')
    const mapSessions = {}

    // Map chronologique de tous les mouvements par produit pour calculer le stock théorique à l'époque
    const mvtParProduit = {}
    // Trier tous les mouvements par date croissante
    const mvtsChronos = [...mouvements].sort((a, b) => new Date(a.cree_le) - new Date(b.cree_le))

    mvtsChronos.forEach((m) => {
      const pid = m.produit
      if (!mvtParProduit[pid]) mvtParProduit[pid] = []
      mvtParProduit[pid].push(m)
    })

    mvtInventaires.forEach((mvt) => {
      // Clé par JOUR + commentaire — tous les produits saisis le même jour avec le même motif = 1 session
      const dateJour = mvt.cree_le ? mvt.cree_le.substring(0, 10) : 'date_inconnue'
      const key = `${dateJour}_${(mvt.commentaire || 'sans_note').trim().toLowerCase()}`

      if (!mapSessions[key]) {
        mapSessions[key] = {
          id: key,
          date: mvt.cree_le,
          commentaire: mvt.commentaire || "Correction d'inventaire",
          lignes: [],
          totalPositifs: 0,
          totalNegatifs: 0,
          valeurEcarts: 0,
          nbArticlesAjustes: 0,
        }
      }

      // Calculer le stock théorique juste avant ce mouvement
      const pid = mvt.produit
      const historikPrd = mvtParProduit[pid] || []
      let stockTheoEpoque = 0

      for (const h of historikPrd) {
        if (h.id === mvt.id) break // On s'arrête juste avant ce mouvement d'inventaire
        stockTheoEpoque += Number(h.quantite || 0)
      }

      const ecart = Number(mvt.quantite || 0)
      const stockPhysiqueEpoque = stockTheoEpoque + ecart
      const produitObj = mapProduits[pid]
      const prixUnitaire = produitObj?.prix_standard || mvt.prix_unitaire || 0
      const valeurFinanciereEcart = Math.abs(ecart) * prixUnitaire

      mapSessions[key].lignes.push({
        id: mvt.id,
        produitId: pid,
        produitNom: mvt.produit_nom || produitObj?.nom || 'Produit inconnu',
        categorieNom: (produitObj && mapCategories[produitObj.categorie]) || '—',
        prixUnitaire,
        stockTheoEpoque,
        stockPhysiqueEpoque,
        ecart,
        valeurFinanciereEcart,
        commentaire: mvt.commentaire || '—',
      })

      mapSessions[key].nbArticlesAjustes += 1
      mapSessions[key].valeurEcarts += valeurFinanciereEcart

      if (ecart > 0) {
        mapSessions[key].totalPositifs += ecart
      } else if (ecart < 0) {
        mapSessions[key].totalNegatifs += Math.abs(ecart)
      }
    })

    return Object.values(mapSessions).sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [mouvements, mapProduits, mapCategories])

  // Filtrer la liste des sessions selon la date / mois / recherche
  const sessionsFiltrees = useMemo(() => {
    return sessionsInventaire.filter((session) => {
      const dateStr = session.date ? session.date.substring(0, 10) : ''
      const moisStr = session.date ? session.date.substring(0, 7) : ''

      if (filtreDate && dateStr !== filtreDate) return false
      if (filtreMois && moisStr !== filtreMois) return false
      if (recherche) {
        const r = recherche.toLowerCase()
        const matchNote = session.commentaire.toLowerCase().includes(r)
        const matchPrd = session.lignes.some((l) => l.produitNom.toLowerCase().includes(r))
        if (!matchNote && !matchPrd) return false
      }
      return true
    })
  }, [sessionsInventaire, filtreDate, filtreMois, recherche])

  // Session actuellement affichée en détail
  const sessionActive = useMemo(() => {
    if (sessionSelectionneeId) {
      return sessionsInventaire.find((s) => s.id === sessionSelectionneeId) || null
    }
    return sessionsFiltrees[0] || null
  }, [sessionSelectionneeId, sessionsInventaire, sessionsFiltrees])

  function imprimerPV() {
    window.print()
  }

  return (
    <>
      {/* Entête de la page */}
      <div className="top">
        <div>
          <h1>Registre & Traçabilité des Inventaires</h1>
          <div className="sub">
            Procès-verbaux figés et non modifiables des comptages d'inventaires (semaine, mois, année).
          </div>
        </div>
        {sessionActive && (
          <div className="actions-top">
            <button className="btn btn-o" onClick={imprimerPV}>
              Imprimer ce Procès-Verbal
            </button>
          </div>
        )}
      </div>

      {erreur && <div className="erreur">{erreur}</div>}

      {/* Barre de filtres et sélection d'inventaire */}
      <div className="selbar" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase' }}>
            Choisir une session d'inventaire
          </label>
          <select
            className="champ"
            style={{ fontWeight: 700 }}
            value={sessionActive?.id || ''}
            onChange={(e) => setSessionSelectionneeId(e.target.value)}
          >
            {sessionsInventaire.length === 0 && <option value="">Aucun inventaire enregistré</option>}
            {sessionsInventaire.map((s) => {
              const dt = new Date(s.date).toLocaleString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
              return (
                <option key={s.id} value={s.id}>
                  {dt} — {s.commentaire} ({s.nbArticlesAjustes} article{s.nbArticlesAjustes > 1 ? 's' : ''})
                </option>
              )
            })}
          </select>
        </div>

        <div style={{ flex: 1, minWidth: 150, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase' }}>
            Filtrer par Date exacte
          </label>
          <input
            type="date"
            className="champ"
            value={filtreDate}
            onChange={(e) => {
              setFiltreDate(e.target.value)
              setFiltreMois('')
            }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 150, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase' }}>
            Filtrer par Mois
          </label>
          <input
            type="month"
            className="champ"
            value={filtreMois}
            onChange={(e) => {
              setFiltreMois(e.target.value)
              setFiltreDate('')
            }}
          />
        </div>

        <div style={{ flex: 2, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase' }}>
            Rechercher un produit ou motif
          </label>
          <input
            type="text"
            className="champ"
            placeholder="ex: Pils, Stock physique..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>

        {(filtreDate || filtreMois || recherche) && (
          <button
            type="button"
            className="btn btn-g"
            style={{ alignSelf: 'flex-end', marginBottom: 2 }}
            onClick={() => {
              setFiltreDate('')
              setFiltreMois('')
              setRecherche('')
            }}
          >
            Réinitialiser
          </button>
        )}
      </div>

      {chargement ? (
        <div className="card etat">Chargement du registre des inventaires…</div>
      ) : !sessionActive ? (
        <div className="card etat">
          Aucun inventaire correspondant aux critères.
        </div>
      ) : (
        /* Document Officiel Procès-Verbal d'Inventaire */
        <div className="card" style={{ background: '#fff', border: '1px solid var(--bord)', borderRadius: 14, padding: 24 }}>
          {/* Entête officiel du procès-verbal (Centré au milieu) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              borderBottom: '2px solid var(--bord)',
              paddingBottom: 16,
              marginBottom: 20,
              gap: 4,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--orange-dk)', letterSpacing: 1.5, textTransform: 'uppercase' }}>
              PROCÈS-VERBAL D'INVENTAIRE OFFICIEL
            </div>
            <h2 style={{ margin: '4px 0 2px', fontSize: 22, fontWeight: 800, color: 'var(--noir)' }}>
              La Marmite du Kloto — Bar-Resto
            </h2>
            <div style={{ fontSize: 13, color: 'var(--mut)', fontWeight: 600 }}>
              Avédji · Lomé, Togo
            </div>

            <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: 'var(--noir)' }}>
              Date : {new Date(sessionActive.date).toLocaleString('fr-FR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            <div style={{ fontSize: 13, color: 'var(--mut)' }}>
              Motif / Session : <strong style={{ color: 'var(--noir)' }}>{sessionActive.commentaire}</strong>
            </div>
            <div style={{ fontSize: 12, color: 'var(--mut)', marginTop: 2 }}>
              Statut : <span style={{ color: '#2e7d32', fontWeight: 700 }}>Figé & Auditable</span>
            </div>
          </div>

          {/* Grille des 4 indicateurs clés (KPIs) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
              marginBottom: 24,
            }}
          >
            <div style={{ background: 'var(--tint)', padding: 14, borderRadius: 10, border: '1px solid var(--tint-bd)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase' }}>
                Articles Comptés / Ajustés
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--noir)', marginTop: 4 }}>
                {sessionActive.nbArticlesAjustes} <span style={{ fontSize: 13, fontWeight: 600 }}>articles</span>
              </div>
            </div>

            <div style={{ background: 'rgba(239,68,68,0.08)', padding: 14, borderRadius: 10, border: '1px solid rgba(239,68,68,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#c62828', textTransform: 'uppercase' }}>
                Total Manquants (Pertes)
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#c62828', marginTop: 4 }}>
                -{sessionActive.totalNegatifs} <span style={{ fontSize: 13, fontWeight: 600 }}>bouteilles</span>
              </div>
            </div>

            <div style={{ background: 'rgba(76,175,80,0.08)', padding: 14, borderRadius: 10, border: '1px solid rgba(76,175,80,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#2e7d32', textTransform: 'uppercase' }}>
                Total Surplus (Excédents)
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#2e7d32', marginTop: 4 }}>
                +{sessionActive.totalPositifs} <span style={{ fontSize: 13, fontWeight: 600 }}>bouteilles</span>
              </div>
            </div>

            <div style={{ background: 'rgba(244,124,32,0.08)', padding: 14, borderRadius: 10, border: '1px solid rgba(244,124,32,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange-dk)', textTransform: 'uppercase' }}>
                Impact Financier Écarts
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--orange-dk)', marginTop: 4 }}>
                {fcfa(sessionActive.valeurEcarts)}
              </div>
            </div>
          </div>

          {/* Tableau détaillé et figé des articles */}
          <div className="tableau-defilant">
            <table className="grid cartes compacte" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--tint)', borderBottom: '2px solid var(--bord)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Boisson / Produit</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Catégorie</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Prix Unitaire</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Stock Théorique à l'Époque</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Stock Physique Saisi</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Écart Constaté</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Valeur Écart</th>
                </tr>
              </thead>
              <tbody>
                {sessionActive.lignes.map((ligne) => {
                  const estManquant = ligne.ecart < 0
                  const estSurplus = ligne.ecart > 0

                  return (
                    <tr
                      key={ligne.id}
                      style={{
                        background: estManquant
                          ? 'rgba(239,68,68,0.04)'
                          : estSurplus
                          ? 'rgba(76,175,80,0.04)'
                          : undefined,
                        borderBottom: '1px solid var(--bord)',
                      }}
                    >
                      <td data-label="Produit" style={{ fontWeight: 700, padding: '10px 12px' }}>
                        {ligne.produitNom}
                      </td>
                      <td data-label="Catégorie" style={{ color: 'var(--mut)', padding: '10px 12px' }}>
                        {ligne.categorieNom}
                      </td>
                      <td data-label="Prix" style={{ textAlign: 'right', padding: '10px 12px' }}>
                        {fcfa(ligne.prixUnitaire)}
                      </td>
                      <td data-label="Stock Théorique" style={{ textAlign: 'right', fontWeight: 600, padding: '10px 12px' }}>
                        {ligne.stockTheoEpoque}
                      </td>
                      <td data-label="Stock Physique" style={{ textAlign: 'right', fontWeight: 700, padding: '10px 12px' }}>
                        {ligne.stockPhysiqueEpoque}
                      </td>
                      <td data-label="Écart" style={{ textAlign: 'right', padding: '10px 12px' }}>
                        <span
                          className="badge"
                          style={{
                            background: estManquant
                              ? 'rgba(239,68,68,0.15)'
                              : estSurplus
                              ? 'rgba(76,175,80,0.15)'
                              : 'rgba(0,0,0,0.06)',
                            color: estManquant ? '#c62828' : estSurplus ? '#2e7d32' : 'var(--mut)',
                            fontWeight: 800,
                            padding: '4px 10px',
                          }}
                        >
                          {estSurplus ? `+${ligne.ecart} (Surplus)` : estManquant ? `${ligne.ecart} (Manquant)` : '0 (Conforme)'}
                        </span>
                      </td>
                      <td data-label="Valeur Écart" style={{ textAlign: 'right', fontWeight: 700, padding: '10px 12px', color: estManquant ? '#c62828' : estSurplus ? '#2e7d32' : 'var(--mut)' }}>
                        {fcfa(ligne.valeurFinanciereEcart)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pied du Procès-Verbal */}
          <div
            style={{
              marginTop: 24,
              paddingTop: 16,
              borderTop: '1px solid var(--bord)',
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              fontSize: 12,
              color: 'var(--mut)',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              Document généré automatiquement par <strong>La Marmite du Kloto OS</strong> · Registre inaltérable.
            </div>
            <div>
              Signé électroniquement par l'utilisateur connecté (Admin / Gérant)
            </div>
          </div>
        </div>
      )}
    </>
  )
}

