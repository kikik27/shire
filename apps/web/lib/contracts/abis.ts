/**
 * Minimal ABIs for the Shire onchain trust layer. Shapes match the contract spec
 * (ShireRegistryUpgradeable, ShireStakeVaultUpgradeable) so frontend calls type-check
 * against the real contracts once deployed. Kept lean to the functions/events the UI uses.
 */

export const shireRegistryAbi = [
  {
    type: "function",
    name: "registerUser",
    stateMutability: "nonpayable",
    inputs: [
      { name: "roleType", type: "uint8" },
      { name: "metadataURI", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "updateMetadata",
    stateMutability: "nonpayable",
    inputs: [{ name: "metadataURI", type: "string" }],
    outputs: [],
  },
  {
    type: "function",
    name: "isRegistered",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "getUser",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "registered", type: "bool" },
          { name: "roleType", type: "uint8" },
          { name: "registeredAt", type: "uint256" },
          { name: "profileVersion", type: "uint256" },
          { name: "metadataURI", type: "string" },
        ],
      },
    ],
  },
  {
    type: "event",
    name: "UserRegistered",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "roleType", type: "uint8", indexed: false },
      { name: "registeredAt", type: "uint256", indexed: false },
      { name: "metadataURI", type: "string", indexed: false },
    ],
  },
] as const;

export const shireStakeVaultAbi = [
  {
    type: "function",
    name: "stakeForJob",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "bytes32" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "stakeId", type: "bytes32" }],
  },
  {
    type: "function",
    name: "stakeForApplication",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "bytes32" },
      { name: "applicationId", type: "bytes32" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "stakeId", type: "bytes32" }],
  },
  {
    type: "function",
    name: "refundStake",
    stateMutability: "nonpayable",
    inputs: [{ name: "stakeId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "slashStake",
    stateMutability: "nonpayable",
    inputs: [
      { name: "stakeId", type: "bytes32" },
      { name: "slashAmount", type: "uint256" },
      { name: "reason", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getStake",
    stateMutability: "view",
    inputs: [{ name: "stakeId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "user", type: "address" },
          { name: "jobId", type: "bytes32" },
          { name: "applicationId", type: "bytes32" },
          { name: "stakeType", type: "uint8" },
          { name: "token", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "lockedAt", type: "uint256" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
  },
  {
    type: "event",
    name: "StakeLocked",
    inputs: [
      { name: "stakeId", type: "bytes32", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "jobId", type: "bytes32", indexed: true },
      { name: "stakeType", type: "uint8", indexed: false },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;
