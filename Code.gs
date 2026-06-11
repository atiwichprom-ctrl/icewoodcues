// ══════════════════════════════════════════════════════════════════════
// ICEWOOD CUES — Google Apps Script Backend  v5.0
// ══════════════════════════════════════════════════════════════════════
// SETUP:
//   1. เปิด script.google.com → New project
//   2. วางโค้ดนี้ทั้งหมด
//   3. Deploy → New deployment → Web app
//      Execute as: Me | Who has access: Anyone
//   4. Copy Web App URL ใส่ใน config.js ช่อง gasUrl
// ══════════════════════════════════════════════════════════════════════

const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID_HERE'; // ← ใส่ Sheet ID ของคุณ

// ── LINE Messaging API (แจ้งเตือนออเดอร์ใหม่) ───────────────────────
// หมายเหตุ: LINE Notify ปิดบริการแล้ว (มี.ค. 2025) — ใช้ Messaging API แทน
//   1. สร้าง Channel ที่ https://developers.line.biz → Messaging API
//   2. Copy "Channel access token" ใส่ LINE_CHANNEL_TOKEN
//   3. ใส่ userId หรือ groupId ผู้รับใน LINE_TARGET_ID
//   (เว้นว่างไว้ = ปิดการแจ้งเตือน ระบบยังทำงานปกติ)
const LINE_CHANNEL_TOKEN = '';
const LINE_TARGET_ID     = '';

const SHEETS = {
  INVENTORY    : 'Inventory',
  ORDERS       : 'Orders',
  ORDER_ITEMS  : 'OrderItems',
  CUSTOM       : 'CustomOrders',
  CRM          : 'CRM',
  SALES        : 'Sales',
  MATERIALS    : 'Materials',
  AUDIT        : 'Audit',
};

