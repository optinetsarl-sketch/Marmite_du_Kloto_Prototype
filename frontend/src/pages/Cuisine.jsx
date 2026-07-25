import { useEffect, useState } from 'react'

import { api, liste } from '../api'
import BonCuisine from '../composants/BonCuisine'

export default function Cuisine() {
  const [commandes, setCommandes] = useState([])
  const [historique, setHistorique] = useState([])
  const [erreur, setErreur] = useState('')
  const [bon, setBon] = useState(null)

  async function charger() {
    try {
      setCommandes(await liste('/commandes/?pour_cuisine=1&page_size=100'))
      setHistorique(await liste('/commandes/?historique_cuisine=1&aujourdhui=1&page_size=50'))
      setErreur('')
    } catch (echec) {
      setErreur(echec.message)
    }
  }

  useEffect(() => {
    charger()
    // Le poste cuisine reste affiché en permanence : il se rafraîchit seul.
    const minuteur = setInterval(charger, 20000)
    return () => clearInterval(minuteur)
  }, [])

  async function marquerTermine(commande) {
    try {
      await api.post(`/commandes/${commande.id}/changer_statut/`, { statut: 'prete' })
      await charger()
    } catch (echec) {
      setErreur(echec.message)
    }
  }

  async function annuler(commande) {
    const cible = commande.table_numero ? `Table ${commande.table_numero}` : commande.client_nom || 'cette commande'
    if (!window.confirm(`Annuler ${cible} ? Les plats en préparation seront abandonnés.`)) return
    try {
      await api.post(`/commandes/${commande.id}/annuler/`, {})
      await charger()
    } catch (echec) {
      setErreur(echec.message)
    }
  }

  const enPreparation = commandes.filter((c) => c.statut === 'en_cuisine')
  const termines = commandes.filter((c) => c.statut === 'prete')

  return (
    <>
      <div className="top" style={{ gap: '10px', flexWrap: 'wrap' }}>
        <div>
          <h1>Cuisine — Bons de commande</h1>
          <div className="sub">
            Les bons ne portent pas de prix : ils servent à préparer, pas à facturer.
          </div>
        </div>
        <div className="pill">{enPreparation.length} en préparation</div>
        <div className="pill vert">{termines.length} prêts à servir</div>
        <div className="pill vert">{historique.length} clôturés aujourd'hui</div>
      </div>

      {erreur && <div className="erreur">{erreur}</div>}

      {commandes.length === 0 && (
        <div className="card">
          <div className="etat">
            Aucun bon en cours. Une commande arrive ici dès qu'elle est envoyée en cuisine.
          </div>
        </div>
      )}

      <div className="cuis-sec">
        <span className="cuis-point prep" />
        En préparation
        <span className="cuis-compte">{enPreparation.length}</span>
      </div>
      {enPreparation.length === 0 ? (
        <div className="etat" style={{ paddingBottom: 20 }}>Rien en préparation.</div>
      ) : (
        <div className="kts">
          {enPreparation.map((commande) => (
            <Bon
              key={commande.id}
              commande={commande}
              onImprimer={() => setBon(commande)}
              onTermine={() => marquerTermine(commande)}
              onAnnuler={() => annuler(commande)}
            />
          ))}
        </div>
      )}

      <div className="cuis-separateur" />

      <div className="cuis-sec">
        <span className="cuis-point pret" />
        Terminés — prêts à servir
        <span className="cuis-compte">{termines.length}</span>
      </div>
      {termines.length === 0 ? (
        <div className="etat">Aucun repas terminé pour l'instant.</div>
      ) : (
        <div className="kts">
          {termines.map((commande) => (
            <Bon key={commande.id} commande={commande} onImprimer={() => setBon(commande)} />
          ))}
        </div>
      )}

      <div className="cuis-historique">
        <div className="cuis-sec">
          <span className="cuis-point historique" />
          Historique des repas clôturés aujourd'hui
          <span className="cuis-compte">{historique.length}</span>
        </div>
        {historique.length === 0 ? (
          <div className="etat">Aucun repas clôturé aujourd'hui.</div>
        ) : (
          <div className="historique-liste">
            {historique.map((commande) => (
              <div className="hist-item" key={`hist-${commande.id}`}>
                <div className="hist-entete">
                  <span>{commande.table_numero ? `Table ${commande.table_numero}` : commande.client_nom || 'Sans table'}</span>
                  <span>{new Date(commande.cloturee_le).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="hist-corps">
                  <span>{commande.lignes.filter((ligne) => ligne.rayon === 'cuisine').reduce((somme, ligne) => somme + ligne.quantite, 0)} plats</span>
                  <span>{commande.total ? `${commande.total.toLocaleString('fr-FR')} F` : '—'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {bon && <BonCuisine commande={bon} onFerme={() => setBon(null)} />}
    </>
  )
}

function Bon({ commande, onImprimer, onTermine, onAnnuler }) {
  const plats = commande.lignes.filter((ligne) => ligne.rayon === 'cuisine')
  const nombre = plats.reduce((somme, ligne) => somme + ligne.quantite, 0)
  const termine = commande.statut === 'prete'
  const ouverte = new Date(commande.ouverte_le)

  const cible = commande.table_numero
    ? `Table ${commande.table_numero}`
    : commande.type === 'livraison'
      ? 'Livraison'
      : 'À emporter'

  return (
    <div className={`kt ${termine ? 'kt-prete' : ''}`}>
      <div className="kh">
        <span>
          {cible}
          {commande.origine === 'whatsapp' && ' · WhatsApp'}
        </span>
        <span>{ouverte.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div className="kt-t">{commande.client_nom || cible}</div>

      <div className="kt-corps">
        {plats.map((ligne) => (
          <div className="kl" key={ligne.id}>
            <span>
              {ligne.quantite} × {ligne.libelle}
            </span>
            {ligne.note && <em className="bon-note">{ligne.note}</em>}
          </div>
        ))}
        {commande.note && <div className="note">Note : {commande.note}</div>}
      </div>

      <div className="kt-pied">
        <div className="ktot">
          <span>Plats à faire</span>
          <span>{nombre}</span>
        </div>

        <div className={`st ${termine ? 'st-pret' : 'st-prep'}`}>
          {termine ? 'Terminé' : 'En préparation'}
        </div>

        {!termine && (
          <div className="kt-actions">
            <button className="btn btn-g" onClick={onImprimer}>
              Imprimer
            </button>
            <button className="btn btn-danger" onClick={onAnnuler}>
              Annuler
            </button>
            <button className="btn btn-o" onClick={onTermine}>
              Marquer terminé
            </button>
          </div>
        )}
        {termine && (
          <div className="kt-actions">
            <button className="btn btn-g" onClick={onImprimer}>
              Imprimer le bon
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
