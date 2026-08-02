import { createPortal } from 'react-dom'

import { fcfa, referenceCommande } from '../api'

/** Bon de commande cuisine avec prix unitaires
 *  permettant à l'équipe cuisine de choisir les portions et mesures correspondantes. */
export default function BonCuisine({ commande, onFerme }) {
  const plats = commande.lignes.filter((ligne) => ligne.rayon === 'cuisine')
  const nombre = plats.reduce((somme, ligne) => somme + ligne.quantite, 0)
  const ouverte = new Date(commande.ouverte_le)
  const cible = commande.table_numero
    ? `Table ${commande.table_numero}`
    : commande.type === 'livraison'
      ? `Livraison · ${commande.client_nom || 'client'}`
      : `À emporter · ${commande.client_nom || ''}`

  return createPortal(
    <div className="modal-ov" onMouseDown={(e) => e.target === e.currentTarget && onFerme()}>
      <div className="modal-bx rc-bx" id="recu">
        <div className="rc-paper">
          <div className="rc-head">
            <img src="/logo.jpg" alt="" />
            <div className="rc-nm">La Marmite du Kloto</div>
            <div className="rc-sb">Cuisine</div>
          </div>

          <div className="rc-doc">BON DE CUISINE</div>
          <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--orange-dk)', marginBottom: 6 }}>
            Réf. Bon N° : {referenceCommande(commande)}
          </div>

          <div className="rc-meta">
            <span style={{ fontWeight: 700, color: 'var(--noir)' }}>{cible}</span>
            <span>
              {ouverte.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {commande.origine === 'whatsapp' && <div className="rc-meta">Commande WhatsApp</div>}

          <div className="rc-items" style={{ marginTop: 12, marginBottom: 12 }}>
            {plats.map((ligne) => {
              const prixU =
                ligne.prix_unitaire ||
                (ligne.montant && ligne.quantite ? Math.round(ligne.montant / ligne.quantite) : 0)

              return (
                <div
                  className="bon-line"
                  key={ligne.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: 8,
                    paddingBottom: 4,
                    borderBottom: '1px dashed #eee',
                  }}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    <span className="bon-qte">{ligne.quantite}</span>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{ligne.libelle}</span>
                      {ligne.note && <em className="bon-note" style={{ display: 'block', marginTop: 2 }}> — {ligne.note}</em>}
                    </div>
                  </div>
                  <span
                    style={{
                      fontWeight: 800,
                      color: 'var(--orange-dk)',
                      fontSize: 13,
                      whiteSpace: 'nowrap',
                      marginLeft: 12,
                    }}
                  >
                    {prixU > 0 ? fcfa(prixU) : '—'}
                  </span>
                </div>
              )
            })}
          </div>

          {commande.note && <div className="bon-note-globale">Note : {commande.note}</div>}

          <div className="rc-total" style={{ borderTop: '1px dashed var(--bord)', paddingTop: 8, marginTop: 10 }}>
            <span>Plats à faire</span>
            <span>{nombre}</span>
          </div>
        </div>

        <div className="modal-act rc-actions">
          <button className="btn btn-g" onClick={onFerme}>
            Fermer
          </button>
          <button className="btn btn-o" onClick={() => window.print()}>
            Imprimer
          </button>
        </div>
      </div>
    </div>,
    window.document.body,
  )
}
