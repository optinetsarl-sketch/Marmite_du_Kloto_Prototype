import { NavLink, Navigate, Route, Routes } from 'react-router-dom'

import { useAuth } from './auth-contexte'
import Accueil from './pages/Accueil'
import Bar from './pages/Bar'
import Catalogue from './pages/Catalogue'
import Cloture from './pages/Cloture'
import Connexion from './pages/Connexion'
import Cuisine from './pages/Cuisine'
import Depenses from './pages/Depenses'
import Livraison from './pages/Livraison'
import Rapports from './pages/Rapports'
import Tables from './pages/Tables'
import Ventes from './pages/Ventes'

const MENU = [
  { groupe: "Vue d'ensemble" },
  { to: '/', libelle: 'Accueil' },
  { to: '/ventes', libelle: 'Ventes / Caisse' },
  { to: '/tables', libelle: 'Tables' },
  { groupe: 'Opérations' },
  { to: '/bar', libelle: 'Bar / Stock' },
  { to: '/cuisine', libelle: 'Cuisine' },
  { to: '/livraison', libelle: 'Livraison' },
  { groupe: 'Gestion' },
  { to: '/catalogue', libelle: 'Catalogue' },
  { to: '/depenses', libelle: 'Dépenses' },
  { to: '/rapports', libelle: 'Rapports' },
  { to: '/cloture', libelle: 'Clôture du jour' },
]

export default function App() {
  const { utilisateur, pret, deconnexion } = useAuth()

  if (!pret) return <div className="etat" style={{ color: '#fff' }}>Chargement…</div>
  if (!utilisateur) return <Connexion />

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <img src="/logo.jpg" alt="La Marmite du Kloto" />
          <div>
            <div className="nm">La Marmite</div>
            <div className="sb">du Kloto · Bar-Resto</div>
          </div>
        </div>

        {MENU.map((entree, index) =>
          entree.groupe ? (
            <div className="navgrp" key={index}>
              {entree.groupe}
            </div>
          ) : (
            <NavLink
              key={entree.to}
              to={entree.to}
              end={entree.to === '/'}
              className={({ isActive }) => `nav ${isActive ? 'on' : ''}`}
            >
              <span>{entree.libelle}</span>
            </NavLink>
          ),
        )}

        <div className="foot">
          <div className="av">{utilisateur.nom.slice(0, 2).toUpperCase()}</div>
          <span>{utilisateur.nom}</span>
          <button
            className="nav"
            style={{ marginLeft: 'auto', padding: '6px 8px', fontSize: 12 }}
            onClick={deconnexion}
          >
            Quitter
          </button>
        </div>
      </aside>

      <main className="main">
        <Routes>
          <Route path="/" element={<Accueil />} />
          <Route path="/bar" element={<Bar />} />
          <Route path="/catalogue" element={<Catalogue />} />
          <Route path="/ventes" element={<Ventes />} />
          <Route path="/tables" element={<Tables />} />
          <Route path="/cuisine" element={<Cuisine />} />
          <Route path="/livraison" element={<Livraison />} />
          <Route path="/depenses" element={<Depenses />} />
          <Route path="/rapports" element={<Rapports />} />
          <Route path="/cloture" element={<Cloture />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
