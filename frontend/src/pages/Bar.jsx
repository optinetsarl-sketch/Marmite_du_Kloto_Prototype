import { useEffect, useMemo, useState } from 'react'

import { api, fcfa, liste } from '../api'
import Modale from '../composants/Modale'

const LIBELLES_ETAT = { ok: 'En stock', bas: 'Bas', rupture: 'Rupture' }
const CLASSES_ETAT = { ok: 'b-ok', bas: 'b-bas', rupture: 'b-rup' }

const MOTIFS_SORTIE = [
  ['casse', 'Casse'],
  ['perte', 'Perte'],
  ['offert', 'Offert'],
]

export default function Bar() {
  const [produits, setProduits] = useState([])
  const [mouvements, setMouvements] = useState([])
  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState('tous')
  const [erreur, setErreur] = useState('')
  const [operation, setOperation] = useState(null)

  async function charger() {
    try {
      const [listeProduits, historique] = await Promise.all([
        liste('/produits/?categorie__rayon=bar&page_size=400'),
        liste('/mouvements-stock/?page_size=30'),
      ])
      setProduits(listeProduits)
      setMouvements(historique)
      setErreur('')
    } catch (echec) {
      setErreur(echec.message)
    }
  }

  useEffect(() => {
    charger()
  }, [])

  const filtres = useMemo(() => {
    const terme = recherche.trim().toLowerCase()
    return produits
      .filter((produit) => (terme ? produit.nom.toLowerCase().includes(terme) : true))
      .filter((produit) => (filtre === 'tous' ? true : produit.etat_stock === filtre))
  }, [produits, recherche, filtre])

  const alertes = produits.filter((produit) => produit.etat_stock !== 'ok').length

  return (
    <>
      <div className="top">
        <div>
          <h1>Bar — Stock</h1>
          <div className="sub">
            Le stock se recalcule à partir des mouvements : réceptions, ventes, casse, inventaire.
          </div>
        </div>
        <div className="actions-top">
          <button className="btn btn-g" onClick={() => setOperation('sortie')}>
            Casse / perte
          </button>
          <button className="btn btn-g" onClick={() => setOperation('inventaire')}>
            Inventaire
          </button>
          <button className="btn btn-o" onClick={() => setOperation('reception')}>
            + Charger du stock
          </button>
        </div>
      </div>

      {erreur && <div className="erreur">{erreur}</div>}

      <div className="selbar">
        {/* Pas de flex-basis en style en ligne : la barre passe en colonne sur
            téléphone, où « 180px » deviendrait une hauteur. */}
        <input
          className="champ champ-extensible"
          placeholder="Rechercher une boisson…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        <div className="seg">
          {[
            ['tous', 'Toutes'],
            ['bas', 'Stock bas'],
            ['rupture', 'Rupture'],
          ].map(([code, libelle]) => (
            <button
              key={code}
              className={`segb ${filtre === code ? 'on' : ''}`}
              onClick={() => setFiltre(code)}
            >
              {libelle}
            </button>
          ))}
        </div>
        <span className="pill alerte">{alertes} à surveiller</span>
      </div>

      <div className="card carte-tableau">
        <div className="tableau-defilant">
          <table className="grid cartes compacte">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Catégorie</th>
                <th style={{ textAlign: 'right' }}>Prix</th>
                <th style={{ textAlign: 'right' }}>Stock</th>
                <th style={{ textAlign: 'right' }}>Seuil</th>
                <th style={{ textAlign: 'right' }}>État</th>
              </tr>
            </thead>
            <tbody>
              {filtres.map((produit) => (
                <tr key={produit.id}>
                  <td data-titre style={{ fontWeight: 600 }}>{produit.nom}</td>
                  <td data-label="Catégorie" data-secondaire style={{ color: 'var(--mut)' }}>
                    {produit.categorie_nom}
                  </td>
                  <td data-label="Prix" style={{ textAlign: 'right' }}>{fcfa(produit.prix_standard)}</td>
                  <td data-label="Stock" style={{ textAlign: 'right', fontWeight: 700 }}>{produit.stock}</td>
                  <td data-label="Seuil" data-secondaire style={{ textAlign: 'right', color: 'var(--mut)' }}>
                    {produit.seuil_alerte}
                  </td>
                  <td data-label="État" style={{ textAlign: 'right' }}>
                    <span className={`badge ${CLASSES_ETAT[produit.etat_stock]}`}>
                      {LIBELLES_ETAT[produit.etat_stock]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtres.length === 0 && <div className="etat">Aucune boisson ne correspond.</div>}
      </div>

      <div className="card">
        <h3>Derniers mouvements</h3>
        {mouvements.length === 0 ? (
          <div className="etat">Aucun mouvement enregistré.</div>
        ) : (
          <div className="tableau-defilant">
            <table className="grid cartes">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Motif</th>
                  <th style={{ textAlign: 'right' }}>Quantité</th>
                  <th>Fournisseur / note</th>
                  <th style={{ textAlign: 'right' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {mouvements.map((mouvement) => (
                  <tr key={mouvement.id}>
                    <td data-titre style={{ fontWeight: 600 }}>{mouvement.produit_nom}</td>
                    <td data-label="Motif" style={{ color: 'var(--mut)' }}>{mouvement.motif_libelle}</td>
                    <td
                      data-label="Quantité"
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: mouvement.quantite < 0 ? 'var(--rouge)' : 'var(--vert)',
                      }}
                    >
                      {mouvement.quantite > 0 ? '+' : ''}
                      {mouvement.quantite}
                    </td>
                    <td data-label="Fournisseur / note" style={{ color: 'var(--mut)' }}>
                      {mouvement.fournisseur_nom || mouvement.commentaire || '—'}
                    </td>
                    <td
                      data-label="Date"
                      style={{ textAlign: 'right', color: 'var(--mut)', whiteSpace: 'nowrap' }}
                    >
                      {new Date(mouvement.cree_le).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {operation && (
        <OperationStock
          type={operation}
          produits={produits}
          onFerme={() => setOperation(null)}
          onEnregistre={async () => {
            setOperation(null)
            await charger()
          }}
        />
      )}
    </>
  )
}

const TITRES = {
  reception: 'Réception de stock',
  sortie: 'Sortie de stock',
  inventaire: "Correction d'inventaire",
}

function OperationStock({ type, produits, onFerme, onEnregistre }) {
  const [produit, setProduit] = useState('')
  const [quantite, setQuantite] = useState('')
  const [prix, setPrix] = useState('')
  const [fournisseur, setFournisseur] = useState('')
  const [motif, setMotif] = useState('casse')
  const [commentaire, setCommentaire] = useState('')
  const [majPrix, setMajPrix] = useState(false)
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)

  const choisi = produits.find((entree) => String(entree.id) === String(produit))

  async function enregistrer(evenement) {
    evenement.preventDefault()
    setErreur('')
    setEnvoi(true)
    try {
      if (type === 'reception') {
        await api.post('/mouvements-stock/reception/', {
          produit: Number(produit),
          quantite: Number(quantite),
          prix_unitaire: prix ? Number(prix) : null,
          fournisseur,
          maj_prix_vente: majPrix,
        })
      } else if (type === 'sortie') {
        await api.post('/mouvements-stock/sortie/', {
          produit: Number(produit),
          quantite: Number(quantite),
          motif,
          commentaire,
        })
      } else {
        await api.post('/mouvements-stock/inventaire/', {
          produit: Number(produit),
          stock_reel: Number(quantite),
          commentaire,
        })
      }
      await onEnregistre()
    } catch (echec) {
      setErreur(echec.message)
      setEnvoi(false)
    }
  }

  const ecart = choisi && quantite !== '' ? Number(quantite) - choisi.stock : null

  return (
    <Modale titre={TITRES[type]} largeur={420} onFerme={onFerme}>
      {erreur && <div className="erreur">{erreur}</div>}
      <form onSubmit={enregistrer}>
        <label className="lbl">Produit</label>
        <select
          className="champ"
          value={produit}
          onChange={(e) => setProduit(e.target.value)}
          required
          autoFocus
        >
          <option value="">— choisir —</option>
          {produits.map((entree) => (
            <option key={entree.id} value={entree.id}>
              {entree.nom} (stock {entree.stock})
            </option>
          ))}
        </select>

        {type === 'inventaire' ? (
          <>
            <label className="lbl">Stock réellement compté</label>
            <input
              className="champ"
              type="number"
              min="0"
              value={quantite}
              onChange={(e) => setQuantite(e.target.value)}
              required
            />
            {choisi && quantite !== '' && (
              <div className="tot" style={{ fontSize: 14 }}>
                <span>Écart avec le théorique ({choisi.stock})</span>
                <span style={{ color: ecart === 0 ? 'var(--vert)' : 'var(--orange-dk)' }}>
                  {ecart > 0 ? '+' : ''}
                  {ecart}
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            <label className="lbl">Quantité</label>
            <input
              className="champ"
              type="number"
              min="1"
              value={quantite}
              onChange={(e) => setQuantite(e.target.value)}
              required
            />
          </>
        )}

        {type === 'reception' && (
          <>
            <label className="lbl">Prix d'achat unitaire (facultatif)</label>
            <input
              className="champ"
              type="number"
              min="0"
              value={prix}
              onChange={(e) => setPrix(e.target.value)}
            />
            <label className="case">
              <input
                type="checkbox"
                checked={majPrix}
                onChange={(e) => setMajPrix(e.target.checked)}
              />
              <span>Utiliser aussi ce montant comme nouveau prix de vente</span>
            </label>
            <label className="lbl">Fournisseur (facultatif)</label>
            <input
              className="champ"
              value={fournisseur}
              onChange={(e) => setFournisseur(e.target.value)}
            />
          </>
        )}

        {type === 'sortie' && (
          <>
            <label className="lbl">Motif</label>
            <select className="champ" value={motif} onChange={(e) => setMotif(e.target.value)}>
              {MOTIFS_SORTIE.map(([code, libelle]) => (
                <option key={code} value={code}>
                  {libelle}
                </option>
              ))}
            </select>
          </>
        )}

        {type !== 'reception' && (
          <>
            <label className="lbl">Commentaire</label>
            <input
              className="champ"
              placeholder={type === 'inventaire' ? 'ex. comptage du soir' : 'ex. casier renversé'}
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
            />
          </>
        )}

        <div className="modal-act" style={{ marginTop: 18 }}>
          <button type="button" className="btn btn-g" onClick={onFerme}>
            Annuler
          </button>
          <button className="btn btn-o" disabled={envoi}>
            {envoi ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modale>
  )
}
