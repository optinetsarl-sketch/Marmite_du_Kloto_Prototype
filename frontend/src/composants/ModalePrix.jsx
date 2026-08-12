import { useEffect, useState } from 'react'
import Modale from './Modale'

const SAUCES_DISPONIBLES = [
  { id: 'chevre', nom: 'Chèvre' },
  { id: 'boyaux', nom: 'Boyaux' },
  { id: 'boeuf', nom: 'Boeuf' },
  { id: 'poulet', nom: 'Poulet' },
  { id: 'poisson_fume', nom: 'Poisson fumé' },
  { id: 'agouti', nom: 'Agouti' },
  { id: 'gombo', nom: 'Gombo' },
  { id: 'arachide', nom: 'Arachide' },
]

const PLATS_DISPONIBLES = [
  { id: 'fufu', nom: 'Fufu' },
  { id: 'riz', nom: 'Riz' },
  { id: 'akoume', nom: 'Akoumé' },
  { id: 'pate', nom: 'Pâte' },
  { id: 'igname_pilee', nom: 'Igname pilée' },
  { id: 'pinon', nom: 'Pinon' },
  { id: 'ablo', nom: 'Ablo' },
  { id: 'djenkoume', nom: 'Djenkoumé' },
]

/* ─────────────────────────────────────────────────────────────
   TYPES DE PORTION (Sans icônes)
   ───────────────────────────────────────────────────────────── */
const PORTIONS = [
  {
    id: 'complet',
    label: 'Plat complet',
    description: 'Plat + Sauce incluse',
    couleur: '#dd6b20',
    fond: '#fff5ec',
    bordure: '#dd6b20',
  },
  {
    id: 'sauce_seule',
    label: 'Sauce seule',
    description: 'Sans accompagnement',
    couleur: '#2b6cb0',
    fond: '#ebf8ff',
    bordure: '#2b6cb0',
  },
  {
    id: 'plat_seul',
    label: 'Plat seul',
    description: 'Sans sauce',
    couleur: '#38a169',
    fond: '#f0fff4',
    bordure: '#38a169',
  },
]

