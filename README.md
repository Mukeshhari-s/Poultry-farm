# Poultry-farm

Full-stack poultry management system with an Express/MongoDB backend and a React (Vite) frontend.

## Prerequisites
- Node.js 18+
- npm 9+
- MongoDB Atlas cluster (for production) or local MongoDB for development

## Local Development
1. **Install dependencies**
	- `cd backend && npm install`
	- `cd ../frontend && npm install`
2. **Environment files**
	- `backend/.env` → copy from `.env.example` and fill `MONGO_URI`, `JWT_SECRET`, etc.
	- `frontend/.env` → copy from `.env.example` and set `VITE_API_URL=http://localhost:5000` while developing.
3. **Run services**
	- Backend: `npm start` inside `backend/`
	- Frontend: `npm run dev` inside `frontend/`

## Environment Variables
| Location          | Key          | Description                                  |
|-------------------|--------------|----------------------------------------------|
| `backend/.env`    | `MONGO_URI`  | MongoDB connection string (Atlas recommended) |
|                   | `PORT`       | Backend port (Render assigns automatically)   |
|                   | `JWT_SECRET` | Long random string for signing JWTs           |
|                   | `JWT_EXPIRES`| Token expiry window (e.g., `1h`)              |
| `frontend/.env`   | `VITE_API_URL` | URL to the deployed backend API             |

## Deployment Workflow

### Backend → Render
1. Push the latest code to GitHub.
2. Create a *Web Service* in Render pointing to the repo root, but set **Root Directory** to `backend`.
3. Build command: `npm install`. Start command: `npm start`.
4. Add environment variables in Render’s *Environment* tab (values from `backend/.env`).
5. Optionally add `/api/health` or `/health` route for Render health checks.
6. After deploy, note the Render URL (e.g., `https://poultry-backend.onrender.com`).

### Frontend → Vercel
1. Create a new Vercel project and select the same GitHub repo.
2. Set **Root Directory** to `frontend`.
3. Build command: `npm run build`. Output directory: `dist`.
4. Under *Environment Variables*, set `VITE_API_URL` to the Render backend URL.
5. Deploy; Vercel will host the static build and proxy API calls to Render via the env var.

### Post-Deployment
- Update `VITE_API_URL` in Vercel whenever the backend URL changes.
- Limit CORS in `backend/server.js` to the production frontend origin once both are live.
- Keep `.env` files untracked (see `.gitignore`). Use the provided `.env.example` files to share required keys without secrets.

## Testing
- Manual verification: hit `https://<render-app>/api/health` and run through core flows in the Vercel app.
- Add automated tests as needed (placeholder `npm test` commands exist in each package).