/*
  School election app for device-based voting.
  - Stores election data in localStorage.
  - Admin panel: add roles and candidates with photos.
  - Voting: one role at a time, candidates shown large and vote advances automatically.
  - Results: show live vote counts and export to Excel (.xlsx).
*/

const STORAGE_KEY = 'madrasa_election_v1';
const ADMIN_PASS_KEY = 'madrasa_election_admin_pass';
const TEACHER_PIN_KEY = 'madrasa_election_teacher_pin';

let audioCtx = null;
function ensureAudio(){
  if(!audioCtx){ audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
}
function playTone(freq=880, duration=0.12, type='sine', vol=0.2){
  try{
    ensureAudio();
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = freq;
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    oscillator.connect(gain);
    gain.connect(audioCtx.destination);
    oscillator.start();
    setTimeout(()=>{
      try{ oscillator.stop(); }catch(e){}
    }, duration * 1000);
  }catch(e){ console.warn('Audio failed', e); }
}
function playStart(){ playTone(880,0.14,'sine',0.18); setTimeout(()=>playTone(1320,0.08,'sine',0.12),60); }
function playClick(){ playTone(1200,0.06,'square',0.14); }
function playFinish(){ playTone(660,0.18,'sine',0.18); setTimeout(()=>playTone(880,0.12,'sine',0.16),120); }

function showToast(message, type='info', duration=2800){
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span><span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(()=>{ toast.classList.add('hide'); setTimeout(()=>toast.remove(), 260); }, duration);
}

function showDialog(content){
  dialogOverlay.innerHTML = '';
  dialogOverlay.classList.remove('hidden');
  dialogOverlay.innerHTML = `
    <div class="dialog-card">
      ${content}
    </div>
  `;
  return dialogOverlay.querySelector('.dialog-card');
}

function hideDialog(){
  dialogOverlay.classList.add('hidden');
  dialogOverlay.innerHTML = '';
}

function showConfirmDialog(message){
  return new Promise((resolve)=>{
    const card = showDialog(`
      <h3>${message}</h3>
      <div class="dialog-actions">
        <button class="btn" id="dialogCancelBtn">Cancel</button>
        <button class="btn primary" id="dialogConfirmBtn">Confirm</button>
      </div>
    `);
    const cancelBtn = card.querySelector('#dialogCancelBtn');
    const confirmBtn = card.querySelector('#dialogConfirmBtn');
    cancelBtn.addEventListener('click', ()=>{ hideDialog(); resolve(false); });
    confirmBtn.addEventListener('click', ()=>{ hideDialog(); resolve(true); });
  });
}

function showPromptDialog(message, type='text', placeholder=''){
  return new Promise((resolve)=>{
    const card = showDialog(`
      <h3>${message}</h3>
      <input id="dialogInput" type="${type}" placeholder="${placeholder}" autocomplete="off" />
      <div class="dialog-actions">
        <button class="btn" id="dialogCancelBtn">Cancel</button>
        <button class="btn primary" id="dialogSubmitBtn">Submit</button>
      </div>
    `);
    const input = card.querySelector('#dialogInput');
    const cancelBtn = card.querySelector('#dialogCancelBtn');
    const submitBtn = card.querySelector('#dialogSubmitBtn');
    input.focus();
    cancelBtn.addEventListener('click', ()=>{ hideDialog(); resolve(null); });
    submitBtn.addEventListener('click', ()=>{ hideDialog(); resolve(input.value.trim()); });
    input.addEventListener('keydown', (event)=>{
      if(event.key === 'Enter'){
        event.preventDefault();
        submitBtn.click();
      }
    });
  });
}

function getAdminPass(){ return localStorage.getItem(ADMIN_PASS_KEY) || null; }
function setAdminPassValue(p){
  if(!p){ localStorage.removeItem(ADMIN_PASS_KEY); showToast('Admin password removed', 'success'); }
  else { localStorage.setItem(ADMIN_PASS_KEY, p); showToast('Admin password set', 'success'); }
}
function getTeacherPin(){ return localStorage.getItem(TEACHER_PIN_KEY) || null; }
function setTeacherPinValue(p){
  if(!p){ localStorage.removeItem(TEACHER_PIN_KEY); showToast('Teacher PIN removed', 'success'); }
  else { localStorage.setItem(TEACHER_PIN_KEY, p); showToast('Teacher PIN set', 'success'); }
}

async function verifyAdminPrompt(){
  const pass = getAdminPass();
  if(!pass){ showToast('No admin password set. Please set one in Admin.', 'warning'); return true; }
  const attempt = await showPromptDialog('Enter admin password:', 'password', 'Password');
  if(attempt === null){ showToast('Admin access cancelled', 'warning'); return false; }
  if(attempt === pass){ return true; }
  showToast('Incorrect password', 'error');
  return false;
}

async function requireTeacherAccess(){
  if(teacherAccessGranted){ return true; }
  const pin = getTeacherPin();
  if(pin){
    const attempt = await showPromptDialog('Enter teacher PIN:', 'password', 'PIN');
    if(attempt === null){ showToast('Teacher access cancelled', 'warning'); return false; }
    if(attempt !== pin){ showToast('Incorrect teacher PIN', 'error'); return false; }
    teacherAccessGranted = true;
    sessionStorage.setItem('teacher_access_granted', '1');
    return true;
  }
  const pass = getAdminPass();
  if(pass){
    const attempt = await showPromptDialog('Enter admin password:', 'password', 'Password');
    if(attempt === null){ showToast('Admin access cancelled', 'warning'); return false; }
    if(attempt !== pass){ showToast('Incorrect admin password', 'error'); return false; }
    teacherAccessGranted = true;
    sessionStorage.setItem('teacher_access_granted', '1');
    return true;
  }
  teacherAccessGranted = true;
  sessionStorage.setItem('teacher_access_granted', '1');
  return true;
}

const adminToggle = document.getElementById('adminToggle');
const adminPanel = document.getElementById('adminPanel');
const addRoleBtn = document.getElementById('addRole');
const roleNameInput = document.getElementById('roleName');
const rolesList = document.getElementById('rolesList');
const startElectionBtn = document.getElementById('startElection');
const bigStartBtn = document.getElementById('bigStartBtn');
const startScreen = document.getElementById('startScreen');
const votingArea = document.getElementById('votingArea');
const votingRoleTitle = document.getElementById('votingRoleTitle');
const votingHint = document.getElementById('votingHint');
const candidatesGrid = document.getElementById('candidatesGrid');
const adminPassInput = document.getElementById('adminPassInput');
const adminPassConfirmInput = document.getElementById('adminPassConfirmInput');
const setAdminPassBtn = document.getElementById('setAdminPass');
const clearAdminPassBtn = document.getElementById('clearAdminPass');
const teacherPinInput = document.getElementById('teacherPinInput');
const teacherPinConfirmInput = document.getElementById('teacherPinConfirmInput');
const setTeacherPinBtn = document.getElementById('setTeacherPin');
const clearTeacherPinBtn = document.getElementById('clearTeacherPin');
const viewResultsBtn = document.getElementById('viewResults');
const resultsArea = document.getElementById('resultsArea');
const resultsList = document.getElementById('resultsList');
const exportXlsxBtn = document.getElementById('exportXlsx');
const resetElectionBtn = document.getElementById('resetElection');
const toastContainer = document.getElementById('toastContainer');
const dialogOverlay = document.getElementById('dialogOverlay');

let state = {
  madrasaName: 'MISBAHUL HUDHA MADRASA KAMBALAKKALLU',
  roles: [],
  currentRoleIndex: 0,
  mode: 'idle'
};
let teacherAccessGranted = sessionStorage.getItem('teacher_access_granted') === '1';

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){ state = JSON.parse(raw); }
  }catch(e){ console.error('Load state', e); }
}
function saveState(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  }catch(error){
    console.error('Save state failed', error);
    showToast('Unable to save election data. Storage may be full or the photo is too large.', 'error', 5600);
    return false;
  }
}

