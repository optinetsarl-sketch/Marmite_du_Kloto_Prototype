import { useEffect, useMemo, useState } from 'react'

import { api, fcfa, liste } from '../api'
import ModaleConfirmation from '../composants/ModaleConfirmation'

const CATEGORIES = [
  { code: 'achats_bar', libelle: 'Achats bar', couleur: '#e65100', fond: 'rgba(230,81,0,0.08)' },
  { code: 'achats_cuisine', libelle: 'Achats cuisine', couleur: '#c62828', fond: 'rgba(198,40,40,0.08)' },
  { code: 'transport', libelle: 'Transport', couleur: '#1565c0', fond: 'rgba(21,101,192,0.08)' },
  { code: 'salaires', libelle: 'Salaires / Avances', couleur: '#2e7d32', fond: 'rgba(46,125,50,0.08)' },
  { code: 'energie', libelle: 'Électricité / Eau / Gaz', couleur: '#f57f17', fond: 'rgba(245,127,23,0.08)' },
  { code: 'entretien', libelle: 'Entretien & Propreté', couleur: '#6a1b9a', fond: 'rgba(106,27,154,0.08)' },
  { code: 'autres', libelle: 'Autres dépenses', couleur: '#424242', fond: 'rgba(66,66,66,0.08)' },
]

const MODES = [
  { code: 'especes', libelle: 'Espèces', note: 'Prélevé de la caisse' },
  { code: 'tmoney', libelle: 'TMoney', note: 'Compte Mobile' },
  { code: 'flooz', libelle: 'Flooz', note: 'Compte Mobile' },
  { code: 'banque', libelle: 'Banque / Carte', note: 'Compte bancaire' },
]



