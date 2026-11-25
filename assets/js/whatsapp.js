/* ============================================================
   WhatsApp Status Notifications (one-click, FREE)
   When order status changes, show "Send WhatsApp?" popup.
   ============================================================ */

const WA_STATUS_TEMPLATES = {
  pending: {
    label: 'Pending',
    icon: '⏳',
    template: `Hello {name}, your order has been booked at {shop}.\n\nInvoice: {invoice}\nTotal Pcs: {pcs}\nAmount: {total}\nExpected Delivery: {delivery}\n\nThank you for choosing us!`
  },
  washing: {
    label: 'Washing',
    icon: '🌀',
    template: `Hello {name}, your clothes are now being washed 🌀\n\nInvoice: {invoice}\nExpected Delivery: {delivery}\n\nThank you,\n{shop}`
  },
  ironing: {
    label: 'Press (Ironing)',
    icon: '🧺',
    template: `Hello {name}, good news! Your clothes have been washed and are now being pressed (ironed) 🧺\n\nInvoice: {invoice}\nTotal Pcs: {pcs}\nExpected Delivery: {delivery}\n\nWe will inform you as soon as your order is ready for pickup.\n📞 {phone}\n{shop}`
  },
  ready: {
    label: 'Ready for Pickup',
    icon: '✅',
    template: `Good news {name}! Your order is ready for pickup ✅\n\nInvoice: {invoice}\nTotal Pcs: {pcs}\nAmount: {total}\nDue: {due}\n\nPlease visit us at your convenience.\n📞 {phone}\n{shop}`
  },
  delivered: {
    label: 'Delivered',
    icon: '📦',
    template: `Thank you {name} for collecting your order from {shop}!\n\nInvoice: {invoice}\n\nWe hope you are satisfied with our service. ⭐⭐⭐⭐⭐\n\nLooking forward to serving you again!`
  },
  cancelled: {
    label: 'Cancelled',
    icon: '❌',
    template: `Hello {name}, your order {invoice} has been cancelled.\n\nIf this is incorrect, please contact us at {phone}.\n\nThank you,\n{shop}`
  }
};

function maybePromptWhatsAppOnStatus(orderId, newStatus, oldStatus) {
  if (newStatus === oldStatus) return;
  const s = DB.settings();
  if (s.whatsappAutoPrompt === false) return;
  // "Don't ask again today" (pause) — lekin Press par customer ko update zaroor jaye
  const paused = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('mrLaundryWaPause');
  if (paused && newStatus !== 'ironing') return;

  const o = DB.get('orders', orderId);
  if (!o) return;
  const c = DB.get('customers', o.customerId);
  if (!c || !c.phone) return;

  const tpl = WA_STATUS_TEMPLATES[newStatus];
  if (!tpl) return;

  openWhatsAppStatusDialog(orderId, newStatus);
}

