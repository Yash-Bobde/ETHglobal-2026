const ENS_SEPOLIA = {
  chainId: 11155111,
  registryAddress: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
  publicResolverAddress: "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5",
  universalResolverAddress: "0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe",
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

  const { namehash, normalize } = await import("viem/ens");
  const normalized = normalize(name);
  const node = namehash(normalized);

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
      Promise.all(agentTextKeys.map(async (key) => {
        const value = await client.getEnsText({
          name: normalized,
          key,
          universalResolverAddress: ENS_SEPOLIA.universalResolverAddress,
        }).catch(() => null);
        return { key, value };
      })),
    ]);

    const zeroAddress = "0x0000000000000000000000000000000000000000";
    const exists = owner && owner.toLowerCase() !== zeroAddress;
    return {
      configured: true,
      network: "sepolia",
      chainId: ENS_SEPOLIA.chainId,
      name: normalized,
      node,
      exists,
      owner,
      resolver,
      address,
      textRecords,
      contracts: ENS_SEPOLIA,
      message: exists
        ? "Sepolia ENS name resolved from chain."
        : "Name not found on Sepolia yet. Register it at https://sepolia.app.ens.domains.",
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

module.exports = { ENS_SEPOLIA, agentTextKeys, resolveEnsAgent };
