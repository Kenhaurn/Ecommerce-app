import { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../config';

function Cart({ cart, onRemove, onChangeQty, total, user, onOrderPlaced }) {
    const [error, setError] = useState('');
    const [placing, setPlacing] = useState(false);
    const [delivery, setDelivery] = useState({
        name: '',
        phone: '',
        address: '',
        city: '',
    });

    function handleDeliveryChange(e) {
        setDelivery({ ...delivery, [e.target.name]: e.target.value });
    }

    async function placeOrder() {
        setError('');

        if (!delivery.name.trim() || !delivery.phone.trim() || !delivery.address.trim() || !delivery.city.trim()) {
            setError('Please fill in all delivery details.');
            return;
        }

        const items = cart.map(item => ({
            productId: item.id,
            quantity: item.quantity,
        }));

        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
        };

        setPlacing(true);
        try {
            const res = await fetch(`${API_URL}/api/orders`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ items, delivery }),
            });
            const order = await res.json();
            if (!res.ok) {
                setError(order.message || 'Could not place the order.');
                setPlacing(false);
                return;
            }

            // Order is saved, so the cart has done its job
            onOrderPlaced();

            const payRes = await fetch(`${API_URL}/api/orders/${order.id}/pay`, {
                method: 'POST',
                headers,
            });
            const payData = await payRes.json();
            if (!payRes.ok) {
                setError(
                    `Your order was saved, but payment could not start: ${payData.message || 'unknown error'}. You can finish it from My Orders.`
                );
                setPlacing(false);
                return;
            }

            window.location.href = payData.authorizationUrl;
        } catch {
            setError('Could not reach the server.');
            setPlacing(false);
        }
    }

    return (
        <div>
            <h2>Your Cart</h2>

            {cart.length === 0 && (
                <div className="empty-state">
                    🛒
                    <p>Your cart is empty.</p>
                    <Link to="/shop" className="btn">Start shopping</Link>
                </div>
            )}

            {cart.length > 0 && (
                <div className="cart-layout">
                    <ul className="cart-list">
                        {cart.map(item => (
                            <li key={item.id}>
                                <span className="cart-name">
                                    {item.name}
                                    <small style={{ display: 'block', opacity: 0.7 }}>
                                        ₦{Number(item.price).toLocaleString()} each
                                    </small>
                                </span>

                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button
                                        className="btn-small"
                                        onClick={() => onChangeQty(item.id, -1)}
                                        aria-label={`Decrease ${item.name}`}
                                    >
                                        −
                                    </button>
                                    <strong>{item.quantity}</strong>
                                    <button
                                        className="btn-small"
                                        onClick={() => onChangeQty(item.id, 1)}
                                        disabled={item.quantity >= item.stock}
                                        aria-label={`Increase ${item.name}`}
                                    >
                                        +
                                    </button>
                                </span>

                                <span className="cart-price">
                                    ₦{Number(item.price * item.quantity).toLocaleString()}
                                </span>
                                <button className="btn-danger btn-small" onClick={() => onRemove(item.id)}>
                                    Remove
                                </button>
                            </li>
                        ))}
                    </ul>

                    <aside className="card summary">
                        <h3>Order summary</h3>
                        <div className="summary-row">
                            <span>Total</span>
                            <strong>₦{Number(total).toLocaleString()}</strong>
                        </div>

                        {user ? (
                            <>
                                <h3>Delivery details</h3>
                                <input name="name" placeholder="Full name" value={delivery.name} onChange={handleDeliveryChange} />
                                <input name="phone" placeholder="Phone number" value={delivery.phone} onChange={handleDeliveryChange} />
                                <input name="address" placeholder="Street address" value={delivery.address} onChange={handleDeliveryChange} />
                                <input name="city" placeholder="City / State" value={delivery.city} onChange={handleDeliveryChange} />
                                <button onClick={placeOrder} disabled={placing}>
                                    {placing ? 'Please wait...' : 'Place order'}
                                </button>
                            </>
                        ) : (
                            <p>
                                <Link to="/login">Log in</Link> to place your order.
                            </p>
                        )}

                        {error && <p style={{ color: 'red' }}>{error}</p>}
                    </aside>
                </div>
            )}
        </div>
    );
}

export default Cart;