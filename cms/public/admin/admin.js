const API_ORIGIN = window.location.origin;
const TOKEN_KEY = 'nf_opp_cms_token';

let meta = { categories: [], locations: [] };
let editingId = null;
let slugManual = false;
let quill = null;
let cropper = null;
let pendingImageFile = null;
/** Raw HTML loaded from API — Quill strips Elementor markup, so we preserve it until the user edits. */
let preservedContent = '';
let contentTouched = false;
let usingHtmlSource = false;
let ignoreQuillChange = false;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/** Build primary /api URL and PHP fallback (when rewrite drops auth or blocks PUT). */
function apiCandidates(path, method = 'GET') {
  const clean = path.startsWith('/') ? path.slice(1) : path;
  const [pathname, query = ''] = clean.split('?');
  const verb = method.toUpperCase();
  const needsOverride = verb === 'PUT' || verb === 'DELETE';

  // Put _method on BOTH URLs — some hosts strip X-HTTP-Method-Override
  const primaryQs = new URLSearchParams(query);
  if (needsOverride) primaryQs.set('_method', verb);
  const primaryQ = primaryQs.toString();

  const fallbackQs = new URLSearchParams(query);
  fallbackQs.set('nf_path', `api/${pathname}`);
  if (needsOverride) fallbackQs.set('_method', verb);

  return {
    urls: [
      `${API_ORIGIN}/api/${pathname}${primaryQ ? `?${primaryQ}` : ''}`,
      `${API_ORIGIN}/nf-cms/index.php?${fallbackQs.toString()}`,
    ],
    fetchMethod: needsOverride ? 'POST' : verb,
    override: needsOverride ? verb : null,
  };
}

function isEffectivelyEmptyHtml(html) {
  if (!html) return true;
  const text = String(html)
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .trim();
  return text.length === 0;
}

function isComplexHtml(html) {
  const s = String(html || '');
  return /elementor|wp-block|data-elementor/i.test(s) || s.length > 6000;
}

function publicImageUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${API_ORIGIN}${url}`;
  return url;
}

async function api(path, options = {}) {
  const headers = { ...options.headers };
  const isFormData = options.body instanceof FormData;
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const method = (options.method || 'GET').toUpperCase();
  const { urls, fetchMethod, override } = apiCandidates(path, method);
  if (override) {
    headers['X-HTTP-Method-Override'] = override;
  }

  let lastError = new Error('Request failed');

  for (const url of urls) {
    try {
      const res = await fetch(url, { ...options, method: fetchMethod, headers });
      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        lastError = new Error(
          res.ok ? 'Invalid JSON from server' : `Request failed (${res.status})`
        );
        if (res.status === 404 || res.status === 405 || res.status === 501) continue;
        throw lastError;
      }

      if (!res.ok) {
        lastError = new Error(data.error || data.detail || `Request failed (${res.status})`);
        // Retry alternate URL for common host/proxy failures
        if ([401, 404, 405, 501, 502, 503].includes(res.status)) continue;
        throw lastError;
      }
      return data;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError;
}

let dialogResolver = null;

function closeDialog(result) {
  const dialog = $('#appDialog');
  if (!dialog) return;
  dialog.classList.add('hidden');
  const resolve = dialogResolver;
  dialogResolver = null;
  if (resolve) resolve(result);
}

function openDialog({
  title = 'Notice',
  message = '',
  variant = 'info',
  confirmLabel = 'OK',
  cancelLabel = null,
  danger = false,
} = {}) {
  const dialog = $('#appDialog');
  const icon = $('#appDialogIcon');
  const actions = $('#appDialogActions');
  if (!dialog || !icon || !actions) {
    return Promise.resolve(window.confirm(message || title));
  }

  const icons = {
    info: 'fa-info-circle',
    success: 'fa-check-circle',
    warning: 'fa-exclamation-triangle',
    danger: 'fa-trash-alt',
  };

  $('#appDialogTitle').textContent = title;
  $('#appDialogMessage').textContent = message;
  icon.className = `app-dialog__icon is-${variant}`;
  icon.innerHTML = `<i class="fas ${icons[variant] || icons.info}"></i>`;

  actions.innerHTML = '';
  if (cancelLabel) {
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-ghost';
    cancelBtn.textContent = cancelLabel;
    cancelBtn.addEventListener('click', () => closeDialog(false));
    actions.appendChild(cancelBtn);
  }

  const okBtn = document.createElement('button');
  okBtn.type = 'button';
  okBtn.className = danger ? 'btn btn-danger' : 'btn btn-primary';
  okBtn.textContent = confirmLabel;
  okBtn.addEventListener('click', () => closeDialog(true));
  actions.appendChild(okBtn);

  dialog.classList.remove('hidden');
  okBtn.focus();

  return new Promise((resolve) => {
    dialogResolver = resolve;
  });
}

function flash(msg) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(flash._timer);
  flash._timer = setTimeout(() => el.classList.add('hidden'), 2800);
}

function toast(msg, variant = 'success') {
  if (variant === 'error' || variant === 'warning') {
    openDialog({
      title: variant === 'error' ? 'Something went wrong' : 'Notice',
      message: msg,
      variant: variant === 'error' ? 'danger' : 'warning',
      confirmLabel: 'OK',
    });
    return;
  }
  flash(msg);
}

function confirmPopup(message, {
  title = 'Please confirm',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
} = {}) {
  return openDialog({
    title,
    message,
    variant: danger ? 'danger' : 'warning',
    confirmLabel,
    cancelLabel,
    danger,
  });
}

function slugify(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function showView(name) {
  $('#listPanel').classList.toggle('hidden', name !== 'list');
  $('#formPanel').classList.toggle('hidden', name !== 'form');
  $('#usersPanel').classList.toggle('hidden', name !== 'users');
  $$('.nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === name || (name === 'form' && btn.dataset.view === 'new'));
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function initQuill() {
  if (quill) return;
  quill = new Quill('#oppContentEditor', {
    theme: 'snow',
    placeholder: 'Write the full opportunity description shown on the detail page...',
    modules: {
      toolbar: [
        [{ header: [2, 3, false] }],
        ['bold', 'italic', 'underline'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link'],
        ['clean'],
      ],
    },
  });
  quill.on('text-change', () => {
    if (!ignoreQuillChange) contentTouched = true;
  });
}

function setImagePreview(url) {
  const preview = $('#imagePreview');
  const dropzone = $('#imageDropzone');
  const img = $('#imagePreviewImg');

  if (url) {
    $('#oppImage').value = url;
    img.src = publicImageUrl(url);
    preview.classList.remove('hidden');
    dropzone.classList.add('hidden');
  } else {
    $('#oppImage').value = '';
    img.src = '';
    preview.classList.add('hidden');
    dropzone.classList.remove('hidden');
  }
}

function setEditorContent(html) {
  preservedContent = html || '';
  contentTouched = false;
  usingHtmlSource = isComplexHtml(preservedContent);

  const source = $('#oppContentSource');
  const editorWrap = $('#oppContentEditorWrap');
  const note = $('#contentModeNote');

  if (usingHtmlSource) {
    source.value = preservedContent;
    source.classList.remove('hidden');
    editorWrap.classList.add('hidden');
    if (note) {
      note.textContent =
        'This post uses imported WordPress HTML. Edit it as HTML here so the detail page keeps its full content.';
      note.classList.remove('hidden');
    }
    return;
  }

  source.value = '';
  source.classList.add('hidden');
  editorWrap.classList.remove('hidden');
  if (note) note.classList.add('hidden');

  ignoreQuillChange = true;
  quill.setText('');
  if (preservedContent && !isEffectivelyEmptyHtml(preservedContent)) {
    quill.clipboard.dangerouslyPasteHTML(preservedContent);
  }
  // Quill may emit text-change while pasting — ignore until next tick
  setTimeout(() => {
    ignoreQuillChange = false;
    contentTouched = false;
  }, 0);
}

function getEditorContent() {
  if (usingHtmlSource) {
    return $('#oppContentSource').value || '';
  }
  const html = quill.root.innerHTML;
  // Never wipe imported content if the user never edited the rich text
  if (!contentTouched && preservedContent && isEffectivelyEmptyHtml(html)) {
    return preservedContent;
  }
  if (!contentTouched && preservedContent && isComplexHtml(preservedContent)) {
    return preservedContent;
  }
  return html;
}

function openCropModal(file) {
  pendingImageFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    const cropImg = $('#cropImage');
    cropImg.src = e.target.result;
    $('#cropModal').classList.remove('hidden');

    if (cropper) cropper.destroy();
    cropper = new Cropper(cropImg, {
      viewMode: 1,
      dragMode: 'move',
      aspectRatio: NaN,
      autoCropArea: 0.9,
      responsive: true,
      background: false,
    });
  };
  reader.readAsDataURL(file);
}

function closeCropModal() {
  $('#cropModal').classList.add('hidden');
  if (cropper) {
    cropper.destroy();
    cropper = null;
  }
  pendingImageFile = null;
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
  });
}

async function uploadImageBlob(blob, filename = 'image.jpg') {
  const form = new FormData();
  form.append('image', blob, filename);
  const data = await api('/uploads', { method: 'POST', body: form });
  return data.url;
}

async function applyCrop(useFull = false) {
  if (!pendingImageFile) return;

  $('#cropApplyBtn').disabled = true;
  $('#cropFullBtn').disabled = true;

  try {
    let blob;
    if (useFull) {
      blob = pendingImageFile;
    } else {
      const canvas = cropper.getCroppedCanvas({
        maxWidth: 1920,
        maxHeight: 1920,
        imageSmoothingQuality: 'high',
      });
      if (!canvas) throw new Error('Could not crop image');
      blob = await canvasToBlob(canvas);
    }

    toast('Uploading image...');
    const url = await uploadImageBlob(blob, pendingImageFile.name);
    setImagePreview(url);
    closeCropModal();
    toast('Image uploaded');
  } catch (ex) {
    toast(ex.message || 'Upload failed', 'error');
  } finally {
    $('#cropApplyBtn').disabled = false;
    $('#cropFullBtn').disabled = false;
  }
}

function handleImageFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    toast('Please choose a valid image file', 'warning');
    return;
  }
  openCropModal(file);
}

function wirePublicLinks() {
  const isLocalCms =
    window.location.hostname === 'localhost' &&
    (window.location.port === '3001' || !window.location.port);
  const publicBase = isLocalCms ? 'http://localhost:5173' : '';

  document.querySelectorAll('[data-public-href]').forEach((el) => {
    const path = el.getAttribute('data-public-href') || '/';
    el.href = `${publicBase}${path}`;
  });
}

async function init() {
  // Guard: wrong index.html (e.g. React SPA) was uploaded into /admin/
  if (!$('#loginView') || !$('#dashboardView') || !$('#oppContentEditor')) {
    document.body.innerHTML = `
      <div style="font-family:Montserrat,sans-serif;max-width:520px;margin:4rem auto;padding:1.5rem;text-align:center;color:#0f112c">
        <h1 style="font-size:1.35rem;margin:0 0 .75rem">Admin panel files are incomplete</h1>
        <p style="color:#5c6078;line-height:1.5;margin:0 0 1rem">
          <code>/admin/index.html</code> must be the Opportunities CMS page from
          <code>dist-admin/</code>, not the public React site.
        </p>
        <p style="color:#5c6078;line-height:1.5;margin:0">
          Re-upload the contents of <strong>dist-admin/</strong> into
          <strong>public_html/admin/</strong> (overwrite index.html, admin.js, admin.css).
        </p>
      </div>`;
    return;
  }

  wirePublicLinks();
  initQuill();
  await loadMeta();
  populateSelects();

  if (getToken()) {
    try {
      await showDashboard();
    } catch {
      setToken(null);
      showLogin();
    }
  } else {
    showLogin();
  }

  bindEvents();
}

async function loadMeta() {
  meta = await api('/opportunities/meta');
}

function populateSelects() {
  const cat = $('#oppCategory');
  const loc = $('#oppLocation');
  cat.innerHTML = meta.categories.map((c) => `<option value="${c}">${c}</option>`).join('');
  loc.innerHTML = meta.locations.map((l) => `<option value="${l}">${l}</option>`).join('');
}

function showLogin() {
  $('#loginView').classList.remove('hidden');
  $('#dashboardView').classList.add('hidden');
}

async function showDashboard() {
  const user = await api('/auth/me');
  $('#userName').textContent = user.name;
  $('#userRole').textContent = user.role;
  $$('.admin-only').forEach((el) => el.classList.toggle('hidden', user.role !== 'admin'));

  $('#loginView').classList.add('hidden');
  $('#dashboardView').classList.remove('hidden');
  showView('list');
  await loadAdminList();
}

function bindEvents() {
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#loginError');
    err.classList.add('hidden');
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: $('#loginEmail').value,
          password: $('#loginPassword').value,
        }),
      });
      setToken(data.token);
      await showDashboard();
      toast('Welcome back!');
    } catch (ex) {
      err.textContent = ex.message;
      err.classList.remove('hidden');
    }
  });

  $('#logoutBtn').addEventListener('click', () => {
    setToken(null);
    showLogin();
  });

  $$('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view === 'new') openForm();
      else if (view === 'list') { showView('list'); loadAdminList(); }
      else if (view === 'users') { showView('users'); loadUsers(); }
    });
  });

  $('#quickNewBtn').addEventListener('click', () => openForm());
  $('#backToListBtn').addEventListener('click', () => { showView('list'); loadAdminList(); });

  $('#adminSearch').addEventListener('input', debounce(loadAdminList, 300));
  $('#adminStatusFilter').addEventListener('change', loadAdminList);

  $('#opportunityForm').addEventListener('submit', (e) => {
    e.preventDefault();
    saveOpportunity('published');
  });
  $('#saveDraftBtn').addEventListener('click', (e) => {
    e.preventDefault();
    saveOpportunity('draft');
  });
  $('#deleteBtn').addEventListener('click', (e) => {
    e.preventDefault();
    deleteOpportunity();
  });

  $('#oppTitle').addEventListener('input', () => {
    if (!slugManual) {
      $('#oppSlug').value = slugify($('#oppTitle').value);
    }
  });

  $('#oppSlug').addEventListener('input', () => {
    slugManual = $('#oppSlug').value.trim().length > 0;
  });

  $('#imageDropzone').addEventListener('click', () => $('#imageFileInput').click());
  $('#imageFileInput').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
    e.target.value = '';
  });

  $('#imageDropzone').addEventListener('dragover', (e) => {
    e.preventDefault();
    $('#imageDropzone').classList.add('is-dragover');
  });
  $('#imageDropzone').addEventListener('dragleave', () => {
    $('#imageDropzone').classList.remove('is-dragover');
  });
  $('#imageDropzone').addEventListener('drop', (e) => {
    e.preventDefault();
    $('#imageDropzone').classList.remove('is-dragover');
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageFile(file);
  });

  $('#changeImageBtn').addEventListener('click', () => $('#imageFileInput').click());
  $('#removeImageBtn').addEventListener('click', () => setImagePreview(''));

  $('#cropCancelBtn').addEventListener('click', closeCropModal);
  $('#cropFullBtn').addEventListener('click', () => applyCrop(true));
  $('#cropApplyBtn').addEventListener('click', () => applyCrop(false));

  const dialog = $('#appDialog');
  if (dialog) {
    dialog.querySelector('[data-dialog-dismiss]')?.addEventListener('click', () => {
      // Backdrop closes only alert-style dialogs (single OK), not confirms mid-flow
      if ($('#appDialogActions')?.querySelectorAll('button').length === 1) {
        closeDialog(true);
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !dialog.classList.contains('hidden')) {
        const buttons = $('#appDialogActions')?.querySelectorAll('button') || [];
        closeDialog(buttons.length > 1 ? false : true);
      }
    });
  }

  $('#userForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#userFormError');
    err.classList.add('hidden');
    try {
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: $('#newUserName').value,
          email: $('#newUserEmail').value,
          password: $('#newUserPassword').value,
        }),
      });
      $('#userForm').reset();
      toast('Team member added');
      loadUsers();
    } catch (ex) {
      err.textContent = ex.message;
      err.classList.remove('hidden');
    }
  });
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function loadAdminList() {
  const search = $('#adminSearch').value.trim();
  const status = $('#adminStatusFilter').value;
  let url = `/opportunities?admin=true&limit=100`;
  if (search) url += `&search=${encodeURIComponent(search)}`;

  const { data } = await api(url);
  let items = data;
  if (status !== 'all') items = items.filter((o) => o.status === status);

  // Newest posted first (matches public opportunities page)
  items = [...items].sort((a, b) => {
    const ad = Date.parse(a.created_at || a.published_at || 0) || 0;
    const bd = Date.parse(b.created_at || b.published_at || 0) || 0;
    return bd - ad;
  });

  const list = $('#adminList');
  if (!items.length) {
    list.innerHTML = '<div class="empty-state"><p>No opportunities yet. Create your first post!</p></div>';
    return;
  }

  list.innerHTML = items.map((o) => {
    const posted = formatPostedDate(o.created_at || o.published_at);
    return `
    <div class="admin-item" data-id="${o.id}">
      <div class="admin-item-info">
        <h3>${escapeHtml(o.title)}</h3>
        <div class="admin-item-meta">
          <span class="badge badge-${o.status}">${o.status}</span>
          <span class="badge badge-category">${escapeHtml(o.category)}</span>
          ${o.featured ? '<span class="badge badge-featured">Featured</span>' : ''}
          ${posted ? `<span>Posted: ${posted}</span>` : ''}
          ${o.deadline ? `<span>Deadline: ${o.deadline}</span>` : ''}
          ${o.slug ? `<span>/${escapeHtml(o.slug)}</span>` : ''}
        </div>
      </div>
      <div class="admin-item-actions">
        <button type="button" class="btn btn-ghost btn-sm edit-btn" data-id="${o.id}"><i class="fas fa-edit"></i> Edit</button>
        <button type="button" class="btn btn-ghost btn-sm delete-btn" data-id="${o.id}" title="Delete"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('.edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => openForm(btn.dataset.id));
  });
  list.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (!id || !(await confirmPopup('Delete this opportunity permanently?', {
        title: 'Delete opportunity',
        confirmLabel: 'Delete',
        danger: true,
      }))) return;
      try {
        await api(`/opportunities/${id}`, { method: 'DELETE' });
        toast('Deleted');
        loadAdminList();
      } catch (ex) {
        toast(ex.message || 'Delete failed', 'error');
      }
    });
  });
}

function formatPostedDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function resetForm() {
  $('#opportunityForm').reset();
  $('#oppId').value = '';
  slugManual = false;
  preservedContent = '';
  contentTouched = false;
  usingHtmlSource = false;
  const source = $('#oppContentSource');
  const editorWrap = $('#oppContentEditorWrap');
  const note = $('#contentModeNote');
  if (source) {
    source.value = '';
    source.classList.add('hidden');
  }
  if (editorWrap) editorWrap.classList.remove('hidden');
  if (note) note.classList.add('hidden');
  if (quill) quill.setText('');
  setImagePreview('');
}

function openForm(id = null) {
  // Guard: click handlers can pass a PointerEvent as the first arg
  if (id && (typeof id !== 'string')) {
    id = null;
  }
  editingId = id;
  $('#formTitle').textContent = id ? 'Edit Opportunity' : 'New Opportunity';
  $('#deleteBtn').classList.toggle('hidden', !id);
  $('#formError').classList.add('hidden');
  resetForm();
  $('#oppId').value = id || '';

  if (id) {
    api(`/opportunities/${id}`).then((o) => {
      // If user navigated away, ignore stale response
      if (editingId !== id) return;
      $('#oppTitle').value = o.title;
      $('#oppSlug').value = o.slug || '';
      slugManual = Boolean(o.slug);
      $('#oppSummary').value = o.summary || '';
      setEditorContent(o.content || '');
      $('#oppApplyUrl').value = o.apply_url && o.apply_url !== '#' ? o.apply_url : '';
      $('#oppCategory').value = o.category;
      $('#oppLocation').value = o.location;
      $('#oppDeadline').value = o.deadline || '';
      $('#oppTags').value = (o.tags || []).join(', ');
      $('#oppFeatured').checked = o.featured;
      $('#oppStatus').value = o.status;
      $('#oppImageAlt').value = o.image_alt || '';
      if (o.image) setImagePreview(o.image);
    }).catch((ex) => {
      $('#formError').textContent = ex.message || 'Failed to load opportunity';
      $('#formError').classList.remove('hidden');
    });
  } else {
    setEditorContent('');
  }

  showView('form');
}

