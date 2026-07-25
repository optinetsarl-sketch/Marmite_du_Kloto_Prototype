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

  const revenuItems = [
    { cle: 'bar', libelle: 'Bar', valeur: revenus.bar, couleur: 'var(--orange)' },
    { cle: 'cuisine', libelle: 'Cuisine', valeur: revenus.cuisine, couleur: 'var(--vert)' },
    { cle: 'livraison', libelle: 'Livraison', valeur: revenus.livraison, couleur: 'var(--jaune)' },
  ]

  const chiffreTotal = Math.max(revenus.total, 1)
  const donutGradient = revenuItems
    .map((item, index) => {
      const debut = revenuItems
        .slice(0, index)
        .reduce((s, precedent) => s + precedent.valeur, 0)
      const debutPct = Math.round((debut / chiffreTotal) * 10000) / 100
      const finPct = Math.round(((debut + item.valeur) / chiffreTotal) * 10000) / 100
      return `${item.couleur} ${debutPct}% ${finPct}%`
    })
    .join(', ')

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

      <div className="dashboard-grid">
        <div className="dashboard-card dash-summary">
          <div className="dash-title">Chiffre d'affaires</div>
          <div className="dash-total">{fcfa(revenus.total)}</div>
          <div className="dash-note">Répartition par source et progrès du jour</div>
          <div className="dash-pill-row">
            {revenuItems.map((item) => (
              <div className="dash-pill" key={item.cle} style={{ borderColor: item.couleur }}>
                <span className="dash-dot" style={{ background: item.couleur }} />
                <div>
                  <div className="dash-pill-label">{item.libelle}</div>
                  <div className="dash-pill-value">{fcfa(item.valeur)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-card dash-graph">
          <div className="dash-title">Répartition visuelle</div>
          <div className="donut-chart" style={{ backgroundImage: `conic-gradient(${donutGradient})` }}>
            <div className="donut-center">
              <strong>{fcfa(revenus.total)}</strong>
              <span>CA total</span>
            </div>
          </div>
          <div className="chart-legend">
            {revenuItems.map((item) => (
              <div className="chart-legend-item" key={item.cle}>
                <span className="legend-dot" style={{ background: item.couleur }} />
                <span>{item.libelle}</span>
              </div>
            ))}
          </div>
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
