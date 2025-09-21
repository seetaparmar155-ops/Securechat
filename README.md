# SecureChat Demo — E2EE Chat (ECDH + AES-GCM)

This is a polished demo project for a two-user end-to-end encrypted chat that demonstrates:
- User registration & login (bcrypt password hashing)
- Session management via JWT (HttpOnly cookie)
- ECDH key exchange (P-256) performed in the browser using Web Crypto API
- AES-GCM 256-bit for message encryption (confidentiality + integrity)
- Simple replay protection with a per-peer message counter

> **Important:** This is a demo for educational purposes. Do NOT use in production without reviewing the security notes below.

## Files
- `server.js` — Node.js + Express + ws server (serves static client, handles register/login, relays signaling & encrypted payloads)
- `public/index.html` — Single-file client (UI + WebCrypto ECDH + AES-GCM)
- `package.json` — dependencies & start script

## Quick start (local)
1. Make sure you have Node.js 16+ installed.
2. In the project folder, install deps:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open `http://localhost:3000` in two separate browser windows (or one normal + one incognito).
5. Register two users (e.g., `alice` and `bob`) and login each in a different window.
6. Select the peer in the dropdown, click **Initiate Key Exchange** (one side is enough), then send messages.
7. The server only relays encrypted messages — it never sees plaintext.

## Production notes & improvements
- Replace `JWT_SECRET` in `server.js` with a secure random secret (use environment variable).
- Serve the app over HTTPS/WSS and set the cookie `secure: true`.
- Use HKDF on the ECDH-derived bits to derive AES keys with domain separation.
- Consider using ephemeral keys for forward secrecy and key rotation.
- Store users in a proper database (Postgres/MySQL). Do not use the in-memory object.
- Add message persistence: store ciphertext on the server so offline users can receive messages (server must never have keys).
- Add key confirmation / fingerprint verification to prevent MITM during signaling.

## License
MIT