function uid(prefix='id'){ return prefix + '_' + Math.random().toString(36).slice(2, 9); }

function processImageFile(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onerror = ()=> reject(new Error('Photo read failed. Please choose another image.'));
    reader.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        const maxDimension = 900;
        const scale = Math.min(1, maxDimension / img.width, maxDimension / img.height);
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.78);
        resolve(compressed);
      };
      img.onerror = ()=> reject(new Error('Failed to process image. Please try a different photo.'));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderRolesList(){
  rolesList.innerHTML = '';
  state.roles.forEach((role, idx)=>{
    const roleItem = document.createElement('div');
    roleItem.className = 'role-item card';

    const title = document.createElement('h3');
    title.className = 'role-title';
    title.textContent = `${idx + 1}. ${role.name}`;
    roleItem.appendChild(title);

    const candidateWrap = document.createElement('div');
    candidateWrap.className = 'candidates-for-role';
    role.candidates.forEach((candidate)=>{
      const card = document.createElement('div');
      card.className = 'candidate-card';

      const image = document.createElement('img');
      image.className = 'candidate-photo';
      image.src = candidate.photoDataUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="100%" height="100%" fill="%230b7fa3" /><text x="50%" y="50%" fill="white" font-size="18" text-anchor="middle" dominant-baseline="central">No Image</text></svg>';
      card.appendChild(image);

      const info = document.createElement('div');
      info.className = 'candidate-info';
      const name = document.createElement('div');
      name.className = 'candidate-name';
      name.textContent = candidate.name;
      const votes = document.createElement('div');
      votes.className = 'candidate-votes';
      votes.textContent = `Votes: ${candidate.votes || 0}`;
      info.appendChild(name);
      info.appendChild(votes);
      card.appendChild(info);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', ()=> removeCandidate(role.id, candidate.id));
      card.appendChild(removeBtn);
      candidateWrap.appendChild(card);
    });
    roleItem.appendChild(candidateWrap);

    const addRow = document.createElement('div');
    addRow.className = 'form-row';
    const nameInput = document.createElement('input');
    nameInput.className = 'candidateName';
    nameInput.placeholder = 'Candidate name';
    let photoInput = document.createElement('input');
    photoInput.type = 'file';
    photoInput.accept = 'image/*';
    photoInput.className = 'candidatePhoto';
    const addBtn = document.createElement('button');
    addBtn.className = 'btn';
    addBtn.textContent = 'Add Candidate';
    addBtn.addEventListener('click', async ()=>{
      const name = nameInput.value.trim();
      const file = photoInput.files[0];
      if(!name){ showToast('Candidate name required', 'warning'); return; }
      if(file && file.size > 3200000){
        showToast('Photo too large. Use a smaller image (under 3MB) for the best mobile experience.', 'warning', 5200);
        return;
      }
      const resetPhotoInput = ()=>{
        const freshInput = document.createElement('input');
        freshInput.type = 'file';
        freshInput.accept = 'image/*';
        freshInput.className = 'candidatePhoto';
        photoInput.replaceWith(freshInput);
        photoInput = freshInput;
      };
      let photoDataUrl = null;
      if(file){
        try{
          photoDataUrl = await processImageFile(file);
        }catch(error){
          console.error('Image processing error', error);
          showToast(error.message || 'Unable to upload image. Please choose a smaller image.', 'error', 5200);
          resetPhotoInput();
          return;
        }
      }
      const roleObj = state.roles.find((r)=> r.id === role.id);
      const candidate = addCandidate(role.id, name, photoDataUrl);
      nameInput.value = '';
      resetPhotoInput();
      if(!saveState()){
        if(roleObj){ roleObj.candidates = roleObj.candidates.filter((cand)=> cand.id !== (candidate && candidate.id)); }
        renderRolesList();
        return;
      }
      renderRolesList();
    });
    addRow.appendChild(nameInput);
    addRow.appendChild(photoInput);
    addRow.appendChild(addBtn);
    roleItem.appendChild(addRow);

    const removeRoleBtn = document.createElement('button');
    removeRoleBtn.className = 'btn danger';
    removeRoleBtn.textContent = 'Remove Role';
    removeRoleBtn.addEventListener('click', async ()=>{
      if(await showConfirmDialog('Remove role and its candidates?')){ removeRole(role.id); }
    });
    roleItem.appendChild(removeRoleBtn);

    rolesList.appendChild(roleItem);
  });
}

