import { useEffect, useState } from 'react'

import { api, fcfa } from '../api'

export default function Accueil() {
  const [bord, setBord] = useState(null)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    api.get('/rapports/tableau-de-bord/').then(setBord).catch((e) => setErreur(e.message))
  }, [])

  if (erreur) return <div className="erreur">{erreur}</div>
  if (!bord) return <div className="etat">Chargement du tableau de bord…</div>

  const { revenus } = bord

  const chiffreTotal = Math.max(revenus.total, 1)

  // Palette de couleurs 100% issue de la charte du logo (Noir charbon #1e1b1a & Orange ocre #f47c20 / #d9661a / #9a5716)
  const revenuItems = [
    {
      cle: 'bar',
      libelle: 'Ventes Bar',
      valeur: revenus.bar,
      couleur: '#f47c20',
      bg: 'rgba(244, 124, 32, 0.1)',
      pct: Math.round((revenus.bar / chiffreTotal) * 100),
    },
    {
      cle: 'cuisine',
      libelle: 'Ventes Cuisine',
      valeur: revenus.cuisine,
      couleur: '#d9661a',
      bg: 'rgba(217, 102, 26, 0.1)',
      pct: Math.round((revenus.cuisine / chiffreTotal) * 100),
    },
    {
      cle: 'livraison',
      libelle: 'Ventes Livraison',
      valeur: revenus.livraison,
      couleur: '#9a5716',
      bg: 'rgba(154, 87, 22, 0.1)',
      pct: Math.round((revenus.livraison / chiffreTotal) * 100),
    },
  ]

  // Calcul du gradient conique pour le graphique donut
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

  const panierMoyen =
    bord.nb_commandes > 0 ? Math.round(revenus.total / bord.nb_commandes) : 0

  const maxCaTopVente =
    bord.top_ventes && bord.top_ventes.length > 0
      ? Math.max(...bord.top_ventes.map((v) => v.ca || 1))
      : 1

  return (
    <div style={{ paddingBottom: 30 }}>
      {/* En-tête modernisé aux couleurs de la charte logo */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
          background: 'linear-gradient(135deg, #1e1b1a 0%, #2b2523 100%)',
          padding: '24px 28px',
          borderRadius: 20,
          color: '#fff',
          boxShadow: '0 10px 25px rgba(30, 27, 26, 0.25)',
          borderLeft: '5px solid var(--orange)',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--orange)',
              marginBottom: 4,
            }}
          >
            La Marmite du Kloto · {bord.periode}
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: '#fff' }}>
            Tableau de bord
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              padding: '8px 16px',
              borderRadius: 30,
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: bord.caisse_ouverte ? 'rgba(63, 125, 78, 0.25)' : 'rgba(217, 102, 26, 0.25)',
              border: `1px solid ${bord.caisse_ouverte ? 'rgba(63, 125, 78, 0.5)' : 'rgba(217, 102, 26, 0.5)'}`,
              color: bord.caisse_ouverte ? '#81c784' : 'var(--orange-lt)',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: bord.caisse_ouverte ? '#4caf50' : 'var(--orange)',
                boxShadow: bord.caisse_ouverte
                  ? '0 0 0 3px rgba(76, 175, 80, 0.3)'
                  : '0 0 0 3px rgba(244, 124, 32, 0.3)',
              }}
            />
            {bord.caisse_ouverte ? 'Caisse Ouverte' : 'Caisse Fermée'}
          </div>
        </div>
      </div>

      {/* Cartes KPI Principales aux teintes d'ocre du logo */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Carte CA Total */}
        <div
          style={{
            background: 'var(--bg-app, #fff)',
            borderRadius: 18,
            padding: 20,
            border: '1.5px solid var(--bord)',
            boxShadow: '0 4px 12px rgba(30,27,26,0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Chiffre d'affaires total
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--noir)', marginTop: 8 }}>
              {fcfa(revenus.total)}
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            {/* Barre de répartition segmentée */}
            <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: '#f5eee8' }}>
              {revenuItems.map((item) => (
                <div
                  key={item.cle}
                  style={{
                    width: `${item.pct}%`,
                    background: item.couleur,
                    transition: 'width 0.3s ease',
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 6, textAlign: 'right' }}>
              {bord.nb_commandes} commande{bord.nb_commandes > 1 ? 's' : ''} encaissée{bord.nb_commandes > 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Cartes par canal (Bar, Cuisine, Livraison) */}
        {revenuItems.map((item) => (
          <div
            key={item.cle}
            style={{
              background: 'var(--bg-app, #fff)',
              borderRadius: 18,
              padding: 20,
              border: `1.5px solid ${item.couleur}35`,
              boxShadow: '0 4px 12px rgba(30,27,26,0.03)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: item.couleur,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--noir)' }}>{item.libelle}</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: item.bg,
                  color: item.couleur,
                }}
              >
                {item.pct}%
              </span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--noir)', marginTop: 12 }}>
              {fcfa(item.valeur)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--mut)', marginTop: 4 }}>
              Part du chiffre d'affaires
            </div>
          </div>
        ))}
      </div>

      {/* Grille du Milieu : Synthèse financière & Graphique Donut */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
          gap: 20,
          marginBottom: 24,
        }}
      >
        {/* Colonne Gauche : Dépenses & Résultat */}
        <div
          style={{
            background: 'var(--bg-app, #fff)',
            borderRadius: 20,
            padding: 24,
            border: '1.5px solid var(--bord)',
            boxShadow: '0 4px 16px rgba(30,27,26,0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--noir)', marginBottom: 16 }}>
            Bilan Financier du Jour
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
            }}
          >
            {/* Stat Dépenses */}
            <div
              style={{
                padding: 16,
                borderRadius: 14,
                background: 'rgba(154,87,22,0.07)',
                border: '1px solid rgba(154,87,22,0.18)',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tint-tx)' }}>Dépenses</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--tint-tx)', marginTop: 4 }}>
                {fcfa(bord.depenses)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 4 }}>Sorties de caisse</div>
            </div>

            {/* Stat Résultat Net */}
            <div
              style={{
                padding: 16,
                borderRadius: 14,
                background: bord.resultat_net >= 0 ? 'rgba(244,124,32,0.1)' : 'rgba(217,102,26,0.15)',
                border: `1px solid ${bord.resultat_net >= 0 ? 'var(--tint-bd)' : 'rgba(217,102,26,0.3)'}`,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--orange-dk)' }}>
                Résultat Net
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: 'var(--orange-dk)',
                  marginTop: 4,
                }}
              >
                {fcfa(bord.resultat_net)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 4 }}>CA minus Dépenses</div>
            </div>

            {/* Stat Panier Moyen */}
            <div
              style={{
                padding: 16,
                borderRadius: 14,
                background: 'rgba(30,27,26,0.04)',
                border: '1px solid var(--bord)',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--noir)' }}>Panier Moyen</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--noir)', marginTop: 4 }}>
                {fcfa(panierMoyen)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 4 }}>Par commande</div>
            </div>
          </div>

          <div
            style={{
              marginTop: 20,
              padding: '12px 16px',
              borderRadius: 12,
              background: 'var(--tint)',
              border: '1px solid var(--tint-bd)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 13,
            }}
          >
            <span style={{ color: 'var(--tint-tx)', fontWeight: 600 }}>
              Volume total des commandes traitées
            </span>
            <span style={{ fontWeight: 800, color: 'var(--noir)', fontSize: 15 }}>
              {bord.nb_commandes} commande{bord.nb_commandes > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Colonne Droite : Donut Chart Répartition */}
        <div
          style={{
            background: 'var(--bg-app, #fff)',
            borderRadius: 20,
            padding: 24,
            border: '1.5px solid var(--bord)',
            boxShadow: '0 4px 16px rgba(30,27,26,0.04)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--noir)', marginBottom: 18, alignSelf: 'flex-start' }}>
            Répartition par Source
          </div>

          <div
            style={{
              width: 170,
              height: 170,
              borderRadius: '50%',
              position: 'relative',
              backgroundImage: `conic-gradient(${donutGradient})`,
              boxShadow: '0 6px 20px rgba(244,124,32,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                background: 'var(--bg-app, #fff)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--noir)', lineHeight: 1.1 }}>
                {fcfa(revenus.total)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--mut)', marginTop: 2, fontWeight: 600 }}>
                Total encaissé
              </span>
            </div>
          </div>

          {/* Légende du graphique */}
          <div
            style={{
              display: 'flex',
              gap: 16,
              marginTop: 20,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            {revenuItems.map((item) => (
              <div key={item.cle} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: item.couleur,
                  }}
                />
                <span style={{ color: 'var(--noir)' }}>{item.libelle}</span>
                <span style={{ color: 'var(--mut)', fontWeight: 500 }}>({item.pct}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Ventes */}
      <div
        style={{
          background: 'var(--bg-app, #fff)',
          borderRadius: 20,
          padding: 24,
          border: '1.5px solid var(--bord)',
          boxShadow: '0 4px 16px rgba(30,27,26,0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--noir)' }}>
              Top Ventes Plats &amp; Boissons
            </h3>
            <div style={{ fontSize: 12, color: 'var(--mut)', marginTop: 2 }}>
              Classement par chiffre d'affaires généré
            </div>
          </div>
        </div>

        {bord.top_ventes.length === 0 ? (
          <div className="etat" style={{ padding: '30px 0' }}>
            Aucune vente encaissée sur la période.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {bord.top_ventes.map((ligne, rang) => {
              const pctPopularite = Math.round(((ligne.ca || 0) / maxCaTopVente) * 100)
              const estTop3 = rang < 3

              return (
                <div
                  key={ligne.libelle}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: estTop3 ? 'rgba(244,124,32,0.04)' : '#fbf8f5',
                    border: `1px solid ${estTop3 ? 'var(--tint-bd)' : 'var(--bord)'}`,
                    gap: 16,
                  }}
                >
                  {/* Rang + Nom du produit */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background:
                          rang === 0
                            ? 'var(--orange)'
                            : rang === 1
                            ? 'var(--orange-dk)'
                            : rang === 2
                            ? '#9a5716'
                            : 'var(--bord)',
                        color: rang < 3 ? '#fff' : 'var(--noir)',
                        fontSize: 12,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {rang + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 14,
                          color: 'var(--noir)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ligne.libelle}
                      </div>
                      {/* Barre relative de popularité aux couleurs ocre */}
                      <div
                        style={{
                          height: 4,
                          width: '100%',
                          maxWidth: 180,
                          background: 'var(--bord)',
                          borderRadius: 2,
                          marginTop: 5,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${pctPopularite}%`,
                            background: rang === 0 ? 'var(--orange)' : 'var(--orange-dk)',
                            borderRadius: 2,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Nombre de ventes */}
                  <div
                    style={{
                      padding: '4px 10px',
                      borderRadius: 20,
                      background: 'var(--bg-app, #fff)',
                      border: '1px solid var(--bord)',
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--mut)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {ligne.vendu} vente{ligne.vendu > 1 ? 's' : ''}
                  </div>

                  {/* Montant total du produit */}
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: 'var(--noir)',
                      minWidth: 100,
                      textAlign: 'right',
                    }}
                  >
                    {fcfa(ligne.ca)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
