import { useEffect, useState } from 'react'

import { api, fcfa } from '../api'
import FeuilleGestion from '../composants/FeuilleGestion'

const PERIODES = [
  ['jour', 'Jour'],
  ['semaine', 'Semaine'],
  ['mois', 'Mois'],
]

const RAPPORTS = [
  { code: 'bar', titre: 'Ventes bar', resume: 'Réception, vendu, restant, CA' },
  { code: 'cuisine', titre: 'Ventes cuisine', resume: 'Plats vendus et CA' },
  { code: 'livraisons', titre: 'Livraisons', resume: 'Par livreur et CA' },
  { code: 'revenus', titre: 'Revenus par source', resume: 'Synthèse des recettes' },
  { code: 'depenses', titre: 'Dépenses par catégorie', resume: 'Ligne par ligne' },
  { code: 'produits', titre: 'Produits les plus vendus', resume: 'Classement de la période' },
]

export default function Rapports() {
  const [periode, setPeriode] = useState('jour')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [bord, setBord] = useState(null)
  const [erreur, setErreur] = useState('')
  const [feuille, setFeuille] = useState(null)
  const [chargement, setChargement] = useState(null)

  const requete = `?periode=${periode}&date=${date}`

  useEffect(() => {
    setBord(null)
    api
      .get(`/rapports/tableau-de-bord/${requete}`)
      .then(setBord)
      .catch((echec) => setErreur(echec.message))
  }, [requete])

  async function ouvrir(code) {
    setErreur('')
    setChargement(code)
    try {
      setFeuille(await construire(code, requete))
    } catch (echec) {
      setErreur(echec.message)
    } finally {
      setChargement(null)
    }
  }

  return (
    <>
      <div className="top">
        <div>
          <h1>Rapports</h1>
          <div className="sub">{bord?.periode ?? 'Chargement…'}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="seg">
            {PERIODES.map(([code, libelle]) => (
              <button
                key={code}
                className={`segb ${periode === code ? 'on' : ''}`}
                onClick={() => setPeriode(code)}
              >
                {libelle}
              </button>
            ))}
          </div>
          <input
            className="champ auto"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {erreur && <div className="erreur">{erreur}</div>}

      {bord && (
        <div className="stats">
          <div className="stat wht">
            <div className="l">Chiffre d'affaires</div>
            <div className="v">{fcfa(bord.revenus.total)}</div>
          </div>
          <div className="stat wht">
            <div className="l">Dépenses</div>
            <div className="v">{fcfa(bord.depenses)}</div>
          </div>
          <div className="stat dark">
            <div className="l">Résultat net</div>
            <div className="v">{fcfa(bord.resultat_net)}</div>
          </div>
          <div className="stat wht">
            <div className="l">Commandes</div>
            <div className="v">{bord.nb_commandes}</div>
          </div>
        </div>
      )}

      <div className="sec-t">Rapports détaillés — consultables et imprimables</div>
      <div className="rep-index">
        {RAPPORTS.map((rapport) => (
          <button key={rapport.code} className="rep-card" onClick={() => ouvrir(rapport.code)}>
            <div>
              <div className="rc-t">{rapport.titre}</div>
              <div className="rc-s">
                {chargement === rapport.code ? 'Ouverture…' : rapport.resume}
              </div>
            </div>
            <span className="chev">›</span>
          </button>
        ))}
      </div>

      <div className="card">
        <h3>Bilan complet de la période</h3>
        <div className="note" style={{ marginTop: 0 }}>
          Recettes, dépenses et résultat sur une seule feuille, avec les cases de signature.
        </div>
        <button
          className="btn btn-o"
          style={{ marginTop: 14 }}
          disabled={chargement === 'bilan'}
          onClick={() => ouvrir('bilan')}
        >
          {chargement === 'bilan' ? 'Ouverture…' : 'Éditer le bilan'}
        </button>
      </div>

      {feuille && <FeuilleGestion {...feuille} onFerme={() => setFeuille(null)} />}
    </>
  )
}

// Deux façons légitimes de compter, à ne surtout pas confondre :
//   — par produit (ce rapport) : tout ce qui est sorti, quel que soit le canal ;
//   — par source (rapport des revenus) : une livraison compte en « livraison »,
//     boissons comprises, pour que les trois sources s'additionnent au CA.
// Sans cette note, deux rapports affichaient « CA bar » avec deux montants.
const PORTEE_PRODUIT =
  'Ce total compte les ventes sur place, à emporter et en livraison. Dans le rapport ' +
  'des revenus, les livraisons forment une source à part : les deux montants diffèrent ' +
  'donc, sans se contredire.'

