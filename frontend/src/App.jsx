import { NavLink, Navigate, Route, Routes } from 'react-router-dom'

import { useAuth } from './auth-contexte'
import Accueil from './pages/Accueil'
import Bar from './pages/Bar'
import Catalogue from './pages/Catalogue'
import Cloture from './pages/Cloture'
import Connexion from './pages/Connexion'
import Cuisine from './pages/Cuisine'
import Depenses from './pages/Depenses'
import Emporter from './pages/Emporter'
import Historique from './pages/Historique'
import Livraison from './pages/Livraison'
import Rapports from './pages/Rapports'
import Tables from './pages/Tables'
import Ventes from './pages/Ventes'
import ClocheStock from './composants/ClocheStock'

const MENU = [
  { groupe: "Vue d'ensemble" },
  { to: '/', libelle: 'Accueil' },
  { to: '/ventes', libelle: 'Ventes / Caisse' },
  { to: '/emporter', libelle: 'À emporter' },
  { to: '/tables', libelle: 'Tables' },
  { groupe: 'Opérations' },
  { to: '/bar', libelle: 'Bar / Stock' },
  { to: '/cuisine', libelle: 'Cuisine' },
  { to: '/livraison', libelle: 'Livraison' },
  { groupe: 'Gestion' },
  { to: '/catalogue', libelle: 'Catalogue' },
  { to: '/depenses', libelle: 'Dépenses' },
  { to: '/historique', libelle: 'Historique' },
  { to: '/rapports', libelle: 'Rapports' },
  { to: '/cloture', libelle: 'Clôture du jour' },
]

export default function App() {
  const { utilisateur, pret, deconnexion } = useAuth()

  if (!pret) return <div className="etat" style={{ color: '#fff' }}>Chargement…</div>
  if (!utilisateur) return <Connexion />

  const estAdmin = Boolean(utilisateur.is_admin || utilisateur.role === 'admin')

  // Filtrer les menus de gestion réservés à l'admin (Catalogue, Dépenses, Rapports, Clôture)
  const pagesAdminOnly = ['/catalogue', '/depenses', '/rapports', '/cloture']
  
  const menuFiltre = MENU.filter((entree) => {
    if (entree.to && pagesAdminOnly.includes(entree.to) && !estAdmin) return false
    return true
  })

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

        {menuFiltre.map((entree, index) =>
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

        <div className="foot" style={{ flexWrap: 'wrap', gap: 6 }}>
          <div className="av">{utilisateur.nom.slice(0, 2).toUpperCase()}</div>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
              {utilisateur.nom}
            </span>
            <span style={{ fontSize: 10, color: estAdmin ? '#F47C20' : '#8E8E93', textTransform: 'uppercase', fontWeight: 700 }}>
              {estAdmin ? '👑 Admin' : '👤 Gérant'}
            </span>
          </div>
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
        <ClocheStock />
        <Routes>
          <Route path="/" element={<Accueil />} />
          <Route path="/bar" element={<Bar />} />
          <Route path="/ventes" element={<Ventes />} />
          <Route path="/emporter" element={<Emporter />} />
          <Route path="/tables" element={<Tables />} />
          <Route path="/cuisine" element={<Cuisine />} />
          <Route path="/livraison" element={<Livraison />} />
          <Route path="/historique" element={<Historique />} />

          {/* Routes réservées exclusivement à l'Admin */}
          <Route path="/catalogue" element={estAdmin ? <Catalogue /> : <Navigate to="/" replace />} />
          <Route path="/depenses" element={estAdmin ? <Depenses /> : <Navigate to="/" replace />} />
          <Route path="/rapports" element={estAdmin ? <Rapports /> : <Navigate to="/" replace />} />
          <Route path="/cloture" element={estAdmin ? <Cloture /> : <Navigate to="/" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
