// ── Constants ─────────────────────────────────────────
const EMAIL_CAP    = 40;
const LS_EMAILS    = 'regen_emails';
const LS_CREDS     = 'regen_creds';
const LS_CONTACTS  = 'regen_contacts';

// ── State ──────────────────────────────────────────────
let emails         = [];
let savedContacts  = [];
let sending        = false;

// ── Init ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setTodayDate();
  loadCreds();
  loadEmails();
  loadSavedContacts();
  updateConfigBadge();
  renderList();
  renderSavedContacts();

  document.getElementById('newEmail').addEventListener('keydown', e => {
    if (e.key === 'Enter') addEmail();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
});

function setTodayDate() {
  const el = document.getElementById('todayDate');
  if (!el) return;
  el.textContent = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

// ── Config ─────────────────────────────────────────────
function toggleConfig() {
  const fields = document.getElementById('configFields');
  const arrow  = document.getElementById('configArrow');
  const isOpen = fields.classList.toggle('open');
  arrow.classList.toggle('open', isOpen);
}

function saveConfig() {
  const creds = {
    pk: document.getElementById('ejPublicKey').value.trim(),
    si: document.getElementById('ejServiceId').value.trim(),
    ti: document.getElementById('ejTemplateId').value.trim(),
  };
  localStorage.setItem(LS_CREDS, JSON.stringify(creds));
  updateConfigBadge();
  log('Credentials saved.', 'info');
}

function loadCreds() {
  try {
    const c = JSON.parse(localStorage.getItem(LS_CREDS) || '{}');
    if (c.pk) document.getElementById('ejPublicKey').value = c.pk;
    if (c.si) document.getElementById('ejServiceId').value = c.si;
    if (c.ti) document.getElementById('ejTemplateId').value = c.ti;
  } catch (_) {}
}

function updateConfigBadge() {
  const pk   = document.getElementById('ejPublicKey').value.trim();
  const si   = document.getElementById('ejServiceId').value.trim();
  const ti   = document.getElementById('ejTemplateId').value.trim();
  const txt  = document.getElementById('configStatus');
  const dot  = document.getElementById('statusDot');
  const ready = pk && si && ti;
  txt.textContent = ready ? 'Ready' : 'Not set';
  dot.classList.toggle('ready', ready);
}

function getCreds() {
  return {
    pk: document.getElementById('ejPublicKey').value.trim(),
    si: document.getElementById('ejServiceId').value.trim(),
    ti: document.getElementById('ejTemplateId').value.trim(),
  };
}

// ── Persistence ────────────────────────────────────────
function saveEmails() {
  localStorage.setItem(LS_EMAILS, JSON.stringify(emails));
}

function loadEmails() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_EMAILS) || '[]');
    if (Array.isArray(s)) emails = s;
  } catch (_) { emails = []; }
}

// ── Email management ───────────────────────────────────
function addEmail() {
  const name  = document.getElementById('newName').value.trim();
  const email = document.getElementById('newEmail').value.trim().toLowerCase();

  if (!email || !email.includes('@')) {
    return alert('Please enter a valid email address.');
  }
  if (emails.length >= EMAIL_CAP) {
    return alert(`Recipient cap of ${EMAIL_CAP} reached. Remove some before adding more.`);
  }
  if (emails.some(e => e.email === email)) {
    return alert('This email is already in the list.');
  }

  emails.push({ name: name || email.split('@')[0], email, selected: true });
  document.getElementById('newName').value  = '';
  document.getElementById('newEmail').value = '';
  saveEmails();
  renderList();
}

function removeEmail(index) {
  emails.splice(index, 1);
  saveEmails();
  renderList();
}

function clearAllEmails() {
  if (!emails.length) return;
  if (!confirm('Remove all recipients from the list?')) return;
  emails = [];
  saveEmails();
  renderList();
}

function selectAll(value) {
  emails.forEach(e => e.selected = value);
  saveEmails();
  renderList();
}

function updateCounters() {
  const selected = emails.filter(e => e.selected).length;
  document.getElementById('capDisplay').textContent = emails.length;
  document.getElementById('selDisplay').textContent = selected;
}

// ── Import / Export ────────────────────────────────────
function exportEmails() {
  if (!emails.length) return alert('No recipients to export.');
  const csv  = 'Name,Email\n' + emails.map(e => `"${e.name}","${e.email}"`).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'regen_recipients.csv' });
  a.click();
  URL.revokeObjectURL(url);
}

