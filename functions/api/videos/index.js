import { errorResponse, jsonResponse, methodNotAllowed, maybeString } from '../../_shared/http.js';
import { proxyJsonToOpenAi } from '../../_shared/openai.js';

const ALLOWED_MODELS = new Set(['sora-2', 'sora-2-pro']);
const ALLOWED_SECONDS = new Set(['4', '8', '12']);
const ALLOWED_SIZES = new Set(['720x1280', '1280x720', '1024x1792', '1792x1024']);

function validateCreateForm(formData) {
  const prompt = maybeString(formData.get('prompt')).trim();
  const model = maybeString(formData.get('model')).trim() || 'sora-2';
  const seconds = maybeString(formData.get('seconds')).trim() || '4';
  const size = maybeString(formData.get('size')).trim() || '720x1280';
  const inputReference = formData.get('input_reference');

  if (!prompt) return { ok: false, error: 'prompt is required' };
  if (!ALLOWED_MODELS.has(model)) return { ok: false, error: `invalid model: ${model}` };
  if (!ALLOWED_SECONDS.has(seconds)) return { ok: false, error: `invalid seconds: ${seconds}` };
  if (!ALLOWED_SIZES.has(size)) return { ok: false, error: `invalid size: ${size}` };

  return { ok: true, prompt, model, seconds, size, inputReference };
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'POST') {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return errorResponse(400, 'Expected multipart/form-data');
    }

    const incoming = await request.formData();
    const validated = validateCreateForm(incoming);
    if (!validated.ok) return errorResponse(400, validated.error);

    const fd = new FormData();
    fd.set('prompt', validated.prompt);
    fd.set('model', validated.model);
    fd.set('seconds', validated.seconds);
    fd.set('size', validated.size);

    if (validated.inputReference instanceof File) {
      fd.set('input_reference', validated.inputReference, validated.inputReference.name || 'reference');
    }

    return proxyJsonToOpenAi({
      request,
      env,
      path: '/videos',
      method: 'POST',
      body: fd,
    });
  }

  if (request.method === 'GET') {
    const url = new URL(request.url);
    const after = url.searchParams.get('after');
    const limit = url.searchParams.get('limit');
    const order = url.searchParams.get('order');

    const params = new URLSearchParams();
    if (after) params.set('after', after);
    if (limit) params.set('limit', limit);
    if (order) params.set('order', order);

    const qs = params.toString();
    const path = qs ? `/videos?${qs}` : '/videos';

    return proxyJsonToOpenAi({
      request,
      env,
      path,
      method: 'GET',
    });
  }

  if (request.method === 'OPTIONS') {
    return jsonResponse({ ok: true });
  }

  return methodNotAllowed(['GET', 'POST']);
}
