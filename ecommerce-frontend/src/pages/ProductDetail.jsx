import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_URL } from '../config';
import { useToast } from '../components/Toast';

function tileColor(name) {
    let hash = 0;
    for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
    return `linear-gradient(135deg, hsl(${hash} 78% 60%), hsl(${(hash + 45) % 360} 80% 52%))`;
}

function ProductDetail({ onAdd }) {
    const toast = useToast();
    const { id } = useParams();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [added, setAdded] = useState(false);

    useEffect(() => {
        let ignore = false;
        setLoading(true);

        fetch(`${API_URL}/api/products/${id}`)
            .then(res => {
                if (!res.ok) throw new Error('Not found');
                return res.json();
            })
            .then(data => {
                if (ignore) return;
                setProduct(data);
                setLoading(false);
            })
            .catch(() => {
                if (ignore) return;
                setProduct(null);
                setLoading(false);
            });

        return () => {
            ignore = true;
        };
    }, [id]);

    function handleAdd() {
        const ok = onAdd(product);
        if (ok === false) {
            toast.info('You already have all the available stock of this item in your cart.');
            return;
        }
        setAdded(true);
        setTimeout(() => setAdded(false), 1200);
    }

    if (loading) return <div className="skeleton-card" />;

    if (!product) {
        return (
            <div className="empty-state">
                😕
                <p>Product not found.</p>
                <Link to="/shop" className="btn">Back to products</Link>
            </div>
        );
    }

    const count = product.stock ?? 0;
    const tag =
        count < 1
            ? { text: 'Sold out', cls: 'out' }
            : count <= 3
                ? { text: `Only ${count} left`, cls: 'low' }
                : { text: 'In stock', cls: 'in' };

    return (
        <div>
            <Link to="/shop" className="back-link">← Back to products</Link>
            <div className="card detail-card">
                <div className="detail-thumb" style={{ background: tileColor(product.name) }}>
                    {product.image ? (
                        <img src={product.image} alt={product.name} />
                    ) : (
                        product.name.charAt(0).toUpperCase()
                    )}
                </div>
                <div className="detail-info">
                    <h2>{product.name}</h2>
                    <p className="price">₦{Number(product.price).toLocaleString()}</p>
                    <span className={`stock-tag ${tag.cls}`}>{tag.text}</span>
                    <p className="desc">{product.description}</p>
                    <button onClick={handleAdd} disabled={count < 1}>
                        {count < 1 ? 'Out of stock' : added ? '✓ Added' : 'Add to cart'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ProductDetail;