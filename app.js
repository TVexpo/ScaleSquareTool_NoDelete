// ===== v1.4.8M (modular delete & export) + inline selection styling fix =====
const $ = (s, el = document) => el.querySelector(s);
const bgCanvas = $('#bgCanvas');
const overlay = $('#overlay');
const ctx = bgCanvas.getContext('2d');

const fileInput = $('#fileInput');
const calibrateBtn = $('#calibrateBtn');
const squareBtn = $('#squareBtn');
const rectBtn = $('#rectBtn');
const deleteBtn = $('#deleteBtn');
const exportBtn = $('#exportBtn');
const scaleInfo = $('#scaleInfo');
const themeToggle = $('#themeToggle');
const pdfControls = $('#pdfControls');
const prevPageBtn = $('#prevPage');
const nextPageBtn = $('#nextPage');
const pageNoLbl = $('#pageNo');
const pageCountLbl = $('#pageCount');
const hint = $('#hint');

let state = {
  mode: 'idle',
  bg: { img: null, pdf: null, pdfPage: 1, pdfCount: 1, vw: 1000, vh: 700, imgW:0, imgH:0 },
  meterPerPixel: null,
  squares: [], // {id, x, y, sizePx, selected}
  rects: [],   // {id, x, y, w, h, selected}
  active: null,
};

// ---- Sizing helpers ----
function fitCanvasToContainer(imgW, imgH){
  const stage = $('#stage');
  const rect = stage.getBoundingClientRect();
  const cw = rect.width, ch = rect.height;
  const aspect = imgW / imgH || 1;
  let drawW = cw, drawH = cw / aspect;
  if (drawH > ch) { drawH = ch; drawW = ch * aspect; }
  const left = (cw - drawW)/2;
  const top  = (ch - drawH)/2;

  bgCanvas.width = Math.max(1, Math.round(drawW));
  bgCanvas.height = Math.max(1, Math.round(drawH));
  Object.assign(bgCanvas.style, { width: bgCanvas.width+'px', height: bgCanvas.height+'px', left:left+'px', top:top+'px' });

  overlay.setAttribute('viewBox', `0 0 ${bgCanvas.width} ${bgCanvas.height}`);
  overlay.setAttribute('width', bgCanvas.width);
  overlay.setAttribute('height', bgCanvas.height);
  Object.assign(overlay.style, { width: bgCanvas.style.width, height: bgCanvas.style.height, left:bgCanvas.style.left, top:bgCanvas.style.top });

  state.bg.vw = bgCanvas.width;
  state.bg.vh = bgCanvas.height;
}

// ---- Background rendering ----
async function renderBackground(){
  const {img, pdf} = state.bg;
  if (img){
    fitCanvasToContainer(img.naturalWidth, img.naturalHeight);
    ctx.clearRect(0,0,bgCanvas.width,bgCanvas.height);
    ctx.drawImage(img, 0, 0, bgCanvas.width, bgCanvas.height);
    if (hint) hint.textContent = `已載入圖片：${img.naturalWidth}×${img.naturalHeight}`;
  } else if (pdf){
    const page = await pdf.getPage(state.bg.pdfPage);
    const viewport = page.getViewport({ scale: 1 });
    fitCanvasToContainer(viewport.width, viewport.height);
    const scaleX = bgCanvas.width / viewport.width;
    const scaleY = bgCanvas.height / viewport.height;
    const renderViewport = page.getViewport({ scale: Math.min(scaleX, scaleY) });
    await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;
    if (hint) hint.textContent = `已載入 PDF：第 ${state.bg.pdfPage}/${state.bg.pdfCount} 頁`;
  }
  redrawOverlay();
}

function clearOverlay(){
  while (overlay.firstChild) overlay.removeChild(overlay.firstChild);
}

