import { useState, useEffect } from 'react';

const API = 'http://localhost:5000/api';

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
    };
}

const emptyForm = { name: '', price: '', description: '', stock: '' };

function AdminProducts({ user }) {
    const [products, setProducts] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    async function loadProducts() {
        try {
            const res = await fetch(`${API}/products`);
            if (!res.ok) throw new Error('Failed');
            setProducts(await res.json());
        } catch {
            setError('Could not load products.');
        }
    }

    useEffect(() => {
        loadProducts();
    }, []);

    function handleChange(e) {
        setForm({ ...form, [e.target.name]: e.target.value });
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setMessage('');
        setError('');

        const url = editingId
            ? `${API}/admin/products/${editingId}`
            : `${API}/admin/products`;

        try {
            const res = await fetch(url, {
                method: editingId ? 'PUT' : 'POST',
                headers: authHeaders(),
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.message);
                return;
            }
            setMessage(editingId ? 'Product updated.' : 'Product added.');
            setForm(emptyForm);
            setEditingId(null);
            await loadProducts();
        } catch {
            setError('Could not reach the server.');
        }
    }

    function startEdit(product) {
        setEditingId(product.id);
        setForm({
            name: product.name,
            price: String(product.price),
            description: product.description || '',
            stock: String(product.stock ?? 0),
        });
        setMessage('');
        setError('');
    }

    function cancelEdit() {
        setEditingId(null);
        setForm(emptyForm);
    }

    async function deleteProduct(id) {
        if (!confirm('Delete this product?')) return;

        setMessage('');
        setError('');

        try {
            const res = await fetch(`${API}/admin/products/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.message);
                return;
            }
            setMessage('Product deleted.');
            await loadProducts();
        } catch {
            setError('Could not reach the server.');
        }
    }

    if (!user || user.role !== 'admin') {
        return <p>Admins only.</p>;
    }

    return (
        <div>
            <h2>Manage Products</h2>

            <form onSubmit={handleSubmit}>
                <h3>{editingId ? 'Edit product' : 'Add a product'}</h3>
                <input
                    name="name"
                    placeholder="Name"
                    value={form.name}
                    onChange={handleChange}
                />
                <br />
                <input
                    name="price"
                    type="number"
                    placeholder="Price (₦)"
                    value={form.price}
                    onChange={handleChange}
                />
                <br />
                <input
                    name="stock"
                    type="number"
                    placeholder="Stock quantity"
                    value={form.stock}
                    onChange={handleChange}
                />
                <br />
                <input
                    name="description"
                    placeholder="Description"
                    value={form.description}
                    onChange={handleChange}
                />
                <br />
                <button type="submit">{editingId ? 'Save changes' : 'Add product'}</button>
                {editingId && (
                    <>
                        {' '}
                        <button type="button" onClick={cancelEdit}>
                            Cancel
                        </button>
                    </>
                )}
            </form>

            {message && <p style={{ color: 'green' }}>{message}</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}

            <h3>All products</h3>
            {products.map(product => (
                <div
                    key={product.id}
                    style={{ border: '1px solid #ccc', padding: '12px', margin: '8px' }}
                >
                    <strong>{product.name}</strong> - ₦{product.price} | In stock: {product.stock ?? 0}
                    <p>{product.description}</p>
                    <button onClick={() => startEdit(product)}>Edit</button>{' '}
                    <button onClick={() => deleteProduct(product.id)}>Delete</button>
                </div>
            ))}
        </div>
    );
}

export default AdminProducts;