function importEmails(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split('\n').slice(1);
    let added = 0, skipped = 0;
    for (const line of lines) {
      const parts = line.replace(/"/g, '').split(',');
      const name  = (parts[0] || '').trim();
      const email = (parts[1] || '').trim().toLowerCase();
      if (!email || !email.includes('@'))      { skipped++; continue; }
      if (emails.some(ex => ex.email === email)) { skipped++; continue; }
      if (emails.length >= EMAIL_CAP)          { skipped++; continue; }
      emails.push({ name: name || email.split('@')[0], email, selected: true });
      added++;
    }
    saveEmails();
    renderList();
    log(`Import: ${added} added, ${skipped} skipped.`, 'info');
  };
  reader.readAsText(file);
  input.value = '';
}

// ── Rendering ──────────────────────────────────────────
function renderList() {
  const list = document.getElementById('emailList');

  if (emails.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-ornament">&#10022;</span>
        <p>No recipients yet.<br>Add student emails above.</p>
      </div>`;
    updateCounters();
    return;
  }

  list.innerHTML = emails.map((e, i) => `
    <div class="email-item">
      <input type="checkbox" ${e.selected ? 'checked' : ''}
        onchange="emails[${i}].selected=this.checked; saveEmails(); updateCounters();">
      <span class="name">${escHtml(e.name)}</span>
      <span class="addr">${escHtml(e.email)}</span>
      <button class="btn-save-contact" onclick="saveContactFromSession(${i})" title="Save to contacts">&#9733;</button>
      <button class="btn-remove" onclick="removeEmail(${i})" title="Remove">&#10005;</button>
    </div>
  `).join('');

  updateCounters();
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Saved Contacts ─────────────────────────────────────
function loadSavedContacts() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_CONTACTS) || '[]');
    if (Array.isArray(s)) savedContacts = s;
  } catch (_) { savedContacts = []; }
}

function persistContacts() {
  localStorage.setItem(LS_CONTACTS, JSON.stringify(savedContacts));
}

function saveContact() {
  const name  = document.getElementById('scName').value.trim();
  const email = document.getElementById('scEmail').value.trim().toLowerCase();
  if (!email || !email.includes('@')) return alert('Please enter a valid email address.');
  if (savedContacts.some(c => c.email === email)) return alert('This contact is already saved.');
  savedContacts.push({ name: name || email.split('@')[0], email });
  persistContacts();
  document.getElementById('scName').value  = '';
  document.getElementById('scEmail').value = '';
  renderSavedContacts();
  log(`Contact saved: ${email}`, 'info');
}

function saveContactFromSession(index) {
  const e = emails[index];
  if (savedContacts.some(c => c.email === e.email)) {
    log(`Already saved: ${e.email}`, 'info'); return;
  }
  savedContacts.push({ name: e.name, email: e.email });
  persistContacts();
  renderSavedContacts();
  log(`Saved to contacts: ${e.email}`, 'ok');
}

function deleteSavedContact(index) {
  if (!confirm(`Remove ${savedContacts[index].email} from saved contacts?`)) return;
  savedContacts.splice(index, 1);
  persistContacts();
  renderSavedContacts();
}

function loadContactToSession(index) {
  const c = savedContacts[index];
  if (emails.length >= EMAIL_CAP) return alert(`Recipient cap of ${EMAIL_CAP} reached.`);
  if (emails.some(e => e.email === c.email)) { alert('Already in the session list.'); return; }
  emails.push({ name: c.name, email: c.email, selected: true });
  saveEmails();
  renderList();
}

function loadAllToSession() {
  let added = 0;
  for (const c of savedContacts) {
    if (emails.length >= EMAIL_CAP) break;
    if (!emails.some(e => e.email === c.email)) {
      emails.push({ name: c.name, email: c.email, selected: true });
      added++;
    }
  }
  if (added === 0) { alert('All saved contacts are already in the session list.'); return; }
  saveEmails();
  renderList();
  log(`Loaded ${added} contact(s) to session.`, 'info');
}

function renderSavedContacts() {
  const list = document.getElementById('savedContactsList');
  if (savedContacts.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-ornament">&#10022;</span>
        <p>No saved contacts yet.<br>Save recipients to reuse them.</p>
      </div>`;
    return;
  }
  list.innerHTML = savedContacts.map((c, i) => `
    <div class="email-item" id="sc-row-${i}">
      <span class="saved-contact-dot"></span>
      <span class="name">${escHtml(c.name)}</span>
      <span class="addr">${escHtml(c.email)}</span>
      <button class="btn-load-contact" onclick="loadContactToSession(${i})" title="Add to session">+ Add</button>
      <button class="btn-edit-contact" onclick="editSavedContact(${i})" title="Edit">&#9998;</button>
      <button class="btn-remove" onclick="deleteSavedContact(${i})" title="Remove">&#10005;</button>
    </div>
  `).join('');
}

