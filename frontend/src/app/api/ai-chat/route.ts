import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: body.model ?? "gpt-4o-mini",
        messages: body.messages,
        max_tokens: body.max_tokens ?? 100,
        temperature: body.temperature ?? 0.9,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      const errMsg = data.error?.message ?? `OpenAI error (${res.status})`;
      return NextResponse.json(
        { choices: [{ message: { content: `*beep boop* Oracle error: ${errMsg}` } }] },
        { status: 200 }
      );
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { choices: [{ message: { content: "*beep boop* Connection error... my antenna must be rusty!" } }] },
      { status: 502 }
    );
  }
}
