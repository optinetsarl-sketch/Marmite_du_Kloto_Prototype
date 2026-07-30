import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { api, fcfa, liste } from '../api'
import BonCuisine from '../composants/BonCuisine'
import ModalePaiement from '../composants/ModalePaiement'
import ModalePrix from '../composants/ModalePrix'
import Recu from '../composants/Recu'

const TYPES = [
  { code: 'place', libelle: 'Sur place' },
  { code: 'emporter', libelle: 'À emporter' },
  { code: 'livraison', libelle: 'Livraison' },
]

export default function Ventes() {
  const [parametres, setParametres] = useSearchParams()
  const [categories, setCategories] = useState([])
  const [produits, setProduits] = useState([])
  const [tables, setTables] = useState([])
  const [livreurs, setLivreurs] = useState([])

  // ?commande=<id> : reprise d'une commande déjà créée (typiquement WhatsApp).
  const commandeReprise = parametres.get('commande')

  const [categorieActive, setCategorieActive] = useState(null)
  const [recherche, setRecherche] = useState('')
  const [type, setType] = useState('place')
  const [tableId, setTableId] = useState(parametres.get('table') || '')
  const [livreurId, setLivreurId] = useState('')
  const [nouveauLivreur, setNouveauLivreur] = useState('')
  const [modeNouveauLivreur, setModeNouveauLivreur] = useState(false)
  const [client, setClient] = useState('')

  // commande = ce qui est persisté au serveur (null tant qu'on n'a pas validé).
  // panier  = le brouillon en cours, modifiable librement avant validation.
  const [commande, setCommande] = useState(null)
  const [panier, setPanier] = useState([])
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [platEnAttente, setPlatEnAttente] = useState(null)
  const [paiementOuvert, setPaiementOuvert] = useState(false)
  const [documentOuvert, setDocumentOuvert] = useState(null)
  const [bonCuisineOuvert, setBonCuisineOuvert] = useState(null)

  useEffect(() => {
    Promise.all([
      liste('/categories/'),
      liste('/produits/?actif=true&page_size=200'),
      liste('/tables/?page_size=200'),
      liste('/livreurs/?actif=true'),
    ])
      .then(([cats, prods, tbls, livs]) => {
        setCategories(cats)
        setProduits(prods)
        setTables(tbls)
        setLivreurs(livs)
        setCategorieActive((actuelle) => actuelle ?? cats[0]?.id ?? null)
        setLivreurId((actuel) => actuel || String(livs[0]?.id ?? ''))
      })
      .catch((echec) => setErreur(echec.message))
  }, [])

  // Transforme les lignes d'une commande persistée en articles de panier.
  const chargerPanier = useCallback(
    (cmd) => {
      setPanier(
        (cmd?.lignes ?? []).map((ligne) => ({
          produit: produits.find((p) => p.id === ligne.produit) ?? {
            id: ligne.produit,
            nom: ligne.libelle,
            prix_libre: false,
          },
          quantite: ligne.quantite,
          prix_unitaire: ligne.prix_unitaire,
          note: ligne.note || '',
        })),
      )
    },
    [produits],
  )

  // Choisir une table CHARGE son ardoise si elle existe, sans rien attribuer.
  // Une table libre ouvre un panier vide : rien n'est écrit avant validation.
  useEffect(() => {
    if (commandeReprise || type !== 'place') return
    if (!tableId) {
      setCommande(null)
      setPanier([])
      return
    }
    const table = tables.find((t) => String(t.id) === String(tableId))
    if (table?.commande_id) {
      api
        .get(`/commandes/${table.commande_id}/`)
        .then((cmd) => {
          setCommande(cmd)
          chargerPanier(cmd)
          setErreur('')
        })
        .catch((echec) => setErreur(echec.message))
    } else {
      setCommande(null)
      setPanier([])
    }
  }, [type, tableId, tables, commandeReprise, chargerPanier])

  useEffect(() => {
    if (!commandeReprise) return
    api
      .get(`/commandes/${commandeReprise}/`)
      .then((reprise) => {
        setCommande(reprise)
        chargerPanier(reprise)
        setType(reprise.type)
        setClient(reprise.client_nom)
        if (reprise.livreur) setLivreurId(String(reprise.livreur))
      })
      .catch((echec) => setErreur(echec.message))
  }, [commandeReprise, chargerPanier])

  const produitsFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    if (q) {
      return produits.filter((produit) => produit.nom.toLowerCase().includes(q))
    }
    return produits.filter((produit) => produit.categorie === categorieActive)
  }, [produits, categorieActive, recherche])

  const total = panier.reduce((somme, item) => somme + item.prix_unitaire * item.quantite, 0)

  // ---- Édition locale du panier (aucun appel réseau) ----
  function ajouter(produit, prix) {
    if (produit.gere_stock && (produit.stock <= 0 || produit.etat_stock === 'rupture')) {
      setErreur(`Le produit « ${produit.nom} » est en rupture de stock.`)
      return
    }
    if (produit.prix_libre && prix === undefined) {
      setPlatEnAttente(produit)
      return
    }
    const prixUnitaire = prix === undefined ? produit.prix_standard : prix
    setPanier((actuel) => {
      const i = actuel.findIndex(
        (item) => item.produit.id === produit.id && item.prix_unitaire === prixUnitaire && !item.note,
      )
      if (i >= 0) {
        if (produit.gere_stock && actuel[i].quantite + 1 > produit.stock) {
          setErreur(`Stock insuffisant pour « ${produit.nom} » (Disponible : ${produit.stock})`)
          return actuel
        }
        const copie = [...actuel]
        copie[i] = { ...copie[i], quantite: copie[i].quantite + 1 }
        return copie
      }
      return [...actuel, { produit, quantite: 1, prix_unitaire: prixUnitaire, note: '' }]
    })
  }

  function changerQuantite(index, delta) {
    setPanier((actuel) =>
      actuel
        .map((item, i) => {
          if (i !== index) return item
          const nouvelleQte = item.quantite + delta
          if (delta > 0 && item.produit.gere_stock && nouvelleQte > item.produit.stock) {
            setErreur(`Stock disponible atteint pour « ${item.produit.nom} » (${item.produit.stock} disponible)`)
            return item
          }
          return { ...item, quantite: nouvelleQte }
        })
        .filter((item) => item.quantite > 0),
    )
  }

  function retirer(index) {
    setPanier((actuel) => actuel.filter((_, i) => i !== index))
  }

  // ---- Persistance : « Valider » attribue enfin la commande ----
  async function persister() {
    let cible = commande
    let idLivreurFinal = Number(livreurId) || null

    // Si un nouveau nom de livreur est saisi, le créer automatiquement en base
    if (type === 'livraison' && modeNouveauLivreur && nouveauLivreur.trim()) {
      try {
        const cree = await api.post('/livreurs/', { nom: nouveauLivreur.trim(), actif: true })
        const misAJour = await liste('/livreurs/?actif=true')
        setLivreurs(misAJour)
        setLivreurId(String(cree.id))
        idLivreurFinal = Number(cree.id)
        setModeNouveauLivreur(false)
        setNouveauLivreur('')
      } catch (e) {
        console.error('Erreur création automatique livreur', e)
      }
    }

    if (type === 'place') {
      // get-or-create : c'est ici, à la validation, que la table est attribuée.
      cible = await api.post(`/tables/${tableId}/ardoise/`, {})
    } else if (!cible) {
      cible = await api.post('/commandes/', {
        type,
        client_nom: client,
        livreur: type === 'livraison' ? idLivreurFinal : null,
      })
    }
    const misAJour = await api.post(`/commandes/${cible.id}/synchroniser/`, {
      lignes: panier.map((item) => ({
        produit: item.produit.id,
        quantite: item.quantite,
        prix_unitaire: item.prix_unitaire,
        note: item.note,
      })),
    })
    setCommande(misAJour)
    return misAJour
  }

  async function chargerProduits() {
    try {
      const prods = await liste('/produits/?actif=true&page_size=300')
      setProduits(prods)
    } catch (e) {
      console.error('Erreur rafraîchissement des produits', e)
    }
  }

  async function valider() {
    setOccupe(true)
    setErreur('')
    try {
      const persistee = await persister()
      await chargerProduits()
      setTables(await liste('/tables/?page_size=200'))
      if (persistee && persistee.lignes && persistee.lignes.some((l) => l.rayon === 'cuisine')) {
        setBonCuisineOuvert(persistee)
      }
      // L'ardoise s'efface automatiquement après la validation de la commande
      setCommande(null)
      setPanier([])
      setTableId('')
      setClient('')
      setParametres({})
    } catch (echec) {
      setErreur(echec.message)
    } finally {
      setOccupe(false)
    }
  }

  async function imprimerBonCuisine() {
    setOccupe(true)
    setErreur('')
    try {
      const persistee = await persister()
      setBonCuisineOuvert(persistee)
      // L'ardoise s'efface automatiquement après impression du bon de cuisine
      setCommande(null)
      setPanier([])
      setTableId('')
      setClient('')
      setParametres({})
    } catch (echec) {
      setErreur(echec.message)
    } finally {
      setOccupe(false)
    }
  }

  function changerType(nouveauType) {
    if (nouveauType === type) return
    setType(nouveauType)
    setCommande(null)
    setPanier([])
    setTableId('')
    setClient('')
    setParametres({})
  }

  async function ouvrirPaiement() {
    setOccupe(true)
    setErreur('')
    try {
      await persister() // on encaisse toujours l'état validé du panier
      setPaiementOuvert(true)
    } catch (echec) {
      setErreur(echec.message)
    } finally {
      setOccupe(false)
    }
  }

  async function encaisser(paiements) {
    const encaissee = await api.post(`/commandes/${commande.id}/encaisser/`, { paiements })
    await chargerProduits()
    setPaiementOuvert(false)
    setDocumentOuvert({ commande: encaissee, type: 'Reçu' })
    setCommande(null)
    setPanier([])
    setTableId('')
    setParametres({})
    setTables(await liste('/tables/?page_size=200'))
  }

  async function imprimerAddition() {
    setOccupe(true)
    try {
      const persistee = await persister()
      setDocumentOuvert({ commande: persistee, type: 'Addition' })
    } catch (echec) {
      setErreur(echec.message)
    } finally {
      setOccupe(false)
    }
  }

  const validee = commande && panier.length && !modifie(commande, panier)
  const contexte =
    type === 'place'
      ? tableId
        ? `Table ${tables.find((t) => String(t.id) === String(tableId))?.numero}`
        : 'Choisissez une table'
      : type === 'livraison'
        ? `Livraison · ${commande?.client_nom || client || ''} · ${
            commande?.livreur_nom ?? livreurs.find((l) => String(l.id) === String(livreurId))?.nom ?? ''
          }`
        : `À emporter${commande?.client_nom ? ` · ${commande.client_nom}` : ''}`

  const platsBloques = type === 'place' && !tableId

  return (
    <>
      <div className="top">
        <div>
          <h1>Ventes / Caisse</h1>
          <div className="sub">
            {panier.length === 0
              ? 'Nouvelle commande — non attribuée'
              : validee
                ? `Commande validée · ${panier.length} ligne(s)`
                : 'Commande en cours — pensez à valider'}
          </div>
        </div>
        <div className="pill">{contexte}</div>
      </div>

      {erreur && <div className="erreur">{erreur}</div>}

      <div className="selbar">
        <div className="seg">
          {TYPES.map((entree) => (
            <button
              key={entree.code}
              className={`segb ${type === entree.code ? 'on' : ''}`}
              onClick={() => changerType(entree.code)}
            >
              {entree.libelle}
            </button>
          ))}
        </div>

        {type === 'place' && (
          <select className="champ auto" value={tableId} onChange={(e) => setTableId(e.target.value)}>
            <option value="">— choisir une table —</option>
            {tables.map((table) => (
              <option key={table.id} value={table.id}>
                Table {table.numero}
                {table.etat !== 'libre' ? ` · ${fcfa(table.total)}` : ' (libre)'}
              </option>
            ))}
          </select>
        )}

        {type === 'livraison' && (
          modeNouveauLivreur ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                className="champ auto"
                placeholder="Nom du nouveau livreur"
                value={nouveauLivreur}
                onChange={(e) => setNouveauLivreur(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                className="btn btn-o"
                style={{ padding: '6px 12px', fontSize: 13, whiteSpace: 'nowrap' }}
                onClick={async () => {
                  if (!nouveauLivreur.trim()) return
                  try {
                    const cree = await api.post('/livreurs/', { nom: nouveauLivreur.trim(), actif: true })
                    const misAJour = await liste('/livreurs/?actif=true')
                    setLivreurs(misAJour)
                    setLivreurId(String(cree.id))
                    setModeNouveauLivreur(false)
                    setNouveauLivreur('')
                  } catch (err) {
                    setErreur(err.message)
                  }
                }}
              >
                + Créer
              </button>
              <button
                type="button"
                className="btn btn-g"
                style={{ padding: '6px 10px', fontSize: 13 }}
                onClick={() => setModeNouveauLivreur(false)}
                title="Annuler"
              >
                ✕
              </button>
            </div>
          ) : (
            <select
              className="champ auto"
              value={livreurId}
              onChange={(e) => {
                if (e.target.value === '__nouveau__') {
                  setModeNouveauLivreur(true)
                  setNouveauLivreur('')
                } else {
                  setLivreurId(e.target.value)
                  setModeNouveauLivreur(false)
                }
              }}
            >
              <option value="">— Choisir un livreur —</option>
              {livreurs.map((livreur) => (
                <option key={livreur.id} value={livreur.id}>
                  {livreur.nom}
                </option>
              ))}
              <option value="__nouveau__">➕ Ajouter un nouveau livreur...</option>
            </select>
          )
        )}

        {type !== 'place' && (
          <input
            className="champ auto"
            placeholder="Nom du client"
            value={client}
            onChange={(e) => setClient(e.target.value)}
          />
        )}
      </div>

      <div className="pos pos-vente">
        <div>
          <div style={{ marginBottom: 12 }}>
            <input
              type="search"
              className="champ"
              style={{ width: '100%', fontSize: 14, padding: '9px 14px', borderRadius: 'var(--radius)' }}
              placeholder="🔍 Rechercher un plat ou une boisson..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>

          <div className="cats">
            {categories.map((categorie) => (
              <button
                key={categorie.id}
                className={`cat ${categorieActive === categorie.id ? 'on' : ''}`}
                onClick={() => setCategorieActive(categorie.id)}
              >
                {categorie.nom}
              </button>
            ))}
          </div>

          <div className="prods">
            {produitsFiltres.map((produit) => {
              const enRupture = produit.gere_stock && (produit.stock <= 0 || produit.etat_stock === 'rupture')
              return (
                <button
                  key={produit.id}
                  className={`prod ${enRupture ? 'en-rupture' : ''}`}
                  disabled={platsBloques || enRupture}
                  onClick={() => ajouter(produit)}
                  title={enRupture ? 'Rupture de stock (0 disponible)' : ''}
                >
                  <div className="pn">{produit.nom}</div>
                  <div className="pp">
                    {produit.prix_libre ? 'Prix à saisir' : fcfa(produit.prix_standard)}
                  </div>
                  {produit.gere_stock && (
                    <div className={`badge ${enRupture ? 'b-rup' : produit.etat_stock === 'bas' ? 'b-bas' : 'b-ok'}`}>
                      {enRupture ? 'Rupture' : `Reste ${produit.stock}`}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="ticket">
          <h3>Commande</h3>
          <div className="meta">{contexte}</div>

          {panier.length === 0 ? (
            <div className="etat">
              {platsBloques ? 'Choisissez d’abord une table.' : 'Touchez un produit pour l’ajouter.'}
            </div>
          ) : (
            panier.map((item, index) => (
              <div className="line" key={index}>
                <span>{item.produit.nom}</span>
                <span className="line-actions">
                  <button className="qte" onClick={() => changerQuantite(index, -1)} aria-label="Moins">
                    −
                  </button>
                  <b>{item.quantite}</b>
                  <button className="qte" onClick={() => changerQuantite(index, 1)} aria-label="Plus">
                    +
                  </button>
                  <span className="line-montant">{fcfa(item.prix_unitaire * item.quantite)}</span>
                  <button className="x" onClick={() => retirer(index)} aria-label="Retirer">
                    ✕
                  </button>
                </span>
              </div>
            ))
          )}

          <div className="tot">
            <span>Total</span>
            <span>{fcfa(total)}</span>
          </div>

          {/* Valider attribue la commande à la table (ou l'envoie en cuisine pour
              une livraison). Tant qu'on n'a pas validé, rien n'est écrit. */}
          <button
            className="btn btn-o"
            style={{ width: '100%', marginTop: 12 }}
            disabled={!total || occupe || validee}
            onClick={valider}
          >
            {validee
              ? 'Commande validée ✓'
              : type === 'livraison'
                ? 'Valider & envoyer en cuisine'
                : 'Valider la commande'}
          </button>

          {type !== 'livraison' && (
            <>
              <button
                className="btn btn-g"
                style={{ width: '100%', marginTop: 8 }}
                disabled={!total || occupe}
                onClick={ouvrirPaiement}
              >
                Encaisser
              </button>
              <button
                className="btn btn-g"
                style={{ width: '100%', marginTop: 8 }}
                disabled={!total || occupe}
                onClick={imprimerAddition}
              >
                Imprimer l’addition
              </button>
            </>
          )}

          {(panier.some((item) => item.produit.rayon === 'cuisine' || item.produit.categorie_rayon === 'cuisine' || item.produit.categorie?.rayon === 'cuisine') || (commande && commande.lignes && commande.lignes.some((l) => l.rayon === 'cuisine'))) && (
            <button
              className="btn btn-g"
              style={{ width: '100%', marginTop: 8, borderColor: 'var(--orange)', color: 'var(--orange)', fontWeight: 600 }}
              disabled={!total || occupe}
              onClick={imprimerBonCuisine}
            >
              🔥 Imprimer le bon de cuisine
            </button>
          )}

          {panier.length > 0 && (
            <button
              className="btn btn-g"
              style={{ width: '100%', marginTop: 8, color: '#777' }}
              onClick={() => {
                setCommande(null)
                setPanier([])
                setTableId('')
                setClient('')
                setParametres({})
              }}
            >
              🗑️ Effacer / Nouveau panier
            </button>
          )}

          <div className="note">
            {type === 'livraison'
              ? 'La commande part en cuisine à la validation. L’encaissement se fait au retour du livreur.'
              : type === 'emporter'
                ? 'Validez pour envoyer le bon en cuisine. Imprimez l’addition pour le client et encaissez.'
                : 'Modifiez librement le panier tant que ce n’est pas payé. « Valider » attribue la commande à la table ; « Encaisser » la solde et déstocke le bar.'}
          </div>
        </div>
      </div>

      {platEnAttente && (
        <ModalePrix
          produit={platEnAttente}
          onFerme={() => setPlatEnAttente(null)}
          onValide={(prix) => {
            const produit = platEnAttente
            setPlatEnAttente(null)
            ajouter(produit, prix)
          }}
        />
      )}

      {paiementOuvert && (
        <ModalePaiement total={total} onEncaisse={encaisser} onFerme={() => setPaiementOuvert(false)} />
      )}

      {documentOuvert && (
        <Recu
          commande={documentOuvert.commande}
          typeDocument={documentOuvert.type}
          onFerme={() => setDocumentOuvert(null)}
        />
      )}

      {bonCuisineOuvert && (
        <BonCuisine commande={bonCuisineOuvert} onFerme={() => setBonCuisineOuvert(null)} />
      )}
    </>
  )
}

// Le panier diffère-t-il de ce qui est persisté ? Sert à savoir si « Valider »
// a encore un effet ou si la commande est déjà à jour.
function modifie(commande, panier) {
  const lignes = commande.lignes ?? []
  if (lignes.length !== panier.length) return true
  const cle = (produit, prix, note) => `${produit}|${prix}|${note || ''}`
  const persistees = new Map(
    lignes.map((l) => [cle(l.produit, l.prix_unitaire, l.note), l.quantite]),
  )
  return panier.some(
    (item) => persistees.get(cle(item.produit.id, item.prix_unitaire, item.note)) !== item.quantite,
  )
}
