import { useEffect, useState } from 'react'

import { api, fcfa } from '../api'

const TYPE_LABELS = {
  commande: 'Commande',
  depense: 'Dépense',
  depense_supprimee: 'Dépense supprimée',
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

  // Couleur de fond par type d'événement
  function rowStyle(evenement) {
    if (evenement.type === 'depense_supprimee') return { background: 'rgba(239,68,68,0.06)' }
    if (evenement.type === 'depense' && evenement.supprimee) return { background: 'rgba(239,68,68,0.03)' }
    return {}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong style={{ textDecoration: evenement.supprimee ? 'line-through' : 'none' }}>
              {TYPE_LABELS[evenement.type]}
            </strong>
            &nbsp;· {evenement.categorie_libelle}
            {evenement.supprimee && (
              <span style={{
                fontSize: '0.7rem',
                background: 'rgba(239,68,68,0.15)',
                color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 4,
                padding: '1px 6px',
                fontWeight: 700,
              }}>SUPPRIMÉE</span>
            )}
          </div>
          <div style={{ color: 'var(--mut)', textDecoration: evenement.supprimee ? 'line-through' : 'none' }}>
            {evenement.description || 'Sans description'} · {fcfa(evenement.montant)} · {evenement.mode}
          </div>
        </>
      )
    }

    if (evenement.type === 'depense_supprimee') {
      return (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: '0.75rem',
              background: 'rgba(239,68,68,0.15)',
              color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: 4,
              padding: '2px 7px',
              fontWeight: 700,
            }}>🗑 SUPPRESSION</span>
            <strong style={{ color: '#ef4444' }}>Dépense annulée</strong>
            &nbsp;· {evenement.categorie_libelle}
          </div>
          <div style={{ color: 'var(--mut)' }}>
            {evenement.description || 'Sans description'} · {fcfa(evenement.montant)} · {evenement.mode}
            {evenement.supprime_par ? ` · par ${evenement.supprime_par}` : ''}
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

  // Montant à afficher dans la colonne droite
  function renderMontant(evenement) {
    if (evenement.type === 'depense') {
      return (
        <span style={{
          color: evenement.supprimee ? '#9ca3af' : '#ef4444',
          textDecoration: evenement.supprimee ? 'line-through' : 'none',
        }}>
          -{fcfa(evenement.montant)}
        </span>
      )
    }
    if (evenement.type === 'depense_supprimee') {
      return <span style={{ color: '#ef4444', fontWeight: 700 }}>⊘ -{fcfa(evenement.montant)}</span>
    }
    if (evenement.type === 'commande' && evenement.total != null) {
      return fcfa(evenement.total)
    }
    return ''
  }

  // Nombre de dépenses supprimées du jour
  const nbSupprimees = historique?.depenses?.filter(d => d.supprimee).length ?? 0

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
              <div className="v">{historique.depenses.filter(d => !d.supprimee).length}</div>
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
                    <tr key={`${evenement.type}-${evenement.id}`} style={rowStyle(evenement)}>
                      <td data-titre>{formatTime(evenement.timestamp)}</td>
                      <td data-label="Détail">{renderEvenement(evenement)}</td>
                      <td data-label="Montant" style={{ textAlign: 'right', fontWeight: 600 }}>
                        {renderMontant(evenement)}
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
