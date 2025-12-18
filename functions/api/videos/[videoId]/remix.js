import { errorResponse, methodNotAllowed, readJsonSafe } from '../../../_shared/http.js';
import { proxyJsonToOpenAi } from '../../../_shared/openai.js';

export async function onRequest(context) {
  const { request, env, params } = context;

  const videoId = params.videoId;

  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const payload = await readJsonSafe(request);
  const prompt = typeof payload?.prompt === 'string' ? payload.prompt.trim() : '';
  if (!prompt) return errorResponse(400, 'prompt is required');

  return proxyJsonToOpenAi({
    request,
    env,
    path: `/videos/${encodeURIComponent(videoId)}/remix`,
    method: 'POST',
    body: JSON.stringify({ prompt }),
    extraHeaders: {
      'content-type': 'application/json',
    },
  });
}
