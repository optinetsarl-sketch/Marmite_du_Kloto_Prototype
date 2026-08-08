import { useEffect, useMemo, useState } from 'react'

import { api, fcfa, liste } from '../api'
import Modale from '../composants/Modale'

const ONGLETS = [
  ['plats', 'Plats'],
  ['boissons', 'Boissons'],
  ['familles', 'Familles'],
  ['categories', 'Catégories'],
  ['tables', 'Tables'],
]

export default function Catalogue() {
  const [onglet, setOnglet] = useState('plats')
  const [produits, setProduits] = useState([])
  const [categories, setCategories] = useState([])
  const [familles, setFamilles] = useState([])
  const [tables, setTables] = useState([])
  const [erreur, setErreur] = useState('')
  const [edition, setEdition] = useState(null)
  const [recherche, setRecherche] = useState('')

  async function charger() {
    try {
      const [prods, cats, fams, tbls] = await Promise.all([
        liste('/produits/?page_size=400'),
        liste('/categories/'),
        liste('/familles/'),
        liste('/tables/?page_size=200'),
      ])
      setProduits(prods)
      setCategories(cats)
      setFamilles(fams)
      setTables(tbls)
      setErreur('')
    } catch (echec) {
      setErreur(echec.message)
    }
  }

  useEffect(() => {
    charger()
  }, [])

  async function supprimer(chemin, libelle) {
    if (!window.confirm(`Supprimer « ${libelle} » ?`)) return
    try {
      await api.delete(chemin)
      await charger()
    } catch (echec) {
      // Le backend renvoie un 409 avec un message clair quand l'élément est
      // encore référencé ; on le préfixe du nom concerné.
      setErreur(`« ${libelle} » — ${echec.message}`)
    }
  }

  const platsTous = useMemo(
    () => produits.filter((produit) => produit.rayon === 'cuisine'),
    [produits],
  )
  const plats = useMemo(() => {
    const terme = recherche.trim().toLowerCase()
    return terme ? platsTous.filter((p) => p.nom.toLowerCase().includes(terme)) : platsTous
  }, [platsTous, recherche])

  const boissonsToutes = useMemo(
    () => produits.filter((produit) => produit.rayon === 'bar'),
    [produits],
  )
  const boissons = useMemo(() => {
    const terme = recherche.trim().toLowerCase()
    return terme ? boissonsToutes.filter((p) => p.nom.toLowerCase().includes(terme)) : boissonsToutes
  }, [boissonsToutes, recherche])

  function ouvrirAjout(targetType = onglet) {
    const catParDefaut = categories.find((c) =>
      targetType === 'plats' ? c.rayon === 'cuisine' : c.rayon === 'bar',
    )?.id || (categories.length > 0 ? categories[0].id : null)

    setEdition({
      type: targetType,
      valeur:
        targetType === 'tables'
          ? { numero: (tables.length + 1).toString(), couverts_defaut: 2, active: true }
          : targetType === 'familles'
            ? { nom: '', ordre: familles.length + 1 }
            : targetType === 'categories'
            ? { nom: '', rayon: 'bar', famille: familles[0]?.id || '', ordre: categories.length + 1 }
            : {
                nom: '',
                categorie: catParDefaut,
                prix_standard: targetType === 'plats' ? null : '',
                prix_libre: targetType === 'plats',
                gere_stock: targetType !== 'plats',
                seuil_alerte: 12,
                actif: true,
              },
    })
  }

  const libellesAjout = {
    plats: '+ Ajouter un plat',
    boissons: '+ Ajouter une boisson',
    familles: '+ Ajouter une famille',
    categories: '+ Ajouter une catégorie',
    tables: '+ Ajouter une table',
  }

  const compteurs = {
    plats: platsTous.length,
    boissons: boissonsToutes.length,
    familles: familles.length,
    categories: categories.length,
    tables: tables.length,
  }

  return (
    <>
      <div className="top">
        <div>
          <h1>Catalogue &amp; Configuration</h1>
          <div className="sub">Gestion des plats, boissons, familles, catégories et tables de la salle</div>
        </div>
        <button
          className="btn btn-o"
          style={{ fontWeight: 800, padding: '10px 18px' }}
          onClick={() => ouvrirAjout(onglet)}
        >
          {libellesAjout[onglet] || '+ Ajouter'}
        </button>
      </div>

      {erreur && <div className="erreur" style={{ marginBottom: 16 }}>{erreur}</div>}

      <div className="seg seg-onglets" style={{ marginBottom: 16 }}>
        {ONGLETS.map(([code, libelle]) => (
          <button
            key={code}
            className={`segb ${onglet === code ? 'on' : ''}`}
            onClick={() => {
              setOnglet(code)
              setRecherche('')
            }}
          >
            {libelle} ({compteurs[code] || 0})
          </button>
        ))}
      </div>

      {(onglet === 'boissons' || onglet === 'plats') && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <input
            className="champ"
            style={{ flex: 1 }}
            placeholder={onglet === 'plats' ? "Rechercher un plat..." : "Rechercher une boisson..."}
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
          <button
            className="btn btn-g"
            style={{ fontWeight: 700 }}
            onClick={() => ouvrirAjout(onglet)}
          >
            {libellesAjout[onglet]}
          </button>
        </div>
      )}

      <div className="card carte-tableau">
        <div className="tableau-defilant">
          {onglet === 'plats' && (
            <TableProduits
              produits={plats}
              categories={categories}
              colonnePrix="Prix"
              onEditer={(produit) => setEdition({ type: 'plats', valeur: produit })}
              onSupprimer={(produit) => supprimer(`/produits/${produit.id}/`, produit.nom)}
              onRecharger={charger}
              onErreur={setErreur}
            />
          )}
          {onglet === 'boissons' && (
            <TableProduits
              produits={boissons}
              categories={categories}
              colonnePrix="Prix standard"
              stock
              onEditer={(produit) => setEdition({ type: 'boissons', valeur: produit })}
              onSupprimer={(produit) => supprimer(`/produits/${produit.id}/`, produit.nom)}
              onRecharger={charger}
              onErreur={setErreur}
            />
          )}
          {onglet === 'familles' && (
            <table className="grid cartes">
              <thead>
                <tr>
                  <th>Famille</th>
                  <th style={{ textAlign: 'right' }}>Catégories</th>
                  <th style={{ textAlign: 'right' }}>Ordre</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {familles.map((famille) => (
                  <tr key={famille.id}>
                    <td data-titre style={{ fontWeight: 600 }}>{famille.nom}</td>
                    <td data-label="Catégories" style={{ textAlign: 'right' }}>
                      {famille.nb_categories}
                    </td>
                    <td data-label="Ordre" style={{ textAlign: 'right', color: 'var(--mut)' }}>
                      {famille.ordre}
                    </td>
                    <td data-actions style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        className="btn btn-g btn-mini"
                        onClick={() => setEdition({ type: 'familles', valeur: famille })}
                      >
                        Modifier
                      </button>{' '}
                      <button
                        className="x"
                        onClick={() => supprimer(`/familles/${famille.id}/`, famille.nom)}
                        aria-label="Supprimer"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                {familles.length === 0 && (
                  <tr>
                    <td colSpan={4} className="etat">
                      Aucune famille. Créez-en pour regrouper vos catégories.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          {onglet === 'categories' && (
            <table className="grid cartes">
              <thead>
                <tr>
                  <th>Catégorie</th>
                  <th>Famille</th>
                  <th>Rayon</th>
                  <th style={{ textAlign: 'right' }}>Produits</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {categories.map((categorie) => (
                  <tr key={categorie.id}>
                    <td data-titre style={{ fontWeight: 600 }}>{categorie.nom}</td>
                    <td data-label="Famille" style={{ color: 'var(--mut)' }}>
                      {categorie.famille_nom || '—'}
                    </td>
                    <td data-label="Rayon" style={{ color: 'var(--mut)' }}>
                      {categorie.rayon === 'cuisine' ? 'Cuisine' : 'Bar'}
                    </td>
                    <td data-label="Produits" style={{ textAlign: 'right' }}>
                      {produits.filter((p) => p.categorie === categorie.id).length}
                    </td>
                    <td data-actions style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        className="btn btn-g btn-mini"
                        onClick={() => setEdition({ type: 'categories', valeur: categorie })}
                      >
                        Modifier
                      </button>{' '}
                      <button
                        className="x"
                        onClick={() => supprimer(`/categories/${categorie.id}/`, categorie.nom)}
                        aria-label="Supprimer"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {onglet === 'tables' && (
            <table className="grid cartes">
              <thead>
                <tr>
                  <th>Table</th>
                  <th style={{ textAlign: 'center' }}>Couverts par défaut</th>
                  <th style={{ textAlign: 'center' }}>État</th>
                  <th style={{ textAlign: 'center' }}>Active</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tables.map((table) => (
                  <tr key={table.id}>
                    <td data-titre style={{ fontWeight: 600 }}>Table {table.numero}</td>
                    <td data-label="Couverts" style={{ textAlign: 'center' }}>
                      {table.couverts_defaut}
                    </td>
                    <td data-label="État" style={{ textAlign: 'center' }}>
                      <span className={`badge ${table.etat === 'libre' ? 'b-ok' : 'b-bas'}`}>
                        {table.etat === 'libre' ? 'Libre' : 'Occupée'}
                      </span>
                    </td>
                    <td data-label="Active" style={{ textAlign: 'center' }}>
                      {table.active ? 'Oui' : 'Non'}
                    </td>
                    <td data-actions style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        className="btn btn-g btn-mini"
                        onClick={() => setEdition({ type: 'tables', valeur: table })}
                      >
                        Modifier
                      </button>{' '}
                      <button
                        className="x"
                        onClick={() => supprimer(`/tables/${table.id}/`, `Table ${table.numero}`)}
                        aria-label="Supprimer"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {edition && (
        <Formulaire
          edition={edition}
          categories={categories}
          familles={familles}
          onFerme={() => setEdition(null)}
          onEnregistre={async () => {
            setEdition(null)
            await charger()
          }}
          onErreur={setErreur}
        />
      )}
    </>
  )
}

function TableProduits({ produits, categories = [], colonnePrix, stock, onEditer, onSupprimer, onRecharger, onErreur }) {
  return (
    <table className="grid cartes compacte">
      <thead>
        <tr>
          <th>Nom</th>
          <th>Catégorie</th>
          <th style={{ textAlign: 'right' }}>{colonnePrix}</th>
          {stock && <th style={{ textAlign: 'right' }}>Stock</th>}
          <th style={{ textAlign: 'center' }}>Actif</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {produits.map((produit) => (
          <tr key={produit.id}>
            <td data-titre style={{ fontWeight: 600 }}>{produit.nom}</td>
            <td data-label="Catégorie">
              <select
                className="champ auto"
                style={{ padding: '3px 8px', fontSize: 13, minWidth: 120 }}
                value={produit.categorie || ''}
                onChange={async (e) => {
                  const nouvelleCatId = e.target.value
                  try {
                    await api.patch(`/produits/${produit.id}/`, { categorie: nouvelleCatId })
                    if (onRecharger) await onRecharger()
                  } catch (err) {
                    if (onErreur) onErreur(err.message)
                  }
                }}
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nom}
                  </option>
                ))}
              </select>
            </td>
            <td data-label={colonnePrix} style={{ textAlign: 'right' }}>
              {produit.prix_libre ? (
                <em style={{ color: 'var(--mut)' }}>saisi à la vente</em>
              ) : (
                fcfa(produit.prix_standard)
              )}
            </td>
            {stock && (
              <td data-label="Stock" style={{ textAlign: 'right', fontWeight: 600 }}>
                {produit.stock}
              </td>
            )}
            <td data-label="Actif" style={{ textAlign: 'center' }}>
              {produit.actif ? 'Oui' : 'Non'}
            </td>
            <td data-actions style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              <button className="btn btn-g btn-mini" onClick={() => onEditer(produit)}>
                Modifier
              </button>{' '}
              <button className="x" onClick={() => onSupprimer(produit)} aria-label="Supprimer">
                ✕
              </button>
            </td>
          </tr>
        ))}
        {produits.length === 0 && (
          <tr>
            <td colSpan={stock ? 6 : 5} className="etat">
              Aucun élément.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

const CHEMINS = {
  plats: '/produits/',
  boissons: '/produits/',
  familles: '/familles/',
  categories: '/categories/',
  tables: '/tables/',
}

function Formulaire({ edition, categories, familles, onFerme, onEnregistre, onErreur }) {
  const [valeur, setValeur] = useState(edition.valeur)
  const [envoi, setEnvoi] = useState(false)
  const { type } = edition
  const creation = !valeur.id
  const champ = (nom) => (e) =>
    setValeur({ ...valeur, [nom]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  async function enregistrer(evenement) {
    evenement.preventDefault()
    setEnvoi(true)
    try {
      const corps = { ...valeur }
      if (type === 'plats' || type === 'boissons') {
        corps.prix_standard = corps.prix_libre ? null : Number(corps.prix_standard) || 0
        corps.seuil_alerte = Number(corps.seuil_alerte) || 0
      }
      if (type === 'tables') {
        corps.numero = Number(corps.numero)
        corps.couverts_defaut = Number(corps.couverts_defaut) || 1
      }
      if (type === 'categories') {
        corps.ordre = Number(corps.ordre) || 0
        corps.famille = corps.famille ? Number(corps.famille) : null
      }
      if (type === 'familles') corps.ordre = Number(corps.ordre) || 0
      await (creation ? api.post(CHEMINS[type], corps) : api.patch(`${CHEMINS[type]}${valeur.id}/`, corps))
      await onEnregistre()
    } catch (echec) {
      onErreur(echec.message)
      setEnvoi(false)
    }
  }

  const titres = {
    plats: creation ? 'Nouveau plat' : 'Modifier le plat',
    boissons: creation ? 'Nouvelle boisson' : 'Modifier la boisson',
    familles: creation ? 'Nouvelle famille' : 'Modifier la famille',
    categories: creation ? 'Nouvelle catégorie' : 'Modifier la catégorie',
    tables: creation ? 'Nouvelle table' : 'Modifier la table',
  }

  const categoriesUtiles = categories.filter((categorie) =>
    type === 'plats' ? categorie.rayon === 'cuisine' : categorie.rayon === 'bar',
  )

  // Un <select> affiche sa première option même si l'état ne la porte pas :
  // sans cette synchro, enregistrer envoyait une catégorie nulle.
  useEffect(() => {
    if ((type === 'plats' || type === 'boissons') && !valeur.categorie && categoriesUtiles.length) {
      setValeur((actuelle) => ({ ...actuelle, categorie: categoriesUtiles[0].id }))
    }
  }, [type, valeur.categorie, categoriesUtiles])

  return (
    <Modale titre={titres[type]} largeur={420} onFerme={onFerme}>
      <form onSubmit={enregistrer}>
        {type === 'tables' ? (
          <>
            <label className="lbl">Numéro de table</label>
            <input
              className="champ"
              type="number"
              min="1"
              value={valeur.numero}
              onChange={champ('numero')}
              required
              autoFocus
            />
            <label className="lbl">Couverts par défaut</label>
            <input
              className="champ"
              type="number"
              min="1"
              value={valeur.couverts_defaut}
              onChange={champ('couverts_defaut')}
            />
            <Case libelle="Table active" coche={valeur.active} onChange={champ('active')} />
          </>
        ) : type === 'familles' ? (
          <>
            <label className="lbl">Nom de la famille</label>
            <input
              className="champ"
              value={valeur.nom}
              onChange={champ('nom')}
              placeholder="ex. Alcools, Sans alcool, Restauration"
              required
              autoFocus
            />
            <label className="lbl">Ordre d'affichage</label>
            <input
              className="champ"
              type="number"
              min="0"
              value={valeur.ordre}
              onChange={champ('ordre')}
            />
            <div className="note">
              Une famille regroupe plusieurs catégories. Reliez ensuite chaque catégorie à sa
              famille depuis l'onglet Catégories.
            </div>
          </>
        ) : type === 'categories' ? (
          <>
            <label className="lbl">Nom</label>
            <input className="champ" value={valeur.nom} onChange={champ('nom')} required autoFocus />
            <label className="lbl">Famille</label>
            <select className="champ" value={valeur.famille ?? ''} onChange={champ('famille')}>
              <option value="">— aucune —</option>
              {familles.map((famille) => (
                <option key={famille.id} value={famille.id}>
                  {famille.nom}
                </option>
              ))}
            </select>
            <label className="lbl">Rayon</label>
            <select className="champ" value={valeur.rayon} onChange={champ('rayon')}>
              <option value="bar">Bar — boissons, avec stock</option>
              <option value="cuisine">Cuisine — plats préparés à la commande</option>
            </select>
            <label className="lbl">Ordre d'affichage</label>
            <input
              className="champ"
              type="number"
              min="0"
              value={valeur.ordre}
              onChange={champ('ordre')}
            />
          </>
        ) : (
          <>
            <label className="lbl">Nom</label>
            <input className="champ" value={valeur.nom} onChange={champ('nom')} required autoFocus />
            <label className="lbl">Catégorie</label>
            <select className="champ" value={valeur.categorie} onChange={champ('categorie')} required>
              {categoriesUtiles.map((categorie) => (
                <option key={categorie.id} value={categorie.id}>
                  {categorie.nom}
                </option>
              ))}
            </select>

            <Case
              libelle="Prix saisi à chaque vente"
              coche={valeur.prix_libre}
              onChange={champ('prix_libre')}
            />
            {!valeur.prix_libre && (
              <>
                <label className="lbl">Prix standard (FCFA)</label>
                <input
                  className="champ"
                  type="number"
                  min="0"
                  step="1"
                  value={valeur.prix_standard ?? ''}
                  onChange={champ('prix_standard')}
                  required
                />
              </>
            )}

            <Case
              libelle="Suivre le stock de ce produit"
              coche={valeur.gere_stock}
              onChange={champ('gere_stock')}
            />
            {valeur.gere_stock && (
              <>
                <label className="lbl">Seuil d'alerte</label>
                <input
                  className="champ"
                  type="number"
                  min="0"
                  value={valeur.seuil_alerte}
                  onChange={champ('seuil_alerte')}
                />
              </>
            )}

            <Case
              libelle="Actif — proposé à la vente"
              coche={valeur.actif}
              onChange={champ('actif')}
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

function Case({ libelle, coche, onChange }) {
  return (
    <label className="case">
      <input type="checkbox" checked={!!coche} onChange={onChange} />
      <span>{libelle}</span>
    </label>
  )
}
