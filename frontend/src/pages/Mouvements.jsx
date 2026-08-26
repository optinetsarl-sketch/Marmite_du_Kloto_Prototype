import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { liste } from '../api'

export default function Mouvements() {
  const navigate = useNavigate()
  const [mouvements, setMouvements] = useState([])
  const [erreur, setErreur] = useState('')
  
  const [moisOuverts, setMoisOuverts] = useState({})
  const [joursOuverts, setJoursOuverts] = useState({})

  async function charger() {
    try {
      const historique = await liste('/mouvements-stock/?page_size=500')
      setMouvements(historique)
      setErreur('')
    } catch (echec) {
      setErreur(echec.message)
    }
  }

  useEffect(() => {
    charger()
  }, [])

  const mouvementsGroupesParMois = useMemo(() => {
    const mapMois = {}
    mouvements.forEach((mvt) => {
      const dateObj = new Date(mvt.cree_le)
      
      // Mois Level (ex: "Août 2026")
      let moisStr = dateObj.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      moisStr = moisStr.charAt(0).toUpperCase() + moisStr.slice(1)
      
      // Jour Level (ex: "Mercredi 26")
      let jourStr = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit' })
      jourStr = jourStr.charAt(0).toUpperCase() + jourStr.slice(1)
      
      if (!mapMois[moisStr]) {
        mapMois[moisStr] = {
          nom: moisStr,
          dateSort: new Date(dateObj.getFullYear(), dateObj.getMonth(), 1), // pour trier les mois
          totalVariation: 0,
          nbMouvements: 0,
          joursMap: {}
        }
      }
      
      if (!mapMois[moisStr].joursMap[jourStr]) {
         mapMois[moisStr].joursMap[jourStr] = {
            nom: jourStr,
            dateSort: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()), // pour trier les jours
            liste: [],
            totalVariation: 0
         }
      }
      
      const q = Number(mvt.quantite || 0)
      mapMois[moisStr].joursMap[jourStr].liste.push(mvt)
      mapMois[moisStr].joursMap[jourStr].totalVariation += q
      
      mapMois[moisStr].totalVariation += q
      mapMois[moisStr].nbMouvements += 1
    })
    
    // Trier les mois du plus récent au plus ancien
    const listeMois = Object.values(mapMois).sort((a, b) => b.dateSort - a.dateSort)
    
    // Trier les jours au sein de chaque mois
    listeMois.forEach(mois => {
       mois.jours = Object.values(mois.joursMap).sort((a, b) => b.dateSort - a.dateSort)
    })
    
    return listeMois
  }, [mouvements])

  // Ouvrir le premier mois par défaut
  useEffect(() => {
    if (mouvementsGroupesParMois.length > 0 && Object.keys(moisOuverts).length === 0) {
      setMoisOuverts({ [mouvementsGroupesParMois[0].nom]: true })
    }
  }, [mouvementsGroupesParMois, moisOuverts])

  function basculerMois(nom) {
    setMoisOuverts((prev) => ({
      ...prev,
      [nom]: !prev[nom],
    }))
  }

  function basculerJour(moisNom, jourNom) {
    const key = `${moisNom}_${jourNom}`
    setJoursOuverts((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  function toutBasculerMois(ouvrir) {
    const nv = {}
    mouvementsGroupesParMois.forEach((mois) => {
      nv[mois.nom] = ouvrir
    })
    setMoisOuverts(nv)
  }

  function toutBasculerJours(ouvrir) {
    const nv = {}
    mouvementsGroupesParMois.forEach((mois) => {
      mois.jours.forEach((jour) => {
        nv[`${mois.nom}_${jour.nom}`] = ouvrir
      })
    })
    setJoursOuverts(nv)
  }

  return (
    <>
      <div className="top">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-g" onClick={() => navigate('/bar')} style={{ padding: '6px 12px' }}>
            ← Retour
          </button>
          <div>
            <h1>Mouvements & Historique</h1>
            <div className="sub">Historique complet de toutes les opérations de stock.</div>
          </div>
        </div>
      </div>

      {erreur && <div className="erreur">{erreur}</div>}

      <div className="card" id="section-mouvements">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--noir)' }}>
            Journal chronologique ({mouvements.length} opérations)
          </div>

          {mouvementsGroupesParMois.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-g"
                style={{ padding: '4px 10px', fontSize: 12 }}
                onClick={() => {
                  toutBasculerMois(true)
                  toutBasculerJours(true)
                }}
              >
                Tout développer
              </button>
              <button
                type="button"
                className="btn btn-g"
                style={{ padding: '4px 10px', fontSize: 12 }}
                onClick={() => {
                  toutBasculerMois(false)
                  toutBasculerJours(false)
                }}
              >
                Tout réduire
              </button>
            </div>
          )}
        </div>

        {mouvementsGroupesParMois.length === 0 ? (
          <div className="etat">Aucun mouvement enregistré.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {mouvementsGroupesParMois.map((mois) => {
              const moisEstOuvert = !!moisOuverts[mois.nom]

              return (
                <div
                  key={mois.nom}
                  style={{
                    border: '1px solid var(--bord)',
                    borderRadius: 14,
                    overflow: 'hidden',
                    background: 'var(--bg-app, #fff)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                  }}
                >
                  {/* En-tête du MOIS */}
                  <div
                    onClick={() => basculerMois(mois.nom)}
                    style={{
                      padding: '16px 20px',
                      background: moisEstOuvert ? 'var(--tint)' : 'var(--bg-app, #fff)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      userSelect: 'none',
                      borderBottom: moisEstOuvert ? '1px solid var(--tint-bd)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--noir)', textTransform: 'capitalize' }}>
                        {mois.nom}
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
                        {mois.nbMouvements} mouvement{mois.nbMouvements > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: mois.totalVariation >= 0 ? 'var(--vert)' : 'var(--rouge)',
                        }}
                      >
                        Bilan du mois : {mois.totalVariation > 0 ? '+' : ''}{mois.totalVariation}
                      </span>

                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'var(--noir)',
                          background: 'rgba(0,0,0,0.05)',
                          padding: '4px 10px',
                          borderRadius: 8,
                        }}
                      >
                        {moisEstOuvert ? 'Masquer ▲' : 'Ouvrir ▼'}
                      </span>
                    </div>
                  </div>

                  {/* Contenu du MOIS (Liste des JOURS) */}
                  {moisEstOuvert && (
                    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg-app)' }}>
                      {mois.jours.map((jour) => {
                        const jourKey = `${mois.nom}_${jour.nom}`
                        const jourEstOuvert = !!joursOuverts[jourKey]

                        return (
                          <div
                            key={jourKey}
                            style={{
                              border: '1px solid var(--bord)',
                              borderRadius: 10,
                              overflow: 'hidden',
                              background: '#fff',
                            }}
                          >
                            {/* En-tête du JOUR */}
                            <div
                              onClick={() => basculerJour(mois.nom, jour.nom)}
                              style={{
                                padding: '12px 16px',
                                background: jourEstOuvert ? 'rgba(0,0,0,0.02)' : '#fff',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                userSelect: 'none',
                                borderBottom: jourEstOuvert ? '1px solid var(--bord)' : 'none',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--noir)' }}>
                                  {jour.nom}
                                </span>
                                <span style={{ fontSize: 12, color: 'var(--mut)', fontWeight: 600 }}>
                                  {jour.liste.length} mvts
                                </span>
                              </div>
                              
                              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <span
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: jour.totalVariation >= 0 ? 'var(--vert)' : 'var(--rouge)',
                                  }}
                                >
                                  Total : {jour.totalVariation > 0 ? '+' : ''}{jour.totalVariation}
                                </span>

                                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--orange-dk)' }}>
                                  {jourEstOuvert ? '▲' : '▼'}
                                </span>
                              </div>
                            </div>

                            {/* Contenu du JOUR (Le tableau des mouvements) */}
                            {jourEstOuvert && (
                              <div className="tableau-defilant" style={{ padding: '4px 8px 8px' }}>
                                <table className="grid cartes compacte">
                                  <thead>
                                    <tr>
                                      <th>Produit</th>
                                      <th>Heure</th>
                                      <th>Motif</th>
                                      <th style={{ textAlign: 'right' }}>Quantité</th>
                                      <th>Fournisseur / Note</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {jour.liste.map((mouvement) => (
                                      <tr key={mouvement.id}>
                                        <td
                                          data-label="Produit"
                                          style={{ fontWeight: 600, color: 'var(--noir)' }}
                                        >
                                          {mouvement.produit_nom || 'Autre'}
                                        </td>
                                        <td
                                          data-label="Heure"
                                          style={{ color: 'var(--mut)', whiteSpace: 'nowrap' }}
                                        >
                                          {new Date(mouvement.cree_le).toLocaleString('fr-FR', {
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
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
