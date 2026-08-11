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

function PopUpMessageFlash({ messageFlash, onFerme }) {
  useEffect(() => {
    if (messageFlash) {
      const timer = setTimeout(() => {
        onFerme()
      }, 3500)
      return () => clearTimeout(timer)
    }
  }, [messageFlash, onFerme])

  if (!messageFlash) return null
  const estSucces = messageFlash.type === 'succes'

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
      }}
      onClick={onFerme}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-app, #ffffff)',
          borderRadius: 20,
          padding: '24px 28px',
          maxWidth: 360,
          width: '90%',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
          border: `2px solid ${estSucces ? '#22c55e' : '#ef4444'}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {/* Icône Cercle Vert (Check) ou Cercle Rouge (Cross) exactement comme l'image */}
        {estSucces ? (
          <svg width="60" height="60" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" stroke="#22c55e" strokeWidth="4" />
            <path d="M14 24L21 31L34 17" stroke="#22c55e" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="60" height="60" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" stroke="#ef4444" strokeWidth="4" />
            <path d="M16 16L32 32M32 16L16 32" stroke="#ef4444" strokeWidth="4.5" strokeLinecap="round" />
          </svg>
        )}

        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--noir)', marginTop: 4 }}>
          {estSucces ? 'Succès !' : 'Attention'}
        </div>

        <div style={{ fontSize: 14, fontWeight: 700, color: estSucces ? '#15803d' : '#b91c1c', lineHeight: 1.45 }}>
          {messageFlash.message}
        </div>

        <button
          type="button"
          className="btn"
          style={{
            marginTop: 8,
            width: '100%',
            padding: '11px',
            borderRadius: 12,
            fontWeight: 800,
            fontSize: 14,
            background: estSucces ? '#22c55e' : '#ef4444',
            borderColor: estSucces ? '#22c55e' : '#ef4444',
            color: '#ffffff',
            cursor: 'pointer',
          }}
          onClick={onFerme}
          autoFocus
        >
          {estSucces ? "D'accord" : 'Compris'}
        </button>
      </div>
    </div>
  )
}

export default function Catalogue() {
  const [onglet, setOnglet] = useState('plats')
  const [produits, setProduits] = useState([])
  const [categories, setCategories] = useState([])
  const [familles, setFamilles] = useState([])
  const [tables, setTables] = useState([])
  const [erreur, setErreur] = useState('')
  const [messageFlash, setMessageFlash] = useState(null)
  const [edition, setEdition] = useState(null)
  const [recherche, setRecherche] = useState('')
  const [filtreCategorie, setFiltreCategorie] = useState('')

  async function charger() {
    try {
      const [prods, cats, fams, tbls] = await Promise.all([
        liste('/produits/?page_size=1000'),
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
    if (!window.confirm(`Voulez-vous vraiment supprimer « ${libelle} » ?`)) return
    try {
      await api.delete(chemin)
      await charger()
      setMessageFlash({
        type: 'succes',
        message: `« ${libelle} » a été supprimé avec succès du catalogue.`,
      })
    } catch (echec) {
      const msg = `Impossible de supprimer « ${libelle} » : cet élément est probablement déjà utilisé dans des commandes.`
      setErreur(msg)
      setMessageFlash({
        type: 'erreur',
        message: msg,
      })
    }
  }

  const platsTous = useMemo(
    () => produits.filter((produit) => produit.rayon === 'cuisine'),
    [produits],
  )
  const plats = useMemo(() => {
    const terme = recherche.trim().toLowerCase()
    // Si une recherche est active : cherche dans TOUTES les catégories, ignore le filtre catégorie
    if (terme) return platsTous.filter((p) => p.nom.toLowerCase().includes(terme))
    // Sinon : applique le filtre catégorie pour réduire la liste
    if (filtreCategorie) return platsTous.filter((p) => String(p.categorie) === String(filtreCategorie))
    return platsTous
  }, [platsTous, recherche, filtreCategorie])

  const boissonsToutes = useMemo(
    () => produits.filter((produit) => produit.rayon === 'bar'),
    [produits],
  )
  const boissons = useMemo(() => {
    const terme = recherche.trim().toLowerCase()
    // Si une recherche est active : cherche dans TOUTES les catégories, ignore le filtre catégorie
    if (terme) return boissonsToutes.filter((p) => p.nom.toLowerCase().includes(terme))
    // Sinon : applique le filtre catégorie pour réduire la liste
    if (filtreCategorie) return boissonsToutes.filter((p) => String(p.categorie) === String(filtreCategorie))
    return boissonsToutes
  }, [boissonsToutes, recherche, filtreCategorie])

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

  const categoriesFiltreOption = categories.filter((c) =>
    onglet === 'plats' ? c.rayon === 'cuisine' : c.rayon === 'bar',
  )

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
              setFiltreCategorie('')
            }}
          >
            {libelle} ({compteurs[code] || 0})
          </button>
        ))}
      </div>

      {(onglet === 'boissons' || onglet === 'plats') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {/* Barre de recherche + bouton ajouter */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="champ"
              style={{ flex: 1, minWidth: 200 }}
              placeholder={onglet === 'plats' ? "Rechercher un plat dans toutes les catégories..." : "Rechercher une boisson dans toutes les catégories..."}
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
            {recherche && (
              <button
                type="button"
                className="btn btn-g"
                style={{ padding: '8px 14px', fontSize: 12 }}
                onClick={() => setRecherche('')}
              >
                Effacer
              </button>
            )}
            <button
              className="btn btn-o"
              style={{ fontWeight: 700 }}
              onClick={() => ouvrirAjout(onglet)}
            >
              {libellesAjout[onglet]}
            </button>
          </div>

          {/* Filtres par catégorie — boutons rapides */}
          {!recherche && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', marginRight: 4 }}>
                Filtrer :
              </span>
              <button
                type="button"
                className={`segb ${filtreCategorie === '' ? 'on' : ''}`}
                onClick={() => setFiltreCategorie('')}
              >
                Toutes ({onglet === 'boissons' ? boissonsToutes.length : platsTous.length})
              </button>
              {categoriesFiltreOption.map((c) => {
                const nb = (onglet === 'boissons' ? boissonsToutes : platsTous)
                  .filter((p) => String(p.categorie) === String(c.id)).length
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`segb ${filtreCategorie === String(c.id) ? 'on' : ''}`}
                    onClick={() => setFiltreCategorie(String(c.id))}
                  >
                    {c.nom} ({nb})
                  </button>
                )
              })}
            </div>
          )}

          {/* Indicateur quand la recherche est active */}
          {recherche && (
            <div style={{ fontSize: 12, color: 'var(--mut)', fontStyle: 'italic' }}>
              Recherche dans toutes les catégories pour «&nbsp;<strong style={{ color: 'var(--noir)' }}>{recherche}</strong>&nbsp;»
            </div>
          )}
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
          produits={produits}
          categories={categories}
          familles={familles}
          tables={tables}
          onFerme={() => setEdition(null)}
          onEnregistre={async (flashSucces) => {
            setEdition(null)
            await charger()
            if (flashSucces) {
              setMessageFlash(flashSucces)
            }
          }}
          onErreur={(msg, flashErreur) => {
            setErreur(msg)
            if (flashErreur) {
              setMessageFlash(flashErreur)
            }
          }}
        />
      )}

      {messageFlash && (
        <PopUpMessageFlash
          messageFlash={messageFlash}
          onFerme={() => setMessageFlash(null)}
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

function Formulaire({ edition, produits = [], categories = [], familles = [], tables = [], onFerme, onEnregistre, onErreur }) {
  const [valeur, setValeur] = useState(edition.valeur)
  const [envoi, setEnvoi] = useState(false)
  const [erreurForm, setErreurForm] = useState('')
  const { type } = edition
  const creation = !valeur.id
  const champ = (nom) => (e) =>
    setValeur({ ...valeur, [nom]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  async function enregistrer(evenement) {
    evenement.preventDefault()
    setEnvoi(true)
    setErreurForm('')
    try {
      const corps = { ...valeur }
      if (type === 'plats' || type === 'boissons') {
        if (!corps.nom || !corps.nom.trim()) {
          throw new Error('Le nom du produit est obligatoire.')
        }
        if (!corps.categorie) {
          throw new Error('Veuillez sélectionner une catégorie valide.')
        }
        const existe = produits.some(
          (p) => p.nom.trim().toLowerCase() === corps.nom.trim().toLowerCase() && p.id !== valeur.id
        )
        if (existe) {
          throw new Error(`Le produit « ${corps.nom.trim()} » existe déjà.`)
        }
        corps.prix_standard = corps.prix_libre ? null : Number(corps.prix_standard) || 0
        corps.seuil_alerte = Number(corps.seuil_alerte) || 0
      }
      if (type === 'tables') {
        if (!corps.numero) throw new Error('Veuillez spécifier un numéro de table valide.')
        corps.numero = Number(corps.numero)
        corps.couverts_defaut = Number(corps.couverts_defaut) || 1
        const existe = tables.some(
          (t) => String(t.numero) === String(corps.numero) && t.id !== valeur.id
        )
        if (existe) {
          throw new Error(`La Table N° ${corps.numero} existe déjà.`)
        }
      }
      if (type === 'categories') {
        if (!corps.nom || !corps.nom.trim()) throw new Error('Le nom de la catégorie est obligatoire.')
        const existe = categories.some(
          (c) => c.nom.trim().toLowerCase() === corps.nom.trim().toLowerCase() && c.id !== valeur.id
        )
        if (existe) {
          throw new Error(`La catégorie « ${corps.nom.trim()} » existe déjà.`)
        }
        corps.ordre = Number(corps.ordre) || 0
        corps.famille = corps.famille ? String(corps.famille) : null
      }
      if (type === 'familles') {
        if (!corps.nom || !corps.nom.trim()) throw new Error('Le nom de la famille est obligatoire.')
        const existe = familles.some(
          (f) => f.nom.trim().toLowerCase() === corps.nom.trim().toLowerCase() && f.id !== valeur.id
        )
        if (existe) {
          throw new Error(`La famille « ${corps.nom.trim()} » existe déjà.`)
        }
        corps.ordre = Number(corps.ordre) || 0
      }

      const res = await (creation ? api.post(CHEMINS[type], corps) : api.patch(`${CHEMINS[type]}${valeur.id}/`, corps))
      
      const nomElement = res?.nom || (type === 'tables' ? `Table ${res?.numero || corps.numero}` : corps.nom || 'L\'élément')
      const nomType = {
        plats: 'Le plat',
        boissons: 'La boisson',
        familles: 'La famille',
        categories: 'La catégorie',
        tables: 'La table',
      }[type] || 'L\'élément'

      const actionTxt = creation ? 'créé avec succès et ajouté au catalogue !' : 'mis à jour avec succès !'

      await onEnregistre({
        type: 'succes',
        titre: creation ? '🎉 Ajout réussi !' : '✏️ Modification enregistrée !',
        message: `${nomType} « ${nomElement} » a été ${actionTxt}`,
      })
    } catch (echec) {
      const nomSaisi = (valeur.nom || (type === 'tables' ? `Table ${valeur.numero}` : '')).trim()
      let msgClair = echec.message || 'Une erreur est survenue lors de la sauvegarde.'
      if (msgClair.includes('400') || msgClair.includes('exist') || msgClair.includes('unique') || msgClair.includes('déjà')) {
        msgClair = nomSaisi
          ? `Le produit « ${nomSaisi} » existe déjà.`
          : `Ce produit ou cet élément existe déjà.`
      }
      setErreurForm(msgClair)
      onErreur(msgClair, {
        type: 'erreur',
        titre: '⚠️ Produit déjà existant',
        message: msgClair,
      })
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

  useEffect(() => {
    if ((type === 'plats' || type === 'boissons') && !valeur.categorie && categoriesUtiles.length) {
      setValeur((actuelle) => ({ ...actuelle, categorie: categoriesUtiles[0].id }))
    }
  }, [type, valeur.categorie, categoriesUtiles])

  return (
    <Modale titre={titres[type]} largeur={440} onFerme={onFerme}>
      <form onSubmit={enregistrer}>
        {erreurForm && (
          <div
            style={{
              background: '#fff5f5',
              border: '1.5px solid #feb2b2',
              color: '#c53030',
              padding: '12px 14px',
              borderRadius: 10,
              fontSize: 13,
              marginBottom: 16,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>⚠️</span>
            <span>{erreurForm}</span>
          </div>
        )}
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
