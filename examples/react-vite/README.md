# React + Vite example

1. Copy `.env.example` to `.env` and set the service URLs.
2. Configure Auth Service `GOOGLE_FRONTEND_CALLBACK_URL` as
   `http://localhost:5173/oauth/callback`.
3. Install and run:

   ```sh
   npm install
   npm run dev
   ```

The service must have Google OIDC configured. The example's `file:../..` package
dependency uses the SDK source package exports, so build the SDK once with
`npm run build` in the package root before running Vite.
