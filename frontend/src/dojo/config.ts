export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.cartridge.gg/x/starknet/sepolia";
export const TORII_URL = process.env.NEXT_PUBLIC_TORII_URL ?? "http://localhost:8080";

// From manifest_sepolia.json — deployed to Starknet Sepolia
export const COIN_TOSS_ADDRESS =
  process.env.NEXT_PUBLIC_COIN_TOSS_ADDRESS ??
  "0x36ad75d22f2db24c01d1c648d671f9f0547e8a7571315d6811fed9cd97ee8e9";

// Cartridge VRF Provider — same address on mainnet, sepolia, and local Katana (with paymaster=true)
export const VRF_PROVIDER_ADDRESS =
  process.env.NEXT_PUBLIC_VRF_PROVIDER_ADDRESS ??
  "0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f";

// Casino contract — deployed via sozo migrate (dojo contract)
export const CASINO_ADDRESS =
  process.env.NEXT_PUBLIC_CASINO_ADDRESS ?? "0x6689d62de1e6c62b602d79cb17f173752516f1a59f64080c72e1cfb65345c40";

// Fee token (STRK on Sepolia)
export const FEE_TOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_FEE_TOKEN_ADDRESS ??
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

// Legacy burner (kept for reference, not used with Cartridge Controller)
export const BURNER_ADDRESS =
  process.env.NEXT_PUBLIC_BURNER_ADDRESS ?? "0x0";
export const BURNER_PRIVATE_KEY =
  process.env.NEXT_PUBLIC_BURNER_PRIVATE_KEY ?? "0x0";
