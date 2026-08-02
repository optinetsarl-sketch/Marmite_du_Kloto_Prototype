import { createPortal } from 'react-dom'

/**
 * Modale de confirmation professionnelle — remplace window.confirm().
 * Props :
 *   titre         : titre de la boîte (ex: "Informations incomplètes")
 *   message       : texte d'intro
 *   manquants     : liste de chaînes (champs manquants)
 *   labelOk       : texte du bouton de validation
 *   labelAnnuler  : texte du bouton d'annulation
 *   onConfirme    : callback quand l'opérateur clique "Continuer quand même"
 *   onAnnule      : callback quand il clique "Compléter"
 */
export default function ModaleConfirmation({
  titre = 'Informations incomplètes',
  message = 'Les informations suivantes ne sont pas renseignées :',
  manquants = [],
  labelOk = 'Continuer quand même',
  labelAnnuler = 'Compléter les informations',
  onConfirme,
  onAnnule,
}) {
  return createPortal(
    <div
      className="modal-ov"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => e.target === e.currentTarget && onAnnule()}
    >
      <div
        className="modal-bx"
        style={{
          maxWidth: 420,
          borderRadius: 16,
          padding: '28px 28px 20px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
          border: '1px solid var(--bord)',
        }}
      >
        {/* Icone + Titre */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
          <div
            style={{
              flexShrink: 0,
              width: 42,
              height: 42,
              borderRadius: 12,
              background: 'rgba(245,124,0,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
            }}
          >
            ⚠️
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--noir)', lineHeight: 1.3 }}>
              {titre}
            </div>
            <div style={{ fontSize: 13, color: 'var(--mut)', marginTop: 4 }}>{message}</div>
          </div>
        </div>

        {/* Liste des champs manquants */}
        {manquants.length > 0 && (
          <ul
            style={{
              margin: '0 0 20px 0',
              padding: 0,
              listStyle: 'none',
              background: 'rgba(245,124,0,0.07)',
              borderRadius: 10,
              border: '1px solid rgba(245,124,0,0.18)',
              overflow: 'hidden',
            }}
          >
            {manquants.map((champ, i) => (
              <li
                key={champ}
                style={{
                  padding: '9px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--orange-dk)',
                  borderBottom: i < manquants.length - 1 ? '1px solid rgba(245,124,0,0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ opacity: 0.5 }}>•</span> {champ}
              </li>
            ))}
          </ul>
        )}

        {/* Boutons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            className="btn btn-g"
            style={{ width: '100%', fontWeight: 600, fontSize: 14, padding: '10px 0' }}
            onClick={onAnnule}
          >
            ← Compléter les informations
          </button>
          {onConfirme && (
            <button
              className="btn"
              style={{
                width: '100%',
                fontSize: 13,
                padding: '9px 0',
                color: 'var(--mut)',
                background: 'transparent',
                border: '1px solid var(--bord)',
                borderRadius: 8,
                cursor: 'pointer',
              }}
              onClick={onConfirme}
            >
              Continuer sans ces informations
            </button>
          )}
        </div>
      </div>
    </div>,
    window.document.body,
  )
}
