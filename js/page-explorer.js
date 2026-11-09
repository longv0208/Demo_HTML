(function () {
  "use strict";

  var data = window.SFE_ACTIONS;
  if (!data) {
    console.error("SFE_ACTIONS missing");
    return;
  }

  var biz = window.SFE_BUSINESS || null;

  var els = {
    list: document.getElementById("sfeActionList"),
    inspector: document.getElementById("sfeInspector"),
    bizPanel: document.getElementById("sfeBizPanel"),
    leftActions: document.getElementById("sfeLeftActions"),
    leftBiz: document.getElementById("sfeLeftBiz"),
    bizTopicList: document.getElementById("sfeBizTopicList"),
    tabActions: document.getElementById("sfeTabActions"),
    tabBiz: document.getElementById("sfeTabBiz"),
    rightHead: document.getElementById("sfeRightHead"),
    traceBtn: document.getElementById("sfeTraceBtn"),
    pageInfo: document.getElementById("sfePageInfo"),
    form: document.getElementById("grForm"),
    rightPanel: document.querySelector(".sfe-right"),
    inspectorToggle: document.getElementById("sfeInspectorToggle")
  };

  var activeId = null;
  var actionOrder = data.page.actionOrder || [
    "po-change",
    "add-item",
    "cancel-link",
    "save-draft"
  ];

  var PO_SYNC_FIELDS = ["receiptDate", "invoiceNumber", "note"];
  var HTTP_REFRESH_ACTIONS = { "po-change": true, "save-draft": true };
  var mqNarrow = window.matchMedia("(max-width: 1100px)");

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function codeText(s) {
    return "<code>" + escapeHtml(s || "—") + "</code>";
  }

  function ulList(items, className) {
    if (!items || !items.length) return "";
    className = className || "sfe-biz-list";
    return (
      '<ul class="' +
      className +
      '">' +
      items
        .map(function (item) {
          return "<li>" + escapeHtml(item) + "</li>";
        })
        .join("") +
      "</ul>"
    );
  }

  function dlSection(title, rowsHtml) {
    if (!rowsHtml) return "";
    return (
      '<div class="sfe-section"><h4>' +
      escapeHtml(title) +
      '</h4><dl class="sfe-kv">' +
      rowsHtml +
      "</dl></div>"
    );
  }

  function methodTag(action) {
    if (action.method === "POST") return '<span class="sfe-tag post">POST</span>';
    if (action.method === "GET") return '<span class="sfe-tag get">GET</span>';
    return '<span class="sfe-tag js">JS only</span>';
  }

  function shortRoute(action) {
    if (action.formAction) return action.method + " " + action.formAction;
    if (action.method === "GET" && action.reloadUrl) {
      return "GET " + action.reloadUrl;
    }
    if (action.method) return action.method;
    if (action.clientBehavior) return "Client-side";
    return "—";
  }

  function fieldValue(id, fallback) {
    var el = document.getElementById(id);
    return el && el.value !== "" ? el.value : fallback;
  }

  function collectFormBody() {
    if (!els.form) return "purchaseOrderId=12&receiptDate=2026-11-09&...";
    var fd = new FormData(els.form);
    fd.set("submitAction", "draft");
    var parts = [];
    fd.forEach(function (v, k) {
      parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(String(v)));
    });
    return parts.join("&");
  }

  var httpDemoLines = {
    "cancel-link": function () {
      return [
        "GET /Pharma_Flow/inventory/receipts HTTP/1.1",
        "Host: localhost:8080",
        "Cookie: JSESSIONID=demo..."
      ].join("\n");
    },
    "po-change": function () {
      var poVal = fieldValue("purchaseOrderId", "12");
      return [
        "GET /Pharma_Flow/inventory/receipts?action=new" +
          "&po=" + encodeURIComponent(poVal) +
          "&receiptDate=" + encodeURIComponent(fieldValue("receiptDate", "2026-11-09")) +
          "&invoiceNumber=" + encodeURIComponent(fieldValue("invoiceNumber", "")) +
          "&note=" + encodeURIComponent(fieldValue("note", "")) +
          " HTTP/1.1",
        "Host: localhost:8080",
        "Cookie: JSESSIONID=demo..."
      ].join("\n");
    },
    "save-draft": function () {
      return [
        "POST /Pharma_Flow/inventory/receipts?action=create HTTP/1.1",
        "Host: localhost:8080",
        "Content-Type: application/x-www-form-urlencoded",
        "Cookie: JSESSIONID=demo...",
        "",
        collectFormBody()
      ].join("\n");
    }
  };

  function buildHttpPreview(action) {
    if (!action.method) {
      return "Không tạo HTTP request.\n" + (action.clientBehavior || "");
    }
    var builder = httpDemoLines[action.id];
    return builder ? builder() : action.method + " " + (action.formAction || "") + " HTTP/1.1";
  }

  function refreshHttpPreview() {
    if (!activeId || !HTTP_REFRESH_ACTIONS[activeId]) return;
    var box = document.getElementById("sfeHttpBox");
    var action = data.actions[activeId];
    if (box && action) box.textContent = buildHttpPreview(action);
  }

  function renderParamSection(action) {
    var isQuery = !action.parameters && action.queryParams;
    var items = action.parameters || action.queryParams;
    if (!items || !items.length) return "";

    var rows = items
      .map(function (p) {
        var inTag = p.in
          ? "<code>" + escapeHtml(p.in) + "</code> · "
          : "";
        var src = p.source
          ? '<br><span class="sfe-muted-inline">' + escapeHtml(p.source) + "</span>"
          : "";
        return (
          "<dt>" +
          escapeHtml(p.name) +
          "</dt><dd>" +
          inTag +
          escapeHtml(p.value) +
          src +
          "</dd>"
        );
      })
      .join("");

    return dlSection(isQuery ? "Query params" : "Parameters", rows);
  }

  function renderRefBlocks(items, opts) {
    opts = opts || {};
    if (!items || !items.length) return opts.emptyHtml || "";

    var extraClass = opts.extraClass || "";
    var valueKey = opts.valueKey || "note";

    return items
      .map(function (item) {
        var lines = item.lines ? " :" + escapeHtml(item.lines) : "";
        var label = item.file || item.dao;
        var detail = item.sql || item.when || item[valueKey] || "";
        return (
          '<div class="sfe-ref' +
          (extraClass ? " " + extraClass : "") +
          '"><div class="f">' +
          escapeHtml(label) +
          lines +
          '</div><div class="n">' +
          escapeHtml(detail) +
          "</div></div>"
        );
      })
      .join("");
  }

  function renderBranches(branches) {
    if (!branches) return "";
    return (
      '<div class="sfe-section"><h4>Nhánh xử lý</h4>' +
      Object.keys(branches)
        .map(function (key) {
          var fail = /fail|error/i.test(key);
          return (
            '<div class="sfe-branch' +
            (fail ? " fail" : "") +
            '"><strong>' +
            escapeHtml(key) +
            ":</strong> " +
            escapeHtml(branches[key]) +
            "</div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderBusinessBlock(action) {
    var b = action.business;
    if (!b) return "";
    return (
      '<div class="sfe-section sfe-biz-block">' +
      "<h4>Nghiệp vụ</h4>" +
      '<p class="sfe-biz-phase">' +
      escapeHtml(b.phase || "") +
      "</p>" +
      '<p class="sfe-prose">' +
      escapeHtml(b.summary || "") +
      "</p>" +
      '<p class="sfe-stock"><strong>Tác động kho:</strong> ' +
      escapeHtml(b.impactStock || "—") +
      "</p>" +
      ulList(b.rules) +
      "</div>"
    );
  }

  function renderInspector(action) {
    if (!els.inspector) return;

    if (!action) {
      els.inspector.innerHTML =
        '<p class="sfe-empty">Chọn một thành phần có đánh số trên giao diện (hoặc tab Actions) để xem kỹ thuật + nghiệp vụ.</p>';
      els.traceBtn.disabled = true;
      return;
    }

    var nav =
      action.navigation || action.successNav || action.nextScreen || "—";
    var rationale = action.whyGet || action.whyPost || action.note || "";

    var kv =
      "<dt>HTML</dt><dd>" +
      codeText(action.html) +
      "</dd>" +
      "<dt>Event</dt><dd>" +
      escapeHtml(action.event || "—") +
      "</dd>" +
      "<dt>Form action</dt><dd>" +
      codeText(action.formAction || "(không submit)") +
      "</dd>" +
      "<dt>HTTP method</dt><dd>" +
      escapeHtml(action.method || "—") +
      "</dd>" +
      "<dt>Servlet</dt><dd>" +
      escapeHtml(action.servlet || "—") +
      "</dd>" +
      "<dt>Entry</dt><dd>" +
      codeText(action.entryMethod) +
      "</dd>" +
      "<dt>Xử lý</dt><dd>" +
      codeText(action.processMethod) +
      "</dd>" +
      "<dt>Nhánh</dt><dd>" +
      codeText(action.branch) +
      "</dd>" +
      "<dt>Điều hướng</dt><dd>" +
      escapeHtml(nav) +
      "</dd>";

    els.inspector.innerHTML =
      '<p class="sfe-insp-title">Nút / phần tử: ' +
      escapeHtml(action.element) +
      "</p>" +
      '<p class="sfe-insp-sub">File giao diện: <code class="sfe-code">' +
      escapeHtml(action.page) +
      "</code></p>" +
      renderBusinessBlock(action) +
      '<dl class="sfe-kv">' +
      kv +
      "</dl>" +
      '<div class="sfe-section"><h4>HTTP request (demo)</h4><div class="sfe-http-box" id="sfeHttpBox"></div></div>' +
      renderParamSection(action) +
      '<div class="sfe-section"><h4>Vì sao (kỹ thuật)?</h4><p class="sfe-prose">' +
      escapeHtml(rationale) +
      "</p></div>" +
      '<div class="sfe-section"><h4>Source references</h4>' +
      renderRefBlocks(action.sourceRefs) +
      "</div>" +
      '<div class="sfe-section"><h4>DAO / SQL</h4>' +
      renderRefBlocks(action.daoCalls, {
        extraClass: "sfe-dao",
        valueKey: "when",
        emptyHtml: '<p class="sfe-empty">Không gọi DAO.</p>'
      }) +
      "</div>" +
      renderBranches(action.branches) +
      '<div class="sfe-section"><h4>Màn hình tiếp theo</h4><p class="sfe-prose">' +
      escapeHtml(action.nextScreen || "—") +
      "</p></div>";

    var box = document.getElementById("sfeHttpBox");
    if (box) box.textContent = buildHttpPreview(action);

    els.traceBtn.disabled = !action.traceReady;
    els.traceBtn.title = action.traceReady
      ? "Mở mô phỏng từng bước (sắp có)"
      : "Action này chưa gắn Trace Flow đầy đủ — ưu tiên Lưu nháp trước";
  }

  function renderBizOverview() {
    if (!els.bizPanel || !biz) return;

    var concepts = (biz.concepts || [])
      .map(function (c) {
        return (
          '<div class="sfe-concept"><div class="t">' +
          escapeHtml(c.term) +
          '</div><div class="m">' +
          escapeHtml(c.meaning) +
          "</div></div>"
        );
      })
      .join("");

    var phases = (biz.phases || [])
      .map(function (p) {
        var open = p.id === "D" || p.id === "B" ? " open" : "";
        return (
          '<details class="sfe-phase"' +
          open +
          "><summary>" +
          escapeHtml(p.title) +
          "</summary>" +
          ulList(p.points, "sfe-phase-list") +
          "</details>"
        );
      })
      .join("");

    var statuses = (biz.statusGr || [])
      .map(function (s) {
        return (
          "<tr><td><code>" +
          escapeHtml(s.code) +
          "</code></td><td>" +
          escapeHtml(s.meaning) +
          "</td></tr>"
        );
      })
      .join("");

    var demo = biz.demoStory || {};

    els.bizPanel.innerHTML =
      '<p class="sfe-insp-title">Nghiệp vụ nhập kho</p>' +
      '<p class="sfe-insp-sub">Theo đặc tả · code: <code class="sfe-code">' +
      escapeHtml(biz.codeRoot || "../Pharma_Flow") +
      "</code></p>" +
      '<p class="sfe-prose sfe-oneliner">' +
      escapeHtml(biz.oneLiner || "") +
      "</p>" +
      '<div class="sfe-section"><h4>Mục tiêu</h4>' +
      ulList(biz.goals) +
      "</div>" +
      '<div class="sfe-section"><h4>Khái niệm cốt lõi</h4>' +
      concepts +
      "</div>" +
      '<div class="sfe-section"><h4>Ví dụ [DEMO]</h4>' +
      '<p class="sfe-prose"><strong>' +
      escapeHtml(demo.title || "") +
      "</strong> — " +
      escapeHtml(demo.body || "") +
      '</p><p class="sfe-muted-inline">' +
      escapeHtml(demo.note || "") +
      "</p></div>" +
      '<div class="sfe-section"><h4>Các giai đoạn</h4>' +
      phases +
      "</div>" +
      '<div class="sfe-section"><h4>Quy tắc Lưu nháp (màn này)</h4>' +
      ulList(biz.draftRules) +
      "</div>" +
      '<div class="sfe-section"><h4>Trạng thái GR</h4><table class="sfe-mini-table"><tbody>' +
      statuses +
      "</tbody></table></div>";
  }

  function setPaneVisible(el, visible) {
    if (!el) return;
    el.classList.toggle("is-hidden", !visible);
    if (visible) el.removeAttribute("hidden");
    else el.setAttribute("hidden", "");
  }

  function setLeftMode(mode) {
    var isActions = mode === "actions";
    if (els.tabActions) els.tabActions.classList.toggle("active", isActions);
    if (els.tabBiz) els.tabBiz.classList.toggle("active", !isActions);
    setPaneVisible(els.leftActions, isActions);
    setPaneVisible(els.leftBiz, !isActions);
    setPaneVisible(els.inspector, isActions);
    setPaneVisible(els.bizPanel, !isActions);
    if (els.rightHead) {
      els.rightHead.textContent = isActions
        ? "Action Inspector"
        : "Giải thích nghiệp vụ";
    }
  }

  function openRightOnNarrow() {
    if (els.rightPanel && mqNarrow.matches) {
      els.rightPanel.classList.add("open");
    }
  }

  function selectAction(id, scrollHotspot) {
    activeId = id;
    var action = data.actions[id];

    els.list.querySelectorAll("button").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.actionId === id);
    });
    document.querySelectorAll(".sfe-hotspot").forEach(function (hotspot) {
      hotspot.classList.toggle("active", hotspot.dataset.actionId === id);
    });

    renderInspector(action);

    if (scrollHotspot) {
      var target = document.querySelector(
        '.sfe-hotspot[data-action-id="' + id + '"]'
      );
      if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    openRightOnNarrow();
  }

  function buildActionList() {
    els.list.innerHTML = "";
    actionOrder.forEach(function (id) {
      var action = data.actions[id];
      if (!action) return;

      var btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.actionId = id;
      btn.innerHTML =
        '<span class="sfe-badge">' +
        action.badge +
        "</span>" +
        '<span class="sfe-action-meta">' +
        '<div class="t">' +
        escapeHtml(action.element) +
        "</div>" +
        '<div class="s">' +
        escapeHtml(shortRoute(action)) +
        "</div>" +
        methodTag(action) +
        "</span>";
      btn.addEventListener("click", function () {
        selectAction(id, true);
      });

      var li = document.createElement("li");
      li.appendChild(btn);
      els.list.appendChild(li);
    });
  }

  function addBizTopic(host, id, title, summary, active) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sfe-topic" + (active ? " active" : "");
    btn.dataset.topic = id;
    btn.innerHTML =
      '<span class="sfe-action-meta"><div class="t">' +
      escapeHtml(title) +
      '</div><div class="s">' +
      escapeHtml(summary) +
      "</div></span>";
    btn.addEventListener("click", function () {
      host.querySelectorAll(".sfe-topic").forEach(function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
      setLeftMode("biz");
      if (els.bizPanel) els.bizPanel.scrollTop = 0;
    });
    host.appendChild(btn);
  }

  function buildBizTopicList() {
    var host = els.bizTopicList;
    if (!host || !biz) return;
    host.replaceChildren();
    addBizTopic(host, "all", "Toàn bộ quy trình", "Đọc panel phải", true);
    (biz.topics || []).forEach(function (t) {
      addBizTopic(host, t.id, t.title, t.summary, false);
    });
  }

  function wireHotspots() {
    document.querySelectorAll(".sfe-hotspot").forEach(function (hotspot) {
      // Click badge / empty padding → chọn action. Không chặn input/select/textarea.
      hotspot.addEventListener("click", function (ev) {
        var t = ev.target;
        if (!t) return;
        if (
          t.closest("input, select, textarea, label, option") ||
          t.matches("input, select, textarea, label")
        ) {
          selectAction(hotspot.dataset.actionId, false);
          return;
        }
        // Nút submit: để form submit handler mở Trace — chỉ highlight action
        if (t.closest('button[type="submit"]') || t.matches('button[type="submit"]')) {
          selectAction(hotspot.dataset.actionId, false);
          return;
        }
        // Link Hủy / button thường: chặn điều hướng ngoài, chọn action
        if (t.closest("a") || t.matches("a")) {
          ev.preventDefault();
          selectAction(hotspot.dataset.actionId, false);
          return;
        }
        if (t.closest('button[type="button"]') || t.matches('button[type="button"]')) {
          // add-item: form-demo sẽ xử lý click nút; chỉ sync inspector
          selectAction(hotspot.dataset.actionId, false);
          return;
        }
        // Click vào vùng hotspot (badge)
        if (t.classList.contains("sfe-hotspot-mark") || t === hotspot) {
          ev.preventDefault();
          selectAction(hotspot.dataset.actionId, false);
        }
      });
    });
  }

  function wireFormDemo() {
    if (!els.form) return;

    els.form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      selectAction("save-draft", false);
      setLeftMode("actions");
      if (window.SFE_Trace) SFE_Trace.open();
    });

    PO_SYNC_FIELDS.forEach(function (fieldId) {
      var field = document.getElementById(fieldId);
      if (field) field.addEventListener("input", refreshHttpPreview);
    });
  }

  function wireOnboarding() {
    var tip = document.getElementById("sfeOnboard");
    if (!tip) return;
    var key = "sfe_onboard_v1";
    var dismissed = false;
    try {
      dismissed = localStorage.getItem(key) === "1";
    } catch (e) {}
    if (!dismissed) tip.hidden = false;

    var skip = document.getElementById("sfeOnboardSkip");
    var again = document.getElementById("sfeShowGuide");
    function hide() {
      tip.hidden = true;
      try {
        localStorage.setItem(key, "1");
      } catch (e2) {}
    }
    if (skip) skip.addEventListener("click", hide);
    if (again) {
      again.addEventListener("click", function () {
        tip.hidden = false;
      });
    }
  }

  function wireChrome() {
    if (els.inspectorToggle && els.rightPanel) {
      els.inspectorToggle.addEventListener("click", function () {
        els.rightPanel.classList.toggle("open");
      });
    }

    if (els.tabActions) {
      els.tabActions.addEventListener("click", function () {
        setLeftMode("actions");
      });
    }
    if (els.tabBiz) {
      els.tabBiz.addEventListener("click", function () {
        setLeftMode("biz");
        openRightOnNarrow();
      });
    }
  }

  // Public API cho form-demo / trace-flow
  window.SFE = {
    selectAction: selectAction,
    refreshHttpPreview: refreshHttpPreview,
    setLeftMode: setLeftMode
  };

  buildActionList();
  buildBizTopicList();
  renderBizOverview();
  if (els.pageInfo) {
    els.pageInfo.innerHTML =
      "<strong>" +
      escapeHtml(data.page.title) +
      "</strong> · <code>" +
      escapeHtml(data.page.jsp) +
      "</code>";
  }
  wireHotspots();
  wireFormDemo();
  wireChrome();
  wireOnboarding();
  setLeftMode("actions");

  if (window.SFE_FormDemo) SFE_FormDemo.init(window.SFE_DEMO);
  if (window.SFE_Trace) SFE_Trace.wire();

  // Mặc định chọn Lưu nháp
  selectAction("save-draft", false);
})();
