import { NextRequest, NextResponse } from "next/server";

const AI_URL = process.env.AI_CHAT_URL ?? "https://api.cerebras.ai/v1/chat/completions";
const AI_KEY = process.env.AI_CHAT_KEY ?? "";

// Clanker (house AI) uses the big model, player's AI uses the smaller one
const CLANKER_MODEL = "qwen-3-235b-a22b-instruct-2507";
const PLAYER_MODEL = "llama3.1-8b";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Determine which model to use based on the "agent" field
    // Frontend sends agent: "clanker" or agent: "player"
    const agent = body.agent ?? "clanker";
    delete body.agent;
    body.model = agent === "player" ? PLAYER_MODEL : CLANKER_MODEL;

    // Cerebras uses max_completion_tokens instead of max_tokens
    if (body.max_tokens && !body.max_completion_tokens) {
      body.max_completion_tokens = body.max_tokens;
      delete body.max_tokens;
    }

    const res = await fetch(AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${AI_KEY}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { choices: [{ message: { content: "*beep boop* Connection error... my antenna must be rusty!" } }] },
      { status: 502 },
    );
  }
}