function openWhatsAppStatusDialog(orderId, status) {
  const o = DB.get('orders', orderId);
  const c = DB.get('customers', o.customerId) || {};
  if (!c.phone) { toast('No phone number for this customer','warning'); return; }
  const s = DB.settings();
  const tpl = WA_STATUS_TEMPLATES[status] || WA_STATUS_TEMPLATES.ready;
  const isPress = status === 'ironing';

  const invoiceNo = DB.invoiceLabel(o);
  const totalPcs = (typeof DB !== 'undefined' && typeof DB.orderPieces === 'function')
    ? DB.orderPieces(o)
    : (o.items || []).reduce((sum, it) => sum + (it.qty || 0), 0);

  const vars = {
    '{name}':     c.name || 'Customer',
    '{shop}':     s.shopName,
    '{invoice}':  invoiceNo,
    '{pcs}':      totalPcs,
    '{total}':    fmtMoney(o.total),
    '{paid}':     fmtMoney(o.paid),
    '{due}':      fmtMoney(o.due),
    '{delivery}': o.deliveryDate || 'TBD',
    '{phone}':    s.phone || '',
    '{address}':  s.address || ''
  };

  let msg = tpl.template;
  Object.entries(vars).forEach(([k,v]) => { msg = msg.split(k).join(v); });

  // Clean phone for WhatsApp
  let phone = c.phone.replace(/[^\d+]/g, '');
  if (phone.startsWith('+')) phone = phone.substring(1);
  if (phone.startsWith('0') && phone.length === 11) phone = '92' + phone.substring(1);

  openModal(`
    <div style="background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;padding:16px;border-radius:10px;margin-bottom:14px;text-align:center;">
      <div style="font-size:36px;">${tpl.icon}📱</div>
      <h3 style="color:#fff;margin:4px 0;font-size:18px;">Status Changed to: ${tpl.label}</h3>
      <div style="font-size:13px;opacity:.9;">Send WhatsApp notification to <b>${escapeHtml(c.name)}</b>?</div>
      <div style="font-size:11px;opacity:.8;margin-top:4px;">📞 +${phone}</div>
    </div>

    <div class="field">
      <label>Message (you can edit before sending)</label>
      <textarea id="waStatusMsg" rows="9" style="width:100%;padding:12px;border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;">${escapeHtml(msg)}</textarea>
    </div>

    <div style="background:var(--surface-alt);padding:10px;border-radius:8px;font-size:12px;color:var(--text-soft);margin-bottom:12px;">
      💡 Clicking <b>Send</b> opens WhatsApp Web/App with this message pre-filled — you just press the send arrow.
    </div>

    <!-- PDF ke sath bhejne ka option (client requirement: professional colour copy) -->
    <div style="border:2px solid #25D366;border-radius:10px;padding:12px;margin-bottom:12px;background:#f0fdf4;">
      <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;">
        <input type="checkbox" id="waAttachPdf" ${(DB.settings().whatsappAttachPdf !== false) ? 'checked' : ''} style="width:20px;height:20px;margin-top:2px;accent-color:#25D366;"/>
        <span style="font-size:13px;line-height:1.5;">
          <b>📄 Invoice PDF bhi bhejein</b> <span style="background:#25D366;color:#fff;font-size:10px;padding:1px 6px;border-radius:6px;font-weight:800;">RECOMMENDED</span><br>
          <span style="color:var(--text-soft);font-size:12px;">Customer ko proper colour invoice milega (logo, invoice no., pieces, terms) — professional impression.</span>
        </span>
      </label>
      <div style="font-size:11px;color:#166534;margin-top:8px;line-height:1.5;" id="waPdfHint">
        📱 <b>Phone:</b> PDF + message dono share honge — WhatsApp chunein, chat chunein, send.<br>
        💻 <b>PC:</b> PDF save hogi aur WhatsApp chat khulegi — sirf 📎 attach karna hai.
      </div>
    </div>

    <label style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:12px;">
      <input type="checkbox" id="waDontAsk"/> Don't ask again for status changes today
    </label>

    <div class="modal-footer" style="flex-wrap:wrap;gap:8px;">
      <button class="btn btn-ghost" onclick="closeModal()">Skip</button>
      <button class="btn btn-secondary" id="copyWaBtn">📋 Copy</button>
      <button class="btn btn-secondary" id="sendWaBtn">📱 Message Only</button>
      <button class="btn btn-success btn-lg" id="sendWaPdfBtn" style="padding:14px 24px;font-size:15px;">📄📱 Send WhatsApp + PDF</button>
    </div>
  `, { large: true, onOpen(m) {
    /* Owner ki pasand yaad rakhein — agli dafa wohi default rahe */
    const attachEl = $('#waAttachPdf', m);
    if (attachEl) attachEl.onchange = () => {
      try { DB.saveSettings({ whatsappAttachPdf: !!attachEl.checked }); } catch (e) {}
    };

    if (attachEl) {
      const pdfB = $('#sendWaPdfBtn', m);
      const syncBtn = () => { if (pdfB) pdfB.innerHTML = attachEl.checked ? '📄📱 Send WhatsApp + PDF' : '📱 Send WhatsApp Now'; };
      attachEl.addEventListener('change', syncBtn); syncBtn();
      attachEl.addEventListener('change', () => {
        if ($('#sendWaBtn', m)) $('#sendWaBtn', m).style.display = attachEl.checked ? '' : 'none';
      });
      if (attachEl.checked && $('#sendWaBtn', m)) $('#sendWaBtn', m).style.display = '';
    }

    $('#copyWaBtn', m).onclick = () => {
      navigator.clipboard.writeText($('#waStatusMsg', m).value)
        .then(() => toast('Copied to clipboard','success'));
    };
    const markSent = (channel) => {
      if (typeof logAction === 'function') {
        logAction('whatsapp.sent', `Status "${status}" → ${c.name} (${DB.invoiceLabel(o)}) [${channel}]`);
      }
      const sent = o.whatsappLog || [];
      sent.push({ status, sentAt: new Date().toISOString(), by: DB.currentUser()?.username, channel });
      DB.update('orders', orderId, { whatsappLog: sent });
      if ($('#waDontAsk', m) && $('#waDontAsk', m).checked) {
        sessionStorage.setItem('mrLaundryWaPause', isoDay());
      }
    };

    $('#sendWaBtn', m).onclick = () => {
      const text = $('#waStatusMsg', m).value;
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
      markSent('whatsapp-text');
      toast('Opening WhatsApp...', 'success');
      closeModal();
    };

    /* PDF ke sath — client ki requirement (professional colour copy) */
    const pdfBtn = $('#sendWaPdfBtn', m);
    if (pdfBtn) pdfBtn.onclick = async () => {
      const text = $('#waStatusMsg', m).value;
      if (!(window.MDC_PDF && window.MDC_PDF.sendInvoicePdfOnWhatsApp)) {
        toast('PDF engine load nahi hua — page refresh karein', 'error');
        return;
      }
      const label = pdfBtn.innerHTML;
      pdfBtn.disabled = true;
      pdfBtn.innerHTML = '⏳ PDF ban rahi hai…';
      let res = 'error';
      try {
        res = await window.MDC_PDF.sendInvoicePdfOnWhatsApp(o, text);
      } catch (e) {
        toast('PDF bhejne me masla: ' + (e.message || e), 'error');
      }
      pdfBtn.disabled = false;
      pdfBtn.innerHTML = label;
      if (res === 'cancelled') return;
      if (res === 'shared') { markSent('whatsapp-pdf'); toast('✅ PDF + message share ho gaye', 'success'); closeModal(); }
      else if (res === 'downloaded') { markSent('whatsapp-pdf'); toast('PDF save ho gayi — WhatsApp me 📎 attach karein', 'success', 8000); closeModal(); }
      else if (res === 'no-phone') { toast('Customer ka phone number nahi hai', 'error'); }
    };
  }});
}

