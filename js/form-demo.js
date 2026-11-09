/**
 * Thao tác form demo giống goods-receipt-form.jsp (client-side only).
 */
(function (global) {
  "use strict";

  var catalog = null;

  function $(id) {
    return document.getElementById(id);
  }

  function optionHtml(value, text, attrs) {
    var extra = "";
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        extra += " " + k + '="' + String(attrs[k]).replace(/"/g, "&quot;") + '"';
      });
    }
    return '<option value="' + value + '"' + extra + ">" + text + "</option>";
  }

  function fillProductSelect(select, items, selectedId) {
    var html = '<option value="">— Sản phẩm —</option>';
    (items || []).forEach(function (it) {
      html += optionHtml(it.poItemId, it.name, {
        "data-product-id": it.productId,
        "data-ordered": it.ordered,
        "data-received": it.received,
        "data-remaining": it.remaining,
        "data-cost": it.cost,
        selected: selectedId && String(selectedId) === String(it.poItemId) ? "selected" : null
      }).replace(' selected="selected"', selectedId && String(selectedId) === String(it.poItemId) ? " selected" : "");
    });
    // rebuild cleanly
    select.innerHTML = "";
    var empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "— Sản phẩm —";
    select.appendChild(empty);
    (items || []).forEach(function (it) {
      var o = document.createElement("option");
      o.value = it.poItemId;
      o.textContent = it.name;
      o.dataset.productId = it.productId;
      o.dataset.ordered = it.ordered;
      o.dataset.received = it.received;
      o.dataset.remaining = it.remaining;
      o.dataset.cost = it.cost;
      if (selectedId && String(selectedId) === String(it.poItemId)) o.selected = true;
      select.appendChild(o);
    });
  }

  function updateRemaining(row) {
    var sel = row.querySelector(".gr-product");
    var hint = row.querySelector(".gr-remaining");
    if (!sel || !hint) return;
    var opt = sel.options[sel.selectedIndex];
    if (!opt || !opt.value) {
      hint.textContent = "";
      return;
    }
    hint.textContent =
      "Đã đặt: " +
      opt.dataset.ordered +
      " | Đã nhận: " +
      opt.dataset.received +
      " | Còn lại: " +
      opt.dataset.remaining;
  }

  function updateReasonVisibility(row) {
    var insp = row.querySelector(".gr-inspection");
    var reason = row.querySelector(".gr-reason");
    if (!insp || !reason) return;
    if (insp.value === "TU_CHOI") {
      reason.hidden = false;
      reason.required = true;
    } else {
      reason.hidden = true;
      reason.required = false;
      reason.value = "";
    }
  }

  function toggleBinRequired(row) {
    var insp = row.querySelector(".gr-inspection");
    var bin = row.querySelector(".gr-bin");
    if (!insp || !bin) return;
    bin.required = insp.value === "CHAP_NHAN";
  }

  function fillSelect(sel, rows, placeholder, valueKey, labelKey, selected) {
    sel.innerHTML = "";
    var ph = document.createElement("option");
    ph.value = "";
    ph.textContent = placeholder;
    sel.appendChild(ph);
    (rows || []).forEach(function (r) {
      var o = document.createElement("option");
      o.value = r[valueKey];
      o.textContent = r[labelKey];
      if (selected && String(selected) === String(r[valueKey])) o.selected = true;
      sel.appendChild(o);
    });
  }

  function loadRacks(zoneSel, rackSel, binSel, preRack, preBin) {
    fillSelect(rackSel, [], "Kệ", "id", "code");
    fillSelect(binSel, [], "Ngăn", "id", "code");
    rackSel.disabled = true;
    binSel.disabled = true;
    if (!zoneSel.value) return;
    var racks = catalog.locations.racksByZone[zoneSel.value] || [];
    fillSelect(rackSel, racks, "Kệ", "id", "code", preRack);
    rackSel.disabled = false;
    if (preRack) loadBins(rackSel, binSel, preBin);
  }

  function loadBins(rackSel, binSel, preBin) {
    fillSelect(binSel, [], "Ngăn", "id", "code");
    binSel.disabled = true;
    if (!rackSel.value) return;
    var bins = catalog.locations.binsByRack[rackSel.value] || [];
    fillSelect(binSel, bins, "Ngăn", "id", "code", preBin);
    binSel.disabled = false;
  }

  function initLocationRow(row) {
    var zoneSel = row.querySelector(".gr-zone");
    var rackSel = row.querySelector(".gr-rack");
    var binSel = row.querySelector(".gr-bin");
    if (!zoneSel || !rackSel || !binSel) return;
    fillSelect(zoneSel, catalog.locations.zones, "Khu", "id", "code", zoneSel.value || zoneSel.dataset.selected);
    zoneSel.onchange = function () {
      loadRacks(zoneSel, rackSel, binSel, null, null);
    };
    rackSel.onchange = function () {
      loadBins(rackSel, binSel, null);
    };
    if (zoneSel.value) {
      loadRacks(
        zoneSel,
        rackSel,
        binSel,
        rackSel.dataset.selected || rackSel.value,
        binSel.dataset.selected || binSel.value
      );
    }
  }

  function updateSummary() {
    var body = $("itemsBody");
    var box = $("grSummary");
    if (!body || !box) return;
    var rows = body.querySelectorAll(".gr-item-row");
    var acceptedLines = 0;
    var acceptedQty = 0;
    var rejectedLines = 0;
    var rejectedQty = 0;
    var value = 0;
    rows.forEach(function (row) {
      var qty = parseInt((row.querySelector(".gr-qty") || {}).value, 10);
      var cost = parseFloat((row.querySelector(".gr-cost") || {}).value);
      var inspection = (row.querySelector(".gr-inspection") || {}).value;
      if (isNaN(qty) || qty <= 0) return;
      if (inspection === "CHAP_NHAN") {
        acceptedLines++;
        acceptedQty += qty;
        if (!isNaN(cost)) value += qty * cost;
      } else if (inspection === "TU_CHOI") {
        rejectedLines++;
        rejectedQty += qty;
      }
    });
    box.hidden = rows.length === 0;
    var spans = box.querySelectorAll("span");
    if (spans[0])
      spans[0].textContent =
        acceptedLines + " dòng chấp nhận (" + acceptedQty + " đơn vị sẽ vào kho)";
    if (spans[1])
      spans[1].textContent =
        rejectedLines + " dòng từ chối (" + rejectedQty + " đơn vị loại ra)";
    if (spans[2])
      spans[2].textContent =
        "Giá trị chấp nhận: " + value.toLocaleString("vi-VN") + " VND";
  }

  function paintRow(row) {
    updateRemaining(row);
    updateReasonVisibility(row);
    toggleBinRequired(row);
    initLocationRow(row);
  }

  function currentPoItems() {
    var poId = ($("purchaseOrderId") || {}).value;
    var po = catalog.purchaseOrders[poId];
    return po ? po.items : [];
  }

  function syncPoContext(clearRows) {
    var poSelect = $("purchaseOrderId");
    var supplier = $("supplierName");
    if (!poSelect) return;
    var po = catalog.purchaseOrders[poSelect.value];
    if (supplier) supplier.value = po ? po.supplierName : "";

    var items = po ? po.items : [];
    var body = $("itemsBody");
    var addBtn = $("addItemBtn");
    var noPoHint = $("noPoHint");
    if (addBtn) addBtn.disabled = !items.length;
    if (noPoHint) noPoHint.hidden = !!items.length;

    // update template options
    var tpl = $("grRowTemplate");
    if (tpl) {
      var tplSel = tpl.content.querySelector(".gr-product");
      if (tplSel) fillProductSelect(tplSel, items, null);
    }

    if (!body) return;
    if (clearRows) {
      body.innerHTML = "";
      if (items.length) {
        addItemRow(items[0].poItemId);
      }
    } else {
      body.querySelectorAll(".gr-item-row").forEach(function (row) {
        var sel = row.querySelector(".gr-product");
        var keep = sel ? sel.value : "";
        fillProductSelect(sel, items, keep);
        paintRow(row);
      });
    }
    updateSummary();
  }

  function addItemRow(selectedPoItemId) {
    var body = $("itemsBody");
    var tpl = $("grRowTemplate");
    if (!body || !tpl) return;
    var clone = tpl.content.cloneNode(true);
    body.appendChild(clone);
    var row = body.lastElementChild;
    fillProductSelect(row.querySelector(".gr-product"), currentPoItems(), selectedPoItemId);
    if (selectedPoItemId) {
      var opt = row.querySelector(".gr-product").selectedOptions[0];
      var cost = row.querySelector(".gr-cost");
      if (opt && cost && opt.dataset.cost) cost.value = opt.dataset.cost;
    }
    paintRow(row);
    updateSummary();
    return row;
  }

  function wireBodyEvents() {
    var body = $("itemsBody");
    if (!body || body.dataset.wired) return;
    body.dataset.wired = "1";

    body.addEventListener("change", function (e) {
      var row = e.target.closest(".gr-item-row");
      if (!row) return;
      if (e.target.classList.contains("gr-product")) {
        var opt = e.target.options[e.target.selectedIndex];
        updateRemaining(row);
        var costInput = row.querySelector(".gr-cost");
        if (opt && costInput && opt.dataset.cost) costInput.value = opt.dataset.cost;
      }
      if (e.target.classList.contains("gr-inspection")) {
        updateReasonVisibility(row);
        toggleBinRequired(row);
      }
      updateSummary();
      if (global.SFE && SFE.refreshHttpPreview) SFE.refreshHttpPreview();
    });

    body.addEventListener("input", function (e) {
      if (
        e.target.classList.contains("gr-qty") ||
        e.target.classList.contains("gr-cost") ||
        e.target.classList.contains("gr-batch")
      ) {
        updateSummary();
        if (global.SFE && SFE.refreshHttpPreview) SFE.refreshHttpPreview();
      }
    });

    body.addEventListener("click", function (e) {
      if (!e.target.classList.contains("gr-remove")) return;
      e.target.closest(".gr-item-row").remove();
      updateSummary();
      if (global.SFE && SFE.refreshHttpPreview) SFE.refreshHttpPreview();
    });
  }

  function applyPoChange(newPoId) {
    var poSelect = $("purchaseOrderId");
    if (!poSelect) return;
    poSelect.value = newPoId;
    poSelect.dataset.prev = newPoId;
    syncPoContext(true);
  }

  function init(demoCatalog) {
    catalog = demoCatalog || global.SFE_DEMO;
    if (!catalog) return;

    wireBodyEvents();

    var poSelect = $("purchaseOrderId");
    if (poSelect) {
      poSelect.dataset.prev = poSelect.value;
      poSelect.addEventListener("change", function () {
        var body = $("itemsBody");
        var hasRows = body && body.querySelectorAll(".gr-item-row").length > 0;
        if (hasRows) {
          var ok = confirm(
            "Đổi đơn đặt hàng sẽ xóa các dòng sản phẩm hiện tại. Tiếp tục?"
          );
          if (!ok) {
            poSelect.value = poSelect.dataset.prev || "";
            return;
          }
        }
        poSelect.dataset.prev = poSelect.value;
        syncPoContext(true);
        if (global.SFE) {
          if (SFE.selectAction) SFE.selectAction("po-change", false);
          if (SFE.refreshHttpPreview) SFE.refreshHttpPreview();
        }
      });
    }

    var addBtn = $("addItemBtn");
    if (addBtn && !addBtn.dataset.formDemo) {
      addBtn.dataset.formDemo = "1";
      addBtn.addEventListener("click", function () {
        if (global.SFE && SFE.selectAction) SFE.selectAction("add-item", false);
        addItemRow(null);
      });
    }

    var resetBtn = $("sfeResetDemo");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        if ($("purchaseOrderId")) $("purchaseOrderId").value = "12";
        if ($("receiptDate")) $("receiptDate").value = "2026-11-09";
        if ($("invoiceNumber")) $("invoiceNumber").value = "HD-DEMO-001";
        if ($("note")) $("note").value = "[DEMO] Phiếu nhập thử — Flow Explorer";
        applyPoChange("12");
        var body = $("itemsBody");
        if (body && body.querySelector(".gr-item-row")) {
          var row = body.querySelector(".gr-item-row");
          var batch = row.querySelector(".gr-batch");
          var exp = row.querySelector(".gr-expiry");
          var qty = row.querySelector(".gr-qty");
          var cost = row.querySelector(".gr-cost");
          var insp = row.querySelector(".gr-inspection");
          if (batch) batch.value = "LOT-A01";
          if (exp) exp.value = "2027-06-30";
          if (qty) qty.value = "40";
          if (cost) cost.value = "15000";
          if (insp) insp.value = "CHO_KIEM_TRA";
          row.querySelector(".gr-zone").dataset.selected = "1";
          row.querySelector(".gr-rack").dataset.selected = "11";
          row.querySelector(".gr-bin").dataset.selected = "111";
          paintRow(row);
        }
        updateSummary();
        if (global.SFE && SFE.selectAction) SFE.selectAction("save-draft", false);
      });
    }

    // initial paint
    syncPoContext(false);
    var body = $("itemsBody");
    if (body) {
      body.querySelectorAll(".gr-item-row").forEach(paintRow);
    }
    updateSummary();
  }

  global.SFE_FormDemo = {
    init: init,
    updateSummary: updateSummary,
    syncPoContext: syncPoContext,
    addItemRow: addItemRow
  };
})(window);
