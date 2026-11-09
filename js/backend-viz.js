/**
 * Sequence diagram animation — Browser ↔ Servlet ↔ DAO ↔ MySQL.
 * Một khung, mũi tên chạy lần lượt. Không lật từng màn method.
 */
(function (global) {
  "use strict";

  var ACTORS = [
    { id: "browser", label: "Browser", sub: "JSP / JS" },
    { id: "servlet", label: "GoodsReceiptServlet", sub: "/inventory/receipts" },
    { id: "dao", label: "DAO", sub: "chưa gọi" },
    { id: "mysql", label: "MySQL", sub: "JDBC" }
  ];

  function actorsOf(kind) {
    var browser = { id: "browser", label: "Browser", sub: "JSP / JS" };
    var mysql = { id: "mysql", label: "MySQL", sub: "JDBC" };
    if (kind === "location") {
      return [
        browser,
        { id: "servlet", label: "LocationServlet", sub: "/inventory/locations" },
        { id: "dao", label: "LocationDAO", sub: "findRacks / findBins" },
        mysql
      ];
    }
    if (kind === "po") {
      return [
        browser,
        { id: "servlet", label: "GoodsReceiptServlet", sub: "/inventory/receipts" },
        { id: "dao", label: "PurchaseOrderDAO", sub: "findReceivable" },
        mysql
      ];
    }
    if (kind === "save") {
      return [
        browser,
        { id: "servlet", label: "GoodsReceiptServlet", sub: "/inventory/receipts" },
        { id: "dao", label: "GoodsReceiptDAO", sub: "createDraft" },
        mysql
      ];
    }
    if (kind === "list") {
      return [
        browser,
        { id: "servlet", label: "GoodsReceiptServlet", sub: "/inventory/receipts" },
        { id: "dao", label: "GoodsReceiptDAO", sub: "findAll" },
        mysql
      ];
    }
    return [
      browser,
      { id: "servlet", label: "GoodsReceiptServlet", sub: "chưa gọi doGet/doPost" },
      { id: "dao", label: "DAO", sub: "chưa gọi" },
      mysql
    ];
  }

  var GH = {
    servlet: "src/java/controller/GoodsReceiptServlet.java",
    location: "src/java/controller/LocationServlet.java",
    grDao: "src/java/dao/GoodsReceiptDAO.java",
    poDao: "src/java/dao/PurchaseOrderDAO.java",
    locDao: "src/java/dao/LocationDAO.java"
  };

  var STEP_MS = 700;
  var state = {
    key: "",
    index: -1,
    timer: null,
    playing: false,
    walk: null,
    root: null
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ghLink(file, line) {
    var base = (global.SFE_LESSON && global.SFE_LESSON.GH) || "https://github.com/longv0208/Pharma_Flow/blob/main/";
    return base + file + (line ? "#L" + line : "");
  }

  function poOf(form, catalog) {
    var V = global.SFE_VALIDATE;
    if (V && V.poOf) return V.poOf(form, catalog);
    var id = String((form && form.purchaseOrderId) || "");
    return (catalog.purchaseOrders || {})[id] || (catalog.closedOrders || {})[id] || null;
  }

  function item0(form) {
    return (form.items && form.items[0]) || {};
  }

  function sqlQuote(v) {
    if (v == null || v === "") return "NULL";
    if (typeof v === "number") return String(v);
    return "'" + String(v).replace(/'/g, "''") + "'";
  }

  function msg(from, to, label, extra) {
    var m = {
      from: from,
      to: to,
      label: label,
      kind: extra && extra.kind ? extra.kind : from === to ? "self" : "call",
      status: (extra && extra.status) || "ok",
      note: "",
      sql: "",
      file: "",
      line: 0
    };
    if (extra) {
      Object.keys(extra).forEach(function (k) {
        m[k] = extra[k];
      });
    }
    if (m.status === "error") m.kind = "error";
    return m;
  }

  function ret(from, to, label, extra) {
    return msg(from, to, label, Object.assign({ kind: "return" }, extra || {}));
  }

  function liveReceipt(form, catalog) {
    var po = poOf(form, catalog);
    return {
      purchaseOrderId: form.purchaseOrderId || null,
      supplierId: po ? po.supplierId : null,
      receiptDate: form.receiptDate,
      invoiceNumber: form.invoiceNumber,
      note: form.note
    };
  }

  function insertReceiptSql(form, catalog) {
    var rec = liveReceipt(form, catalog);
    return (
      "INSERT INTO goods_receipts (supplier_id, purchase_order_id, received_by, receipt_date, invoice_number, note, status)\nVALUES (" +
      [rec.supplierId, rec.purchaseOrderId, "1 /* userId [DEMO] */", sqlQuote(rec.receiptDate), sqlQuote(rec.invoiceNumber), sqlQuote(rec.note), "'BAN_NHAP'"].join(", ") +
      ")"
    );
  }

  function insertItemSql(form, catalog, receiptId) {
    var po = poOf(form, catalog);
    var rows = (form.items || []).filter(function (it) {
      return Number(it.poItemId) > 0;
    });
    if (!rows.length) return "-- không có dòng";
    return rows
      .map(function (it) {
        var poi = po && (po.items || []).filter(function (x) {
          return String(x.poItemId) === String(it.poItemId);
        })[0];
        return (
          "INSERT INTO goods_receipt_items (..., batch_id, ...) VALUES (" +
          (receiptId || "?") +
          ", " +
          it.poItemId +
          ", " +
          (poi ? poi.productId : "?") +
          ", NULL, " +
          (it.binId || "NULL") +
          ", " +
          sqlQuote(it.batchNumber) +
          ", " +
          sqlQuote(it.expiryDate) +
          ", " +
          it.quantity +
          ", " +
          it.costPrice +
          ", " +
          sqlQuote(it.inspectionResult || "CHO_KIEM_TRA") +
          ")"
        );
      })
      .join("\n");
  }

  function validateOk(form, catalog) {
    return global.SFE_VALIDATE.servletValidate(form, catalog, false);
  }

  function walkIdle(form) {
    var item = item0(form);
    var field = ((global.SFE_LESSON.getAction() || {}).fieldId) || "field";
    var live = form[field];
    if (live == null) live = item[field];
    if (live == null && field === "saveDraft") live = "chưa POST";
    return {
      title: "Chưa gửi đến server",
      summary: "Chỉ Browser. GoodsReceiptServlet / LocationServlet chưa nhận HTTP.",
      ran: false,
      actors: actorsOf("idle"),
      messages: [
        msg("browser", "browser", field + " = " + String(live == null ? "" : live), {
          note: "GoodsReceiptServlet.doGet / doPost chưa chạy. LocationServlet cũng chưa.",
          kind: "self"
        })
      ]
    };
  }

  function walkPo(form, catalog) {
    var po = poOf(form, catalog);
    return {
      title: "GET reload form theo PO",
      summary: "Browser → GoodsReceiptServlet.handleNewForm → PurchaseOrderDAO → MySQL SELECT → forward JSP.",
      ran: true,
      actors: actorsOf("po"),
      messages: [
        msg("browser", "servlet", "GET GoodsReceiptServlet?action=new&po=" + (form.purchaseOrderId || ""), {
          note: "GoodsReceiptServlet.doGet → handleNewForm. @WebServlet(\"/inventory/receipts\").",
          file: GH.servlet,
          line: 118
        }),
        msg("servlet", "dao", "PurchaseOrderDAO.findReceivable()", {
          note: "Chỉ DA_DAT_HANG / DA_NHAN_MOT_PHAN.",
          file: GH.poDao,
          line: 151
        }),
        msg("dao", "mysql", "SELECT purchase_orders WHERE status IN (...)", {
          sql: "SELECT po.*, s.supplier_name ...\nFROM purchase_orders po\nWHERE po.status IN ('DA_DAT_HANG','DA_NHAN_MOT_PHAN')"
        }),
        ret("mysql", "dao", "ResultSet PO mở", { note: "Chỉ đọc." }),
        msg("servlet", "dao", "PurchaseOrderDAO.findById + findItems", {
          file: GH.servlet,
          line: 618
        }),
        msg("dao", "mysql", "SELECT … WHERE purchase_order_id = " + (form.purchaseOrderId || "?"), {
          sql: "SELECT i.*, p.product_name, p.sku\nFROM purchase_order_items i JOIN products p …\nWHERE i.purchase_order_id = " + (form.purchaseOrderId || "?")
        }),
        ret("mysql", "dao", po ? po.supplierName + " · " + (po.items || []).length + " dòng" : "null"),
        ret("servlet", "browser", "GoodsReceiptServlet.forward FORM_JSP", {
          note: "HTML form với poItems mới. Cùng URL GET, không 302.",
          file: GH.servlet,
          line: 136
        })
      ]
    };
  }

  function walkZone(form, catalog, kind) {
    var it = item0(form);
    var isZone = kind === "zone";
    var list = isZone
      ? (((catalog.locations || {}).racksByZone || {})[it.zoneId] || [])
      : (((catalog.locations || {}).binsByRack || {})[it.rackId] || []);
    return {
      title: isZone ? "GET JSON kệ theo khu" : "GET JSON ngăn theo kệ",
      summary: "Browser fetch → LocationServlet (không phải GoodsReceiptServlet) → LocationDAO.",
      ran: true,
      actors: actorsOf("location"),
      messages: [
        msg("browser", "servlet", isZone
          ? "GET LocationServlet?action=api-racks&zoneId=" + (it.zoneId || "")
          : "GET LocationServlet?action=api-bins&rackId=" + (it.rackId || ""), {
          note: isZone
            ? "LocationServlet.doGet → handleApiRacks. @WebServlet(\"/inventory/locations\")."
            : "LocationServlet.doGet → handleApiBins. @WebServlet(\"/inventory/locations\").",
          file: GH.location,
          line: isZone ? 262 : 291
        }),
        msg("servlet", "dao", isZone ? 'LocationDAO.findRacks(zoneId, null, "HOAT_DONG")' : 'LocationDAO.findBins(rackId, …, "HOAT_DONG")', {
          file: GH.locDao,
          line: isZone ? 192 : 328
        }),
        msg("dao", "mysql", isZone ? "SELECT storage_racks WHERE zone_id=? AND status='HOAT_DONG'" : "SELECT storage_bins WHERE rack_id=? AND status='HOAT_DONG'"),
        ret("mysql", "dao", list.length + " hàng HOAT_DONG"),
        ret("servlet", "browser", "JSON " + JSON.stringify(list.map(function (x) {
          return isZone ? { rackId: x.id, rackCode: x.code } : { binId: x.id, binCode: x.code };
        })), {
          note: "JS đổ <select>. Không forward JSP."
        })
      ]
    };
  }

  function walkCancel(sim) {
    var n = ((sim && sim.goodsReceipts) || []).length;
    return {
      title: "Hủy form — GET danh sách",
      summary: "Không POST. GoodsReceiptServlet.handleList → GoodsReceiptDAO.findAll.",
      ran: true,
      actors: actorsOf("list"),
      messages: [
        msg("browser", "servlet", "GET GoodsReceiptServlet /inventory/receipts", {
          note: "Link Hủy. GoodsReceiptServlet.doGet mặc định → handleList.",
          file: GH.servlet,
          line: 108
        }),
        msg("servlet", "dao", "GoodsReceiptDAO.findAll(keyword, status)", { file: GH.grDao, line: 138 }),
        msg("dao", "mysql", "SELECT goods_receipts … ORDER BY id DESC"),
        ret("mysql", "dao", n + " phiếu (SELECT)"),
        ret("servlet", "browser", "forward list.jsp", { note: "Không ?ok=created." })
      ]
    };
  }

  function walkSave(form, catalog, sim, action) {
    var branch = (action && action.branch) || "success";
    var draft = validateOk(form, catalog);
    if (branch === "success" && !draft.ok) branch = "validation";
    var fail = branch === "validation";
    var dbErr = branch === "dbError";
    var recId = !fail && !dbErr && sim.goodsReceipts && sim.goodsReceipts[0] ? sim.goodsReceipts[0].id : "?";
    var firstErr = global.SFE_VALIDATE.firstError(draft.errors);

    var messages = [
      msg("browser", "servlet", "POST GoodsReceiptServlet?action=create", {
        note: "GoodsReceiptServlet.doPost → handleCreate. Body không có [].",
        file: GH.servlet,
        line: 76
      }),
      msg("servlet", "servlet", "GoodsReceiptServlet.readItemsForm()", {
        note: "readReceiptForm + readItemsForm. Dòng poItemId≤0 bị bỏ.",
        file: GH.servlet,
        line: 376
      }),
      msg("servlet", "servlet", "GoodsReceiptServlet.validateReceipt(false)", {
        status: fail ? "error" : "ok",
        note: fail
          ? "errors: " + firstErr
          : "errors rỗng. CHO_KIEM_TRA được phép. CHAP_NHAN vẫn cần Bin.",
        file: GH.servlet,
        line: 429
      })
    ];

    if (fail) {
      messages.push(
        ret("servlet", "browser", "GoodsReceiptServlet.forward FORM_JSP", {
          note: "repopulateForm. GoodsReceiptDAO.createDraft không được gọi.",
          file: GH.servlet,
          line: 633
        }),
        msg("servlet", "dao", "GoodsReceiptDAO.createDraft() không gọi", {
          kind: "note",
          status: "skip",
          note: "return trước new GoodsReceiptDAO()."
        })
      );
      return {
        title: "POST Lưu nháp — dừng ở validateReceipt",
        summary: "GoodsReceiptServlet.validateReceipt lỗi → forward form. GoodsReceiptDAO không chạy.",
        ran: true,
        actors: actorsOf("save"),
        messages: messages
      };
    }

    messages.push(
      msg("servlet", "dao", "GoodsReceiptDAO.createDraft(receipt, items)", {
        note: 'GoodsReceiptServlet: receipt.setStatus("BAN_NHAP") rồi new GoodsReceiptDAO().',
        file: GH.servlet,
        line: 206
      }),
      msg("dao", "mysql", "INSERT goods_receipts … 'BAN_NHAP'", {
        status: dbErr ? "error" : "ok",
        sql: insertReceiptSql(form, catalog),
        file: GH.grDao,
        line: 250
      })
    );

    if (dbErr) {
      messages.push(
        ret("mysql", "dao", "SQLException", { kind: "error", status: "error" }),
        msg("dao", "mysql", "ROLLBACK", { kind: "error", status: "error", note: "createDraft failed — rolled back" }),
        ret("dao", "servlet", "return -1", { kind: "error", status: "error" }),
        ret("servlet", "browser", "forward form · Could not save", { status: "error" })
      );
      return {
        title: "POST Lưu nháp — DAO lỗi [DEMO SCENARIO]",
        summary: "GoodsReceiptDAO.createDraft SQLException → rollback. Không COMMIT.",
        ran: true,
        actors: actorsOf("save"),
        messages: messages
      };
    }

    messages.push(
      ret("mysql", "dao", "generatedKeys id=" + recId),
      msg("dao", "mysql", "INSERT goods_receipt_items · batch_id=NULL", {
        sql: insertItemSql(form, catalog, recId),
        file: GH.grDao,
        line: 296,
        note: "Tồn kho chưa có lô."
      }),
      ret("mysql", "dao", "OK · " + ((form.items || []).length) + " dòng"),
      msg("dao", "mysql", "COMMIT", {
        note: "inventory_* / PO received / NHAP_KHO không có trong createDraft.",
        file: GH.grDao,
        line: 319
      }),
      ret("dao", "servlet", "receiptId=" + recId),
      ret("servlet", "browser", "GoodsReceiptServlet.sendRedirect ?ok=created", {
        file: GH.servlet,
        line: 212
      }),
      msg("browser", "servlet", "GET GoodsReceiptServlet?ok=created", {
        note: "Request mới sau redirect. GoodsReceiptServlet.doGet → handleList.",
        file: GH.servlet,
        line: 108
      }),
      msg("servlet", "dao", "GoodsReceiptDAO.findAll()"),
      msg("dao", "mysql", "SELECT goods_receipts …"),
      ret("mysql", "dao", "list gồm phiếu BAN_NHAP"),
      ret("servlet", "browser", "forward list.jsp · «chưa có gì vào kho.»")
    );

    return {
      title: "POST Lưu nháp — COMMIT BAN_NHAP",
      summary: "GoodsReceiptServlet.handleCreate → validateReceipt → GoodsReceiptDAO.createDraft → COMMIT. Tồn kho không đổi.",
      ran: true,
      actors: actorsOf("save"),
      messages: messages
    };
  }

  function buildWalk(action, form, catalog, sim) {
    var type = (action && action.type) || "idle";
    if (type === "po-change") return walkPo(form, catalog);
    if (type === "zone") return walkZone(form, catalog, "zone");
    if (type === "rack") return walkZone(form, catalog, "rack");
    if (type === "cancel") return walkCancel(sim);
    if (type === "save-draft") return walkSave(form, catalog, sim, action);
    return walkIdle(form);
  }

  function actionKey(action, form) {
    var item = item0(form);
    return [
      (action && action.type) || "idle",
      (action && action.branch) || "",
      (action && action.seq) || "",
      form.purchaseOrderId,
      item.batchNumber,
      item.binId,
      item.inspectionResult,
      (form.items || []).length
    ].join("|");
  }

  function actorIndex(id) {
    var i = 0;
    for (; i < ACTORS.length; i++) if (ACTORS[i].id === id) return i;
    return 0;
  }

  function stopTimer() {
    if (state.timer) {
      clearTimeout(state.timer);
      clearInterval(state.timer);
      state.timer = null;
    }
    state.playing = false;
  }

  function svgDiagram(walk) {
    var actors = walk.actors || ACTORS;
    var n = actors.length;
    var W = 980;
    var head = 62;
    var rowH = 46;
    var padX = 88;
    var msgs = walk.messages || [];
    var H = head + Math.max(msgs.length, 1) * rowH + 36;
    var xs = actors.map(function (_, i) {
      return padX + (i * (W - padX * 2)) / (n - 1);
    });

    var heads = actors.map(function (a, i) {
      return (
        '<g class="seq-actor" data-actor="' +
        a.id +
        '">' +
        '<rect class="seq-box" x="' +
        (xs[i] - 70) +
        '" y="6" width="140" height="46" rx="8"/>' +
        '<text class="seq-box-t" x="' +
        xs[i] +
        '" y="24" text-anchor="middle">' +
        esc(a.label) +
        "</text>" +
        '<text class="seq-box-s" x="' +
        xs[i] +
        '" y="42" text-anchor="middle">' +
        esc(a.sub) +
        "</text>" +
        '<line class="seq-life" x1="' +
        xs[i] +
        '" y1="52" x2="' +
        xs[i] +
        '" y2="' +
        (H - 8) +
        '"/></g>'
      );
    }).join("");

    var arrows = msgs
      .map(function (m, i) {
        var y = head + 18 + i * rowH;
        var x1 = xs[actorIndex(m.from)];
        var x2 = xs[actorIndex(m.to)];
        var cls = "seq-msg is-future kind-" + m.kind + " st-" + m.status;
        var labelY = y - 8;
        var label = esc(m.label.length > 64 ? m.label.slice(0, 62) + "…" : m.label);
        if (m.from === m.to) {
          var x3 = x1 + 56;
          var d = "M " + x1 + " " + (y - 6) + " C " + x3 + " " + (y - 6) + ", " + x3 + " " + (y + 10) + ", " + x1 + " " + (y + 10);
          return (
            '<g class="' +
            cls +
            '" data-seq="' +
            i +
            '">' +
            '<path class="seq-line" d="' +
            d +
            '" marker-end="url(#seqArr)"/>' +
            '<text class="seq-lab" x="' +
            (x1 + 10) +
            '" y="' +
            (y - 10) +
            '">' +
            label +
            "</text></g>"
          );
        }
        var dir = x2 > x1 ? 1 : -1;
        var xEnd = x2 - dir * 8;
        return (
          '<g class="' +
          cls +
          '" data-seq="' +
          i +
          '">' +
          '<line class="seq-line" x1="' +
          x1 +
          '" y1="' +
          y +
          '" x2="' +
          xEnd +
          '" y2="' +
          y +
          '" marker-end="url(#seqArr)"/>' +
          '<text class="seq-lab" x="' +
          (x1 + x2) / 2 +
          '" y="' +
          labelY +
          '" text-anchor="middle">' +
          label +
          "</text></g>"
        );
      })
      .join("");

    var marker = '<marker id="seqArr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#93c5fd"/></marker>';

    return (
      '<div class="seq-scroll"><svg class="seq-svg" viewBox="0 0 ' +
      W +
      " " +
      H +
      '" role="img" aria-label="Sequence diagram">' +
      "<defs>" +
      marker +
      "</defs>" +
      heads +
      arrows +
      "</svg></div>"
    );
  }

  function actorLabel(walk, id) {
    var list = walk.actors || ACTORS;
    var i = 0;
    for (; i < list.length; i++) if (list[i].id === id) return list[i].label;
    return id;
  }

  function captionHtml(walk, index) {
    var m = walk.messages[index];
    if (!m) {
      return '<p class="be-cap-empty">Nhấn Phát để chạy luồng trên một diagram.</p>';
    }
    var file = m.file
      ? ' <a class="sfe-doc-link" target="_blank" rel="noopener" href="' +
        esc(ghLink(m.file, m.line)) +
        '">' +
        esc(m.file.replace(/^.*\//, "")) +
        (m.line ? " :" + m.line : "") +
        "</a>"
      : "";
    return (
      '<p class="be-cap-now">' +
      '<span class="seq-chip">' +
      (index + 1) +
      "/" +
      walk.messages.length +
      "</span> " +
      esc(actorLabel(walk, m.from)) +
      " → " +
      esc(actorLabel(walk, m.to)) +
      " · " +
      esc(m.label) +
      file +
      "</p>" +
      (m.note ? "<p class=\"be-cap-note\">" + esc(m.note) + "</p>" : "") +
      (m.sql ? '<pre class="wiz-code be-sql">' + esc(m.sql) + "</pre>" : "")
    );
  }

  function applyFrame() {
    var root = state.root;
    if (!root || !state.walk) return;
    var i = state.index;
    var msgs = state.walk.messages;
    root.querySelectorAll("[data-seq]").forEach(function (g) {
      var idx = Number(g.getAttribute("data-seq"));
      g.classList.remove("is-future", "is-on", "is-past");
      if (i < 0) g.classList.add("is-future");
      else if (idx < i) g.classList.add("is-past");
      else if (idx === i) g.classList.add("is-on");
      else g.classList.add("is-future");
    });
    var cur = msgs[i];
    root.querySelectorAll("[data-actor]").forEach(function (g) {
      var id = g.getAttribute("data-actor");
      g.classList.toggle("is-live", !!(cur && (cur.from === id || cur.to === id)));
    });
    var cap = root.querySelector("[data-be-cap]");
    if (cap) cap.innerHTML = captionHtml(state.walk, Math.max(0, i));
    var playBtn = root.querySelector("[data-be-play]");
    if (playBtn) playBtn.textContent = state.playing ? "Tạm dừng" : i >= msgs.length - 1 ? "Phát lại" : "Phát";
  }

  function showAll() {
    state.index = (state.walk.messages.length || 1) - 1;
    state.playing = false;
    applyFrame();
    if (state.root) {
      state.root.querySelectorAll("[data-seq]").forEach(function (g) {
        g.classList.remove("is-future");
        g.classList.add("is-past");
      });
      var last = state.root.querySelector('[data-seq="' + state.index + '"]');
      if (last) {
        last.classList.remove("is-past");
        last.classList.add("is-on");
      }
    }
  }

  function play() {
    if (!state.walk || !state.walk.messages.length) return;
    if (state.playing) {
      stopTimer();
      applyFrame();
      return;
    }
    stopTimer();
    if (state.index >= state.walk.messages.length - 1 || state.index < 0) {
      state.index = -1;
    }
    state.playing = true;
    function tick() {
      if (!state.playing) return;
      state.index += 1;
      if (state.index >= state.walk.messages.length) {
        stopTimer();
        state.index = state.walk.messages.length - 1;
        applyFrame();
        return;
      }
      applyFrame();
      state.timer = setTimeout(tick, STEP_MS);
    }
    tick();
  }

  function htmlShell(walk) {
    return (
      '<div class="be-head">' +
      "<div><p class=\"be-kicker\">Sequence diagram · mô phỏng source Java</p>" +
      '<h2 class="be-title">' +
      esc(walk.title) +
      "</h2><p class=\"be-sum\">" +
      esc(walk.summary) +
      "</p></div>" +
      '<div class="be-nav">' +
      '<button type="button" class="sfe-btn primary" data-be-play>Phát</button>' +
      '<button type="button" class="sfe-btn" data-be-all">Hiện cả luồng</button>' +
      "</div></div>" +
      '<p class="seq-legend">Mũi tên liền = gọi / HTTP · nét đứt = return · đỏ = lỗi · cột không sáng = chưa được gọi. Toàn bộ nằm trên một diagram.</p>' +
      svgDiagram(walk) +
      '<div class="be-caption" data-be-cap></div>' +
      '<p class="be-note">Không phải Tomcat thật. Method/SQL khớp Pharma_Flow.</p>'
    );
  }

  function bind(root) {
    var playBtn = root.querySelector("[data-be-play]");
    var allBtn = root.querySelector("[data-be-all]");
    if (playBtn) playBtn.addEventListener("click", play);
    if (allBtn) allBtn.addEventListener("click", function () {
      stopTimer();
      showAll();
    });
    root.querySelectorAll("[data-seq]").forEach(function (g) {
      g.addEventListener("click", function () {
        stopTimer();
        state.index = Number(g.getAttribute("data-seq"));
        applyFrame();
      });
    });
  }

  function mount(root, opts) {
    if (!root) return null;
    var action = opts.action || { type: "idle" };
    var form = opts.form || {};
    var walk = buildWalk(action, form, opts.catalog || {}, opts.sim || {});
    var key = actionKey(action, form);
    var same = key === state.key && state.root === root && state.walk;

    if (same && !opts.force) {
      if (!walk.ran && state.walk.messages[0]) {
        state.walk.messages[0].label = walk.messages[0].label;
        var cap = root.querySelector("[data-be-cap]");
        if (cap && state.index <= 0) cap.innerHTML = captionHtml(state.walk, 0);
      }
      return state.walk;
    }

    stopTimer();
    state.key = key;
    state.walk = walk;
    state.root = root;
    state.index = walk.ran ? -1 : 0;
    root.classList.toggle("is-idle", !walk.ran);
    root.innerHTML = htmlShell(walk);
    bind(root);
    applyFrame();
    if (walk.ran) {
      play();
      try {
        root.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } catch (e) {}
    }
    return walk;
  }

  global.SFE_BACKEND = {
    buildWalk: buildWalk,
    mount: mount,
    replay: function () {
      if (state.root) mount(state.root, { action: global.SFE_LESSON.getAction(), form: global.SFE_LESSON.getForm(), catalog: global.SFE_DEMO, sim: global.SFE_LESSON.getSim(), force: true });
    }
  };
})(window);
