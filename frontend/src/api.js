// Client HTTP unique de l'application. Le token est conservé en localStorage :
// mono-utilisateur, la tablette du comptoir reste connectée entre deux services.

const CLE_TOKEN = 'marmite_token'

export function getToken() {
  return localStorage.getItem(CLE_TOKEN)
}

export function setToken(token) {
  if (token) localStorage.setItem(CLE_TOKEN, token)
  else localStorage.removeItem(CLE_TOKEN)
}

export class ApiError extends Error {
  constructor(message, statut, details) {
    super(message)
    this.statut = statut
    this.details = details
  }
}

async function requete(methode, chemin, corps) {
  const entetes = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) entetes.Authorization = `Token ${token}`

  let reponse
  try {
    reponse = await fetch(`/api${chemin}`, {
      method: methode,
      headers: entetes,
      body: corps === undefined ? undefined : JSON.stringify(corps),
    })
  } catch {
    // fetch ne lève que sur une panne réseau : serveur injoignable, wifi coupé.
    // Le cahier prévoit une connexion instable — un message clair vaut mieux
    // que le « Failed to fetch » brut du navigateur.
    throw new ApiError('Connexion au serveur impossible. Vérifiez le réseau.', 0, null)
  }

  if (reponse.status === 204) return null

  const donnees = await reponse.json().catch(() => null)
  if (!reponse.ok) {
    throw new ApiError(messageErreur(donnees, reponse.status), reponse.status, donnees)
  }
  return donnees
}

// DRF renvoie soit {detail}, soit {champ: ["message"]}, soit une liste.
function messageErreur(donnees, statut) {
  if (!donnees) return `Erreur ${statut}`
  if (typeof donnees === 'string') return donnees
  if (donnees.detail) return donnees.detail
  const premier = Object.values(donnees)[0]
  if (Array.isArray(premier)) return String(premier[0])
  return String(premier ?? `Erreur ${statut}`)
}

export const api = {
  get: (chemin) => requete('GET', chemin),
  post: (chemin, corps) => requete('POST', chemin, corps),
  patch: (chemin, corps) => requete('PATCH', chemin, corps),
  delete: (chemin) => requete('DELETE', chemin),
}

// Les listes DRF sont paginées : on ne veut que le tableau côté écran.
export async function liste(chemin) {
  const donnees = await api.get(chemin)
  return Array.isArray(donnees) ? donnees : (donnees?.results ?? [])
}

export function fcfa(montant) {
  return `${Number(montant || 0).toLocaleString('fr-FR').replace(/ /g, ' ')} F`
}
