import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../config';

function Login({ onAuth }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            const res = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), password }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data.message || 'Login failed. Please try again.');
                return;
            }
            onAuth(data);
            navigate('/shop');
        } catch {
            setError('Could not reach the server.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="auth-wrap">
            <div className="auth-card">
                <h2>Welcome back</h2>
                <form onSubmit={handleSubmit} className="auth-form">
                    <input
                        type="email"
                        placeholder="Email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                    />
                    <button type="submit" disabled={submitting}>
                        {submitting ? 'Logging in...' : 'Login'}
                    </button>
                </form>
                {error && <p className="auth-error">{error}</p>}
                <p className="auth-switch">
                    No account? <Link to="/register">Register</Link>
                </p>
            </div>
        </div>
    );
}

export default Login;