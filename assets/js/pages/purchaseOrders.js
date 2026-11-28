/* ===================== PURCHASE ORDERS (Vendor Bills) ===================== */
let poFilter = { vendorId:'all', dateFrom:'', dateTo:'', status:'all' };

function renderPurchaseOrders(initVendorId) {
  if (initVendorId) poFilter.vendorId = initVendorId;
  const vendors = DB.all('vendors');

  const content = `
    <h1 class="page-title">📑 Purchase Orders</h1>
    <p class="page-sub">Track every batch of clothes sent to 3rd-party laundries & their weekly bills.</p>

    <div class="filter-bar">
      <select id="poVendor" style="min-width:220px;">
        <option value="all">All Vendors</option>
        ${vendors.map(v => `<option value="${v.id}" ${poFilter.vendorId===v.id?'selected':''}>🏭 ${escapeHtml(v.name)}</option>`).join('')}
      </select>
      <select id="poStatus">
        <option value="all">All Statuses</option>
        <option value="pending">⏳ Pending</option>
        <option value="received">📦 Received</option>
        <option value="invoiced">🧾 Invoiced</option>
        <option value="paid">✅ Paid</option>
      </select>
      <label>From <input type="date" id="poFrom" value="${poFilter.dateFrom}"/></label>
      <label>To <input type="date" id="poTo" value="${poFilter.dateTo}"/></label>
      <button class="btn btn-secondary btn-sm" id="poWeek">This Week</button>
      <button class="btn btn-secondary btn-sm" id="poMonth">This Month</button>
      <button class="btn btn-ghost btn-sm" id="poClear">Clear</button>
      <button class="btn btn-primary" id="addPoBtn" style="margin-left:auto;">+ New Purchase Order</button>
      <button class="btn btn-success" id="weeklyInvBtn">🧾 Generate Weekly Invoice</button>
    </div>

    <div id="poSummary"></div>

    <div class="card" style="padding:0;overflow:hidden;">
      <table class="tbl">
        <thead><tr>
          <th>PO #</th><th>Vendor</th><th>Date</th><th>Items / Qty</th>
          <th>Total</th><th>Paid</th><th>Due</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody id="poBody"></tbody>
      </table>
    </div>
  `;
  $('#app').innerHTML = renderLayout('purchaseOrders', content);
  bindLayout();

  $('#poVendor').onchange = e => { poFilter.vendorId = e.target.value; renderPOBody(); };
  $('#poStatus').onchange = e => { poFilter.status = e.target.value; renderPOBody(); };
  $('#poFrom').onchange   = e => { poFilter.dateFrom = e.target.value; renderPOBody(); };
  $('#poTo').onchange     = e => { poFilter.dateTo = e.target.value; renderPOBody(); };
  $('#poWeek').onclick    = () => { const d=new Date(); d.setDate(d.getDate()-6); poFilter.dateFrom = isoDay(d); poFilter.dateTo = isoDay(); renderPurchaseOrders(); };
  $('#poMonth').onclick   = () => { const d=new Date(); poFilter.dateFrom = isoDay(new Date(d.getFullYear(),d.getMonth(),1)); poFilter.dateTo = isoDay(); renderPurchaseOrders(); };
  $('#poClear').onclick   = () => { poFilter = { vendorId:'all', dateFrom:'', dateTo:'', status:'all' }; renderPurchaseOrders(); };
  $('#addPoBtn').onclick  = () => openPOForm();
  $('#weeklyInvBtn').onclick = openWeeklyInvoiceDialog;

  $('#poStatus').value = poFilter.status;
  renderPOBody();
}

function filteredPOs() {
  let list = [...DB.all('purchaseOrders')].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  if (poFilter.vendorId !== 'all') list = list.filter(p => p.vendorId === poFilter.vendorId);
  if (poFilter.status !== 'all') list = list.filter(p => p.status === poFilter.status);
  if (poFilter.dateFrom) list = list.filter(p => p.date >= poFilter.dateFrom);
  if (poFilter.dateTo) list = list.filter(p => p.date <= poFilter.dateTo);
  return list;
}

