import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import lldLogo from '../assets/lld-logo.png';
import loginBackground from '../assets/login-background.jpg';

const LoginPage = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lld-login-shell">
      <div
        className="lld-login-background"
        style={{ backgroundImage: `url(${loginBackground})` }}
        aria-hidden="true"
      />
      <div className="lld-login-overlay" aria-hidden="true" />

      <main className="lld-login-card" aria-label="LLD login">
        <div className="lld-login-heading">
          <p className="lld-login-kicker">Long Line Diary</p>
          <h1>LLD</h1>
          <p>Site Diary</p>
        </div>

        <form onSubmit={handleSubmit} className="lld-login-form">
          <button
            type="submit"
            className="lld-logo-submit"
            disabled={loading}
            data-testid="login-logo-submit"
            aria-label="Log in to LLD"
            title="Log in to LLD"
          >
            <img src={lldLogo} alt="LLD logo" />
          </button>

          <div className="lld-login-title-block">
            <h2>Construction Diary Hub</h2>
            <p>{loading ? 'Authenticating...' : 'Enter your credentials, then click Log in.'}</p>
          </div>

          <div>
            <Label htmlFor="email" className="form-label lld-login-label">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pm@company.co.nz"
              className="form-input lld-login-input"
              data-testid="login-email"
            />
          </div>

          <div>
            <Label htmlFor="password" className="form-label lld-login-label">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="form-input lld-login-input pr-10"
                data-testid="login-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="lld-login-eye-button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="lld-login-action-button"
            disabled={loading}
            data-testid="login-submit"
          >
            {loading ? 'Authenticating...' : 'Log in'}
          </button>
        </form>

        <p className="lld-login-register">
          New to LLD?{' '}
          <Link to="/register" data-testid="register-link">
            Create account
          </Link>
        </p>
      </main>
    </div>
  );
};

export default LoginPage;
