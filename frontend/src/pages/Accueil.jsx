import { useEffect, useState } from 'react'

import { api, fcfa } from '../api'

export default function Accueil() {
  const [bord, setBord] = useState(null)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    api.get('/rapports/tableau-de-bord/').then(setBord).catch((e) => setErreur(e.message))
  }, [])

  if (erreur) return <div className="erreur">{erreur}</div>
  if (!bord) return <div className="etat">Chargement…</div>

  const { revenus } = bord

  return (
    <>
      <div className="top">
        <div>
          <h1>Tableau de bord</h1>
          <div className="sub">{bord.periode}</div>
        </div>
        <div className={`pill ${bord.caisse_ouverte ? 'vert' : ''}`}>
          {bord.caisse_ouverte ? 'Caisse ouverte' : 'Caisse fermée'}
        </div>
      </div>

      <div className="sec-t">Revenus du jour, par source</div>
      <div className="stats">
        <Stat libelle="Ventes bar" valeur={revenus.bar} />
        <Stat libelle="Ventes cuisine" valeur={revenus.cuisine} />
        <Stat libelle="Livraison" valeur={revenus.livraison} />
        <Stat libelle="CA total du jour" valeur={revenus.total} sombre />
      </div>

      <div className="sec-t">Dépenses &amp; résultat</div>
      {/* Pas de grille figée en style en ligne : elle survivrait aux media
          queries et écraserait les montants sur téléphone. */}
      <div className="stats stats-3">
        <Stat libelle="Dépenses" valeur={bord.depenses} />
        <Stat libelle="Résultat net" valeur={bord.resultat_net} sombre />
        <div className="stat wht">
          <div className="l">Commandes encaissées</div>
          <div className="v">{bord.nb_commandes}</div>
        </div>
      </div>

      <div className="card">
        <h3>Stock à surveiller</h3>
        {bord.alertes_stock.length === 0 ? (
          <div className="etat">Aucune alerte — tous les stocks sont au-dessus du seuil.</div>
        ) : (
          bord.alertes_stock.map((alerte) => (
            <span className="tag" key={alerte.produit}>
              {alerte.produit} · {alerte.stock}
            </span>
          ))
        )}
      </div>

      <div className="card">
        <h3>Top ventes</h3>
        {bord.top_ventes.length === 0 ? (
          <div className="etat">Aucune vente encaissée sur la période.</div>
        ) : (
          <table className="grid">
            <tbody>
              {bord.top_ventes.map((ligne, rang) => (
                <tr key={ligne.libelle}>
                  <td>
                    {rang + 1} · {ligne.libelle}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--mut)' }}>{ligne.vendu} ventes</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{fcfa(ligne.ca)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

function Stat({ libelle, valeur, sombre }) {
  return (
    <div className={`stat ${sombre ? 'dark' : 'wht'}`}>
      <div className="l">{libelle}</div>
      <div className="v">{fcfa(valeur)}</div>
    </div>
  )
}
