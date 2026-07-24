import { useState } from 'react'

import Modale from './Modale'

// Les plats n'ont pas de prix standard : il est saisi à chaque commande (§9).
export default function ModalePrix({ produit, onValide, onFerme }) {
  const [prix, setPrix] = useState('')

  function valider(evenement) {
    evenement.preventDefault()
    const montant = Number(prix)
    if (montant > 0) onValide(montant)
  }

  return (
    <Modale titre="Prix du plat" sousTitre={produit.nom} onFerme={onFerme}>
      <form onSubmit={valider}>
        <input
          className="champ"
          style={{ fontSize: 17, marginBottom: 16 }}
          type="number"
          min="0"
          step="1"
          placeholder="Prix en FCFA"
          value={prix}
          onChange={(e) => setPrix(e.target.value)}
          autoFocus
        />
        <div className="modal-act">
          <button type="button" className="btn btn-g" onClick={onFerme}>
            Annuler
          </button>
          <button className="btn btn-o" disabled={!(Number(prix) > 0)}>
            Valider
          </button>
        </div>
      </form>
    </Modale>
  )
}
