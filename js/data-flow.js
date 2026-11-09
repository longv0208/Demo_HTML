/**
 * Data flow theo hành động thật — không tô layer chỉ vì đang focus field.
 * Đối chiếu JSP (GET PO, fetch locations) + GoodsReceiptServlet + LocationServlet.
 */
(function (global) {
  "use strict";

  var LAYERS = [
    {
      id: "browser",
      label: "Browser / JSP",
      hint: "HTML người dùng đang điền. JS trên JSP chạy trong trình duyệt."
    },
    {
      id: "httpReq",
      label: "HTTP Request",
      hint: "GET hoặc POST rời khỏi trình duyệt."
    },
    {
      id: "servlet",
      label: "Servlet",
      hint: "GoodsReceiptServlet (/inventory/receipts) hoặc LocationServlet (/inventory/locations)."
    },
    {
      id: "dao",
      label: "DAO / JDBC",
      hint: "PurchaseOrderDAO, LocationDAO, GoodsReceiptDAO."
    },
    {
      id: "db",
      label: "MySQL",
      hint: "Chỉ đổi khi transaction commit."
    },
    {
      id: "httpRes",
      label: "HTTP Response",
      hint: "forward JSP, JSON, hoặc 302 redirect rồi GET mới."
    }
  ];

  var ST = {
    idle: "Chưa được gọi",
    running: "Đang xử lý (bước mô phỏng)",
    done: "Xử lý hoàn tất",
    error: "Phát hiện lỗi",
    na: "Không áp dụng"
  };

  function liveVal(form, fieldId) {
    var item = (form.items && form.items[0]) || {};
    var map = {
      purchaseOrderId: form.purchaseOrderId,
      supplierName: "(không POST)",
      receiptDate: form.receiptDate,
      invoiceNumber: form.invoiceNumber,
      note: form.note,
      poItemId: item.poItemId,
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate,
      quantity: item.quantity,
      costPrice: item.costPrice,
      zoneRack: "zoneId=" + (item.zoneId || "") + " rackId=" + (item.rackId || "") + " (không POST)",
      binId: item.binId,
      inspectionResult: item.inspectionResult,
      rejectionReason: item.rejectionReason,
      saveDraft: "submitAction=draft"
    };
    return map[fieldId];
  }

  function statusesFor(action) {
    var type = action && action.type;
    var allIdle = {
      browser: "idle",
      httpReq: "na",
      servlet: "na",
      dao: "na",
      db: "na",
      httpRes: "na"
    };
    if (!type || type === "idle" || type === "focus" || type === "type" || type === "add-item") {
      return Object.assign(allIdle, { browser: "done" });
    }
    if (type === "po-change") {
      return {
        browser: "done",
        httpReq: "done",
        servlet: "done",
        dao: "done",
        db: "done",
        httpRes: "done"
      };
    }
    if (type === "zone" || type === "rack") {
      return {
        browser: "done",
        httpReq: "done",
        servlet: "done",
        dao: "done",
        db: "done",
        httpRes: "done"
      };
    }
    if (type === "cancel") {
      return {
        browser: "done",
        httpReq: "done",
        servlet: "done",
        dao: "done",
        db: "done",
        httpRes: "done"
      };
    }
    if (type === "save-draft") {
      var branch = action.branch;
      if (branch === "validation") {
        return {
          browser: "done",
          httpReq: "done",
          servlet: "error",
          dao: "na",
          db: "na",
          httpRes: "done"
        };
      }
      if (branch === "dbError") {
        return {
          browser: "done",
          httpReq: "done",
          servlet: "done",
          dao: "error",
          db: "error",
          httpRes: "done"
        };
      }
      return {
        browser: "done",
        httpReq: "done",
        servlet: "done",
        dao: "done",
        db: "done",
        httpRes: "done"
      };
    }
    return allIdle;
  }

  function arrowsFor(action) {
    var type = action && action.type;
    if (type === "po-change") {
      return "Browser → GET ?action=new&po=… → GoodsReceiptServlet.handleNewForm → PurchaseOrderDAO → MySQL (đọc) → forward JSP → Browser";
    }
    if (type === "zone") {
      return "Browser → GET /inventory/locations?action=api-racks&zoneId= → LocationServlet → LocationDAO.findRacks → MySQL → JSON → Browser";
    }
    if (type === "rack") {
      return "Browser → GET /inventory/locations?action=api-bins&rackId= → LocationServlet → LocationDAO.findBins → MySQL → JSON → Browser";
    }
    if (type === "cancel") {
      return "Browser → GET /inventory/receipts → handleList → GoodsReceiptDAO.findAll (đọc) → forward list.jsp → Browser. Không POST, không INSERT.";
    }
    if (type === "save-draft") {
      if (action.branch === "validation") {
        return "Browser → POST create → handleCreate → validateReceipt(false) lỗi → forward form. DAO không chạy. DB không đổi.";
      }
      if (action.branch === "dbError") {
        return "Browser → POST create → validate OK → createDraft SQLException → rollback → forward form. Không COMMIT.";
      }
      return "Browser → POST create → validateReceipt(false) → createDraft INSERT → COMMIT BAN_NHAP → 302 → GET list → JSP. Tồn kho không đổi.";
    }
    return "Chưa gửi đến server. Chỉ Browser đang giữ giá trị trên form.";
  }

  function requestText(action, form) {
    var V = global.SFE_VALIDATE;
    var type = action && action.type;
    var item = (form.items && form.items[0]) || {};
    if (type === "po-change") {
      return (
        "GET /Pharma_Flow/inventory/receipts?action=new" +
        (form.purchaseOrderId ? "&po=" + encodeURIComponent(form.purchaseOrderId) : "") +
        "&receiptDate=" +
        encodeURIComponent(form.receiptDate || "") +
        "&invoiceNumber=" +
        encodeURIComponent(form.invoiceNumber || "") +
        "&note=" +
        encodeURIComponent(form.note || "")
      );
    }
    if (type === "zone") {
      return "GET /Pharma_Flow/inventory/locations?action=api-racks&zoneId=" + (item.zoneId || "");
    }
    if (type === "rack") {
      return "GET /Pharma_Flow/inventory/locations?action=api-bins&rackId=" + (item.rackId || "");
    }
    if (type === "cancel") {
      return "GET /Pharma_Flow/inventory/receipts";
    }
    if (type === "save-draft") {
      return V.buildPostPreview(form);
    }
    return "Chưa có request";
  }

  function layerDetail(layerId, action, form, catalog) {
    var V = global.SFE_VALIDATE;
    var type = (action && action.type) || "idle";
    var fieldId = (action && action.fieldId) || "quantity";
    var val = liveVal(form, fieldId);
    var st = statusesFor(action)[layerId];
    var sent = type === "po-change" || type === "zone" || type === "rack" || type === "save-draft" || type === "cancel";
    var draft = V.servletValidate(form, catalog, false);
    var lesson = global.SFE_LESSON;
    var sim = lesson ? lesson.getSim() : { goodsReceipts: [] };

    var base = {
      status: st,
      statusLabel: ST[st] || st,
      hasHttp: sent && (layerId === "httpReq" || layerId === "httpRes" || layerId === "servlet"),
      hasSql: false,
      dbChanged: false,
      file: "",
      method: "",
      input: "",
      output: "",
      nextWhy: ""
    };

    if (layerId === "browser") {
      base.file = "web/WEB-INF/views/admin/goods-receipt-form.jsp";
      base.method = "DOM + JS trên JSP";
      base.input = "Người dùng sửa field " + fieldId;
      base.output = fieldId + " = " + String(val);
      base.nextWhy = sent
        ? "Hành động này tạo HTTP."
        : "Giá trị mới chỉ nằm trong Browser cho đến khi đổi PO, chọn Zone/Rack, Lưu nháp hoặc Hủy.";
      return base;
    }

    if (layerId === "httpReq") {
      base.file = "goods-receipt-form.jsp";
      base.method = sent ? (type === "save-draft" ? "POST" : "GET") : "—";
      base.input = sent ? "Giá trị form hiện tại" : "Không";
      base.output = requestText(action, form);
      base.nextWhy = sent ? "Container khớp @WebServlet." : "Không có packet HTTP.";
      return base;
    }

    if (layerId === "servlet") {
      if (!sent) {
        base.file = "GoodsReceiptServlet.java";
        base.method = "Chưa chạy readItemsForm() / handleCreate()";
        base.input = "Chưa có request";
        base.output = "Chưa chạy";
        base.nextWhy = "Servlet chỉ chạy khi có HTTP.";
        return base;
      }
      if (type === "po-change") {
        base.file = "GoodsReceiptServlet.java";
        base.method = "doGet → handleNewForm";
        base.input = "query po, receiptDate, invoiceNumber, note";
        base.output = "forward FORM_JSP + receivableOrders + poItems";
        base.nextWhy = "Cần DAO để nạp PO và dòng hàng.";
        return base;
      }
      if (type === "zone" || type === "rack") {
        base.file = "LocationServlet.java";
        base.method = type === "zone" ? "handleApiRacks" : "handleApiBins";
        base.input = type === "zone" ? "zoneId" : "rackId";
        base.output = "JSON array (rackId/rackCode hoặc binId/binCode)";
        base.nextWhy = "DAO lọc HOAT_DONG.";
        return base;
      }
      if (type === "cancel") {
        base.file = "GoodsReceiptServlet.java";
        base.method = "doGet → handleList (default)";
        base.input = "GET không body";
        base.output = "forward goods-receipt-list.jsp";
        base.nextWhy = "Không gọi createDraft.";
        return base;
      }
      base.file = "GoodsReceiptServlet.java";
      base.method = "doPost → handleCreate → validateReceipt(false)";
      base.input = "POST body (tên param không có [])";
      if (action.branch === "validation") {
        base.status = "error";
        base.output = "errors: " + V.firstError(draft.errors);
        base.nextWhy = "repopulateForm + forward. DAO không gọi.";
      } else {
        base.output = "errors rỗng → setStatus BAN_NHAP";
        base.nextWhy = "Gọi GoodsReceiptDAO.createDraft.";
      }
      return base;
    }

    if (layerId === "dao") {
      base.hasSql = sent && type !== "cancel" ? type !== "save-draft" || action.branch !== "validation" : type === "cancel";
      if (!sent) {
        base.method = "Chưa được gọi";
        base.input = "—";
        base.output = "—";
        base.nextWhy = "Không có HTTP thì không có JDBC.";
        return base;
      }
      if (type === "po-change") {
        base.file = "PurchaseOrderDAO.java";
        base.method = "findReceivable / findById / findItems";
        base.hasSql = true;
        base.input = "purchaseOrderId=" + form.purchaseOrderId;
        base.output = "PO + items (ordered/received/remaining) — SELECT";
        base.nextWhy = "Servlet gắn attribute rồi forward.";
        return base;
      }
      if (type === "zone") {
        base.file = "LocationDAO.java";
        base.method = 'findRacks(zoneId, null, "HOAT_DONG")';
        base.hasSql = true;
        base.input = "zoneId";
        base.output = "List<StorageRack>";
        return base;
      }
      if (type === "rack") {
        base.file = "LocationDAO.java";
        base.method = 'findBins(rackId, null, null, "HOAT_DONG")';
        base.hasSql = true;
        base.input = "rackId";
        base.output = "List<StorageBin>";
        return base;
      }
      if (type === "cancel") {
        base.file = "GoodsReceiptDAO.java";
        base.method = "findAll (SELECT)";
        base.hasSql = true;
        base.dbChanged = false;
        base.input = "keyword/status filter";
        base.output = "Danh sách phiếu — không INSERT";
        return base;
      }
      if (action.branch === "validation") {
        base.method = "createDraft không được gọi";
        base.hasSql = false;
        base.output = "Không";
        base.nextWhy = "validateReceipt trả errors.";
        return base;
      }
      base.file = "GoodsReceiptDAO.java";
      base.method = "createDraft";
      base.hasSql = true;
      base.input = "GoodsReceipt + items";
      if (action.branch === "dbError") {
        base.status = "error";
        base.output = "SQLException → rollback → return -1";
        base.dbChanged = false;
      } else {
        base.output = "receiptId [DEMO], batch_id=NULL";
        base.dbChanged = true;
      }
      return base;
    }

    if (layerId === "db") {
      var nGr = (sim.goodsReceipts || []).length;
      if (!sent) {
        base.output = "Chưa thay đổi. Phiếu demo đang có: " + nGr;
        return base;
      }
      if (type === "po-change" || type === "zone" || type === "rack" || type === "cancel") {
        base.hasSql = true;
        base.dbChanged = false;
        base.output = "Chỉ SELECT. inventory / PO received không đổi.";
        return base;
      }
      if (action.branch === "validation" || action.branch === "dbError") {
        base.dbChanged = false;
        base.output =
          "Không COMMIT. goods_receipts không thêm phiếu. inventory_batches / inventory_batch_locations / purchase_order_items.received_quantity / inventory_movements: không đổi.";
        return base;
      }
      base.hasSql = true;
      base.dbChanged = true;
      base.output =
        "After: goods_receipts +1 BAN_NHAP; goods_receipt_items +" +
        (form.items || []).length +
        "; inventory_* không đổi; PO received không đổi; không có NHAP_KHO.";
      return base;
    }

    if (layerId === "httpRes") {
      if (!sent) {
        base.output = "Không có response.";
        return base;
      }
      if (type === "po-change") {
        base.method = "forward FORM_JSP";
        base.output = "HTML form với poItems mới (cùng URL GET).";
        return base;
      }
      if (type === "zone" || type === "rack") {
        base.method = "application/json";
        base.output = "JSON racks/bins → JS đổ <select>";
        return base;
      }
      if (type === "cancel") {
        base.method = "forward LIST_JSP";
        base.output = "Danh sách. Không ?ok=created.";
        return base;
      }
      if (action.branch === "validation" || action.branch === "dbError") {
        base.method = "forward FORM_JSP (không redirect)";
        base.output = "Cùng request POST; attribute errors; URL có thể vẫn ?action=create.";
        return base;
      }
      base.method = "302 sendRedirect rồi GET list";
      base.output = "Location: /inventory/receipts?ok=created → handleList → «Đã lưu nháp phiếu nhập — chưa có gì vào kho.»";
      return base;
    }
    return base;
  }

  global.SFE_FLOW = {
    layers: LAYERS,
    statusLabel: ST,
    statusesFor: statusesFor,
    arrowsFor: arrowsFor,
    requestText: requestText,
    layerDetail: layerDetail,
    liveVal: liveVal
  };
})(window);
