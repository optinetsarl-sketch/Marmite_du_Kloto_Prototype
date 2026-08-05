import { createPortal } from 'react-dom'

import { fcfa, referenceCommande } from '../api'

/** Bon de livraison (§6) — avec les prix, l'adresse, le client, le livreur,
 *  et surtout le MONTANT À ENCAISSER, mis en avant : c'est la seule chose que
 *  le livreur doit retenir en arrivant chez le client. */
export default function BonLivraison({ commande, onFerme }) {
  const ouverte = new Date(commande.ouverte_le)

  return createPortal(
    <div className="modal-ov" onMouseDown={(e) => e.target === e.currentTarget && onFerme()}>
      <div className="modal-bx rc-bx" id="recu">
        <div className="rc-paper">
          <div className="rc-head">
            <img src="/logo.jpg" alt="" />
            <div className="rc-nm">Bon de livraison</div>
            <div className="rc-sb">La Marmite du Kloto · Bar-Resto</div>
            <div className="rc-sb">Tél. +228 91 04 27 02</div>
            <div style={{ fontSize: 13, color: 'var(--mut)', marginTop: 4, fontWeight: 600 }}>
              Heure de commande : {ouverte.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2, color: 'var(--orange-dk)' }}>
              N° Réf : {referenceCommande(commande)}
            </div>
          </div>

          <div className="bon-champs">
            <Champ libelle="Client" valeur={commande.client_nom || 'Non spécifié'} />
            <Champ libelle="Téléphone" valeur={commande.client_telephone || 'Non renseigné'} />
            <Champ libelle="Adresse" valeur={commande.client_adresse || 'Non renseignée'} />
            <Champ libelle="Livreur" valeur={commande.livreur_nom || 'Non assigné'} />
          </div>

          <div className="rc-items">
            {commande.lignes.map((ligne) => (
              <div className="rc-line" key={ligne.id}>
                <span>
                  {ligne.quantite} × {ligne.libelle}
                </span>
                <span>{fcfa(ligne.montant)}</span>
              </div>
            ))}
          </div>

          {commande.note && <div className="bon-note-globale">Note : {commande.note}</div>}

          <div className="bon-encaisser">
            <span>MONTANT À ENCAISSER</span>
            <span>{fcfa(commande.total)}</span>
          </div>

          <div className="bon-signature">Reçu par le client : _____________________</div>
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

function Champ({ libelle, valeur }) {
  return (
    <div className="bon-champ">
      <span>{libelle}</span>
      <strong>{valeur}</strong>
    </div>
  )
}
