import { useEffect, useState } from 'react'

import { api, setToken } from '../api'
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
  const [roles, setRoles] = useState({})
  const [passwords, setPasswords] = useState({})
  const [confirmations, setConfirmations] = useState({})
  const [soumissionEnCours, setSoumissionEnCours] = useState(null)

  // Formulaire de création de nouveau compte
  const [afficherCreation, setAfficherCreation] = useState(false)
  const [nouvelUsername, setNouvelUsername] = useState('')
  const [nouveauNom, setNouveauNom] = useState('')
  const [nouveauPassword, setNouveauPassword] = useState('')
  const [nouveauRole, setNouveauRole] = useState('gerant')
  const [creationEnCours, setCreationEnCours] = useState(false)

  useEffect(() => {
    chargerComptes()
  }, [])

  async function chargerComptes() {
    setChargement(true)
    try {
      const data = await api.get('/auth/utilisateurs/')
      const liste = Array.isArray(data) ? data : []
      setUtilisateurs(liste)
      const initialNoms = {}
      const initialRoles = {}
      liste.forEach((u) => {
        initialNoms[u.id] = u.nom || u.username
        initialRoles[u.id] = u.is_admin || u.role === 'admin' ? 'admin' : 'gerant'
      })
      setNoms(initialNoms)
      setRoles(initialRoles)
      setErreur('')
    } catch (e) {
      setUtilisateurs([])
      setErreur(e.message)
    } finally {
      setChargement(false)
    }
  }

  async function enregistrerCompte(userObj) {
    const userId = userObj.id
    const nomSaisi = (noms[userId] || '').trim()
    const roleSaisi = roles[userId] || (userObj.is_admin ? 'admin' : 'gerant')
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

    setSoumissionEnCours(userId)
    setErreur('')
    setSucces('')

    try {
      const payload = { user_id: userId, role: roleSaisi }
      if (nomSaisi) payload.nom = nomSaisi
      if (passSaisi) payload.mot_de_passe = passSaisi

      const res = await api.post('/auth/modifier-compte/', payload)

      // Si le mot de passe de l'utilisateur actuellement connecté a changé, mettre à jour son token de session
      if (res.token && (userObj.username === utilisateur?.username || String(userObj.id) === String(utilisateur?.id))) {
        setToken(res.token)
      }

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

  async function creerNouveauCompte(e) {
    e.preventDefault()
    if (!nouvelUsername.trim()) {
      setErreur("Veuillez indiquer un identifiant d'utilisateur.")
      return
    }
    if (!nouveauPassword || nouveauPassword.length < 4) {
      setErreur('Le mot de passe doit contenir au moins 4 caractères.')
      return
    }

    setCreationEnCours(true)
    setErreur('')
    setSucces('')

    try {
      const res = await api.post('/auth/creer-compte/', {
        username: nouvelUsername.trim(),
        nom: nouveauNom.trim(),
        password: nouveauPassword,
        role: nouveauRole,
      })
      setSucces(res.detail || 'Nouveau compte créé avec succès.')
      setNouvelUsername('')
      setNouveauNom('')
      setNouveauPassword('')
      setNouveauRole('gerant')
      setAfficherCreation(false)
      await chargerComptes()
    } catch (err) {
      setErreur(err.message)
    } finally {
      setCreationEnCours(false)
    }
  }

  async function supprimerCompte(userObj) {
    if (!window.confirm(`Voulez-vous vraiment supprimer le compte '${userObj.username}' ?`)) return
    setSoumissionEnCours(userObj.id)
    setErreur('')
    setSucces('')
    try {
      const res = await api.post('/auth/supprimer-compte/', { user_id: userObj.id })
      setSucces(res.detail || 'Compte supprimé avec succès.')
      await chargerComptes()
    } catch (err) {
      setErreur(err.message)
    } finally {
      setSoumissionEnCours(null)
    }
  }

  if (!estAdmin) {
    return <div className="erreur">Accès réservé à l'administrateur.</div>
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <div className="top" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>🔐 Comptes & Sécurité</h1>
          <div className="sub">
            Gérez les identifiants, rôles (Administrateur / Gérant) et mots de passe des utilisateurs.
          </div>
        </div>
        <button
          className="btn btn-p"
          style={{ padding: '10px 18px', fontSize: 14, fontWeight: 700, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={() => setAfficherCreation(!afficherCreation)}
        >
          {afficherCreation ? '❌ Annuler la création' : '➕ Nouveau Compte (Gérant / Admin)'}
        </button>
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
          ⚠️ {erreur}
        </div>
      )}

      {/* Formulaire de création de nouveau compte */}
      {afficherCreation && (
        <form
          onSubmit={creerNouveauCompte}
          className="card"
          style={{
            background: '#FFF',
            borderTop: '4px solid var(--orange)',
            marginBottom: 24,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--orange)' }}>
            ➕ Créer un Nouveau Compte Utilisateur
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div className="champ-grpe">
              <label style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Identifiant (Connexion) *</label>
              <input
                className="champ"
                type="text"
                placeholder="ex: gerant2, directeur..."
                required
                value={nouvelUsername}
                onChange={(e) => setNouvelUsername(e.target.value)}
              />
            </div>

            <div className="champ-grpe">
              <label style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Nom d'affichage</label>
              <input
                className="champ"
                type="text"
                placeholder="ex: Paul Lawson"
                value={nouveauNom}
                onChange={(e) => setNouveauNom(e.target.value)}
              />
            </div>

            <div className="champ-grpe">
              <label style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Mot de passe initial *</label>
              <input
                className="champ"
                type="password"
                placeholder="••••••••"
                required
                value={nouveauPassword}
                onChange={(e) => setNouveauPassword(e.target.value)}
              />
            </div>

            <div className="champ-grpe">
              <label style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Rôle de l'utilisateur *</label>
              <select
                className="champ"
                value={nouveauRole}
                onChange={(e) => setNouveauRole(e.target.value)}
                style={{ fontWeight: 700 }}
              >
                <option value="gerant">👤 Gérant (Caisse & Ventes)</option>
                <option value="admin">👑 Administrateur (Accès complet)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-o"
              onClick={() => setAfficherCreation(false)}
              style={{ padding: '10px 16px' }}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="btn btn-p"
              disabled={creationEnCours}
              style={{ padding: '10px 22px', fontWeight: 700 }}
            >
              {creationEnCours ? 'Création…' : '✅ Enregistrer et Créer le Compte'}
            </button>
          </div>
        </form>
      )}

      {chargement ? (
        <div className="etat">Chargement des comptes…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {(utilisateurs || []).map((u) => {
            const currentRole = roles[u.id] || (u.is_admin || u.role === 'admin' ? 'admin' : 'gerant')
            const estCompteAdmin = currentRole === 'admin'
            const estMoi = String(u.id) === String(utilisateur?.id)

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

                  {!estMoi && (
                    <button
                      type="button"
                      onClick={() => supprimerCompte(u)}
                      disabled={soumissionEnCours === u.id}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 700,
                        padding: '4px 8px',
                      }}
                      title="Supprimer ce compte"
                    >
                      🗑️ Supprimer
                    </button>
                  )}
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

                {/* Sélecteur de rôle */}
                <div className="champ-grpe">
                  <label style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Rôle d'accès</label>
                  <select
                    className="champ"
                    value={roles[u.id] ?? 'gerant'}
                    onChange={(e) => setRoles({ ...roles, [u.id]: e.target.value })}
                    style={{ fontWeight: 700 }}
                  >
                    <option value="gerant">👤 Gérant (Accès caisse & ventes)</option>
                    <option value="admin">👑 Administrateur (Accès complet & rapports)</option>
                  </select>
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
