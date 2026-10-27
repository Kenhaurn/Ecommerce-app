import { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Landing from './pages/Landing';
import About from './pages/About';
import Cart from './pages/Cart';
import ProductDetail from './pages/ProductDetail';
import Login from './pages/login';
import Register from './pages/Register';
import Orders from './pages/Orders';
import PaymentCallback from './pages/PaymentCallback';
import AdminProducts from './pages/AdminProducts';
import AdminOrders from './pages/AdminOrders';

function App() {
  const location = useLocation();

  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  // The landing page is the front page shown to logged-out visitors
  const onLanding = !user && location.pathname === '/';

  function handleAuth(data) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }

  function addToCart(product) {
    setCart([...cart, { ...product, cartId: Date.now() }]);
  }

  function removeFromCart(cartId) {
    setCart(cart.filter(item => item.cartId !== cartId));
  }

  function clearCart() {
    setCart([]);
  }

  const total = cart.reduce((sum, item) => sum + item.price, 0);

  return (
    <div>
      <header className="site-header">
        <div className="header-inner">
          <Link to={user ? '/shop' : '/'} className="brand">My Store</Link>
          <nav className="nav-links">
            {!user && <Link to="/" className="nav-link">Home</Link>}
            <Link to="/shop" className="nav-link">Shop</Link>
            <Link to="/about" className="nav-link">About</Link>
            {!onLanding && (
              <Link to="/cart" className="nav-link">
                Cart
                {cart.length > 0 && <span className="cart-pill">{cart.length}</span>}
              </Link>
            )}
            {user ? (
              <>
                <Link to="/orders" className="nav-link">My Orders</Link>
                {user.role === 'admin' && (
                  <>
                    <span className="admin-badge">Admin</span>
                    <Link to="/admin/products" className="nav-link">Products</Link>
                    <Link to="/admin/orders" className="nav-link">Orders</Link>
                  </>
                )}
                <span className="user-chip">Hi, {user.name}</span>
                <button className="btn-ghost btn-small" onClick={logout}>Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-link">Login</Link>
                <Link to="/register" className="btn btn-small">Register</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="container">
        <Routes>
          <Route
            path="/"
            element={user ? <Navigate to="/shop" replace /> : <Landing />}
          />
          <Route path="/shop" element={<Home onAdd={addToCart} />} />
          <Route path="/about" element={<About user={user} />} />
          <Route path="/product/:id" element={<ProductDetail onAdd={addToCart} />} />
          <Route
            path="/cart"
            element={
              <Cart
                cart={cart}
                onRemove={removeFromCart}
                total={total}
                user={user}
                onOrderPlaced={clearCart}
              />
            }
          />
          <Route path="/login" element={<Login onAuth={handleAuth} />} />
          <Route path="/register" element={<Register onAuth={handleAuth} />} />
          <Route path="/orders" element={<Orders user={user} />} />
          <Route path="/payment/callback" element={<PaymentCallback onPaid={clearCart} />} />
          <Route path="/admin/products" element={<AdminProducts user={user} />} />
          <Route path="/admin/orders" element={<AdminOrders user={user} />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;