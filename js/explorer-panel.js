/**
 * Explorer Mode — Actions / Nghiệp vụ trên cùng form state với Guided.
 */
(function () {
  "use strict";

  var actions = window.SFE_ACTIONS;
  var biz = window.SFE_BUSINESS;
  var V = window.SFE_VALIDATE;
  var lesson = window.SFE_LESSON;
  var catalog = window.SFE_DEMO;

  var root = document.getElementById("explorerSide");
  if (!root || !actions) return;

  var tab = "actions";
  var activeId = "save-draft";
  var bizId = (biz && biz.phases && biz.phases[0] && biz.phases[0].id) || "B";

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render() {
    var form = lesson.getForm();
    var http = V ? V.buildPostPreview(form) : "";
    var draft = V ? V.servletValidate(form, catalog, false) : { ok: true, errors: {} };
    var actionMap = actions.actions || {};
    var order = (actions.page && actions.page.actionOrder) || Object.keys(actionMap);
    var act = actionMap[activeId] || {};

    var actionList = order
      .map(function (id) {
        var a = actionMap[id];
        if (!a) return "";
        return (
          '<button type="button" class="wiz-step' +
          (id === activeId ? " is-current" : "") +
          '" data-act="' +
          id +
          '">' +
          escapeHtml(a.element || id) +
          "</button>"
        );
      })
      .join("");

    var phases = (biz && biz.phases) || [];
    var phaseList = phases
      .map(function (p) {
        return (
          '<button type="button" class="wiz-step' +
          (p.id === bizId ? " is-current" : "") +
          '" data-phase="' +
          p.id +
          '">' +
          escapeHtml(p.title) +
          "</button>"
        );
      })
      .join("");

    var body = "";
    if (tab === "actions") {
      body =
        "<h3>" +
        escapeHtml(act.element || activeId) +
        "</h3>" +
        "<p>" +
        escapeHtml((act.business && act.business.summary) || act.note || "") +
        "</p>" +
        '<dl class="wiz-dl">' +
        "<dt>Method</dt><dd>" +
        escapeHtml(act.method || "Không HTTP") +
        "</dd>" +
        "<dt>URL</dt><dd><code>" +
        escapeHtml(act.formAction || act.reloadUrl || "—") +
        "</code></dd>" +
        "<dt>Servlet</dt><dd>" +
        escapeHtml(act.processMethod || act.entryMethod || "—") +
        "</dd>" +
        "<dt>Tồn kho</dt><dd>" +
        escapeHtml((act.business && act.business.impactStock) || "—") +
        "</dd></dl>";
      if (activeId === "save-draft") {
        body +=
          '<p class="wiz-muted">HTTP Preview theo form hiện tại</p><pre class="wiz-code wiz-http">' +
          escapeHtml(http) +
          "</pre><p>Máy chủ kiểm tra phiếu (hàm validateReceipt, chế độ lưu nháp): " +
          (draft.ok
            ? "Đạt. Có thể gọi hàm ghi phiếu bản nháp createDraft."
            : "Chưa đạt. " + escapeHtml(V.firstError(draft.errors))) +
          "</p>";
      }
      if (act.traceReady) {
        body +=
          '<p><button type="button" class="sfe-btn primary" id="exTrace">Mở Trace Lưu nháp</button></p>';
      }
    } else if (tab === "biz") {
      var phase = phases.filter(function (p) {
        return p.id === bizId;
      })[0] || phases[0] || {};
      body =
        "<h3>" +
        escapeHtml(phase.title || "") +
        "</h3><ul class=\"wiz-checks\">" +
        (phase.points || [])
          .map(function (pt) {
            return "<li>" + escapeHtml(pt) + "</li>";
          })
          .join("") +
        "</ul>" +
        (biz && biz.oneLiner ? "<p class=\"wiz-prose\">" + escapeHtml(biz.oneLiner) + "</p>" : "");
    }

    if (tab === "backend") {
      body =
        "<h3>Backend Java</h3>" +
        '<p class="wiz-prose">Sequence diagram dưới form animate Browser → Servlet → DAO → MySQL trên một khung. Không chạy Tomcat — mô phỏng source ' +
        '<a class="sfe-doc-link" target="_blank" rel="noopener" href="' +
        (lesson.GH || "") +
        'src/java/controller/GoodsReceiptServlet.java">GoodsReceiptServlet.java</a>.</p>' +
        '<p><button type="button" class="sfe-btn primary" id="exJumpBe">Nhảy tới sequence diagram</button></p>';
    }

    root.innerHTML =
      '<div class="wiz-panel"><div class="wiz-nav" style="margin-bottom:8px">' +
      '<button type="button" class="sfe-btn' +
      (tab === "actions" ? " primary" : "") +
      '" data-tab="actions">Actions</button>' +
      '<button type="button" class="sfe-btn' +
      (tab === "biz" ? " primary" : "") +
      '" data-tab="biz">Nghiệp vụ</button>' +
      '<button type="button" class="sfe-btn' +
      (tab === "backend" ? " primary" : "") +
      '" data-tab="backend">Backend Java</button></div>' +
      (tab === "actions" ? '<div class="wiz-stepper">' + actionList + "</div>" : "") +
      (tab === "biz" ? '<div class="wiz-stepper">' + phaseList + "</div>" : "") +
      body +
      "</div>";

    root.querySelectorAll("[data-tab]").forEach(function (b) {
      b.addEventListener("click", function () {
        tab = b.getAttribute("data-tab");
        render();
      });
    });
    root.querySelectorAll("[data-act]").forEach(function (b) {
      b.addEventListener("click", function () {
        activeId = b.getAttribute("data-act");
        render();
      });
    });
    root.querySelectorAll("[data-phase]").forEach(function (b) {
      b.addEventListener("click", function () {
        bizId = b.getAttribute("data-phase");
        render();
      });
    });
    var tr = document.getElementById("exTrace");
    if (tr)
      tr.addEventListener("click", function () {
        lesson.setMode("guided");
        if (window.SFE_GUIDED) {
          window.SFE_GUIDED.persist();
          var tour = (window.SFE_FIELD_GUIDE && window.SFE_FIELD_GUIDE.tourOrder) || [];
          lesson.setTourIndex(Math.max(0, tour.indexOf("saveDraft")));
          document.getElementById("saveDraftBtn") &&
            document.getElementById("saveDraftBtn").click();
        }
      });
    var jump = document.getElementById("exJumpBe");
    if (jump)
      jump.addEventListener("click", function () {
        var el = document.getElementById("wizBackend");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
  }

  window.SFE_EXPLORER = {
    render: render,
    sync: render
  };
})();
