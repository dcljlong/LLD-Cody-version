import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { UserPlus, Eye, EyeOff } from 'lucide-react';
import lldLogo from '../assets/lld-logo.png';
import loginBackground from '../assets/login-background.jpg';

const RegisterPage = () => {
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    company: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await register(formData.email, formData.password, formData.name, formData.company);
      toast.success('Account created');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
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

      <main className="lld-login-card lld-register-card" aria-label="Create LLD account">
        <div className="lld-login-heading">
          <p className="lld-login-kicker">Long Line Diary</p>
          <h1>LLD</h1>
          <p>Site Diary</p>
        </div>

        <form onSubmit={handleSubmit} className="lld-login-form">
          <button
            type="submit"
            className="lld-logo-submit lld-register-logo-submit"
            disabled={loading}
            data-testid="register-logo-submit"
            aria-label="Create LLD account"
            title="Create LLD account"
          >
            <img src={lldLogo} alt="LLD logo" />
          </button>

          <div className="lld-login-title-block">
            <h2>Create Account</h2>
            <p>{loading ? 'Creating your account...' : 'Create your Long Line Diary access.'}</p>
          </div>

          <div>
            <Label htmlFor="name" className="form-label lld-login-label">Full Name *</Label>
            <Input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              placeholder="David Long"
              className="form-input lld-login-input"
              data-testid="register-name"
            />
          </div>

          <div>
            <Label htmlFor="email" className="form-label lld-login-label">Email *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="david.long@company.co.nz"
              className="form-input lld-login-input"
              data-testid="register-email"
            />
          </div>

          <div>
            <Label htmlFor="company" className="form-label lld-login-label">Company</Label>
            <Input
              id="company"
              name="company"
              type="text"
              value={formData.company}
              onChange={handleChange}
              placeholder="Westaco Limited"
              className="form-input lld-login-input"
              data-testid="register-company"
            />
          </div>

          <div>
            <Label htmlFor="password" className="form-label lld-login-label">Password *</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange}
                placeholder="Min 6 characters"
                className="form-input lld-login-input pr-10"
                data-testid="register-password"
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
            data-testid="register-submit"
          >
            {loading ? (
              'Creating...'
            ) : (
              <span className="inline-flex items-center justify-center gap-2">
                <UserPlus className="w-4 h-4" />
                Create account
              </span>
            )}
          </button>
        </form>

        <p className="lld-login-register">
          Already have access?{' '}
          <Link to="/login" data-testid="login-link">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
};

export default RegisterPage;