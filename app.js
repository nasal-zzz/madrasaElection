/*
  Simple device-local election app.
  - Stores all data in localStorage under key 'madrasa_election'
  - Admin panel: add roles, add candidates (with photo upload)
  - Voting: shows one role at a time, voters can vote for a candidate; after voting move to next role
  - Results: shows votes per candidate and export/reset options
*/

const STORAGE_KEY = 'madrasa_election_v1';

// Elements
const adminToggle = document.getElementById('adminToggle');
const adminPanel = document.getElementById('adminPanel');
const addRoleBtn = document.getElementById('addRole');
const roleNameInput = document.getElementById('roleName');
const rolesList = document.getElementById('rolesList');
const startElectionBtn = document.getElementById('startElection');
const votingArea = document.getElementById('votingArea');
const votingRoleTitle = document.getElementById('votingRoleTitle');
const candidatesGrid = document.getElementById('candidatesGrid');
const prevRoleBtn = document.getElementById('prevRole');
const nextRoleBtn = document.getElementById('nextRole');
const viewResultsBtn = document.getElementById('viewResults');
const resultsArea = document.getElementById('resultsArea');
const resultsList = document.getElementById('resultsList');
const exportJsonBtn = document.getElementById('exportJson');
const resetElectionBtn = document.getElementById('resetElection');

const roleTemplate = document.getElementById('roleTemplate');
const candidateCardTemplate = document.getElementById('candidateCardTemplate');

let state = {
  madrasaName: "MISBAHUL HUDHA MADRASA KAMBALAKKALLU",
  roles: [], // { id, name, candidates: [{id,name,photoDataUrl,votes}], order }
  currentRoleIndex: 0,
  mode: 'idle' // 'voting' or 'idle' or 'results'
};

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){ state = JSON.parse(raw); }
  }catch(e){ console.error('Load state',e) }
}
function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid(prefix='id'){
  return prefix + '_' + Math.random().toString(36).slice(2,9);
}

// Admin: render roles and candidate forms
function renderRolesList(){
  rolesList.innerHTML = '';
  state.roles.forEach((role, idx) =>{
    const tpl = roleTemplate.content.cloneNode(true);
    const roleItem = tpl.querySelector('.role-item');
    roleItem.querySelector('.role-title').textContent = (idx+1)+'. '+role.name;
    const candidatesContainer = roleItem.querySelector('.candidates-for-role');

    role.candidates.forEach(c =>{
      const card = document.createElement('div');
      card.className = 'candidate-card';
      card.innerHTML = `
        <img class="candidate-photo" src="${c.photoDataUrl || 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'120\' height=\'120\'><rect width=\'100%\' height=\'100%\' fill=\'%230b7fa3\' /><text x=\'50%\' y=\'50%\' fill=\'white\' font-size=\'18\' text-anchor=\'middle\' dominant-baseline=\'central\'>No Image</text></svg>'}" />
        <div style="flex:1">
          <div style="font-weight:600">${c.name}</div>
          <div style="color:#6b7280">Votes: ${c.votes || 0}</div>
        </div>
        <button class="btn" data-role="${role.id}" data-cid="${c.id}">Remove</button>
      `;
      candidatesContainer.appendChild(card);
      card.querySelector('button').addEventListener('click', (e)=>{
        const rid = e.target.dataset.role; const cid = e.target.dataset.cid;
        removeCandidate(rid,cid);
      });
    });

    // wire add candidate inside this cloned template
    const nameInput = roleItem.querySelector('.candidateName');
    const photoInput = roleItem.querySelector('.candidatePhoto');
    const addCandBtn = roleItem.querySelector('.addCandidate');
    addCandBtn.addEventListener('click', ()=>{
      const name = nameInput.value.trim();
      const file = photoInput.files[0];
      if(!name){ alert('Candidate name required'); return; }
      if(file){
        const reader = new FileReader();
        reader.onload = () => { addCandidate(role.id, name, reader.result); nameInput.value=''; photoInput.value=''; renderRolesList(); saveState(); };
        reader.readAsDataURL(file);
      }else{
        addCandidate(role.id, name, null); nameInput.value=''; renderRolesList(); saveState();
      }
    });

    // remove role button
    const title = roleItem.querySelector('.role-title');
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn danger';
    removeBtn.textContent = 'Remove Role';
    removeBtn.addEventListener('click', ()=>{ if(confirm('Remove role and its candidates?')){ removeRole(role.id); } });
    roleItem.appendChild(removeBtn);

    rolesList.appendChild(roleItem);
  });
}

function addRole(name){
  const r = { id: uid('role'), name, candidates: [], order: state.roles.length };
  state.roles.push(r);
  saveState();
  renderRolesList();
}
function removeRole(roleId){ state.roles = state.roles.filter(r=>r.id!==roleId); saveState(); renderRolesList(); }
function addCandidate(roleId, name, photoDataUrl){
  const role = state.roles.find(r=>r.id===roleId); if(!role) return;
  role.candidates.push({ id: uid('cand'), name, photoDataUrl, votes: 0 });
  saveState();
}
function removeCandidate(roleId, candId){
  const role = state.roles.find(r=>r.id===roleId); if(!role) return;
  role.candidates = role.candidates.filter(c=>c.id!==candId);
  saveState(); renderRolesList();
}