function addRole(name){
  const role = { id: uid('role'), name, candidates: [] };
  state.roles.push(role);
  saveState();
  renderRolesList();
}
function removeRole(roleId){
  state.roles = state.roles.filter((r)=> r.id !== roleId);
  saveState();
  renderRolesList();
}
function addCandidate(roleId, name, photoDataUrl){
  const role = state.roles.find((r)=> r.id === roleId);
  if(!role) return null;
  const candidate = { id: uid('cand'), name, photoDataUrl, votes: 0 };
  role.candidates.push(candidate);
  return candidate;
}
function removeCandidate(roleId, candId){
  const role = state.roles.find((r)=> r.id === roleId);
  if(!role) return;
  role.candidates = role.candidates.filter((cand)=> cand.id !== candId);
  saveState();
  renderRolesList();
}

function renderVotingRole(){
  if(state.roles.length === 0){ showToast('No roles defined. Please add them in Admin panel.', 'warning'); return; }
  state.currentRoleIndex = Math.max(0, Math.min(state.currentRoleIndex, state.roles.length - 1));
  const role = state.roles[state.currentRoleIndex];
  votingRoleTitle.textContent = `Vote for: ${role.name}`;
  votingHint.textContent = 'Tap a candidate to cast your vote. The app will move to the next role automatically.';
  startScreen.classList.add('hidden');
  candidatesGrid.innerHTML = '';

  if(role.candidates.length === 0){
    const empty = document.createElement('div');
    empty.className = 'candidate-card';
    empty.textContent = 'No candidates have been added to this role yet.';
    candidatesGrid.appendChild(empty);
    return;
  }

  role.candidates.forEach((candidate)=>{
    const card = document.createElement('div');
    card.className = 'candidate-card';
    card.style.flexDirection = 'column';
    card.style.alignItems = 'flex-start';
    card.style.width = '100%';

    const image = document.createElement('img');
    image.className = 'candidate-photo';
    image.src = candidate.photoDataUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="100%" height="100%" fill="%230b7fa3" /><text x="50%" y="50%" fill="white" font-size="18" text-anchor="middle" dominant-baseline="central">No Image</text></svg>';
    image.style.marginBottom = '8px';
    card.appendChild(image);

    const name = document.createElement('div');
    name.className = 'candidate-name';
    name.textContent = candidate.name;
    card.appendChild(name);

    const button = document.createElement('button');
    button.className = 'btn primary vote-btn';
    button.textContent = 'Vote';
    button.addEventListener('click', ()=> castVote(role.id, candidate.id));
    card.appendChild(button);

    candidatesGrid.appendChild(card);
  });
}

