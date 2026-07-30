import { createPortal } from 'react-dom'

/** Bon de commande cuisine (§6) — délibérément SANS PRIX.
 *  Il sert à préparer, pas à facturer : plats, quantités, notes. Rien d'autre.
 *  Les boissons sont écartées, elles ne passent pas par la cuisine. */
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
            Réf. Bon N° : BC-{commande.numero_recu || (commande.id ? String(commande.id).slice(-4) : '001')}
          </div>

          <div className="rc-meta">
            <span style={{ fontWeight: 700, color: 'var(--noir)' }}>{cible}</span>
            <span>
              {ouverte.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {commande.origine === 'whatsapp' && <div className="rc-meta">Commande WhatsApp</div>}

          <div className="rc-items">
            {plats.map((ligne) => (
              <div className="bon-line" key={ligne.id}>
                <span className="bon-qte">{ligne.quantite}</span>
                <span>
                  {ligne.libelle}
                  {ligne.note && <em className="bon-note"> — {ligne.note}</em>}
                </span>
              </div>
            ))}
          </div>

          {commande.note && <div className="bon-note-globale">Note : {commande.note}</div>}

          <div className="rc-total">
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
