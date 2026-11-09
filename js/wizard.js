/**
 * Guided Mode — form JSP đầy đủ + tour 15 field.
 * State: SFE_LESSON · validate: SFE_VALIDATE · flow: SFE_FLOW
 */
(function () {
  "use strict";

  var guide = window.SFE_FIELD_GUIDE;
  var catalog = window.SFE_DEMO;
  var traceData = window.SFE_TRACE_SAVE_DRAFT;
  var lesson = window.SFE_LESSON;
  var V = window.SFE_VALIDATE;
  var FLOW = window.SFE_FLOW;
  if (!guide || !catalog || !lesson || !V || !FLOW) {
    console.error("Missing guided-mode scripts");
    return;
  }

  var tour = guide.tourOrder || [];
  var selectedLayerId = null;
  var techOpen = false;
  var modalCb = null;

  var els = {
    stepper: document.getElementById("wizStepper"),
    progress: document.getElementById("wizProgress"),
    title: document.getElementById("wizTitle"),
    sub: document.getElementById("wizSub"),
    form: document.getElementById("wizFormPane"),
    fieldCard: document.getElementById("wizFieldCard"),
    layers: document.getElementById("wizLayers"),
    layerNote: document.getElementById("wizLayerNote"),
    layerDetail: document.getElementById("wizLayerDetail"),
    back: document.getElementById("wizBack"),
    next: document.getElementById("wizNext"),
    stepLabel: document.getElementById("wizStepLabel"),
    guidedSide: document.getElementById("guidedSide"),
    explorerSide: document.getElementById("explorerSide"),
    modeGuided: document.getElementById("modeGuided"),
    modeExplorer: document.getElementById("modeExplorer"),
    resetBtn: document.getElementById("resetLesson"),
    scenario: document.getElementById("wizScenario"),
    modal: document.getElementById("sfeModal"),
    modalText: document.getElementById("sfeModalText"),
    modalOk: document.getElementById("sfeModalOk"),
    modalCancel: document.getElementById("sfeModalCancel"),
    backend: document.getElementById("wizBackend")
  };

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formState() {
    return lesson.getForm();
  }

  function currentPo() {
    return V.poOf(formState(), catalog);
  }

  function currentFieldId() {
    return tour[lesson.getTourIndex()] || tour[0];
  }

  function fieldMeta(id) {
    return guide.fields[id] || {};
  }

  function stepForField(fieldId) {
    return (
      (guide.steps || []).filter(function (s) {
        return (s.fields || []).indexOf(fieldId) !== -1;
      })[0] || guide.steps[0]
    );
  }

  function persistFormFromDom() {
    var f = formState();
    var po = document.getElementById("purchaseOrderId");
    if (po) f.purchaseOrderId = po.value;
    var d = document.getElementById("receiptDate");
    if (d) f.receiptDate = d.value;
    var inv = document.getElementById("invoiceNumber");
    if (inv) f.invoiceNumber = inv.value;
    var note = document.getElementById("note");
    if (note) f.note = note.value;
    var rows = document.querySelectorAll("#itemsBody .gr-item-row");
    f.items = [];
    rows.forEach(function (row) {
      f.items.push({
        poItemId: (row.querySelector(".gr-product") || {}).value || "",
        batchNumber: (row.querySelector(".gr-batch") || {}).value || "",
        expiryDate: (row.querySelector(".gr-expiry") || {}).value || "",
        quantity: (row.querySelector(".gr-qty") || {}).value || "",
        costPrice: (row.querySelector(".gr-cost") || {}).value || "",
        zoneId: (row.querySelector(".gr-zone") || {}).value || "",
        rackId: (row.querySelector(".gr-rack") || {}).value || "",
        binId: (row.querySelector(".gr-bin") || {}).value || "",
        inspectionResult: (row.querySelector(".gr-inspection") || {}).value || "CHO_KIEM_TRA",
        rejectionReason: (row.querySelector(".gr-reason") || {}).value || ""
      });
    });
    lesson.persist();
  }

  function ask(text, onOk) {
    if (!els.modal) {
      if (window.confirm(text)) onOk();
      return;
    }
    els.modalText.textContent = text;
    els.modal.classList.remove("is-hidden");
    modalCb = onOk;
  }

  function closeModal() {
    if (els.modal) els.modal.classList.add("is-hidden");
    modalCb = null;
  }

  if (els.modalOk) {
    els.modalOk.addEventListener("click", function () {
      var fn = modalCb;
      closeModal();
      if (fn) fn();
    });
  }
  if (els.modalCancel) els.modalCancel.addEventListener("click", closeModal);

  function poOptionsHtml() {
    var f = formState();
    var html = '<option value="">— Chọn đơn đặt hàng —</option>';
    Object.keys(catalog.purchaseOrders).forEach(function (id) {
      var po = catalog.purchaseOrders[id];
      var sel = String(f.purchaseOrderId) === String(id) ? " selected" : "";
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
    if (String(f.purchaseOrderId) === "88" && catalog.closedOrders && catalog.closedOrders["88"]) {
      var c = catalog.closedOrders["88"];
      html +=
        '<option value="88" selected>[DEMO SCENARIO] #' +
        c.id +
        " — " +
        escapeHtml(c.supplierName) +
        " (" +
        c.status +
        ")</option>";
    }
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
      html += '<option value="' + r.id + '"' + sel + ">" + escapeHtml(r.code) + "</option>";
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
          "Đã đặt: " + found.ordered + " | Đã nhận: " + found.received + " | Còn lại: " + found.remaining;
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

  function servletErrorsHtml() {
    var action = lesson.getAction();
    if (!action || action.type !== "save-draft" || action.branch !== "validation") return "";
    var draft = V.servletValidate(formState(), catalog, false);
    if (draft.ok) return "";
    var bits = Object.keys(draft.errors).map(function (k) {
      return "<li><strong>" + escapeHtml(k) + ":</strong> " + escapeHtml(draft.errors[k]) + "</li>";
    });
    return (
      '<div class="alert alert-error sfe-form-errors" role="alert"><p>Máy chủ Java đã nhận phiếu nhưng dữ liệu chưa hợp lệ. Hàm kiểm tra tên validateReceipt. Vì chưa đạt, chương trình ghi phiếu (GoodsReceiptDAO.createDraft) không được gọi. Cơ sở dữ liệu không thêm phiếu mới. Form được trả lại để bạn sửa.</p><ul>' +
      bits.join("") +
      "</ul></div>"
    );
  }

  function renderCancelled() {
    var sim = lesson.getSim();
    els.form.innerHTML =
      '<div class="sfe-frame admin-layout"><div class="sfe-demo-banner">Mô phỏng GET /inventory/receipts — Hủy form tạo mới</div>' +
      '<div class="admin-main" style="padding:20px">' +
      '<div class="alert" style="background:#eff6ff;border:1px solid #93c5fd;padding:12px;border-radius:8px;margin-bottom:12px">' +
      "<strong>Không có phiếu mới được tạo.</strong> Nút Hủy trên form tạo mới chỉ xin trang danh sách bằng GET tới <code>/inventory/receipts</code>. Chương trình GoodsReceiptServlet gọi handleList. Đây không phải thao tác hủy một phiếu đã lưu, và không gọi hàm ghi nháp createDraft." +
      "</div>" +
      "<h2>Nhập kho</h2><p class=\"section-sub\">Danh sách phiếu (bài học). Số phiếu đang có: " +
      sim.goodsReceipts.length +
      ".</p>" +
      '<p class="field-hint">Cơ sở dữ liệu demo không đổi vì bạn chỉ quay về danh sách. Việc hủy một phiếu bản nháp đã lưu là thao tác khác, nằm ngoài bài Lưu nháp.</p>' +
      '<button type="button" class="btn btn-primary" id="backToForm">Quay lại form tạo phiếu</button>' +
      "</div></div>";
    document.getElementById("backToForm").addEventListener("click", function () {
      lesson.setAction({ type: "idle", fieldId: currentFieldId() });
      lesson.setResult(null);
      renderFullForm();
      refreshChrome();
    });
  }

  function renderSavedList(receiptId) {
    var sim = lesson.getSim();
    els.form.innerHTML =
      '<div class="sfe-frame admin-layout"><div class="sfe-demo-banner">Mô phỏng GET /inventory/receipts?ok=created</div>' +
      '<div class="admin-main" style="padding:20px">' +
      '<div class="alert alert-success" role="status">Đã lưu nháp phiếu nhập — chưa có gì vào kho.</div>' +
      "<h2>Nhập kho</h2>" +
      "<p>Phiếu học tập số " +
      receiptId +
      " đã được ghi ở trạng thái bản nháp (BAN_NHAP). Số thuốc trên kệ không tăng. Số lượng đã nhận trên đơn đặt hàng không tăng. Sổ xuất-nhập kho không có dòng mới.</p>" +
      "<p>Số phiếu demo: " +
      sim.goodsReceipts.length +
      " · số dòng items: " +
      sim.goodsReceiptItems.length +
      "</p>" +
      '<button type="button" class="btn btn-secondary" id="backToForm">Quay lại form</button></div></div>';
    document.getElementById("backToForm").addEventListener("click", function () {
      lesson.setResult(null);
      renderFullForm();
      refreshChrome();
    });
  }

  function renderFullForm() {
    var res = lesson.getResult();
    if (res && res.kind === "cancelled") {
      renderCancelled();
      return;
    }
    var result = lesson.getResult();
    if (result && result.kind === "created" && currentFieldId() !== "saveDraft") {
      /* keep form while touring; list only after trace says so via button */
    }
    var po = currentPo();
    var f = formState();
    var rows =
      (f.items || []).length === 0
        ? '<tr class="gr-empty"><td colspan="9">Chưa có dòng sản phẩm. Servlet: <code>Add at least one received batch line.</code></td></tr>'
        : f.items.map(rowHtml).join("");
    els.form.innerHTML =
      '<div class="sfe-frame admin-layout">' +
      '<div class="sfe-demo-banner">Mô phỏng goods-receipt-form.jsp · không phải Tomcat/MySQL thật · [DEMO]</div>' +
      '<header class="admin-topbar"><a class="brand" href="#" onclick="return false;"><span class="brand-name">PharmaFlow</span><span class="brand-tag">Quản trị</span></a></header>' +
      '<div class="admin-shell"><aside class="admin-sidebar"><nav class="admin-nav">' +
      '<span class="admin-nav-label">Kho</span>' +
      '<a class="admin-nav-link" href="#" onclick="return false;">Tồn kho</a>' +
      '<a class="admin-nav-link current" href="#" onclick="return false;">Nhập kho</a></nav></aside>' +
      '<div class="admin-main">' +
      '<nav class="crumbs"><a href="#" onclick="return false;">Kho hàng</a> › <span>Nhập kho</span></nav>' +
      '<div class="section-head"><h2>Nhập kho</h2><p class="section-sub">Ghi nhận thuốc mới nhận từ nhà cung cấp theo đơn đặt hàng.</p></div>' +
      servletErrorsHtml() +
      '<div class="profile-card wiz-form-card"><form id="grForm" method="post" novalidate action="/Pharma_Flow/inventory/receipts?action=create" data-reload-url="/Pharma_Flow/inventory/receipts?action=new">' +
      '<fieldset class="profile-group"><legend>Thông tin phiếu nhập</legend><div class="profile-grid">' +
      '<div class="form-field" data-field="purchaseOrderId"><label for="purchaseOrderId">Đơn đặt hàng <span class="req">*</span></label>' +
      '<select id="purchaseOrderId" name="purchaseOrderId" required>' +
      poOptionsHtml() +
      '</select><span class="field-hint">findReceivable() — DA_DAT_HANG / DA_NHAN_MOT_PHAN.</span></div>' +
      '<div class="form-field" data-field="supplierName"><label for="supplierName">Nhà cung cấp</label>' +
      '<input type="text" id="supplierName" readonly value="' +
      escapeHtml(po ? po.supplierName : "") +
      '"></div>' +
      '<div class="form-field" data-field="receiptDate"><label for="receiptDate">Ngày nhận <span class="req">*</span></label>' +
      '<input type="date" id="receiptDate" name="receiptDate" required value="' +
      escapeHtml(f.receiptDate) +
      '"></div>' +
      '<div class="form-field" data-field="invoiceNumber"><label for="invoiceNumber">Số hóa đơn</label>' +
      '<input type="text" id="invoiceNumber" name="invoiceNumber" maxlength="100" value="' +
      escapeHtml(f.invoiceNumber) +
      '"></div></div>' +
      '<div class="form-field" data-field="note"><label for="note">Ghi chú</label>' +
      '<textarea id="note" name="note" rows="2" maxlength="500">' +
      escapeHtml(f.note) +
      "</textarea></div></fieldset>" +
      '<fieldset class="profile-group"><legend>Sản phẩm nhận được</legend>' +
      '<div class="gr-items-wrap"><table class="admin-table gr-items-table"><thead><tr>' +
      '<th class="col-product">Sản phẩm</th><th class="col-batch">Số lô</th><th class="col-expiry">Hạn dùng</th>' +
      '<th class="col-qty">SL</th><th class="col-cost">Giá nhập</th><th class="col-loc">Vị trí</th>' +
      '<th class="col-insp">Kiểm tra</th><th class="col-reason">Lý do từ chối</th><th class="col-act"></th></tr></thead>' +
      '<tbody id="itemsBody">' +
      rows +
      "</tbody></table></div>" +
      '<button type="button" class="btn btn-secondary btn-sm" id="addItemBtn">+ Thêm sản phẩm</button></fieldset>' +
      '<div class="profile-actions">' +
      '<a class="btn btn-ghost" href="/Pharma_Flow/inventory/receipts" id="cancelLink">Hủy</a>' +
      '<button type="submit" name="submitAction" value="draft" class="btn btn-secondary" data-field="saveDraft" id="saveDraftBtn">Lưu nháp</button>' +
      "</div></form></div><div id=\"wizTraceHost\"></div></div></div></div>";
    wireFormEvents();
    wireFieldFocus();
    highlightField(currentFieldId());
  }

  function wireFormEvents() {
    var formEl = document.getElementById("grForm");
    if (formEl) {
      formEl.addEventListener("submit", function (e) {
        e.preventDefault();
        persistFormFromDom();
        startSaveDraft();
      });
    }
    var cancel = document.getElementById("cancelLink");
    if (cancel) {
      cancel.addEventListener("click", function (e) {
        e.preventDefault();
        startCancel();
      });
    }
    var poSel = document.getElementById("purchaseOrderId");
    if (poSel) {
      poSel.setAttribute("data-prev", poSel.value);
      poSel.addEventListener("change", function () {
        var next = this.value;
        var prev = formState().purchaseOrderId;
        var hasRows = (formState().items || []).length > 0;
        if (hasRows && next !== prev) {
          var sel = this;
          ask("Đổi đơn đặt hàng sẽ xóa các dòng sản phẩm hiện tại. Tiếp tục?", function () {
            applyPoChange(next);
          });
          sel.value = prev;
          return;
        }
        applyPoChange(next);
      });
    }
    ["receiptDate", "invoiceNumber", "note"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", function () {
        persistFormFromDom();
        lesson.setAction({ type: "type", fieldId: id });
        selectedLayerId = null;
        refreshChrome();
      });
    });
    wireLineEvents();
  }

  function applyPoChange(next) {
    var npo = V.poOf({ purchaseOrderId: next }, catalog);
    formState().purchaseOrderId = next;
    formState().items = npo
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
    lesson.persist();
    lesson.setAction({ type: "po-change", fieldId: "purchaseOrderId", seq: Date.now() });
    renderFullForm();
    refreshChrome();
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
        var bin = row.querySelector(".gr-bin");
        if (reason) {
          reason.hidden = e.target.value !== "TU_CHOI";
          reason.required = e.target.value === "TU_CHOI";
        }
        if (bin) bin.required = e.target.value === "CHAP_NHAN";
      }
      if (e.target.classList.contains("gr-zone")) {
        var rack = row.querySelector(".gr-rack");
        var bin2 = row.querySelector(".gr-bin");
        rack.innerHTML = locOptions(catalog.locations.racksByZone[e.target.value] || [], "Kệ", "");
        bin2.innerHTML = locOptions([], "Ngăn", "");
        persistFormFromDom();
        lesson.setAction({ type: "zone", fieldId: "zoneRack", seq: Date.now() });
        refreshChrome();
        return;
      }
      if (e.target.classList.contains("gr-rack")) {
        row.querySelector(".gr-bin").innerHTML = locOptions(
          catalog.locations.binsByRack[e.target.value] || [],
          "Ngăn",
          ""
        );
        persistFormFromDom();
        lesson.setAction({ type: "rack", fieldId: "binId", seq: Date.now() });
        refreshChrome();
        return;
      }
      persistFormFromDom();
      var fid = e.target.closest("[data-field]");
      lesson.setAction({
        type: "type",
        fieldId: fid ? fid.getAttribute("data-field") : "poItemId"
      });
      refreshChrome();
    });
    body.addEventListener("input", function (e) {
      persistFormFromDom();
      var fid = e.target.closest("[data-field]");
      lesson.setAction({
        type: "type",
        fieldId: fid ? fid.getAttribute("data-field") : currentFieldId()
      });
      refreshChrome();
    });
    body.addEventListener("click", function (e) {
      if (!e.target.classList.contains("gr-remove")) return;
      e.target.closest("tr").remove();
      persistFormFromDom();
      lesson.setAction({ type: "type", fieldId: "poItemId" });
      renderFullForm();
      refreshChrome();
    });
    var addBtn = document.getElementById("addItemBtn");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        persistFormFromDom();
        var p = currentPo();
        formState().items.push({
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
        lesson.persist();
        lesson.setAction({ type: "add-item", fieldId: "poItemId" });
        renderFullForm();
        refreshChrome();
      });
    }
  }

  function wireFieldFocus() {
    els.form.querySelectorAll("[data-field]").forEach(function (node) {
      function pick() {
        goFieldId(node.getAttribute("data-field"), true);
      }
      node.addEventListener("focusin", pick);
      node.addEventListener("click", pick);
    });
  }

  function highlightField(id) {
    els.form.querySelectorAll("[data-field]").forEach(function (n) {
      n.classList.toggle("is-focus-field", n.getAttribute("data-field") === id);
      n.classList.toggle("is-error-field", false);
    });
    var draft = V.servletValidate(formState(), catalog, false);
    var action = lesson.getAction();
    if (action && action.type === "save-draft" && action.branch === "validation") {
      if (draft.errors.purchaseOrderId) {
        var p = els.form.querySelector('[data-field="purchaseOrderId"]');
        if (p) p.classList.add("is-error-field");
      }
      if (draft.errors.receiptDate) {
        var r = els.form.querySelector('[data-field="receiptDate"]');
        if (r) r.classList.add("is-error-field");
      }
      if (draft.errors.items) {
        var t = els.form.querySelector(".gr-items-wrap");
        if (t) t.classList.add("is-error-field");
      }
    }
    var target = els.form.querySelector('[data-field="' + id + '"]');
    var actType = (lesson.getAction() || {}).type;
    if (target && target.scrollIntoView && actType !== "save-draft" && actType !== "po-change" && actType !== "zone" && actType !== "rack" && actType !== "cancel") {
      target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function goField(i, fromFocus) {
    persistFormFromDom();
    var max = tour.length - 1;
    lesson.setTourIndex(Math.max(0, Math.min(max, i)));
    if (!fromFocus) {
      lesson.setAction({ type: "focus", fieldId: currentFieldId() });
    } else {
      var a = lesson.getAction() || {};
      if (a.type === "idle" || a.type === "focus" || !a.type) {
        lesson.setAction({ type: "focus", fieldId: currentFieldId() });
      } else {
        lesson.setAction(Object.assign({}, a, { fieldId: currentFieldId() }));
      }
    }
    selectedLayerId = null;
    if (currentFieldId() !== "saveDraft") {
      /* keep last save-draft action until user edits */
    }
    highlightField(currentFieldId());
    refreshChrome();
  }

  function goFieldId(id, fromFocus) {
    var i = tour.indexOf(id);
    if (i < 0) return;
    if (i === lesson.getTourIndex() && fromFocus) {
      highlightField(id);
      refreshChrome();
      return;
    }
    goField(i, fromFocus);
  }

  function startCancel() {
    persistFormFromDom();
    ask(
      "Rời form tạo phiếu? Dữ liệu chưa Lưu nháp sẽ mất. Không tạo Goods Receipt mới (GET danh sách, không POST).",
      function () {
        lesson.setAction({ type: "cancel", fieldId: "saveDraft", seq: Date.now() });
        lesson.setResult({ kind: "cancelled" });
        renderCancelled();
        refreshChrome();
      }
    );
  }

  function startSaveDraft() {
    persistFormFromDom();
    lesson.setTourIndex(Math.max(0, tour.indexOf("saveDraft")));
    var draft = V.servletValidate(formState(), catalog, false);
    var scenario = lesson.getScenario();
    var branch = "success";
    if (scenario === "db-error") {
      if (!draft.ok) {
        branch = "validation";
      } else {
        branch = "dbError";
      }
    } else if (!draft.ok) {
      branch = "validation";
    }
    lesson.setTraceBranch(branch);
    lesson.setTraceIndex(0);
    lesson.setAction({ type: "save-draft", fieldId: "saveDraft", branch: branch, seq: Date.now() });
    if (branch === "success") {
      lesson.applyDraftSuccess(formState());
    }
    renderFullForm();
    refreshChrome();
    if (els.backend && els.backend.scrollIntoView) {
      els.backend.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function filteredTrace() {
    var branch = lesson.getTrace().branch;
    if (branch === "auto") branch = "success";
    return (traceData.steps || []).filter(function (step) {
      if (step.onlyOn && step.onlyOn.indexOf(branch) === -1) return false;
      if (step.skipOn && step.skipOn.indexOf(branch) !== -1) return false;
      if (step.onlySuccessOrDb && branch === "validation") return false;
      return true;
    });
  }

  function renderTrace() {
    var host = document.getElementById("wizTraceHost");
    if (!host) return;
    if (currentFieldId() !== "saveDraft" || (lesson.getAction() || {}).type !== "save-draft") {
      host.innerHTML = "";
      return;
    }
    var tr = lesson.getTrace();
    var branch = tr.branch === "auto" ? "success" : tr.branch;
    var steps = filteredTrace();
    var idx = tr.index;
    if (idx >= steps.length) idx = Math.max(0, steps.length - 1);
    var step = steps[idx] || {};
    var http = V.buildPostPreview(formState());
    var sim = lesson.getSim();
    var dbAfter = "";
    if (branch === "success" && step.dbAfter) {
      dbAfter =
        "<div class=\"wiz-db\"><p><strong>Before → After [DEMO]</strong></p>" +
        "<p>Bảng phiếu nhập: từ " +
        Math.max(0, sim.goodsReceipts.length - 1) +
        " phiếu thành " +
        sim.goodsReceipts.length +
        " phiếu (trạng thái bản nháp).</p>" +
        "<p>Bảng dòng hàng: thêm " +
        (formState().items || []).length +
        " dòng. Cột lô tồn kho để trống vì chưa tạo lô trên kệ.</p>" +
        "<p>Số thuốc trên kệ, vị trí lô, số lượng đã nhận trên đơn đặt hàng, sổ xuất-nhập kho: <strong>không đổi</strong>.</p></div>";
    } else if (step.dbPreview || step.dbAfter) {
      dbAfter =
        '<div class="wiz-db"><p>Không COMMIT. Database demo không thêm phiếu.</p></div>';
    }
    var warn = "";
    if (branch === "dbError") {
      warn = '<p class="wiz-warn">Tình huống học: ghi phiếu thất bại. Hàm createDraft trả về -1 và hủy thay đổi. Không có phiếu mới.</p>';
    }
    if (branch === "validation") {
      warn =
        '<p class="wiz-warn">Không thể xem nhánh thành công vì dữ liệu form hiện tại chưa hợp lệ. Đang xem nhánh máy chủ trả lỗi, với đúng dữ liệu bạn đang điền.</p>';
    }
    host.innerHTML =
      '<div class="wiz-save"><div class="wiz-save-bar"><strong>Trace Lưu nháp</strong>' +
      '<label><input type="radio" name="wizBranch" value="success"' +
      (branch === "success" ? " checked" : "") +
      "> Success</label>" +
      '<label><input type="radio" name="wizBranch" value="validation"' +
      (branch === "validation" ? " checked" : "") +
      "> Validation</label>" +
      '<label><input type="radio" name="wizBranch" value="dbError"' +
      (branch === "dbError" ? " checked" : "") +
      '> DB Error <span class="wiz-muted">[DEMO SCENARIO]</span></label>' +
      '<span class="wiz-muted">' +
      (idx + 1) +
      "/" +
      steps.length +
      '</span><button type="button" class="sfe-btn" id="wizTracePrev">Previous</button>' +
      '<button type="button" class="sfe-btn primary" id="wizTraceNext">Next</button></div>' +
      warn +
      '<div class="wiz-trace-card"><h3>' +
      escapeHtml(step.title || "") +
      '</h3><p class="wiz-muted">' +
      escapeHtml(step.file || "") +
      " :" +
      escapeHtml(step.lines || "") +
      '</p><pre class="wiz-code">' +
      escapeHtml(step.code || "") +
      "</pre>" +
      (step.dynamicHttp ? '<pre class="wiz-code wiz-http">' + escapeHtml(http) + "</pre>" : "") +
      '<p class="wiz-prose">' +
      escapeHtml(step.explain || "") +
      "</p>" +
      dbAfter +
      (step.resultScreen
        ? '<p><button type="button" class="btn btn-primary" id="showListResult">Xem màn hình danh sách sau redirect</button></p>'
        : "") +
      "</div></div>";

    document.querySelectorAll('input[name="wizBranch"]').forEach(function (r) {
      r.addEventListener("change", function () {
        var next = r.value;
        var draft = V.servletValidate(formState(), catalog, false);
        if (next === "success" && !draft.ok) {
          lesson.setTraceBranch("validation");
          lesson.setAction({ type: "save-draft", fieldId: "saveDraft", branch: "validation", seq: Date.now() });
        } else {
          lesson.setTraceBranch(next);
          lesson.setAction({ type: "save-draft", fieldId: "saveDraft", branch: next, seq: Date.now() });
        }
        lesson.setTraceIndex(0);
        renderTrace();
        refreshChrome();
      });
    });
    var prev = document.getElementById("wizTracePrev");
    var nextB = document.getElementById("wizTraceNext");
    if (prev)
      prev.addEventListener("click", function () {
        if (idx > 0) {
          lesson.setTraceIndex(idx - 1);
          renderTrace();
        }
      });
    if (nextB)
      nextB.addEventListener("click", function () {
        if (idx < steps.length - 1) {
          lesson.setTraceIndex(idx + 1);
          renderTrace();
        }
      });
    var show = document.getElementById("showListResult");
    if (show)
      show.addEventListener("click", function () {
        var last = (lesson.getSim().goodsReceipts || []).slice(-1)[0];
        renderSavedList(last ? last.id : 901);
      });
  }

  function checksHtml(list, empty, pending) {
    if (!list || !list.length) return "<p class=\"wiz-muted\">" + empty + "</p>";
    return (
      "<ul class=\"wiz-checks\">" +
      list
        .map(function (c) {
          var st =
            c.pass === true ? "pass" : c.pass === false ? "fail" : "info";
          var mark =
            c.pass === true
              ? pending
                ? "Sẽ đạt khi gửi"
                : "Đạt"
              : c.pass === false
                ? pending
                  ? "Sẽ chưa đạt khi gửi"
                  : "Chưa đạt"
                : "Chỉ để biết";
          return (
            "<li class=\"wiz-check wiz-check--" +
            st +
            "\"><span class=\"wiz-badge\">" +
            mark +
            "</span> <strong>" +
            escapeHtml(c.label) +
            "</strong> — " +
            escapeHtml(c.message) +
            (c.runsWhen ? ' <em class="wiz-muted">' + escapeHtml(c.runsWhen) + "</em>" : "") +
            "</li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }

  function renderFieldCard() {
    var fieldId = currentFieldId();
    var f = fieldMeta(fieldId);
    var how = (guide.howTo || {})[fieldId] || "";
    var req = (guide.required || {})[fieldId];
    var st = V.fieldStatus(formState(), fieldId, catalog);
    var reqLabel = req === true ? "Bắt buộc" : req === false ? "Không bắt buộc" : String(req || "");
    els.fieldCard.innerHTML =
      '<p class="wiz-card-kicker">Ô đang học trên form</p>' +
      "<h3>" +
      escapeHtml(f.label || fieldId) +
      "</h3>" +
      '<p class="wiz-prose"><strong>Ô này dùng để làm gì?</strong> ' +
      escapeHtml(f.business || "") +
      "</p>" +
      '<p class="wiz-prose"><strong>Bạn cần làm gì trên ô này?</strong> ' +
      escapeHtml(how) +
      " " +
      escapeHtml(
        fieldId === "saveDraft"
          ? "Nút này là cách gửi phiếu. Không phải ô điền."
          : req === true
            ? "Ô này bắt buộc: không được để trống."
            : req === false
              ? "Ô này không bắt buộc: có thể để trống."
              : reqLabel
                ? "Quy tắc bắt buộc: " + reqLabel + "."
                : ""
      ) +
      "</p>" +
      '<p class="wiz-prose"><strong>Bấm Lưu nháp có làm tăng số thuốc trên kệ không?</strong> Không. Bài học này chỉ mô phỏng nút Lưu nháp. Máy chủ chỉ ghi một phiếu ở trạng thái bản nháp. Số lượng thuốc trong kho, số lượng đã nhận trên đơn đặt hàng, và sổ xuất-nhập kho đều không đổi. Chỉ khi có người bấm Xác nhận sau này (bài học này không làm bước đó) thì tồn kho mới tăng.</p>' +
      "<h4 class=\"wiz-h4\">Máy kiểm tra dữ liệu của bạn như thế nào?</h4>" +
      "<p class=\"wiz-muted\">Bước 1 — Trình duyệt kiểm tra ngay khi bạn gõ. Dữ liệu vẫn nằm trên máy bạn, chưa gửi đến máy chủ Java.</p>" +
      checksHtml(st.browser, "Ô này không có quy tắc kiểm tra ngay trên trình duyệt.") +
      "<p class=\"wiz-muted\">Bước 2 — Máy chủ Java kiểm tra khi bạn bấm Lưu nháp. Chương trình nhận yêu cầu tên GoodsReceiptServlet, hàm kiểm tra tên validateReceipt. Nếu bạn chưa bấm Lưu nháp, các dòng dưới đây cho biết nếu gửi đi thì sẽ đạt hay chưa đạt — chưa phải máy chủ đã chạy thật.</p>" +
      checksHtml(st.servlet, "", (lesson.getAction() || {}).type !== "save-draft") +
      "<p class=\"wiz-muted\">Bước 3 — Chỉ khi Xác nhận nhập kho sau này. Bài học này không mô phỏng bước đó, nên các quy tắc dưới đây không được chạy.</p>" +
      checksHtml(st.daoConfirm, "") +
      '<button type="button" class="sfe-btn" id="toggleTech">' +
      (techOpen ? "Ẩn cách hệ thống xử lý" : "Xem cách hệ thống xử lý") +
      "</button>" +
      '<div id="techBlock" class="' +
      (techOpen ? "" : "is-hidden") +
      '">' +
      '<p class="wiz-muted">Tên ô khi gửi lên máy chủ: <code>' +
      escapeHtml(f.param || "") +
      "</code>. Tệp chương trình: " +
      '<a class="sfe-doc-link" target="_blank" rel="noopener" href="' +
      lesson.GH +
      "src/java/controller/GoodsReceiptServlet.java" +
      '">GoodsReceiptServlet.java</a></p></div>';
    var tog = document.getElementById("toggleTech");
    if (tog)
      tog.addEventListener("click", function () {
        techOpen = !techOpen;
        renderFieldCard();
        renderLayers();
      });
  }

  function renderLayers() {
    var action = lesson.getAction() || { type: "idle", fieldId: currentFieldId() };
    var statuses = FLOW.statusesFor(action);
    els.layerNote.textContent = FLOW.arrowsFor(action);
    els.layers.innerHTML = FLOW.layers
      .map(function (layer, i) {
        var st = statuses[layer.id] || "na";
        var sel = selectedLayerId === layer.id ? " is-selected" : "";
        return (
          (i ? '<span class="wiz-layer-arrow" aria-hidden="true">→</span>' : "") +
          '<button type="button" class="wiz-layer is-' +
          st +
          sel +
          '" data-layer="' +
          layer.id +
          '">' +
          escapeHtml(layer.label) +
          '<small>' +
          escapeHtml(FLOW.statusLabel[st] || st) +
          "</small></button>"
        );
      })
      .join("");
    els.layers.querySelectorAll("[data-layer]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        selectedLayerId = btn.dataset.layer;
        techOpen = true;
        renderLayers();
        renderLayerDetail();
        renderBackend({ selectedLayer: selectedLayerId });
      });
    });
    renderLayerDetail();
  }

  function renderLayerDetail() {
    var box = els.layerDetail;
    var action = lesson.getAction() || { type: "idle", fieldId: currentFieldId() };
    if (!selectedLayerId) {
      box.innerHTML =
        '<p class="wiz-muted">Bấm một layer để xem input/output với <em>dữ liệu form hiện tại</em>. Layer chỉ sáng khi có hành động tương ứng — không vì đang focus field.</p>';
      return;
    }
    var d = FLOW.layerDetail(selectedLayerId, action, formState(), catalog);
    var layer = FLOW.layers.filter(function (l) {
      return l.id === selectedLayerId;
    })[0];
    box.innerHTML =
      "<h4>" +
      escapeHtml(layer.label) +
      ' · <span class="wiz-badge">' +
      escapeHtml(d.statusLabel) +
      "</span></h4>" +
      "<p>" +
      escapeHtml(layer.hint) +
      "</p>" +
      '<dl class="wiz-dl">' +
      "<dt>File</dt><dd>" +
      escapeHtml(d.file || "—") +
      "</dd>" +
      "<dt>Method</dt><dd><code>" +
      escapeHtml(d.method || "—") +
      "</code></dd>" +
      "<dt>Input</dt><dd>" +
      escapeHtml(d.input || "—") +
      "</dd>" +
      "<dt>Output</dt><dd><pre class=\"wiz-code\">" +
      escapeHtml(d.output || "—") +
      "</pre></dd>" +
      "<dt>Có HTTP?</dt><dd>" +
      (d.hasHttp ? "Có" : "Không") +
      "</dd>" +
      "<dt>Có SQL?</dt><dd>" +
      (d.hasSql ? "Có" : "Không") +
      "</dd>" +
      "<dt>DB đổi?</dt><dd>" +
      (d.dbChanged ? "Có (nháp GR)" : "Không") +
      "</dd>" +
      "<dt>Tiếp theo</dt><dd>" +
      escapeHtml(d.nextWhy || "") +
      "</dd></dl>";
  }

  function renderBackend(opts) {
    if (!window.SFE_BACKEND || !els.backend) return;
    window.SFE_BACKEND.mount(els.backend, {
      action: lesson.getAction() || { type: "idle", fieldId: currentFieldId() },
      form: formState(),
      catalog: catalog,
      sim: lesson.getSim(),
      selectedLayer: opts && opts.selectedLayer
    });
  }

  function renderStepper() {
    if (!els.stepper) return;
    var cur = stepForField(currentFieldId());
    els.stepper.innerHTML = guide.steps
      .map(function (s, i) {
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
        goFieldId(btn.getAttribute("data-group"), false);
      });
    });
  }

  function renderProgress() {
    if (!els.progress) return;
    var i = lesson.getTourIndex();
    els.progress.innerHTML = tour
      .map(function (id, idx) {
        return (
          '<button type="button" class="wiz-dot' +
          (idx === i ? " is-on" : "") +
          (idx < i ? " is-done" : "") +
          '" data-fi="' +
          idx +
          '" title="' +
          escapeHtml((fieldMeta(id).label || id) + "") +
          '">' +
          (idx + 1) +
          "</button>"
        );
      })
      .join("");
    els.progress.querySelectorAll("[data-fi]").forEach(function (b) {
      b.addEventListener("click", function () {
        goField(parseInt(b.dataset.fi, 10), false);
      });
    });
  }

  function applyMode() {
    var explorer = lesson.getMode() === "explorer";
    if (els.guidedSide) els.guidedSide.classList.toggle("is-hidden", explorer);
    if (els.explorerSide) els.explorerSide.classList.toggle("is-hidden", !explorer);
    if (els.modeGuided) els.modeGuided.classList.toggle("is-on", !explorer);
    if (els.modeExplorer) els.modeExplorer.classList.toggle("is-on", explorer);
    if (explorer && window.SFE_EXPLORER && window.SFE_EXPLORER.render) {
      window.SFE_EXPLORER.render();
    }
  }

  function refreshChrome() {
    var fmeta = fieldMeta(currentFieldId());
    var step = stepForField(currentFieldId());
    var i = lesson.getTourIndex();
    els.title.textContent = fmeta.label || step.title;
    els.sub.textContent = step.subtitle;
    els.stepLabel.textContent = "Field " + (i + 1) + " / " + tour.length + " · " + (step.title || "");
    els.back.disabled = i === 0;
    els.next.textContent = i === tour.length - 1 ? "Về field đầu" : "Field tiếp theo";
    renderStepper();
    renderProgress();
    renderFieldCard();
    renderLayers();
    renderBackend();
    renderTrace();
    applyMode();
    highlightField(currentFieldId());
    if (window.SFE_EXPLORER && window.SFE_EXPLORER.sync && lesson.getMode() === "explorer") {
      window.SFE_EXPLORER.sync();
    }
  }

  if (els.back)
    els.back.addEventListener("click", function () {
      goField(lesson.getTourIndex() - 1, false);
    });
  if (els.next)
    els.next.addEventListener("click", function () {
      var i = lesson.getTourIndex();
      if (i === tour.length - 1) goField(0, false);
      else goField(i + 1, false);
    });
  if (els.modeGuided)
    els.modeGuided.addEventListener("click", function () {
      persistFormFromDom();
      lesson.setMode("guided");
      applyMode();
    });
  if (els.modeExplorer)
    els.modeExplorer.addEventListener("click", function () {
      persistFormFromDom();
      lesson.setMode("explorer");
      applyMode();
    });
  if (els.resetBtn)
    els.resetBtn.addEventListener("click", function () {
      ask("Xóa dữ liệu bài học đang nhập và trở về form mặc định?", function () {
        lesson.resetLesson();
        selectedLayerId = null;
        if (els.scenario) els.scenario.value = "";
        renderFullForm();
        refreshChrome();
      });
    });

  if (els.scenario) {
    V.scenarios.forEach(function (s) {
      var o = document.createElement("option");
      o.value = s.id;
      o.textContent = s.label;
      els.scenario.appendChild(o);
    });
    els.scenario.addEventListener("change", function () {
      var id = els.scenario.value;
      if (!id) {
        lesson.setScenario(null);
        return;
      }
      persistFormFromDom();
      var next = V.applyScenario(formState(), id, catalog);
      lesson.setForm(next);
      lesson.setScenario(id);
      if (id === "db-error") {
        lesson.setAction({ type: "idle", fieldId: "saveDraft" });
      } else {
        lesson.setAction({ type: "type", fieldId: currentFieldId() });
      }
      renderFullForm();
      refreshChrome();
      els.scenario.value = id;
    });
  }

  window.SFE_GUIDED = {
    persist: persistFormFromDom,
    refresh: refreshChrome,
    renderForm: renderFullForm
  };

  renderFullForm();
  refreshChrome();
})();
