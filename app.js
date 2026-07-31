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

function getAdminPass(){ return localStorage.getItem(ADMIN_PASS_KEY) || null; }
function setAdminPassValue(p){
  if(!p){ localStorage.removeItem(ADMIN_PASS_KEY); alert('Admin password removed'); }
  else { localStorage.setItem(ADMIN_PASS_KEY, p); alert('Admin password set'); }
}
function getTeacherPin(){ return localStorage.getItem(TEACHER_PIN_KEY) || null; }
function setTeacherPinValue(p){
  if(!p){ localStorage.removeItem(TEACHER_PIN_KEY); alert('Teacher PIN removed'); }
  else { localStorage.setItem(TEACHER_PIN_KEY, p); alert('Teacher PIN set'); }
}

function verifyAdminPrompt(){
  const pass = getAdminPass();
  if(!pass){ return true; }
  const attempt = prompt('Enter admin password:');
  if(attempt === pass){ return true; }
  alert('Incorrect password');
  return false;
}

function requireTeacherAccess(){
  const pin = getTeacherPin();
  if(pin){
    const attempt = prompt('Enter teacher PIN:');
    if(attempt !== pin){ alert('Incorrect teacher PIN'); return false; }
    return true;
  }
  const pass = getAdminPass();
  if(pass){
    const attempt = prompt('Enter admin password:');
    if(attempt !== pass){ alert('Incorrect admin password'); return false; }
    return true;
  }
  return true;
}

const adminToggle = document.getElementById('adminToggle');
const adminPanel = document.getElementById('adminPanel');
const addRoleBtn = document.getElementById('addRole');
const roleNameInput = document.getElementById('roleName');
const rolesList = document.getElementById('rolesList');
const startElectionBtn = document.getElementById('startElection');
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

let state = {
  madrasaName: 'MISBAHUL HUDHA MADRASA KAMBALAKKALLU',
  roles: [],
  currentRoleIndex: 0,
  mode: 'idle'
};

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){ state = JSON.parse(raw); }
  }catch(e){ console.error('Load state', e); }
}
function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid(prefix='id'){ return prefix + '_' + Math.random().toString(36).slice(2, 9); }

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
    const photoInput = document.createElement('input');
    photoInput.type = 'file';
    photoInput.accept = 'image/*';
    photoInput.className = 'candidatePhoto';
    const addBtn = document.createElement('button');
    addBtn.className = 'btn';
    addBtn.textContent = 'Add Candidate';
    addBtn.addEventListener('click', ()=>{
      const name = nameInput.value.trim();
      const file = photoInput.files[0];
      if(!name){ alert('Candidate name required'); return; }
      if(file){
        const reader = new FileReader();
        reader.onload = ()=>{
          addCandidate(role.id, name, reader.result);
          nameInput.value = '';
          photoInput.value = '';
          renderRolesList();
          saveState();
        };
        reader.readAsDataURL(file);
      }else{
        addCandidate(role.id, name, null);
        nameInput.value = '';
        renderRolesList();
        saveState();
      }
    });
    addRow.appendChild(nameInput);
    addRow.appendChild(photoInput);
    addRow.appendChild(addBtn);
    roleItem.appendChild(addRow);

    const removeRoleBtn = document.createElement('button');
    removeRoleBtn.className = 'btn danger';
    removeRoleBtn.textContent = 'Remove Role';
    removeRoleBtn.addEventListener('click', ()=>{
      if(confirm('Remove role and its candidates?')){ removeRole(role.id); }
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
  if(!role) return;
  role.candidates.push({ id: uid('cand'), name, photoDataUrl, votes: 0 });
  saveState();
}
function removeCandidate(roleId, candId){
  const role = state.roles.find((r)=> r.id === roleId);
  if(!role) return;
  role.candidates = role.candidates.filter((cand)=> cand.id !== candId);
  saveState();
  renderRolesList();
}

function renderVotingRole(){
  if(state.roles.length === 0){ alert('No roles defined. Please add them in Admin panel.'); return; }
  state.currentRoleIndex = Math.max(0, Math.min(state.currentRoleIndex, state.roles.length - 1));
  const role = state.roles[state.currentRoleIndex];
  votingRoleTitle.textContent = `Vote for: ${role.name}`;
  votingHint.textContent = 'Tap a candidate to cast your vote. The app will move to the next role automatically.';
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
  if(typeof window.XLSX === 'undefined'){ alert('Excel library was not loaded.'); return; }
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
  if(!name){ alert('Role name required'); return; }
  addRole(name);
  roleNameInput.value = '';
});

