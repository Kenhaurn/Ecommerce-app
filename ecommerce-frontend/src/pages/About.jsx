import { Link } from 'react-router-dom';

function About({ user }) {
    return (
        <div>
            <section className="page-hero">
                <h1>About My Store</h1>
                <p>We make shopping online simple, secure and stress-free.</p>
            </section>

            <section className="about-story">
                <div>
                    <h2>Our story</h2>
                    <p>
                        My Store is an online shop built to make buying everyday products easy. You browse,
                        pay securely and we deliver to your door.
                    </p>
                    <p>
                        Every order is tracked from the moment you pay until it reaches you, and we only
                        list what we actually have in stock, so there are no surprises at checkout.
                    </p>
                    <div className="hero-actions" style={{ marginTop: '20px' }}>
                        <Link to="/shop" className="btn">Browse products</Link>
                        {!user && <Link to="/register" className="btn btn-ghost">Create an account</Link>}
                    </div>
                </div>
                <div className="about-visual" aria-hidden="true">🛍️</div>
            </section>

            <section className="l-section">
                <div className="l-head">
                    <h2>What we stand for</h2>
                    <p>The principles behind every order.</p>
                </div>
                <div className="feature-grid">
                    {[
                        { icon: '🔒', title: 'Secure payments', text: 'Payments are handled by Paystack, so your card details never touch our servers.' },
                        { icon: '✅', title: 'Honest stock', text: 'The stock you see is the stock we have, so what you order is what you get.' },
                        { icon: '🚚', title: 'Reliable delivery', text: 'We record your delivery details and follow your order until it arrives.' },
                        { icon: '💬', title: 'Friendly support', text: 'Got a question about an order? Reach out and we will help.' },
                    ].map(f => (
                        <div key={f.title} className="feature">
                            <div className="f-icon">{f.icon}</div>
                            <h3>{f.title}</h3>
                            <p>{f.text}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="l-section">
                <div className="card contact-card">
                    <h3>Get in touch</h3>
                    <p>
                        Questions about an order or a product? Email us at{' '}
                        <strong>hello@yourstore.com</strong> and we will get back to you.
                    </p>
                </div>
            </section>
        </div>
    );
}

export default About;