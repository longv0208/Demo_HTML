/**
 * Trace Flow Simulator — Lưu nháp (không alert).
 */
(function (global) {
  "use strict";

  var trace = null;
  var state = {
    open: false,
    branch: "success",
    validationId: "no-po",
    index: 0,
    playing: false,
    speedMs: 1400,
    timer: null,
    steps: []
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function collectFormSnapshot() {
    var form = $("grForm");
    var snap = {
      purchaseOrderId: "",
      receiptDate: "",
      invoiceNumber: "",
      note: "",
      items: [],
      body: ""
    };
    if (!form) return snap;
    snap.purchaseOrderId = ($("purchaseOrderId") || {}).value || "";
    snap.receiptDate = ($("receiptDate") || {}).value || "";
    snap.invoiceNumber = ($("invoiceNumber") || {}).value || "";
    snap.note = ($("note") || {}).value || "";
    var fd = new FormData(form);
    var parts = [];
    fd.forEach(function (v, k) {
      parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(String(v)));
    });
    snap.body = parts.join("&");
    form.querySelectorAll(".gr-item-row").forEach(function (row) {
      var sel = row.querySelector(".gr-product");
      snap.items.push({
        poItemId: sel ? sel.value : "",
        product: sel && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : "",
        batchNumber: (row.querySelector(".gr-batch") || {}).value || "",
        expiryDate: (row.querySelector(".gr-expiry") || {}).value || "",
        quantity: (row.querySelector(".gr-qty") || {}).value || "",
        costPrice: (row.querySelector(".gr-cost") || {}).value || "",
        binId: (row.querySelector(".gr-bin") || {}).value || "",
        inspection: (row.querySelector(".gr-inspection") || {}).value || "",
        reason: (row.querySelector(".gr-reason") || {}).value || ""
      });
    });
    return snap;
  }

  function filterSteps(branch) {
    return (trace.steps || []).filter(function (step) {
      if (step.onlyOn && step.onlyOn.indexOf(branch) === -1) return false;
      if (step.skipOn && step.skipOn.indexOf(branch) !== -1) return false;
      if (step.onlySuccessOrDb && branch === "validation") return false;
      return true;
    });
  }

  function buildHttp(snap) {
    return (
      "POST /Pharma_Flow/inventory/receipts?action=create HTTP/1.1\n" +
      "Host: localhost:8080\n" +
      "Content-Type: application/x-www-form-urlencoded\n" +
      "Cookie: JSESSIONID=demo-session\n\n" +
      (snap.body || "(empty)")
    );
  }

  function dbBefore() {
    return {
      goods_receipts: "3 phiếu [DEMO] — chưa có phiếu mới",
      goods_receipt_items: "—",
      inventory_batches: "không đổi",
      inventory_batch_locations: "không đổi",
      "purchase_order_items.received_quantity": "không đổi",
      inventory_movements: "không có NHAP_KHO mới"
    };
  }

  function dbAfterSuccess(snap) {
    return {
      goods_receipts: "+1 hàng status=BAN_NHAP, po=" + snap.purchaseOrderId + " [DEMO id=901]",
      goods_receipt_items: "+" + snap.items.length + " dòng (batch_id=NULL)",
      inventory_batches: "không đổi",
      inventory_batch_locations: "không đổi",
      "purchase_order_items.received_quantity": "không đổi",
      inventory_movements: "không thêm NHAP_KHO"
    };
  }

  function resolveVars(step, snap) {
    if (step.dynamicVars === "receipt") {
      return {
        purchaseOrderId: snap.purchaseOrderId || "null",
        receiptDate: snap.receiptDate || "null",
        invoiceNumber: snap.invoiceNumber || '""',
        note: (snap.note || "").slice(0, 40)
      };
    }
    if (step.dynamicVars === "items") {
      return {
        lineCount: String(snap.items.length),
        firstBatch: snap.items[0] ? snap.items[0].batchNumber : "—",
        firstQty: snap.items[0] ? snap.items[0].quantity : "—"
      };
    }
    return step.vars || {};
  }

  function renderStep() {
    var step = state.steps[state.index];
    var panel = $("sfeTraceStep");
    var meta = $("sfeTraceMeta");
    var timeline = $("sfeTraceTimeline");
    if (!step || !panel) return;

    var snap = state.snap;
    var vars = resolveVars(step, snap);
    var varHtml = Object.keys(vars)
      .map(function (k) {
        return (
          "<tr><td><code>" +
          escapeHtml(k) +
          "</code></td><td>" +
          escapeHtml(vars[k]) +
          "</td></tr>"
        );
      })
      .join("");

    var scenarioNote = "";
    if (state.branch === "validation" && step.branchPoint) {
      var sc = (trace.validationScenarios || []).find(function (s) {
        return s.id === state.validationId;
      });
      if (sc) {
        scenarioNote =
          '<div class="sfe-trace-alert">errors["' +
          escapeHtml(sc.errorKey) +
          '"] = "' +
          escapeHtml(sc.message) +
          '"</div>';
      }
    }
    if (state.branch === "dbError" && step.branchPointDb) {
      scenarioNote =
        '<div class="sfe-trace-alert">SQLException → rollback → receiptId = -1</div>';
    }

    var httpBlock = step.dynamicHttp
      ? '<pre class="sfe-http-box">' + escapeHtml(buildHttp(snap)) + "</pre>"
      : "";

    var dbHtml = "";
    if (step.dbPreview || step.dbAfter) {
      var db = step.dbAfter && state.branch === "success" ? dbAfterSuccess(snap) : dbBefore();
      dbHtml =
        '<div class="sfe-section"><h4>Database [DEMO]</h4><table class="sfe-mini-table"><tbody>' +
        Object.keys(db)
          .map(function (k) {
            return (
              "<tr><td><code>" +
              escapeHtml(k) +
              "</code></td><td>" +
              escapeHtml(db[k]) +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table></div>";
    }

    var gh =
      trace.githubBase +
      (step.file.indexOf("web/") === 0 || step.file.indexOf("src/") === 0
        ? step.file
        : step.file.indexOf("GoodsReceiptDAO") >= 0
          ? "src/java/dao/GoodsReceiptDAO.java"
          : step.file.indexOf("GoodsReceiptServlet") >= 0
            ? "src/java/controller/GoodsReceiptServlet.java"
            : "");

    panel.innerHTML =
      '<p class="sfe-insp-title">' +
      escapeHtml(step.title) +
      "</p>" +
      '<p class="sfe-insp-sub">' +
      escapeHtml(step.component) +
      " · <code class=\"sfe-code\">" +
      escapeHtml(step.file) +
      "</code> · " +
      escapeHtml(step.method) +
      (step.lines ? " :" + escapeHtml(step.lines) : "") +
      "</p>" +
      scenarioNote +
      '<pre class="sfe-code-block"><code>' +
      escapeHtml(step.code) +
      "</code></pre>" +
      httpBlock +
      '<p class="sfe-prose">' +
      escapeHtml(step.explain) +
      "</p>" +
      (varHtml
        ? '<div class="sfe-section"><h4>Biến</h4><table class="sfe-mini-table"><tbody>' +
          varHtml +
          "</tbody></table></div>"
        : "") +
      '<div class="sfe-section"><h4>Input → Output</h4><p class="sfe-prose"><strong>In:</strong> ' +
      escapeHtml((step.io && step.io.in) || "—") +
      "<br><strong>Out:</strong> " +
      escapeHtml((step.io && step.io.out) || "—") +
      "</p></div>" +
      dbHtml +
      '<div class="sfe-section"><h4>Bước tiếp theo?</h4><p class="sfe-prose">' +
      escapeHtml(step.nextWhy || "") +
      "</p></div>" +
      (gh
        ? '<p class="sfe-insp-sub"><a class="sfe-doc-link" href="' +
          gh +
          '" target="_blank" rel="noopener">Xem source trên GitHub</a></p>'
        : "");

    if (meta) {
      meta.textContent =
        "Bước " + (state.index + 1) + " / " + state.steps.length + " · Nhánh: " + state.branch;
    }

    if (timeline) {
      timeline.innerHTML = state.steps
        .map(function (s, i) {
          return (
            '<button type="button" class="sfe-tl-item' +
            (i === state.index ? " active" : i < state.index ? " done" : "") +
            '" data-i="' +
            i +
            '">' +
            (i + 1) +
            ". " +
            escapeHtml(s.title.replace(/^\d+\.\s*/, "").slice(0, 42)) +
            "</button>"
          );
        })
        .join("");
      timeline.querySelectorAll(".sfe-tl-item").forEach(function (btn) {
        btn.addEventListener("click", function () {
          pause();
          state.index = parseInt(btn.dataset.i, 10);
          renderStep();
        });
      });
    }

    var result = $("sfeTraceResult");
    if (result) {
      if (step.resultScreen && state.branch === "success") {
        result.hidden = false;
        result.innerHTML =
          '<div class="sfe-result-card">' +
          "<strong>Đã lưu nháp phiếu nhập — chưa có gì vào kho.</strong>" +
          "<p>Danh sách phiếu nhập (goods-receipt-list.jsp) · GR #[DEMO] 901 · BAN_NHAP</p></div>";
      } else if (step.id === "validation-end") {
        result.hidden = false;
        result.innerHTML =
          '<div class="sfe-result-card err"><strong>Validation failed — forward lại form</strong>' +
          "<p>Không INSERT. Người dùng sửa lỗi trên form.</p></div>";
      } else if (step.id === "db-end") {
        result.hidden = false;
        result.innerHTML =
          '<div class="sfe-result-card err"><strong>Không lưu được phiếu</strong>' +
          "<p>Transaction đã rollback.</p></div>";
      } else {
        result.hidden = true;
        result.innerHTML = "";
      }
    }
  }

  function pause() {
    state.playing = false;
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    var playBtn = $("sfeTracePlay");
    if (playBtn) playBtn.textContent = "Play";
  }

  function play() {
    if (state.playing) {
      pause();
      return;
    }
    state.playing = true;
    var playBtn = $("sfeTracePlay");
    if (playBtn) playBtn.textContent = "Pause";
    state.timer = setInterval(function () {
      if (state.index >= state.steps.length - 1) {
        pause();
        return;
      }
      state.index++;
      renderStep();
    }, state.speedMs);
  }

  function rebuildSteps() {
    state.steps = filterSteps(state.branch);
    state.index = 0;
    renderStep();
  }

  function open() {
    trace = global.SFE_TRACE_SAVE_DRAFT;
    if (!trace) {
      alert("Thiếu data/save-draft-trace.js");
      return;
    }
    state.snap = collectFormSnapshot();
    state.open = true;
    var modal = $("sfeTraceModal");
    if (modal) modal.hidden = false;
    rebuildSteps();
  }

  function close() {
    pause();
    state.open = false;
    var modal = $("sfeTraceModal");
    if (modal) modal.hidden = true;
  }

  function wire() {
    var openBtn = $("sfeTraceBtn");
    if (openBtn) {
      openBtn.addEventListener("click", function () {
        open();
      });
    }
    var startBtn = $("sfeStartTrace");
    if (startBtn) {
      startBtn.addEventListener("click", function () {
        if (global.SFE && SFE.selectAction) SFE.selectAction("save-draft", false);
        open();
      });
    }

    var closeBtn = $("sfeTraceClose");
    if (closeBtn) closeBtn.addEventListener("click", close);

    $("sfeTracePrev") &&
      $("sfeTracePrev").addEventListener("click", function () {
        pause();
        if (state.index > 0) state.index--;
        renderStep();
      });
    $("sfeTraceNext") &&
      $("sfeTraceNext").addEventListener("click", function () {
        pause();
        if (state.index < state.steps.length - 1) state.index++;
        renderStep();
      });
    $("sfeTracePlay") && $("sfeTracePlay").addEventListener("click", play);
    $("sfeTraceReset") &&
      $("sfeTraceReset").addEventListener("click", function () {
        pause();
        state.snap = collectFormSnapshot();
        state.index = 0;
        renderStep();
      });

    var speed = $("sfeTraceSpeed");
    if (speed) {
      speed.addEventListener("change", function () {
        state.speedMs = parseInt(speed.value, 10) || 1400;
        if (state.playing) {
          pause();
          play();
        }
      });
    }

    document.querySelectorAll('input[name="sfeTraceBranch"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        pause();
        state.branch = radio.value;
        var valWrap = $("sfeTraceValWrap");
        if (valWrap) valWrap.hidden = state.branch !== "validation";
        rebuildSteps();
      });
    });

    var valSel = $("sfeTraceValScenario");
    if (valSel) {
      (trace || global.SFE_TRACE_SAVE_DRAFT).validationScenarios.forEach(function (s) {
        var o = document.createElement("option");
        o.value = s.id;
        o.textContent = s.label;
        valSel.appendChild(o);
      });
      valSel.addEventListener("change", function () {
        state.validationId = valSel.value;
        if (state.branch === "validation") renderStep();
      });
    }
  }

  global.SFE_Trace = { open: open, close: close, wire: wire };
})(window);