// Voting UI
function renderVotingRole(){
  if(state.roles.length===0){ alert('No roles defined. Please add them in Admin panel.'); return; }
  state.currentRoleIndex = Math.max(0, Math.min(state.currentRoleIndex, state.roles.length-1));
  const role = state.roles[state.currentRoleIndex];
  votingRoleTitle.textContent = `Vote for: ${role.name}`;
  candidatesGrid.innerHTML = '';
  role.candidates.forEach(c=>{
    const tpl = candidateCardTemplate.content.cloneNode(true);
    tpl.querySelector('.candidate-photo').src = c.photoDataUrl || 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'120\' height=\'120\'><rect width=\'100%\' height=\'100%\' fill=\'%230b7fa3\' /><text x=\'50%\' y=\'50%\' fill=\'white\' font-size=\'18\' text-anchor=\'middle\' dominant-baseline=\'central\'>No Image</text></svg>';
    tpl.querySelector('.candidate-name').textContent = c.name;
    tpl.querySelector('.candidate-votes').textContent = `Votes: ${c.votes || 0}`;
    const voteBtn = tpl.querySelector('.vote-btn');
    voteBtn.addEventListener('click', ()=>{ castVote(role.id, c.id); });
    candidatesGrid.appendChild(tpl);
  });
}

function castVote(roleId, candId){
  const role = state.roles.find(r=>r.id===roleId); if(!role) return;
  const cand = role.candidates.find(c=>c.id===candId); if(!cand) return;
  cand.votes = (cand.votes || 0) + 1;
  saveState();
  // after vote, show a brief animation and move to next role automatically
  showVoteAnimation(cand.name);
  // refresh candidate counts
  renderVotingRole();
  // auto-advance after short delay
  setTimeout(()=>{
    if(state.currentRoleIndex < state.roles.length - 1){ state.currentRoleIndex++; renderVotingRole(); } else { alert('All roles done. You can view results.'); }
  }, 900);
}

function showVoteAnimation(name){
  const el = document.createElement('div');
  el.textContent = `Voted for ${name}`;
  el.style.position='fixed'; el.style.left='50%'; el.style.top='30%'; el.style.transform='translateX(-50%)'; el.style.background='linear-gradient(90deg,var(--accent),var(--accent-2))'; el.style.color='white'; el.style.padding='12px 20px'; el.style.borderRadius='12px'; el.style.boxShadow='0 8px 30px rgba(11,127,163,0.16)'; el.style.zIndex=9999; el.style.opacity=0; el.style.transition='opacity .28s, transform .36s';
  document.body.appendChild(el);
  requestAnimationFrame(()=>{ el.style.opacity=1; el.style.transform='translateX(-50%) translateY(-8px)'; });
  setTimeout(()=>{ el.style.opacity=0; el.style.transform='translateX(-50%) translateY(-30px)'; setTimeout(()=>el.remove(),300); },1200);
}

// Results
function renderResults(){
  resultsList.innerHTML = '';
  state.roles.forEach((r, idx)=>{
    const card = document.createElement('div'); card.className='card';
    card.style.margin='8px 0';
    const title = document.createElement('h3'); title.textContent = (idx+1)+'. '+r.name;
    card.appendChild(title);
    const list = document.createElement('div'); list.style.display='flex'; list.style.gap='8px'; list.style.flexWrap='wrap';
    r.candidates.forEach(c=>{
      const item = document.createElement('div'); item.className='candidate-card';
      item.innerHTML = `<img class='candidate-photo' src='${c.photoDataUrl || ''}'/><div style='flex:1'><div style='font-weight:600'>${c.name}</div><div style='color:#6b7280'>Votes: ${c.votes||0}</div></div>`;
      list.appendChild(item);
    });
    card.appendChild(list);
    resultsList.appendChild(card);
  });
}

// UI wiring
adminToggle.addEventListener('click', ()=>{ adminPanel.classList.toggle('hidden'); });
addRoleBtn.addEventListener('click', ()=>{ const name = roleNameInput.value.trim(); if(!name){ alert('Role name required'); return; } addRole(name); roleNameInput.value=''; });
startElectionBtn.addEventListener('click', ()=>{ if(state.roles.length===0){ alert('Add roles first in Admin panel'); return; } state.mode='voting'; votingArea.classList.remove('hidden'); adminPanel.classList.add('hidden'); resultsArea.classList.add('hidden'); renderVotingRole(); saveState(); });
prevRoleBtn.addEventListener('click', ()=>{ if(state.currentRoleIndex>0){ state.currentRoleIndex--; renderVotingRole(); } });
nextRoleBtn.addEventListener('click', ()=>{ if(state.currentRoleIndex < state.roles.length -1){ state.currentRoleIndex++; renderVotingRole(); } else { alert('End of roles'); } });
viewResultsBtn.addEventListener('click', ()=>{ state.mode='results'; votingArea.classList.add('hidden'); adminPanel.classList.add('hidden'); resultsArea.classList.remove('hidden'); renderResults(); });
exportJsonBtn.addEventListener('click', ()=>{ const data = JSON.stringify(state,null,2); const blob = new Blob([data],{type:'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'madrasa-election-results.json'; a.click(); URL.revokeObjectURL(url); });
resetElectionBtn.addEventListener('click', ()=>{ if(confirm('Reset EVERYTHING (roles, candidates, votes)?')){ localStorage.removeItem(STORAGE_KEY); state = { madrasaName: state.madrasaName, roles: [], currentRoleIndex:0, mode:'idle' }; renderRolesList(); votingArea.classList.add('hidden'); resultsArea.classList.add('hidden'); saveState(); } });

// initialization
loadState(); renderRolesList();
// If roles exist, keep admin hidden but show count
if(state.roles.length>0){ /* nothing */ }

// Make sure assets folder exists for logo instructions (not creating binary logo here)
(function ensureAssets(){
  // nothing — just note in console
  console.log('Place logo image at assets/logo.png to show school logo');
})();

// small UI polish: keyboard Enter to add role
roleNameInput && roleNameInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ addRoleBtn.click(); } });

// End of file