/* Edit status templates from settings */
function openWhatsAppTemplateEditor() {
  const s = DB.settings();
  const overrides = s.whatsappStatusTemplates || {};

  openModal(`
    <h3>📱 WhatsApp Status Templates</h3>
    <p class="sub">Customize messages for each status. Use {name} {shop} {invoice} {pcs} {total} {paid} {due} {delivery} {phone} {address}.</p>

    <label style="display:flex;align-items:center;gap:6px;font-size:13px;margin-bottom:14px;padding:10px;background:var(--surface-alt);border-radius:8px;">
      <input type="checkbox" id="waAutoPrompt" ${s.whatsappAutoPrompt!==false?'checked':''}/>
      <b>Auto-prompt WhatsApp when order status changes</b>
    </label>

    ${Object.entries(WA_STATUS_TEMPLATES).map(([key, tpl]) => `
      <div class="field">
        <label>${tpl.icon} ${tpl.label}</label>
        <textarea data-tpl="${key}" rows="5" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:12px;">${escapeHtml(overrides[key] || tpl.template)}</textarea>
      </div>
    `).join('')}

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-secondary" id="resetBtn">Reset to Defaults</button>
      <button class="btn btn-primary" id="saveBtn">💾 Save Templates</button>
    </div>
  `, { large: true, onOpen(m) {
    $('#saveBtn', m).onclick = () => {
      const templates = {};
      $$('[data-tpl]', m).forEach(ta => {
        templates[ta.dataset.tpl] = ta.value;
        // Live-update WA_STATUS_TEMPLATES so it takes effect immediately
        if (WA_STATUS_TEMPLATES[ta.dataset.tpl]) {
          WA_STATUS_TEMPLATES[ta.dataset.tpl].template = ta.value;
        }
      });
      DB.saveSettings({
        whatsappStatusTemplates: templates,
        whatsappAutoPrompt: $('#waAutoPrompt', m).checked
      });
      toast('Templates saved','success');
      closeModal();
    };
    $('#resetBtn', m).onclick = () => {
      confirmDialog('Reset all templates to defaults?', () => {
        DB.saveSettings({ whatsappStatusTemplates: {} });
        toast('Reset done','success');
        closeModal();
      });
    };
  }});
}

