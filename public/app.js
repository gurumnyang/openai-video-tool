const STORAGE_KEY = 'openai-video-tool:jobs:v1';
const STORAGE_API_KEY_KEY = 'openai-video-tool:api-key';

function $(selector) {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el;
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function formatDateTime(valueSeconds) {
  if (!valueSeconds) return '-';
  const date = new Date(valueSeconds * 1000);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'medium' }).format(date);
}

function statusClass(status) {
  if (!status) return 'status';
  return `status status--${statusKey(status)}`;
}

function statusLabel(status) {
  if (!status) return 'unknown';
  return status;
}

function statusKey(status) {
  return String(status)
    .toLowerCase()
    .replaceAll(' ', '_')
    .replace(/[^a-z0-9_]+/g, '-');
}

function safeText(value) {
  return value == null ? '' : String(value);
}

function readJobs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function writeJobs(jobs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

function upsertJob(partial) {
  const jobs = readJobs();
  const idx = jobs.findIndex((j) => j.id === partial.id);
  if (idx >= 0) {
    jobs[idx] = { ...jobs[idx], ...partial, updatedAt: Date.now() };
  } else {
    jobs.unshift({ ...partial, createdAtLocal: Date.now(), updatedAt: Date.now() });
  }
  writeJobs(jobs);
  return jobs;
}

function removeAllJobs() {
  writeJobs([]);
}

function getApiKey() {
  return localStorage.getItem(STORAGE_API_KEY_KEY) || '';
}

function setApiKey(key) {
  if (!key) localStorage.removeItem(STORAGE_API_KEY_KEY);
  else localStorage.setItem(STORAGE_API_KEY_KEY, key);
}

function apiHeaders() {
  const headers = {};
  const apiKey = getApiKey().trim();
  if (apiKey) headers['X-OpenAI-Api-Key'] = apiKey;
  return headers;
}

async function apiFetchJson(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...apiHeaders(),
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : await response.text().catch(() => '');

  if (!response.ok) {
    const errorMessage =
      (payload && payload.error && payload.error.message) ||
      (typeof payload === 'string' && payload) ||
      `HTTP ${response.status}`;
    const error = new Error(errorMessage);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function createVideoJob(formData) {
  return apiFetchJson('/api/videos', { method: 'POST', body: formData });
}

async function retrieveVideoJob(videoId) {
  return apiFetchJson(`/api/videos/${encodeURIComponent(videoId)}`, { method: 'GET' });
}

async function remixVideoJob(videoId, prompt) {
  return apiFetchJson(`/api/videos/${encodeURIComponent(videoId)}/remix`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
}

async function downloadVideoBlob(videoId) {
  const response = await fetch(`/api/videos/${encodeURIComponent(videoId)}/content`, {
    method: 'GET',
    headers: apiHeaders(),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `다운로드 실패 (HTTP ${response.status})`);
  }
  return response.blob();
}

function createJobElement(job) {
  const wrapper = document.createElement('article');
  wrapper.className = 'job';
  wrapper.dataset.jobId = job.id;

  const status = safeText(job.status || job.statusLocal);
  const progress = Number.isFinite(job.progress) ? job.progress : job.progressLocal;

  const prompt = safeText(job.prompt || job.promptLocal);
  const model = safeText(job.model || job.modelLocal);
  const seconds = safeText(job.seconds || job.secondsLocal);
  const size = safeText(job.size || job.sizeLocal);
  const createdAt = job.created_at ? formatDateTime(job.created_at) : '-';
  const completedAt = job.completed_at ? formatDateTime(job.completed_at) : '-';

  const errorJson = job.error ? JSON.stringify(job.error, null, 2) : '';
  const errorMessage = safeText(job.error?.message || job.errorLocal || errorJson);

  wrapper.innerHTML = `
    <div class="job__top">
      <div class="job__id">
        <span class="pill">${escapeHtml(safeText(job.id))}</span>
        <span class="${statusClass(status)}"><span class="status__dot"></span>${escapeHtml(statusLabel(status))}</span>
        <span class="pill">${progress != null ? `${progress}%` : '-'}</span>
        <button class="button button--ghost" data-action="copy-id" type="button">ID 복사</button>
        <button class="button button--ghost" data-action="refresh" type="button">새로고침</button>
      </div>
      <div class="kv">
        <div class="kv__k">model</div>
        <div class="kv__v">${escapeHtml(model || '-')}</div>
        <div class="kv__k">seconds</div>
        <div class="kv__v">${escapeHtml(seconds || '-')}</div>
        <div class="kv__k">size</div>
        <div class="kv__v">${escapeHtml(size || '-')}</div>
        <div class="kv__k">created_at</div>
        <div class="kv__v">${escapeHtml(createdAt)}</div>
        <div class="kv__k">completed_at</div>
        <div class="kv__v">${escapeHtml(completedAt)}</div>
        <div class="kv__k">prompt</div>
        <div class="kv__v">${escapeHtml(prompt || '-')}</div>
      </div>
    </div>

    <div class="job__video" hidden></div>
    <div class="job__error" hidden></div>

    <div class="job__actions">
      <button class="button" data-action="download" type="button" ${status === 'completed' ? '' : 'disabled'}>
        MP4 다운로드
      </button>
      <button class="button" data-action="preview" type="button" ${status === 'completed' ? '' : 'disabled'}>
        미리보기 로드
      </button>
      <button class="button" data-action="remove" type="button">목록에서 제거</button>
    </div>

    <div class="form__row">
      <label class="label">리믹스 프롬프트</label>
      <textarea class="textarea" rows="3" data-role="remix-prompt" placeholder="예: Extend the scene ..."></textarea>
      <div class="job__actions">
        <button class="button button--primary" data-action="remix" type="button" ${
          status === 'completed' ? '' : 'disabled'
        }>
          이 비디오로 리믹스 생성
        </button>
      </div>
      <div class="help">리믹스는 완료된 비디오에서만 가능합니다.</div>
    </div>
  `;

  if (errorMessage) {
    const errorEl = wrapper.querySelector('.job__error');
    errorEl.hidden = false;
    errorEl.textContent = errorMessage;
  }

  return wrapper;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderJobs() {
  const jobsEl = $('#jobs');
  const emptyEl = $('#empty');
  const jobs = readJobs();

  jobsEl.innerHTML = '';
  for (const job of jobs) {
    jobsEl.appendChild(createJobElement(job));
  }

  emptyEl.hidden = jobs.length > 0;
}

function removeJobFromList(jobId) {
  const jobs = readJobs().filter((j) => j.id !== jobId);
  writeJobs(jobs);
  renderJobs();
}

async function refreshJob(jobId) {
  const latest = await retrieveVideoJob(jobId);
  upsertJob({
    id: latest.id,
    ...latest,
  });
  renderJobs();
  return latest;
}

async function ensurePreviewLoaded(jobId) {
  const card = document.querySelector(`.job[data-job-id="${CSS.escape(jobId)}"]`);
  if (!card) return;

  const videoHost = card.querySelector('.job__video');
  if (!videoHost) return;

  if (!videoHost.hidden && videoHost.querySelector('video')) return;

  videoHost.hidden = false;
  videoHost.innerHTML = `<div class="help">MP4를 다운로드하는 중...</div>`;

  const blob = await downloadVideoBlob(jobId);
  const url = URL.createObjectURL(blob);

  videoHost.innerHTML = '';
  const video = document.createElement('video');
  video.controls = true;
  video.playsInline = true;
  video.src = url;
  videoHost.appendChild(video);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function pollShouldContinue(job) {
  const status = job.status || job.statusLocal;
  if (!status) return true;
  return status !== 'completed' && status !== 'failed' && status !== 'canceled';
}

let pollTimer = null;
function startPolling() {
  stopPolling();

  const pollSeconds = clampNumber($('#poll_interval').value, 1, 30, 3);
  pollTimer = window.setInterval(async () => {
    const jobs = readJobs();
    const pending = jobs.filter(pollShouldContinue).slice(0, 6);
    if (pending.length === 0) return;
    for (const job of pending) {
      try {
        await refreshJob(job.id);
      } catch (err) {
        upsertJob({ id: job.id, errorLocal: safeText(err?.message || err) });
        renderJobs();
      }
    }
  }, pollSeconds * 1000);
}

function stopPolling() {
  if (pollTimer != null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

function showCreateError(message) {
  const el = $('#create-error');
  if (!message) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.hidden = false;
  el.textContent = message;
}

function bindEvents() {
  $('#api_key').value = getApiKey();

  $('#api_key').addEventListener('input', (e) => {
    setApiKey(e.target.value);
  });

  $('#poll_interval').addEventListener('change', () => {
    startPolling();
  });

  $('#clear-btn').addEventListener('click', () => {
    if (!confirm('로컬에 저장된 작업 목록을 모두 지울까요?')) return;
    removeAllJobs();
    renderJobs();
  });

  $('#create-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showCreateError('');

    const form = e.currentTarget;
    const prompt = form.prompt.value.trim();
    if (!prompt) return;
    const apiKey = form.api_key.value.trim();
    if (!apiKey) {
      showCreateError('OpenAI API Key를 입력하세요.');
      return;
    }
    setApiKey(apiKey);

    const fd = new FormData();
    fd.set('prompt', prompt);
    fd.set('model', form.model.value);
    fd.set('seconds', form.seconds.value);
    fd.set('size', form.size.value);

    const file = form.input_reference.files?.[0];
    if (file) fd.set('input_reference', file, file.name);

    const createBtn = $('#create-btn');
    createBtn.disabled = true;
    createBtn.textContent = '생성 중...';

    try {
      const created = await createVideoJob(fd);
      upsertJob({
        id: created.id,
        ...created,
        promptLocal: prompt,
        modelLocal: form.model.value,
        secondsLocal: form.seconds.value,
        sizeLocal: form.size.value,
      });
      renderJobs();
      startPolling();
      form.prompt.focus();
    } catch (err) {
      showCreateError(safeText(err?.message || err));
    } finally {
      createBtn.disabled = false;
      createBtn.textContent = '비디오 생성';
    }
  });

  $('#lookup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const apiKey = getApiKey().trim();
    if (!apiKey) {
      alert('먼저 OpenAI API Key를 입력하세요.');
      return;
    }
    const id = $('#lookup-id').value.trim();
    if (!id) return;
    try {
      const job = await refreshJob(id);
      upsertJob({ id: job.id, ...job });
      renderJobs();
      startPolling();
      $('#lookup-id').value = '';
    } catch (err) {
      alert(safeText(err?.message || err));
    }
  });

  $('#jobs').addEventListener('click', async (e) => {
    const button = e.target.closest('button[data-action]');
    if (!button) return;
    const card = button.closest('.job');
    if (!card) return;
    const jobId = card.dataset.jobId;
    if (!jobId) return;

    const action = button.dataset.action;
    try {
      const apiKey = getApiKey().trim();
      const requiresApiKey = action !== 'remove' && action !== 'copy-id';
      if (requiresApiKey && !apiKey) {
        alert('먼저 OpenAI API Key를 입력하세요.');
        return;
      }

      if (action === 'copy-id') {
        await navigator.clipboard.writeText(jobId);
        button.textContent = '복사됨';
        setTimeout(() => (button.textContent = 'ID 복사'), 900);
        return;
      }

      if (action === 'refresh') {
        button.disabled = true;
        button.textContent = '조회 중...';
        await refreshJob(jobId);
        button.textContent = '새로고침';
        button.disabled = false;
        return;
      }

      if (action === 'remove') {
        removeJobFromList(jobId);
        return;
      }

      if (action === 'preview') {
        button.disabled = true;
        button.textContent = '로딩...';
        await ensurePreviewLoaded(jobId);
        button.textContent = '미리보기 로드';
        button.disabled = false;
        return;
      }

      if (action === 'download') {
        button.disabled = true;
        button.textContent = '다운로드 중...';
        const blob = await downloadVideoBlob(jobId);
        downloadBlob(blob, `${jobId}.mp4`);
        button.textContent = 'MP4 다운로드';
        button.disabled = false;
        return;
      }

      if (action === 'remix') {
        const textarea = card.querySelector('textarea[data-role="remix-prompt"]');
        const prompt = textarea?.value?.trim() || '';
        if (!prompt) {
          alert('리믹스 프롬프트를 입력하세요.');
          return;
        }
        button.disabled = true;
        button.textContent = '리믹스 생성 중...';
        const remixed = await remixVideoJob(jobId, prompt);
        upsertJob({
          id: remixed.id,
          ...remixed,
          promptLocal: prompt,
        });
        renderJobs();
        startPolling();
        button.textContent = '이 비디오로 리믹스 생성';
        button.disabled = false;
        return;
      }
    } catch (err) {
      alert(safeText(err?.message || err));
    } finally {
      renderJobs();
    }
  });
}

function main() {
  renderJobs();
  bindEvents();
  startPolling();
}

main();
