import { NextRequest, NextResponse } from "next/server";

const AI_URL = process.env.AI_CHAT_URL ?? "https://jabbingly-nondeclarative-graig.ngrok-free.dev/v1/chat/completions";
const AI_KEY = process.env.AI_CHAT_KEY ?? "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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
      { status: 502 }
    );
  }
}