// ─────────────────────────────────────────────────────────────────────
// CORS helper
// ─────────────────────────────────────────────────────────────────────
function corsOutput(data) {
  const out = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// doGet — Read data
// ─────────────────────────────────────────────────────────────────────
function doGet(e) {
  try {
    const action = (e.parameter.action || 'ping').toLowerCase();
    const ss = SpreadsheetApp.openById(SHEET_ID);

    if (action === 'ping') {
      return corsOutput({ ok: true, ts: new Date().toISOString(), version: '5.0' });
    }

    if (action === 'inventory') {
      return corsOutput({ ok: true, data: sheetToObjects(ss, SHEETS.INVENTORY) });
    }

    if (action === 'orders') {
      const orders = sheetToObjects(ss, SHEETS.ORDERS);
      const items  = sheetToObjects(ss, SHEETS.ORDER_ITEMS);
      // Attach items to each order
      orders.forEach(function(o) {
        o.items = items.filter(function(i) { return i.orderId === o.id; });
      });
      return corsOutput({ ok: true, data: orders });
    }

    if (action === 'custom') {
      return corsOutput({ ok: true, data: sheetToObjects(ss, SHEETS.CUSTOM) });
    }

    if (action === 'crm') {
      return corsOutput({ ok: true, data: sheetToObjects(ss, SHEETS.CRM) });
    }

    if (action === 'materials') {
      return corsOutput({ ok: true, data: sheetToObjects(ss, SHEETS.MATERIALS) });
    }

    if (action === 'dashboard') {
      const inv   = sheetToObjects(ss, SHEETS.INVENTORY);
      const ords  = sheetToObjects(ss, SHEETS.ORDERS);
      const crm   = sheetToObjects(ss, SHEETS.CRM);
      const sold  = ords.filter(function(o){ return o.status === 'ส่งมอบแล้ว'; });
      const rev   = sold.reduce(function(s,o){ return s + Number(o.total||0); }, 0);
      return corsOutput({ ok: true, data: {
        cueCount: inv.length,
        orderCount: ords.length,
        soldCount: sold.length,
        revenue: rev,
        crmCount: crm.length,
      }});
    }

    return corsOutput({ ok: false, error: 'Unknown action: ' + action });
  } catch(err) {
    return corsOutput({ ok: false, error: err.toString() });
  }
}

// ─────────────────────────────────────────────────────────────────────
// doPost — Write data
// ─────────────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = (body.action || '').toLowerCase();
    const ss     = SpreadsheetApp.openById(SHEET_ID);
    const ts     = new Date().toISOString();

    // ── SYNC ALL (full localStorage dump) ──────────────────────────
    if (action === 'sync_all') {
      if (body.inventory)   syncInventory(ss, body.inventory);
      if (body.orders)      syncOrders(ss, body.orders);
      if (body.custom)      syncCustomOrders(ss, body.custom);
      if (body.crm)         syncCRM(ss, body.crm);
      if (body.materials)   syncMaterials(ss, body.materials);
      auditLog(ss, 'sync_all', 'Full sync pushed', ts);
      return corsOutput({ ok: true, action: 'sync_all', ts });
    }

    // ── NEW MULTI-ITEM ORDER ────────────────────────────────────────
    if (action === 'new_order') {
      const orderId = body.id || 'ORD-' + Date.now();
      const oSheet = getOrCreate(ss, SHEETS.ORDERS);
      const iSheet = getOrCreate(ss, SHEETS.ORDER_ITEMS);

      // Write order header row
      ensureHeaders(oSheet, ['id','date','customer','contact','email','total','status','stage','note','payMethod','payRef','ts']);
      oSheet.appendRow([
        orderId, body.date || ts.slice(0,10),
        body.customer || '', body.contact || '', body.email || '',
        body.total || 0, body.status || 'รอยืนยัน', body.stage || 'new',
        body.note || '', body.payMethod || '', body.payRef || '', ts
      ]);

      // Write order items
      ensureHeaders(iSheet, ['orderId','serial','series','wood','butt','weight','tip','length','qty','unitPrice','lineTotal','note']);
      (body.items || []).forEach(function(item) {
        iSheet.appendRow([
          orderId, item.serial || '', item.series || '',
          item.wood || '', item.butt || '', item.weight || '',
          item.tip || '', item.length || '', item.qty || 1,
          item.price || 0, (item.price||0) * (item.qty||1),
          item.note || ''
        ]);
        // Mark cue as sold in inventory
        if (item.serial) updateInventoryStatus(ss, item.serial, 'ขายแล้ว');
      });

      // Update CRM
      updateCRM(ss, { name: body.customer, contact: body.contact, email: body.email,
                      total: body.total, orderId, ts });

      // Append to Sales
      const sSheet = getOrCreate(ss, SHEETS.SALES);
      ensureHeaders(sSheet, ['orderId','date','customer','total','items','ts']);
      sSheet.appendRow([orderId, body.date||ts.slice(0,10), body.customer||'', body.total||0, (body.items||[]).length, ts]);

      auditLog(ss, 'new_order', orderId + ' / ' + (body.customer||'') + ' / ฿' + (body.total||0), ts);

      // ── LINE Notify ──────────────────────────────────────────────
      var itemSummary = (body.items||[]).map(function(i){
        return '  \u2022 '+(i.series||'')+'\u00d7'+(i.qty||1)+' \u0e3f'+((i.price||0)*(i.qty||1)).toLocaleString();
      }).join('\n');
      notifyLine([
        '\n\ud83c\udfb1 \u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e43\u0e2b\u0e21\u0e48! '+orderId,
        '\ud83d\udc64 '+(body.customer||'\u2014')+'  \ud83d\udcde '+(body.contact||'\u2014'),
        '\ud83d\udcb3 '+(body.payMethod||'\u2014'),
        itemSummary,
        '\ud83d\udcb0 \u0e23\u0e27\u0e21 \u0e3f'+((body.total||0)).toLocaleString(),
        body.note ? '\ud83d\udcdd '+body.note : '',
      ].filter(Boolean).join('\n'));

      return corsOutput({ ok: true, orderId, ts });
    }

    // ── NEW CUSTOM ORDER ────────────────────────────────────────────
    if (action === 'new_custom') {
      const cSheet = getOrCreate(ss, SHEETS.CUSTOM);
      const cid = body.id || 'CO-' + Date.now();
      ensureHeaders(cSheet, ['id','date','customer','contact','items','total','status','note','ts']);
      cSheet.appendRow([
        cid, ts.slice(0,10),
        body.customer||'', body.contact||'',
        JSON.stringify(body.items||[]),
        body.total||0, body.status||'รับออเดอร์', body.note||'', ts
      ]);
      auditLog(ss, 'new_custom', cid + ' / ' + (body.customer||''), ts);
      return corsOutput({ ok: true, id: cid, ts });
    }

    // ── UPDATE ORDER STATUS / STAGE ─────────────────────────────────
    if (action === 'update_stage') {
      updateField(ss, SHEETS.ORDERS, 'id', body.id, { stage: body.stage, status: body.status });
      auditLog(ss, 'stage_change', body.id + ' → ' + body.stage, ts);
      return corsOutput({ ok: true, ts });
    }

    // ── UPDATE INVENTORY ────────────────────────────────────────────
    if (action === 'update_inventory') {
      syncInventory(ss, body.data);
      auditLog(ss, 'inventory_sync', (body.data||[]).length + ' cues', ts);
      return corsOutput({ ok: true, ts });
    }

    // ── PING ────────────────────────────────────────────────────────
    if (action === 'ping') {
      return corsOutput({ ok: true, ts });
    }

    return corsOutput({ ok: false, error: 'Unknown action: ' + action });
  } catch(err) {
    return corsOutput({ ok: false, error: err.toString() });
  }
}

