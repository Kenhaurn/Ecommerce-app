import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

function PaymentCallback({ onPaid }) {
    const [searchParams] = useSearchParams();
    const reference = searchParams.get('reference');
    const [status, setStatus] = useState('checking');

    useEffect(() => {
        if (!reference) {
            setStatus('failed');
            return;
        }

        fetch('http://localhost:5000/api/orders/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify({ reference }),
        })
            .then(res => {
                if (!res.ok) throw new Error('Payment not verified');
                return res.json();
            })
            .then(() => {
                onPaid();
                setStatus('success');
            })
            .catch(() => setStatus('failed'));
    }, [reference]);

    if (status === 'checking') return <p>Confirming your payment...</p>;

    if (status === 'success') {
        return (
            <div>
                <h2>Payment successful</h2>
                <p>Thank you! Your order has been paid.</p>
                <Link to="/">Continue shopping</Link>
            </div>
        );
    }

    return (
        <div>
            <h2>Payment not completed</h2>
            <p>We couldn't confirm your payment. If money left your account, please contact support and quote your payment reference.</p>
            {reference && <p>Reference: {reference}</p>}
            <Link to="/cart">Back to cart</Link>
        </div>
    );
}

export default PaymentCallback;