export default function ModalePrix({
  produit,
  initialTypePortion = 'complet',
  uniquementSeuls = false,
  onValide,
  onFerme,
}) {
  const isSpecial = uniquementSeuls || Boolean(produit?.isSpecialPortion)

  // Si modale spéciale (Plat seul / Sauce seule), n'afficher QUE Plat seul et Sauce seule
  const portionsDisponibles = isSpecial
    ? PORTIONS.filter((p) => p.id === 'plat_seul' || p.id === 'sauce_seule')
    : PORTIONS

  const [typePortion, setTypePortion] = useState(() => {
    if (initialTypePortion && portionsDisponibles.some((p) => p.id === initialTypePortion)) {
      return initialTypePortion
    }
    return isSpecial ? 'sauce_seule' : 'complet'
  })

  const [prix, setPrix] = useState(produit.prix_standard ? String(produit.prix_standard) : '')
  const [sauceChoisie, setSauceChoisie] = useState('')
  const [autreSauce, setAutreSauce] = useState('')
  const [platChoisi, setPlatChoisi] = useState('')
  const [autrePlat, setAutrePlat] = useState('')
  const [noteInstruction, setNoteInstruction] = useState('')

  // Quand on change le type de portion, adapter l'affichage
  const portionActive = PORTIONS.find((p) => p.id === typePortion)
  const necessite_sauce = typePortion === 'complet' || typePortion === 'sauce_seule'

  // Réinitialiser les choix secondaires selon le type de portion
  useEffect(() => {
    if (typePortion === 'plat_seul') {
      setSauceChoisie('')
      setAutreSauce('')
    } else {
      setPlatChoisi('')
      setAutrePlat('')
    }
  }, [typePortion])

  function valider(evenement) {
    evenement.preventDefault()
    const montantSaisi = Number(prix)
    if (montantSaisi <= 0) return

    const nomSauceFinal =
      sauceChoisie === '__autre__' ? autreSauce.trim() : sauceChoisie
    const nomPlatFinal =
      platChoisi === '__autre__' ? autrePlat.trim() : platChoisi

    // Construire la note finale
    let noteFinale = noteInstruction.trim()

    if (typePortion === 'plat_seul') {
      if (nomPlatFinal) {
        const platInfo = `Plat ${nomPlatFinal}`
        noteFinale = noteFinale ? `${platInfo} · ${noteFinale}` : platInfo
      } else if (!produit?.isSpecialPortion) {
        noteFinale = noteFinale ? `Plat seul · ${noteFinale}` : 'Plat seul'
      }
    } else if (typePortion === 'sauce_seule') {
      if (nomSauceFinal) {
        const sauceInfo = `Sauce ${nomSauceFinal}`
        noteFinale = noteFinale ? `${sauceInfo} · ${noteFinale}` : sauceInfo
      } else if (!produit?.isSpecialPortion) {
        noteFinale = noteFinale ? `Sauce seule · ${noteFinale}` : 'Sauce seule'
      }
    } else if (typePortion === 'complet' && nomSauceFinal) {
      const sauceInfo = `Sauce ${nomSauceFinal}`
      noteFinale = noteFinale ? `${sauceInfo} · ${noteFinale}` : sauceInfo
    }

    onValide({
      prixPlat: montantSaisi,
      sauceNom: necessite_sauce ? nomSauceFinal : '',
      platNom: typePortion === 'plat_seul' ? nomPlatFinal : '',
      prixSauce: 0,
      note: noteFinale,
      typePortion,
    })
  }

  const portionInfo = portionActive || PORTIONS[0]

  return (
    <Modale titre="Type de portion & Prix" sousTitre={produit.nom} onFerme={onFerme}>
      <form onSubmit={valider}>

        {/* ── 1. Choix du type de portion ── */}
        <div style={{ marginBottom: 18 }}>
          <label className="lbl" style={{ marginBottom: 10, display: 'block', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Le client veut…
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${portionsDisponibles.length}, 1fr)`, gap: 8 }}>
            {portionsDisponibles.map((portion) => {
              const active = typePortion === portion.id
              return (
                <button
                  key={portion.id}
                  type="button"
                  onClick={() => setTypePortion(portion.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '16px 8px',
                    borderRadius: 10,
                    border: `2px solid ${active ? portion.bordure : '#e2e8f0'}`,
                    background: active ? portion.fond : '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: active ? `0 0 0 3px ${portion.couleur}22` : 'none',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: active ? 800 : 700, color: active ? portion.couleur : '#4a5568', textAlign: 'center', lineHeight: 1.2 }}>
                    {portion.label}
                  </span>
                  <span style={{ fontSize: 10, color: active ? portion.couleur : '#a0aec0', textAlign: 'center' }}>
                    {portion.description}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── 2. Prix ── */}
        <div style={{ marginBottom: 16 }}>
          <label className="lbl" style={{ marginBottom: 6, display: 'block', fontWeight: 700 }}>
            Prix (FCFA) *
          </label>
          <input
            className="champ"
            style={{
              fontSize: 20,
              fontWeight: 700,
              padding: '10px 14px',
              borderColor: portionInfo.bordure,
              outline: 'none',
            }}
            type="number"
            min="1"
            step="1"
            placeholder="ex: 500 ou 1500"
            value={prix}
            onChange={(e) => setPrix(e.target.value)}
            autoFocus
          />
        </div>

        {/* ── 3. Sélection de la sauce (si sauce_seule ou complet) ── */}
        {necessite_sauce && (
          <div style={{ marginBottom: 16 }}>
            <label className="lbl" style={{ marginBottom: 8, display: 'block', fontWeight: 700 }}>
              {typePortion === 'sauce_seule' ? 'Type de sauce vendue *' : 'Sauce du plat (optionnel)'}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7, marginBottom: 8 }}>
              {SAUCES_DISPONIBLES.map((s) => {
                const active = sauceChoisie === s.nom
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`btn ${active ? 'btn-o' : 'btn-g'}`}
                    style={{
                      padding: '9px 5px',
                      fontSize: 12,
                      fontWeight: active ? 800 : 600,
                      textAlign: 'center',
                      border: active ? '2px solid var(--orange)' : '2px solid transparent',
                    }}
                    onClick={() => setSauceChoisie(active ? '' : s.nom)}
                  >
                    {s.nom}
                  </button>
                )
              })}
            </div>

            {/* Autre sauce + effacer */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                className={`btn ${sauceChoisie === '__autre__' ? 'btn-o' : 'btn-g'}`}
                style={{ fontSize: 12, padding: '6px 10px' }}
                onClick={() => setSauceChoisie(sauceChoisie === '__autre__' ? '' : '__autre__')}
              >
                Autre sauce…
              </button>
              {sauceChoisie && (
                <button
                  type="button"
                  className="btn btn-g"
                  style={{ fontSize: 12, padding: '6px 10px', color: 'var(--mut)' }}
                  onClick={() => setSauceChoisie('')}
                >
                  Sans sauce
                </button>
              )}
            </div>

            {sauceChoisie === '__autre__' && (
              <input
                className="champ"
                style={{ marginTop: 8, fontSize: 13 }}
                placeholder="Saisir le nom de la sauce…"
                value={autreSauce}
                onChange={(e) => setAutreSauce(e.target.value)}
                autoFocus
              />
            )}
          </div>
        )}

        {/* ── 4. Sélection du plat (si Plat seul) ── */}
        {typePortion === 'plat_seul' && (
          <div style={{ marginBottom: 16 }}>
            <label className="lbl" style={{ marginBottom: 8, display: 'block', fontWeight: 700 }}>
              Type de plat vendu (Optionnel)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7, marginBottom: 8 }}>
              {PLATS_DISPONIBLES.map((p) => {
                const active = platChoisi === p.nom
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`btn ${active ? 'btn-o' : 'btn-g'}`}
                    style={{
                      padding: '9px 5px',
                      fontSize: 12,
                      fontWeight: active ? 800 : 600,
                      textAlign: 'center',
                      border: active ? '2px solid #38a169' : '2px solid transparent',
                      background: active ? '#f0fff4' : '',
                      color: active ? '#276749' : '',
                    }}
                    onClick={() => setPlatChoisi(active ? '' : p.nom)}
                  >
                    {p.nom}
                  </button>
                )
              })}
            </div>

            {/* Autre plat + effacer */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                className={`btn ${platChoisi === '__autre__' ? 'btn-o' : 'btn-g'}`}
                style={{ fontSize: 12, padding: '6px 10px' }}
                onClick={() => setPlatChoisi(platChoisi === '__autre__' ? '' : '__autre__')}
              >
                Autre plat…
              </button>
              {platChoisi && (
                <button
                  type="button"
                  className="btn btn-g"
                  style={{ fontSize: 12, padding: '6px 10px', color: 'var(--mut)' }}
                  onClick={() => setPlatChoisi('')}
                >
                  Effacer
                </button>
              )}
            </div>

            {platChoisi === '__autre__' && (
              <input
                className="champ"
                style={{ marginTop: 8, fontSize: 13 }}
                placeholder="Saisir le nom du plat…"
                value={autrePlat}
                onChange={(e) => setAutrePlat(e.target.value)}
                autoFocus
              />
            )}
          </div>
        )}

        {/* ── 4. Note cuisine ── */}
        <div style={{ marginBottom: 16 }}>
          <label className="lbl" style={{ marginBottom: 4, display: 'block' }}>
            Instructions cuisine (Optionnel)
          </label>
          <input
            className="champ"
            style={{ fontSize: 13 }}
            placeholder="ex: Piment à part, bien chaud, peu salé…"
            value={noteInstruction}
            onChange={(e) => setNoteInstruction(e.target.value)}
          />
        </div>

        {/* ── Résumé avant validation ── */}
        {Number(prix) > 0 && (
          <div style={{ marginBottom: 14, padding: '10px 14px', background: portionInfo.fond, border: `1px solid ${portionInfo.bordure}`, borderRadius: 8 }}>
            <div style={{ fontWeight: 700, color: portionInfo.couleur, fontSize: 14 }}>
              {portionInfo.label}
              {sauceChoisie && necessite_sauce ? ` · ${sauceChoisie === '__autre__' ? (autreSauce || 'Autre sauce') : sauceChoisie}` : ''}
              {' → '}<span style={{ fontSize: 16 }}>{Number(prix).toLocaleString('fr-FR')} F</span>
            </div>
            {noteInstruction && (
              <div style={{ fontSize: 12, color: portionInfo.couleur, marginTop: 3 }}>
                Note : {noteInstruction}
              </div>
            )}
          </div>
        )}

        <div className="modal-act">
          <button type="button" className="btn btn-g" onClick={onFerme}>
            Annuler
          </button>
          <button
            className="btn btn-o"
            disabled={!(Number(prix) > 0) || (typePortion === 'sauce_seule' && !sauceChoisie && !autreSauce.trim())}
            style={{ background: portionInfo.couleur, borderColor: portionInfo.couleur }}
          >
            Ajouter au panier
          </button>
        </div>
      </form>
    </Modale>
  )
}
