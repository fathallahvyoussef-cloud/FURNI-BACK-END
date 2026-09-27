

const ollamaTools = require("../config/ollamaTools");
const { executeTool } = require("./tooHandllers");

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.USE_HF === "true"
  ? "Qwen/Qwen2.5-7B-Instruct"
  : (process.env.OLLAMA_MODEL || "qwen2.5:7b");
  const HF_BASE_URL = "https://router.huggingface.co/v1";



const SYSTEM_PROMPT = `You are a shopping assistant for a furniture store (chairs, sofas, tables, and similar home furniture).

Help customers find pieces that fit their space and style, compare trade-offs
honestly, and build their cart. The product catalog has no structured fields
for material, dimensions, or style — that information only exists as free
text inside each product's description, so read descriptions carefully when
comparing options (e.g. "solid teak wood", "velvet upholstery", "seats up to
six people").

Ground every claim in actual tool results — never invent products, prices,
stock status, or details not present in the description. If a search returns
nothing suitable, say so and offer to broaden the search rather than making
something up.

When relevant, ask about room size, existing decor style, or how many people
a piece needs to seat — but ask at most one clarifying question, and only
when genuinely needed. Otherwise make a reasonable assumption, state it
briefly, and proceed.

Keep replies concise and concrete — lead with a recommendation, then the
trade-off, not a wall of caveats. Only call add_to_cart after the customer
has confirmed they want a specific item.`;

const MAX_TOOL_ROUNDS = 5;

/**
 * Builds the first turn of an Ollama conversation from the raw user text.
 *
 * Appends Qwen3's "/no_think" soft switch to the actual message sent to
 * the model. The API-level `think: false` option (still set below) is
 * unreliable across Qwen3 versions when combined with streaming + tool
 * calling — multiple real-world reports confirm it's often silently
 * ignored — while the in-prompt /no_think directive is documented as the
 * more consistently honored mechanism.
 */
function createUserTurn(text) {
  return { role: "user", content: `${text}\n/no_think` };
}

/**
 * Strips a <think>...</think> block from a complete response string, as a
 * safety net in case reasoning still leaks into `content` for some
 * model/version despite think:false and the /no_think prompt directive.
 * Simple one-shot regex is sufficient now that we call Ollama
 * non-streaming — we have the whole string at once, no chunk-boundary
 * concerns like we'd have with a live token stream.
 */
function stripThinkBlock(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

/**
 * @param {Array} conversation - Ollama-shaped history, including the new user turn
 * @param {{ cartId: string, userId?: string }} session
 * @param {(event: object) => void} emit
 * @returns {Promise<Array>} updated conversation, for persisting to the session store
 */
async function runAgentTurnStreaming(conversation, session, emit) {
  let messages = [{ role: "system", content: SYSTEM_PROMPT }, ...conversation];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    console.log(`[ollama] round ${round + 1} starting — sending ${messages.length} messages to ${MODEL}`);
    const roundStartedAt = Date.now();

    let response;
    try {
      if (process.env.USE_HF == "true") {
        console.log(`[ollama] using HF router for Ollama model ${MODEL}`);
        response = await fetch(`${HF_BASE_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OLLAMA_API_KEY}` },
          body: JSON.stringify({
            model: MODEL,
            messages,
            tools: ollamaTools,
            // NON-streaming from Ollama, by design. There's a documented Ollama
            // bug where streaming + tool-calling together breaks the
            // separation between the model's reasoning ("thinking") and its
            // real answer — reasoning leaks straight into `message.content`
            // as plain text. The exact same model, called WITHOUT streaming,
            // correctly separates `message.thinking` from `message.content`
            // and `message.tool_calls`. Local Ollama generation is already
            // slow enough that losing live token-by-token display costs us
            // little, and it buys real correctness. We still stream the
            // *result* on to the browser (see below) — just not token-by-token
            // from Ollama's side.
            stream: false,
            think: false,
            keep_alive: "30m",
            options: {
              num_predict: 400
            }
          })
        });
      }
      else {
        console.log(`[ollama] using local Ollama server for model ${MODEL}`);
         response = await fetch(`${OLLAMA_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: MODEL,
            messages,
            tools: ollamaTools,
            stream: false,
            think: false,
            keep_alive: "30m",
            options: { num_predict: 400 }
          })
        });
        if (!response.ok) throw new Error(`Ollama error ${response.status}: ${await response.text()}`);
        const data = await res.json();
        return { content: data.message.content, tool_calls: data.message.tool_calls };
      }
    }
    catch (err) {
      console.error("[ollama] fetch failed — is `ollama serve` running?", err.message);
      emit({
        type: "error",
        message: "Couldn't reach the local AI server. Is Ollama running? Try `ollama serve`."
      });
      return conversation;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(`[ollama] HTTP ${response.status}:`, text);
      emit({ type: "error", message: `Ollama returned an error (${response.status}): ${text}` });
      return conversation;
    }

    const data = await response.json();
    console.log(`[ollama] round ${round + 1} response data :`, data);
    const content = stripThinkBlock(data.message?.content || "");
    const toolCalls = data.message?.tool_calls || [];

    const elapsedSeconds = ((Date.now() - roundStartedAt) / 1000).toFixed(1);
    console.log(`[ollama] round ${round + 1} finished in ${elapsedSeconds}s — ${toolCalls.length} tool call(s), ${content.length} chars of text`);

    // We didn't stream token-by-token from Ollama, but the browser's
    // consumeStream/handleEvent code just treats every text_delta as
    // "append this to the bubble" — sending the whole clean answer as one
    // delta still renders correctly, just appears all at once rather than
    // typed out live.
    if (content) {
      emit({ type: "text_delta", text: content });
    }

    messages.push({
      role: "assistant",
      content,
      ...(toolCalls.length ? { tool_calls: toolCalls } : {})
    });

    if (toolCalls.length === 0) {
      emit({ type: "done" });
      return messages.filter((m) => m.role !== "system"); // don't persist the system prompt back into session history
    }

    for (const call of toolCalls) {
      const name = call.function?.name;
      // Ollama may give `arguments` as an object already, or as a JSON string
      // depending on model/version — handle both.
      const rawArgs = call.function?.arguments;
      const args = typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs || {};

      emit({ type: "tool_start", tool: name });

      const result = await executeTool(name, args, session);

      emit({ type: "tool_result", activity: { tool: name, input: args, result } });

      messages.push({ role: "tool", content: JSON.stringify(result) });
    }
    // loop continues: next round lets the model respond to the tool results
  }

  emit({
    type: "error",
    message: "That took longer than expected — could you rephrase or narrow your request?"
  });
  return messages.filter((m) => m.role !== "system");
}

module.exports = { runAgentTurnStreaming, createUserTurn };