function castVote(roleId, candId){
  const role = state.roles.find((r)=> r.id === roleId);
  if(!role) return;
  const candidate = role.candidates.find((c)=> c.id === candId);
  if(!candidate) return;

  candidate.votes = (candidate.votes || 0) + 1;
  saveState();
  playClick();
  showVoteAnimation(candidate.name);

  if(state.currentRoleIndex < state.roles.length - 1){
    setTimeout(()=>{
      state.currentRoleIndex += 1;
      renderVotingRole();
    }, 700);
  } else {
    setTimeout(()=>{
      votingArea.classList.add('hidden');
      votingArea.classList.remove('voting-area-active');
      startScreen.classList.remove('hidden');
      state.mode = 'idle';
      playFinish();
      showCompletionOverlay();
    }, 700);
  }
}

function showVoteAnimation(name){
  const el = document.createElement('div');
  el.textContent = `Voted for ${name}`;
  el.style.position = 'fixed';
  el.style.left = '50%';
  el.style.top = '30%';
  el.style.transform = 'translateX(-50%)';
  el.style.background = 'linear-gradient(90deg,var(--accent),var(--accent-2))';
  el.style.color = 'white';
  el.style.padding = '12px 20px';
  el.style.borderRadius = '12px';
  el.style.boxShadow = '0 8px 30px rgba(11,127,163,0.16)';
  el.style.zIndex = '9999';
  el.style.opacity = '0';
  el.style.transition = 'opacity .28s, transform .36s';
  document.body.appendChild(el);
  requestAnimationFrame(()=>{
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(-8px)';
  });
  setTimeout(()=>{
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(-30px)';
    setTimeout(()=> el.remove(), 300);
  }, 1200);
}

function createQrPattern(){
  const size = 9;
  const cells = [];
  for(let row = 0; row < size; row += 1){
    for(let col = 0; col < size; col += 1){
      const isCorner = (row < 3 && col < 3) || (row < 3 && col > size - 4) || (row > size - 4 && col < 3);
      const isFilled = isCorner || ((row + col + (state.currentRoleIndex + 1)) % 3 === 0 && (row * col + 1) % 2 === 0);
      cells.push(`<div class="qr-cell${isFilled ? ' filled' : ''}"></div>`);
    }
  }
  return cells.join('');
}

