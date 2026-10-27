import { useState } from 'react';
import { Link } from 'react-router-dom';

function tileColor(name) {
    let hash = 0;
    for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
    return `linear-gradient(135deg, hsl(${hash} 78% 60%), hsl(${(hash + 45) % 360} 80% 52%))`;
}

function stockInfo(stock) {
    if (stock < 1) return { text: 'Sold out', cls: 'out' };
    if (stock <= 3) return { text: `Only ${stock} left`, cls: 'low' };
    return { text: 'In stock', cls: 'in' };
}

function ProductCard({ id, name, price, stock, index = 0, onAdd }) {
    const [added, setAdded] = useState(false);
    const count = stock ?? 0;
    const info = stockInfo(count);

    function handleAdd() {
        onAdd();
        setAdded(true);
        setTimeout(() => setAdded(false), 1200);
    }

    return (
        <div className="product-card" style={{ '--i': index }}>
            <Link
                to={`/product/${id}`}
                className="product-thumb"
                style={{ background: tileColor(name) }}
            >
                <span>{name.charAt(0).toUpperCase()}</span>
            </Link>
            <div className="product-body">
                <h3><Link to={`/product/${id}`}>{name}</Link></h3>
                <p className="price">₦{Number(price).toLocaleString()}</p>
                <div className="product-footer">
                    <span className={`stock-tag ${info.cls}`}>{info.text}</span>
                    {onAdd ? (
                        <button
                            className={`btn-small ${added ? 'added' : ''}`}
                            onClick={handleAdd}
                            disabled={count < 1}
                        >
                            {count < 1 ? 'Out of stock' : added ? '✓ Added' : 'Add to cart'}
                        </button>
                    ) : (
                        <Link to={`/product/${id}`} className="btn btn-small">View</Link>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ProductCard;