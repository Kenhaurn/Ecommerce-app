import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) {
    const confirmRef = useRef(null);

    // Focus the confirm button WITHOUT letting the browser scroll to it
    useEffect(() => {
        if (open && confirmRef.current) {
            confirmRef.current.focus({ preventScroll: true });
        }
    }, [open]);

    // Pressing Escape closes the dialog
    useEffect(() => {
        if (!open) return;
        function onKey(e) {
            if (e.key === 'Escape') onCancel();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onCancel]);

    if (!open) return null;

    // The portal draws the dialog on <body>, outside the page layout,
    // so it always sits on the screen no matter where you have scrolled
    return createPortal(
        <div className="dialog-backdrop" onClick={onCancel}>
            <div
                className="dialog-box"
                role="dialog"
                aria-modal="true"
                aria-labelledby="dialog-title"
                onClick={e => e.stopPropagation()}
            >
                <h3 id="dialog-title">{title}</h3>
                <p>{message}</p>
                <div className="dialog-actions">
                    <button type="button" className="btn-ghost" onClick={onCancel}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        ref={confirmRef}
                        className={danger ? 'btn-danger' : ''}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default ConfirmDialog;