/* Apply saved template overrides on load */
(function loadTemplateOverrides() {
  if (typeof DB === 'undefined') return;
  const s = DB.settings();
  const overrides = s.whatsappStatusTemplates || {};
  Object.entries(overrides).forEach(([key, val]) => {
    if (WA_STATUS_TEMPLATES[key]) WA_STATUS_TEMPLATES[key].template = val;
  });
})();

/* ===== WhatsApp Message Picker — cashier picks which message to send anytime ===== */
function openWhatsAppPicker(orderId) {
  const o = DB.get('orders', orderId);
  if (!o) return;
  const c = DB.get('customers', o.customerId) || {};
  if (!c.phone) { toast('Customer has no phone number','warning'); return; }
  const invoiceNo = DB.invoiceLabel(o);
  const totalPcs = (typeof DB !== 'undefined' && typeof DB.orderPieces === 'function')
    ? DB.orderPieces(o)
    : (o.items || []).reduce((sum, it) => sum + (it.qty || 0), 0);

  // Build sent history
  const history = o.whatsappLog || [];
  const historyHtml = history.length
    ? '<div style="background:var(--surface-alt);padding:10px;border-radius:8px;margin-bottom:14px;font-size:12px;"><b>📜 Sent History:</b><br>' +
      history.map(h => `<div>✅ ${h.status} — ${fmtDate(h.sentAt)} by ${h.by || '?'}</div>`).join('') + '</div>'
    : '';

  openModal(`
    <h3>📱 Send WhatsApp to ${escapeHtml(c.name)}</h3>
    <p class="sub">Invoice ${invoiceNo} • ${totalPcs} pcs • ${escapeHtml(c.phone)}</p>

    ${historyHtml}

    <p style="font-size:13px;font-weight:700;margin-bottom:8px;">Choose message template:</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      ${Object.entries(WA_STATUS_TEMPLATES).map(([key, tpl]) => `
        <button class="btn btn-secondary wa-pick" data-status="${key}" style="padding:14px 10px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px;">
          <span style="font-size:24px;">${tpl.icon}</span>
          <b style="font-size:13px;">${tpl.label}</b>
        </button>
      `).join('')}
    </div>

    <button class="btn btn-success btn-block" id="waPdfQuick" style="margin-top:10px;padding:14px;font-size:14px;">📄 Invoice PDF WhatsApp par bhejein</button>
    <button class="btn btn-warning btn-block" id="customBtn" style="margin-top:8px;">✏️ Write Custom Message</button>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    </div>
  `, { onOpen(m) {
    m.querySelectorAll('.wa-pick').forEach(b => b.onclick = () => {
      const status = b.dataset.status;
      closeModal();
      openWhatsAppStatusDialog(orderId, status);
    });
    const quickPdf = $('#waPdfQuick', m);
    if (quickPdf) quickPdf.onclick = async () => {
      if (!(window.MDC_PDF && window.MDC_PDF.sendInvoicePdfOnWhatsApp)) { toast('PDF engine load nahi hua', 'error'); return; }
      quickPdf.disabled = true; quickPdf.textContent = '⏳ PDF ban rahi hai…';
      const s = DB.settings();
      const txt = `Hello ${c.name || 'Customer'}, yeh aap ka invoice ${invoiceNo} hai — ${s.shopName}.

Aap ka invoice PDF attach hai. Shukriya!`;
      const res = await window.MDC_PDF.sendInvoicePdfOnWhatsApp(o, txt);
      quickPdf.disabled = false; quickPdf.textContent = '📄 Invoice PDF WhatsApp par bhejein';
      if (res === 'shared') { toast('✅ PDF share ho gayi', 'success'); closeModal(); }
      else if (res === 'downloaded') { toast('PDF save ho gayi — WhatsApp me 📎 attach karein', 'success', 8000); closeModal(); }
      else if (res === 'no-phone') toast('Phone number nahi hai', 'error');
    };

    $('#customBtn', m).onclick = () => {
      // Use generic invoice WhatsApp
      closeModal();
      if (typeof sendWhatsAppInvoice === 'function') {
        const s = DB.settings();
        const delTypeMap = {hanger:{label:'HANGER'},fold:{label:'FOLD'},both:{label:'BOTH'}};
        sendWhatsAppInvoice(o, c, s, invoiceNo, totalPcs, delTypeMap[o.deliveryType||'hanger']||{label:'HANGER'});
      }
    };
  }});
}
