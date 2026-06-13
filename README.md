# Flyta Move Agent

A fresh hackathon-oriented rebuild inspired by Flyta AI, created separately at:

`C:\Users\DELL\Music\Flyta-Hackathon`

The original Flyta AI project is not touched.

## Product

Flyta Move Agent helps a job mover plan a relocation through a named AI agent that can:

- Create an ENS-style public identity for the relocation agent.
- Use a Dynamic-style wallet and user-defined spend cap.
- Pay for useful relocation tools through Arc/Circle-style USDC receipts.
- Stream backend activity to the browser in real time.
- Produce a judge packet showing why the Web3 pieces are necessary.

This is intentionally scoped to 3 prize targets:

1. ENS: Best ENS Integration for AI Agents
2. Dynamic: Best Agentic Build
3. Arc: Best Agentic Economy with Circle Agent Stack

Sui and Hedera are intentionally excluded.

## Run

```powershell
cd C:\Users\DELL\Music\Flyta-Hackathon
npm run start
```

Then open:

`http://localhost:3007`

## Backend Routes

The app now uses the Node backend, not client-only state.

- `GET /api/state` returns the current plan, agent, wallet, receipts, activity, and judge packet.
- `GET /api/events` opens a Server-Sent Events stream for live backend updates.
- `POST /api/plan` creates a relocation plan from the intake form.
- `POST /api/agent` prepares the ENS-style agent profile.
- `POST /api/wallet/authorize` creates the Dynamic-style wallet policy state.
- `POST /api/tasks/run` runs the paid task queue and streams receipt updates.
- `POST /api/reset` clears backend state.

Backend logic lives in:

`src/backend/agent-engine.js`


## Step 1: ENS Sepolia Setup

We are doing ENS as a read-only verification first. That means the backend checks Sepolia for your agent name, resolver, wallet address, and text records. No private key is needed yet.

### What you need

1. A wallet with Sepolia ETH.
2. A Sepolia RPC URL from Alchemy, Infura, QuickNode, or another Ethereum RPC provider.
3. A Sepolia ENS name registered at `https://sepolia.app.ens.domains`.

### Add your RPC URL

Create this file:

`C:\Users\DELL\Music\Flyta-Hackathon\.env.local`

Add:

```powershell
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
ENS_AGENT_BASE_DOMAIN=your-sepolia-name.eth
```

Restart the app after saving `.env.local`:

```powershell
cd C:\Users\DELL\Music\Flyta-Hackathon
npm run start
```

### Register the agent name

1. Open `https://sepolia.app.ens.domains`.
2. Connect the same wallet you want to use for the demo.
3. First register a parent Sepolia ENS name you control, for example `your-sepolia-name.eth`. Put that parent in `ENS_AGENT_BASE_DOMAIN`. Then search for the generated agent subname from the app, for example:

`new-york-ny-move-agent.your-sepolia-name.eth`

4. If it is available, register it on Sepolia.
5. Set its address record to the demo wallet address, or later the Dynamic wallet address.
6. Add these text records:

```text
url=https://flyta.local/agent
flyta.capabilities=neighborhood_rank,pay_quote,storage_hold,item_decision
flyta.route=Washington, DC to New York, NY
flyta.policy=35 USDC user cap
```

### Verify from the backend

After restarting with `SEPOLIA_RPC_URL`, call:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3007/api/ens/resolve -Headers @{ 'Content-Type' = 'application/json' } -Body '{"name":"new-york-ny-move-agent.your-sepolia-name.eth"}'
```

The app's “Create ENS agent profile” button also runs this lookup and updates the live backend stream.

## Current Demo Flow

1. Fill or edit the relocation intake.
2. Create the ENS agent profile.
3. Authorize the Dynamic-style wallet and spending policy.
4. Run paid relocation tasks.
5. Watch the live backend stream update.
6. Review Arc/Dynamic receipts.
7. Copy the judge packet.

## Real Integration Roadmap

### Step 1: ENS

Replace `createEnsRecords()` in `src/backend/agent-engine.js` with real ENS writes or resolver reads.

Suggested records:

- `addr`: agent wallet
- `url`: public agent endpoint
- `flyta.capabilities`: JSON list of supported actions
- `flyta.route`: current move route
- `flyta.policy`: spend cap and permissions

### Step 2: Dynamic

Replace `mockWalletAddress()` and `authorizeWallet()` with Dynamic server wallet creation and policy assignment.

Required demo proof:

- Show wallet address.
- Show user-approved spend cap.
- Sign or submit at least one testnet transaction from the agent wallet.

### Step 3: Arc / Circle Agent Stack

Replace the receipt creation inside `runTasks()` with real USDC testnet payments or x402-style paid tool calls.

Best tasks for the hackathon:

- Buy verified mover quote data.
- Reserve a storage quote window.
- Purchase premium commute data.

Required demo proof:

- Amount in USDC.
- Recipient/tool name.
- Transaction hash or payment receipt.
- Agent decision generated from the paid result.

## Why This Should Score

The Web3 layer is not decorative. Flyta needs identity because movers must trust an agent that contacts vendors. It needs a wallet because the agent has to pay for data, quotes, and holds. It needs receipts because relocation decisions can be expensive and users need auditability.

## Smoke Check

```powershell
npm run check
```


