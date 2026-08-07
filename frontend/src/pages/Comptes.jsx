import { useEffect, useState } from 'react'

import { api } from '../api'
import { useAuth } from '../auth-contexte'

export default function Comptes() {
  const { utilisateur } = useAuth()
  const estAdmin = Boolean(utilisateur?.is_admin || utilisateur?.role === 'admin')

  const [utilisateurs, setUtilisateurs] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [succes, setSucces] = useState('')

  // Formulaire d'édition par id utilisateur
  const [noms, setNoms] = useState({})
  const [passwords, setPasswords] = useState({})
  const [confirmations, setConfirmations] = useState({})
  const [soumissionEnCours, setSoumissionEnCours] = useState(null)

  useEffect(() => {
    chargerComptes()
  }, [])

  async function chargerComptes() {
    setChargement(true)
    try {
      const data = await api.get('/auth/utilisateurs/')
      setUtilisateurs(data)
      const initialNoms = {}
      data.forEach((u) => {
        initialNoms[u.id] = u.nom || u.username
      })
      setNoms(initialNoms)
      setErreur('')
    } catch (e) {
      setErreur(e.message)
    } finally {
      setChargement(false)
    }
  }

  async function enregistrerCompte(userObj) {
    const userId = userObj.id
    const nomSaisi = (noms[userId] || '').trim()
    const passSaisi = (passwords[userId] || '').trim()
    const confSaisi = (confirmations[userId] || '').trim()

    if (passSaisi && passSaisi !== confSaisi) {
      setErreur(`Les mots de passe ne correspondent pas pour le compte ${userObj.username}.`)
      return
    }

    if (passSaisi && passSaisi.length < 4) {
      setErreur('Le nouveau mot de passe doit contenir au moins 4 caractères.')
      return
    }

    if (!nomSaisi && !passSaisi) {
      setErreur('Veuillez indiquer au moins un nouveau nom ou mot de passe.')
      return
    }

    setSoumissionEnCours(userId)
    setErreur('')
    setSucces('')

    try {
      const payload = { user_id: userId }
      if (nomSaisi) payload.nom = nomSaisi
      if (passSaisi) payload.mot_de_passe = passSaisi

      const res = await api.post('/auth/modifier-compte/', payload)
      setSucces(res.detail || 'Modifications enregistrées avec succès.')

      // Réinitialiser les champs de mot de passe du compte
      setPasswords((prev) => ({ ...prev, [userId]: '' }))
      setConfirmations((prev) => ({ ...prev, [userId]: '' }))

      // Recharger la liste
      await chargerComptes()
    } catch (e) {
      setErreur(e.message)
    } finally {
      setSoumissionEnCours(null)
    }
  }

  if (!estAdmin) {
    return <div className="erreur">Accès réservé à l'administrateur.</div>
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <div className="top" style={{ marginBottom: 20 }}>
        <div>
          <h1>🔐 Comptes & Sécurité</h1>
          <div className="sub">
            Gérez les identifiants, noms d'affichage et mots de passe des comptes Administrateur et Gérant.
          </div>
        </div>
      </div>

      {succes && (
        <div
          className="card"
          style={{
            background: 'rgba(34, 197, 94, 0.12)',
            color: '#15803d',
            borderLeft: '5px solid #22c55e',
            marginBottom: 20,
            padding: '14px 20px',
            fontWeight: 700,
          }}
        >
          ✅ {succes}
        </div>
      )}

      {erreur && (
        <div
          className="erreur"
          style={{ marginBottom: 20 }}
        >
          {erreur}
        </div>
      )}

      {chargement ? (
        <div className="etat">Chargement des comptes…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {utilisateurs.map((u) => {
            const estCompteAdmin = u.is_admin || u.role === 'admin'
            const estMoi = String(u.id) === String(utilisateur.id)

            return (
              <div
                key={u.id}
                className="card"
                style={{
                  borderTop: estCompteAdmin ? '4px solid var(--orange)' : '4px solid #8E8E93',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        color: estCompteAdmin ? 'var(--orange)' : '#8E8E93',
                        letterSpacing: '0.08em',
                      }}
                    >
                      {estCompteAdmin ? '👑 Compte Administrateur' : '👤 Compte Gérant / Caisse'}
                      {estMoi ? ' (Vous)' : ''}
                    </span>
                    <h2 style={{ fontSize: 20, margin: '4px 0 0 0', fontWeight: 800 }}>
                      Identifiant : {u.username}
                    </h2>
                  </div>
                </div>

                {/* Formulaire d'édition du nom */}
                <div className="champ-grpe">
                  <label style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Nom d'affichage</label>
                  <input
                    className="champ"
                    type="text"
                    placeholder="Nom complet ou prénom"
                    value={noms[u.id] ?? ''}
                    onChange={(e) => setNoms({ ...noms, [u.id]: e.target.value })}
                  />
                </div>

                {/* Formulaire de modification du mot de passe */}
                <div style={{ background: 'var(--tint)', padding: 14, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--mut)' }}>🔑 Changer le mot de passe</div>
                  
                  <div className="champ-grpe">
                    <label style={{ fontSize: 12, color: 'var(--mut)' }}>Nouveau mot de passe</label>
                    <input
                      className="champ"
                      type="password"
                      placeholder="••••••••"
                      value={passwords[u.id] ?? ''}
                      onChange={(e) => setPasswords({ ...passwords, [u.id]: e.target.value })}
                    />
                  </div>

                  <div className="champ-grpe">
                    <label style={{ fontSize: 12, color: 'var(--mut)' }}>Confirmer le mot de passe</label>
                    <input
                      className="champ"
                      type="password"
                      placeholder="••••••••"
                      value={confirmations[u.id] ?? ''}
                      onChange={(e) => setConfirmations({ ...confirmations, [u.id]: e.target.value })}
                    />
                  </div>
                </div>

                <button
                  className="btn btn-o"
                  style={{ width: '100%', padding: '12px 16px', fontSize: 14, fontWeight: 700, borderRadius: 10, marginTop: 8 }}
                  disabled={soumissionEnCours === u.id}
                  onClick={() => enregistrerCompte(u)}
                >
                  {soumissionEnCours === u.id ? 'Enregistrement…' : '💾 Enregistrer les modifications'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
