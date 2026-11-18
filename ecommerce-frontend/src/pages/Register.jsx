import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../config';

function Register({ onAuth }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');

        if (!name.trim()) {
            setError('Please enter your name.');
            return;
        }
        if (password.length < 8 || password.length > 72) {
            setError('Password must be between 8 and 72 characters.');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`${API_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data.message || 'Could not create the account. Please try again.');
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
                <h2>Create your account</h2>
                <form onSubmit={handleSubmit} className="auth-form">
                    <input
                        placeholder="Name"
                        autoComplete="name"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                    />
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
                        placeholder="Password (8 to 72 characters)"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        maxLength={72}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                    />

                    {TURNSTILE_ON && (
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <TurnstileWidget onToken={setTurnstileToken} resetKey={checkKey} />
                        </div>
                    )}

                    <button type="submit" disabled={submitting || (TURNSTILE_ON && !turnstileToken)}>
                        {submitting ? 'Creating account...' : 'Create account'}
                    </button>
                </form>
                {error && <p className="auth-error">{error}</p>}
                <p className="auth-switch">
                    Already have an account? <Link to="/login">Login</Link>
                </p>
            </div>
        </div>
    );
}

export default Register;