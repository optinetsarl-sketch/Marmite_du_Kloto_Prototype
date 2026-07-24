import { createContext, useContext } from 'react'

// Contexte et hook séparés du composant fournisseur : un fichier .jsx qui
// exporte un composant ne doit exporter que ça, sinon le rechargement à chaud
// de Vite ne fonctionne plus.
export const ContexteAuth = createContext(null)

export function useAuth() {
  return useContext(ContexteAuth)
}
