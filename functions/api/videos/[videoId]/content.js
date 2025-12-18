import { methodNotAllowed } from '../../../_shared/http.js';
import { proxyStreamToOpenAi } from '../../../_shared/openai.js';

export async function onRequest(context) {
  const { request, env, params } = context;

  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const videoId = params.videoId;
  const url = new URL(request.url);
  const variant = url.searchParams.get('variant');
  const qs = variant ? `?variant=${encodeURIComponent(variant)}` : '';

  return proxyStreamToOpenAi({
    request,
    env,
    path: `/videos/${encodeURIComponent(videoId)}/content${qs}`,
    method: 'GET',
  });
}
