import { useState } from 'react'

import { useAuth } from '../auth-contexte'

export default function Connexion() {
  const { connexion } = useAuth()
  const [identifiant, setIdentifiant] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)

  async function soumettre(evenement) {
    evenement.preventDefault()
    setErreur('')
    setEnvoi(true)
    try {
      await connexion(identifiant, motDePasse)
    } catch (echec) {
      setErreur(echec.message)
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <form className="login" onSubmit={soumettre}>
      <img src="/logo.jpg" alt="La Marmite du Kloto" />
      <h1>La Marmite du Kloto</h1>
      <p>Bar-Resto · Avedji</p>
      {erreur && <div className="erreur">{erreur}</div>}
      <input
        className="champ"
        placeholder="Identifiant"
        value={identifiant}
        onChange={(e) => setIdentifiant(e.target.value)}
        autoFocus
      />
      <input
        className="champ"
        type="password"
        placeholder="Mot de passe"
        value={motDePasse}
        onChange={(e) => setMotDePasse(e.target.value)}
      />
      <button className="btn btn-o" disabled={envoi}>
        {envoi ? 'Connexion…' : 'Ouvrir la caisse'}
      </button>
    </form>
  )
}
