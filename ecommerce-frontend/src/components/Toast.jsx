import { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const nextId = useRef(1);

    const remove = useCallback(id => {
        setToasts(list => list.filter(t => t.id !== id));
    }, []);

    const show = useCallback(
        (text, type) => {
            const id = nextId.current++;
            setToasts(list => [...list, { id, text, type }]);
            // Errors stay a bit longer so they can be read
            setTimeout(() => remove(id), type === 'error' ? 6000 : 4000);
        },
        [remove]
    );

    const api = useMemo(
        () => ({
            success: text => show(text, 'success'),
            error: text => show(text, 'error'),
            info: text => show(text, 'info'),
        }),
        [show]
    );

    return (
        <ToastContext.Provider value={api}>
            {children}
            {createPortal(
                <div className="toast-stack" aria-live="polite">
                    {toasts.map(t => (
                        <div key={t.id} className={`toast toast-${t.type}`} role="status">
                            <span>{t.text}</span>
                            <button
                                type="button"
                                className="toast-close"
                                onClick={() => remove(t.id)}
                                aria-label="Dismiss"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </ToastContext.Provider>
    );
}

// Use inside any page: const toast = useToast(); toast.success('Saved!');
export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        throw new Error('useToast must be used inside <ToastProvider> (wrap App in it).');
    }
    return ctx;
}