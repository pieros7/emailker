import React, { useState } from 'react';
import { EnvelopeIcon, LockClosedIcon } from '@heroicons/react/24/outline';

const App: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        setStatus('success');
        setMessage('Inicio de sesión exitoso');
      } else {
        setStatus('error');
        const data = await response.json();
        setMessage(data.message || 'Error al iniciar sesión');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Error de conexión con el servidor');
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-base-100">
      {/* Columna Izquierda (Panel Gráfico) */}
      <section className="hidden md:flex flex-col p-12 bg-base-200 relative">
        {/* Logotipo */}
        <div className="flex items-center gap-2 font-bold text-2xl text-base-content">
          <EnvelopeIcon className="h-8 w-8 text-primary" />
          <span>Emailker</span>
        </div>

        {/* Marcador de posición de imagen */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-lg aspect-video bg-base-300 rounded-2xl overflow-hidden shadow-xl">
            <img
              src="https://picsum.photos/seed/emailker/800/600"
              alt="Login background"
              className="w-full h-full object-cover opacity-80"
            />
          </div>
        </div>
      </section>

      {/* Columna Derecha (Panel de Formulario) */}
      <section className="flex items-center justify-center p-8 md:p-12">
        <div className="w-full max-w-sm">
          <header className="mb-10 text-center md:text-left">
            <div className="md:hidden flex items-center justify-center gap-2 mb-6 font-bold text-2xl text-base-content">
              <EnvelopeIcon className="h-8 w-8 text-primary" />
              <span>Emailker</span>
            </div>
            <h1 className="text-4xl font-bold text-base-content">Iniciar sesión</h1>
          </header>

          <form onSubmit={handleLogin} className="space-y-6">
            <fieldset className="fieldset">
              <legend className="fieldset-legend text-xs font-bold uppercase tracking-wider text-base-content/60">
                EMAIL
              </legend>
              <label className="input input-bordered flex items-center gap-2 w-full rounded-lg">
                <EnvelopeIcon className="h-4 w-4 opacity-70" />
                <input
                  type="email"
                  placeholder="nombre@empresa.com"
                  className="grow"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
            </fieldset>

            <fieldset className="fieldset">
              <legend className="fieldset-legend text-xs font-bold uppercase tracking-wider text-base-content/60">
                CONTRASEÑA
              </legend>
              <label className="input input-bordered flex items-center gap-2 w-full rounded-lg">
                <LockClosedIcon className="h-4 w-4 opacity-70" />
                <input
                  type="password"
                  placeholder="••••••••"
                  className="grow"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
            </fieldset>

            <div className="pt-4">
              <button
                type="submit"
                className={`btn btn-primary btn-block text-lg font-semibold ${status === 'loading' ? 'btn-disabled' : ''}`}
                disabled={status === 'loading'}
              >
                {status === 'loading' ? (
                  <span className="loading loading-spinner"></span>
                ) : (
                  'Entrar'
                )}
              </button>
            </div>

            {message && (
              <div
                className={`alert ${status === 'success' ? 'alert-success' : 'alert-error'} mt-4`}
              >
                <span>{message}</span>
              </div>
            )}
          </form>
        </div>
      </section>
    </div>
  );
};

export default App;
