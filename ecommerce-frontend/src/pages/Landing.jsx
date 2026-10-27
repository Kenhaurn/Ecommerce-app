import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';

// Fades a section in when it scrolls into view
function Reveal({ children, delay = 0 }) {
    const ref = useRef(null);
    const [shown, setShown] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setShown(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.15 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            className={`reveal ${shown ? 'in' : ''}`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    );
}

function Landing() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('http://localhost:5000/api/products')
            .then(res => res.json())
            .then(data => {
                setProducts(Array.isArray(data) ? data.slice(0, 4) : []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    return (
        <div>
            {/* Hero */}
            <section className="landing-hero">
                <div>
                    <h1>Shop the things you love, without the stress.</h1>
                    <p className="lead">
                        Browse our collection, pay securely and have your order delivered to your door.
                    </p>
                    <div className="hero-actions">
                        <Link to="/register" className="btn btn-light btn-lg">Create free account</Link>
                        <Link to="/shop" className="btn btn-outline-light btn-lg">Browse products</Link>
                    </div>
                </div>

                <div className="hero-visual" aria-hidden="true">
                    <div className="float-card fc-1">
                        <span className="icon">🛒</span>
                        <span>Added to cart<small>Just now</small></span>
                    </div>
                    <div className="float-card fc-2">
                        <span className="icon">✅</span>
                        <span>Payment confirmed<small>Secured by Paystack</small></span>
                    </div>
                    <div className="float-card fc-3">
                        <span className="icon">📦</span>
                        <span>Order shipped<small>On its way to you</small></span>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="l-section">
                <Reveal>
                    <div className="l-head">
                        <h2>Why shop with us</h2>
                        <p>Everything you need for a smooth, worry-free order.</p>
                    </div>
                </Reveal>
                <div className="feature-grid">
                    {[
                        { icon: '🔒', title: 'Secure payments', text: 'Pay safely through Paystack. Your card details never touch our servers.' },
                        { icon: '🚚', title: 'Delivered to you', text: 'Tell us where you are and we send your order straight to your door.' },
                        { icon: '📦', title: 'Track every order', text: 'See whether your order is pending, paid, shipped or delivered.' },
                        { icon: '✅', title: 'Real stock levels', text: 'What you see is what is available, so no surprise cancellations.' },
                    ].map((f, i) => (
                        <Reveal key={f.title} delay={i * 90}>
                            <div className="feature">
                                <div className="f-icon">{f.icon}</div>
                                <h3>{f.title}</h3>
                                <p>{f.text}</p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* Featured products */}
            {(loading || products.length > 0) && (
                <section className="l-section">
                    <Reveal>
                        <div className="l-head">
                            <h2>Popular right now</h2>
                            <p>A taste of what is in the store.</p>
                        </div>
                    </Reveal>
                    {loading ? (
                        <div className="product-grid">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="skeleton-card" />
                            ))}
                        </div>
                    ) : (
                        <>
                            <div className="product-grid">
                                {products.map((product, index) => (
                                    <ProductCard
                                        key={product.id}
                                        id={product.id}
                                        name={product.name}
                                        price={product.price}
                                        stock={product.stock}
                                        index={index}
                                    />
                                ))}
                            </div>
                            <div style={{ textAlign: 'center', marginTop: '26px' }}>
                                <Link to="/shop" className="btn">See all products</Link>
                            </div>
                        </>
                    )}
                </section>
            )}

            {/* How it works */}
            <section className="l-section">
                <Reveal>
                    <div className="l-head">
                        <h2>How it works</h2>
                        <p>From first click to your front door in three steps.</p>
                    </div>
                </Reveal>
                <div className="steps">
                    {[
                        { n: 1, title: 'Browse', text: 'Pick what you like and add it to your cart.' },
                        { n: 2, title: 'Check out', text: 'Enter your delivery details and pay securely with Paystack.' },
                        { n: 3, title: 'Track', text: 'Follow your order from the My Orders page until it arrives.' },
                    ].map((s, i) => (
                        <Reveal key={s.n} delay={i * 120}>
                            <div className="step">
                                <div className="num">{s.n}</div>
                                <h3>{s.title}</h3>
                                <p style={{ margin: 0, color: 'var(--muted)' }}>{s.text}</p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* Final call to action */}
            <Reveal>
                <section className="cta-band">
                    <h2>Ready to start shopping?</h2>
                    <p>Create a free account in under a minute.</p>
                    <div className="hero-actions">
                        <Link to="/register" className="btn btn-light btn-lg">Sign up</Link>
                        <Link to="/login" className="btn btn-outline-light btn-lg">Log in</Link>
                    </div>
                </section>
            </Reveal>

            <footer className="l-footer">
                <span>© {new Date().getFullYear()} My Store. All rights reserved.</span>
                <span>
                    <Link to="/shop">Shop</Link>
                    <Link to="/about">About</Link>
                    <Link to="/login">Login</Link>
                    <Link to="/register">Register</Link>
                </span>
            </footer>
        </div>
    );
}

export default Landing;