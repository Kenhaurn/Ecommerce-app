import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../config';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';

const API = `${API_URL}/api/orders`;

const STATUS_LABELS = {
    pending: 'Awaiting payment',
    paid: 'Paid',
    cancelled: 'Cancelled',
};

const FULFILLMENT_LABELS = {
    processing: 'Being prepared',
    shipped: 'Shipped',
    delivered: 'Delivered',
};

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
    };
}

function naira(amount) {
    return `₦${Number(amount).toLocaleString()}`;
}

// Reads the JSON body safely, even if the server sent something else
async function readJson(res) {
    try {
        return await res.json();
    } catch {
        return {};
    }
}

function Orders({ user }) {
    const toast = useToast();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState(null);
    const [dialog, setDialog] = useState(null);

    async function loadOrders() {
        try {
            const res = await fetch(`${API}/mine`, { headers: authHeaders() });
            if (res.status === 401) {
                setError('Your session has expired. Please log in again.');
                return;
            }
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
        try {
            const res = await fetch(`${API}/${orderId}/pay`, {
                method: 'POST',
                headers: authHeaders(),
            });
            const data = await readJson(res);
            if (!res.ok) {
                toast.error(data.message || 'Could not start payment.');
                return;
            }
            if (data.alreadyPaid) {
                toast.success('We found your payment. This order is now paid.');
                await loadOrders();
                return;
            }
            window.location.href = data.authorizationUrl;
        } catch {
            toast.error('Could not reach the server.');
        } finally {
            setBusyId(null);
        }
    }

    function askCancel(orderId) {
        setDialog({
            title: 'Cancel this order?',
            message: 'The order will be cancelled and you will not be able to pay for it.',
            confirmLabel: 'Yes, cancel order',
            danger: true,
            onConfirm: () => cancelOrder(orderId),
        });
    }

    async function cancelOrder(orderId) {
        setBusyId(orderId);
        try {
            const res = await fetch(`${API}/${orderId}/cancel`, {
                method: 'POST',
                headers: authHeaders(),
            });
            const data = await readJson(res);
            if (!res.ok) {
                toast.error(data.message || 'Could not cancel this order.');
                await loadOrders();
                return;
            }
            toast.success('Order cancelled.');
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
            const res = await fetch(`${API}/${orderId}/check`, {
                method: 'POST',
                headers: authHeaders(),
            });
            const data = await readJson(res);
            if (!res.ok) {
                toast.error(data.message || 'Could not check this payment.');
                return;
            }
            if (data.status === 'paid') {
                toast.success('Payment confirmed. This order is now paid.');
            } else {
                toast.info('No completed payment found for this order yet.');
            }
            await loadOrders();
        } catch {
            toast.error('Could not reach the server.');
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

    return (
        <div>
            <h2>My Orders</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {!error && orders.length === 0 && <p>You haven't placed any orders yet.</p>}
            {orders.map(order => (
                <div
                    key={order.id}
                    style={{ border: '1px solid #ccc', padding: '12px', margin: '8px' }}
                >
                    <p>Placed {new Date(order.createdAt).toLocaleString()}</p>
                    <ul>
                        {order.items.map((item, index) => (
                            <li key={index}>
                                {item.name} × {item.quantity} - {naira(item.price * item.quantity)}
                            </li>
                        ))}
                    </ul>
                    <p>
                        Total: {naira(order.total)} | Status:{' '}
                        <strong>{STATUS_LABELS[order.status] || order.status}</strong>
                        {order.status === 'paid' && order.fulfillment && (
                            <>
                                {' '}| Delivery:{' '}
                                <strong>
                                    {FULFILLMENT_LABELS[order.fulfillment] || order.fulfillment}
                                </strong>
                            </>
                        )}
                    </p>
                    {order.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => completePayment(order.id)}
                                disabled={busyId === order.id}
                            >
                                Complete payment
                            </button>
                            <button
                                onClick={() => checkPayment(order.id)}
                                disabled={busyId === order.id}
                            >
                                Check payment status
                            </button>
                            <button
                                onClick={() => askCancel(order.id)}
                                disabled={busyId === order.id}
                            >
                                Cancel order
                            </button>
                        </div>
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

export default Orders;