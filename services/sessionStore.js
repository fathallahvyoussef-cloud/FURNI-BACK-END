

const store = new Map();

function getOrCreateSession(sessionId, { cartId, userId } = {}) {
  if (!store.has(sessionId)) {
    store.set(sessionId, {
      cartId: cartId || sessionId,
      userId: userId || null,
      conversation: []
    });
  }
  return store.get(sessionId);
}

function saveConversation(sessionId, conversation) {
  const session = store.get(sessionId);
  if (session) session.conversation = conversation;
}

module.exports = { getOrCreateSession, saveConversation };