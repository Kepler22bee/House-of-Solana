// NPC AI Chat System — generates dynamic dialogue via LLM

import { NPC } from "./map";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface NpcChatState {
  history: ChatMessage[];
  bored: boolean;
  exchangeCount: number;
  loading: boolean;
  pendingLine: string | null;
}

// Per-NPC conversation state (persists within session)
const npcChats: Record<string, NpcChatState> = {};

// Max exchanges before NPC gets bored (randomized per NPC)
function getMaxExchanges(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return 5 + (h % 5); // 5-9 exchanges
}

// NPC personality system prompts
const NPC_PERSONALITIES: Record<string, string> = {
  "Elder Sage": `You are Elder Sage, a wise old villager in a fantasy pixel world called Fortune Falls. You speak with wisdom about the village history, give cryptic advice, and occasionally reference ancient legends. You're warm but mysterious.`,

  "Merchant Kai": `You are Merchant Kai, a shrewd but friendly merchant in Fortune Falls. You love talking about the casino, giving gambling tips (not always good ones), bragging about deals, and gossiping about other villagers. You're enthusiastic about money.`,

  "Healer Mira": `You are Healer Mira, a kind healer in Fortune Falls. You care about the adventurer's wellbeing, talk about herbs and remedies, warn about dangers in the tall grass, and sometimes share village gossip. You're nurturing and gentle.`,

  "Clanker Workshop": `You are the Clanker Workshop attendant, a quirky mechanic who builds AI companions. You speak with occasional robot sounds (*bzzt*, *whirr*), talk about upgrades and technology, and get excited about new inventions. You're eccentric and enthusiastic.`,

  "Guard Rex": `You are Guard Rex, a vigilant guard in Fortune Falls. You're stern but caring, always warning about threats, sharing patrol stories, and occasionally complaining about boring night shifts. You take your duty seriously.`,

  "Little Pip": `You are Little Pip, an excited young kid in Fortune Falls. You speak with childlike wonder, ask lots of questions, share wild rumors about hidden treasures, and dream of being an adventurer. You're energetic and adorable. Use short sentences.`,

  "Dealer Yuki": `You are Dealer Yuki, a stylish casino dealer at the Golden Dragon Casino in Fortune Falls. You mix Japanese phrases occasionally, talk about gambling strategies, share stories about big winners and losers, and have a mysterious air. You're charming and witty.`,

  "Hermit Oden": `You are Hermit Oden, a reclusive hermit living in the eastern woods of Fortune Falls. You speak cryptically about nature, hidden paths, and secret treasures. You're grumpy about visitors but secretly enjoy company.`,

  "Wanderer Sol": `You are Wanderer Sol, a traveling adventurer passing through Fortune Falls. You share tales from distant lands, talk about monsters you've fought, and give tips about exploration. You're charismatic and a bit of a showoff.`,

  "Bouncer Kaz": `You are Bouncer Kaz, a tough bouncer guarding the VIP area of the casino. You're intimidating but fair, occasionally share gossip about VIP guests, and take your job very seriously. You speak in short, direct sentences.`,

  "Coin Toss Dealer": `You are the Coin Toss Dealer at the Golden Dragon Casino. You're enthusiastic about the coin toss game, share fun facts about probability, encourage players, and celebrate wins. You're upbeat and energetic.`,

  "Blackjack Dealer": `You are the Blackjack Dealer at the Golden Dragon Casino. You love cards, share blackjack strategy tips, and have a smooth personality. You're confident and always keep things classy.`,

  "Bartender Jin": `You are Bartender Jin, the bartender at the Golden Dragon Casino. You serve drinks, share casino gossip, give tips about the games, and tell stories about memorable nights at the casino. You're friendly and chatty.`,

  "Agent Forge": `You are Agent Forge, the host of the Game Factory at the Golden Dragon Casino. You're passionate about custom games, love explaining how game templates work, and encourage players to create their own games on-chain. You're innovative and enthusiastic.`,

  "Table Master": `You are Table Master, the host of the multiplayer tables at the Golden Dragon Casino. You manage PvP games, explain how multiplayer works, and love competitive gaming. You're fair and authoritative.`,
};

function getSystemPrompt(npc: NPC): string {
  const base = NPC_PERSONALITIES[npc.name] ||
    `You are ${npc.name}, a character in a fantasy pixel world called Fortune Falls. Stay in character and be interesting.`;

  return `${base}

RULES:
- Keep responses to 1-3 short sentences max.
- Stay in character at all times.
- Be conversational — react to what the player said.
- Never break the fourth wall or mention being an AI.
- Occasionally reference the casino, village, or other characters.
- If you're getting bored of the conversation, end with something like "*yawns*" or "Well, I should get back to..." to signal you want to stop talking.`;
}

function getChatState(npcName: string): NpcChatState {
  if (!npcChats[npcName]) {
    npcChats[npcName] = {
      history: [],
      bored: false,
      exchangeCount: 0,
      loading: false,
      pendingLine: null,
    };
  }
  return npcChats[npcName];
}

export function isNpcBored(npcName: string): boolean {
  return getChatState(npcName).bored;
}

export function isNpcLoading(npcName: string): boolean {
  return getChatState(npcName).loading;
}

// Start a conversation or continue one
export async function chatWithNpc(npc: NPC): Promise<string> {
  const state = getChatState(npc.name);

  if (state.bored) {
    return "*looks away* I've got things to do...";
  }

  if (state.loading) {
    return "...";
  }

  state.loading = true;

  // Build messages
  if (state.history.length === 0) {
    state.history.push({ role: "system", content: getSystemPrompt(npc) });
    state.history.push({ role: "user", content: "Hey there!" });
  } else {
    const maxExchanges = getMaxExchanges(npc.name);
    const isLastExchange = state.exchangeCount >= maxExchanges - 1;
    if (isLastExchange) {
      state.history.push({ role: "user", content: "Tell me more." });
      state.history.push({ role: "system", content: "This is your LAST reply. You are getting bored/busy. End the conversation with a natural dismissal — e.g. 'Alright, I should get back to work...', 'Well, off you go now!', 'I've got things to attend to, take care!'. Stay in character." });
    } else {
      state.history.push({ role: "user", content: "Tell me more." });
    }
  }

  try {
    const res = await fetch("/api/ai-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent: "player",
        messages: state.history.slice(-10),
        max_tokens: 80,
        temperature: 0.9,
      }),
    });

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content ?? "...";

    state.history.push({ role: "assistant", content: reply });
    state.exchangeCount++;

    const maxExchanges = getMaxExchanges(npc.name);
    if (state.exchangeCount >= maxExchanges) {
      state.bored = true;
    }

    state.loading = false;
    return reply;
  } catch {
    state.loading = false;
    return "*mumbles something inaudible*";
  }
}

// Get the greeting line (first hardcoded dialogue) for immediate display
export function getGreeting(npc: NPC): string {
  return npc.dialogue[0] ?? "...";
}
