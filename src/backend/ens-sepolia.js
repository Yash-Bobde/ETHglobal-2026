const ENS_SEPOLIA = {
  chainId: 11155111,
  registryAddress: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
  publicResolverAddress: "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5",
  universalResolverAddress: "0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe",
  v2DevRegistryAddress: "0xdedb92913a25abe1f7bcdd85d8a344a43b398b67",
};

const registryAbi = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "resolver",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
];

const v2RegistryAbi = [
  {
    type: "function",
    name: "getState",
    stateMutability: "view",
    inputs: [{ name: "anyId", type: "uint256" }],
    outputs: [
      {
        name: "state",
        type: "tuple",
        components: [
          { name: "status", type: "uint8" },
          { name: "expiry", type: "uint64" },
          { name: "latestOwner", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "resource", type: "uint256" },
        ],
      },
    ],
  },
];

const agentTextKeys = ["url", "flyta.capabilities", "flyta.route", "flyta.policy"];
let cachedClient;

async function getClient() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  if (!rpcUrl) return null;
  if (cachedClient) return cachedClient;

  const [{ createPublicClient, http }, { sepolia }] = await Promise.all([
    import("viem"),
    import("viem/chains"),
  ]);

  cachedClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });
  return cachedClient;
}

async function resolveEnsAgent(name) {
  const client = await getClient();
  if (!client) {
    return {
      configured: false,
      network: "sepolia",
      name,
      message: "Set SEPOLIA_RPC_URL in .env.local to enable real Sepolia ENS verification.",
    };
  }

  const { labelhash, namehash, normalize } = await import("viem/ens");
  let normalized;
  let node;
  let labelId;

  try {
    normalized = normalize(name);
    node = namehash(normalized);
    const label = normalized.split(".")[0];
    labelId = label ? BigInt(labelhash(label)) : null;
  } catch (error) {
    return {
      configured: true,
      network: "sepolia",
      chainId: ENS_SEPOLIA.chainId,
      name,
      exists: false,
      error: error.shortMessage || error.message || "Invalid ENS name.",
      contracts: ENS_SEPOLIA,
      message: "Invalid ENS name. Use a valid name like yourname.eth.",
    };
  }

  try {
    const [owner, resolver, address, textRecords] = await Promise.all([
      client.readContract({
        address: ENS_SEPOLIA.registryAddress,
        abi: registryAbi,
        functionName: "owner",
        args: [node],
      }),
      client.readContract({
        address: ENS_SEPOLIA.registryAddress,
        abi: registryAbi,
        functionName: "resolver",
        args: [node],
      }),
      client.getEnsAddress({
        name: normalized,
        universalResolverAddress: ENS_SEPOLIA.universalResolverAddress,
      }).catch(() => null),
      Promise.all(
        agentTextKeys.map(async (key) => {
          const value = await client.getEnsText({
            name: normalized,
            key,
            universalResolverAddress: ENS_SEPOLIA.universalResolverAddress,
          }).catch(() => null);
          return { key, value };
        }),
      ),
    ]);

    const zeroAddress = "0x0000000000000000000000000000000000000000";
    const exists = owner && owner.toLowerCase() !== zeroAddress;

    if (!exists) {
      const v2Result = await resolveEnsV2DevName(client, {
        labelId,
        node,
        normalized,
        textRecords,
      });
      if (v2Result.exists) return v2Result;
    }

    return {
      configured: true,
      network: "sepolia",
      chainId: ENS_SEPOLIA.chainId,
      name: normalized,
      node,
      exists,
      source: "stable-sepolia-registry",
      owner,
      resolver,
      address,
      textRecords,
      contracts: ENS_SEPOLIA,
      message: exists
        ? "Sepolia ENS name resolved from chain."
        : "Name not found on Sepolia yet. Register it at https://sepolia.app.ens.domains or app.ens.dev.",
    };
  } catch (error) {
    return {
      configured: true,
      network: "sepolia",
      chainId: ENS_SEPOLIA.chainId,
      name: normalized,
      node,
      exists: false,
      error: error.shortMessage || error.message || "ENS lookup failed.",
      contracts: ENS_SEPOLIA,
      message: "Sepolia ENS lookup failed. Check your RPC URL and the name.",
    };
  }
}

async function resolveEnsV2DevName(client, { labelId, node, normalized, textRecords }) {
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  const labels = normalized.split(".");
  const isEth2ld = labels.length === 2 && labels[1] === "eth";

  if (!labelId || !isEth2ld) return { exists: false };

  try {
    const state = await client.readContract({
      address: ENS_SEPOLIA.v2DevRegistryAddress,
      abi: v2RegistryAbi,
      functionName: "getState",
      args: [labelId],
    });

    const owner = state.latestOwner;
    const expiry = Number(state.expiry);
    const exists = owner && owner.toLowerCase() !== zeroAddress && expiry > nowInSeconds();

    if (!exists) return { exists: false };

    return {
      configured: true,
      network: "sepolia",
      chainId: ENS_SEPOLIA.chainId,
      name: normalized,
      node,
      exists: true,
      source: "app-ens-dev-v2-registry",
      owner,
      resolver: null,
      address: owner,
      textRecords,
      expiry,
      expiryDate: new Date(expiry * 1000).toISOString(),
      v2State: {
        status: Number(state.status),
        tokenId: state.tokenId.toString(),
        resource: state.resource.toString(),
      },
      contracts: ENS_SEPOLIA,
      message: "ENS v2 dev name resolved from app.ens.dev Sepolia registry.",
    };
  } catch {
    return { exists: false };
  }
}

function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}

module.exports = { ENS_SEPOLIA, agentTextKeys, resolveEnsAgent };