startElectionBtn.addEventListener('click', ()=>{
  if(state.roles.length === 0){ alert('Add roles first in Admin panel'); return; }
  if(!requireTeacherAccess()){ return; }
  state.currentRoleIndex = 0;
  state.mode = 'voting';
  votingArea.classList.remove('hidden');
  adminPanel.classList.add('hidden');
  resultsArea.classList.add('hidden');
  playStart();
  renderVotingRole();
  saveState();
});

viewResultsBtn.addEventListener('click', ()=>{
  if(!verifyAdminPrompt()){ return; }
  state.mode = 'results';
  votingArea.classList.add('hidden');
  adminPanel.classList.add('hidden');
  resultsArea.classList.remove('hidden');
  renderResults();
});

exportXlsxBtn.addEventListener('click', ()=>{
  if(!verifyAdminPrompt()){ return; }
  exportToXlsx();
});

resetElectionBtn.addEventListener('click', ()=>{
  if(!verifyAdminPrompt()){ return; }
  if(confirm('Reset EVERYTHING (roles, candidates, votes, and settings)?')){
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ADMIN_PASS_KEY);
    localStorage.removeItem(TEACHER_PIN_KEY);
    state = { madrasaName: 'MISBAHUL HUDHA MADRASA KAMBALAKKALLU', roles: [], currentRoleIndex: 0, mode: 'idle' };
    renderRolesList();
    votingArea.classList.add('hidden');
    resultsArea.classList.add('hidden');
    adminPanel.classList.add('hidden');
    saveState();
  }
});

setAdminPassBtn.addEventListener('click', ()=>{
  const first = adminPassInput.value.trim();
  const second = adminPassConfirmInput.value.trim();
  if(!first && !second){
    if(confirm('Remove admin password?')){ setAdminPassValue(''); adminPassInput.value=''; adminPassConfirmInput.value=''; }
    return;
  }
  if(first !== second){ alert('Admin passwords do not match'); return; }
  setAdminPassValue(first);
  adminPassInput.value = '';
  adminPassConfirmInput.value = '';
});

clearAdminPassBtn.addEventListener('click', ()=>{
  if(confirm('Remove admin password?')){ setAdminPassValue(''); adminPassInput.value=''; adminPassConfirmInput.value=''; }
});

setTeacherPinBtn.addEventListener('click', ()=>{
  const first = teacherPinInput.value.trim();
  const second = teacherPinConfirmInput.value.trim();
  if(!first && !second){
    if(confirm('Remove teacher PIN?')){ setTeacherPinValue(''); teacherPinInput.value=''; teacherPinConfirmInput.value=''; }
    return;
  }
  if(!/^\d+$/.test(first) || !/^\d+$/.test(second)){ alert('Teacher PIN must contain digits only'); return; }
  if(first !== second){ alert('Teacher PINs do not match'); return; }
  setTeacherPinValue(first);
  teacherPinInput.value = '';
  teacherPinConfirmInput.value = '';
});

clearTeacherPinBtn.addEventListener('click', ()=>{
  if(confirm('Remove teacher PIN?')){ setTeacherPinValue(''); teacherPinInput.value=''; teacherPinConfirmInput.value=''; }
});

adminToggle.addEventListener('click', ()=>{
  const pass = getAdminPass();
  if(pass){
    const attempt = prompt('Enter admin password:');
    if(attempt === pass){ adminPanel.classList.toggle('hidden'); }
    else { alert('Incorrect password'); }
  } else {
    adminPanel.classList.toggle('hidden');
    alert('No admin password set. Use the Admin Password box to protect Admin and Results.');
  }
});

loadState();
renderRolesList();

roleNameInput.addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ addRoleBtn.click(); } });
