import { useState, useEffect, useRef } from 'react';
import { API_URL } from '../config';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';

const API = `${API_URL}/api/admin`;

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
    };
}

function naira(amount) {
    return `₦${Number(amount).toLocaleString()}`;
}

async function readJson(res) {
    try {
        return await res.json();
    } catch {
        return {};
    }
}

const FILTERS = ['all', 'pending', 'paid', 'cancelled'];

function AdminOrders({ user }) {
    const toast = useToast();
    const [orders, setOrders] = useState([]);
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState(null);
    const [checks, setChecks] = useState({});
    const [dialog, setDialog] = useState(null);
    const requestCounter = useRef(0);

    async function loadOrders() {
        const myRequest = ++requestCounter.current;
        try {
            const query = filter === 'all' ? '' : `?status=${filter}`;
            const res = await fetch(`${API}/orders${query}`, { headers: authHeaders() });
            const data = await readJson(res);
            if (myRequest !== requestCounter.current) return; // a newer request replaced this one
            if (!res.ok) {
                setError(data.message || 'Could not load orders.');
                return;
            }
            setOrders(data);
            setError('');
        } catch {
            if (myRequest !== requestCounter.current) return;
            setError('Could not load orders.');
        } finally {
            if (myRequest === requestCounter.current) setLoading(false);
        }
    }

    useEffect(() => {
        if (!user || user.role !== 'admin') {
            setLoading(false);
            return;
        }
        setLoading(true);
        loadOrders();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, filter]);

    async function setFulfillment(orderId, fulfillment) {
        setBusyId(orderId);
        try {
            const res = await fetch(`${API}/orders/${orderId}/fulfillment`, {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify({ fulfillment }),
            });
            const data = await readJson(res);
            if (!res.ok) {
                toast.error(data.message || 'Could not update this order.');
                return;
            }
            toast.success(`Order marked as ${fulfillment}.`);
            await loadOrders();
        } catch {
            toast.error('Could not reach the server.');
        } finally {
            setBusyId(null);
        }
    }

    async function checkPayment(orderId) {
        setBusyId(orderId);
        try {
            const res = await fetch(`${API}/orders/${orderId}/check-payment`, {
                method: 'POST',
                headers: authHeaders(),
            });
            const data = await readJson(res);
            if (!res.ok) {
                toast.error(data.message || 'Could not check this payment.');
                return;
            }
            setChecks(prev => ({
                ...prev,
                [orderId]: data.paymentFound
                    ? {
                          found: true,
                          text: `Payment of ${naira(data.amount)} found (${data.reference}). Refund it from the Paystack dashboard.`,
                      }
                    : { found: false, text: 'No completed payment found for this order.' },
            }));
            if (data.paymentFound) {
                toast.error('Payment found on this cancelled order. Refund it from the Paystack dashboard.');
            } else {
                toast.info('No completed payment found for this order.');
            }
            await loadOrders();
        } catch {
            toast.error('Could not reach the server.');
        } finally {
            setBusyId(null);
        }
    }

    function askRefund(orderId) {
        setDialog({
            title: 'Mark as refunded?',
            message: 'Only do this after you have refunded the customer on the Paystack dashboard.',
            confirmLabel: 'Yes, mark as refunded',
            onConfirm: () => markRefunded(orderId),
        });
    }

    async function markRefunded(orderId) {
        setBusyId(orderId);
        try {
            const res = await fetch(`${API}/orders/${orderId}/mark-refunded`, {
                method: 'PUT',
                headers: authHeaders(),
            });
            const data = await readJson(res);
            if (!res.ok) {
                toast.error(data.message || 'Could not update this order.');
                return;
            }
            toast.success('Order marked as refunded.');
            setChecks(prev => {
                const next = { ...prev };
                delete next[orderId];
                return next;
            });
            await loadOrders();
        } catch {
            toast.error('Could not reach the server.');
        } finally {
            setBusyId(null);
        }
    }

    if (!user || user.role !== 'admin') {
        return <p>Admins only.</p>;
    }

    return (
        <div>
            <h2>Manage Orders</h2>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', margin: '14px 0' }}>
                {FILTERS.map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        disabled={filter === f}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {error && <p style={{ color: 'red' }}>{error}</p>}
            {loading && <p>Loading...</p>}
            {!loading && !error && orders.length === 0 && <p>No orders found.</p>}

            {orders.map(order => (
                <div
                    key={order.id}
                    style={{ border: '1px solid #ccc', padding: '12px', margin: '8px' }}
                >
                    <strong>Order #{order.id.slice(-6)}</strong> -{' '}
                    {new Date(order.createdAt).toLocaleString()}
                    <p>
                        Customer: {order.user ? `${order.user.name} (${order.user.email})` : 'Deleted user'}
                    </p>
                    {order.delivery && order.delivery.address ? (
                        <p>
                            Deliver to: {order.delivery.name}, {order.delivery.phone}, {order.delivery.address},{' '}
                            {order.delivery.city}
                        </p>
                    ) : (
                        <p>No delivery details (placed before this feature).</p>
                    )}
                    <ul>
                        {order.items.map((item, i) => (
                            <li key={i}>
                                {item.name} x {item.quantity} - {naira(item.price * item.quantity)}
                            </li>
                        ))}
                    </ul>
                    <p>
                        Total: {naira(order.total)} | Payment: <strong>{order.status}</strong>
                        {order.status === 'paid' && <> | Delivery: <strong>{order.fulfillment}</strong></>}
                    </p>
                    {order.stockIssue && (
                        <p style={{ color: 'red' }}>
                            Stock warning: there wasn't enough stock for this order when it was paid. Contact the
                            customer or refund it from the Paystack dashboard.
                        </p>
                    )}

                    {order.status === 'paid' && order.fulfillment === 'processing' && (
                        <button
                            onClick={() => setFulfillment(order.id, 'shipped')}
                            disabled={busyId === order.id}
                        >
                            Mark as shipped
                        </button>
                    )}
                    {order.status === 'paid' && order.fulfillment === 'shipped' && (
                        <button
                            onClick={() => setFulfillment(order.id, 'delivered')}
                            disabled={busyId === order.id}
                        >
                            Mark as delivered
                        </button>
                    )}

                    {order.paidAfterCancel && (
                        <p style={{ color: '#ff6b6b', fontWeight: 'bold' }}>
                            Paid after cancellation: money was received for this cancelled order
                            (reference {order.paidAfterCancelRef}). Refund it from the Paystack dashboard.
                        </p>
                    )}
                    {order.refunded && (
                        <p style={{ color: 'gray' }}>
                            Refunded (reference {order.paidAfterCancelRef}).
                        </p>
                    )}

                    {order.status === 'cancelled' && !order.refunded && (
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
                            {order.paidAfterCancel && (
                                <button onClick={() => askRefund(order.id)} disabled={busyId === order.id}>
                                    Mark as refunded
                                </button>
                            )}
                            <button onClick={() => checkPayment(order.id)} disabled={busyId === order.id}>
                                Check for payment
                            </button>
                        </div>
                    )}

                    {checks[order.id] && (
                        <p
                            style={{
                                color: checks[order.id].found ? '#ff6b6b' : 'inherit',
                                fontWeight: checks[order.id].found ? 'bold' : 'normal',
                            }}
                        >
                            {checks[order.id].text}
                        </p>
                    )}
                </div>
            ))}

            <ConfirmDialog
                open={!!dialog}
                title={dialog?.title}
                message={dialog?.message}
                confirmLabel={dialog?.confirmLabel}
                danger={dialog?.danger}
                onConfirm={() => {
                    const run = dialog.onConfirm;
                    setDialog(null);
                    run();
                }}
                onCancel={() => setDialog(null)}
            />
        </div>
    );
}

export default AdminOrders;