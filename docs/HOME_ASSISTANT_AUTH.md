# Home Assistant sign-in

With server storage active, HA authorization belongs to the owner profile: encrypted refresh token in the database, access tokens/PKCE in backend RAM. After restarting, server sign-in reopens the last home and reconnects HA. **Sign out of the server** keeps authorization; **Unlink Home Assistant from your profile** removes it and attempts revocation. Upgrading from memory-only connections requires one HA authorization with this version. See [BACKEND.md](BACKEND.md). The following instructions describe direct local-mode connections only.

Under **Settings → Home automation connection**, enter the instance HTTP(S) URL and choose **Sign in with Home Assistant**. Allow the sign-in window, authenticate in HA, and authorize Smart Home 3D. After exchanging the code, the window closes and devices load. The app must use **localhost or HTTPS** for browser PKCE cryptography; from an HTTPS page, HA must also use HTTPS.

Sign-in uses authorization code, PKCE S256, and a random nonce. Client ID/callback share the app origin. Callback processing precedes routing: it immediately removes URL parameters and sends the code only to the original same-origin window. The main window checks origin, window identity, and nonce; the first result consumes the attempt. Five-minute-expired requests, closed windows, and invalid responses cannot create sessions.

Access/refresh tokens, nonce, and PKCE verifier stay **in memory only**, never in localStorage, sessionStorage, IndexedDB, logs, or exported JSON. The service worker excludes authentication callbacks from handled navigations. Token requests use POST, `no-store`, no browser credentials, and no HTTP redirects.

The session renews about one minute before expiration and supplies fresh credentials on each WebSocket reconnection. Concurrent requests share one renewal. Rejected renewal closes the connection and requires sign-in again. Late responses cannot reopen a closed session.

**Disconnect**, switching to demo, and changing connections clear credentials and revoke the OAuth session at HA. If revocation fails, the app asks you to revoke it from the HA profile too. An existing manual token is removed only from app memory, not revoked remotely.

In local mode, renewal works while the tab remains open. After **reload or tab closure**, the provider returns to demo and requires sign-in again; HA may retain its own UI login. Local projects remain in IndexedDB. Use the backend profile above to restore authorization across restarts.

**Advanced access with a manual token** remains available. Its input clears on submission. Real-device bindings remain in the project while the demo provider is active.

Automated testing uses a simulated server/fake credentials, without changing the user's HA instance or operating physical devices.

Official sources: [HA authentication API](https://contributors.home-assistant.io/core/internals/auth-api/), [PKCE/revocation implementation in installed version 2026.10.4](https://github.com/home-assistant/core/blob/2026.10.4/homeassistant/components/auth/__init__.py).
