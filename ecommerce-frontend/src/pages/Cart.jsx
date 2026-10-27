import { useState } from 'react';
import { Link } from 'react-router-dom';

function Cart({ cart, onRemove, total, user }) {
    const [error, setError] = useState('');
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

        const grouped = {};
        cart.forEach(item => {
            grouped[item.id] = (grouped[item.id] || 0) + 1;
        });
        const items = Object.entries(grouped).map(([productId, quantity]) => ({
            productId,
            quantity,
        }));

        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
        };

        try {
            const res = await fetch('http://localhost:5000/api/orders', {
                method: 'POST',
                headers,
                body: JSON.stringify({ items, delivery }),
            });
            const order = await res.json();
            if (!res.ok) {
                setError(order.message);
                return;
            }

            const payRes = await fetch(`http://localhost:5000/api/orders/${order.id}/pay`, {
                method: 'POST',
                headers,
            });
            const payData = await payRes.json();
            if (!payRes.ok) {
                setError(
                    `Your order was saved, but payment could not start: ${payData.message} You can finish it from My Orders.`
                );
                return;
            }

            window.location.href = payData.authorizationUrl;
        } catch {
            setError('Could not reach the server.');
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
                            <li key={item.cartId}>
                                <span className="cart-name">{item.name}</span>
                                <span className="cart-price">₦{Number(item.price).toLocaleString()}</span>
                                <button className="btn-danger btn-small" onClick={() => onRemove(item.cartId)}>
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
                                <button onClick={placeOrder}>Place order</button>
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