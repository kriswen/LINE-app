// LINE Messaging API client using fetch directly

const LINE_API_BASE = 'https://api.line.me/v2/bot';

export async function pushMessage(accessToken, to, messages) {
  try {
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
      console.error('LINE pushMessage error:', response.status, errorText);
      return { success: false, error: `${response.status}: ${errorText}` };
    }

    return { success: true };
  } catch (error) {
    console.error('LINE pushMessage exception:', error);
    return { success: false, error: String(error) };
  }
}

export async function replyMessage(accessToken, replyToken, messages) {
  try {
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
      console.error('LINE replyMessage error:', response.status, errorText);
      return { success: false, error: `${response.status}: ${errorText}` };
    }

    return { success: true };
  } catch (error) {
    console.error('LINE replyMessage exception:', error);
    return { success: false, error: String(error) };
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