import { useEffect, useState } from 'react'

import { api, fcfa } from '../api'
import Modale from './Modale'

/** Ce qu'un livreur a transporté aujourd'hui, course par course et plat par plat.
 *  Sert à trancher une contestation au moment de faire les comptes. */
export default function DetailLivreur({ livreurId, onFerme }) {
  const [detail, setDetail] = useState(null)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    api
      .get(`/livreurs/${livreurId}/detail_du_jour/`)
      .then(setDetail)
      .catch((echec) => setErreur(echec.message))
  }, [livreurId])

  return (
    <Modale
      titre={detail ? `Courses de ${detail.livreur}` : 'Chargement…'}
      sousTitre={detail ? `${detail.courses.length} course(s) · ${fcfa(detail.total)}` : ''}
      largeur={640}
      onFerme={onFerme}
    >
      {erreur && <div className="erreur">{erreur}</div>}
      {!detail ? (
        <div className="etat">Chargement…</div>
      ) : detail.courses.length === 0 ? (
        <div className="etat">Aucune course livrée aujourd'hui.</div>
      ) : (
        <>
          <div className="sec-t">Récapitulatif des articles</div>
          <div className="tableau-defilant">
            <table className="grid">
              <thead>
                <tr>
                  <th>Article</th>
                  <th style={{ textAlign: 'right' }}>Quantité</th>
                  <th style={{ textAlign: 'right' }}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {detail.recapitulatif.map((ligne) => (
                  <tr key={ligne.libelle}>
                    <td style={{ fontWeight: 600 }}>{ligne.libelle}</td>
                    <td style={{ textAlign: 'right' }}>{ligne.quantite}</td>
                    <td style={{ textAlign: 'right' }}>{fcfa(ligne.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sec-t" style={{ marginTop: 18 }}>
            Détail course par course
          </div>
          {detail.courses.map((course) => (
            <div className="course" key={course.id}>
              <div className="course-tete">
                <div>
                  <strong>{course.client_nom || 'Sans nom'}</strong>
                  <div style={{ fontSize: 12, color: 'var(--mut)' }}>
                    {course.client_adresse || 'adresse non renseignée'} ·{' '}
                    {new Date(course.heure).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                <span className={`badge ${course.encaissee ? 'b-ok' : 'b-bas'}`}>
                  {course.encaissee ? 'Encaissée' : 'À remettre'}
                </span>
              </div>
              {course.lignes.map((ligne, index) => (
                <div className="line" key={index}>
                  <span>
                    {ligne.quantite} × {ligne.libelle}
                    {ligne.rayon === 'cuisine' && <em className="bon-note"> · plat</em>}
                  </span>
                  <span>{fcfa(ligne.montant)}</span>
                </div>
              ))}
              <div className="tot" style={{ fontSize: 14 }}>
                <span>Total course</span>
                <span>{fcfa(course.total)}</span>
              </div>
            </div>
          ))}
        </>
      )}

      <div className="modal-act" style={{ marginTop: 18 }}>
        <button className="btn btn-g" onClick={onFerme}>
          Fermer
        </button>
      </div>
    </Modale>
  )
}
