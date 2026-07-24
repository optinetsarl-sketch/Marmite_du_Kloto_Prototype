import { useEffect } from 'react'
import { createPortal } from 'react-dom'

// Rendu dans <body> et non dans .app : une modale ne doit dépendre ni du
// défilement de la coquille, ni de sa feuille d'impression qui la masque.
export default function Modale({ titre, sousTitre, largeur = 350, onFerme, children }) {
  // Échap ferme : au comptoir on a une main sur le clavier, pas sur la souris.
  useEffect(() => {
    function surTouche(evenement) {
      if (evenement.key === 'Escape') onFerme()
    }
    document.addEventListener('keydown', surTouche)
    return () => document.removeEventListener('keydown', surTouche)
  }, [onFerme])

  return createPortal(
    <div className="modal-ov" onMouseDown={(e) => e.target === e.currentTarget && onFerme()}>
      <div className="modal-bx" style={{ width: largeur }}>
        <button className="modal-close" onClick={onFerme} aria-label="Fermer">
          ✕
        </button>
        {titre && (
          <div className="mh">
            <img src="/logo.jpg" alt="" />
            <span className="mt">{titre}</span>
          </div>
        )}
        {sousTitre && <div className="msub">{sousTitre}</div>}
        {children}
      </div>
    </div>,
    window.document.body,
  )
}