// --- Units ---
function parseLengthToMeters(input){
  const s = String(input).trim().toLowerCase();
  const m = s.match(/^([0-9]*\.?[0-9]+)\s*(m|cm|mm)?$/i);
  if (!m) return null;
  const val = parseFloat(m[1]);
  const unit = (m[2] || 'm').toLowerCase();
  if (unit === 'm') return val;
  if (unit === 'cm') return val / 100;
  if (unit === 'mm') return val / 1000;
  return null;
}
function metersToBest(m){
  if (m >= 1) return `${(m).toFixed(3).replace(/\.?0+$/,'')} m`;
  if (m >= 0.01) return `${(m*100).toFixed(2).replace(/\.?0+$/,'')} cm`;
  return `${(m*1000).toFixed(1).replace(/\.?0+$/,'')} mm`;
}

// --- Inline selection styling (avoid CSS specificity issues) ---
function applySelectedStyle(node, selected){
  const normalStroke = '#6ea8fe';                // 未選取：藍邊
  const normalFill   = 'rgba(102,163,255,0.12)'; // 未選取：淡藍底
  const pinkStroke   = '#ff4fa3';                // 選取：粉紅邊
  const pinkFill     = 'rgba(255,79,163,.18)';   // 選取：淡粉底
  node.setAttribute('stroke', selected ? pinkStroke : normalStroke);
  node.setAttribute('fill',   selected ? pinkFill   : normalFill);
  node.setAttribute('stroke-width', '2');
}

// --- Overlay drawing ---
function redrawOverlay(){
  clearOverlay();

  // live drafts
  if (state.active?.type === 'calLine'){
    const {sx, sy, cx, cy} = state.active;
    overlay.appendChild(svg('line', {x1:sx, y1:sy, x2:cx, y2:cy, class:'line-guide'}));
    const pxLen = Math.hypot(cx - sx, cy - sy);
    const txt = svg('text', {class:'dim', x:(sx+cx)/2, y:(sy+cy)/2 - 8, 'text-anchor':'middle'});
    txt.textContent = state.meterPerPixel ? metersToBest(pxLen * state.meterPerPixel) : `${pxLen.toFixed(1)} px`;
    overlay.appendChild(txt);
  }
  if (state.active?.type === 'squareDraft'){
    const {sx, sy, cx, cy} = state.active;
    const size = Math.max(Math.abs(cx - sx), Math.abs(cy - sy));
    const x = (cx >= sx) ? sx : sx - size;
    const y = (cy >= sy) ? sy : sy - size;
    overlay.appendChild(svg('rect', {x, y, width:size, height:size, rx:8, ry:8, class:'square'}));
  }
  if (state.active?.type === 'rectDraft'){
    const {sx, sy, cx, cy} = state.active;
    const w = Math.abs(cx - sx);
    const h = Math.abs(cy - sy);
    const x = (cx >= sx) ? sx : sx - w;
    const y = (cy >= sy) ? sy : sy - h;
    overlay.appendChild(svg('rect', {x, y, width:w, height:h, rx:8, ry:8, class:'rect'}));
  }

  // squares
  for (const sq of state.squares){
    const g = svg('g', {'data-id':sq.id});
    const rect = svg('rect', {x:sq.x, y:sq.y, width:sq.sizePx, height:sq.sizePx, rx:8, ry:8, class:'square'});
    rect.dataset.selected = String(!!sq.selected);
    applySelectedStyle(rect, !!sq.selected); // ⟵ inline style to reflect selection
    g.appendChild(rect);
    const meters = state.meterPerPixel ? sq.sizePx * state.meterPerPixel : null;
    const label = svg('text', {class:'dim', x:sq.x + sq.sizePx/2, y:sq.y - 6, 'text-anchor':'middle'});
    label.textContent = meters ? `邊長：${metersToBest(meters)}` : `邊長：${sq.sizePx.toFixed(0)} px`;
    g.appendChild(label);
    // handles
    const corner = svg('circle', {cx:sq.x + sq.sizePx, cy:sq.y + sq.sizePx, r:6, class:'handle'});
    corner.dataset.kind='corner'; corner.dataset.id=sq.id; g.appendChild(corner);
    const mover = svg('circle', {cx:sq.x + sq.sizePx/2, cy:sq.y + sq.sizePx/2, r:5, class:'handle center'});
    if (sq.selected){ mover.setAttribute('r', 7); mover.dataset.selected='true'; }
    mover.dataset.kind='move'; mover.dataset.id=sq.id; g.appendChild(mover);
    overlay.appendChild(g);
  }

  // rects
  for (const rc of state.rects){
    const g = svg('g', {'data-id':rc.id});
    const rect = svg('rect', {x:rc.x, y:rc.y, width:rc.w, height:rc.h, rx:8, ry:8, class:'rect'});
    rect.dataset.selected = String(!!rc.selected);
    applySelectedStyle(rect, !!rc.selected); // ⟵ inline style to reflect selection
    g.appendChild(rect);
    // label
    const label = svg('text', {class:'dim', x: rc.x + rc.w/2, y: rc.y - 6, 'text-anchor':'middle'});
    if (state.meterPerPixel){
      const wM = rc.w * state.meterPerPixel; const hM = rc.h * state.meterPerPixel;
      label.textContent = `尺寸：${metersToBest(wM)} × ${metersToBest(hM)}`;
    }else{
      label.textContent = `尺寸：${rc.w.toFixed(0)} × ${rc.h.toFixed(0)} px`;
    }
    g.appendChild(label);
    // handles: move + corner + side handles
    const corner = svg('circle', {cx: rc.x + rc.w, cy: rc.y + rc.h, r:6, class:'handle'});
    corner.dataset.kind='rcorner'; corner.dataset.id=rc.id; g.appendChild(corner);
    const mover = svg('circle', {cx: rc.x + rc.w/2, cy: rc.y + rc.h/2, r:5, class:'handle center'});
    if (rc.selected){ mover.setAttribute('r', 7); mover.dataset.selected='true'; }
    mover.dataset.kind='rmove'; mover.dataset.id=rc.id; g.appendChild(mover);
    const hRight = svg('circle', {cx: rc.x + rc.w, cy: rc.y + rc.h/2, r:5, class:'handle'});
    hRight.dataset.kind='rwidth'; hRight.dataset.id=rc.id; g.appendChild(hRight);
    const hBottom = svg('circle', {cx: rc.x + rc.w/2, cy: rc.y + rc.h, r:5, class:'handle'});
    hBottom.dataset.kind='rheight'; hBottom.dataset.id=rc.id; g.appendChild(hBottom);

    overlay.appendChild(g);
  }
}

