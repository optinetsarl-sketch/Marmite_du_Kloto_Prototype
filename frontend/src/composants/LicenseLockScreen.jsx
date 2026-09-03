import React, { useState, useEffect } from 'react';

export default function LicenseLockScreen() {
  const [estBloque, setEstBloque] = useState(false);
  const [cle, setCle] = useState('');
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    const handleLock = () => setEstBloque(true);
    window.addEventListener('licence_expiree', handleLock);
    return () => window.removeEventListener('licence_expiree', handleLock);
  }, []);

  const validerCle = async (e) => {
    e.preventDefault();
    setErreur('');
    setChargement(true);
    
    try {
      const res = await fetch('/api/activate-license/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: cle }),
      });
      
      const data = await res.json();
      if (res.ok) {
        setEstBloque(false);
        // On rafraîchit la page pour nettoyer l'état de l'application
        window.location.reload();
      } else {
        setErreur(data.error || "Clé d'activation invalide.");
      }
    } catch (err) {
      setErreur("Impossible de vérifier la clé. Vérifiez la connexion.");
    } finally {
      setChargement(false);
    }
  };

  if (!estBloque) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: '#111827',
      zIndex: 999999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        backgroundColor: '#1F2937',
        padding: '3rem',
        borderRadius: '1rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        maxWidth: '500px',
        width: '90%',
        textAlign: 'center'
      }}>
        <svg style={{ width: '4rem', height: '4rem', color: '#EF4444', margin: '0 auto 1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
        </svg>
        
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          Période d'essai terminée
        </h2>
        
        <p style={{ color: '#9CA3AF', marginBottom: '2rem', lineHeight: '1.5' }}>
          Veuillez contacter le concepteur de l'application pour obtenir votre clé d'activation et débloquer le système.
        </p>

        <form onSubmit={validerCle} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input
            type="text"
            value={cle}
            onChange={(e) => setCle(e.target.value)}
            placeholder="Entrez votre clé secrète..."
            required
            style={{
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid #374151',
              backgroundColor: '#374151',
              color: 'white',
              fontSize: '1rem',
              outline: 'none',
              textAlign: 'center'
            }}
          />
          
          {erreur && (
            <div style={{ color: '#F87171', fontSize: '0.875rem' }}>
              {erreur}
            </div>
          )}

          <button
            type="submit"
            disabled={chargement || !cle.trim()}
            style={{
              padding: '0.75rem',
              borderRadius: '0.5rem',
              backgroundColor: '#3B82F6',
              color: 'white',
              fontWeight: 'bold',
              border: 'none',
              cursor: chargement || !cle.trim() ? 'not-allowed' : 'pointer',
              opacity: chargement || !cle.trim() ? 0.7 : 1,
              transition: 'background-color 0.2s'
            }}
          >
            {chargement ? 'Vérification...' : 'Débloquer'}
          </button>
        </form>
      </div>
    </div>
  );
}