function renderPOBody() {
  const pos = filteredPOs();
  const totalBilled = pos.reduce((s,p)=>s+(p.total||0),0);
  const totalPaid = pos.reduce((s,p)=>s+(p.paid||0),0);
  const totalDue = pos.reduce((s,p)=>s+(p.due||0),0);
  const totalQty = pos.reduce((s,p)=>s+p.items.reduce((q,i)=>q+(i.qty||0),0),0);

  $('#poSummary').innerHTML = `
    <div class="grid-stats" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-bottom:14px;">
      <div class="stat-card"><div class="ic b1">📑</div><div><div class="lbl">POs</div><div class="val">${pos.length}</div></div></div>
      <div class="stat-card"><div class="ic b4">👕</div><div><div class="lbl">Total Items Sent</div><div class="val">${totalQty}</div></div></div>
      <div class="stat-card"><div class="ic b2">💰</div><div><div class="lbl">Billed by Vendor(s)</div><div class="val">${fmtMoney(totalBilled)}</div></div></div>
      <div class="stat-card"><div class="ic b3">✅</div><div><div class="lbl">Paid</div><div class="val" style="color:var(--success);">${fmtMoney(totalPaid)}</div></div></div>
      <div class="stat-card"><div class="ic b5">⏰</div><div><div class="lbl">Outstanding</div><div class="val" style="color:var(--danger);">${fmtMoney(totalDue)}</div></div></div>
    </div>
  `;

  if (!pos.length) {
    $('#poBody').innerHTML = `<tr><td colspan="9"><div class="empty"><div class="emoji">📑</div><h4>No purchase orders</h4><p>Create your first PO with the button above.</p></div></td></tr>`;
    return;
  }
  $('#poBody').innerHTML = pos.map(p => {
    const v = DB.get('vendors', p.vendorId) || { name:'-' };
    const qty = p.items.reduce((s,i)=>s+(i.qty||0),0);
    return `<tr>
      <td><b>${escapeHtml(p.poNo || '-')}</b></td>
      <td>🏭 ${escapeHtml(v.name)}</td>
      <td>${escapeHtml(p.date||'-')}</td>
      <td>${p.items.length} types • ${qty} pcs</td>
      <td><b>${fmtMoney(p.total)}</b></td>
      <td>${fmtMoney(p.paid)}</td>
      <td>${p.due>0?`<b style="color:var(--danger);">${fmtMoney(p.due)}</b>`:`<span class="badge paid">Paid</span>`}</td>
      <td><span class="badge ${p.status==='paid'?'paid':p.status==='pending'?'pending':p.status==='received'?'ready':'washing'}">${p.status}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm" data-act="view" data-id="${p.id}">👁️</button>
        <button class="btn btn-secondary btn-sm" data-act="pay" data-id="${p.id}">💰</button>
        ${DB.currentUser().role==='admin' ? `<button class="btn btn-secondary btn-sm" data-act="edit" data-id="${p.id}">✏️</button><button class="btn btn-danger btn-sm" data-act="del" data-id="${p.id}">🗑️</button>` : ''}
        <button class="btn btn-secondary btn-sm" data-act="print" data-id="${p.id}">🖨️</button>
      </td>
    </tr>`;
  }).join('');

  $$('[data-act]').forEach(b => b.onclick = () => {
    const id = b.dataset.id;
    if (b.dataset.act === 'view' || b.dataset.act === 'print') openPOInvoice(id, b.dataset.act === 'print');
    else if (b.dataset.act === 'edit') openPOForm(DB.get('purchaseOrders', id));
    else if (b.dataset.act === 'pay') openPOPayment(id);
    else if (b.dataset.act === 'del') confirmDialog('Delete this purchase order?', () => { DB.remove('purchaseOrders', id); renderPOBody(); });
  });
}

