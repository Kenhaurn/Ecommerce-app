import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { API_URL } from '../config';

function PaymentCallback() {
    const [searchParams] = useSearchParams();
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    const [status, setStatus] = useState('checking');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!reference) {
            setMessage('No payment reference was found in the link.');
            setStatus('failed');
            return;
        }

        let ignore = false;

        async function verify() {
            try {
                const res = await fetch(`${API_URL}/api/orders/verify`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                    },
                    body: JSON.stringify({ reference }),
                });
                const data = await res.json().catch(() => ({}));
                if (ignore) return;

                if (res.ok) {
                    setStatus('success');
                } else {
                    setMessage(data.message || 'Payment could not be verified.');
                    setStatus('failed');
                }
            } catch {
                if (ignore) return;
                setMessage('Could not reach the server. Please check your connection and try again.');
                setStatus('failed');
            }
        }

        verify();

        // Stops a stale request from updating the page after you leave it
        return () => {
            ignore = true;
        };
    }, [reference]);

    if (status === 'checking') return <p>Confirming your payment...</p>;

    if (status === 'success') {
        return (
            <div>
                <h2>Payment successful</h2>
                <p>Thank you! Your order has been paid.</p>
                <Link to="/orders" className="btn">View my orders</Link>{' '}
                <Link to="/shop">Continue shopping</Link>
            </div>
        );
    }

    return (
        <div>
            <h2>Payment not completed</h2>
            <p>{message}</p>
            <p>
                If money left your account, please contact support and quote your payment
                reference. Otherwise you can try again from My Orders.
            </p>
            {reference && <p>Reference: {reference}</p>}
            <Link to="/orders" className="btn">Go to my orders</Link>
        </div>
    );
}

export default PaymentCallback;