function editSavedContact(index) {
  const c   = savedContacts[index];
  const row = document.getElementById(`sc-row-${index}`);
  row.classList.add('editing');
  row.innerHTML = `
    <span class="saved-contact-dot"></span>
    <input class="sc-edit-name" type="text"  value="${escHtml(c.name)}"  placeholder="Name">
    <input class="sc-edit-email" type="email" value="${escHtml(c.email)}" placeholder="Email">
    <button class="btn-load-contact" onclick="saveEditedContact(${index})" title="Save">&#10003; Save</button>
    <button class="btn-remove" onclick="cancelEdit()" title="Cancel">&#10005;</button>
  `;
  row.querySelector('.sc-edit-name').focus();
  row.querySelector('.sc-edit-email').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveEditedContact(index);
    if (e.key === 'Escape') cancelEdit();
  });
  row.querySelector('.sc-edit-name').addEventListener('keydown', e => {
    if (e.key === 'Escape') cancelEdit();
  });
}

function saveEditedContact(index) {
  const row   = document.getElementById(`sc-row-${index}`);
  const name  = row.querySelector('.sc-edit-name').value.trim();
  const email = row.querySelector('.sc-edit-email').value.trim().toLowerCase();
  if (!email || !email.includes('@')) return alert('Please enter a valid email address.');
  const duplicate = savedContacts.findIndex((c, i) => c.email === email && i !== index);
  if (duplicate !== -1) return alert('Another contact with this email already exists.');
  savedContacts[index] = { name: name || email.split('@')[0], email };
  persistContacts();
  renderSavedContacts();
  log(`Contact updated: ${email}`, 'ok');
}

function cancelEdit() {
  renderSavedContacts();
}

// ── Logging ────────────────────────────────────────────
function log(message, type = 'info') {
  const logEl = document.getElementById('statusLog');
  logEl.style.display = 'block';
  const entry = document.createElement('div');
  entry.className   = `log-entry log-${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

function clearLog() {
  const logEl = document.getElementById('statusLog');
  logEl.innerHTML = '';
  logEl.style.display = 'none';
}

// ── Send ───────────────────────────────────────────────
async function sendTo(targets) {
  if (sending) return;
  const { pk, si, ti } = getCreds();
  if (!pk || !si || !ti) return alert('Please fill in your EmailJS credentials and save them.');

  const link    = document.getElementById('linkInput').value.trim();
  const message = document.getElementById('msgInput').value.trim();
  if (!link)           return alert('Please enter a whiteboard link to share.');
  if (!targets.length) return alert('No recipients selected.');

  sending = true;
  setSendLock(true);
  clearLog();

  const wrap = document.getElementById('progressWrap');
  const fill = document.getElementById('progressFill');
  const lbl  = document.getElementById('progressLabel');
  wrap.style.display = 'flex';
  fill.style.width   = '0%';
  lbl.textContent    = '0%';

  emailjs.init(pk);
  log(`Sending to ${targets.length} recipient(s)…`, 'info');

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    try {
      await emailjs.send(si, ti, {
        to_email: t.email,
        to_name:  t.name,
        link,
        message: message || 'Here are the latest notes from Regen Academia. Check out the whiteboard link below!',
      });
      log(`✓ Sent to ${t.email}`, 'ok');
    } catch (err) {
      log(`✗ Failed: ${t.email} — ${err.text || err}`, 'err');
    }
    const pct = Math.round(((i + 1) / targets.length) * 100);
    fill.style.width = pct + '%';
    lbl.textContent  = pct + '%';
  }

  log('Done.', 'info');
  sending = false;
  setSendLock(false);
}

function setSendLock(locked) {
  const bs = document.getElementById('btnSelected');
  const ba = document.getElementById('btnAll');
  bs.disabled = locked;
  ba.disabled = locked;
  bs.textContent = locked ? '⏳ Sending…' : '⚡ Send to Selected';
  ba.textContent = locked ? '⏳ Sending…' : '✉ Send to All';
}

function sendSelected() {
  sendTo(emails.filter(e => e.selected));
}

function confirmSendAll() {
  if (!emails.length) return alert('No recipients in the list.');
  showModal(
    `Send to all ${emails.length} recipient(s)?`,
    'This will send to everyone in the list, regardless of their selection state.',
    () => sendTo([...emails])
  );
}

// ── Modal ──────────────────────────────────────────────
function showModal(title, body, onConfirm) {
  document.getElementById('modalTitle').textContent   = title;
  document.getElementById('modalBody').textContent    = body;
  document.getElementById('modalConfirm').onclick     = () => { closeModal(); onConfirm(); };
  document.getElementById('modalOverlay').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modalOverlay').style.display = 'none';
}
