import { useEffect, useState } from 'react'

import { api, fcfa } from '../api'
import FeuilleGestion from '../composants/FeuilleGestion'

/* ─── Couleur de l'écart de caisse ─────────────────────────────────────── */
function couleurEcart(ecart) {
  if (ecart === null || ecart === 0) return 'var(--vert)'
  return ecart < 0 ? 'var(--rouge)' : 'var(--jaune)'
}

/* ─── Ligne de tableau simple ──────────────────────────────────────────── */
function Ligne({ libelle, valeur, fort, rouge }) {
  return (
    <tr>
      <td style={fort ? { fontWeight: 700 } : undefined}>{libelle}</td>
      <td style={{
        textAlign: 'right',
        fontWeight: fort ? 700 : undefined,
        color: rouge ? 'var(--rouge)' : fort ? 'var(--orange-dk)' : undefined,
      }}>
        {fcfa(valeur)}
      </td>
    </tr>
  )
}

/* ─── Mini KPI card ────────────────────────────────────────────────────── */
function KpiCard({ label, valeur, accent, sub, brut }) {
  return (
    <div style={{
      background: accent
        ? 'linear-gradient(135deg,var(--orange) 0%,var(--orange-dk) 100%)'
        : '#fff',
      border: accent ? 'none' : '1px solid var(--bord)',
      borderRadius: 'var(--radius)',
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      boxShadow: accent ? 'var(--shadow-orange)' : 'var(--shadow-sm)',
      flex: 1,
      minWidth: 140,
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: accent ? 'rgba(255,255,255,.7)' : 'var(--mut)' }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent ? '#fff' : 'var(--noir)', lineHeight: 1.1 }}>
        {brut ? valeur : fcfa(valeur)}
      </div>
      {sub && <div style={{ fontSize: 12, color: accent ? 'rgba(255,255,255,.65)' : 'var(--mut)' }}>{sub}</div>}
    </div>
  )
}

