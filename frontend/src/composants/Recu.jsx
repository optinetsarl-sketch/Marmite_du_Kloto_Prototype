import { createPortal } from 'react-dom'

import { fcfa, referenceCommande } from '../api'

const LIBELLES_MODE = {
  especes: 'espèces',
  tmoney: 'TMoney',
  flooz: 'Flooz',
  carte: 'carte bancaire',
}

/** Reçu (après paiement) ou addition (avant paiement, sans mention de règlement).
 *  Rendu dans <body> : la feuille @media print masque .app et ne laisse que ce document. */
export default function Recu({ commande, typeDocument = 'Reçu', onFerme }) {
  const horodatage = new Date(commande.cloturee_le || commande.ouverte_le)
  const cible = commande.table_numero
    ? `Table ${commande.table_numero}`
    : commande.livreur_nom
      ? `Livraison · ${commande.livreur_nom}`
      : 'À emporter'
  const monnaie = commande.monnaie_a_rendre || 0

  return createPortal(
    <div className="modal-ov" onMouseDown={(e) => e.target === e.currentTarget && onFerme()}>
      <div className="modal-bx rc-bx" id="recu">
        <div className="rc-paper">
          <div className="rc-head">
            <img src="/logo.jpg" alt="" />
            <div className="rc-nm">La Marmite du Kloto</div>
            <div className="rc-sb">Bar-Resto · Avedji, non loin de la Côte d'Or</div>
            <div className="rc-sb">Tél. +228 91 04 27 02</div>
          </div>

          <div className="rc-doc">{typeDocument}</div>
          <div className="rc-meta">
            <span style={{ fontWeight: 700 }}>
              N° Réf : {referenceCommande(commande)}
            </span>
            <span>
              {horodatage.toLocaleDateString('fr-FR')} ·{' '}
              {horodatage.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="rc-meta">
            <span>{cible}</span>
            {commande.client_nom && <span>Client : {commande.client_nom}</span>}
          </div>

          {(commande.client_telephone || commande.client_adresse || (commande.type === 'livraison' && commande.livreur_nom)) && (
            <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px dashed var(--bord)', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {commande.client_telephone && <div><strong>Tél :</strong> {commande.client_telephone}</div>}
              {commande.client_adresse && <div><strong>Adresse :</strong> {commande.client_adresse}</div>}
              {commande.type === 'livraison' && commande.livreur_nom && <div><strong>Livreur :</strong> {commande.livreur_nom}</div>}
            </div>
          )}

          <div className="rc-items">
            {commande.lignes.map((ligne) => (
              <div key={ligne.id || Math.random()} style={{ marginBottom: 6 }}>
                <div className="rc-line">
                  <span>
                    {ligne.quantite} × {ligne.libelle}
                  </span>
                  <span>{fcfa(ligne.montant)}</span>
                </div>
                {ligne.note && (
                  <div style={{ fontSize: 11, color: '#dd6b20', fontWeight: 600, paddingLeft: 16, marginTop: -2 }}>
                    {ligne.note}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="rc-total">
            <span>TOTAL</span>
            <span>{fcfa(commande.total)}</span>
          </div>

          {commande.paiements?.length > 0 && (
            <div className="rc-pay">
              Payé en{' '}
              {commande.paiements
                .map((paiement) => `${LIBELLES_MODE[paiement.mode]} ${fcfa(paiement.montant)}`)
                .join(' + ')}
              {monnaie > 0 && <div>Monnaie rendue : {fcfa(monnaie)}</div>}
            </div>
          )}

          <div className="rc-thanks">Merci de votre visite !</div>
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
