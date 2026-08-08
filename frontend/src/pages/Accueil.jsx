import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { api, fcfa } from '../api'
import { useAuth } from '../auth-contexte'

/* ─────────────────────────────────────────────────────────────────────────
   COMPOSANT : Graphique Donut SVG Vectoriel & Élégant
   ───────────────────────────────────────────────────────────────────────── */
function GraphiqueDonutSVG({ items, total, libelleCentre }) {
  let angleCumule = 0
  const rayonInt = 60
  const rayonExt = 85
  const centre = 100

  const arcs = items.map((item) => {
    const fraction = total > 0 ? item.valeur / total : 0
    const angle = fraction * 360
    const angleStart = angleCumule
    const angleEnd = angleCumule + angle
    angleCumule += angle

    // Conversion coordonnées polaires -> cartésiennes
    const radStart = ((angleStart - 90) * Math.PI) / 180
    const radEnd = ((angleEnd - 90) * Math.PI) / 180

    const x1_ext = centre + rayonExt * Math.cos(radStart)
    const y1_ext = centre + rayonExt * Math.sin(radStart)
    const x2_ext = centre + rayonExt * Math.cos(radEnd)
    const y2_ext = centre + rayonExt * Math.sin(radEnd)

    const x1_int = centre + rayonInt * Math.cos(radStart)
    const y1_int = centre + rayonInt * Math.sin(radStart)
    const x2_int = centre + rayonInt * Math.cos(radEnd)
    const y2_int = centre + rayonInt * Math.sin(radEnd)

    const grandArc = angle > 180 ? 1 : 0

    const pathData = [
      `M ${x1_ext} ${y1_ext}`,
      `A ${rayonExt} ${rayonExt} 0 ${grandArc} 1 ${x2_ext} ${y2_ext}`,
      `L ${x2_int} ${y2_int}`,
      `A ${rayonInt} ${rayonInt} 0 ${grandArc} 0 ${x1_int} ${y1_int}`,
      'Z',
    ].join(' ')

    return { ...item, pathData, fraction }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <div style={{ position: 'relative', width: 200, height: 200 }}>
        <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
          <defs>
            <filter id="shadow-donut" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.08" />
            </filter>
          </defs>
          <circle cx="100" cy="100" r={rayonExt} fill="#f5eee8" />
          {arcs.map((arc, i) => (
            <path
              key={i}
              d={arc.pathData}
              fill={arc.couleur}
              style={{ transition: 'all 0.4s ease', cursor: 'pointer' }}
              filter="url(#shadow-donut)"
            />
          ))}
          <circle cx="100" cy="100" r={rayonInt} fill="var(--bg-app, #ffffff)" />
        </svg>

        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--noir)', lineHeight: 1.1 }}>
            {fcfa(total)}
          </span>
          <span style={{ fontSize: 11, color: 'var(--mut)', marginTop: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {libelleCentre || 'Total Encaissé'}
          </span>
        </div>
      </div>

      {/* Légende interactive */}
      <div style={{ display: 'flex', gap: 16, marginTop: 18, justifyContent: 'center', flexWrap: 'wrap' }}>
        {items.map((item) => (
          <div key={item.cle} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.couleur, display: 'inline-block' }} />
            <span style={{ color: 'var(--noir)' }}>{item.libelle}</span>
            <span style={{ color: 'var(--mut)', fontWeight: 500 }}>({item.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   PAGE PRINCIPALE ACCUEIL
   ───────────────────────────────────────────────────────────────────────── */
export default function Accueil() {
  const { utilisateur } = useAuth()
  const estAdmin = Boolean(utilisateur?.is_admin || utilisateur?.role === 'admin')

  const [bord, setBord] = useState(null)
  const [activite, setActivite] = useState(null)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    if (estAdmin) {
      api.get('/rapports/tableau-de-bord/').then(setBord).catch((e) => setErreur(e.message))
    } else {
      api.get('/rapports/activite-gerant/').then(setActivite).catch((e) => setErreur(e.message))
    }
  }, [estAdmin])

  // ─────────────────────────────────────────────────────────────────────────
  // VUE GÉRANT (Activité Opérationnelle Élégante sans Émojis)
  // ─────────────────────────────────────────────────────────────────────────
  if (!estAdmin) {
    if (erreur) return <div className="erreur">{erreur}</div>
    if (!activite) return <div className="etat">Chargement du tableau de bord gérant…</div>

    const totalArticles = Math.max(activite.sections.total, 1)
    const sectionItems = [
      { key: 'cuisine', libelle: 'Cuisine & Restauration', quantite: activite.sections.cuisine, couleur: '#d9661a', pct: Math.round((activite.sections.cuisine / totalArticles) * 100) },
      { key: 'bar', libelle: 'Bar & Boissons', quantite: activite.sections.bar, couleur: '#f47c20', pct: Math.round((activite.sections.bar / totalArticles) * 100) },
      { key: 'livraison', libelle: 'Livraisons & Emporter', quantite: activite.sections.livraison, couleur: '#9a5716', pct: Math.round((activite.sections.livraison / totalArticles) * 100) },
    ]

    const maxVendu = activite.top_produits.length > 0 ? Math.max(...activite.top_produits.map((p) => p.vendu)) : 1

    return (
      <div style={{ paddingBottom: 30 }}>
        {/* En-tête Espace Gérant */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1e1b1a 0%, #2b2523 100%)',
            padding: '24px 28px',
            borderRadius: 20,
            color: '#fff',
            boxShadow: '0 10px 25px rgba(30, 27, 26, 0.25)',
            borderLeft: '5px solid var(--orange)',
            marginBottom: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'var(--orange)',
                marginBottom: 4,
              }}
            >
              ESPACE GÉRANT · {activite.periode}
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: '#fff', letterSpacing: '-0.02em' }}>
              La Marmite du Kloto
            </h1>
            <div style={{ fontSize: 13, color: '#b7ada6', marginTop: 4 }}>
              Bienvenue, {utilisateur?.nom || 'Gérant'} — Aperçu de l'activité du jour
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div
              style={{
                padding: '8px 16px',
                borderRadius: 30,
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: activite.caisse_ouverte ? 'rgba(63, 125, 78, 0.25)' : 'rgba(217, 102, 26, 0.25)',
                border: `1px solid ${activite.caisse_ouverte ? 'rgba(63, 125, 78, 0.5)' : 'rgba(217, 102, 26, 0.5)'}`,
                color: activite.caisse_ouverte ? '#81c784' : 'var(--orange-lt)',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: activite.caisse_ouverte ? '#4caf50' : 'var(--orange)',
                  boxShadow: activite.caisse_ouverte
                    ? '0 0 0 3px rgba(76, 175, 80, 0.3)'
                    : '0 0 0 3px rgba(244, 124, 32, 0.3)',
                }}
              />
              {activite.caisse_ouverte ? 'Session de Caisse Ouverte' : 'Session de Caisse Fermée'}
            </div>

            <div style={{ background: 'rgba(255,255,255,0.08)', padding: '10px 18px', borderRadius: 14, textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#B7ADA6', fontWeight: 700, letterSpacing: '0.05em' }}>Commandes du jour</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--orange)', lineHeight: 1.1, marginTop: 2 }}>{activite.nb_commandes}</div>
            </div>
          </div>
        </div>

        {/* Accès Opérationnels Rapides */}
        <div
          style={{
            background: 'var(--bg-app, #fff)',
            borderRadius: 20,
            padding: 22,
            border: '1.5px solid var(--bord)',
            boxShadow: '0 4px 16px rgba(30,27,26,0.04)',
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--noir)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Accès Opérationnels
            </h3>
            <span style={{ fontSize: 12, color: 'var(--mut)', fontWeight: 600 }}>Raccourcis de gestion</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Link
              to="/ventes"
              className="btn btn-o"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '14px 16px',
                borderRadius: 14,
                textDecoration: 'none',
                boxShadow: '0 4px 12px rgba(244,124,32,0.15)',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Ventes &amp; Caisse</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2, fontWeight: 500 }}>Saisie des commandes &amp; encaissement</span>
            </Link>

            <Link
              to="/tables"
              className="btn btn-g"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '14px 16px',
                borderRadius: 14,
                textDecoration: 'none',
                background: '#fff',
                border: '1.5px solid var(--bord)',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--noir)' }}>Plan de Salle</span>
              <span style={{ fontSize: 11, color: 'var(--mut)', marginTop: 2, fontWeight: 500 }}>Gestion visuelle des tables sur place</span>
            </Link>

            <Link
              to="/cuisine"
              className="btn btn-g"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '14px 16px',
                borderRadius: 14,
                textDecoration: 'none',
                background: '#fff',
                border: '1.5px solid var(--bord)',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--noir)' }}>Poste Cuisine</span>
              <span style={{ fontSize: 11, color: 'var(--mut)', marginTop: 2, fontWeight: 500 }}>Suivi des bons et temps de préparation</span>
            </Link>

            <Link
              to="/livraison"
              className="btn btn-g"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '14px 16px',
                borderRadius: 14,
                textDecoration: 'none',
                background: '#fff',
                border: '1.5px solid var(--bord)',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--noir)' }}>Livraisons</span>
              <span style={{ fontSize: 11, color: 'var(--mut)', marginTop: 2, fontWeight: 500 }}>Dispatching &amp; suivi des livreurs</span>
            </Link>

            <Link
              to="/cloture"
              className="btn btn-g"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '14px 16px',
                borderRadius: 14,
                textDecoration: 'none',
                background: 'rgba(30,27,26,0.03)',
                border: '1.5px solid var(--bord)',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--noir)' }}>Clôture du Jour</span>
              <span style={{ fontSize: 11, color: 'var(--mut)', marginTop: 2, fontWeight: 500 }}>Arrêté de caisse &amp; rapport du jour</span>
            </Link>
          </div>
        </div>

        {/* Graphiques Élégants d'Activité Opérationnelle */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
          
          {/* GRAPHE 1 : Répartition par Rayon (Articles vendus) */}
          <div
            style={{
              background: 'var(--bg-app, #fff)',
              borderRadius: 20,
              padding: 24,
              border: '1.5px solid var(--bord)',
              boxShadow: '0 4px 16px rgba(30,27,26,0.04)',
              display: 'flex',
              flexDirection: 'column',
              justify: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--noir)' }}>
                  Activité par Rayon
                </h3>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--orange-dk)', background: 'rgba(244,124,32,0.1)', padding: '3px 10px', borderRadius: 12 }}>
                  {activite.sections.total} articles
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 10 }}>
                {sectionItems.map((sec) => (
                  <div key={sec.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                      <span style={{ color: 'var(--noir)' }}>{sec.libelle}</span>
                      <span style={{ color: sec.couleur }}>
                        {sec.quantite} unité{sec.quantite > 1 ? 's' : ''} ({sec.pct}%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: 10, background: '#f5eee8', borderRadius: 8, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${sec.pct}%`,
                          height: '100%',
                          background: `linear-gradient(90deg, ${sec.couleur}, #1e1b1a)`,
                          borderRadius: 8,
                          transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 24, paddingTop: 14, borderTop: '1px solid var(--bord)', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--mut)' }}>
              <span>Volume total servi aujourd'hui</span>
              <strong style={{ color: 'var(--noir)' }}>{activite.sections.total} articles enregistrés</strong>
            </div>
          </div>

          {/* GRAPHE 2 : Classement des Articles les Plus Vendus */}
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
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--noir)' }}>
                Articles les Plus Vendus
              </h3>
              <span style={{ fontSize: 12, color: 'var(--mut)', fontWeight: 600 }}>Top 6 des ventes</span>
            </div>

            {activite.top_produits.length === 0 ? (
              <div className="etat" style={{ padding: 30 }}>Aucune vente enregistrée aujourd'hui.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {activite.top_produits.map((item, index) => {
                  const pct = Math.round((item.vendu / maxVendu) * 100)
                  return (
                    <div key={index}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 6,
                              background: index === 0 ? 'var(--orange)' : index === 1 ? 'var(--orange-dk)' : 'var(--bord)',
                              color: index < 2 ? '#fff' : 'var(--noir)',
                              fontSize: 11,
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            0{index + 1}
                          </span>
                          <span>{item.libelle}</span>
                        </div>
                        <span style={{ color: 'var(--orange-dk)', fontWeight: 800 }}>
                          {item.vendu} unité{item.vendu > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div style={{ width: '100%', height: 8, background: '#f5eee8', borderRadius: 6, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #f47c20, #d9661a)',
                            borderRadius: 6,
                            transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VUE ADMIN (Tableau de Bord Exécutif & Financier)
  // ─────────────────────────────────────────────────────────────────────────
  if (erreur) return <div className="erreur">{erreur}</div>
  if (!bord) return <div className="etat">Chargement du tableau de bord administration…</div>

  const { revenus } = bord
  const chiffreTotal = Math.max(revenus.total, 1)

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

  const panierMoyen = bord.nb_commandes > 0 ? Math.round(revenus.total / bord.nb_commandes) : 0
  const maxCaTopVente = bord.top_ventes && bord.top_ventes.length > 0 ? Math.max(...bord.top_ventes.map((v) => v.ca || 1)) : 1

  return (
    <div style={{ paddingBottom: 30 }}>
      {/* En-tête Administrateur */}
      <div
        style={{
          display: 'flex',
          justify: 'space-between',
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
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--orange)',
              marginBottom: 4,
            }}
          >
            ADMINISTRATION · {bord.periode}
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: '#fff', letterSpacing: '-0.02em' }}>
            Tableau de bord Général
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              padding: '8px 16px',
              borderRadius: 30,
              fontSize: 12,
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
            {bord.caisse_ouverte ? 'Session de Caisse Ouverte' : 'Session de Caisse Fermée'}
          </div>
        </div>
      </div>

      {/* Cartes KPI Principales */}
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
            justify: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Chiffre d'affaires total
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--noir)', marginTop: 8 }}>
              {fcfa(revenus.total)}
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: '#f5eee8' }}>
              {revenuItems.map((item) => (
                <div key={item.cle} style={{ width: `${item.pct}%`, background: item.couleur, transition: 'width 0.3s ease' }} />
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 6, textAlign: 'right', fontWeight: 600 }}>
              {bord.nb_commandes} commande{bord.nb_commandes > 1 ? 's' : ''} encaissée{bord.nb_commandes > 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Cartes par canal */}
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
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: item.couleur }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--noir)' }}>{item.libelle}</span>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 10, background: item.bg, color: item.couleur }}>
                {item.pct}%
              </span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--noir)', marginTop: 12 }}>
              {fcfa(item.valeur)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 4, fontWeight: 500 }}>
              Part du chiffre d'affaires
            </div>
          </div>
        ))}

        {/* Carte Dépenses */}
        <div
          style={{
            background: 'var(--bg-app, #fff)',
            borderRadius: 18,
            padding: 20,
            border: '1.5px solid rgba(197, 48, 48, 0.25)',
            boxShadow: '0 4px 12px rgba(30,27,26,0.03)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#c53030' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#c53030' }}>Dépenses</span>
            <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 10, background: 'rgba(197, 48, 48, 0.1)', color: '#c53030' }}>
              Sorties
            </span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#c53030', marginTop: 12 }}>
            {fcfa(bord.depenses)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 4, fontWeight: 500 }}>
            Sorties de caisse
          </div>
        </div>

        {/* Carte Résultat Net */}
        <div
          style={{
            background: 'var(--bg-app, #fff)',
            borderRadius: 18,
            padding: 20,
            border: `1.5px solid ${bord.resultat_net >= 0 ? 'rgba(56, 161, 105, 0.3)' : 'rgba(197, 48, 48, 0.3)'}`,
            boxShadow: '0 4px 12px rgba(30,27,26,0.03)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: bord.resultat_net >= 0 ? '#38a169' : '#c53030' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: bord.resultat_net >= 0 ? '#276749' : '#c53030' }}>Résultat Net</span>
            <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 10, background: bord.resultat_net >= 0 ? 'rgba(56, 161, 105, 0.12)' : 'rgba(197, 48, 48, 0.1)', color: bord.resultat_net >= 0 ? '#276749' : '#c53030' }}>
              {bord.resultat_net >= 0 ? 'Bénéfice' : 'Déficit'}
            </span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: bord.resultat_net >= 0 ? '#276749' : '#c53030', marginTop: 12 }}>
            {fcfa(bord.resultat_net)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 4, fontWeight: 500 }}>
            CA minus Dépenses
          </div>
        </div>
      </div>

      {/* Grille du Milieu : Synthèse financière & Graphique Donut SVG */}
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
            justify: 'space-between',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--noir)', marginBottom: 16 }}>
            Bilan Financier
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div style={{ padding: 16, borderRadius: 14, background: 'rgba(197, 48, 48, 0.06)', border: '1px solid rgba(197, 48, 48, 0.18)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#c53030', textTransform: 'uppercase' }}>Dépenses</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#c53030', marginTop: 4 }}>
                {fcfa(bord.depenses)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 4 }}>Sorties de caisse</div>
            </div>

            <div style={{ padding: 16, borderRadius: 14, background: bord.resultat_net >= 0 ? 'rgba(56, 161, 105, 0.08)' : 'rgba(197, 48, 48, 0.08)', border: `1px solid ${bord.resultat_net >= 0 ? 'rgba(56, 161, 105, 0.25)' : 'rgba(197, 48, 48, 0.25)'}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: bord.resultat_net >= 0 ? '#276749' : '#c53030', textTransform: 'uppercase' }}>Résultat Net</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: bord.resultat_net >= 0 ? '#276749' : '#c53030', marginTop: 4 }}>
                {fcfa(bord.resultat_net)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 4 }}>CA minus Dépenses</div>
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

        {/* Colonne Droite : Donut Chart SVG Vectoriel */}
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

          <GraphiqueDonutSVG items={revenuItems} total={revenus.total} />
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
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--noir)' }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 7,
                        background: rang === 0 ? 'var(--orange)' : rang === 1 ? 'var(--orange-dk)' : rang === 2 ? '#9a5716' : 'var(--bord)',
                        color: rang < 3 ? '#fff' : 'var(--noir)',
                        fontSize: 11,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      0{rang + 1}
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
                      <div style={{ height: 4, width: '100%', maxWidth: 180, background: 'var(--bord)', borderRadius: 2, marginTop: 5, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pctPopularite}%`, background: rang === 0 ? 'var(--orange)' : 'var(--orange-dk)', borderRadius: 2 }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '4px 10px', borderRadius: 20, background: 'var(--bg-app, #fff)', border: '1px solid var(--bord)', fontSize: 12, fontWeight: 700, color: 'var(--mut)', whiteSpace: 'nowrap' }}>
                    {ligne.vendu} vente{ligne.vendu > 1 ? 's' : ''}
                  </div>

                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--noir)', minWidth: 100, textAlign: 'right' }}>
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