/* ===== Create / Edit PO ===== */
function openPOForm(existing) {
  const vendors = DB.all('vendors');
  if (!vendors.length) { toast('Please add a vendor first','error'); app.go('vendors'); return; }

  const products = DB.all('products');
  const po = existing || {
    vendorId: poFilter.vendorId !== 'all' ? poFilter.vendorId : vendors[0].id,
    date: isoDay(),
    items: [],
    notes: '',
    paid: 0,
    status: 'pending'
  };

  const html = `
    <h3>${existing?'✏️ Edit':'➕ New'} Purchase Order</h3>
    <p class="sub">Record clothes sent to a 3rd-party laundry, along with vendor's rates.</p>

    <div class="form-row">
      <div class="field">
        <label>Vendor *</label>
        <select id="poVen">
          ${vendors.map(v => `<option value="${v.id}" ${po.vendorId===v.id?'selected':''}>🏭 ${escapeHtml(v.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>PO Date *</label>
        <input type="date" id="poDate" value="${po.date}"/>
      </div>
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;margin:10px 0;">
      <div style="font-weight:700;">Items Sent</div>
      <div style="display:flex;gap:6px;">
        <select id="poProdPick" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;min-width:220px;">
          <option value="">+ Add from rate list...</option>
          ${products.map(p => `<option value="${p.id}">${escapeHtml(p.name)} — ${fmtMoney(p.price)}</option>`).join('')}
        </select>
        <button class="btn btn-secondary btn-sm" id="addCustomBtn">+ Custom Item</button>
      </div>
    </div>

    <table class="tbl" style="margin-bottom:8px;">
      <thead><tr><th>Item</th><th style="width:90px;">Qty</th><th style="width:110px;">Vendor Rate</th><th style="width:120px;">Subtotal</th><th></th></tr></thead>
      <tbody id="poItems"></tbody>
    </table>

    <div class="form-row">
      <div class="field"><label>Initial Payment (Rs.)</label><input type="number" id="poPaid" value="${po.paid||0}" min="0"/></div>
      <div class="field"><label>Status</label>
        <select id="poStatusSel">
          <option value="pending"  ${po.status==='pending'?'selected':''}>⏳ Pending (sent to vendor)</option>
          <option value="received" ${po.status==='received'?'selected':''}>📦 Received Back</option>
          <option value="invoiced" ${po.status==='invoiced'?'selected':''}>🧾 Vendor Invoiced</option>
          <option value="paid"     ${po.status==='paid'?'selected':''}>✅ Paid</option>
        </select>
      </div>
    </div>
    <div class="form-row cols-1">
      <div class="field"><label>Notes</label><input id="poNotes" value="${escapeHtml(po.notes||'')}" placeholder="Bag #, special instructions, etc."/></div>
    </div>

    <div id="poTotals" style="background:var(--primary-light);padding:12px;border-radius:8px;margin:10px 0;font-weight:600;text-align:center;font-size:15px;"></div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveBtn">💾 Save Purchase Order</button>
    </div>
  `;

  openModal(html, { large: true, onOpen(m) {
    let items = (po.items || []).map(i => ({...i}));

    const renderItems = () => {
      $('#poItems', m).innerHTML = items.length ? items.map((it, i) => `
        <tr data-i="${i}">
          <td><input type="text" value="${escapeHtml(it.name)}" data-fld="name" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:6px;"/></td>
          <td><input type="number" value="${it.qty}" min="1" data-fld="qty" style="width:80px;padding:6px;border:1px solid var(--border);border-radius:6px;"/></td>
          <td><input type="number" value="${it.rate}" min="0" data-fld="rate" style="width:100px;padding:6px;border:1px solid var(--border);border-radius:6px;"/></td>
          <td class="line"><b>${fmtMoney(it.qty * it.rate)}</b></td>
          <td><button class="btn btn-danger btn-sm" data-rm="${i}">🗑️</button></td>
        </tr>
      `).join('') : `<tr><td colspan="5" class="empty"><div class="emoji">📑</div><p>No items yet. Add from dropdown above.</p></td></tr>`;

      $$('#poItems input', m).forEach(inp => {
        inp.oninput = () => {
          const i = +inp.closest('tr').dataset.i;
          const fld = inp.dataset.fld;
          items[i][fld] = fld === 'name' ? inp.value : (+inp.value || 0);
          inp.closest('tr').querySelector('.line').innerHTML = '<b>'+fmtMoney(items[i].qty * items[i].rate)+'</b>';
          calcTotals();
        };
      });
      $$('[data-rm]', m).forEach(b => b.onclick = () => { items.splice(+b.dataset.rm, 1); renderItems(); calcTotals(); });
    };

    const calcTotals = () => {
      const total = items.reduce((s,i) => s + (i.qty * i.rate), 0);
      const paid = +$('#poPaid', m).value || 0;
      const due = Math.max(0, total - paid);
      const qty = items.reduce((s,i)=>s+(+i.qty||0),0);
      $('#poTotals', m).innerHTML = `
        Items: <b>${items.length}</b> types • <b>${qty}</b> pieces
        &nbsp;|&nbsp; Total: <b>${fmtMoney(total)}</b>
        &nbsp;|&nbsp; Paid: <b style="color:var(--success);">${fmtMoney(Math.min(paid,total))}</b>
        &nbsp;|&nbsp; Due: <b style="color:${due>0?'var(--danger)':'var(--success)'};">${fmtMoney(due)}</b>
      `;
    };

    renderItems(); calcTotals();

    $('#poPaid', m).oninput = calcTotals;

    $('#poProdPick', m).onchange = (e) => {
      if (!e.target.value) return;
      const p = DB.get('products', e.target.value);
      if (p) {
        items.push({ productId: p.id, name: p.name, qty: 1, rate: p.price });
        renderItems(); calcTotals();
      }
      e.target.value = '';
    };

    $('#addCustomBtn', m).onclick = () => {
      items.push({ name: 'Custom Item', qty: 1, rate: 0 });
      renderItems(); calcTotals();
    };

    $('#saveBtn', m).onclick = () => {
      items = items.filter(i => i.name && i.qty > 0);
      if (!items.length) { toast('Add at least one item','error'); return; }
      const total = items.reduce((s,i) => s + (i.qty * i.rate), 0);
      const paid = Math.min(total, Math.max(0, +$('#poPaid', m).value || 0));
      const due = total - paid;
      const data = {
        poNo: existing ? po.poNo : DB.nextPONumber(),
        vendorId: $('#poVen', m).value,
        date: $('#poDate', m).value,
        items, total, paid, due,
        status: $('#poStatusSel', m).value,
        notes: $('#poNotes', m).value.trim(),
        userId: DB.currentUser().id
      };
      if (existing) DB.update('purchaseOrders', existing.id, data);
      else DB.insert('purchaseOrders', data);
      closeModal(); toast('Purchase order saved','success'); renderPOBody();
    };
  }});
}

/* ===== Record payment to vendor ===== */
function openPOPayment(poId) {
  const po = DB.get('purchaseOrders', poId);
  if (!po) return;
  const v = DB.get('vendors', po.vendorId) || { name:'-' };
  openModal(`
    <h3>💰 Pay Vendor — ${escapeHtml(po.poNo)}</h3>
    <p class="sub">Vendor: <b>🏭 ${escapeHtml(v.name)}</b> • Date: ${po.date}</p>
    <div style="padding:10px;background:var(--surface-alt);border-radius:8px;margin-bottom:14px;">
      Total: <b>${fmtMoney(po.total)}</b> • Paid so far: <b>${fmtMoney(po.paid)}</b> •
      <span style="color:var(--danger);">Due: <b>${fmtMoney(po.due)}</b></span>
    </div>
    <div class="form-row">
      <div class="field"><label>Pay Now (Rs.)</label><input type="number" id="payAmt" value="${po.due}" min="0" max="${po.due}"/></div>
      <div class="field"><label>Update Status</label>
        <select id="statusSel">
          ${['pending','received','invoiced','paid'].map(s => `<option value="${s}" ${po.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-success" id="saveBtn">💾 Record Payment</button>
    </div>
  `, { onOpen(m){
    $('#saveBtn', m).onclick = () => {
      const amt = Math.max(0, +$('#payAmt', m).value || 0);
      const newPaid = Math.min(po.total, po.paid + amt);
      const newDue = po.total - newPaid;
      let status = $('#statusSel', m).value;
      if (newDue === 0 && status !== 'paid') status = 'paid';
      DB.update('purchaseOrders', poId, { paid: newPaid, due: newDue, status });
      closeModal(); toast(`Payment of ${fmtMoney(amt)} recorded`,'success'); renderPOBody();
    };
  }});
}

/* ============================================================
   PURCHASE ORDER — THERMAL (58/80mm) SLIP
   ============================================================
   Client: "purchase order mein print ka option hai — uski setting aisi karo ke
   thermal printer ke liye proper fit ho; abhi jo layout hai woh thermal ke liye
   design nahi hai."

   Purana masla (kya ghalat tha):
   • PO print invoice wali CSS inherit kar raha tha — items table par 46%/54%
     column rule, terms/cut-line, 520px max-width, bara centred logo. 80mm roll
     par sab kuch toot kar 3-4 page banta tha.
   • Item ka rate aur qty columns bahar nikal jate the.
   • Roll 52 pcs / 12 items par bhi bekaar kaghaz kharch karta tha.

   Ab: dedicated `.po-slip` (monochrome, 4 fixed columns, natural height),
   printElement() ko `docSheet: true` ke sath diya jata hai — invoice rules band. */

/* Ek PO ka thermal slip markup (view modal + print + WhatsApp sab isi se) */
function buildPOSlip(po, opts) {
  opts = opts || {};
  const v = (typeof DB.get === 'function' ? DB.get('vendors', po.vendorId) : null) || { name: '-' };
  const s = DB.settings();
  const esc = (x) => (typeof escapeHtml === 'function' ? escapeHtml(x == null ? '' : x) : String(x == null ? '' : x));
  const money = (x) => 'Rs. ' + (Math.round(+x || 0)).toLocaleString('en-PK');

  const items = Array.isArray(po.items) ? po.items : [];
  const totalQty = items.reduce((n, it) => n + (+it.qty || 0), 0);
  const totalTypes = items.length;

  /* 4 columns: ITEM (flex) | QTY | RATE | AMOUNT — thermal ki asli chaurai ke liye */
  const itemRows = items.map((it, i) => `
    <tr>
      <td class="po-it">${i + 1}. ${esc(it.name)}</td>
      <td class="po-qty">${esc(it.qty)}</td>
      <td class="po-rate">${money(it.rate)}</td>
      <td class="po-amt">${money((+it.qty || 0) * (+it.rate || 0))}</td>
    </tr>`).join('');

  const logoHtml = s.logoImage
    ? `<div class="po-logo"><img src="${s.logoImage}" alt=""/></div>`
    : (s.logo ? `<div class="po-logo po-logo-emoji">${s.logo}</div>` : '');

  /* printer ki paper width (Settings → Invoice/Print) ke mutabiq slip chaurai */
  const narrow = (String(s.invoicePaper || '') === '58') ? ' po-58' : '';
  return `
  <div class="po-slip doc-sheet${narrow}">
    ${logoHtml}
    <div class="po-shop">${esc(s.shopName || 'MODERN DRY CLEANERS')}</div>
    <div class="po-shop-sub">${esc(s.tagline || '')}</div>
    <div class="po-shop-meta">${esc(s.address || '')}${s.phone ? ' • ' + esc(s.phone) : ''}</div>
    <div class="po-rule"></div>

    <div class="po-title">PURCHASE ORDER</div>
    <div class="po-rule"></div>

    <table class="po-kv">
      <tr><td class="po-kv-l">PO No</td><td class="po-kv-v po-no">${esc(po.poNo)}</td></tr>
      <tr><td class="po-kv-l">Date</td><td class="po-kv-v">${esc(po.date)}</td></tr>
      <tr><td class="po-kv-l">Vendor</td><td class="po-kv-v">${esc(v.name)}</td></tr>
      ${v.contactPerson ? `<tr><td class="po-kv-l">Contact</td><td class="po-kv-v">${esc(v.contactPerson)}</td></tr>` : ''}
      ${v.phone ? `<tr><td class="po-kv-l">Phone</td><td class="po-kv-v">${esc(v.phone)}</td></tr>` : ''}
    </table>
    <div class="po-rule"></div>

    <table class="po-items">
      <thead>
        <tr>
          <th class="po-it">ITEM</th>
          <th class="po-qty">QTY</th>
          <th class="po-rate">RATE</th>
          <th class="po-amt">AMOUNT</th>
        </tr>
      </thead>
      <tbody>${itemRows || `<tr><td colspan="4" class="po-empty">Koi item nahi</td></tr>`}</tbody>
    </table>
    <div class="po-rule"></div>

    <table class="po-kv po-totals">
      <tr><td class="po-kv-l">Items</td><td class="po-kv-v">${totalTypes} types • ${totalQty} pcs</td></tr>
      <tr class="po-grand"><td class="po-kv-l">TOTAL</td><td class="po-kv-v">${money(po.total)}</td></tr>
      <tr><td class="po-kv-l">Paid</td><td class="po-kv-v">${money(po.paid)}</td></tr>
      ${(+po.due || 0) > 0 ? `<tr class="po-due"><td class="po-kv-l">DUE</td><td class="po-kv-v">${money(po.due)}</td></tr>` : ''}
      <tr><td class="po-kv-l">Status</td><td class="po-kv-v">${esc(String(po.status || '').toUpperCase())}</td></tr>
    </table>

    ${po.notes ? `<div class="po-rule"></div><div class="po-notes">Note: ${esc(po.notes)}</div>` : ''}

    <div class="po-rule"></div>
    <div class="po-sign">
      <span>Vendor Signature</span>
      <span>Authorized</span>
    </div>
    <div class="po-foot">${esc(s.shopName || '')} • Generated ${esc(new Date().toLocaleDateString('en-GB'))}</div>
    ${opts.cutLine === false ? '' : '<div class="po-cut">- - - - - - - - - - - - - - -</div>'}
  </div>`;
}

/* View + Print modal */
function openPOInvoice(poId, autoPrint) {
  const po = DB.get('purchaseOrders', poId);
  if (!po) return;
  const slip = buildPOSlip(po);

  openModal(`
    <div class="no-print" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:10px;flex-wrap:wrap;">
      <h3 style="margin:0;">📑 Purchase Order ${escapeHtml(po.poNo)}</h3>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary btn-sm" id="poPrintBtn">🖨️ Print (Thermal)</button>
        <button class="btn btn-ghost btn-sm" onclick="closeModal()">Close</button>
      </div>
    </div>
    <div class="po-preview-wrap" style="background:#eef1f6;padding:14px;border-radius:12px;display:flex;justify-content:center;">
      ${slip}
    </div>
    <div class="no-print" style="font-size:11.5px;color:#475569;margin:8px 0 0;text-align:center;font-weight:600;">
      Roll: ${escapeHtml(String(DB.settings().invoicePaper || '80'))}mm thermal • Slip ki chaurai Settings → Print se aati hai (58mm chunain to slip khud patli ho jati hai)
    </div>
  `, { large: true, onOpen(m) {
      const btn = m.querySelector('#poPrintBtn');
      if (btn) btn.onclick = () => {
        const el = m.querySelector('.po-slip');
        /* docSheet = true → invoice ke 46/54 column + cut-line rules band */
        if (typeof printElement === 'function') printElement(el, { title: 'Purchase Order ' + po.poNo, docSheet: true });
      };
      if (autoPrint && typeof printElement === 'function') {
        setTimeout(() => printElement(m.querySelector('.po-slip'), { title: 'Purchase Order ' + po.poNo, docSheet: true }), 250);
      }
  }});
}

/* ===== Weekly Consolidated Invoice for a Vendor ===== */
function openWeeklyInvoiceDialog() {
  const vendors = DB.all('vendors');
  if (!vendors.length) { toast('Add a vendor first','error'); return; }
  const today = new Date();
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate()-6);

  openModal(`
    <h3>🧾 Generate Weekly Vendor Invoice</h3>
    <p class="sub">Pick a vendor and date range to generate a consolidated invoice.</p>
    <div class="form-row">
      <div class="field">
        <label>Vendor *</label>
        <select id="wiVen">${vendors.map(v=>`<option value="${v.id}">🏭 ${escapeHtml(v.name)}</option>`).join('')}</select>
      </div>
      <div class="field">
        <label>Preset</label>
        <select id="wiPreset">
          <option value="week">Last 7 days</option>
          <option value="thisweek">This week (Mon-today)</option>
          <option value="month">This month</option>
          <option value="custom">Custom</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="field"><label>From</label><input type="date" id="wiFrom" value="${isoDay(weekAgo)}"/></div>
      <div class="field"><label>To</label><input type="date" id="wiTo" value="${isoDay(today)}"/></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="genBtn">🧾 Generate Invoice</button>
    </div>
  `, { onOpen(m){
    $('#wiPreset', m).onchange = e => {
      const t = new Date();
      if (e.target.value === 'week') {
        const d = new Date(); d.setDate(d.getDate()-6);
        $('#wiFrom', m).value = isoDay(d); $('#wiTo', m).value = isoDay(t);
      } else if (e.target.value === 'thisweek') {
        const d = new Date(); const day = d.getDay(); const diff = day === 0 ? 6 : day-1;
        d.setDate(d.getDate()-diff);
        $('#wiFrom', m).value = isoDay(d); $('#wiTo', m).value = isoDay(t);
      } else if (e.target.value === 'month') {
        $('#wiFrom', m).value = isoDay(new Date(t.getFullYear(),t.getMonth(),1));
        $('#wiTo', m).value = isoDay(t);
      }
    };
    $('#genBtn', m).onclick = () => {
      const vendorId = $('#wiVen', m).value;
      const from = $('#wiFrom', m).value, to = $('#wiTo', m).value;
      closeModal();
      showWeeklyInvoice(vendorId, from, to);
    };
  }});
}

function showWeeklyInvoice(vendorId, from, to) {
  const v = DB.get('vendors', vendorId);
  const s = DB.settings();
  const esc = (x) => (typeof escapeHtml === 'function' ? escapeHtml(x == null ? '' : x) : String(x == null ? '' : x));
  const money = (x) => 'Rs. ' + (Math.round(+x || 0)).toLocaleString('en-PK');

  const pos = DB.all('purchaseOrders')
    .filter(p => p.vendorId === vendorId && p.date >= from && p.date <= to)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  if (!pos.length) { toast('No purchase orders in this date range', 'warning'); return; }

  /* item-wise summary (same naam + rate ek line me) */
  const itemSummary = {};
  let grandTotal = 0, grandPaid = 0;
  pos.forEach(p => {
    grandTotal += (+p.total || 0);
    grandPaid += (+p.paid || 0);
    (p.items || []).forEach(it => {
      const k = it.name + '|' + it.rate;
      if (!itemSummary[k]) itemSummary[k] = { name: it.name, rate: it.rate, qty: 0, total: 0 };
      itemSummary[k].qty += (+it.qty || 0);
      itemSummary[k].total += (+it.qty || 0) * (+it.rate || 0);
    });
  });
  const grandDue = grandTotal - grandPaid;

  /* Thermal ke liye 4 columns: ITEM | QTY | RATE | AMOUNT */
  const summaryHtml = Object.values(itemSummary).map((x, i) => `
    <tr>
      <td class="po-it">${i + 1}. ${esc(x.name)}</td>
      <td class="po-qty">${x.qty}</td>
      <td class="po-rate">${money(x.rate)}</td>
      <td class="po-amt">${money(x.total)}</td>
    </tr>`).join('');

  /* PO list — thermal par 6 columns namumkin the; ab 3: PO+date | qty | total */
  const poListHtml = pos.map(p => {
    const q = (p.items || []).reduce((n, i) => n + (+i.qty || 0), 0);
    return `<tr>
      <td class="po-it"><b>${esc(p.poNo)}</b><br><span class="po-sub">${esc(p.date)}</span></td>
      <td class="po-qty">${q}</td>
      <td class="po-amt">${money(p.total)}</td>
    </tr>`;
  }).join('');

  const slipHtml = `
  <div class="po-slip doc-sheet">
    ${s.logoImage ? `<div class="po-logo"><img src="${s.logoImage}" alt=""/></div>` : (s.logo ? `<div class="po-logo po-logo-emoji">${s.logo}</div>` : '')}
    <div class="po-shop">${esc(s.shopName || 'MODERN DRY CLEANERS')}</div>
    <div class="po-shop-meta">${esc(s.address || '')}${s.phone ? ' • ' + esc(s.phone) : ''}</div>
    <div class="po-rule"></div>
    <div class="po-title">VENDOR INVOICE</div>
    <div class="po-subtitle">Weekly Summary</div>
    <div class="po-rule"></div>

    <table class="po-kv">
      <tr><td class="po-kv-l">Vendor</td><td class="po-kv-v">${esc(v.name)}</td></tr>
      ${v.contactPerson ? `<tr><td class="po-kv-l">Contact</td><td class="po-kv-v">${esc(v.contactPerson)}</td></tr>` : ''}
      ${v.phone ? `<tr><td class="po-kv-l">Phone</td><td class="po-kv-v">${esc(v.phone)}</td></tr>` : ''}
      <tr><td class="po-kv-l">Period</td><td class="po-kv-v">${esc(from)} → ${esc(to)}</td></tr>
      <tr><td class="po-kv-l">POs</td><td class="po-kv-v">${pos.length}</td></tr>
      <tr><td class="po-kv-l">Printed</td><td class="po-kv-v">${esc(isoDay())}</td></tr>
    </table>
    <div class="po-rule"></div>

    <div class="po-sec">ITEM SUMMARY</div>
    <table class="po-items">
      <thead><tr>
        <th class="po-it">ITEM</th><th class="po-qty">QTY</th><th class="po-rate">RATE</th><th class="po-amt">AMOUNT</th>
      </tr></thead>
      <tbody>${summaryHtml}</tbody>
    </table>
    <div class="po-rule"></div>

    <div class="po-sec">PURCHASE ORDERS (${pos.length})</div>
    <table class="po-items po-polist">
      <thead><tr><th class="po-it">PO / DATE</th><th class="po-qty">QTY</th><th class="po-amt">TOTAL</th></tr></thead>
      <tbody>${poListHtml}</tbody>
    </table>
    <div class="po-rule"></div>

    <table class="po-kv po-totals">
      <tr class="po-grand"><td class="po-kv-l">GRAND TOTAL</td><td class="po-kv-v">${money(grandTotal)}</td></tr>
      <tr><td class="po-kv-l">Paid</td><td class="po-kv-v">${money(grandPaid)}</td></tr>
      <tr class="${grandDue > 0 ? 'po-due' : ''}"><td class="po-kv-l">OUTSTANDING</td><td class="po-kv-v">${money(grandDue)}</td></tr>
    </table>

    <div class="po-rule"></div>
    <div class="po-sign"><span>Vendor Signature</span><span>Authorized</span></div>
    <div class="po-foot">${esc(s.shopName || '')} • Generated ${esc(new Date().toLocaleDateString('en-GB'))}</div>
    <div class="po-cut">- - - - - - - - - - - - - - -</div>
  </div>`;

  openModal(`
    <div class="no-print" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:10px;flex-wrap:wrap;">
      <h3 style="margin:0;">🧾 Weekly Invoice — ${esc(v.name)}</h3>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary btn-sm" id="poWeekPrintBtn">🖨️ Print (Thermal)</button>
        <button class="btn btn-ghost btn-sm" onclick="closeModal()">Close</button>
      </div>
    </div>
    <div class="po-preview-wrap" style="background:#eef1f6;padding:14px;border-radius:12px;display:flex;justify-content:center;">
      ${slipHtml}
    </div>
    <div class="no-print" style="font-size:11.5px;color:#475569;margin:8px 0 0;text-align:center;font-weight:600;">
      Roll: ${escapeHtml(String(DB.settings().invoicePaper || '80'))}mm thermal • Slip ki chaurai Settings → Print se aati hai (58mm chunain to slip khud patli ho jati hai)
    </div>
  `, { large: true, onOpen(m) {
      const btn = m.querySelector('#poWeekPrintBtn');
      if (btn) btn.onclick = () => {
        if (typeof printElement === 'function')
          printElement(m.querySelector('.po-slip'), { title: 'Vendor Invoice ' + v.name, docSheet: true });
      };
  }});
}
