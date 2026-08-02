import { useEffect, useRef, useState } from 'react'

import { api } from '../api'

/**
 * Cloche de notification — alertes stock bas.
 * Se positionne en haut à droite de l'app via position:fixed.
 * Au clic, affiche un dropdown avec la liste des produits en rupture/bas.
 */
export default function ClocheStock() {
  const [alertes, setAlertes] = useState([])
  const [ouvert, setOuvert] = useState(false)
  const ref = useRef(null)

  async function chargerAlertes() {
    try {
      const bord = await api.get('/rapports/tableau-de-bord/')
      setAlertes(bord.alertes_stock || [])
    } catch {
      // Silencieux — la cloche ne bloque pas l'app en cas d'erreur réseau
    }
  }

  useEffect(() => {
    chargerAlertes()
    const intervalle = setInterval(chargerAlertes, 60000) // Rafraîchissement chaque minute
    return () => clearInterval(intervalle)
  }, [])

  // Fermer le dropdown si on clique en dehors
  useEffect(() => {
    function fermerSiExterieur(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOuvert(false)
      }
    }
    document.addEventListener('mousedown', fermerSiExterieur)
    return () => document.removeEventListener('mousedown', fermerSiExterieur)
  }, [])

  const nb = alertes.length
  const ruptures = alertes.filter((a) => a.stock <= 0)
  const bas = alertes.filter((a) => a.stock > 0)

  return (
    <div ref={ref} style={{ position: 'fixed', top: 18, right: 24, zIndex: 300 }}>
      {/* Bouton Cloche */}
      <button
        onClick={() => setOuvert((v) => !v)}
        aria-label={`Alertes stock (${nb})`}
        style={{
          position: 'relative',
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '1.5px solid var(--bord)',
          background: ouvert ? 'var(--fond-sub, #f0f0f0)' : 'var(--bg-app, #fff)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          transition: 'background 0.15s',
        }}
      >
        {/* Icone cloche SVG */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke={nb > 0 ? '#e65100' : 'var(--mut)'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Badge rouge avec le nombre d'alertes */}
        {nb > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              background: ruptures.length > 0 ? '#e53e3e' : '#dd6b20',
              color: '#fff',
              fontSize: 10,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              border: '2px solid var(--bg-app, #fff)',
            }}
          >
            {nb}
          </span>
        )}
      </button>

      {/* Dropdown des alertes */}
      {ouvert && (
        <div
          style={{
            position: 'absolute',
            top: 48,
            right: 0,
            width: 320,
            borderRadius: 14,
            background: 'var(--bg-app, #fff)',
            border: '1px solid var(--bord)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
            overflow: 'hidden',
          }}
        >
          {/* En-tête du dropdown */}
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--bord)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--noir)' }}>
                Alertes stock
              </div>
              <div style={{ fontSize: 12, color: 'var(--mut)', marginTop: 2 }}>
                {nb === 0
                  ? 'Tous les stocks sont OK'
                  : `${nb} produit${nb > 1 ? 's' : ''} à surveiller`}
              </div>
            </div>
            <button
              onClick={() => setOuvert(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 18,
                color: 'var(--mut)',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          {/* Corps du dropdown */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {nb === 0 ? (
              <div
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  color: 'var(--mut)',
                  fontSize: 13,
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
                Aucune alerte — tous les stocks sont au-dessus du seuil.
              </div>
            ) : (
              <>
                {/* Ruptures (stock = 0) */}
                {ruptures.length > 0 && (
                  <>
                    <div
                      style={{
                        padding: '8px 16px 4px',
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        color: '#e53e3e',
                      }}
                    >
                      Rupture de stock
                    </div>
                    {ruptures.map((a) => (
                      <div
                        key={a.produit}
                        style={{
                          padding: '10px 16px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderBottom: '1px solid var(--bord)',
                          background: 'rgba(229,62,62,0.03)',
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--noir)' }}>
                          {a.produit}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#fff',
                            background: '#e53e3e',
                            padding: '2px 8px',
                            borderRadius: 8,
                          }}
                        >
                          Stock : {a.stock}
                        </span>
                      </div>
                    ))}
                  </>
                )}

                {/* Stock bas (stock > 0 mais sous le seuil) */}
                {bas.length > 0 && (
                  <>
                    <div
                      style={{
                        padding: '8px 16px 4px',
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        color: '#dd6b20',
                      }}
                    >
                      Stock bas
                    </div>
                    {bas.map((a) => (
                      <div
                        key={a.produit}
                        style={{
                          padding: '10px 16px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderBottom: '1px solid var(--bord)',
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--noir)' }}>
                          {a.produit}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#fff',
                            background: '#dd6b20',
                            padding: '2px 8px',
                            borderRadius: 8,
                          }}
                        >
                          Stock : {a.stock}
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>

          {/* Pied de dropdown */}
          <div
            style={{
              padding: '10px 16px',
              borderTop: '1px solid var(--bord)',
              textAlign: 'center',
              fontSize: 12,
              color: 'var(--mut)',
            }}
          >
            Mis à jour toutes les minutes · <a href="/bar" style={{ color: 'var(--orange-dk)', fontWeight: 600 }}>Voir le stock</a>
          </div>
        </div>
      )}
    </div>
  )
}
