import { useState, useEffect } from 'react';
import ProductCard from '../components/ProductCard';
import { API_URL } from '../config';

function Home({ onAdd }) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let ignore = false;

        fetch(`${API_URL}/api/products`)
            .then(res => {
                if (!res.ok) throw new Error('Failed');
                return res.json();
            })
            .then(data => {
                if (ignore) return;
                setProducts(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(() => {
                if (ignore) return;
                setError('Could not load products.');
                setLoading(false);
            });

        return () => {
            ignore = true;
        };
    }, []);

    return (
        <div>
            <section className="hero">
                <h2>Great finds, delivered to your door</h2>
                <p>Browse the collection, add what you love, and check out in minutes.</p>
            </section>

            <h2 className="section-title">Products</h2>

            {loading && (
                <div className="product-grid">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="skeleton-card" />
                    ))}
                </div>
            )}

            {error && <p style={{ color: 'red' }}>{error}</p>}

            {!loading && !error && products.length === 0 && (
                <p>No products yet. Check back soon.</p>
            )}

            {!loading && !error && products.length > 0 && (
                <div className="product-grid">
                    {products.map((product, index) => (
                        <ProductCard
                            key={product.id}
                            id={product.id}
                            name={product.name}
                            price={product.price}
                            stock={product.stock}
                            image={product.image}
                            index={index}
                            onAdd={() => onAdd(product)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default Home;