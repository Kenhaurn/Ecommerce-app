import { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import Home from './pages/Home';
import Landing from './pages/Landing';
import About from './pages/About';
import Cart from './pages/Cart';
import ProductDetail from './pages/ProductDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import Orders from './pages/Orders';
import PaymentCallback from './pages/PaymentCallback';
import AdminProducts from './pages/AdminProducts';
import AdminOrders from './pages/AdminOrders';


// Reads the saved cart. Also merges old-style carts where the same product was added as separate lines.
function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem('cart') || '[]');
    if (!Array.isArray(saved)) return [];
    const merged = [];
    for (const item of saved) {
      if (!item || !item.id) continue;
      const qty = Number.isInteger(item.quantity) && item.quantity > 0 ? item.quantity : 1;
      const existing = merged.find(m => m.id === item.id);
      if (existing) {
        existing.quantity += qty;
      } else {
        merged.push({
          id: item.id,
          name: item.name,
          price: item.price,
          image: item.image,
          stock: item.stock ?? 0,
          quantity: qty,
        });
      }
    }
    return merged;
  } catch {
    return [];
  }
}

function App() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the menu whenever you go to another page
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Close it when you click outside it or press Escape
  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const [cart, setCart] = useState(loadCart);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
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

    // Returns false when the cart already holds all the stock, so the page can tell the shopper
function addToCart(product) {
    const stock = product.stock ?? 0;
    const existing = cart.find(item => item.id === product.id);
    if ((existing ? existing.quantity : 0) >= stock) return false;

    setCart(prev => {
      const found = prev.find(item => item.id === product.id);
      if (found) {
        if (found.quantity >= stock) return prev;
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          stock,
          quantity: 1,
        },
      ];
    });
    return true;
  }

function changeQuantity(id, delta) {
    setCart(prev =>
      prev.flatMap(item => {
        if (item.id !== id) return [item];
        const next = item.quantity + delta;
        if (next < 1) return []; // going below 1 removes the line
        return [{ ...item, quantity: Math.min(next, item.stock) }];
      })
    );
  }

  function removeFromCart(id) {
    setCart(prev => prev.filter(item => item.id !== id));
  }

function clearCart() {
    setCart([]);
  }

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <ToastProvider>
    <div>
            <header className="site-header">
        <div className="header-inner">
          <div className="brand-group">
            <Link to={user ? '/shop' : '/'} className="brand">My Store</Link>
            {user && user.role === 'admin' && <span className="admin-badge">Admin</span>}
          </div>

          <div className="header-right" ref={menuRef}>
            <button
              type="button"
              className="menu-button"
              onClick={() => setMenuOpen(open => !open)}
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="4" y1="7" x2="20" y2="7" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="17" x2="20" y2="17" />
                </svg>
              )}
              {!onLanding && cartCount > 0 && <span className="cart-pill menu-pill">{cartCount}</span>}
            </button>

            {menuOpen && (
              <nav className="menu-panel">
                {user && <div className="menu-user">Hi, {user.name}</div>}

                {!user && <Link to="/" className="menu-link">Home</Link>}
                <Link to="/shop" className="menu-link">Shop</Link>
                <Link to="/about" className="menu-link">About</Link>
                {!onLanding && (
                  <Link to="/cart" className="menu-link">
                    Cart{cartCount > 0 && <span className="cart-pill" style={{ marginLeft: '8px' }}>{cartCount}</span>}
                  </Link>
                )}

                {user ? (
                  <>
                    <Link to="/orders" className="menu-link">My Orders</Link>
                    {user.role === 'admin' && (
                      <>
                        <Link to="/admin/products" className="menu-link">Manage Products</Link>
                        <Link to="/admin/orders" className="menu-link">Manage Orders</Link>
                      </>
                    )}
                    <button
                      type="button"
                      className="menu-link menu-link-button"
                      onClick={() => {
                        setMenuOpen(false);
                        logout();
                      }}
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="menu-link">Login</Link>
                    <Link to="/register" className="menu-link">Register</Link>
                  </>
                )}
              </nav>
            )}
          </div>
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
                onChangeQty={changeQuantity}
                total={total}
                user={user}
                onOrderPlaced={clearCart}
              />
            }
          />
          <Route path="/login" element={<Login onAuth={handleAuth} />} />
          <Route path="/register" element={<Register onAuth={handleAuth} />} />
          <Route path="/orders" element={<Orders user={user} />} />
          <Route path="/payment/callback" element={<PaymentCallback />} />
          <Route path="/admin/products" element={<AdminProducts user={user} />} />
          <Route path="/admin/orders" element={<AdminOrders user={user} />} />
        </Routes>
      </main>
    </div>
  </ToastProvider>
  );
}

export default App;