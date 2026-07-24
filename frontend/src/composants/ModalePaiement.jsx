import { useMemo, useState } from 'react'

import { fcfa } from '../api'
import Modale from './Modale'

const MODES = [
  { code: 'especes', libelle: 'Espèces' },
  { code: 'tmoney', libelle: 'TMoney' },
  { code: 'flooz', libelle: 'Flooz' },
  { code: 'carte', libelle: 'Carte' },
]

export default function ModalePaiement({ total, onEncaisse, onFerme }) {
  const [mode, setMode] = useState('especes')
  const [mixte, setMixte] = useState(false)
  const [recu, setRecu] = useState('')
  const [lignes, setLignes] = useState([
    { mode: 'especes', montant: '' },
    { mode: 'tmoney', montant: '' },
  ])
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)

  const reparti = useMemo(
    () => lignes.reduce((somme, ligne) => somme + (Number(ligne.montant) || 0), 0),
    [lignes],
  )
  const reste = total - reparti
  const monnaie = mode === 'especes' && recu ? Math.max(0, Number(recu) - total) : 0
  const valide = mixte ? reste <= 0 : mode !== 'especes' || !recu || Number(recu) >= total

  function majLigne(index, champ, valeur) {
    setLignes(lignes.map((ligne, i) => (i === index ? { ...ligne, [champ]: valeur } : ligne)))
  }

  async function encaisser() {
    setErreur('')
    setEnvoi(true)
    const paiements = mixte
      ? lignes
          .filter((ligne) => Number(ligne.montant) > 0)
          .map((ligne) => ({ mode: ligne.mode, montant: Number(ligne.montant) }))
      : [{ mode, montant: total, ...(mode === 'especes' && recu ? { montant_recu: Number(recu) } : {}) }]
    try {
      await onEncaisse(paiements)
    } catch (echec) {
      setErreur(echec.message)
      setEnvoi(false)
    }
  }

  return (
    <Modale titre="Encaissement" sousTitre={`Total à payer : ${fcfa(total)}`} largeur={400} onFerme={onFerme}>
      {erreur && <div className="erreur">{erreur}</div>}

      <div className="pays">
        {MODES.map((entree) => (
          <button
            key={entree.code}
            type="button"
            className={`pay ${!mixte && mode === entree.code ? 'on' : ''}`}
            onClick={() => {
              setMixte(false)
              setMode(entree.code)
            }}
          >
            {entree.libelle}
          </button>
        ))}
        <button type="button" className={`pay ${mixte ? 'on' : ''}`} onClick={() => setMixte(true)}>
          Mixte
        </button>
      </div>

      {!mixte && mode === 'especes' && (
        <>
          <label className="lbl">Montant reçu du client</label>
          <input
            className="champ"
            style={{ fontSize: 17 }}
            type="number"
            min={total}
            step="1"
            placeholder={`${total}`}
            value={recu}
            onChange={(e) => setRecu(e.target.value)}
            autoFocus
          />
          <div className="tot" style={{ fontSize: 15 }}>
            <span>Monnaie à rendre</span>
            <span style={{ color: monnaie > 0 ? 'var(--orange-dk)' : 'inherit' }}>{fcfa(monnaie)}</span>
          </div>
        </>
      )}

      {mixte && (
        <>
          {lignes.map((ligne, index) => (
            <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <select
                className="champ"
                style={{ flex: 1 }}
                value={ligne.mode}
                onChange={(e) => majLigne(index, 'mode', e.target.value)}
              >
                {MODES.map((entree) => (
                  <option key={entree.code} value={entree.code}>
                    {entree.libelle}
                  </option>
                ))}
              </select>
              <input
                className="champ"
                style={{ flex: 1 }}
                type="number"
                min="0"
                placeholder="Montant"
                value={ligne.montant}
                onChange={(e) => majLigne(index, 'montant', e.target.value)}
              />
            </div>
          ))}
          <button
            type="button"
            className="btn btn-g"
            style={{ width: '100%', marginBottom: 10 }}
            onClick={() => setLignes([...lignes, { mode: 'especes', montant: '' }])}
          >
            + Ajouter un mode
          </button>
          <div className="tot" style={{ fontSize: 15 }}>
            <span>{reste > 0 ? 'Reste à répartir' : 'Trop-perçu'}</span>
            <span style={{ color: reste > 0 ? 'var(--rouge)' : 'var(--vert)' }}>
              {fcfa(Math.abs(reste))}
            </span>
          </div>
        </>
      )}

      <div className="modal-act" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-g" onClick={onFerme}>
          Annuler
        </button>
        <button className="btn btn-o" onClick={encaisser} disabled={!valide || envoi}>
          {envoi ? 'Encaissement…' : 'Encaisser'}
        </button>
      </div>
    </Modale>
  )
}