export default function Depenses() {
  const [rapport, setRapport] = useState(null)
  const [depenses, setDepenses] = useState([])
  const [caisse, setCaisse] = useState(null)
  const [erreur, setErreur] = useState('')
  const [toast, setToast] = useState('')

  // Formulaire d'ajout
  const [categorie, setCategorie] = useState('achats_bar')
  const [montant, setMontant] = useState('')
  const [description, setDescription] = useState('')
  const [mode, setMode] = useState('especes')
  const [envoi, setEnvoi] = useState(false)

  // Filtres du journal
  const [recherche, setRecherche] = useState('')
  const [filtreCategorie, setFiltreCategorie] = useState('tous')
  const [filtreMode, setFiltreMode] = useState('tous')

  // Modale de confirmation pour suppression
  const [depenseASupprimer, setDepenseASupprimer] = useState(null)

  async function charger() {
    try {
      const [detail, lignes, feuille] = await Promise.all([
        api.get('/rapports/depenses/'),
        liste('/depenses/?page_size=200'),
        api.get('/rapports/cloture/'),
      ])
      setRapport(detail)
      setDepenses(lignes)
      setCaisse(feuille.caisse)
    } catch (echec) {
      setErreur(echec.message)
    }
  }

  useEffect(() => {
    charger()
  }, [])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 3500)
      return () => clearTimeout(timer)
    }
  }, [toast])



  const disponible = caisse?.montant_theorique ?? 0
  const montantNum = Number(montant) || 0
  const montantInvalide = montantNum <= 0
  const depasseCaisse = mode === 'especes' && caisse && montantNum > disponible

  async function ajouter(evenement) {
    evenement.preventDefault()
    setErreur('')

    if (montantInvalide) {
      setErreur('Veuillez saisir un montant supérieur à 0 FCFA.')
      return
    }

    if (depasseCaisse) {
      setErreur(
        `Le montant (${fcfa(montantNum)}) dépasse la somme disponible en caisse (${fcfa(disponible)}).`,
      )
      return
    }

    setEnvoi(true)
    try {
      await api.post('/depenses/', {
        categorie,
        montant: montantNum,
        description: description.trim() || CATEGORIES.find((c) => c.code === categorie)?.libelle || categorie,
        mode,
      })
      const descr = description.trim() || CATEGORIES.find((c) => c.code === categorie)?.libelle || categorie
      setToast(`Dépense « ${descr} » de ${fcfa(montantNum)} enregistrée avec succès !`)
      setMontant('')
      setDescription('')
      await charger()
    } catch (echec) {
      setErreur(echec.message)
    } finally {
      setEnvoi(false)
    }
  }

  async function confirmerSuppression() {
    if (!depenseASupprimer) return
    const id = depenseASupprimer.id
    const libelle = depenseASupprimer.description || depenseASupprimer.categorie_libelle
    const mnt = depenseASupprimer.montant
    setDepenseASupprimer(null)
    try {
      await api.delete(`/depenses/${id}/`)
      setToast(`Dépense « ${libelle} » de ${fcfa(mnt)} supprimée.`)
      await charger()
    } catch (echec) {
      setErreur(echec.message)
    }
  }



  const depensesFiltrees = useMemo(() => {
    return depenses.filter((item) => {
      const matchRecherche =
        !recherche ||
        (item.description && item.description.toLowerCase().includes(recherche.toLowerCase())) ||
        (item.categorie_libelle && item.categorie_libelle.toLowerCase().includes(recherche.toLowerCase()))
      const matchCat = filtreCategorie === 'tous' || item.categorie === filtreCategorie
      const matchMode = filtreMode === 'tous' || item.mode === filtreMode
      return matchRecherche && matchCat && matchMode
    })
  }, [depenses, recherche, filtreCategorie, filtreMode])

  const totalEspeces = useMemo(
    () => depenses.filter((d) => d.mode === 'especes').reduce((acc, d) => acc + Number(d.montant || 0), 0),
    [depenses],
  )

  const totalAutresModes = useMemo(
    () => depenses.filter((d) => d.mode !== 'especes').reduce((acc, d) => acc + Number(d.montant || 0), 0),
    [depenses],
  )

  const totalGeneral = useMemo(
    () => depenses.reduce((acc, d) => acc + Number(d.montant || 0), 0),
    [depenses],
  )

  if (!rapport) return <div className="etat">Chargement de la gestion des dépenses…</div>

  return (
    <>
      {/* Toast de notification flottant */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 999,
            background: 'var(--primaire, #2e7d32)',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            fontWeight: 600,
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span>{toast}</span>
        </div>
      )}

      {/* En-tête */}
      <div className="top">
        <div>
          <h1>Dépenses & Sorties de Caisse</h1>
          <div className="sub">{rapport.periode || 'Aujourd’hui'}</div>
        </div>
        {caisse ? (
          <div
            className={`pill ${disponible < 20000 ? 'alerte' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 700,
              borderRadius: 30,
            }}
          >
            <span>Espèces en caisse : {fcfa(disponible)}</span>
          </div>
        ) : (
          <div className="pill alerte" style={{ padding: '8px 16px', borderRadius: 30 }}>
            Caisse fermée
          </div>
        )}
      </div>

      {erreur && (
        <div className="erreur" style={{ marginBottom: 16, borderRadius: 10 }}>
          {erreur}
        </div>
      )}

      {/* KPI Cards / Cartes Synthèse */}
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
            Total Dépenses du jour
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--orange-dk, #e65100)', marginTop: 4 }}>
            {fcfa(totalGeneral)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--mut)', marginTop: 2 }}>
            {depenses.length} enregistrement{depenses.length > 1 ? 's' : ''}
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, rgba(198,40,40,0.05) 0%, rgba(198,40,40,0.01) 100%)',
            borderLeft: '4px solid #c62828',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--mut)', letterSpacing: 0.5 }}>
            Sorties en Espèces
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#c62828', marginTop: 4 }}>
            {fcfa(totalEspeces)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--mut)', marginTop: 2 }}>
            Impacte directement le tiroir-caisse
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, rgba(21,101,192,0.05) 0%, rgba(21,101,192,0.01) 100%)',
            borderLeft: '4px solid #1565c0',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--mut)', letterSpacing: 0.5 }}>
            Mobile Money & Banque
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1565c0', marginTop: 4 }}>
            {fcfa(totalAutresModes)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--mut)', marginTop: 2 }}>
            TMoney, Flooz ou Carte
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '16px 20px',
            background: disponible < 15000
              ? 'linear-gradient(135deg, rgba(229,62,62,0.08) 0%, rgba(229,62,62,0.02) 100%)'
              : 'linear-gradient(135deg, rgba(46,125,50,0.05) 0%, rgba(46,125,50,0.01) 100%)',
            borderLeft: `4px solid ${disponible < 15000 ? '#e53e3e' : '#2e7d32'}`,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--mut)', letterSpacing: 0.5 }}>
            Espèces Disponibles
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: disponible < 15000 ? '#e53e3e' : '#2e7d32',
              marginTop: 4,
            }}
          >
            {caisse ? fcfa(disponible) : 'Caisse fermée'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--mut)', marginTop: 2 }}>
            {caisse ? (disponible < 15000 ? 'Solde caisse bas' : 'Niveau de caisse satisfaisant') : 'Ouverture requise'}
          </div>
        </div>
      </div>

      {/* Barre de répartition par catégorie */}
      {rapport.par_categorie && rapport.par_categorie.length > 0 && (
        <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--mut)' }}>
              Répartition des dépenses
            </div>
            <div style={{ fontSize: 12, color: 'var(--mut)', fontWeight: 600 }}>
              {rapport.par_categorie.length} catégorie{rapport.par_categorie.length > 1 ? 's' : ''} active{rapport.par_categorie.length > 1 ? 's' : ''}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {rapport.par_categorie.map((ligne) => {
              const catDef = CATEGORIES.find((c) => c.code === ligne.categorie) || {
                couleur: 'var(--orange-dk)',
                fond: 'var(--fond-sub)',
              }
              const pct = totalGeneral > 0 ? Math.round((ligne.montant / totalGeneral) * 100) : 0

              return (
                <div
                  key={ligne.categorie}
                  onClick={() => setFiltreCategorie(filtreCategorie === ligne.categorie ? 'tous' : ligne.categorie)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 14px',
                    borderRadius: 10,
                    background: catDef.fond,
                    border: `1.5px solid ${filtreCategorie === ligne.categorie ? catDef.couleur : 'transparent'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    fontSize: 13,
                  }}
                  title="Cliquer pour filtrer"
                >
                  <span style={{ fontWeight: 600, color: 'var(--noir)' }}>{ligne.libelle}</span>
                  <strong style={{ color: catDef.couleur, marginLeft: 4 }}>{fcfa(ligne.montant)}</strong>
                  <span style={{ fontSize: 11, background: 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: 10, color: 'var(--mut)' }}>
                    {pct}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Disposition principale : Journal à gauche, Formulaire à droite */}
      <div className="pos" style={{ gridTemplateColumns: '1fr 380px', alignItems: 'start' }}>
        
        {/* --- COLONNE GAUCHE : Journal des dépenses --- */}
        <div>
          <div className="card">
            <div
              style={{
                display: 'flex',
                justify: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div>
                <h3 style={{ margin: 0 }}>Journal des opérations</h3>
                <div style={{ fontSize: 12, color: 'var(--mut)', marginTop: 2 }}>
                  {depensesFiltrees.length} dépense{depensesFiltrees.length > 1 ? 's' : ''} affichée{depensesFiltrees.length > 1 ? 's' : ''}
                </div>
              </div>

              {/* Barre de recherche */}
              <input
                className="champ"
                style={{ maxWidth: 220, padding: '7px 12px', fontSize: 13 }}
                placeholder="Rechercher..."
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
              />
            </div>

            {/* Filtres rapides par Catégorie et Mode */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, paddingBottom: 12, borderBottom: '1px dashed var(--bord)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mut)', alignSelf: 'center', marginRight: 4 }}>
                Filtre mode :
              </div>
              <button
                className={`segb ${filtreMode === 'tous' ? 'on' : ''}`}
                style={{ padding: '4px 10px', fontSize: 12 }}
                onClick={() => setFiltreMode('tous')}
              >
                Tous
              </button>
              {MODES.map((m) => (
                <button
                  key={m.code}
                  className={`segb ${filtreMode === m.code ? 'on' : ''}`}
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={() => setFiltreMode(filtreMode === m.code ? 'tous' : m.code)}
                >
                  {m.libelle}
                </button>
              ))}
              {(filtreCategorie !== 'tous' || filtreMode !== 'tous' || recherche) && (
                <button
                  className="btn btn-g"
                  style={{ padding: '4px 10px', fontSize: 12, marginLeft: 'auto' }}
                  onClick={() => {
                    setFiltreCategorie('tous')
                    setFiltreMode('tous')
                    setRecherche('')
                  }}
                >
                  Réinitialiser
                </button>
              )}
            </div>

            {/* Tableau des dépenses */}
            <table className="tbl">
              <thead>
                <tr>
                  <th>Description & Motif</th>
                  <th>Catégorie</th>
                  <th>Règlement</th>
                  <th style={{ textAlign: 'right' }}>Montant</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {depensesFiltrees.map((depense) => {
                  const catInfo = CATEGORIES.find((c) => c.code === depense.categorie)
                  const modeInfo = MODES.find((m) => m.code === depense.mode)

                  return (
                    <tr key={depense.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--noir)' }}>
                          {depense.description || depense.categorie_libelle}
                        </div>
                        {depense.cree_le && (
                          <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 2 }}>
                            {new Date(depense.cree_le).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          className="tag"
                          style={{
                            background: catInfo?.fond || 'var(--fond-sub)',
                            color: catInfo?.couleur || 'var(--noir)',
                            border: `1px solid ${catInfo?.couleur || 'var(--bord)'}`,
                            fontWeight: 600,
                            padding: '3px 8px',
                          }}
                        >
                          {depense.categorie_libelle}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: 13, color: 'var(--mut)' }}>
                          <span>{modeInfo?.libelle || depense.mode}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 15, color: 'var(--orange-dk)' }}>
                        {fcfa(depense.montant)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="x"
                          onClick={() => setDepenseASupprimer(depense)}
                          aria-label="Supprimer la dépense"
                          title="Supprimer cette dépense"
                          style={{ color: '#e53e3e', fontSize: 14 }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {depensesFiltrees.length === 0 && (
              <div className="etat" style={{ padding: '30px 20px', textAlign: 'center' }}>
                <div style={{ fontWeight: 600, color: 'var(--noir)' }}>Aucune dépense ne correspond aux critères.</div>
                <div style={{ fontSize: 13, color: 'var(--mut)', marginTop: 4 }}>
                  {depenses.length === 0
                    ? 'Aucune dépense enregistrée pour le moment.'
                    : 'Essayez de modifier votre recherche ou vos filtres.'}
                </div>
              </div>
            )}

            <div className="tot" style={{ marginTop: 16, paddingTop: 14, borderTop: '2px solid var(--bord)' }}>
              <span>Total des dépenses affichées</span>
              <span style={{ fontSize: 18, color: 'var(--orange-dk)' }}>
                {fcfa(depensesFiltrees.reduce((acc, d) => acc + Number(d.montant || 0), 0))}
              </span>
            </div>
          </div>
        </div>

        {/* --- COLONNE DROITE : Formulaire d'ajout --- */}
        <form className="card" onSubmit={ajouter} style={{ position: 'sticky', top: 20 }}>
          <h3 style={{ margin: '0 0 16px 0' }}>Nouvelle dépense</h3>

          {/* 1. Sélecteur visuel de catégorie */}
          <label className="lbl">1. Choisissez une catégorie</label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 8,
              marginBottom: 16,
            }}
          >
            {CATEGORIES.map((cat) => {
              const estSelectionnee = categorie === cat.code
              return (
                <div
                  key={cat.code}
                  onClick={() => setCategorie(cat.code)}
                  style={{
                    padding: '10px 10px',
                    borderRadius: 10,
                    background: estSelectionnee ? cat.fond : 'var(--bg-app, #fff)',
                    border: `2px solid ${estSelectionnee ? cat.couleur : 'var(--bord)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    boxShadow: estSelectionnee ? `0 2px 8px ${cat.couleur}22` : 'none',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: estSelectionnee ? 700 : 600,
                      color: estSelectionnee ? cat.couleur : 'var(--noir)',
                      lineHeight: 1.2,
                    }}
                  >
                    {cat.libelle}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Saisie du Montant */}
          <label className="lbl">2. Montant (FCFA)</label>
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <input
              className="champ"
              type="number"
              min="1"
              step="1"
              placeholder="ex: 5000"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              style={{
                fontSize: 18,
                fontWeight: 700,
                paddingRight: 60,
                borderColor: depasseCaisse ? '#e53e3e' : undefined,
              }}
              required
            />
            <span
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--mut)',
              }}
            >
              FCFA
            </span>
          </div>



          {/* Description */}
          <label className="lbl">3. Motif / Détails</label>
          <input
            className="champ"
            placeholder="ex: Achat produits, course marché..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ marginBottom: 16 }}
          />

          {/* Mode de règlement */}
          <label className="lbl">4. Mode de règlement</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
            {MODES.map((m) => {
              const estSelectionne = mode === m.code
              return (
                <div
                  key={m.code}
                  onClick={() => setMode(m.code)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: estSelectionne ? 'rgba(230,81,0,0.08)' : 'var(--bg-app, #fff)',
                    border: `1.5px solid ${estSelectionne ? 'var(--orange-dk)' : 'var(--bord)'}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontWeight: estSelectionne ? 700 : 500, color: estSelectionne ? 'var(--orange-dk)' : 'var(--noir)' }}>
                    {m.libelle}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Avertissement solde caisse insuffisant */}
          {depasseCaisse && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: 'rgba(229,62,62,0.1)',
                border: '1px solid rgba(229,62,62,0.3)',
                color: '#e53e3e',
                fontSize: 12,
                marginBottom: 16,
                lineHeight: 1.4,
                fontWeight: 600,
              }}
            >
              Refus imminent : La caisse ne contient que {fcfa(disponible)}. Changez le mode de paiement ou réduisez le montant.
            </div>
          )}

          {/* Bouton de validation */}
          <button
            className="btn btn-o"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: 15,
              fontWeight: 700,
              opacity: envoi || depasseCaisse ? 0.7 : 1,
            }}
            disabled={envoi || depasseCaisse}
          >
            {envoi ? 'Enregistrement…' : 'Enregistrer la dépense'}
          </button>

          <div
            style={{
              fontSize: 11,
              color: 'var(--mut)',
              marginTop: 12,
              lineHeight: 1.4,
              textAlign: 'center',
            }}
          >
            Les dépenses en espèces impactent directement la caisse physique.
          </div>
        </form>
      </div>

      {/* Modale de confirmation de suppression */}
      {depenseASupprimer && (
        <ModaleConfirmation
          titre="Confirmation de suppression"
          message={`Voulez-vous vraiment supprimer la dépense suivante ?`}
          manquants={[
            `Description : ${depenseASupprimer.description || depenseASupprimer.categorie_libelle}`,
            `Montant : ${fcfa(depenseASupprimer.montant)}`,
            `Règlement : ${MODES.find((m) => m.code === depenseASupprimer.mode)?.libelle || depenseASupprimer.mode}`,
          ]}
          labelOk="Supprimer la dépense"
          labelAnnuler="Annuler"
          onConfirme={confirmerSuppression}
          onAnnule={() => setDepenseASupprimer(null)}
        />
      )}
    </>
  )
}