function showCompletionOverlay(){
  const overlay = document.createElement('div');
  overlay.className = 'confirmation-overlay';
  overlay.innerHTML = `
    <div class="confirmation-card">
      <h2>Thank you for voting</h2>
      <p>${state.madrasaName}</p>
      <p>Your vote has been recorded successfully. This confirmation can be printed for the voter record.</p>
      <div class="qr-grid">${createQrPattern()}</div>
      <div class="print-actions">
        <button class="btn primary" id="printConfirmationBtn">Print Confirmation</button>
        <button class="btn" id="closeConfirmationBtn">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#printConfirmationBtn').addEventListener('click', ()=> printConfirmation(overlay));
  overlay.querySelector('#closeConfirmationBtn').addEventListener('click', ()=> overlay.remove());
}

function printConfirmation(overlay){
  const printWindow = window.open('', '_blank', 'width=800,height=900');
  const html = `<!doctype html><html><head><title>Voting Confirmation</title><style>body{font-family:Arial,sans-serif;padding:24px}h1{color:#0b7fa3} .qr-grid{display:grid;grid-template-columns:repeat(9,16px);gap:3px;margin:16px 0} .qr-cell{width:16px;height:16px;border-radius:2px;background:#e7eef4} .qr-cell.filled{background:#0b7fa3}</style></head><body><h1>${state.madrasaName}</h1><p>Voting completed successfully.</p><p>Thank you for participating in the election.</p><div class="qr-grid">${createQrPattern()}</div><p>Printed on ${new Date().toLocaleString()}</p></body></html>`;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  if(overlay){ overlay.remove(); }
}

function renderResults(){
  resultsList.innerHTML = '';
  startScreen.classList.add('hidden');
  state.roles.forEach((role, idx)=>{
    const card = document.createElement('div');
    card.className = 'card';
    card.style.margin = '8px 0';
    const title = document.createElement('h3');
    title.textContent = `${idx + 1}. ${role.name}`;
    card.appendChild(title);
    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.gap = '8px';
    list.style.flexWrap = 'wrap';
    role.candidates.forEach((candidate)=>{
      const item = document.createElement('div');
      item.className = 'candidate-card';
      const image = document.createElement('img');
      image.className = 'candidate-photo';
      image.src = candidate.photoDataUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="100%" height="100%" fill="%230b7fa3" /><text x="50%" y="50%" fill="white" font-size="18" text-anchor="middle" dominant-baseline="central">No Image</text></svg>';
      const info = document.createElement('div');
      info.className = 'candidate-info';
      const name = document.createElement('div');
      name.className = 'candidate-name';
      name.textContent = candidate.name;
      const votes = document.createElement('div');
      votes.className = 'candidate-votes';
      votes.textContent = `Votes: ${candidate.votes || 0}`;
      info.appendChild(name);
      info.appendChild(votes);
      item.appendChild(image);
      item.appendChild(info);
      list.appendChild(item);
    });
    card.appendChild(list);
    resultsList.appendChild(card);
  });
}

function exportToXlsx(){
  if(typeof window.XLSX === 'undefined'){ showToast('Excel export library failed to load.', 'error'); return; }
  const rows = [['Role', 'Candidate', 'Votes']];
  state.roles.forEach((role)=>{
    role.candidates.forEach((candidate)=>{
      rows.push([role.name, candidate.name, candidate.votes || 0]);
    });
  });
  const worksheet = window.XLSX.utils.aoa_to_sheet(rows);
  const workbook = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');
  window.XLSX.writeFile(workbook, 'madrasa-election-results.xlsx');
}

addRoleBtn.addEventListener('click', ()=>{
  const name = roleNameInput.value.trim();
  if(!name){ showToast('Role name required', 'warning'); return; }
  addRole(name);
  roleNameInput.value = '';
});

startElectionBtn.addEventListener('click', startElection);
bigStartBtn.addEventListener('click', startElection);

async function startElection(){
  if(state.roles.length === 0){ showToast('Add roles first in Admin panel', 'warning'); return; }
  if(!await requireTeacherAccess()){ return; }
  state.currentRoleIndex = 0;
  state.mode = 'voting';
  votingArea.classList.remove('hidden');
  votingArea.classList.add('voting-area-active');
  startScreen.classList.add('hidden');
  adminPanel.classList.add('hidden');
  resultsArea.classList.add('hidden');
  playStart();
  renderVotingRole();
  saveState();
}

viewResultsBtn.addEventListener('click', async ()=>{
  if(!await verifyAdminPrompt()){ return; }
  state.mode = 'results';
  votingArea.classList.add('hidden');
  votingArea.classList.remove('voting-area-active');
  adminPanel.classList.add('hidden');
  resultsArea.classList.remove('hidden');
  renderResults();
});
 
exportXlsxBtn.addEventListener('click', async ()=>{
  if(!await verifyAdminPrompt()){ return; }
  exportToXlsx();
});

resetElectionBtn.addEventListener('click', async ()=>{
  if(!await verifyAdminPrompt()){ return; }
  if(await showConfirmDialog('Reset EVERYTHING (roles, candidates, votes, and settings)?')){
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ADMIN_PASS_KEY);
    localStorage.removeItem(TEACHER_PIN_KEY);
    teacherAccessGranted = false;
    state = { madrasaName: 'MISBAHUL HUDHA MADRASA KAMBALAKKALLU', roles: [], currentRoleIndex: 0, mode: 'idle' };
    renderRolesList();
    votingArea.classList.add('hidden');
    votingArea.classList.remove('voting-area-active');
    resultsArea.classList.add('hidden');
    startScreen.classList.remove('hidden');
    adminPanel.classList.add('hidden');
    saveState();
  }
});

