import { useState } from 'react';
import { Terminal, Lock } from 'lucide-react';
import { login } from './api';

interface LoginProps {
  onLogin: () => void;
}

export function Login({ onLogin }: LoginProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await login(password);

    if (result.success) {
      onLogin();
    } else {
      setError(result.error || 'Login failed');
      setPassword('');
    }
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <Terminal size={32} />
          <h1>Analytics Panel</h1>
        </div>
        <p className="login-subtitle">alfonso.ridao.ar</p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <Lock size={18} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoFocus
              disabled={loading}
            />
          </div>

          {error && (
            <p className="error-text">{error}</p>
          )}

          <button type="submit" disabled={loading || !password}>
            {loading ? 'Verifying...' : 'Access Dashboard'}
          </button>
        </form>

        <p className="login-footer">Protected area - Authorized access only</p>
      </div>
    </div>
  );
}
