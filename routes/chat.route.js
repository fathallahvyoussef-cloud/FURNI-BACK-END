/**
 * routes/chat.route.js
 *
 * POST /api/chat
 * Body: { message: string }
 * Response: text/event-stream — a live sequence of `data: {...}\n\n` frames
 * matching the ChatStreamEvent shape the Angular client expects:
 *   { type: 'text_delta', text }
 *   { type: 'tool_start', tool }
 *   { type: 'tool_result', activity }
 *   { type: 'done' }
 *   { type: 'error', message }
 *
 * Deliberately thin: session handling lives in middleware, the streaming
 * agent loop lives in services/anthropicService, tool execution lives in
 * services/toolHandlers. This route just wires them together and turns
 * each emitted event into an SSE frame.
 */

const express = require("express");
const { resolveSession } = require("../middleware/sessions");
const { getOrCreateSession, saveConversation } = require("../services/sessionStore");
const { runAgentTurnStreaming, createUserTurn } = require("../services/ollamaService");
// To switch providers, change the line above to one of:
// const { runAgentTurnStreaming, createUserTurn } = require("../services/geminiService");
// const { runAgentTurnStreaming } = require("../services/anthropicService"); // also change createUserTurn(message) below to { role: "user", content: message }

const router = express.Router();

router.post("/api/chat", resolveSession, async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "`message` is required" });
  }

  const session = getOrCreateSession(req.sessionId);
  const conversation = [...session.conversation, createUserTurn(message)];
  // req.userId is decoded fresh from THIS request's token every time (see
  // middleware/session.js) — a user could log in partway through a
  // conversation, so we don't rely on whatever was true when the session
  // was first created.
  const toolSession = { cartId: req.userId || req.sessionId, userId: req.userId };

  // --- Open the SSE connection ---
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Prevents reverse proxies like nginx from buffering the whole
    // response before forwarding it, which would defeat streaming entirely.
    "X-Accel-Buffering": "no"
  });
  res.flushHeaders?.();

  let clientDisconnected = false;
  res.on("close", () => {
    // Fires when the connection to the CLIENT actually ends — unlike
    // req.on('close'), which fires as soon as the incoming request body
    // has been fully read (immediately, for a small JSON body), and was
    // wrongly making every emit() below a silent no-op from ~18ms in.
    clientDisconnected = true;
  });

  const emit = (event) => {
    if (clientDisconnected) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    const updatedConversation = await runAgentTurnStreaming(
      conversation,
      toolSession,
      emit
    );

    if (!clientDisconnected) {
      saveConversation(req.sessionId, updatedConversation);
    }
  } catch (err) {
    console.error("Chat agent error:", err);
    emit({ type: "error", message: "The shopping assistant is temporarily unavailable." });
  } finally {
    if (!clientDisconnected) res.end();
  }
});

// Optional: expose history so a refreshed page can restore the chat.
// Unrelated to streaming — this is a plain JSON GET, not SSE.
router.get("/api/chat/history", resolveSession, (req, res) => {
  const session = getOrCreateSession(req.sessionId);
  const displayable = session.conversation.filter(
    (m) => typeof m.content === "string" || Array.isArray(m.content)
  );
  res.json({ conversation: displayable });
});

module.exports = router;