/* ─── Composant principal ──────────────────────────────────────────────── */
export default function Cloture() {
  const [feuille, setFeuille] = useState(null)
  const [fondInitial, setFondInitial] = useState('')
  const [reel, setReel] = useState('')
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [document, setDocument] = useState(null)
  const [confirmer, setConfirmer] = useState(false)

  async function charger() {
    try {
      setFeuille(await api.get('/rapports/cloture/'))
    } catch (echec) {
      setErreur(echec.message)
    }
  }

  useEffect(() => { charger() }, [])

  async function ouvrirCaisse(e) {
    e.preventDefault()
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
    setConfirmer(false)
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

  if (!feuille) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, color: 'var(--mut)' }}>
      <div className="spinner" />
      Chargement de la caisse…
    </div>
  )

  const { caisse, revenus } = feuille
  const theorique = caisse?.montant_theorique ?? 0
  const ecart = reel === '' ? null : Number(reel) - theorique

  return (
    <>
      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <div className="top" style={{ marginBottom: 24 }}>
        <div>
          <h1>Clôture du jour</h1>
          <div className="sub">{feuille.periode}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className={`pill ${caisse ? 'vert' : 'alerte'}`}>
            {caisse ? 'Caisse ouverte' : 'Aucune caisse ouverte'}
          </div>
          {caisse && (
            <div className="pill" style={{ background: 'var(--tint)', color: 'var(--tint-tx)', border: '1px solid var(--tint-bd)' }}>
              Session #{String(caisse.id).slice(-6).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {erreur && (
        <div className="erreur" style={{ marginBottom: 18 }}>{erreur}</div>
      )}

      {/* Bannière d'avertissement si des encaissements sont en attente */}
      {((feuille?.commandes_non_encaissees_livraison || 0) > 0 || (feuille?.commandes_non_encaissees_emporter || 0) > 0) && (
        <div
          style={{
            background: 'rgba(230,81,0,0.08)',
            border: '2px solid var(--orange-dk)',
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 14,
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--orange-dk)', marginBottom: 4 }}>
              ⛔ Clôture impossible : Encaissements en attente
            </div>
            <div style={{ fontSize: 13, color: 'var(--noir)' }}>
              Vous devez obligatoirement encaisser toutes les commandes de <strong>Livraison</strong> et <strong>À emporter</strong> avant de clôturer la caisse du jour.
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--orange-dk)', marginTop: 4 }}>
              En attente : {feuille.commandes_non_encaissees_livraison || 0} livraison(s) · {feuille.commandes_non_encaissees_emporter || 0} commande(s) à emporter
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {(feuille.commandes_non_encaissees_livraison || 0) > 0 && (
              <a href="/livraison" className="btn btn-o" style={{ fontSize: 13, padding: '8px 14px' }}>
                🛵 Terminer les livraisons ({feuille.commandes_non_encaissees_livraison})
              </a>
            )}
            {(feuille.commandes_non_encaissees_emporter || 0) > 0 && (
              <a href="/emporter" className="btn btn-o" style={{ fontSize: 13, padding: '8px 14px' }}>
                🛍️ Terminer à emporter ({feuille.commandes_non_encaissees_emporter})
              </a>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/*  ÉTAT : Aucune caisse ouverte → formulaire d'ouverture             */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {!caisse ? (
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <div className="card" style={{ padding: '36px 32px' }}>
            <h2 style={{ marginBottom: 6, fontSize: 22 }}>Ouvrir la caisse</h2>
            <p style={{ color: 'var(--mut)', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
              Saisissez le fond de départ. Il servira de référence pour l'arrêté des espèces en fin de journée.
            </p>
            <form onSubmit={ouvrirCaisse}>
              <label className="lbl">Fond de caisse initial (FCFA)</label>
              <input
                id="fond-initial"
                className="champ"
                type="number"
                min="0"
                step="500"
                placeholder="ex. 50 000"
                value={fondInitial}
                onChange={(e) => setFondInitial(e.target.value)}
                required
                style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}
              />
              <div className="note" style={{ marginBottom: 20 }}>
                Sans caisse ouverte, les ventes et dépenses sont bien enregistrées, mais l'arrêté d'espèces n'a pas de point de départ.
              </div>
              <button id="btn-ouvrir-caisse" className="btn btn-o" style={{ width: '100%', height: 48, fontSize: 16 }}>
                Ouvrir la journée
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* ─────────────────────────────────────────────────────────────────── */
        /*  ÉTAT : Caisse ouverte → tableau de bord + clôture                  */
        /* ─────────────────────────────────────────────────────────────────── */
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* ── Colonne principale (gauche) ─────────────────────────────── */}
          <div style={{ flex: '1 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* KPIs */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <KpiCard label="Chiffre d'affaires" valeur={revenus.total} />
              <KpiCard label="Dépenses" valeur={feuille.total_depenses} />
              <KpiCard label="Résultat net" valeur={feuille.resultat_net} accent
                sub={feuille.resultat_net >= 0 ? 'Bénéfice' : 'Déficit'} />
              <KpiCard label="Commandes" valeur={feuille.nb_commandes} brut sub="réalisées" />
            </div>

            {/* Recettes par source */}
            <div className="card">
              <h3 style={{ margin: '0 0 14px 0' }}>Recettes par source</h3>
              <table className="grid">
                <tbody>
                  <Ligne libelle="Ventes bar"      valeur={revenus.bar} />
                  <Ligne libelle="Ventes cuisine"  valeur={revenus.cuisine} />
                  <Ligne libelle="Livraisons"      valeur={revenus.livraison} />
                  <Ligne libelle="Chiffre d'affaires"  valeur={revenus.total} fort />
                </tbody>
              </table>
            </div>

            {/* Dépenses par catégorie */}
            <div className="card">
              <h3 style={{ margin: '0 0 14px 0' }}>Dépenses par catégorie</h3>
              {feuille.depenses_par_categorie.length === 0 ? (
                <div className="etat">Aucune dépense enregistrée aujourd'hui.</div>
              ) : (
                <table className="grid">
                  <tbody>
                    {feuille.depenses_par_categorie.map((l) => (
                      <Ligne key={l.categorie} libelle={l.libelle} valeur={l.montant} />
                    ))}
                    <Ligne libelle="Total dépenses" valeur={feuille.total_depenses} fort rouge />
                  </tbody>
                </table>
              )}
            </div>

            {/* Recettes par mode de paiement */}
            <div className="card">
              <h3 style={{ margin: '0 0 14px 0' }}>Recettes par mode de paiement</h3>
              {feuille.recettes_par_mode.length === 0 ? (
                <div className="etat">Aucun encaissement sur la période.</div>
              ) : (
                <table className="grid">
                  <tbody>
                    {feuille.recettes_par_mode.map((l) => (
                      <Ligne key={l.mode} libelle={l.libelle} valeur={l.montant} />
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Arrêté de caisse */}
            <div className="card" style={{ borderLeft: '4px solid var(--orange)' }}>
              <h3 style={{ margin: '0 0 14px 0' }}>Arrêté de caisse (espèces)</h3>
              <table className="grid">
                <tbody>
                  <Ligne libelle="Fond de caisse initial"       valeur={caisse.fond_initial} />
                  <Ligne libelle="+ Recettes en espèces"        valeur={caisse.recettes_especes} />
                  <Ligne libelle="− Dépenses en espèces"        valeur={caisse.depenses_especes} rouge />
                  <Ligne libelle="= Montant théorique en caisse" valeur={theorique} fort />
                </tbody>
              </table>
              <div className="note" style={{ marginTop: 12 }}>
                Seules les espèces figurent ici : TMoney, Flooz et banque n'entrent pas dans le tiroir.
              </div>
            </div>

          </div>{/* fin colonne gauche */}

          {/* ── Colonne droite : panneau de clôture ──────────────────────── */}
          <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Récap rapide session */}
            <div className="card" style={{ background: '#1e1b1a', color: '#fff', border: 'none' }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,.45)', marginBottom: 14 }}>
                Session en cours
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'rgba(255,255,255,.55)', fontSize: 13 }}>Fond initial</span>
                <span style={{ fontWeight: 700 }}>{fcfa(caisse.fond_initial)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'rgba(255,255,255,.55)', fontSize: 13 }}>Espèces attendues</span>
                <span style={{ fontWeight: 700, color: 'var(--orange-lt)' }}>{fcfa(theorique)}</span>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,.1)', marginTop: 8, paddingTop: 12, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,.55)', fontSize: 13 }}>CA du jour</span>
                <span style={{ fontWeight: 800, color: 'var(--orange)', fontSize: 18 }}>{fcfa(revenus.total)}</span>
              </div>
            </div>

            {/* Formulaire de comptage */}
            <div className="card" style={{ position: 'sticky', top: 20 }}>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Comptage & clôture</div>
                <div style={{ fontSize: 12, color: 'var(--mut)' }}>Opération définitive</div>
              </div>

              {/* Montant théorique de référence */}
              <div style={{
                background: 'var(--tint)', border: '1px solid var(--tint-bd)',
                borderRadius: 'var(--radius-sm)', padding: '12px 16px',
                marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 13, color: 'var(--tint-tx)', fontWeight: 600 }}>Montant théorique</span>
                <span style={{ fontWeight: 800, color: 'var(--orange-dk)', fontSize: 18 }}>{fcfa(theorique)}</span>
              </div>

              {/* Saisie du réel */}
              <label className="lbl" htmlFor="montant-reel">Montant réel compté (FCFA)</label>
              <input
                id="montant-reel"
                className="champ"
                type="number"
                min="0"
                step="500"
                placeholder={`ex. ${theorique}`}
                value={reel}
                onChange={(e) => { setReel(e.target.value); setConfirmer(false) }}
                style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', marginBottom: 12 }}
              />

              {/* Écart */}
              {reel !== '' && (
                <div style={{
                  background: ecart === 0 ? 'var(--vert-bg)' : ecart < 0 ? 'var(--rouge-bg)' : 'var(--jaune-bg)',
                  border: `1px solid ${ecart === 0 ? 'rgba(63,125,78,.25)' : ecart < 0 ? 'rgba(163,45,45,.25)' : 'rgba(122,84,16,.25)'}`,
                  borderRadius: 'var(--radius-sm)', padding: '12px 16px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 16,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: couleurEcart(ecart) }}>
                    {ecart === 0 ? 'Caisse équilibrée' : ecart < 0 ? 'Déficit caisse' : 'Excédent caisse'}
                  </span>
                  <span style={{ fontWeight: 800, color: couleurEcart(ecart), fontSize: 18 }}>
                    {ecart > 0 ? '+' : ''}{fcfa(ecart)}
                  </span>
                </div>
              )}

              {/* Bouton clôture (avec confirmation si écart important) */}
              {!confirmer ? (
                <button
                  id="btn-cloturer"
                  className="btn btn-o"
                  style={{ width: '100%', height: 48, fontSize: 15, fontWeight: 700 }}
                  disabled={
                    reel === '' ||
                    envoi ||
                    (feuille?.commandes_non_encaissees_livraison || 0) > 0 ||
                    (feuille?.commandes_non_encaissees_emporter || 0) > 0
                  }
                  onClick={() => {
                    const e = ecart ?? 0
                    if (Math.abs(e) > 10000) { setConfirmer(true) }
                    else { cloturer() }
                  }}
                >
                  {envoi
                    ? 'Clôture en cours…'
                    : ((feuille?.commandes_non_encaissees_livraison || 0) > 0 || (feuille?.commandes_non_encaissees_emporter || 0) > 0)
                      ? 'Encaissements en attente ⛔'
                      : 'Clôturer & imprimer'}
                </button>
              ) : (
                <div style={{
                  background: 'var(--rouge-bg)', border: '1px solid rgba(163,45,45,.3)',
                  borderRadius: 'var(--radius-sm)', padding: 16, textAlign: 'center',
                }}>
                  <div style={{ fontWeight: 700, color: 'var(--rouge)', marginBottom: 8 }}>
                    Écart important : {ecart > 0 ? '+' : ''}{fcfa(ecart)}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--mut)', marginBottom: 14 }}>
                    Confirmez-vous la clôture malgré cet écart ?
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" style={{ flex: 1 }} onClick={() => setConfirmer(false)}>
                      Annuler
                    </button>
                    <button className="btn btn-o" style={{ flex: 1 }} onClick={cloturer} disabled={envoi}>
                      Confirmer
                    </button>
                  </div>
                </div>
              )}

              <div className="note" style={{ marginTop: 12 }}>
                La clôture arrête la journée, fige l'écart de caisse et édite le document à signer. Elle est définitive.
              </div>
            </div>

          </div>{/* fin colonne droite */}
        </div>
      )}

      {/* ── Document imprimable (modal) ───────────────────────────────────── */}
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
                ...document.depenses_par_categorie.map((l) => ({ libelle: l.libelle, valeur: l.montant })),
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
                { libelle: 'Écart', valeur: `${document.session.ecart > 0 ? '+' : ''}${fcfa(document.session.ecart)}`, brut: true, total: true },
              ],
            },
            {
              titre: 'Recettes par mode de paiement',
              lignes: document.recettes_par_mode.map((l) => ({ libelle: l.libelle, valeur: l.montant })),
            },
          ]}
        />
      )}
    </>
  )
}