// --- Modes & hint ---
function setMode(m){
  state.mode = m;
  // Keep overlay live even in idle for reselection
  if (['calibrate','square','rect','select','idle'].includes(m)) overlay.style.pointerEvents = 'auto';
  else overlay.style.pointerEvents = 'none';

  calibrateBtn.classList.toggle('active', m==='calibrate');
  squareBtn.classList.toggle('active', m==='square');
  rectBtn.classList.toggle('active', m==='rect');

  const msg = {
    idle: '提示：匯入底圖後，可用「校正比例尺」或直接建立方/長方形。',
    calibrate: '請在圖上拖曳一段「已知真實長度」的線段，放開後輸入真實長度（如 1m / 200cm）。',
    square: '在圖上按住拖曳建立 1:1 正方形（拖曳時會有預覽）。',
    rect: '在圖上按住拖曳建立長方形（拖曳時會有預覽）。',
    select: '點選圖形可選取；中心點拖曳移動，右下角自由縮放，右/下中點單獨調寬/高。'
  }[m] || '';
  if (hint) hint.textContent = msg;
}

// --- Event helpers ---
function relPos(evt){
  const rect = bgCanvas.getBoundingClientRect();
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;
  return { x: Math.max(0, Math.min(rect.width, x)), y: Math.max(0, Math.min(rect.height, y)) };
}

