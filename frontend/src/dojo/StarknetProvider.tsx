"use client";
import type { PropsWithChildren } from "react";
import { sepolia } from "@starknet-react/chains";
import {
  StarknetConfig,
  jsonRpcProvider,
  cartridge,
} from "@starknet-react/core";
import { ControllerConnector } from "@cartridge/connector";
import type { AuthOptions } from "@cartridge/controller";
import { constants } from "starknet";
import {
  RPC_URL,
  CASINO_ADDRESS,
  FEE_TOKEN_ADDRESS,
  VRF_PROVIDER_ADDRESS,
  COIN_TOSS_ADDRESS,
} from "./config";

// Session policies — allow the controller to auto-approve these calls
const policies = {
  contracts: {
    [FEE_TOKEN_ADDRESS]: {
      methods: [
        {
          name: "Approve",
          entrypoint: "approve",
          description: "Approve casino to collect your bet",
          spender: CASINO_ADDRESS,
          amount: "0xffffffffffffffffffffffffffffffff",
        },
      ],
    },
    [CASINO_ADDRESS]: {
      methods: [
        { name: "Place Bet", entrypoint: "place_bet", description: "Place a coin toss bet" },
        { name: "Settle", entrypoint: "settle", description: "Settle and collect winnings" },
      ],
    },
    [COIN_TOSS_ADDRESS]: {
      methods: [
        { name: "Flip", entrypoint: "flip", description: "Flip the coin using VRF" },
      ],
    },
    [VRF_PROVIDER_ADDRESS]: {
      methods: [
        { name: "Request Random", entrypoint: "request_random", description: "Request on-chain randomness" },
      ],
    },
  },
};

const signupOptions: AuthOptions = ["google", "discord"];

// Must be created outside React components
const connector = new ControllerConnector({
  policies,
  defaultChainId: constants.StarknetChainId.SN_SEPOLIA,
  signupOptions,
});

const rpcUrl = RPC_URL.includes("/rpc/")
  ? RPC_URL
  : `${RPC_URL.replace(/\/$/, "")}/rpc/v0_9`;

const provider = jsonRpcProvider({
  rpc: () => {
    return { nodeUrl: rpcUrl };
  },
});

export default function StarknetProvider({ children }: PropsWithChildren) {
  return (
    <StarknetConfig
      autoConnect
      defaultChainId={sepolia.id}
      chains={[sepolia]}
      provider={provider}
      connectors={[connector]}
      explorer={cartridge}
    >
      {children}
    </StarknetConfig>
  );
}
