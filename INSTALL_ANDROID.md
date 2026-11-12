# Install on Android — OYSTER AI

## 1. Get the app running on your Mac first

Follow `INSTALL_MAC.md`. Make sure the backend and frontend both run with `--host 0.0.0.0` / `--hostname 0.0.0.0` so they are reachable from your phone.

## 2. Point the frontend at your Mac's LAN IP

Find your Mac's local IP (System Settings → Wi-Fi → Details, or `ipconfig getifaddr en0`), then create `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=http://192.168.x.x:8000
```

Restart the frontend (`npm run dev -- --hostname 0.0.0.0`).

## 3. Open on your Android phone

- Connect the phone to the **same Wi-Fi network** as the Mac.
- In Chrome, visit `http://192.168.x.x:3000` (your Mac's IP).

## 4. Install as a PWA

- Chrome menu (⋮) → **Install app** / **Add to Home screen**.
- The app launches full-screen with its own icon (OYSTER AI brand mark).

## Limitations to know

- **HTTP over LAN is for testing only.** PWA service-worker installation and secure-context features generally require HTTPS (localhost is exempt). For a real deployment, put the app behind HTTPS via a reverse proxy.
- **Offline mode is shell-only.** The service worker caches the app shell (layout, icons, manifest). Financial data and account state are never cached for offline use — the dashboard shows a connection notice instead of stale numbers.
- Phone and Mac hit the **same backend**, so data stays in sync automatically.

## Security reminder

`DEMO_MODE=true` has no authentication guard. Never port-forward or expose this dev server to the public internet. LAN testing on your own Wi-Fi only.
