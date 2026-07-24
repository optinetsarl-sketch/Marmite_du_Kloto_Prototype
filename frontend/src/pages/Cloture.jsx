import { useEffect, useState } from 'react'

import { api, fcfa } from '../api'
import FeuilleGestion from '../composants/FeuilleGestion'

export default function Cloture() {
  const [feuille, setFeuille] = useState(null)
  const [fondInitial, setFondInitial] = useState('')
  const [reel, setReel] = useState('')
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [document, setDocument] = useState(null)

  async function charger() {
    try {
      setFeuille(await api.get('/rapports/cloture/'))
    } catch (echec) {
      setErreur(echec.message)
    }
  }

  useEffect(() => {
    charger()
  }, [])

  async function ouvrirCaisse(evenement) {
    evenement.preventDefault()
    setErreur('')
    try {
      await api.post('/sessions-caisse/', { fond_initial: Number(fondInitial) || 0 })
      setFondInitial('')
      await charger()
    } catch (echec) {
      setErreur(echec.message)
    }
  }

  async function cloturer() {
    setErreur('')
    setEnvoi(true)
    try {
      const session = await api.post(`/sessions-caisse/${feuille.caisse.id}/cloturer/`, {
        montant_reel: Number(reel),
      })
      setDocument({ ...feuille, session })
      setReel('')
      await charger()
    } catch (echec) {
      setErreur(echec.message)
    } finally {
      setEnvoi(false)
    }
  }

  if (!feuille) return <div className="etat">Chargement…</div>

  const { caisse, revenus } = feuille
  const theorique = caisse?.montant_theorique ?? 0
  const ecart = reel === '' ? null : Number(reel) - theorique

  return (
    <>
      <div className="top">
        <div>
          <h1>Clôture du jour</h1>
          <div className="sub">{feuille.periode}</div>
        </div>
        <div className={`pill ${caisse ? 'vert' : 'alerte'}`}>
          {caisse ? 'Caisse ouverte' : 'Aucune caisse ouverte'}
        </div>
      </div>

      {erreur && <div className="erreur">{erreur}</div>}

      {!caisse ? (
        <form className="card" onSubmit={ouvrirCaisse} style={{ maxWidth: 420 }}>
          <h3>Ouvrir la caisse</h3>
          <label className="lbl">Fond de caisse initial (FCFA)</label>
          <input
            className="champ"
            type="number"
            min="0"
            step="1"
            placeholder="ex. 50000"
            value={fondInitial}
            onChange={(e) => setFondInitial(e.target.value)}
            required
          />
          <button className="btn btn-o" style={{ width: '100%', marginTop: 16 }}>
            Ouvrir la journée
          </button>
          <div className="note">
            Sans caisse ouverte, les ventes et dépenses sont bien enregistrées, mais l'arrêté
            d'espèces n'a pas de point de départ.
          </div>
        </form>
      ) : (
        <div className="pos" style={{ gridTemplateColumns: '1fr 340px' }}>
          <div>
            <div className="card">
              <h3>Ce que chaque compartiment a rapporté</h3>
              <table className="grid">
                <tbody>
                  <Ligne libelle="Ventes bar" valeur={revenus.bar} />
                  <Ligne libelle="Ventes cuisine" valeur={revenus.cuisine} />
                  <Ligne libelle="Livraisons" valeur={revenus.livraison} />
                  <Ligne libelle="Chiffre d'affaires" valeur={revenus.total} fort />
                </tbody>
              </table>
            </div>

            <div className="card">
              <h3>Recettes par mode de paiement</h3>
              <table className="grid">
                <tbody>
                  {feuille.recettes_par_mode.map((ligne) => (
                    <Ligne key={ligne.mode} libelle={ligne.libelle} valeur={ligne.montant} />
                  ))}
                </tbody>
              </table>
              {feuille.recettes_par_mode.length === 0 && (
                <div className="etat">Aucun encaissement sur la période.</div>
              )}
            </div>

            <div className="card">
              <h3>Dépenses par catégorie</h3>
              <table className="grid">
                <tbody>
                  {feuille.depenses_par_categorie.map((ligne) => (
                    <Ligne key={ligne.categorie} libelle={ligne.libelle} valeur={ligne.montant} />
                  ))}
                  <Ligne libelle="Total dépenses" valeur={feuille.total_depenses} fort />
                </tbody>
              </table>
            </div>

            <div className="rep-net">
              <span>Résultat net de la journée</span>
              <span>{fcfa(feuille.resultat_net)}</span>
            </div>

            <div className="card">
              <h3>Arrêté de caisse (espèces)</h3>
              <table className="grid">
                <tbody>
                  <Ligne libelle="Fond de caisse initial" valeur={caisse.fond_initial} />
                  <Ligne libelle="+ Recettes en espèces" valeur={caisse.recettes_especes} />
                  <Ligne libelle="− Dépenses en espèces" valeur={caisse.depenses_especes} />
                  <Ligne libelle="= Montant théorique en caisse" valeur={theorique} fort />
                </tbody>
              </table>
              <div className="note">
                Seules les espèces figurent ici : TMoney, Flooz et carte n'entrent pas dans le tiroir.
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Comptage &amp; clôture</h3>
            <label className="lbl">Montant réel compté en caisse (FCFA)</label>
            <input
              className="champ"
              type="number"
              min="0"
              step="1"
              placeholder={`ex. ${theorique}`}
              value={reel}
              onChange={(e) => setReel(e.target.value)}
            />
            <div className="tot" style={{ fontSize: 15 }}>
              <span>Écart (réel − théorique)</span>
              <span style={{ color: couleurEcart(ecart) }}>
                {ecart === null ? '—' : `${ecart > 0 ? '+' : ''}${fcfa(ecart)}`}
              </span>
            </div>
            <button
              className="btn btn-o"
              style={{ width: '100%', marginTop: 16 }}
              disabled={reel === '' || envoi}
              onClick={cloturer}
            >
              {envoi ? 'Clôture…' : 'Clôturer & imprimer'}
            </button>
            <div className="note">
              La clôture arrête la journée, fige l'écart de caisse et édite le document à signer.
              Elle est définitive.
            </div>
          </div>
        </div>
      )}

      {document && (
        <FeuilleGestion
          titre="Clôture de journée"
          periode={document.periode}
          onFerme={() => setDocument(null)}
          kpis={[
            { libelle: "Chiffre d'affaires", valeur: document.revenus.total },
            { libelle: 'Dépenses', valeur: document.total_depenses },
            { libelle: 'Résultat net', valeur: document.resultat_net, accent: true },
            { libelle: 'Commandes', valeur: document.nb_commandes, brut: true },
          ]}
          bandeau={{ libelle: 'Résultat net de la journée', valeur: document.resultat_net }}
          blocs={[
            {
              titre: 'Recettes par source',
              lignes: [
                { libelle: 'Ventes bar', valeur: document.revenus.bar },
                { libelle: 'Ventes cuisine', valeur: document.revenus.cuisine },
                { libelle: 'Livraisons', valeur: document.revenus.livraison },
                { libelle: "Chiffre d'affaires", valeur: document.revenus.total, total: true },
              ],
            },
            {
              titre: 'Dépenses par catégorie',
              lignes: [
                ...document.depenses_par_categorie.map((ligne) => ({
                  libelle: ligne.libelle,
                  valeur: ligne.montant,
                })),
                { libelle: 'Total dépenses', valeur: document.total_depenses, total: true },
              ],
            },
            {
              titre: 'Arrêté de caisse (espèces)',
              lignes: [
                { libelle: 'Fond de caisse initial', valeur: document.caisse.fond_initial },
                { libelle: '+ Recettes espèces', valeur: document.caisse.recettes_especes },
                { libelle: '− Dépenses espèces', valeur: document.caisse.depenses_especes },
                { libelle: 'Montant théorique', valeur: document.caisse.montant_theorique, total: true },
                { libelle: 'Montant réel compté', valeur: document.session.montant_reel },
                {
                  libelle: 'Écart',
                  valeur: `${document.session.ecart > 0 ? '+' : ''}${fcfa(document.session.ecart)}`,
                  brut: true,
                  total: true,
                },
              ],
            },
            {
              titre: 'Recettes par mode de paiement',
              lignes: document.recettes_par_mode.map((ligne) => ({
                libelle: ligne.libelle,
                valeur: ligne.montant,
              })),
            },
          ]}
        />
      )}
    </>
  )
}

function Ligne({ libelle, valeur, fort }) {
  return (
    <tr>
      <td style={fort ? { fontWeight: 700 } : undefined}>{libelle}</td>
      <td
        style={{
          textAlign: 'right',
          ...(fort ? { fontWeight: 700, color: 'var(--orange-dk)' } : {}),
        }}
      >
        {fcfa(valeur)}
      </td>
    </tr>
  )
}

function couleurEcart(ecart) {
  if (ecart === null || ecart === 0) return 'var(--vert)'
  return ecart < 0 ? 'var(--rouge)' : 'var(--jaune)'
}
