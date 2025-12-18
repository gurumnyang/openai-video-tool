function jsonResponse(data, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has('content-type')) headers.set('content-type', 'application/json; charset=utf-8');
  if (!headers.has('cache-control')) headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data, null, 2), { ...init, headers });
}

function errorResponse(status, message, extra = {}) {
  return jsonResponse(
    {
      error: {
        message,
        ...extra,
      },
    },
    { status },
  );
}

function methodNotAllowed(allowed) {
  return jsonResponse(
    {
      error: {
        message: 'Method Not Allowed',
        allowed,
      },
    },
    { status: 405, headers: { allow: allowed.join(', ') } },
  );
}

function maybeString(value) {
  if (typeof value !== 'string') return '';
  return value;
}

function readJsonSafe(request) {
  return request.json().catch(() => null);
}

function setNoStore(headers) {
  const h = new Headers(headers || {});
  if (!h.has('cache-control')) h.set('cache-control', 'no-store');
  return h;
}

export { jsonResponse, errorResponse, methodNotAllowed, maybeString, readJsonSafe, setNoStore };
