import { useState, useEffect } from 'react';
import ProductCard from '../components/ProductCard';

function Home({ onAdd }) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetch('http://localhost:5000/api/products')
            .then(res => res.json())
            .then(data => {
                setProducts(data);
                setLoading(false);
            })
            .catch(() => {
                setError('Could not load products.');
                setLoading(false);
            });
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

            {!loading && !error && (
                <div className="product-grid">
                    {products.map((product, index) => (
                        <ProductCard
                            key={product.id}
                            id={product.id}
                            name={product.name}
                            price={product.price}
                            stock={product.stock}
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