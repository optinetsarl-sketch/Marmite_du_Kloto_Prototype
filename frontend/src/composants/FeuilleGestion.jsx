import { createPortal } from 'react-dom'

import { fcfa } from '../api'

/** Document de gestion A4, prêt à imprimer et à signer.
 *  Porté du bloc REPCSS du prototype ; servira aussi aux rapports du lot 6. */
export default function FeuilleGestion({
  titre,
  periode,
  kpis = [],
  blocs = [],
  bandeau,
  note,
  onFerme,
}) {
  const edite = new Date()

  return createPortal(
    <div className="modal-ov" onMouseDown={(e) => e.target === e.currentTarget && onFerme()}>
      <div className="modal-bx feuille-bx" id="recu">
        <div className="rep-sheet">
          <div className="rep-head">
            <img src="/logo.jpg" alt="" />
            <div>
              <div className="rep-h-name">La Marmite du Kloto · Bar-Resto</div>
              <div className="rep-h-sub">
                Avedji, non loin de la Côte d'Or · Tél. +228 91 04 27 02
              </div>
            </div>
            <div className="rep-h-title">
              <div className="rep-h-t">{titre}</div>
              <div className="rep-h-p">{periode}</div>
            </div>
          </div>

          {kpis.length > 0 && (
            <div className="rep-kpis">
              {kpis.map((kpi) => (
                <div className={`rep-kpi ${kpi.accent ? 'accent' : ''}`} key={kpi.libelle}>
                  <div className="k">{kpi.libelle}</div>
                  <div className="v">{kpi.brut ? kpi.valeur : fcfa(kpi.valeur)}</div>
                </div>
              ))}
            </div>
          )}

          <div className="rep-cols">
            {blocs.map((bloc) => (
              <div className={`rep-block ${bloc.large ? 'rep-large' : ''}`} key={bloc.titre}>
                <div className="rep-bt">{bloc.titre}</div>
                {bloc.colonnes ? (
                  <div className="defilable">
                    <div className="tableau-defilant">
                      <Tableau bloc={bloc} />
                    </div>
                  </div>
                ) : (
                  <Deux lignes={bloc.lignes} />
                )}
              </div>
            ))}
          </div>

          {note && <div className="rep-gen" style={{ marginBottom: 14 }}>{note}</div>}

          {bandeau && (
            <div className="rep-net">
              <span>{bandeau.libelle}</span>
              <span>{fcfa(bandeau.valeur)}</span>
            </div>
          )}

          <div className="rep-foot">
            <div>Établi par : _______________________</div>
            <div>Visa du responsable : _______________________</div>
          </div>
          <div className="rep-gen">
            Édité le {edite.toLocaleDateString('fr-FR')} à{' '}
            {edite.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · La Marmite
            du Kloto
          </div>
        </div>

        <div className="modal-act rc-actions imprimable-cache" style={{ padding: '14px 26px 22px' }}>
          <button className="btn btn-g" onClick={onFerme}>
            Fermer
          </button>
          <button className="btn btn-o" onClick={() => window.print()}>
            Imprimer
          </button>
        </div>
      </div>
    </div>,
    window.document.body,
  )
}

/** Tableau libellé / valeur, le cas courant d'un bilan. */
function Deux({ lignes }) {
  if (lignes.length === 0) {
    return (
      <table className="rep-tbl">
        <tbody>
          <tr>
            <td>Aucune ligne</td>
            <td>—</td>
          </tr>
        </tbody>
      </table>
    )
  }
  return (
    <table className="rep-tbl">
      <tbody>
        {lignes.map((ligne, index) => (
          <tr key={index} className={ligne.total ? 'rep-tot' : ''}>
            <td>{ligne.libelle}</td>
            <td>{ligne.brut ? ligne.valeur : fcfa(ligne.valeur)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Tableau à colonnes nommées : reçu / vendu / restant / CA du rapport bar,
 *  par exemple. Les `colonnesTexte` premières colonnes restent alignées à
 *  gauche, les suivantes à droite — les chiffres se comparent en colonne. */
function Tableau({ bloc }) {
  const texte = bloc.colonnesTexte ?? 1
  const aligner = (colonne) => ({ textAlign: colonne < texte ? 'left' : 'right' })

  return (
    <table className="rep-tbl rep-tbl-large">
      <thead>
        <tr>
          {bloc.colonnes.map((colonne, index) => (
            <th key={colonne} style={aligner(index)}>
              {colonne}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {bloc.rangs.length === 0 ? (
          <tr>
            <td colSpan={bloc.colonnes.length}>Aucune ligne sur la période</td>
          </tr>
        ) : (
          bloc.rangs.map((rang, index) => (
            <tr key={index} className={rang.total ? 'rep-tot' : ''}>
              {(rang.cellules ?? rang).map((cellule, colonne) => (
                <td key={colonne} style={aligner(colonne)}>
                  {cellule}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  )
}