// ─────────────────────────────────────────────────────────────────────
// SYNC HELPERS
// ─────────────────────────────────────────────────────────────────────
function syncInventory(ss, data) {
  if (!data || !data.length) return;
  const sh = getOrCreate(ss, SHEETS.INVENTORY);
  const headers = ['serial','series','status','stage','wood','butt','weight','shaftLen','tip','tipSize',
    'joint','ferrule','wrap','taper','deflection','balance','pieces','finish','collar',
    'price','cost','warranty','desc','date','note'];
  sh.clearContents();
  sh.appendRow(headers);
  data.forEach(function(c) {
    sh.appendRow(headers.map(function(h){ return c[h] !== undefined ? c[h] : ''; }));
  });
}

function syncOrders(ss, orders) {
  if (!orders || !orders.length) return;
  const oh = getOrCreate(ss, SHEETS.ORDERS);
  const ih = getOrCreate(ss, SHEETS.ORDER_ITEMS);
  oh.clearContents(); ih.clearContents();
  const oHeaders = ['id','date','customer','contact','email','total','status','stage','note','payMethod','payRef'];
  const iHeaders = ['orderId','serial','series','wood','butt','weight','tip','length','qty','unitPrice','lineTotal','note'];
  oh.appendRow(oHeaders); ih.appendRow(iHeaders);
  orders.forEach(function(o) {
    oh.appendRow(oHeaders.map(function(h){ return o[h] !== undefined ? o[h] : ''; }));
    (o.items||[]).forEach(function(item){
      ih.appendRow(iHeaders.map(function(h){ return item[h] !== undefined ? item[h] : ''; }));
    });
  });
}

function syncCustomOrders(ss, data) {
  if (!data || !data.length) return;
  const sh = getOrCreate(ss, SHEETS.CUSTOM);
  sh.clearContents();
  sh.appendRow(['id','date','customer','contact','items','total','status','note']);
  data.forEach(function(c){
    sh.appendRow([c.id||'',c.date||'',c.customer||'',c.contact||'',
      JSON.stringify(c.items||c),c.total||0,c.status||'',c.note||'']);
  });
}

