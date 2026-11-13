import { useState, useEffect } from 'react';
import { API_URL } from '../config';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';

const API = `${API_URL}/api`;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function authOnly() {
    // No Content-Type here: the browser sets it itself for file uploads.
    return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

const emptyForm = { name: '', price: '', description: '', stock: '' };

function AdminProducts({ user }) {
    const toast = useToast();
    const [products, setProducts] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [existingImage, setExistingImage] = useState('');
    const [removeImage, setRemoveImage] = useState(false);
    const [preview, setPreview] = useState('');
    const [fileKey, setFileKey] = useState(0);
    const [saving, setSaving] = useState(false);
    const [dialog, setDialog] = useState(null);
    const [stockInputs, setStockInputs] = useState({});
    const [stockBusyId, setStockBusyId] = useState(null);

    async function loadProducts() {
        try {
            const res = await fetch(`${API}/products`);
            if (!res.ok) throw new Error('Failed');
            setProducts(await res.json());
        } catch {
            toast.error('Could not load products.');
        }
    }

    useEffect(() => {
        loadProducts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Show a preview of the newly chosen file
    useEffect(() => {
        if (!imageFile) {
            setPreview('');
            return;
        }
        const url = URL.createObjectURL(imageFile);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [imageFile]);

    function handleChange(e) {
        setForm({ ...form, [e.target.name]: e.target.value });
    }

    function handleFileChange(e) {
        const file = e.target.files[0] || null;
        if (file && file.size > MAX_IMAGE_SIZE) {
            toast.error('Image must be under 5 MB.');
            e.target.value = '';
            return;
        }
        setImageFile(file);
        setRemoveImage(false);
    }

    function resetForm() {
        setForm(emptyForm);
        setEditingId(null);
        setImageFile(null);
        setExistingImage('');
        setRemoveImage(false);
        setFileKey(k => k + 1);
    }

    async function handleSubmit(e) {
        e.preventDefault();

        if (!form.name.trim()) {
            toast.error('Please enter a product name.');
            return;
        }
        if (form.price === '' || Number(form.price) < 0) {
            toast.error('Please enter a valid price.');
            return;
        }
        if (!editingId && (form.stock === '' || Number(form.stock) < 0 || !Number.isInteger(Number(form.stock)))) {
            toast.error('Stock must be a whole number, 0 or more.');
            return;
        }

        setSaving(true);

        const body = new FormData();
        body.append('name', form.name);
        body.append('price', form.price);
        if (!editingId) body.append('stock', form.stock);
        body.append('description', form.description);
        if (imageFile) body.append('image', imageFile);
        if (editingId && removeImage && !imageFile) body.append('removeImage', 'true');

        const url = editingId
            ? `${API}/admin/products/${editingId}`
            : `${API}/admin/products`;

        try {
            const res = await fetch(url, {
                method: editingId ? 'PUT' : 'POST',
                headers: authOnly(),
                body,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(data.message || 'Could not save the product.');
                return;
            }
            toast.success(editingId ? 'Product updated.' : 'Product added.');
            resetForm();
            await loadProducts();
        } catch {
            toast.error('Could not reach the server.');
        } finally {
            setSaving(false);
        }
    }

    async function startEdit(listProduct) {
        // Fetch the latest copy so the stock number isn't out of date
        let product = listProduct;
        try {
            const res = await fetch(`${API}/products/${listProduct.id}`);
            if (res.ok) product = await res.json();
        } catch {
            // fall back to the list copy
        }

        setEditingId(product.id);
        setForm({
            name: product.name,
            price: String(product.price),
            description: product.description || '',
            stock: String(product.stock ?? 0),
        });
        setImageFile(null);
        setExistingImage(product.image || '');
        setRemoveImage(false);
        setFileKey(k => k + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function adjustStock(product, sign) {
        const amount = Number(stockInputs[product.id] ?? 1);
        if (!Number.isInteger(amount) || amount < 1) {
            toast.error('Enter a whole number of 1 or more.');
            return;
        }

        setStockBusyId(product.id);
        try {
            const res = await fetch(`${API}/admin/products/${product.id}/stock`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...authOnly() },
                body: JSON.stringify({ change: sign * amount }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(data.message || 'Could not adjust stock.');
                return;
            }
            toast.success(`${product.name}: stock is now ${data.stock}.`);
            setProducts(list =>
                list.map(p => (p.id === product.id ? { ...p, stock: data.stock } : p))
            );
            setStockInputs(prev => ({ ...prev, [product.id]: '1' }));
        } catch {
            toast.error('Could not reach the server.');
        } finally {
            setStockBusyId(null);
        }
    }

    function askDelete(product) {
        setDialog({
            title: `Delete "${product.name}"?`,
            message: 'This removes the product and its image. Past orders keep their own copy.',
            confirmLabel: 'Yes, delete',
            danger: true,
            onConfirm: () => deleteProduct(product.id),
        });
    }

    async function deleteProduct(id) {
        try {
            const res = await fetch(`${API}/admin/products/${id}`, {
                method: 'DELETE',
                headers: authOnly(),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(data.message || 'Could not delete the product.');
                return;
            }
            toast.success('Product deleted.');
            await loadProducts();
        } catch {
            toast.error('Could not reach the server.');
        }
    }

    if (!user || user.role !== 'admin') {
        return <p>Admins only.</p>;
    }

    const shownImage = preview || (removeImage ? '' : existingImage);

    return (
        <div>
            <h2>Manage Products</h2>

            <form onSubmit={handleSubmit}>
                <h3>{editingId ? 'Edit product' : 'Add a product'}</h3>
                <input name="name" placeholder="Name" value={form.name} onChange={handleChange} />
                <input
                    name="price"
                    type="number"
                    min="0"
                    placeholder="Price (₦)"
                    value={form.price}
                    onChange={handleChange}
                />
                {!editingId && (
                    <input
                        name="stock"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Starting stock quantity"
                        value={form.stock}
                        onChange={handleChange}
                    />
                )}
                {editingId && (
                    <small>
                        Stock is changed with the "Adjust stock" buttons in the product list below.
                    </small>
                )}
                <input
                    name="description"
                    placeholder="Description"
                    value={form.description}
                    onChange={handleChange}
                />

                <label className="field-label">Product image</label>
                {shownImage && <img src={shownImage} alt="Preview" className="image-preview" />}
                <input
                    key={fileKey}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileChange}
                />
                {editingId && existingImage && !imageFile && (
                    <label className="check-row">
                        <input
                            type="checkbox"
                            checked={removeImage}
                            onChange={e => setRemoveImage(e.target.checked)}
                        />
                        Remove current image
                    </label>
                )}

                <button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add product'}
                </button>
                {editingId && (
                    <>
                        {' '}
                        <button type="button" className="btn-ghost" onClick={resetForm}>
                            Cancel
                        </button>
                    </>
                )}
            </form>

            <h3 style={{ marginTop: '28px' }}>All products</h3>
            {products.map(product => (
                <div key={product.id} className="card admin-product">
                    {product.image ? (
                        <img src={product.image} alt={product.name} className="admin-thumb" />
                    ) : (
                        <div className="admin-thumb placeholder">
                            {product.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className="info">
                        <strong>{product.name}</strong> - ₦{Number(product.price).toLocaleString()} | In
                        stock: {product.stock ?? 0}
                        <p>{product.description}</p>

                        <div
                            style={{
                                display: 'flex',
                                gap: '8px',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                margin: '8px 0',
                            }}
                        >
                            <span>Adjust stock:</span>
                            <input
                                type="number"
                                min="1"
                                step="1"
                                style={{ width: '80px' }}
                                value={stockInputs[product.id] ?? '1'}
                                onChange={e =>
                                    setStockInputs(prev => ({ ...prev, [product.id]: e.target.value }))
                                }
                            />
                            <button
                                className="btn-small"
                                onClick={() => adjustStock(product, -1)}
                                disabled={stockBusyId === product.id}
                            >
                                − Remove
                            </button>
                            <button
                                className="btn-small"
                                onClick={() => adjustStock(product, 1)}
                                disabled={stockBusyId === product.id}
                            >
                                + Add
                            </button>
                        </div>

                        <button className="btn-small" onClick={() => startEdit(product)}>Edit</button>{' '}
                        <button className="btn-small btn-danger" onClick={() => askDelete(product)}>
                            Delete
                        </button>
                    </div>
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

export default AdminProducts;