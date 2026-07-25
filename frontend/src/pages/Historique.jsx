import { useEffect, useState } from 'react'

import { api, fcfa } from '../api'

const TYPE_LABELS = {
  commande: 'Commande',
  depense: 'Dépense',
  mouvement_stock: 'Stock',
}

const STATUTS = {
  ouverte: 'Ouverte',
  en_cuisine: 'En cuisine',
  prete: 'Prête',
  en_route: 'En route',
  livree: 'Livrée',
  payee: 'Payée',
  annulee: 'Annulée',
}

export default function Historique() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [historique, setHistorique] = useState(null)
  const [erreur, setErreur] = useState('')
  const [chargement, setChargement] = useState(false)

  useEffect(() => {
    charger()
  }, [date])

  async function charger() {
    setChargement(true)
    try {
      setHistorique(await api.get(`/rapports/historique/?date=${date}`))
      setErreur('')
    } catch (echec) {
      setErreur(echec.message)
    } finally {
      setChargement(false)
    }
  }

  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function renderEvenement(evenement) {
    if (evenement.type === 'commande') {
      return (
        <>
          <div>
            <strong>{TYPE_LABELS[evenement.type]}</strong> · {evenement.type_libelle}
            {evenement.table_numero ? ` · Table ${evenement.table_numero}` : ''}
            {evenement.client_nom ? ` · ${evenement.client_nom}` : ''}
          </div>
          <div style={{ color: 'var(--mut)' }}>
            Statut : {STATUTS[evenement.statut] || evenement.statut}
            {evenement.livreur_nom ? ` · Livreur ${evenement.livreur_nom}` : ''}
            {evenement.total != null ? ` · ${fcfa(evenement.total)}` : ''}
          </div>
        </>
      )
    }

    if (evenement.type === 'depense') {
      return (
        <>
          <div>
            <strong>{TYPE_LABELS[evenement.type]}</strong> · {evenement.categorie_libelle}
          </div>
          <div style={{ color: 'var(--mut)' }}>
            {evenement.description || 'Sans description'} · {fcfa(evenement.montant)} · {evenement.mode}
          </div>
        </>
      )
    }

    if (evenement.type === 'mouvement_stock') {
      return (
        <>
          <div>
            <strong>{TYPE_LABELS[evenement.type]}</strong> · {evenement.motif_libelle}
          </div>
          <div style={{ color: 'var(--mut)' }}>
            {evenement.produit} · {evenement.quantite >= 0 ? `+${evenement.quantite}` : evenement.quantite}
            {evenement.fournisseur_nom ? ` · ${evenement.fournisseur_nom}` : ''}
            {evenement.commentaire ? ` · ${evenement.commentaire}` : ''}
          </div>
        </>
      )
    }

    return <div>{JSON.stringify(evenement)}</div>
  }

  return (
    <>
      <div className="top" style={{ gap: '10px', flexWrap: 'wrap' }}>
        <div>
          <h1>Historique des opérations</h1>
          <div className="sub">
            Journal des commandes, dépenses et mouvements de stock par date.
          </div>
        </div>
        <div className="seg" style={{ minWidth: 240 }}>
          <label style={{ display: 'block', marginBottom: 6, color: 'var(--mut)' }}>
            Date
          </label>
          <input
            className="champ auto"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="pill">{historique?.evenements?.length ?? 0} événements</div>
      </div>

      {erreur && <div className="erreur">{erreur}</div>}
      {chargement && <div className="etat">Chargement…</div>}

      {historique && (
        <>
          <div className="stats" style={{ marginBottom: 18 }}>
            <div className="stat wht">
              <div className="l">Commandes</div>
              <div className="v">{historique.commandes.length}</div>
            </div>
            <div className="stat wht">
              <div className="l">Dépenses</div>
              <div className="v">{historique.depenses.length}</div>
            </div>
            <div className="stat wht">
              <div className="l">Mouvements</div>
              <div className="v">{historique.mouvements_stock.length}</div>
            </div>
          </div>

          {historique.evenements.length === 0 ? (
            <div className="card">
              <div className="etat">Aucun événement pour cette date.</div>
            </div>
          ) : (
            <div className="card">
              <h3>Événements</h3>
              <table className="grid cartes">
                <thead>
                  <tr>
                    <th>Heure</th>
                    <th>Détail</th>
                    <th style={{ textAlign: 'right' }}>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {historique.evenements.map((evenement) => (
                    <tr key={`${evenement.type}-${evenement.id}`}>
                      <td data-titre>{formatTime(evenement.timestamp)}</td>
                      <td data-label="Détail">{renderEvenement(evenement)}</td>
                      <td data-label="Montant" style={{ textAlign: 'right', fontWeight: 600 }}>
                        {evenement.type === 'depense'
                          ? `-${fcfa(evenement.montant)}`
                          : evenement.type === 'commande' && evenement.total != null
                          ? fcfa(evenement.total)
                          : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  )
}
