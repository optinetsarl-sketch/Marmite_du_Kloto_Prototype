import { useEffect, useState } from 'react'

import { api, liste } from '../api'
import BonCuisine from '../composants/BonCuisine'
import Modale from '../composants/Modale'

export default function Cuisine() {
  const [commandes, setCommandes] = useState([])
  const [historique, setHistorique] = useState([])
  const [erreur, setErreur] = useState('')
  const [bon, setBon] = useState(null)
  const [modalMenu, setModalMenu] = useState(false)

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
      <div className="top" style={{ gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <h1>Cuisine — Bons de commande</h1>
          <div className="sub">
            Les bons ne portent pas de prix : ils servent à préparer, pas à facturer.
          </div>
        </div>
        <div className="pill">{enPreparation.length} en préparation</div>
        <div className="pill vert">{termines.length} prêts à servir</div>
        <div className="pill vert">{historique.length} clôturés aujourd'hui</div>
        <button
          className="btn btn-o"
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
          onClick={() => setModalMenu(true)}
        >
          <span>🍳</span>
          <span>Nouveaux plats & Disponibilité</span>
        </button>
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
      {modalMenu && <ModalGestionMenu onFerme={() => setModalMenu(false)} />}
    </>
  )
}

function ModalGestionMenu({ onFerme }) {
  const [onglet, setOnglet] = useState('ajouter')
  const [categories, setCategories] = useState([])
  const [produits, setProduits] = useState([])
  const [erreur, setErreur] = useState('')
  const [succes, setSucces] = useState('')
  const [recherche, setRecherche] = useState('')
  const [envoi, setEnvoi] = useState(false)

  // Formulaire d'ajout
  const [nom, setNom] = useState('')
  const [prix, setPrix] = useState('')
  const [prixLibre, setPrixLibre] = useState(false)
  const [categorie, setCategorie] = useState('')
  const [actif, setActif] = useState(true)

  async function chargerDonnees() {
    try {
      const cats = await liste('/categories/?page_size=100')
      const prods = await liste('/produits/?rayon=cuisine&page_size=300')
      setCategories(cats)
      setProduits(prods)
      if (cats.length > 0 && !categorie) {
        const catCuisine = cats.find((c) => c.rayon === 'cuisine') || cats[0]
        setCategorie(catCuisine.id)
      }
    } catch (err) {
      setErreur(err.message)
    }
  }

  useEffect(() => {
    chargerDonnees()
  }, [])

  async function ajouterPlat(e) {
    e.preventDefault()
    setErreur('')
    setSucces('')
    setEnvoi(true)

    try {
      const payload = {
        nom: nom.trim(),
        categorie: categorie || (categories[0] ? categories[0].id : null),
        prix_standard: prixLibre ? null : Number(prix) || 0,
        prix_libre: prixLibre,
        gere_stock: false,
        actif: Boolean(actif),
      }

      await api.post('/produits/', payload)
      setSucces(`Le plat "${nom}" a été ajouté au menu avec succès !`)
      setNom('')
      setPrix('')
      setPrixLibre(false)
      await chargerDonnees()
    } catch (err) {
      setErreur(err.message || 'Erreur lors de la création du plat')
    } finally {
      setEnvoi(false)
    }
  }

  async function basculerDisponibilite(produit) {
    try {
      await api.patch(`/produits/${produit.id}/`, { actif: !produit.actif })
      await chargerDonnees()
    } catch (err) {
      setErreur(err.message)
    }
  }

  const platsFiltres = produits.filter((p) =>
    p.nom.toLowerCase().includes(recherche.toLowerCase())
  )

  return (
    <Modale titre="🍳 Gestion des Plats & Disponibilité en Cuisine" largeur={620} onFerme={onFerme}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <button
          type="button"
          className={`btn ${onglet === 'ajouter' ? 'btn-o' : 'btn-g'}`}
          onClick={() => setOnglet('ajouter')}
        >
          ➕ Ajouter un nouveau plat
        </button>
        <button
          type="button"
          className={`btn ${onglet === 'disponibilite' ? 'btn-o' : 'btn-g'}`}
          onClick={() => setOnglet('disponibilite')}
        >
          📋 Plats existants ({produits.length})
        </button>
      </div>

      {erreur && <div className="erreur" style={{ marginBottom: 12 }}>{erreur}</div>}
      {succes && <div className="succes" style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(76, 175, 80, 0.12)', color: '#2e7d32', borderRadius: 6, fontWeight: 500 }}>{succes}</div>}

      {onglet === 'ajouter' && (
        <form onSubmit={ajouterPlat}>
          <label className="lbl">Nom du nouveau plat</label>
          <input
            className="champ"
            placeholder="ex: Fufu Sauce Graine, Poulet Yassa, Atassi..."
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            required
            autoFocus
          />

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="lbl">Prix (FCFA)</label>
              <input
                className="champ"
                type="number"
                min="0"
                placeholder="ex: 2500"
                value={prix}
                onChange={(e) => setPrix(e.target.value)}
                disabled={prixLibre}
                required={!prixLibre}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="lbl">Catégorie</label>
              <select
                className="champ"
                value={categorie}
                onChange={(e) => setCategorie(e.target.value)}
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom} {c.rayon === 'cuisine' ? '(Cuisine)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20, marginTop: 14, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input
                type="checkbox"
                checked={prixLibre}
                onChange={(e) => setPrixLibre(e.target.checked)}
              />
              Prix libre (saisi à la commande)
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input
                type="checkbox"
                checked={actif}
                onChange={(e) => setActif(e.target.checked)}
              />
              Disponible immédiatement au menu
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-g" onClick={onFerme}>
              Fermer
            </button>
            <button type="submit" className="btn btn-o" disabled={envoi || !nom.trim()}>
              {envoi ? 'Enregistrement...' : 'Enregistrer le nouveau plat'}
            </button>
          </div>
        </form>
      )}

      {onglet === 'disponibilite' && (
        <>
          <input
            className="champ"
            placeholder="🔍 Rechercher un plat..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            style={{ marginBottom: 12 }}
          />

          <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--bord)', borderRadius: 'var(--radius)' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Nom du plat</th>
                  <th>Prix</th>
                  <th>Statut</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {platsFiltres.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: 16, color: 'var(--mut)' }}>
                      Aucun plat trouvé.
                    </td>
                  </tr>
                ) : (
                  platsFiltres.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.nom}</td>
                      <td>{p.prix_libre ? 'Prix libre' : p.prix_standard ? `${p.prix_standard} F` : '—'}</td>
                      <td>
                        <span className={`badge ${p.actif ? 'b-ok' : 'b-rup'}`}>
                          {p.actif ? 'Disponible' : 'Épuisé'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className={`btn ${p.actif ? 'btn-danger' : 'btn-o'}`}
                          style={{ padding: '3px 10px', fontSize: 12 }}
                          onClick={() => basculerDisponibilite(p)}
                        >
                          {p.actif ? 'Marquer Épuisé' : 'Marquer Disponible'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modale>
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
