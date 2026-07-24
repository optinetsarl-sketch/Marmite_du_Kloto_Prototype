import { useEffect, useState } from 'react'

import { api, getToken, setToken } from './api'
import { ContexteAuth } from './auth-contexte'

export function FournisseurAuth({ children }) {
  const [utilisateur, setUtilisateur] = useState(null)
  const [etablissement, setEtablissement] = useState(null)
  const [pret, setPret] = useState(false)

  // Au démarrage, on vérifie que le token gardé en localStorage est encore bon.
  useEffect(() => {
    if (!getToken()) {
      setPret(true)
      return
    }
    api
      .get('/auth/moi/')
      .then((donnees) => {
        setUtilisateur(donnees.utilisateur)
        setEtablissement(donnees.etablissement)
      })
      .catch(() => setToken(null))
      .finally(() => setPret(true))
  }, [])

  async function connexion(username, password) {
    const donnees = await api.post('/auth/login/', { username, password })
    setToken(donnees.token)
    setUtilisateur(donnees.utilisateur)
    setEtablissement(donnees.etablissement)
  }

  function deconnexion() {
    setToken(null)
    setUtilisateur(null)
  }

  return (
    <ContexteAuth.Provider value={{ utilisateur, etablissement, pret, connexion, deconnexion }}>
      {children}
    </ContexteAuth.Provider>
  )
}