// --- Pointer handlers ---
function onPointerDown(evt){
  if (!(evt.target instanceof Element)) return;
  const pos = relPos(evt);

  // 1) Always prioritize existing handles (selection/manipulation), regardless of tool mode
  const handle = evt.target.closest('.handle');
  if (handle){
    const id = handle.dataset.id;
    const kind = handle.dataset.kind;

    // squares
    const sq = state.squares.find(s => s.id === id);
    if (sq){
      state.squares.forEach(s => s.selected = (s.id===id));
      state.rects.forEach(r => r.selected = false);
      if (kind === 'move'){
        state.active = { type:'maybeMoveSq', id, ox: pos.x - sq.x, oy: pos.y - sq.y, sx: pos.x, sy: pos.y };
      } else if (kind === 'corner'){
        state.active = { type:'resize', id };
      }
      redrawOverlay();
      return;
    }

    // rects
    const rc = state.rects.find(r => r.id === id);
    if (rc){
      state.rects.forEach(r => r.selected = (r.id===id));
      state.squares.forEach(s => s.selected = false);
      if (kind === 'rmove'){
        state.active = { type:'maybeMoveRect', id, ox: pos.x - rc.x, oy: pos.y - rc.y, sx: pos.x, sy: pos.y };
      } else if (kind === 'rcorner'){
        state.active = { type:'resizeRect', id };
      } else if (kind === 'rwidth'){
        state.active = { type:'resizeRectW', id };
      } else if (kind === 'rheight'){
        state.active = { type:'resizeRectH', id };
      }
      redrawOverlay();
      return;
    }
  }

  // 2) If clicking on shape bodies, select them (even in draw modes)
  const nodeSq = evt.target.closest('.square');
  const nodeRc = evt.target.closest('.rect');
  if (nodeSq){
    const id = nodeSq.parentNode.getAttribute('data-id');
    state.squares.forEach(s => s.selected = (s.id===id));
    state.rects.forEach(r => r.selected = false);
    state.active = { type:'selecting' };
    redrawOverlay();
    return;
  } else if (nodeRc){
    const id = nodeRc.parentNode.getAttribute('data-id');
    state.rects.forEach(r => r.selected = (r.id===id));
    state.squares.forEach(s => s.selected = false);
    state.active = { type:'selecting' };
    redrawOverlay();
    return;
  }

  // 3) No hit on existing shapes -> apply tool modes
  if (state.mode === 'calibrate'){
    state.active = { type:'calLine', sx: pos.x, sy: pos.y, cx: pos.x, cy: pos.y };
    redrawOverlay();
    return;
  }
  if (state.mode === 'square'){
    state.active = { type:'squareDraft', sx: pos.x, sy: pos.y, cx: pos.x, cy: pos.y };
    redrawOverlay();
    return;
  }
  if (state.mode === 'rect'){
    state.active = { type:'rectDraft', sx: pos.x, sy: pos.y, cx: pos.x, cy: pos.y };
    redrawOverlay();
    return;
  }

  // 4) Idle click on empty area -> clear selection
  state.squares.forEach(s => s.selected = false);
  state.rects.forEach(r => r.selected = false);
  redrawOverlay();
}

function onPointerMove(evt){
  const pos = relPos(evt);
  if (!state.active) return;

  if (state.active.type === 'calLine'){
    state.active.cx = pos.x; state.active.cy = pos.y;
  } else if (state.active.type === 'squareDraft'){
    state.active.cx = pos.x; state.active.cy = pos.y;
  } else if (state.active.type === 'rectDraft'){
    state.active.cx = pos.x; state.active.cy = pos.y;
  } else if (state.active.type === 'maybeMoveSq'){
    const dx = pos.x - state.active.sx, dy = pos.y - state.active.sy;
    if (Math.hypot(dx,dy) > 3){ state.active.type = 'move'; }
  } else if (state.active.type === 'move'){
    const sq = state.squares.find(s => s.id === state.active.id);
    if (sq){ sq.x = pos.x - state.active.ox; sq.y = pos.y - state.active.oy; }
  } else if (state.active.type === 'resize'){
    const sq = state.squares.find(s => s.id === state.active.id);
    if (sq){
      const size = Math.max(6, Math.max(pos.x - sq.x, pos.y - sq.y));
      sq.sizePx = size;
    }
  } else if (state.active.type === 'maybeMoveRect'){
    const dx = pos.x - state.active.sx, dy = pos.y - state.active.sy;
    if (Math.hypot(dx,dy) > 3){ state.active.type = 'moveRect'; }
  } else if (state.active.type === 'moveRect'){
    const rc = state.rects.find(r => r.id === state.active.id);
    if (rc){ rc.x = pos.x - state.active.ox; rc.y = pos.y - state.active.oy; }
  } else if (state.active.type === 'resizeRect'){
    const rc = state.rects.find(r => r.id === state.active.id);
    if (rc){ rc.w = Math.max(6, pos.x - rc.x); rc.h = Math.max(6, pos.y - rc.y); }
  } else if (state.active.type === 'resizeRectW'){
    const rc = state.rects.find(r => r.id === state.active.id);
    if (rc){ rc.w = Math.max(6, pos.x - rc.x); }
  } else if (state.active.type === 'resizeRectH'){
    const rc = state.rects.find(r => r.id === state.active.id);
    if (rc){ rc.h = Math.max(6, pos.y - rc.y); }
  }
  redrawOverlay();
}

