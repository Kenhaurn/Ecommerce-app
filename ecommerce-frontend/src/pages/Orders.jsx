import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API = 'http://localhost:5000/api/orders';

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
    };
}

function Orders({ user }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busyId, setBusyId] = useState(null);

    async function loadOrders() {
        try {
            const res = await fetch(`${API}/mine`, { headers: authHeaders() });
            if (!res.ok) throw new Error('Failed');
            setOrders(await res.json());
            setError('');
        } catch {
            setError('Could not load orders.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }
        loadOrders();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    async function completePayment(orderId) {
        setBusyId(orderId);
        setNotice('');
        try {
            const res = await fetch(`${API}/${orderId}/pay`, {
                method: 'POST',
                headers: authHeaders(),
            });
            const data = await res.json();
            if (!res.ok) {
                setNotice(data.message);
                return;
            }
            if (data.alreadyPaid) {
                setNotice('We found your payment. This order is now paid.');
                await loadOrders();
                return;
            }
            window.location.href = data.authorizationUrl;
        } catch {
            setNotice('Could not reach the server.');
        } finally {
            setBusyId(null);
        }
    }

    async function cancelOrder(orderId) {
        if (!confirm('Cancel this order?')) return;
        setBusyId(orderId);
        setNotice('');
        try {
            const res = await fetch(`${API}/${orderId}/cancel`, {
                method: 'POST',
                headers: authHeaders(),
            });
            const data = await res.json();
            if (!res.ok) {
                setNotice(data.message);
                await loadOrders();
                return;
            }
            setNotice('Order cancelled.');
            await loadOrders();
        } catch {
            setNotice('Could not reach the server.');
        } finally {
            setBusyId(null);
        }
    }

    async function checkPayment(orderId) {
        setBusyId(orderId);
        setNotice('');
        try {
            const res = await fetch(`${API}/${orderId}/check`, {
                method: 'POST',
                headers: authHeaders(),
            });
            const data = await res.json();
            if (!res.ok) {
                setNotice(data.message);
                return;
            }
            setNotice(
                data.status === 'paid'
                    ? 'Payment confirmed. This order is now paid.'
                    : 'No completed payment found for this order yet.'
            );
            await loadOrders();
        } catch {
            setNotice('Could not reach the server.');
        } finally {
            setBusyId(null);
        }
    }

    if (!user) {
        return (
            <p>
                <Link to="/login">Log in</Link> to see your orders.
            </p>
        );
    }
    if (loading) return <p>Loading orders...</p>;
    if (error) return <p>{error}</p>;

    return (
        <div>
            <h2>My Orders</h2>
            {notice && <p>{notice}</p>}
            {orders.length === 0 && <p>You haven't placed any orders yet.</p>}
            {orders.map(order => (
                <div
                    key={order.id}
                    style={{ border: '1px solid #ccc', padding: '12px', margin: '8px' }}
                >
                    <p>Placed {new Date(order.createdAt).toLocaleString()}</p>
                    <ul>
                        {order.items.map((item, index) => (
                            <li key={index}>
                                {item.name} × {item.quantity} - ₦{item.price * item.quantity}
                            </li>
                        ))}
                    </ul>
                    <p>
                        Total: ₦{order.total} | Status: {order.status}
                    </p>
                    {order.status === 'pending' && (
                        <div>
                            <button
                                onClick={() => completePayment(order.id)}
                                disabled={busyId === order.id}
                            >
                                Complete payment
                            </button>{' '}
                            <button
                                onClick={() => checkPayment(order.id)}
                                disabled={busyId === order.id}
                            >
                                Check payment status
                            </button>{' '}
                            <button
                                onClick={() => cancelOrder(order.id)}
                                disabled={busyId === order.id}
                            >
                                Cancel order
                            </button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

export default Orders;