import { useEffect, useRef } from 'react';

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let scriptPromise = null;

function loadScript() {
    if (window.turnstile) return Promise.resolve();
    if (!scriptPromise) {
        scriptPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = SCRIPT_SRC;
            script.async = true;
            script.onload = resolve;
            script.onerror = () => {
                scriptPromise = null;
                reject(new Error('Could not load the human check'));
            };
            document.head.appendChild(script);
        });
    }
    return scriptPromise;
}

// Shows the Cloudflare check and reports the result token through onToken.
// Change resetKey to get a fresh check (a token only works once).
function TurnstileWidget({ onToken, resetKey = 0 }) {
    const boxRef = useRef(null);

    useEffect(() => {
        if (!SITE_KEY) return;
        let widgetId;
        let cancelled = false;

        loadScript()
            .then(() => {
                if (cancelled || !boxRef.current) return;
                widgetId = window.turnstile.render(boxRef.current, {
                    sitekey: SITE_KEY,
                    theme: 'dark',
                    callback: token => onToken(token),
                    'expired-callback': () => onToken(''),
                    'error-callback': () => onToken(''),
                });
            })
            .catch(() => onToken(''));

        return () => {
            cancelled = true;
            if (widgetId !== undefined && window.turnstile) {
                window.turnstile.remove(widgetId);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resetKey]);

    return <div ref={boxRef} style={{ margin: '12px 0' }} />;
}

export default TurnstileWidget;