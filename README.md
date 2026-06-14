# RemAI ENS Passport

A lightweight Web3 relocation identity app powered by ENS.

RemAI uses a Sepolia ENS name as the public identity layer for a relocation profile. A user enters an ENS name plus simple move details, the backend resolves ENS records on Sepolia, and the app creates a lightweight passport that can help someone introduce themselves when moving to a new city, hacker house, meetup, DAO, or local community.

The backend supports both the stable Sepolia ENS registry and the ENS v2 dev registry used by `app.ens.dev`. That matters because `app.ens.dev` uses a newer Sepolia deployment for ENS v2 dev names.

## Scope

RemAI turns an ENS name into a practical, shareable identity card for relocation and community onboarding.

- **Portable identity:** the ENS name becomes the public handle for the move.
- **Onchain-backed context:** RemAI reads the ENS owner, resolver, address, expiry, and text records from Sepolia.
- **Human-friendly output:** the app converts the ENS lookup plus move details into a simple relocation passport.
- **Useful for Web3 communities:** builders, gamers, remote workers, and hackathon travelers can use it to share who they are, where they are going, and what they care about.

## Why This Qualifies

The app includes ENS-specific code and a functional demo path:

- Backend resolves user-provided ENS names on Sepolia.
- Backend falls back to the `app.ens.dev` ENS v2 dev registry for names registered there.
- Backend reads registry owner, resolver, address, expiry, and text records.
- UI works with any ENS name typed into the form.
- RemAI concept is preserved through a relocation passport generated from ENS identity plus move context.
- Code is open source ready and does not require hard-coded demo values.

## Run Locally

```powershell
cd C:\Users\DELL\Music\Flyta-Hackathon
npm install
npm run start
```

Open:

```text
http://localhost:3007
```

## Configure Sepolia ENS

Create:

```text
C:\Users\DELL\Music\Flyta-Hackathon\.env.local
```

Add your Sepolia RPC URL:

```powershell
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
```

Do not commit `.env.local`.

## Get Sepolia ETH

Use either faucet:

- https://www.alchemy.com/faucets/ethereum-sepolia
- https://faucets.chain.link/sepolia

## Register Or Use A Sepolia ENS Name

Use either Sepolia ENS app:

```text
https://sepolia.app.ens.domains
https://app.ens.dev
```

For the cleanest demo, use a name you control. If you registered on `app.ens.dev`, RemAI should show the source as `app-ens-dev-v2-registry`.

Optional text records make the demo nicer when available:

```text
url=https://your-demo-url.example
remai.route=Washington, DC to New York, NY
remai.policy=Relocation identity only
remai.capabilities=ens_lookup,relocation_passport
```

## API Routes

- `GET /api/state` returns current backend state.
- `GET /api/events` streams live backend events with Server-Sent Events.
- `GET /api/ens/config` checks whether `SEPOLIA_RPC_URL` is configured.
- `POST /api/ens/resolve` resolves an ENS name directly.
- `POST /api/passport` resolves ENS and creates the RemAI relocation passport.
- `POST /api/reset` clears local backend state.

Example:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3007/api/passport -Headers @{ 'Content-Type' = 'application/json' } -Body '{"ensName":"yourname.eth","currentCity":"Washington, DC","destinationCity":"New York, NY","moveDate":"2026-08-20","priority":"commute","notes":"Starting a new job."}'
```

## Smoke Check

```powershell
npm run check
```
