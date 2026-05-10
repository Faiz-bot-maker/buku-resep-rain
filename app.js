// ===== Greeting =====
function setGreeting() {
  const hour = new Date().getHours();
  let greet;
  if      (hour >= 4  && hour < 11) greet = '🌅 Selamat Pagi, Princess!';
  else if (hour >= 11 && hour < 15) greet = '☀️ Selamat Siang, Princess!';
  else if (hour >= 15 && hour < 18) greet = '🌤️ Selamat Sore, Princess!';
  else                               greet = '🌙 Selamat Malam, Princess!';
  const el = document.getElementById('headerGreeting');
  if (el) el.textContent = greet;
}

// ===== Google Sheets API =====
const API_URL = 'https://script.google.com/macros/s/AKfycbwj8MMHHNiEUzUB4QuSwPjPwKiOQAiGMxVBqi6jC10CLgNCirKIXKWozOchDKvjXZHZ_Q/exec';

async function dbGetAll() {
  const res  = await fetch(`${API_URL}?action=getAll`, { redirect: 'follow' });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = []; }
  if (data && data.error) throw new Error(data.error);
  return Array.isArray(data) ? data : [];
}

async function dbSave(recipe) {
  const res = await fetch(API_URL, {
    method:   'POST',
    redirect: 'follow',
    body:     JSON.stringify({ action: 'save', data: recipe }),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = {}; }
  if (data.error) throw new Error(data.error);
  return data;
}

async function dbDelete(id) {
  const res = await fetch(API_URL, {
    method:   'POST',
    redirect: 'follow',
    body:     JSON.stringify({ action: 'delete', id }),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = {}; }
  if (data.error) throw new Error(data.error);
  return data;
}

// ===== Category → emoji & thumb =====
const CAT_MAP = {
  'kue kering': { emoji: '🍪', thumb: 'thumb-kering'  },
  'kue basah':  { emoji: '🍮', thumb: 'thumb-basah'   },
  'cake':       { emoji: '🎂', thumb: 'thumb-cake'    },
  'cookies':    { emoji: '🍩', thumb: 'thumb-cookies' },
  'roti':       { emoji: '🍞', thumb: 'thumb-roti'    },
  'pudding':    { emoji: '🍮', thumb: 'thumb-basah'   },
  'tart':       { emoji: '🥧', thumb: 'thumb-cake'    },
  'donat':      { emoji: '🍩', thumb: 'thumb-cookies' },
};
function getCatInfo(category = '') {
  return CAT_MAP[category.toLowerCase()] || { emoji: '🍰', thumb: 'thumb-default' };
}

// ===== State =====
let recipes = [];

// ===== DOM =====
const recipeGrid        = document.getElementById('recipeGrid');
const emptyState        = document.getElementById('emptyState');
const searchInput       = document.getElementById('searchInput');
const statTotal         = document.getElementById('statTotal');
const statCatChip       = document.getElementById('statCatChip');
const statCat           = document.getElementById('statCat');

const modalOverlay      = document.getElementById('modalOverlay');
const modalTitle        = document.getElementById('modalTitle');
const modalIcon         = document.getElementById('modalIcon');
const recipeForm        = document.getElementById('recipeForm');
const recipeIdInput     = document.getElementById('recipeId');
const recipeNameInput   = document.getElementById('recipeName');
const recipeCatInput    = document.getElementById('recipeCategory');
const recipeDescInput   = document.getElementById('recipeDesc');
const ingredientList    = document.getElementById('ingredientList');
const recipeStepsInput  = document.getElementById('recipeSteps');
const recipeTempInput   = document.getElementById('recipeTemp');
const recipeWeightInput = document.getElementById('recipeWeight');

const detailOverlay     = document.getElementById('detailOverlay');
const detailTitle       = document.getElementById('detailTitle');
const detailIcon        = document.getElementById('detailIcon');
const detailBody        = document.getElementById('detailBody');

const toast             = document.getElementById('toast');
let toastTimer;

// ===== Loading =====
function setLoading(on, msg = 'Memuat data...') {
  const el = document.getElementById('loadingOverlay');
  el.querySelector('p').textContent = msg;
  el.classList.toggle('hidden', !on);
}

// ===== Stats =====
function updateStats() {
  statTotal.textContent = recipes.length;
  const cats = new Set(recipes.map(r => r.category || 'Lainnya'));
  if (recipes.length > 0) {
    statCat.textContent       = cats.size;
    statCatChip.style.display = '';
  } else {
    statCatChip.style.display = 'none';
  }
}

// ===== Render Grid =====
function renderGrid(filter = '') {
  const q = filter.toLowerCase().trim();
  const filtered = q
    ? recipes.filter(r =>
        r.name.toLowerCase().includes(q) ||
        (r.category || '').toLowerCase().includes(q) ||
        (r.desc || '').toLowerCase().includes(q) ||
        (r.ingredients || []).some(i => i.name.toLowerCase().includes(q))
      )
    : recipes;

  recipeGrid.innerHTML = '';
  updateStats();

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    document.getElementById('emptyTitle').textContent = q ? 'Resep tidak ditemukan' : 'Belum ada resep nih!';
    document.getElementById('emptyDesc').textContent  = q
      ? `Tidak ada resep yang cocok dengan "${filter}"`
      : 'Yuk tambahkan resep kue pertamamu 🎉';
    return;
  }
  emptyState.classList.add('hidden');

  filtered.forEach(recipe => {
    const { emoji, thumb } = getCatInfo(recipe.category);
    const ingCount = (recipe.ingredients || []).length;
    const cat      = recipe.category || 'Lainnya';

    const card = document.createElement('div');
    card.className  = 'recipe-card';
    card.dataset.id = recipe.id;
    card.innerHTML  = `
      <div class="card-thumb ${thumb}"><span>${emoji}</span></div>
      <div class="card-body">
        <div class="card-top">
          <span class="card-category">${escHtml(cat)}</span>
          <span class="card-ing-count">🧂 ${ingCount} bahan</span>
        </div>
        <div class="card-title">${escHtml(recipe.name)}</div>
        ${recipe.desc ? `<div class="card-desc">${escHtml(recipe.desc)}</div>` : ''}
      </div>
      <div class="card-meta">
        ${recipe.temp   ? `<span class="card-meta-chip">🌡 ${escHtml(recipe.temp)}°C</span>` : ''}
        ${recipe.weight ? `<span class="card-meta-chip">⚖️ ${escHtml(recipe.weight)}</span>` : ''}
      </div>
      <div class="card-actions">
        <button class="card-btn card-btn-detail" data-action="detail">👁 Detail</button>
        <button class="card-btn card-btn-edit"   data-action="edit">✏️ Edit</button>
        <button class="card-btn card-btn-delete" data-action="delete">🗑 Hapus</button>
      </div>
    `;

    card.querySelector('[data-action="detail"]').addEventListener('click', () => openDetail(recipe.id));
    card.querySelector('[data-action="edit"]').addEventListener('click',   () => openEditModal(recipe.id));
    card.querySelector('[data-action="delete"]').addEventListener('click', () => confirmDelete(recipe.id));
    recipeGrid.appendChild(card);
  });
}

// ===== Ingredient Rows =====
function addIngredientRow(name = '', qty = '', unit = '') {
  const idx = ingredientList.children.length + 1;
  const row = document.createElement('div');
  row.className = 'ingredient-row';
  row.innerHTML = `
    <div class="ing-num">${idx}</div>
    <input type="text" class="ing-name" placeholder="cth. Tepung terigu" value="${escAttr(name)}" />
    <input type="text" class="qty"      placeholder="200"   value="${escAttr(qty)}" />
    <input type="text" class="unit"     placeholder="gram"  value="${escAttr(unit)}" />
    <button type="button" class="btn-remove-ing" title="Hapus bahan">✕</button>
  `;
  row.querySelector('.btn-remove-ing').addEventListener('click', () => {
    row.remove(); renumberRows();
  });
  ingredientList.appendChild(row);
}

function renumberRows() {
  ingredientList.querySelectorAll('.ingredient-row').forEach((row, i) => {
    row.querySelector('.ing-num').textContent = i + 1;
  });
}

function getIngredients() {
  return [...ingredientList.querySelectorAll('.ingredient-row')]
    .map(row => ({
      name: row.querySelector('.ing-name').value.trim(),
      qty:  row.querySelector('.qty').value.trim(),
      unit: row.querySelector('.unit').value.trim(),
    }))
    .filter(i => i.name);
}

// ===== Modal: Add =====
function openAddModal() {
  modalTitle.textContent   = 'Tambah Resep';
  modalIcon.textContent    = '✨';
  recipeForm.reset();
  recipeIdInput.value      = '';
  ingredientList.innerHTML = '';
  addIngredientRow(); addIngredientRow();
  showModal(modalOverlay);
  setTimeout(() => recipeNameInput.focus(), 100);
}

// ===== Modal: Edit =====
function openEditModal(id) {
  const recipe = recipes.find(r => r.id === id);
  if (!recipe) return;
  modalTitle.textContent    = 'Edit Resep';
  modalIcon.textContent     = '✏️';
  recipeIdInput.value       = recipe.id;
  recipeNameInput.value     = recipe.name;
  recipeCatInput.value      = recipe.category || '';
  recipeDescInput.value     = recipe.desc || '';
  recipeStepsInput.value    = recipe.steps || '';
  recipeTempInput.value     = recipe.temp || '';
  recipeWeightInput.value   = recipe.weight || '';
  ingredientList.innerHTML  = '';
  const ings = recipe.ingredients || [];
  (ings.length ? ings : [{}]).forEach(i => addIngredientRow(i.name, i.qty, i.unit));
  showModal(modalOverlay);
  setTimeout(() => recipeNameInput.focus(), 100);
}

function closeModal() { hideModal(modalOverlay); }

// ===== Detail =====
function openDetail(id) {
  const recipe = recipes.find(r => r.id === id);
  if (!recipe) return;
  const { emoji, thumb } = getCatInfo(recipe.category);
  const cat  = recipe.category || 'Lainnya';
  const ings = recipe.ingredients || [];

  detailTitle.textContent = recipe.name;
  detailIcon.textContent  = emoji;

  const ingRows = ings.map(i => `
    <tr>
      <td>${escHtml(i.name)}</td>
      <td>${escHtml(i.qty)}</td>
      <td>${escHtml(i.unit)}</td>
    </tr>`).join('');

  detailBody.innerHTML = `
    <div class="detail-hero ${thumb}"><span>${emoji}</span></div>
    <div class="detail-meta">
      <span class="detail-badge">${escHtml(cat)}</span>
      <span class="detail-badge neutral">🧂 ${ings.length} bahan</span>
      ${recipe.temp   ? `<span class="detail-badge neutral">🌡 ${escHtml(recipe.temp)}°C</span>` : ''}
      ${recipe.weight ? `<span class="detail-badge neutral">⚖️ ${escHtml(recipe.weight)}</span>` : ''}
    </div>
    ${recipe.desc ? `<p style="font-size:.9rem;color:var(--text-2);margin-bottom:1.1rem;line-height:1.6;">${escHtml(recipe.desc)}</p>` : ''}
    ${ings.length > 0 ? `
    <div class="detail-section">
      <div class="detail-section-title">🧂 Bahan-bahan</div>
      <table class="ingredient-table">
        <thead><tr><th>Bahan</th><th>Jumlah</th><th>Satuan</th></tr></thead>
        <tbody>${ingRows}</tbody>
      </table>
    </div>` : ''}
    ${recipe.steps ? `
    <div class="detail-section">
      <div class="detail-section-title">📋 Langkah Pembuatan</div>
      <div class="steps-text">${escHtml(recipe.steps).replace(/\n/g, '<br>')}</div>
    </div>` : ''}
    <div class="detail-actions">
      <button class="btn-edit-detail" id="detailEditBtn">✏️ Edit Resep</button>
      <button class="btn-del-detail"  id="detailDeleteBtn">🗑 Hapus</button>
    </div>
  `;

  document.getElementById('detailEditBtn').addEventListener('click', () => {
    hideModal(detailOverlay); openEditModal(id);
  });
  document.getElementById('detailDeleteBtn').addEventListener('click', () => {
    hideModal(detailOverlay); confirmDelete(id);
  });
  showModal(detailOverlay);
}

// ===== CRUD =====
recipeForm.addEventListener('submit', async e => {
  e.preventDefault();
  const name = recipeNameInput.value.trim();
  if (!name) { showToast('⚠️ Nama resep wajib diisi!'); recipeNameInput.focus(); return; }
  const ingredients = getIngredients();
  if (!ingredients.length) { showToast('⚠️ Tambahkan minimal satu bahan!'); return; }

  const id       = recipeIdInput.value;
  const now      = new Date().toISOString();
  const existing = id ? recipes.find(r => r.id === id) : null;
  const data     = {
    id:          id || Date.now().toString(),
    name,
    category:    recipeCatInput.value.trim() || 'Lainnya',
    desc:        recipeDescInput.value.trim(),
    ingredients,
    steps:       recipeStepsInput.value.trim(),
    temp:        recipeTempInput.value.trim(),
    weight:      recipeWeightInput.value.trim(),
    createdAt:   existing?.createdAt || now,
    updatedAt:   now,
  };

  setLoading(true, id ? 'Memperbarui resep...' : 'Menyimpan resep...');
  try {
    await dbSave(data);
    if (id) {
      const idx = recipes.findIndex(r => r.id === id);
      if (idx !== -1) recipes[idx] = data;
      showToast('✅ Resep berhasil diperbarui!');
    } else {
      recipes.unshift(data);
      showToast('✅ Resep berhasil ditambahkan!');
    }
    closeModal();
    renderGrid(searchInput.value);
  } catch (err) {
    showToast('❌ Gagal menyimpan: ' + err.message);
  } finally {
    setLoading(false);
  }
});

async function confirmDelete(id) {
  const recipe = recipes.find(r => r.id === id);
  const ok = await showConfirm(recipe?.name || 'Resep ini');
  if (!ok) return;
  setLoading(true, 'Menghapus resep...');
  try {
    await dbDelete(id);
    recipes = recipes.filter(r => r.id !== id);
    renderGrid(searchInput.value);
    showToast('🗑️ Resep berhasil dihapus.');
  } catch (err) {
    showToast('❌ Gagal menghapus: ' + err.message);
  } finally {
    setLoading(false);
  }
}

// ===== Modal Helpers =====
function showModal(el) { el.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function hideModal(el) { el.classList.add('hidden');    document.body.style.overflow = ''; }

// ===== Toast =====
function showToast(msg) {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.classList.remove('hidden');
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ===== Escape Helpers =====
function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escAttr(s) { return escHtml(s); }

// ===== Export PDF =====
function exportPDF() {
  if (!recipes.length) { showToast('⚠️ Belum ada resep untuk diekspor!'); return; }

  // Pastikan library sudah load
  if (!window.jspdf || !window.jspdf.jsPDF) {
    showToast('❌ Library PDF belum siap, coba lagi sebentar.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const ml = 14, mr = 14;
  const now = new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });

  const addFooter = () => {
    const pg = doc.internal.getCurrentPageInfo().pageNumber;
    doc.setDrawColor(191, 219, 254); // Blue light
    doc.setLineWidth(0.3);
    doc.line(ml, pageH - 12, pageW - mr, pageH - 12);
    doc.setFontSize(8);
    doc.setTextColor(59, 130, 246); // Blue primary
    doc.setFont('helvetica', 'normal');
    doc.text('Buku Resep Kue', ml, pageH - 7);
    doc.text('Halaman ' + pg, pageW - mr, pageH - 7, { align: 'right' });
  };

  // ── Halaman 1: Cover ──
  doc.setFillColor(30, 58, 138); // Blue dark
  doc.rect(0, 0, pageW, pageH, 'F');
  doc.setFillColor(59, 130, 246); // Blue primary
  doc.roundedRect(10, 10, pageW - 20, pageH - 20, 8, 8, 'F');
  doc.setFillColor(255, 126, 185); // Pink primary
  doc.roundedRect(20, 20, pageW - 40, pageH - 40, 6, 6, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.text('BUKU RESEP KUE', pageW / 2, 90, { align: 'center' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Koleksi Resep Kue Pilihan', pageW / 2, 105, { align: 'center' });

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageW / 2 - 45, 118, 90, 14, 7, 7, 'F');
  doc.setTextColor(59, 130, 246); // Blue
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(recipes.length + ' Resep  |  ' + now, pageW / 2, 127, { align: 'center' });

  // ── Halaman 2: Daftar Isi ──
  doc.addPage();
  doc.setFillColor(59, 130, 246); // Blue
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('DAFTAR RESEP', pageW / 2, 14, { align: 'center' });

  const summaryRows = recipes.map((r, i) => [
    String(i + 1),
    r.name || '-',
    r.category || 'Lainnya',
    String((r.ingredients || []).length) + ' bahan',
    r.temp ? r.temp + 'C' : '-',
    r.weight || '-',
  ]);

  doc.autoTable({
    startY: 28,
    head: [['No', 'Nama Resep', 'Kategori', 'Bahan', 'Suhu', 'Hasil']],
    body: summaryRows,
    margin: { left: ml, right: mr },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 9, halign: 'center' },
    bodyStyles: { fontSize: 9, textColor: [30, 58, 138] },
    alternateRowStyles: { fillColor: [239, 246, 255] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      2: { halign: 'center', cellWidth: 28 },
      3: { halign: 'center', cellWidth: 22 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'center', cellWidth: 26 },
    },
    didDrawPage: addFooter,
  });

  // ── Halaman per resep ──
  recipes.forEach((recipe, idx) => {
    doc.addPage();
    const ings = recipe.ingredients || [];

    // Header
    doc.setFillColor(59, 130, 246); // Blue
    doc.rect(0, 0, pageW, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    const titleLines = doc.splitTextToSize(recipe.name || '-', pageW - ml - mr - 20);
    doc.text(titleLines, ml, 14);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Resep ' + (idx + 1) + ' / ' + recipes.length, pageW - mr, 14, { align: 'right' });

    // Badges
    let bx = ml;
    const by = 34;
    const badgeDefs = [
      { label: 'KATEGORI', val: recipe.category || 'Lainnya', c: [59, 130, 246] }, // Blue
      { label: 'SUHU',     val: recipe.temp ? recipe.temp + 'C' : '-', c: [251, 191, 36] }, // Yellow/Orange
      { label: 'HASIL',    val: recipe.weight || '-',  c: [52, 211, 153] }, // Green
      { label: 'BAHAN',    val: ings.length + ' item', c: [255, 126, 185] }, // Pink
    ];
    badgeDefs.forEach(b => {
      const bw = 40;
      doc.setFillColor(...b.c);
      doc.roundedRect(bx, by - 6, bw, 13, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.text(b.label, bx + bw / 2, by - 1, { align: 'center' });
      doc.setFontSize(8.5);
      doc.text(String(b.val), bx + bw / 2, by + 5, { align: 'center' });
      bx += bw + 3;
    });

    let cy = 52;

    // Deskripsi
    if (recipe.desc) {
      doc.setFillColor(239, 246, 255); // Light Blue
      const dLines = doc.splitTextToSize(recipe.desc, pageW - ml - mr - 6);
      doc.roundedRect(ml, cy - 3, pageW - ml - mr, dLines.length * 5 + 6, 2, 2, 'F');
      doc.setTextColor(30, 58, 138); // Dark Blue
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text(dLines, ml + 3, cy + 2);
      cy += dLines.length * 5 + 10;
    }

    // Tabel bahan
    if (ings.length > 0) {
      doc.setTextColor(60, 30, 90);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Bahan-bahan', ml, cy);
      cy += 2;
      doc.autoTable({
        startY: cy + 2,
        head: [['No', 'Nama Bahan', 'Jumlah', 'Satuan']],
        body: ings.map((ing, i) => [String(i+1), ing.name||'-', ing.qty||'-', ing.unit||'-']),
        margin: { left: ml, right: mr },
        headStyles: { fillColor: [52, 211, 153], textColor: 255, fontStyle: 'bold', fontSize: 9 }, // Green
        bodyStyles: { fontSize: 9, textColor: [30, 58, 138] },
        alternateRowStyles: { fillColor: [236, 253, 245] }, // Light Green
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          2: { halign: 'center', cellWidth: 24 },
          3: { halign: 'center', cellWidth: 24 },
        },
        didDrawPage: addFooter,
      });
      cy = doc.lastAutoTable.finalY + 8;
    }

    // Langkah
    if (recipe.steps) {
      if (cy > pageH - 55) { doc.addPage(); cy = 20; }
      doc.setTextColor(60, 30, 90);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Langkah Pembuatan', ml, cy);
      cy += 4;
      const sLines = doc.splitTextToSize(recipe.steps, pageW - ml - mr - 8);
      const boxH = sLines.length * 5.2 + 8;
      doc.setFillColor(239, 246, 255); // Light Blue
      doc.roundedRect(ml, cy, pageW - ml - mr, boxH, 3, 3, 'F');
      doc.setTextColor(30, 58, 138); // Dark Blue
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(sLines, ml + 4, cy + 6);
    }

    addFooter();
  });

  const safeName = now.replace(/ /g, '_');
  doc.save('Buku_Resep_Kue_' + safeName + '.pdf');
  showToast('✅ PDF berhasil diunduh!');
}

// ===== Export Excel =====
function exportExcel() {
  if (!recipes.length) { showToast('⚠️ Belum ada resep untuk diekspor!'); return; }

  const wb  = XLSX.utils.book_new();
  const now = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

  // ── Helper: format bahan jadi teks lengkap "200 gram Tepung terigu" ──
  function fmtIng(ings) {
    if (!ings || ings.length === 0) return '-';
    return ings
      .filter(i => i.name)
      .map(i => [i.qty, i.unit, i.name].filter(Boolean).join(' '))
      .join(', ');
  }

  // ── Helper: terapkan style ke satu cell ──
  function sc(ws, addr, s) {
    if (!ws[addr]) return;
    ws[addr].s = s;
  }

  // Warna tema
  const C = {
    blue:      { rgb: '3B82F6' },
    blueLt:    { rgb: '60A5FA' },
    blueBg:    { rgb: 'EFF6FF' },
    pink:      { rgb: 'FF7EB9' },
    pinkLt:    { rgb: 'F472B6' },
    pinkBg:    { rgb: 'FFF0F7' },
    green:     { rgb: '34D399' },
    greenLt:   { rgb: 'A7F3D0' },
    greenBg:   { rgb: 'ECFDF5' },
    white:     { rgb: 'FFFFFF' },
    border:    { rgb: 'BFDBFE' },
    textDark:  { rgb: '1E3A8A' },
  };

  const thinBorder = (color) => ({
    top:    { style: 'thin', color },
    bottom: { style: 'thin', color },
    left:   { style: 'thin', color },
    right:  { style: 'thin', color },
  });

  // ════════════════════════════════════════════════════════
  // SHEET 1 — RINGKASAN LENGKAP
  // ════════════════════════════════════════════════════════
  const s1Data = [
    ['BUKU RESEP KUE'],
    ['Dicetak: ' + now + '   |   Total: ' + recipes.length + ' Resep'],
    [],
    ['No', 'Nama Resep', 'Kategori', 'Deskripsi', 'Bahan-bahan', 'Suhu Oven', 'Berat / Hasil'],
  ];

  recipes.forEach((r, i) => {
    s1Data.push([
      i + 1,
      r.name     || '-',
      r.category || 'Lainnya',
      r.desc     || '-',
      fmtIng(r.ingredients),
      r.temp     ? r.temp + '°C' : '-',
      r.weight   || '-',
    ]);
  });

  const ws1 = XLSX.utils.aoa_to_sheet(s1Data);
  ws1['!cols']   = [{ wch:4 }, { wch:28 }, { wch:15 }, { wch:32 }, { wch:52 }, { wch:13 }, { wch:20 }];
  ws1['!rows']   = [{ hpt:30 }, { hpt:18 }, { hpt:6 }, { hpt:22 }];
  ws1['!merges'] = [
    { s:{ r:0,c:0 }, e:{ r:0,c:6 } },
    { s:{ r:1,c:0 }, e:{ r:1,c:6 } },
  ];

  // Judul
  sc(ws1,'A1',{ font:{ bold:true, sz:16, color:C.white }, fill:{ fgColor:C.blue, patternType:'solid' }, alignment:{ horizontal:'center', vertical:'center' } });
  sc(ws1,'A2',{ font:{ sz:10, color:C.blue }, fill:{ fgColor:C.blueBg, patternType:'solid' }, alignment:{ horizontal:'center', vertical:'center' } });

  // Header kolom
  ['A','B','C','D','E','F','G'].forEach(col => {
    sc(ws1, col+'4', {
      font:      { bold:true, sz:10, color:C.white },
      fill:      { fgColor:C.blueLt, patternType:'solid' },
      alignment: { horizontal:'center', vertical:'center' },
      border:    thinBorder(C.border),
    });
  });

  // Data rows
  recipes.forEach((_, i) => {
    const row = i + 5;
    const bg  = { rgb: i % 2 === 0 ? 'EFF6FF' : 'FFFFFF' };
    const bdr = thinBorder(C.border);
    sc(ws1,`A${row}`,{ font:{ sz:10, color:C.textDark }, fill:{ fgColor:bg, patternType:'solid' }, alignment:{ horizontal:'center', vertical:'top' }, border:bdr });
    sc(ws1,`B${row}`,{ font:{ bold:true, sz:10, color:C.textDark }, fill:{ fgColor:bg, patternType:'solid' }, alignment:{ vertical:'top' }, border:bdr });
    sc(ws1,`C${row}`,{ font:{ sz:10, color:C.textDark }, fill:{ fgColor:bg, patternType:'solid' }, alignment:{ horizontal:'center', vertical:'top' }, border:bdr });
    sc(ws1,`D${row}`,{ font:{ sz:10, color:C.textDark }, fill:{ fgColor:bg, patternType:'solid' }, alignment:{ vertical:'top', wrapText:true }, border:bdr });
    sc(ws1,`E${row}`,{ font:{ sz:10, color:C.textDark }, fill:{ fgColor:bg, patternType:'solid' }, alignment:{ vertical:'top', wrapText:true }, border:bdr });
    sc(ws1,`F${row}`,{ font:{ sz:10, color:C.textDark }, fill:{ fgColor:bg, patternType:'solid' }, alignment:{ horizontal:'center', vertical:'top' }, border:bdr });
    sc(ws1,`G${row}`,{ font:{ sz:10, color:C.textDark }, fill:{ fgColor:bg, patternType:'solid' }, alignment:{ horizontal:'center', vertical:'top' }, border:bdr });
  });

  XLSX.utils.book_append_sheet(wb, ws1, 'Ringkasan');

  // ════════════════════════════════════════════════════════
  // SHEET 2 — DETAIL BAHAN (satu baris per bahan)
  // ════════════════════════════════════════════════════════
  const s2Data = [
    ['DETAIL BAHAN-BAHAN'],
    ['Dicetak: ' + now + '   |   Total: ' + recipes.length + ' Resep'],
    [],
    ['No', 'Nama Resep', 'Kategori', 'No Bahan', 'Nama Bahan', 'Jumlah', 'Satuan'],
  ];

  recipes.forEach((r, ri) => {
    const ings = r.ingredients || [];
    if (ings.length === 0) {
      s2Data.push([ri + 1, r.name || '-', r.category || 'Lainnya', '-', '(tidak ada bahan)', '-', '-']);
    } else {
      ings.forEach((ing, ii) => {
        s2Data.push([
          ii === 0 ? ri + 1 : '',
          ii === 0 ? (r.name || '-') : '',
          ii === 0 ? (r.category || 'Lainnya') : '',
          ii + 1,
          ing.name || '-',
          ing.qty  || '-',
          ing.unit || '-',
        ]);
      });
    }
  });

  const ws2 = XLSX.utils.aoa_to_sheet(s2Data);
  ws2['!cols']   = [{ wch:4 }, { wch:28 }, { wch:15 }, { wch:10 }, { wch:28 }, { wch:12 }, { wch:14 }];
  ws2['!rows']   = [{ hpt:26 }, { hpt:16 }, { hpt:6 }, { hpt:22 }];
  ws2['!merges'] = [
    { s:{ r:0,c:0 }, e:{ r:0,c:6 } },
    { s:{ r:1,c:0 }, e:{ r:1,c:6 } },
  ];

  sc(ws2,'A1',{ font:{ bold:true, sz:14, color:C.white }, fill:{ fgColor:C.pink, patternType:'solid' }, alignment:{ horizontal:'center', vertical:'center' } });
  sc(ws2,'A2',{ font:{ sz:10, color:C.pink }, fill:{ fgColor:{ rgb:'FCE7F3' }, patternType:'solid' }, alignment:{ horizontal:'center', vertical:'center' } });

  ['A','B','C','D','E','F','G'].forEach(col => {
    sc(ws2, col+'4', {
      font:      { bold:true, sz:10, color:C.white },
      fill:      { fgColor:C.pinkLt, patternType:'solid' },
      alignment: { horizontal:'center', vertical:'center' },
      border:    thinBorder({ rgb:'FBCFE8' }),
    });
  });

  let s2Row = 4;
  recipes.forEach((r, ri) => {
    const ings  = r.ingredients || [];
    const count = Math.max(ings.length, 1);
    for (let ii = 0; ii < count; ii++) {
      const row = s2Row + 1;
      const bg  = { rgb: ri % 2 === 0 ? 'FFF0F7' : 'FFFFFF' };
      const bdr = thinBorder({ rgb:'FBCFE8' });
      ['A','B','C','D','E','F','G'].forEach(col => {
        sc(ws2, `${col}${row}`, { font:{ sz:10, color:C.textDark }, fill:{ fgColor:bg, patternType:'solid' }, alignment:{ vertical:'center' }, border:bdr });
      });
      sc(ws2,`A${row}`,{ font:{ sz:10, color:C.textDark }, fill:{ fgColor:bg, patternType:'solid' }, alignment:{ horizontal:'center', vertical:'center' }, border:bdr });
      sc(ws2,`D${row}`,{ font:{ sz:10, color:C.textDark }, fill:{ fgColor:bg, patternType:'solid' }, alignment:{ horizontal:'center', vertical:'center' }, border:bdr });
      sc(ws2,`E${row}`,{ font:{ bold:true, sz:10, color:C.textDark }, fill:{ fgColor:bg, patternType:'solid' }, alignment:{ vertical:'center' }, border:bdr });
      s2Row++;
    }
  });

  XLSX.utils.book_append_sheet(wb, ws2, 'Detail Bahan');

  // ════════════════════════════════════════════════════════
  // SHEET 3 — LANGKAH PEMBUATAN
  // ════════════════════════════════════════════════════════
  const s3Data = [
    ['LANGKAH PEMBUATAN'],
    ['Dicetak: ' + now + '   |   Total: ' + recipes.length + ' Resep'],
    [],
    ['No', 'Nama Resep', 'Kategori', 'Suhu Oven', 'Berat / Hasil', 'Langkah Pembuatan'],
  ];

  recipes.forEach((r, i) => {
    s3Data.push([
      i + 1,
      r.name     || '-',
      r.category || 'Lainnya',
      r.temp     ? r.temp + '°C' : '-',
      r.weight   || '-',
      r.steps    || '-',
    ]);
  });

  const ws3 = XLSX.utils.aoa_to_sheet(s3Data);
  ws3['!cols']   = [{ wch:4 }, { wch:28 }, { wch:15 }, { wch:13 }, { wch:20 }, { wch:65 }];
  ws3['!rows']   = [{ hpt:26 }, { hpt:16 }, { hpt:6 }, { hpt:22 }];
  ws3['!merges'] = [
    { s:{ r:0,c:0 }, e:{ r:0,c:5 } },
    { s:{ r:1,c:0 }, e:{ r:1,c:5 } },
  ];

  sc(ws3,'A1',{ font:{ bold:true, sz:14, color:C.white }, fill:{ fgColor:C.green, patternType:'solid' }, alignment:{ horizontal:'center', vertical:'center' } });
  sc(ws3,'A2',{ font:{ sz:10, color:C.green }, fill:{ fgColor:C.greenBg, patternType:'solid' }, alignment:{ horizontal:'center', vertical:'center' } });

  ['A','B','C','D','E','F'].forEach(col => {
    sc(ws3, col+'4', {
      font:      { bold:true, sz:10, color:C.white },
      fill:      { fgColor:C.greenLt, patternType:'solid' },
      alignment: { horizontal:'center', vertical:'center' },
      border:    thinBorder(C.greenLt),
    });
  });

  recipes.forEach((_, i) => {
    const row = i + 5;
    const bg  = { rgb: i % 2 === 0 ? 'ECFDF5' : 'FFFFFF' };
    const bdr = thinBorder(C.greenLt);
    sc(ws3,`A${row}`,{ font:{ sz:10, color:C.textDark }, fill:{ fgColor:bg, patternType:'solid' }, alignment:{ horizontal:'center', vertical:'top' }, border:bdr });
    sc(ws3,`B${row}`,{ font:{ bold:true, sz:10, color:C.textDark }, fill:{ fgColor:bg, patternType:'solid' }, alignment:{ vertical:'top' }, border:bdr });
    sc(ws3,`C${row}`,{ font:{ sz:10, color:C.textDark }, fill:{ fgColor:bg, patternType:'solid' }, alignment:{ horizontal:'center', vertical:'top' }, border:bdr });
    sc(ws3,`D${row}`,{ font:{ sz:10, color:C.textDark }, fill:{ fgColor:bg, patternType:'solid' }, alignment:{ horizontal:'center', vertical:'top' }, border:bdr });
    sc(ws3,`E${row}`,{ font:{ sz:10, color:C.textDark }, fill:{ fgColor:bg, patternType:'solid' }, alignment:{ horizontal:'center', vertical:'top' }, border:bdr });
    sc(ws3,`F${row}`,{ font:{ sz:10, color:C.textDark }, fill:{ fgColor:bg, patternType:'solid' }, alignment:{ vertical:'top', wrapText:true }, border:bdr });
  });

  XLSX.utils.book_append_sheet(wb, ws3, 'Langkah Pembuatan');

  const fileName = 'Buku_Resep_Kue_' + now.replace(/ /g, '_') + '.xlsx';
  XLSX.writeFile(wb, fileName);
  showToast('✅ Excel berhasil diunduh!');
}

// ===== Confirm Delete Modal =====
let _confirmResolve = null;
function showConfirm(recipeName) {
  return new Promise(resolve => {
    _confirmResolve = resolve;
    document.getElementById('confirmMsg').textContent =
      `"${recipeName}" akan dihapus permanen dan tidak bisa dikembalikan.`;
    document.getElementById('confirmOverlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  });
}
document.getElementById('confirmOk').addEventListener('click', () => {
  document.getElementById('confirmOverlay').classList.add('hidden');
  document.body.style.overflow = '';
  if (_confirmResolve) { _confirmResolve(true); _confirmResolve = null; }
});
document.getElementById('confirmCancel').addEventListener('click', () => {
  document.getElementById('confirmOverlay').classList.add('hidden');
  document.body.style.overflow = '';
  if (_confirmResolve) { _confirmResolve(false); _confirmResolve = null; }
});
document.getElementById('confirmOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('confirmOverlay')) {
    document.getElementById('confirmOverlay').classList.add('hidden');
    document.body.style.overflow = '';
    if (_confirmResolve) { _confirmResolve(false); _confirmResolve = null; }
  }
});
document.getElementById('btnTambah').addEventListener('click', openAddModal);
document.getElementById('btnEmptyAdd').addEventListener('click', openAddModal);
document.getElementById('btnExportPDF').addEventListener('click', exportPDF);
document.getElementById('btnExportExcel').addEventListener('click', exportExcel);
document.getElementById('btnAddIngredient').addEventListener('click', () => addIngredientRow());
document.getElementById('btnCloseModal').addEventListener('click', closeModal);
document.getElementById('btnCancel').addEventListener('click', closeModal);
document.getElementById('btnCloseDetail').addEventListener('click', () => hideModal(detailOverlay));
modalOverlay.addEventListener('click',  e => { if (e.target === modalOverlay)  closeModal(); });
detailOverlay.addEventListener('click', e => { if (e.target === detailOverlay) hideModal(detailOverlay); });
searchInput.addEventListener('input', () => renderGrid(searchInput.value));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!modalOverlay.classList.contains('hidden'))  closeModal();
    if (!detailOverlay.classList.contains('hidden')) hideModal(detailOverlay);
  }
});

// ===== Init =====
async function init() {
  setGreeting();
  setLoading(true, 'Memuat data...');
  try {
    recipes = await dbGetAll();
    // Urutkan terbaru dulu
    recipes.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    renderGrid();
  } catch (err) {
    showToast('❌ Gagal memuat data: ' + err.message);
    console.error(err);
    renderGrid(); // tetap render kosong
  } finally {
    setLoading(false);
  }
}

init();