/** Chaque rapport se réduit à la même forme : un titre, des KPI, des blocs.
 *  C'est ce qui permet à FeuilleGestion de tous les rendre sans les connaître. */
async function construire(code, requete) {
  if (code === 'bar') {
    const donnees = await api.get(`/rapports/bar/${requete}`)
    return {
      titre: 'Rapport — Ventes bar',
      periode: donnees.periode,
      kpis: [
        { libelle: 'Ventes de boissons', valeur: donnees.ca_total, accent: true },
        { libelle: 'Références vendues', valeur: donnees.lignes.length, brut: true },
      ],
      blocs: [
        {
          titre: 'Détail par boisson · réception, ventes, stock restant, CA',
          large: true,
          colonnes: ['Produit', 'Catégorie', 'Reçu', 'Vendu', 'Restant', 'CA'],
          colonnesTexte: 2,
          rangs: [
            ...donnees.lignes.map((ligne) => [
              ligne.produit,
              ligne.categorie,
              ligne.recu,
              ligne.vendu,
              ligne.restant,
              fcfa(ligne.ca),
            ]),
            {
              total: true,
              cellules: ['Total boissons vendues', '', '', '', '', fcfa(donnees.ca_total)],
            },
          ],
        },
      ],
      note: PORTEE_PRODUIT,
    }
  }

  if (code === 'cuisine') {
    const donnees = await api.get(`/rapports/cuisine/${requete}`)
    return {
      titre: 'Rapport — Ventes cuisine',
      periode: donnees.periode,
      kpis: [
        { libelle: 'Ventes de nourriture', valeur: donnees.ca_total, accent: true },
        {
          libelle: 'Plats vendus',
          valeur: donnees.lignes.reduce((somme, ligne) => somme + ligne.vendu, 0),
          brut: true,
        },
      ],
      blocs: [
        {
          titre: 'Détail par plat · quantité vendue et CA',
          large: true,
          colonnes: ['Plat', 'Vendu', 'CA'],
          rangs: [
            ...donnees.lignes.map((ligne) => [ligne.libelle, ligne.vendu, fcfa(ligne.ca)]),
            { total: true, cellules: ['Total nourriture vendue', '', fcfa(donnees.ca_total)] },
          ],
        },
      ],
      note: `La nourriture est préparée à la commande : il n'y a pas de stock de plats. ${PORTEE_PRODUIT}`,
    }
  }

  if (code === 'livraisons') {
    const donnees = await api.get(`/rapports/livraisons/${requete}`)
    const courses = donnees.lignes.reduce((somme, ligne) => somme + ligne.livraisons, 0)
    const total = donnees.lignes.reduce((somme, ligne) => somme + (ligne.ca ?? 0), 0)
    return {
      titre: 'Rapport — Livraisons',
      periode: donnees.periode,
      kpis: [
        { libelle: 'CA livraisons', valeur: total, accent: true },
        { libelle: 'Courses', valeur: courses, brut: true },
      ],
      blocs: [
        {
          titre: 'Détail par livreur',
          large: true,
          colonnes: ['Livreur', 'Livraisons', 'CA'],
          rangs: [
            ...donnees.lignes.map((ligne) => [
              ligne.livreur_nom ?? 'Non attribué',
              ligne.livraisons,
              fcfa(ligne.ca ?? 0),
            ]),
            { total: true, cellules: [`Total (${courses} livraisons)`, '', fcfa(total)] },
          ],
        },
      ],
    }
  }

  if (code === 'revenus') {
    const donnees = await api.get(`/rapports/revenus/${requete}`)
    const { revenus } = donnees
    return {
      titre: 'Rapport — Revenus par source',
      periode: donnees.periode,
      kpis: [
        { libelle: 'Bar', valeur: revenus.bar },
        { libelle: 'Cuisine', valeur: revenus.cuisine },
        { libelle: 'Livraison', valeur: revenus.livraison },
        { libelle: "Chiffre d'affaires", valeur: revenus.total, accent: true },
      ],
      blocs: [
        {
          titre: 'Recettes par source',
          lignes: [
            { libelle: 'Ventes bar (boissons)', valeur: revenus.bar },
            { libelle: 'Ventes cuisine (nourriture)', valeur: revenus.cuisine },
            { libelle: 'Livraisons', valeur: revenus.livraison },
            { libelle: "Chiffre d'affaires", valeur: revenus.total, total: true },
          ],
        },
        {
          titre: 'Détail du bar par catégorie',
          lignes: [
            ...donnees.detail_bar.map((ligne) => ({
              libelle: ligne.categorie,
              valeur: ligne.ca,
            })),
            { libelle: 'Total bar', valeur: revenus.bar, total: true },
          ],
        },
      ],
      bandeau: { libelle: "Chiffre d'affaires de la période", valeur: revenus.total },
      note:
        'Une commande livrée compte intégralement en « livraison », boissons comprises, ' +
        'pour que les trois sources s’additionnent exactement au chiffre d’affaires.',
    }
  }

  if (code === 'depenses') {
    const donnees = await api.get(`/rapports/depenses/${requete}`)
    const libelles = Object.fromEntries(
      donnees.par_categorie.map((ligne) => [ligne.categorie, ligne.libelle]),
    )
    return {
      titre: 'Rapport — Dépenses',
      periode: donnees.periode,
      kpis: [
        { libelle: 'Total dépenses', valeur: donnees.total, accent: true },
        { libelle: 'Écritures', valeur: donnees.detail.length, brut: true },
      ],
      blocs: [
        {
          titre: 'Par catégorie',
          lignes: [
            ...donnees.par_categorie.map((ligne) => ({
              libelle: ligne.libelle,
              valeur: ligne.montant,
            })),
            { libelle: 'Total dépenses', valeur: donnees.total, total: true },
          ],
        },
        {
          titre: 'Ligne par ligne',
          lignes: donnees.detail.map((ligne) => ({
            libelle: `${libelles[ligne.categorie] ?? ligne.categorie} — ${ligne.description || '—'}`,
            valeur: ligne.montant,
          })),
        },
      ],
    }
  }

  if (code === 'produits') {
    const donnees = await api.get(`/rapports/produits/${requete}`)
    return {
      titre: 'Produits les plus vendus',
      periode: donnees.periode,
      kpis: [
        {
          libelle: 'Unités vendues',
          valeur: donnees.lignes.reduce((somme, ligne) => somme + ligne.vendu, 0),
          brut: true,
        },
        {
          libelle: 'CA du classement',
          valeur: donnees.lignes.reduce((somme, ligne) => somme + ligne.ca, 0),
          accent: true,
        },
      ],
      blocs: [
        {
          titre: 'Classement de la période',
          large: true,
          colonnes: ['Rang', 'Produit', 'Vendu', 'CA'],
          colonnesTexte: 2,
          rangs: donnees.lignes.map((ligne, rang) => [
            rang + 1,
            ligne.libelle,
            ligne.vendu,
            fcfa(ligne.ca),
          ]),
        },
      ],
    }
  }

  // Bilan complet : la même feuille que la clôture, mais sans l'arrêté de caisse,
  // qui n'a de sens que pour une journée.
  const donnees = await api.get(`/rapports/cloture/${requete}`)
  return {
    titre: 'Rapport de gestion',
    periode: donnees.periode,
    kpis: [
      { libelle: "Chiffre d'affaires", valeur: donnees.revenus.total },
      { libelle: 'Dépenses', valeur: donnees.total_depenses },
      { libelle: 'Résultat net', valeur: donnees.resultat_net, accent: true },
      { libelle: 'Commandes', valeur: donnees.nb_commandes, brut: true },
    ],
    bandeau: { libelle: 'Résultat net de la période', valeur: donnees.resultat_net },
    blocs: [
      {
        titre: 'Recettes par source',
        lignes: [
          { libelle: 'Ventes bar', valeur: donnees.revenus.bar },
          { libelle: 'Ventes cuisine', valeur: donnees.revenus.cuisine },
          { libelle: 'Livraisons', valeur: donnees.revenus.livraison },
          { libelle: "Chiffre d'affaires", valeur: donnees.revenus.total, total: true },
        ],
      },
      {
        titre: 'Dépenses par catégorie',
        lignes: [
          ...donnees.depenses_par_categorie.map((ligne) => ({
            libelle: ligne.libelle,
            valeur: ligne.montant,
          })),
          { libelle: 'Total dépenses', valeur: donnees.total_depenses, total: true },
        ],
      },
      {
        titre: 'Recettes par mode de paiement',
        lignes: donnees.recettes_par_mode.map((ligne) => ({
          libelle: ligne.libelle,
          valeur: ligne.montant,
        })),
      },
    ],
  }
}
