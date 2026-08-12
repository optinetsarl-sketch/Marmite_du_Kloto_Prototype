import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api, fcfa, liste } from '../api'
import ModalePaiement from '../composants/ModalePaiement'
import Recu from '../composants/Recu'

const LIBELLES_ETAT = { libre: 'Libre', occ: 'Occupée', pay: 'À encaisser' }

export default function Tables() {
  const naviguer = useNavigate()
  const [tables, setTables] = useState([])
  const [selection, setSelection] = useState(null)
  const [ardoise, setArdoise] = useState(null)
  const [nouveauNumero, setNouveauNumero] = useState('')
  const [erreur, setErreur] = useState('')
  const [paiementOuvert, setPaiementOuvert] = useState(false)
  const [documentOuvert, setDocumentOuvert] = useState(null)

  async function charger() {
    try {
      setTables(await liste('/tables/?page_size=200'))
    } catch (echec) {
      setErreur(echec.message)
    }
  }

  useEffect(() => {
    charger()
  }, [])

  async function ouvrir(table) {
    setSelection(table)
    setErreur('')
    if (!table.commande_id) {
      setArdoise(null)
      return
    }
    try {
      setArdoise(await api.get(`/commandes/${table.commande_id}/`))
    } catch (echec) {
      setErreur(echec.message)
    }
  }

  async function ajouterTable(evenement) {
    evenement.preventDefault()
    setErreur('')
    try {
      await api.post('/tables/', { numero: Number(nouveauNumero) })
      setNouveauNumero('')
      await charger()
    } catch (echec) {
      setErreur(echec.message)
    }
  }

  async function demanderAddition() {
    // Passe la table « à encaisser » sans toucher au statut, qui suit la cuisine :
    // le client peut réclamer l'addition pendant qu'un dessert est encore au feu.
    const misAJour = await api.post(`/commandes/${ardoise.id}/demander_addition/`, {})
    setArdoise(misAJour)
    await charger()
  }

  async function encaisser(paiements) {
    const encaissee = await api.post(`/commandes/${ardoise.id}/encaisser/`, { paiements })
    setPaiementOuvert(false)
    setDocumentOuvert({ commande: encaissee, type: 'Reçu' })
    setArdoise(null)
    setSelection(null)
    await charger()
  }

  return (
    <>
      <div className="top">
        <div>
          <h1>Plan de salle</h1>
          <div className="sub">
            Choisissez une table pour voir son ardoise, présenter l’addition ou encaisser.
          </div>
        </div>
      </div>

      {erreur && <div className="erreur">{erreur}</div>}

      <div className="leg">
        <span>
          <b style={{ background: 'var(--vert-bg)', border: '1px solid var(--vert)' }} />
          Libre
        </span>
        <span>
          <b style={{ background: 'var(--tint)', border: '1px solid var(--orange)' }} />
          Occupée
        </span>
        <span>
          <b style={{ background: 'var(--jaune-bg)', border: '1px solid #e0a72e' }} />À encaisser
        </span>
      </div>

      <form className="selbar" onSubmit={ajouterTable}>
        <label>Ajouter une table n°</label>
        <input
          className="champ auto"
          style={{ width: 110 }}
          type="number"
          min="1"
          placeholder="ex. 34"
          value={nouveauNumero}
          onChange={(e) => setNouveauNumero(e.target.value)}
        />
        <button className="btn btn-g" disabled={!nouveauNumero}>
          Ajouter
        </button>
      </form>

      <div className="pos">
        <div className="floor">
          {tables.map((table) => (
            <button
              key={table.id}
              className={`tbl ${table.etat} ${selection?.id === table.id ? 'sel' : ''}`}
              onClick={() => ouvrir(table)}
            >
              <div className="tn">Table {table.numero}</div>
              <div className="ts">
                {table.etat === 'libre'
                  ? LIBELLES_ETAT.libre
                  : `${table.couverts} couverts · ${fcfa(table.total)}`}
              </div>
            </button>
          ))}
        </div>

        <div className="ticket">
          {!selection ? (
            <div className="etat">Sélectionnez une table.</div>
          ) : (
            <>
              <h3>Table {selection.numero}</h3>
              <div className="meta">{LIBELLES_ETAT[selection.etat]}</div>

              {!ardoise?.lignes?.length ? (
                <div className="etat">Aucune commande ouverte.</div>
              ) : (
                <>
                  {ardoise.lignes.map((ligne) => (
                    <div key={ligne.id || Math.random()} style={{ marginBottom: 6 }}>
                      <div className="line">
                        <span>
                          {ligne.quantite} × {ligne.libelle}
                        </span>
                        <span>{fcfa(ligne.montant)}</span>
                      </div>
                      {ligne.note && (
                        <div style={{ fontSize: 11, color: 'var(--orange-dk)', fontStyle: 'italic', paddingLeft: 14, marginTop: -2 }}>
                          {ligne.note}
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="tot">
                    <span>Total</span>
                    <span>{fcfa(ardoise.total)}</span>
                  </div>
                </>
              )}

              <button
                className="btn btn-o"
                style={{ width: '100%', marginTop: 12 }}
                onClick={() => naviguer(`/ventes?table=${selection.id}`)}
              >
                Ajouter des produits
              </button>

              {ardoise?.total > 0 && (
                <>
                  <button
                    className="btn btn-g"
                    style={{ width: '100%', marginTop: 8 }}
                    onClick={() => {
                      demanderAddition()
                      setDocumentOuvert({ commande: ardoise, type: 'Addition' })
                    }}
                  >
                    Imprimer l’addition
                  </button>
                  <button
                    className="btn btn-g"
                    style={{ width: '100%', marginTop: 8 }}
                    onClick={() => setPaiementOuvert(true)}
                  >
                    Encaisser &amp; débarrasser
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {paiementOuvert && (
        <ModalePaiement
          total={ardoise.total}
          onEncaisse={encaisser}
          onFerme={() => setPaiementOuvert(false)}
        />
      )}

      {documentOuvert && (
        <Recu commande={documentOuvert.commande} typeDocument={documentOuvert.type} onFerme={() => setDocumentOuvert(null)} />
      )}
    </>
  )
}
