/**
 * Form JSP đầy đủ + hướng dẫn từng field + sơ đồ layer.
 */
(function () {
  "use strict";

  var guide = window.SFE_FIELD_GUIDE;
  var catalog = window.SFE_DEMO;
  var traceData = window.SFE_TRACE_SAVE_DRAFT;
  if (!guide || !catalog) {
    console.error("Missing field-guide or demo catalog");
    return;
  }

  var STORAGE_KEY = "sfe_wizard_form_v1";
  var tour = guide.tourOrder || [];
  var tourIndex = 0;
  var selectedLayerId = null;
  var traceIndex = 0;
  var traceBranch = "success";

  var els = {
    stepper: document.getElementById("wizStepper"),
    title: document.getElementById("wizTitle"),
    sub: document.getElementById("wizSub"),
    form: document.getElementById("wizFormPane"),
    fieldCard: document.getElementById("wizFieldCard"),
    layers: document.getElementById("wizLayers"),
    layerNote: document.getElementById("wizLayerNote"),
    layerDetail: document.getElementById("wizLayerDetail"),
    back: document.getElementById("wizBack"),
    next: document.getElementById("wizNext"),
    stepLabel: document.getElementById("wizStepLabel")
  };

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function defaultState() {
    return {
      purchaseOrderId: "12",
      receiptDate: "2026-11-09",
      invoiceNumber: "HD-DEMO-001",
      note: "[DEMO] Phiếu nhập thử",
      items: [
        {
          poItemId: "101",
          batchNumber: "LOT-A01",
          expiryDate: "2027-06-30",
          quantity: "40",
          costPrice: "15000",
          zoneId: "1",
          rackId: "11",
          binId: "111",
          inspectionResult: "CHO_KIEM_TRA",
          rejectionReason: ""
        }
      ]
    };
  }

  function loadState() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return defaultState();
  }

  function saveState(state) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  var formState = loadState();

  function currentPo() {
    return catalog.purchaseOrders[formState.purchaseOrderId] || null;
  }

  function currentFieldId() {
    return tour[tourIndex] || tour[0];
  }

  function fieldMeta(id) {
    return guide.fields[id];
  }

  function stepForField(fieldId) {
    var found = (guide.steps || []).filter(function (s) {
      return (s.fields || []).indexOf(fieldId) !== -1;
    })[0];
    return found || guide.steps[0];
  }

  function renderStepper() {
    els.stepper.innerHTML = guide.steps
      .map(function (s, i) {
        var cur = stepForField(currentFieldId());
        var cls = "wiz-step";
        if (cur && s.id === cur.id) cls += " is-current";
        var curIdx = guide.steps.indexOf(cur);
        if (i < curIdx) cls += " is-done";
        return (
          '<button type="button" class="' +
          cls +
          '" data-group="' +
          s.fields[0] +
          '"><span class="wiz-step-n">' +
          s.n +
          '</span><span class="wiz-step-t">' +
          escapeHtml(s.title) +
          "</span></button>"
        );
      })
      .join('<span class="wiz-step-line"></span>');

    els.stepper.querySelectorAll("[data-group]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        goFieldId(btn.getAttribute("data-group"));
      });
    });
  }

  function renderLayers() {
    var step = stepForField(currentFieldId());
    var active = step.activeLayers || [];
    els.layers.innerHTML = guide.layers
      .map(function (layer, i) {
        var on = active.indexOf(layer.id) !== -1;
        var sel = selectedLayerId === layer.id ? " is-selected" : "";
        return (
          (i ? '<span class="wiz-layer-arrow" aria-hidden="true">→</span>' : "") +
          '<button type="button" class="wiz-layer wiz-layer--' +
          layer.color +
          (on ? " is-on" : " is-off") +
          sel +
          '" data-layer="' +
          layer.id +
          '">' +
          escapeHtml(layer.label) +
          "</button>"
        );
      })
      .join("");
    els.layerNote.textContent = step.layerNote || "";
    els.layers.querySelectorAll("[data-layer]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        selectedLayerId = btn.dataset.layer;
        renderLayers();
        renderLayerDetail();
      });
    });
  }

  function renderLayerDetail() {
    var box = els.layerDetail;
    if (!selectedLayerId) {
      box.innerHTML =
        '<p class="wiz-muted">Bấm một hộp layer để xem param / code của <em>đúng</em> lớp đó.</p>';
      return;
    }
    var layer = guide.layers.filter(function (l) {
      return l.id === selectedLayerId;
    })[0];
    var field = fieldMeta(currentFieldId());
    var code = field && field.code ? field.code[selectedLayerId] || "—" : "—";
    var extra = "";
    var step = stepForField(currentFieldId());
    if (
      (selectedLayerId === "dao" || selectedLayerId === "db") &&
      (step.activeLayers || []).indexOf(selectedLayerId) === -1
    ) {
      extra =
        '<p class="wiz-warn">Layer này <strong>chưa chạy</strong> với field này. Chỉ INSERT khi nhấn Lưu nháp.</p>';
    }
    box.innerHTML =
      "<h4>" +
      escapeHtml(layer.label) +
      "</h4>" +
      '<p class="wiz-muted">' +
      escapeHtml(layer.hint) +
      "</p>" +
      extra +
      (field
        ? "<p><strong>Field:</strong> " +
          escapeHtml(field.label) +
          " · <code>" +
          escapeHtml(field.name) +
          "</code></p>"
        : "") +
      '<pre class="wiz-code">' +
      escapeHtml(code) +
      "</pre>" +
      (field && field.file
        ? '<p class="wiz-muted">' + escapeHtml(field.file) + "</p>"
        : "");
  }

  function renderFieldCard() {
    var fieldId = currentFieldId();
    var f = fieldMeta(fieldId);
    if (!f) {
      els.fieldCard.innerHTML = "";
      return;
    }
    els.fieldCard.innerHTML =
      '<p class="wiz-card-kicker">Field đang xem</p>' +
      "<h3>" +
      escapeHtml(f.label) +
      "</h3>" +
      '<p class="wiz-prose">' +
      escapeHtml(f.business) +
      "</p>" +
      '<dl class="wiz-dl">' +
      "<dt>Param</dt><dd><code>" +
      escapeHtml(f.param) +
      "</code></dd>" +
      "<dt>Trình duyệt</dt><dd>" +
      escapeHtml(f.client) +
      "</dd>" +
      "<dt>Servlet (chuẩn)</dt><dd>" +
      escapeHtml(f.server) +
      "</dd>" +
      "<dt>DB lúc lưu nháp</dt><dd>" +
      escapeHtml(f.dbOnSave) +
      "</dd>" +
      "</dl>" +
      '<p class="wiz-muted">Validate HTML/JS chỉ hỗ trợ UX — <strong>validateReceipt</strong> mới là authoritative.</p>';
    renderLayerDetail();
  }

  function readVisibleForm() {
    var po = document.getElementById("purchaseOrderId");
    if (po) formState.purchaseOrderId = po.value;
    var d = document.getElementById("receiptDate");
    if (d) formState.receiptDate = d.value;
    var inv = document.getElementById("invoiceNumber");
    if (inv) formState.invoiceNumber = inv.value;
    var note = document.getElementById("note");
    if (note) formState.note = note.value;
    var rows = document.querySelectorAll("#itemsBody .gr-item-row");
    if (rows.length) {
      formState.items = [];
      rows.forEach(function (row) {
        formState.items.push({
          poItemId: (row.querySelector(".gr-product") || {}).value || "",
          batchNumber: (row.querySelector(".gr-batch") || {}).value || "",
          expiryDate: (row.querySelector(".gr-expiry") || {}).value || "",
          quantity: (row.querySelector(".gr-qty") || {}).value || "",
          costPrice: (row.querySelector(".gr-cost") || {}).value || "",
          zoneId: (row.querySelector(".gr-zone") || {}).value || "",
          rackId: (row.querySelector(".gr-rack") || {}).value || "",
          binId: (row.querySelector(".gr-bin") || {}).value || "",
          inspectionResult:
            (row.querySelector(".gr-inspection") || {}).value || "CHO_KIEM_TRA",
          rejectionReason: (row.querySelector(".gr-reason") || {}).value || ""
        });
      });
    }
    saveState(formState);
  }

  function goField(i) {
    readVisibleForm();
    var prevId = currentFieldId();
    tourIndex = Math.max(0, Math.min(tour.length - 1, i));
    selectedLayerId = null;
    if (currentFieldId() === "saveDraft" && prevId !== "saveDraft") traceIndex = 0;
    updateGuide();
    highlightField(currentFieldId());
    renderTraceIfNeeded();
  }

  function goFieldId(id) {
    var i = tour.indexOf(id);
    if (i < 0) return;
    if (i === tourIndex) {
      highlightField(id);
      return;
    }
    goField(i);
  }

  function poOptionsHtml() {
    var html = '<option value="">— Chọn đơn đặt hàng —</option>';
    Object.keys(catalog.purchaseOrders).forEach(function (id) {
      var po = catalog.purchaseOrders[id];
      var sel = String(formState.purchaseOrderId) === String(id) ? " selected" : "";
      html +=
        '<option value="' +
        id +
        '"' +
        sel +
        ">#" +
        id +
        " — " +
        escapeHtml(po.supplierName) +
        " (" +
        po.orderDate +
        ")</option>";
    });
    return html;
  }

  function productOptions(selectedId) {
    var po = currentPo();
    var html = '<option value="">— Sản phẩm —</option>';
    (po ? po.items : []).forEach(function (it) {
      var sel = String(selectedId) === String(it.poItemId) ? " selected" : "";
      html +=
        '<option value="' +
        it.poItemId +
        '" data-product-id="' +
        it.productId +
        '" data-ordered="' +
        it.ordered +
        '" data-received="' +
        it.received +
        '" data-remaining="' +
        it.remaining +
        '" data-cost="' +
        it.cost +
        '"' +
        sel +
        ">" +
        escapeHtml(it.name) +
        "</option>";
    });
    return html;
  }

  function locOptions(rows, placeholder, selected) {
    var html = '<option value="">' + placeholder + "</option>";
    (rows || []).forEach(function (r) {
      var sel = String(selected) === String(r.id) ? " selected" : "";
      html +=
        '<option value="' + r.id + '"' + sel + ">" + escapeHtml(r.code) + "</option>";
    });
    return html;
  }

  function rowHtml(item, idx) {
    var racks = catalog.locations.racksByZone[item.zoneId] || [];
    var bins = catalog.locations.binsByRack[item.rackId] || [];
    var remaining = "";
    var po = currentPo();
    if (po) {
      var found = po.items.filter(function (x) {
        return String(x.poItemId) === String(item.poItemId);
      })[0];
      if (found) {
        remaining =
          "Đã đặt: " +
          found.ordered +
          " | Đã nhận: " +
          found.received +
          " | Còn lại: " +
          found.remaining;
      }
    }
    var insp = item.inspectionResult || "CHO_KIEM_TRA";
    return (
      '<tr class="gr-item-row" data-idx="' +
      idx +
      '">' +
      '<td data-field="poItemId"><select name="poItemId" class="gr-product" required>' +
      productOptions(item.poItemId) +
      '</select><span class="gr-remaining field-hint">' +
      escapeHtml(remaining) +
      "</span></td>" +
      '<td data-field="batchNumber"><input type="text" name="batchNumber" class="gr-batch" maxlength="100" required value="' +
      escapeHtml(item.batchNumber) +
      '"></td>' +
      '<td data-field="expiryDate"><input type="date" name="expiryDate" class="gr-expiry" required value="' +
      escapeHtml(item.expiryDate) +
      '"></td>' +
      '<td data-field="quantity"><input type="number" name="quantity" class="gr-qty" min="1" step="1" required value="' +
      escapeHtml(item.quantity) +
      '"></td>' +
      '<td data-field="costPrice"><input type="number" name="costPrice" class="gr-cost" min="0" step="1" required value="' +
      escapeHtml(item.costPrice) +
      '"></td>' +
      '<td class="gr-loc-cell">' +
      '<select class="gr-zone" data-field="zoneRack">' +
      locOptions(catalog.locations.zones, "Khu", item.zoneId) +
      "</select>" +
      '<select class="gr-rack" data-field="zoneRack">' +
      locOptions(racks, "Kệ", item.rackId) +
      "</select>" +
      '<select name="binId" class="gr-bin" data-field="binId">' +
      locOptions(bins, "Ngăn", item.binId) +
      "</select></td>" +
      '<td data-field="inspectionResult"><select name="inspectionResult" class="gr-inspection">' +
      '<option value="CHO_KIEM_TRA"' +
      (insp === "CHO_KIEM_TRA" ? " selected" : "") +
      ">Chờ kiểm tra</option>" +
      '<option value="CHAP_NHAN"' +
      (insp === "CHAP_NHAN" ? " selected" : "") +
      ">Chấp nhận</option>" +
      '<option value="TU_CHOI"' +
      (insp === "TU_CHOI" ? " selected" : "") +
      ">Từ chối</option></select></td>" +
      '<td data-field="rejectionReason"><input type="text" name="rejectionReason" class="gr-reason" maxlength="500" placeholder="VD: Hết hạn, Vỡ hộp" ' +
      (insp === "TU_CHOI" ? "" : "hidden") +
      ' value="' +
      escapeHtml(item.rejectionReason) +
      '"></td>' +
      '<td><button type="button" class="btn btn-ghost btn-sm btn-danger gr-remove">Xóa</button></td></tr>'
    );
  }

  function renderFullForm() {
    var po = currentPo();
    var rows = (formState.items || []).map(rowHtml).join("");
    els.form.innerHTML =
      '<div class="sfe-frame admin-layout">' +
      '<div class="sfe-demo-banner">Giao diện mô phỏng goods-receipt-form.jsp · [DEMO]</div>' +
      '<header class="admin-topbar"><a class="brand" href="#" onclick="return false;">' +
      '<span class="brand-name">PharmaFlow</span><span class="brand-tag">Quản trị</span></a></header>' +
      '<div class="admin-shell"><aside class="admin-sidebar"><nav class="admin-nav">' +
      '<span class="admin-nav-label">Kho</span>' +
      '<a class="admin-nav-link" href="#" onclick="return false;">Tồn kho</a>' +
      '<a class="admin-nav-link current" href="#" onclick="return false;">Nhập kho</a>' +
      "</nav></aside>" +
      '<div class="admin-main">' +
      '<nav class="crumbs"><a href="#" onclick="return false;">Kho hàng</a> › <span>Nhập kho</span></nav>' +
      '<div class="section-head"><h2>Nhập kho</h2>' +
      '<p class="section-sub">Ghi nhận thuốc mới nhận từ nhà cung cấp theo đơn đặt hàng.</p></div>' +
      '<div class="profile-card wiz-form-card"><form id="grForm" method="post" action="/Pharma_Flow/inventory/receipts?action=create">' +
      '<fieldset class="profile-group"><legend>Thông tin phiếu nhập</legend>' +
      '<div class="profile-grid">' +
      '<div class="form-field" data-field="purchaseOrderId">' +
      '<label for="purchaseOrderId">Đơn đặt hàng <span class="req">*</span></label>' +
      '<select id="purchaseOrderId" name="purchaseOrderId" required>' +
      poOptionsHtml() +
      "</select>" +
      '<span class="field-hint">Chỉ đơn đã đặt hoặc nhận một phần.</span></div>' +
      '<div class="form-field" data-field="supplierName">' +
      '<label for="supplierName">Nhà cung cấp</label>' +
      '<input type="text" id="supplierName" readonly value="' +
      escapeHtml(po ? po.supplierName : "") +
      '"></div>' +
      '<div class="form-field" data-field="receiptDate">' +
      '<label for="receiptDate">Ngày nhận <span class="req">*</span></label>' +
      '<input type="date" id="receiptDate" name="receiptDate" required value="' +
      escapeHtml(formState.receiptDate) +
      '"></div>' +
      '<div class="form-field" data-field="invoiceNumber">' +
      '<label for="invoiceNumber">Số hóa đơn</label>' +
      '<input type="text" id="invoiceNumber" name="invoiceNumber" maxlength="100" value="' +
      escapeHtml(formState.invoiceNumber) +
      '"></div></div>' +
      '<div class="form-field" data-field="note">' +
      '<label for="note">Ghi chú</label>' +
      '<textarea id="note" name="note" rows="2" maxlength="500">' +
      escapeHtml(formState.note) +
      "</textarea></div></fieldset>" +
      '<fieldset class="profile-group"><legend>Sản phẩm nhận được</legend>' +
      '<div class="gr-items-wrap"><table class="admin-table gr-items-table">' +
      "<thead><tr><th class=\"col-product\">Sản phẩm</th><th class=\"col-batch\">Số lô</th>" +
      '<th class="col-expiry">Hạn dùng</th><th class="col-qty">SL</th>' +
      '<th class="col-cost">Giá nhập</th><th class="col-loc">Vị trí</th>' +
      '<th class="col-insp">Kiểm tra</th><th class="col-reason">Lý do từ chối</th>' +
      '<th class="col-act"></th></tr></thead>' +
      '<tbody id="itemsBody">' +
      rows +
      "</tbody></table></div>" +
      '<button type="button" class="btn btn-secondary btn-sm" id="addItemBtn">+ Thêm sản phẩm</button>' +
      "</fieldset>" +
      '<div class="profile-actions">' +
      '<a class="btn btn-ghost" href="#" id="cancelLink" data-field="saveDraft">Hủy</a>' +
      '<button type="submit" name="submitAction" value="draft" class="btn btn-secondary" data-field="saveDraft" id="saveDraftBtn">Lưu nháp</button>' +
      "</div></form></div>" +
      '<div id="wizTraceHost"></div>' +
      "</div></div></div>";

    wireFormEvents();
    wireFieldFocus();
  }

  function wireFormEvents() {
    var form = document.getElementById("grForm");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        goFieldId("saveDraft");
      });
    }
    var cancel = document.getElementById("cancelLink");
    if (cancel) {
      cancel.addEventListener("click", function (e) {
        e.preventDefault();
        goFieldId("saveDraft");
      });
    }
    document.getElementById("purchaseOrderId").addEventListener("change", function () {
      var next = this.value;
      if (formState.items.length && next !== formState.purchaseOrderId) {
        if (!confirm("Đổi đơn đặt hàng sẽ xóa các dòng sản phẩm hiện tại. Tiếp tục?")) {
          this.value = formState.purchaseOrderId;
          return;
        }
        var npo = catalog.purchaseOrders[next];
        formState.items = npo
          ? [
              {
                poItemId: npo.items[0].poItemId,
                batchNumber: "",
                expiryDate: "",
                quantity: "",
                costPrice: npo.items[0].cost,
                zoneId: "",
                rackId: "",
                binId: "",
                inspectionResult: "CHO_KIEM_TRA",
                rejectionReason: ""
              }
            ]
          : [];
      }
      formState.purchaseOrderId = next;
      saveState(formState);
      renderFullForm();
      updateGuide();
      highlightField(currentFieldId());
      renderTraceIfNeeded();
    });
    ["receiptDate", "invoiceNumber", "note"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("input", readVisibleForm);
    });
    wireLineEvents();
  }

  function wireLineEvents() {
    var body = document.getElementById("itemsBody");
    if (!body) return;
    body.addEventListener("change", function (e) {
      var row = e.target.closest(".gr-item-row");
      if (!row) return;
      if (e.target.classList.contains("gr-product")) {
        var opt = e.target.options[e.target.selectedIndex];
        var cost = row.querySelector(".gr-cost");
        var hint = row.querySelector(".gr-remaining");
        if (opt && cost && opt.dataset.cost) cost.value = opt.dataset.cost;
        if (hint && opt && opt.value) {
          hint.textContent =
            "Đã đặt: " +
            opt.dataset.ordered +
            " | Đã nhận: " +
            opt.dataset.received +
            " | Còn lại: " +
            opt.dataset.remaining;
        }
      }
      if (e.target.classList.contains("gr-inspection")) {
        var reason = row.querySelector(".gr-reason");
        if (reason) {
          reason.hidden = e.target.value !== "TU_CHOI";
          reason.required = e.target.value === "TU_CHOI";
        }
      }
      if (e.target.classList.contains("gr-zone")) {
        var rack = row.querySelector(".gr-rack");
        var bin = row.querySelector(".gr-bin");
        rack.innerHTML = locOptions(
          catalog.locations.racksByZone[e.target.value] || [],
          "Kệ",
          ""
        );
        bin.innerHTML = locOptions([], "Ngăn", "");
      }
      if (e.target.classList.contains("gr-rack")) {
        row.querySelector(".gr-bin").innerHTML = locOptions(
          catalog.locations.binsByRack[e.target.value] || [],
          "Ngăn",
          ""
        );
      }
      readVisibleForm();
    });
    body.addEventListener("input", readVisibleForm);
    body.addEventListener("click", function (e) {
      if (e.target.classList.contains("gr-remove")) {
        e.target.closest("tr").remove();
        readVisibleForm();
      }
    });
    document.getElementById("addItemBtn").addEventListener("click", function () {
      readVisibleForm();
      var p = currentPo();
      formState.items.push({
        poItemId: p && p.items[0] ? p.items[0].poItemId : "",
        batchNumber: "",
        expiryDate: "",
        quantity: "",
        costPrice: p && p.items[0] ? p.items[0].cost : "",
        zoneId: "",
        rackId: "",
        binId: "",
        inspectionResult: "CHO_KIEM_TRA",
        rejectionReason: ""
      });
      saveState(formState);
      renderFullForm();
      updateGuide();
      highlightField(currentFieldId());
      renderTraceIfNeeded();
    });
  }

  function wireFieldFocus() {
    els.form.querySelectorAll("[data-field]").forEach(function (node) {
      node.addEventListener("focusin", function () {
        goFieldId(node.getAttribute("data-field"));
      });
      node.addEventListener("click", function () {
        goFieldId(node.getAttribute("data-field"));
      });
    });
  }

  function highlightField(id) {
    els.form.querySelectorAll("[data-field]").forEach(function (n) {
      n.classList.toggle("is-focus-field", n.getAttribute("data-field") === id);
    });
    var target = els.form.querySelector('[data-field="' + id + '"]');
    if (target && target.scrollIntoView) {
      target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function filteredTrace() {
    return (traceData.steps || []).filter(function (step) {
      if (step.onlyOn && step.onlyOn.indexOf(traceBranch) === -1) return false;
      if (step.skipOn && step.skipOn.indexOf(traceBranch) !== -1) return false;
      if (step.onlySuccessOrDb && traceBranch === "validation") return false;
      return true;
    });
  }

  function renderTraceIfNeeded() {
    var host = document.getElementById("wizTraceHost");
    if (!host) return;
    if (currentFieldId() !== "saveDraft") {
      host.innerHTML = "";
      return;
    }
    var steps = filteredTrace();
    if (traceIndex >= steps.length) traceIndex = Math.max(0, steps.length - 1);
    var step = steps[traceIndex] || {};
    var bodyParts = [
      "purchaseOrderId=" + encodeURIComponent(formState.purchaseOrderId),
      "receiptDate=" + encodeURIComponent(formState.receiptDate),
      "invoiceNumber=" + encodeURIComponent(formState.invoiceNumber),
      "note=" + encodeURIComponent(formState.note)
    ];
    (formState.items || []).forEach(function (it) {
      bodyParts.push("poItemId=" + encodeURIComponent(it.poItemId));
      bodyParts.push("batchNumber=" + encodeURIComponent(it.batchNumber));
      bodyParts.push("expiryDate=" + encodeURIComponent(it.expiryDate));
      bodyParts.push("quantity=" + encodeURIComponent(it.quantity));
      bodyParts.push("costPrice=" + encodeURIComponent(it.costPrice));
      bodyParts.push("binId=" + encodeURIComponent(it.binId));
      bodyParts.push("inspectionResult=" + encodeURIComponent(it.inspectionResult));
      bodyParts.push("rejectionReason=" + encodeURIComponent(it.rejectionReason));
    });
    bodyParts.push("submitAction=draft");
    var http =
      "POST /Pharma_Flow/inventory/receipts?action=create HTTP/1.1\nContent-Type: application/x-www-form-urlencoded\n\n" +
      bodyParts.join("&");
    var dbAfter =
      traceBranch === "success" && step.dbAfter
        ? "<p><code>goods_receipts</code> +1 BAN_NHAP [DEMO id=901]<br><code>goods_receipt_items</code> +" +
          (formState.items || []).length +
          " dòng<br><code>inventory_*</code> / PO received / NHAP_KHO: <strong>không đổi</strong></p>"
        : "<p>Chưa COMMIT — inventory không đổi.</p>";

    host.innerHTML =
      '<div class="wiz-save">' +
      '<div class="wiz-save-bar">' +
      "<strong>Luồng Lưu nháp</strong>" +
      '<label><input type="radio" name="wizBranch" value="success"' +
      (traceBranch === "success" ? " checked" : "") +
      "> Success</label>" +
      '<label><input type="radio" name="wizBranch" value="validation"' +
      (traceBranch === "validation" ? " checked" : "") +
      "> Validation</label>" +
      '<label><input type="radio" name="wizBranch" value="dbError"' +
      (traceBranch === "dbError" ? " checked" : "") +
      "> DB Error</label>" +
      '<span class="wiz-muted">' +
      (traceIndex + 1) +
      "/" +
      steps.length +
      "</span>" +
      '<button type="button" class="sfe-btn" id="wizTracePrev">Previous</button>' +
      '<button type="button" class="sfe-btn primary" id="wizTraceNext">Next</button></div>' +
      '<div class="wiz-trace-card">' +
      "<h3>" +
      escapeHtml(step.title || "") +
      "</h3>" +
      '<p class="wiz-muted">' +
      escapeHtml(step.file || "") +
      " :" +
      escapeHtml(step.lines || "") +
      "</p>" +
      '<pre class="wiz-code">' +
      escapeHtml(step.code || "") +
      "</pre>" +
      (step.dynamicHttp ? '<pre class="wiz-code wiz-http">' + escapeHtml(http) + "</pre>" : "") +
      '<p class="wiz-prose">' +
      escapeHtml(step.explain || "") +
      "</p>" +
      (step.dbPreview || step.dbAfter ? '<div class="wiz-db">' + dbAfter + "</div>" : "") +
      "</div></div>";

    document.querySelectorAll('input[name="wizBranch"]').forEach(function (r) {
      r.addEventListener("change", function () {
        traceBranch = r.value;
        traceIndex = 0;
        renderTraceIfNeeded();
      });
    });
    var prev = document.getElementById("wizTracePrev");
    var next = document.getElementById("wizTraceNext");
    if (prev)
      prev.addEventListener("click", function () {
        if (traceIndex > 0) {
          traceIndex--;
          renderTraceIfNeeded();
        }
      });
    if (next)
      next.addEventListener("click", function () {
        if (traceIndex < filteredTrace().length - 1) {
          traceIndex++;
          renderTraceIfNeeded();
        }
      });
  }

  function updateGuide() {
    var f = fieldMeta(currentFieldId());
    var step = stepForField(currentFieldId());
    els.title.textContent = f ? f.label : step.title;
    els.sub.textContent = step.subtitle;
    els.stepLabel.textContent =
      "Field " + (tourIndex + 1) + " / " + tour.length + " · " + (step.title || "");
    els.back.disabled = tourIndex === 0;
    els.next.textContent = tourIndex === tour.length - 1 ? "Về field đầu" : "Field tiếp theo";
    renderStepper();
    renderLayers();
    renderFieldCard();
  }

  els.back.addEventListener("click", function () {
    goField(tourIndex - 1);
  });
  els.next.addEventListener("click", function () {
    if (tourIndex === tour.length - 1) goField(0);
    else goField(tourIndex + 1);
  });

  renderFullForm();
  updateGuide();
  highlightField(currentFieldId());
  renderTraceIfNeeded();
})();
