import { methodNotAllowed } from '../../_shared/http.js';
import { proxyJsonToOpenAi } from '../../_shared/openai.js';

export async function onRequest(context) {
  const { request, env, params } = context;

  const videoId = params.videoId;

  if (request.method === 'GET') {
    return proxyJsonToOpenAi({
      request,
      env,
      path: `/videos/${encodeURIComponent(videoId)}`,
      method: 'GET',
    });
  }

  if (request.method === 'DELETE') {
    return proxyJsonToOpenAi({
      request,
      env,
      path: `/videos/${encodeURIComponent(videoId)}`,
      method: 'DELETE',
    });
  }

  return methodNotAllowed(['GET', 'DELETE']);
}
