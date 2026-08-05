import { useState } from 'react'
import Modale from './Modale'

const SAUCES_DISPONIBLES = [
  { id: 'chevre', nom: 'Chèvre', icone: '🐐' },
  { id: 'boyaux', nom: 'Boyaux', icone: '🍲' },
  { id: 'boeuf', nom: 'Boeuf', icone: '🥩' },
  { id: 'poulet', nom: 'Poulet', icone: '🍗' },
  { id: 'poisson_fume', nom: 'Poisson fumé', icone: '🐟' },
  { id: 'agouti', nom: 'Agouti', icone: '🦔' },
]

export default function ModalePrix({ produit, onValide, onFerme }) {
  const [prix, setPrix] = useState(produit.prix_standard ? String(produit.prix_standard) : '')
  const [sauceChoisie, setSauceChoisie] = useState('')
  const [prixSauce, setPrixSauce] = useState('')
  const [autreSauce, setAutreSauce] = useState('')
  const [noteInstruction, setNoteInstruction] = useState('')

  function valider(evenement) {
    evenement.preventDefault()
    const montantPlat = Number(prix)
    const montantSauce = Number(prixSauce) || 0
    if (montantPlat <= 0 && !produit.prix_standard) return

    const nomSauceFinal = sauceChoisie === '__autre__' ? autreSauce.trim() : sauceChoisie

    onValide({
      prixPlat: montantPlat || produit.prix_standard || 0,
      sauceNom: nomSauceFinal,
      prixSauce: montantSauce,
      note: noteInstruction.trim(),
    })
  }

  return (
    <Modale titre="Prix & Choix de la Sauce" sousTitre={produit.nom} onFerme={onFerme}>
      <form onSubmit={valider}>
        {/* 1. Saisie du prix du plat */}
        <div style={{ marginBottom: 16 }}>
          <label className="lbl" style={{ marginBottom: 6, display: 'block', fontWeight: 700 }}>
            💰 Prix du plat (FCFA) *
          </label>
          <input
            className="champ"
            style={{ fontSize: 18, fontWeight: 700, padding: '10px 14px' }}
            type="number"
            min="0"
            step="1"
            placeholder="ex: 500 ou 1000"
            value={prix}
            onChange={(e) => setPrix(e.target.value)}
            autoFocus
            required
          />
        </div>

        {/* 2. Sélection de la sauce */}
        <div style={{ marginBottom: 16 }}>
          <label className="lbl" style={{ marginBottom: 8, display: 'block', fontWeight: 700 }}>
            🥣 Choisir la Sauce (Cuisine)
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
            {SAUCES_DISPONIBLES.map((s) => {
              const active = sauceChoisie === s.nom
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`btn ${active ? 'btn-o' : 'btn-g'}`}
                  style={{
                    padding: '8px 6px',
                    fontSize: 12.5,
                    fontWeight: active ? 800 : 600,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3,
                  }}
                  onClick={() => setSauceChoisie(active ? '' : s.nom)}
                >
                  <span style={{ fontSize: 16 }}>{s.icone}</span>
                  <span>{s.nom}</span>
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className={`btn ${sauceChoisie === '__autre__' ? 'btn-o' : 'btn-g'}`}
              style={{ fontSize: 12, padding: '6px 10px' }}
              onClick={() => setSauceChoisie(sauceChoisie === '__autre__' ? '' : '__autre__')}
            >
              ✏️ Autre sauce…
            </button>
            {sauceChoisie && (
              <button
                type="button"
                className="btn btn-g"
                style={{ fontSize: 12, padding: '6px 10px', color: 'var(--mut)' }}
                onClick={() => {
                  setSauceChoisie('')
                  setPrixSauce('')
                }}
              >
                ✕ Sans sauce
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

        {/* 3. Prix de la sauce (si une sauce est sélectionnée) */}
        {Boolean(sauceChoisie) && (
          <div style={{ marginBottom: 16, background: '#fff5ec', border: '1px solid var(--orange)', padding: 12, borderRadius: 8 }}>
            <label className="lbl" style={{ marginBottom: 4, display: 'block', fontWeight: 700, color: 'var(--orange-dk)' }}>
              💵 Prix de la sauce « {sauceChoisie === '__autre__' ? (autreSauce || 'Autre') : sauceChoisie} » (FCFA)
            </label>
            <input
              className="champ"
              style={{ fontSize: 15, fontWeight: 700 }}
              type="number"
              min="0"
              step="1"
              placeholder="ex: 500 (0 si incluse)"
              value={prixSauce}
              onChange={(e) => setPrixSauce(e.target.value)}
            />
            <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 4 }}>
              Laissez vide ou 0 si la sauce est déjà incluse dans le prix du plat.
            </div>
          </div>
        )}

        {/* 4. Note additionnelle */}
        <div style={{ marginBottom: 16 }}>
          <label className="lbl" style={{ marginBottom: 4, display: 'block' }}>
            📝 Instructions cuisine (Optionnel)
          </label>
          <input
            className="champ"
            style={{ fontSize: 13 }}
            placeholder="ex: Piment à part, bien chaud…"
            value={noteInstruction}
            onChange={(e) => setNoteInstruction(e.target.value)}
          />
        </div>

        <div className="modal-act">
          <button type="button" className="btn btn-g" onClick={onFerme}>
            Annuler
          </button>
          <button className="btn btn-o" disabled={!(Number(prix) > 0)}>
            Valider &amp; Envoyer
          </button>
        </div>
      </form>
    </Modale>
  )
}