function syncCRM(ss, data) {
  if (!data || !data.length) return;
  const sh = getOrCreate(ss, SHEETS.CRM);
  sh.clearContents();
  sh.appendRow(['name','contact','email','orders','total','firstBuy','notes']);
  data.forEach(function(c){
    sh.appendRow([c.name||'',c.contact||'',c.email||'',c.orders||0,c.total||0,c.firstBuy||'',c.notes||'']);
  });
}

function syncMaterials(ss, data) {
  if (!data || !data.length) return;
  const sh = getOrCreate(ss, SHEETS.MATERIALS);
  sh.clearContents();
  sh.appendRow(['id','name','unit','qty','minQty','cost']);
  data.forEach(function(m){
    sh.appendRow([m.id||'',m.name||'',m.unit||'',m.qty||0,m.minQty||0,m.cost||0]);
  });
}

function updateCRM(ss, info) {
  const sh = getOrCreate(ss, SHEETS.CRM);
  ensureHeaders(sh, ['name','contact','email','orders','total','firstBuy','notes']);
  const data = sh.getDataRange().getValues();
  const nameCol = 0, totalCol = 4, orderCol = 3;
  for (var r = 1; r < data.length; r++) {
    if (data[r][nameCol] === info.name && data[r][1] === info.contact) {
      sh.getRange(r+1, totalCol+1).setValue((Number(data[r][totalCol])||0) + Number(info.total||0));
      sh.getRange(r+1, orderCol+1).setValue((Number(data[r][orderCol])||0) + 1);
      return;
    }
  }
  sh.appendRow([info.name||'', info.contact||'', info.email||'', 1, info.total||0,
    new Date().toISOString().slice(0,10), '']);
}

function updateInventoryStatus(ss, serial, status) {
  const sh = getOrCreate(ss, SHEETS.INVENTORY);
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const serialCol = headers.indexOf('serial');
  const statusCol = headers.indexOf('status');
  if (serialCol < 0 || statusCol < 0) return;
  for (var r = 1; r < data.length; r++) {
    if (data[r][serialCol] === serial) {
      sh.getRange(r+1, statusCol+1).setValue(status);
      return;
    }
  }
}

function updateField(ss, sheetName, keyCol, keyVal, updates) {
  const sh = getOrCreate(ss, sheetName);
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const ki = headers.indexOf(keyCol);
  if (ki < 0) return;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][ki]) === String(keyVal)) {
      Object.keys(updates).forEach(function(k) {
        const ci = headers.indexOf(k);
        if (ci >= 0) sh.getRange(r+1, ci+1).setValue(updates[k]);
      });
      return;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────────────
function getOrCreate(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function ensureHeaders(sh, headers) {
  if (sh.getLastRow() === 0) sh.appendRow(headers);
}

function sheetToObjects(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) return [];
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(function(row) {
    const obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

// ส่งข้อความแจ้งเตือนผ่าน LINE Messaging API — เงียบๆ ถ้ายังไม่ตั้งค่า
function notifyLine(message) {
  if (!LINE_CHANNEL_TOKEN || !LINE_TARGET_ID) return;
  try {
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + LINE_CHANNEL_TOKEN },
      payload: JSON.stringify({
        to: LINE_TARGET_ID,
        messages: [{ type: 'text', text: String(message).slice(0, 4900) }],
      }),
      muteHttpExceptions: true,
    });
  } catch (e) { /* การแจ้งเตือนล้มเหลวต้องไม่ทำให้ออเดอร์พัง */ }
}

function auditLog(ss, action, detail, ts) {
  const sh = getOrCreate(ss, SHEETS.AUDIT);
  ensureHeaders(sh, ['ts','action','detail']);
  sh.appendRow([ts || new Date().toISOString(), action, detail]);
}

// ─────────────────────────────────────────────────────────────────────
// SETUP: สร้าง Sheets ทั้งหมดครั้งแรก
// ─────────────────────────────────────────────────────────────────────
function setupSheets() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  Object.values(SHEETS).forEach(function(name) { getOrCreate(ss, name); });
  Browser.msgBox('✅ สร้าง Sheets ครบแล้ว:\n' + Object.values(SHEETS).join(', '));
}
