import { errorResponse, setNoStore } from './http.js';

const OPENAI_BASE_URL = 'https://api.openai.com/v1';

function parseBearerToken(value) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return '';
  const prefix = 'bearer ';
  if (s.toLowerCase().startsWith(prefix)) return s.slice(prefix.length).trim();
  return '';
}

function getApiKeyFromRequest(request) {
  const fromHeader = request.headers.get('X-OpenAI-Api-Key')?.trim() || '';
  if (fromHeader) return fromHeader;

  const bearer = parseBearerToken(request.headers.get('authorization'));
  if (bearer) return bearer;
  return '';
}

function missingKeyResponse() {
  return errorResponse(
    400,
    'Missing OpenAI API key. Provide X-OpenAI-Api-Key (recommended) or Authorization: Bearer <key>.',
  );
}

async function proxyJsonToOpenAi({ request, env, path, method, body, extraHeaders = {} }) {
  const apiKey = getApiKeyFromRequest(request);
  if (!apiKey) return missingKeyResponse();

  const headers = new Headers(extraHeaders);
  headers.set('authorization', `Bearer ${apiKey}`);

  const openaiResponse = await fetch(`${OPENAI_BASE_URL}${path}`, {
    method,
    headers,
    body,
  });

  const responseHeaders = setNoStore({
    'content-type': openaiResponse.headers.get('content-type') || 'application/json; charset=utf-8',
  });

  const text = await openaiResponse.text();
  return new Response(text, { status: openaiResponse.status, headers: responseHeaders });
}

async function proxyStreamToOpenAi({ request, env, path, method = 'GET', extraHeaders = {} }) {
  const apiKey = getApiKeyFromRequest(request);
  if (!apiKey) return missingKeyResponse();

  const headers = new Headers(extraHeaders);
  headers.set('authorization', `Bearer ${apiKey}`);

  const openaiResponse = await fetch(`${OPENAI_BASE_URL}${path}`, {
    method,
    headers,
  });

  const passthroughHeaders = new Headers();
  const contentType = openaiResponse.headers.get('content-type');
  if (contentType) passthroughHeaders.set('content-type', contentType);

  const contentDisposition = openaiResponse.headers.get('content-disposition');
  if (contentDisposition) passthroughHeaders.set('content-disposition', contentDisposition);

  const contentLength = openaiResponse.headers.get('content-length');
  if (contentLength) passthroughHeaders.set('content-length', contentLength);

  passthroughHeaders.set('cache-control', 'no-store');
  return new Response(openaiResponse.body, { status: openaiResponse.status, headers: passthroughHeaders });
}

export { proxyJsonToOpenAi, proxyStreamToOpenAi };
