// LINE Messaging API client using fetch directly

const LINE_API_BASE = 'https://api.line.me/v2/bot';

export async function pushMessage(accessToken, to, messages) {
  const response = await fetch(`${LINE_API_BASE}/message/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ to, messages }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LINE pushMessage failed (${response.status}): ${errorText}`);
  }
}

export async function replyMessage(accessToken, replyToken, messages) {
  const response = await fetch(`${LINE_API_BASE}/message/reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LINE replyMessage failed (${response.status}): ${errorText}`);
  }
}

// Helper to split messages into chunks of max 5 (LINE limit)
export function chunkMessages(messages, maxChunk = 5) {
  const chunks = [];
  for (let i = 0; i < messages.length; i += maxChunk) {
    chunks.push(messages.slice(i, i + maxChunk));
  }
  return chunks;
}
