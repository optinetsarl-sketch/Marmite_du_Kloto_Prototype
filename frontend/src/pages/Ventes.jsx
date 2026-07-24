import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { api, fcfa, liste } from '../api'
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
  const [type, setType] = useState('place')
  const [tableId, setTableId] = useState(parametres.get('table') || '')
  const [livreurId, setLivreurId] = useState('')
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

  const produitsFiltres = useMemo(
    () => produits.filter((produit) => produit.categorie === categorieActive),
    [produits, categorieActive],
  )

  const total = panier.reduce((somme, item) => somme + item.prix_unitaire * item.quantite, 0)

  // ---- Édition locale du panier (aucun appel réseau) ----
  function ajouter(produit, prix) {
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
        .map((item, i) => (i === index ? { ...item, quantite: item.quantite + delta } : item))
        .filter((item) => item.quantite > 0),
    )
  }

  function retirer(index) {
    setPanier((actuel) => actuel.filter((_, i) => i !== index))
  }

  // ---- Persistance : « Valider » attribue enfin la commande ----
  async function persister() {
    let cible = commande
    if (type === 'place') {
      // get-or-create : c'est ici, à la validation, que la table est attribuée.
      cible = await api.post(`/tables/${tableId}/ardoise/`, {})
    } else if (!cible) {
      cible = await api.post('/commandes/', {
        type,
        client_nom: client,
        livreur: type === 'livraison' ? Number(livreurId) || null : null,
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

  async function valider() {
    setOccupe(true)
    setErreur('')
    try {
      await persister()
      setTables(await liste('/tables/?page_size=200'))
    } catch (echec) {
      setErreur(echec.message)
    } finally {
      setOccupe(false)
    }
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
              onClick={() => setType(entree.code)}
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
          <select className="champ auto" value={livreurId} onChange={(e) => setLivreurId(e.target.value)}>
            {livreurs.map((livreur) => (
              <option key={livreur.id} value={livreur.id}>
                {livreur.nom}
              </option>
            ))}
          </select>
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
            {produitsFiltres.map((produit) => (
              <button
                key={produit.id}
                className="prod"
                disabled={platsBloques}
                onClick={() => ajouter(produit)}
              >
                <div className="pn">{produit.nom}</div>
                <div className="pp">
                  {produit.prix_libre ? 'Prix à saisir' : fcfa(produit.prix_standard)}
                </div>
                {produit.gere_stock && produit.etat_stock !== 'ok' && (
                  <div className={`badge ${produit.etat_stock === 'rupture' ? 'b-rup' : 'b-bas'}`}>
                    {produit.etat_stock === 'rupture' ? 'Rupture' : `Reste ${produit.stock}`}
                  </div>
                )}
              </button>
            ))}
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

          <div className="note">
            {type === 'livraison'
              ? 'La commande part en cuisine à la validation. L’encaissement se fait au retour du livreur.'
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
