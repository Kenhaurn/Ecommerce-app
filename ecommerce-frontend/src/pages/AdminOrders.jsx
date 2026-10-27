import { useState, useEffect } from 'react';

const API = 'http://localhost:5000/api/admin';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  };
}

const FILTERS = ['all', 'pending', 'paid', 'cancelled'];

function AdminOrders({ user }) {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);

  async function loadOrders() {
    try {
      const query = filter === 'all' ? '' : `?status=${filter}`;
      const res = await fetch(`${API}/orders${query}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message);
        return;
      }
      setOrders(data);
      setError('');
    } catch {
      setError('Could not load orders.');
    } finally {
      setLoading(false);
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
    setNotice('');
    try {
      const res = await fetch(`${API}/orders/${orderId}/fulfillment`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ fulfillment }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.message);
        return;
      }
      setNotice(`Order marked as ${fulfillment}.`);
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
      const res = await fetch(`${API}/orders/${orderId}/check-payment`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.message);
        return;
      }
      setNotice(
        data.paymentFound
          ? `Payment of ₦${data.amount} found (${data.reference}). Refund it from the Paystack dashboard.`
          : 'No completed payment found for this order.'
      );
    } catch {
      setNotice('Could not reach the server.');
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

      <div>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            disabled={filter === f}
            style={{ marginRight: '6px' }}
          >
            {f}
          </button>
        ))}
      </div>

      {notice && <p style={{ color: 'green' }}>{notice}</p>}
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
                {item.name} x {item.quantity} - ₦{item.price * item.quantity}
              </li>
            ))}
          </ul>
          <p>
            Total: ₦{order.total} | Payment: <strong>{order.status}</strong>
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
          {order.status === 'cancelled' && (
            <button onClick={() => checkPayment(order.id)} disabled={busyId === order.id}>
              Check for payment
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default AdminOrders;