setAdminPassBtn.addEventListener('click', async ()=>{
  const first = adminPassInput.value.trim();
  const second = adminPassConfirmInput.value.trim();
  if(!first && !second){
    if(await showConfirmDialog('Remove admin password?')){ setAdminPassValue(''); adminPassInput.value=''; adminPassConfirmInput.value=''; teacherAccessGranted = false; sessionStorage.removeItem('teacher_access_granted'); }
    return;
  }
  if(first !== second){ showToast('Admin passwords do not match', 'error'); return; }
  setAdminPassValue(first);
  teacherAccessGranted = false;
  adminPassInput.value = '';
  adminPassConfirmInput.value = '';
});

clearAdminPassBtn.addEventListener('click', async ()=>{
  if(await showConfirmDialog('Remove admin password?')){ setAdminPassValue(''); adminPassInput.value=''; adminPassConfirmInput.value=''; teacherAccessGranted = false; sessionStorage.removeItem('teacher_access_granted'); }
});

setTeacherPinBtn.addEventListener('click', async ()=>{
  const first = teacherPinInput.value.trim();
  const second = teacherPinConfirmInput.value.trim();
  if(!first && !second){
    if(await showConfirmDialog('Remove teacher PIN?')){ setTeacherPinValue(''); teacherPinInput.value=''; teacherPinConfirmInput.value=''; teacherAccessGranted = false; sessionStorage.removeItem('teacher_access_granted'); }
    return;
  }
  if(!/^\d+$/.test(first) || !/^\d+$/.test(second)){ showToast('Teacher PIN must contain digits only', 'warning'); return; }
  if(first !== second){ showToast('Teacher PINs do not match', 'error'); return; }
  setTeacherPinValue(first);
  teacherAccessGranted = false;
  teacherPinInput.value = '';
  teacherPinConfirmInput.value = '';
});

clearTeacherPinBtn.addEventListener('click', async ()=>{
  if(await showConfirmDialog('Remove teacher PIN?')){ setTeacherPinValue(''); teacherPinInput.value=''; teacherPinConfirmInput.value=''; teacherAccessGranted = false; sessionStorage.removeItem('teacher_access_granted'); }
});

adminToggle.addEventListener('click', async ()=>{
  const pass = getAdminPass();
  if(pass){
    const attempt = await showPromptDialog('Enter admin password:', 'password', 'Password');
    if(attempt === null){ showToast('Admin access cancelled', 'warning'); return; }
    if(attempt === pass){ adminPanel.classList.toggle('hidden'); }
    else { showToast('Incorrect password', 'error'); }
  } else {
    adminPanel.classList.toggle('hidden');
    showToast('No admin password set. Set one to protect Admin and Results.', 'warning');
  }
});

loadState();
renderRolesList();

roleNameInput.addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ addRoleBtn.click(); } });