function onPointerUp(evt){
  const pos = relPos(evt);
  if (state.active?.type === 'calLine'){
    const {sx, sy, cx, cy} = state.active;
    const pxLen = Math.hypot(cx - sx, cy - sy);
    state.active = null;
    if (pxLen < 3){
      setMode('idle'); redrawOverlay(); return;
    }
    const input = prompt('請輸入該線段的真實長度（例如：1m、100cm 或 1000mm）：','1m');
    if (input){
      const meters = parseLengthToMeters(input);
      if (meters && meters > 0){
        state.meterPerPixel = meters / pxLen;
        scaleInfo.textContent = `比例尺：1 px = ${metersToBest(state.meterPerPixel)}（${(1/state.meterPerPixel).toFixed(2)} px/m）`;
      } else {
        alert('格式不正確，請輸入數值與單位（m / cm / mm）。');
      }
    }
    setMode('idle');
  } else if (state.active?.type === 'squareDraft'){
    let dx = pos.x - state.active.sx;
    let dy = pos.y - state.active.sy;
    const size = Math.max(6, Math.max(Math.abs(dx), Math.abs(dy)));
    const x = dx >= 0 ? state.active.sx : state.active.sx - size;
    const y = dy >= 0 ? state.active.sy : state.active.sy - size;
    const id = 'sq_' + Math.random().toString(36).slice(2,8);
    state.squares.forEach(s => s.selected=false);
    state.rects.forEach(r => r.selected=false);
    state.squares.push({ id, x, y, sizePx: size, selected: true });
    state.active = null;
    setMode('select');
  } else if (state.active?.type === 'rectDraft'){
    let dx = pos.x - state.active.sx;
    let dy = pos.y - state.active.sy;
    const w = Math.max(6, Math.abs(dx));
    const h = Math.max(6, Math.abs(dy));
    const x = dx >= 0 ? state.active.sx : state.active.sx - w;
    const y = dy >= 0 ? state.active.sy : state.active.sy - h;
    const id = 'rc_' + Math.random().toString(36).slice(2,8);
    state.squares.forEach(s => s.selected=false);
    state.rects.forEach(r => r.selected=false);
    state.rects.push({ id, x, y, w, h, selected: true });
    state.active = null;
    setMode('select');
  } else {
    state.active = null;
  }
  redrawOverlay();
}

// --- File I/O (v1.3.1-style for images) ---
fileInput.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const type = (f.type || '').toLowerCase();
  if (type.includes('pdf') || (f.name && f.name.toLowerCase().endsWith('.pdf'))){
    try{
      const arr = await f.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arr }).promise;
      state.bg.pdf = pdf;
      state.bg.img = null;
      state.bg.pdfPage = 1;
      state.bg.pdfCount = pdf.numPages;
      if (pageNoLbl) pageNoLbl.textContent = '1';
      if (pageCountLbl) pageCountLbl.textContent = String(pdf.numPages);
      if (pdfControls) pdfControls.hidden = false;
      await renderBackground();
      setMode('idle');
    }catch(err){
      console.error(err);
      alert('PDF 載入失敗：' + err.message);
    }
  } else if (type.startsWith('image/')){
    if (pdfControls) pdfControls.hidden = true;
    state.bg.pdf = null;
    const img = new Image();
    img.onload = async () => {
      state.bg.img = img;
      await renderBackground();
      setMode('idle');
    };
    img.src = URL.createObjectURL(f);
  } else {
    alert('不支援的檔案格式，請選擇 PNG、JPG 或 PDF。');
  }
});

