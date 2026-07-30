import { useEffect, useState } from 'react'

import { api, fcfa, liste } from '../api'

const CATEGORIES = [
  ['achats_bar', 'Achats bar'],
  ['achats_cuisine', 'Achats cuisine'],
  ['transport', 'Transport'],
  ['salaires', 'Salaires'],
  ['energie', 'Électricité / Eau'],
  ['entretien', 'Entretien'],
  ['autres', 'Autres'],
]

const MODES = [
  ['especes', 'Espèces'],
  ['tmoney', 'TMoney'],
  ['flooz', 'Flooz'],
  ['banque', 'Banque / Carte'],
]

export default function Depenses() {
  const [rapport, setRapport] = useState(null)
  const [depenses, setDepenses] = useState([])
  const [caisse, setCaisse] = useState(null)
  const [erreur, setErreur] = useState('')

  const [categorie, setCategorie] = useState('achats_bar')
  const [montant, setMontant] = useState('')
  const [description, setDescription] = useState('')
  const [mode, setMode] = useState('especes')
  const [envoi, setEnvoi] = useState(false)

  async function charger() {
    try {
      const [detail, lignes, feuille] = await Promise.all([
        api.get('/rapports/depenses/'),
        liste('/depenses/?page_size=200'),
        api.get('/rapports/cloture/'),
      ])
      setRapport(detail)
      setDepenses(lignes)
      setCaisse(feuille.caisse)
    } catch (echec) {
      setErreur(echec.message)
    }
  }

  useEffect(() => {
    charger()
  }, [])

  async function ajouter(evenement) {
    evenement.preventDefault()
    setErreur('')
    setEnvoi(true)
    try {
      await api.post('/depenses/', {
        categorie,
        montant: Number(montant),
        description,
        mode,
      })
      setMontant('')
      setDescription('')
      await charger()
    } catch (echec) {
      setErreur(echec.message)
    } finally {
      setEnvoi(false)
    }
  }

  async function supprimer(id) {
    try {
      await api.delete(`/depenses/${id}/`)
      await charger()
    } catch (echec) {
      setErreur(echec.message)
    }
  }

  if (!rapport) return <div className="etat">Chargement…</div>

  const disponible = caisse?.montant_theorique
  const quatrePremieres = rapport.par_categorie.slice(0, 4)

  return (
    <>
      <div className="top">
        <div>
          <h1>Dépenses</h1>
          <div className="sub">{rapport.periode}</div>
        </div>
        {caisse ? (
          <div className={`pill ${disponible < 20000 ? 'alerte' : ''}`}>
            Espèces en caisse : {fcfa(disponible)}
          </div>
        ) : (
          <div className="pill alerte">Caisse fermée</div>
        )}
      </div>

      {erreur && <div className="erreur">{erreur}</div>}

      <div className="pos" style={{ gridTemplateColumns: '1fr 330px' }}>
        <div>
          {rapport.par_categorie && rapport.par_categorie.length > 0 && (
            <div className="card" style={{ marginBottom: 16, padding: '14px 16px' }}>
              <div style={{ fontWeight: 600, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--mut)', marginBottom: 10 }}>
                Synthèse par catégorie
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {rapport.par_categorie.map((ligne) => (
                  <div
                    key={ligne.categorie}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 12px',
                      borderRadius: 6,
                      background: 'var(--fond-sub, #f8f9fa)',
                      border: '1px solid var(--bord)',
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: 'var(--txt-sec, #555)' }}>{ligne.libelle} :</span>
                    <strong style={{ color: 'var(--primaire, #111)' }}>{fcfa(ligne.montant)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <h3>Dépenses de la journée</h3>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Catégorie</th>
                  <th>Mode</th>
                  <th style={{ textAlign: 'right' }}>Montant</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {depenses.map((depense) => (
                  <tr key={depense.id}>
                    <td style={{ fontWeight: 600 }}>{depense.description || depense.categorie_libelle}</td>
                    <td>
                      <span className="tag">{depense.categorie_libelle}</span>
                    </td>
                    <td style={{ color: 'var(--mut)' }}>
                      {MODES.find(([code]) => code === depense.mode)?.[1]}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {fcfa(depense.montant)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="x" onClick={() => supprimer(depense.id)} aria-label="Supprimer">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {depenses.length === 0 && <div className="etat">Aucune dépense saisie.</div>}
            <div className="tot">
              <span>Total dépenses</span>
              <span>{fcfa(rapport.total)}</span>
            </div>
          </div>
        </div>

        <form className="card" onSubmit={ajouter}>
          <h3>Nouvelle dépense</h3>

          <label className="lbl">Catégorie</label>
          <select className="champ" value={categorie} onChange={(e) => setCategorie(e.target.value)}>
            {CATEGORIES.map(([code, libelle]) => (
              <option key={code} value={code}>
                {libelle}
              </option>
            ))}
          </select>

          <label className="lbl">Montant (FCFA)</label>
          <input
            className="champ"
            type="number"
            min="1"
            step="1"
            placeholder="ex. 15000"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            required
          />

          <label className="lbl">Description</label>
          <input
            className="champ"
            placeholder="ex. Casiers Castel + Guinness"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <label className="lbl">Réglé en</label>
          <select className="champ" value={mode} onChange={(e) => setMode(e.target.value)}>
            {MODES.map(([code, libelle]) => (
              <option key={code} value={code}>
                {libelle}
              </option>
            ))}
          </select>

          <button className="btn btn-o" style={{ width: '100%', marginTop: 16 }} disabled={envoi}>
            {envoi ? 'Enregistrement…' : 'Ajouter la dépense'}
          </button>

          <div className="note">
            Une dépense en espèces est refusée si elle dépasse ce que contient le tiroir-caisse.
            Les autres modes ne touchent pas la caisse.
          </div>
        </form>
      </div>
    </>
  )
}