async function saveOpportunity(forceStatus) {
  const err = $('#formError');
  err.classList.add('hidden');

  const title = $('#oppTitle').value.trim();
  if (!title) {
    err.textContent = 'Title is required';
    err.classList.remove('hidden');
    return;
  }

  const status = forceStatus || $('#oppStatus').value;
  let applyUrl = $('#oppApplyUrl').value.trim();
  if (status === 'published') {
    if (!applyUrl) {
      err.textContent = 'Apply URL is required to publish';
      err.classList.remove('hidden');
      return;
    }
  } else if (!applyUrl) {
    applyUrl = '#';
  }

  const tags = $('#oppTags').value.split(',').map((t) => t.trim()).filter(Boolean);
  const payload = {
    title,
    slug: $('#oppSlug').value.trim() || undefined,
    summary: $('#oppSummary').value,
    content: getEditorContent(),
    apply_url: applyUrl,
    category: $('#oppCategory').value,
    location: $('#oppLocation').value,
    deadline: $('#oppDeadline').value || null,
    tags,
    featured: $('#oppFeatured').checked,
    status,
    image: $('#oppImage').value || null,
    image_alt: $('#oppImageAlt').value || title,
  };

  try {
    if (editingId) {
      await api(`/opportunities/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      toast(status === 'draft' ? 'Saved as draft' : 'Opportunity updated');
    } else {
      const created = await api('/opportunities', { method: 'POST', body: JSON.stringify(payload) });
      editingId = created.id || editingId;
      toast(payload.status === 'published' ? 'Published!' : 'Draft saved');
    }
    showView('list');
    loadAdminList();
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
  }
}

async function deleteOpportunity() {
  if (!editingId) {
    toast('Nothing to delete — open an existing opportunity first', 'warning');
    return;
  }
  const ok = await confirmPopup('Delete this opportunity permanently?', {
    title: 'Delete opportunity',
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!ok) return;
  try {
    await api(`/opportunities/${editingId}`, { method: 'DELETE' });
    toast('Deleted');
    editingId = null;
    showView('list');
    loadAdminList();
  } catch (ex) {
    $('#formError').textContent = ex.message;
    $('#formError').classList.remove('hidden');
    toast(ex.message || 'Delete failed', 'error');
  }
}

async function loadUsers() {
  const users = await api('/auth/users');
  $('#usersList').innerHTML = users.map((u) => `
    <div class="user-row">
      <div>
        <strong>${escapeHtml(u.name)}</strong>
        <div class="user-email">${escapeHtml(u.email)}</div>
      </div>
      <span class="badge badge-category">${u.role}</span>
    </div>
  `).join('');
}

init();