if (prevPageBtn) prevPageBtn.addEventListener('click', async () => {
  if (!state.bg.pdf) return;
  if (state.bg.pdfPage > 1){
    state.bg.pdfPage--;
    pageNoLbl.textContent = String(state.bg.pdfPage);
    await renderBackground();
  }
});
if (nextPageBtn) nextPageBtn.addEventListener('click', async () => {
  if (!state.bg.pdf) return;
  if (state.bg.pdfPage < state.bg.pdfCount){
    state.bg.pdfPage++;
    pageNoLbl.textContent = String(state.bg.pdfPage);
    await renderBackground();
  }
});

// --- Mode buttons ---
calibrateBtn.addEventListener('click', () => setMode(state.mode==='calibrate' ? 'idle':'calibrate'));
squareBtn.addEventListener('click', () => setMode(state.mode==='square' ? 'idle':'square'));
rectBtn.addEventListener('click', () => setMode(state.mode==='rect' ? 'idle':'rect'));

// --- Theme toggle ---
themeToggle.addEventListener('change', (e) => {
  const body = document.body;
  if (e.target.checked){
    body.classList.remove('theme-light');
    body.classList.add('theme-dark');
  } else {
    body.classList.remove('theme-dark');
    body.classList.add('theme-light');
  }
});

// --- Pointer events on overlay ---
['pointerdown','mousedown'].forEach(ev => overlay.addEventListener(ev, onPointerDown));
['pointermove','mousemove'].forEach(ev => overlay.addEventListener(ev, onPointerMove));
['pointerup','mouseup','mouseleave'].forEach(ev => overlay.addEventListener(ev, onPointerUp));

// Prevent text selection during drag
document.addEventListener('dragstart', e => e.preventDefault());

// Initial message
setMode('idle');

// Re-render on window resize
window.addEventListener('resize', () => {
  if (state.bg.img){
    fitCanvasToContainer(state.bg.img.naturalWidth, state.bg.img.naturalHeight);
    ctx.drawImage(state.bg.img, 0, 0, bgCanvas.width, bgCanvas.height);
    redrawOverlay();
  } else if (state.bg.pdf){
    renderBackground();
  }
});

function svg(tag, attrs){
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

// ===== Modules wiring (independent of globals) =====
const Deletion = CreateDeleteModule({
  getSquares: () => state.squares,
  getRects: () => state.rects,
  setSquares: (arr) => { state.squares = arr; redrawOverlay(); },
  setRects: (arr) => { state.rects = arr; redrawOverlay(); },
  isSelected: (shape) => !!shape.selected,
  onAfterDelete: ({deletedCount}) => {
    if (hint) {
      const prev = hint.textContent;
      hint.textContent = deletedCount ? `已刪除 ${deletedCount} 個形狀` : '沒有選取任何形狀';
      setTimeout(()=>{ hint.textContent = prev; }, 1200);
    }
  },
});
Deletion.bindUI({ deleteBtn: document.getElementById('deleteBtn'), win: window });

const Exporter = CreateExportModule({
  getBgCanvas: () => document.getElementById('bgCanvas'),
  getOverlaySvg: () => document.getElementById('overlay'),
  getTheme: () => document.body.classList.contains('theme-dark') ? 'dark' : 'light',
  getOutlineColor: () => {
    const cs = getComputedStyle(document.body);
    const v = cs.getPropertyValue('--outline').trim();
    return v || (document.body.classList.contains('theme-dark') ? '#2b3140' : '#dfe3eb');
  },
});
Exporter.bindUI({ exportBtn: document.getElementById('exportBtn'), filename: 'export.png' });
