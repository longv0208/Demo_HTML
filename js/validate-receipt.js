/**
 * Validation 3 cấp — đối chiếu GoodsReceiptServlet.validateReceipt + HTML JSP.
 * Browser/Educational UX không giả vờ đã chạy servlet.
 */
(function (global) {
  "use strict";

  function todayYmd() {
    var d = new Date();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    m = (m < 10 ? "0" : "") + m;
    day = (day < 10 ? "0" : "") + day;
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function parseId(s) {
    if (s == null || String(s).trim() === "") return -1;
    var n = Number(String(s).trim());
    return isFinite(n) ? n : -1;
  }

  function trim(s) {
    return s == null ? "" : String(s).trim();
  }

  function poOf(form, catalog) {
    var id = String(form.purchaseOrderId || "");
    return (catalog.purchaseOrders || {})[id] || (catalog.closedOrders || {})[id] || null;
  }

  function poItemOf(po, poItemId) {
    if (!po) return null;
    var found = (po.items || []).filter(function (x) {
      return String(x.poItemId) === String(poItemId);
    })[0];
    return found || null;
  }

  function readItemsLikeServlet(form) {
    var out = [];
    (form.items || []).forEach(function (row) {
      var poItemId = parseId(row.poItemId);
      if (poItemId <= 0) return;
      var qty = parseId(row.quantity);
      var costRaw = trim(row.costPrice);
      var cost = costRaw === "" ? NaN : Number(costRaw);
      var insp = trim(row.inspectionResult) || "CHO_KIEM_TRA";
      var binId = parseId(row.binId);
      out.push({
        poItemId: poItemId,
        batchNumber: trim(row.batchNumber),
        expiryDate: trim(row.expiryDate),
        quantity: qty,
        costPrice: isFinite(cost) ? cost : -1,
        inspectionResult: insp,
        rejectionReason: trim(row.rejectionReason),
        binId: binId > 0 ? binId : 0
      });
    });
    return out;
  }

  /**
   * Replica validateReceipt(..., strict). Messages khớp servlet.
   */
  function servletValidate(form, catalog, strict) {
    var errors = {};
    var po = poOf(form, catalog);
    var poId = parseId(form.purchaseOrderId);

    if (poId <= 0) {
      errors.purchaseOrderId = "Please choose a purchase order.";
    } else if (!po) {
      errors.purchaseOrderId = "Purchase order not found.";
    } else {
      var open = po.status === "DA_DAT_HANG" || po.status === "DA_NHAN_MOT_PHAN";
      if (!open) {
        errors.purchaseOrderId = "This purchase order is not open for receiving.";
      }
    }

    var date = trim(form.receiptDate);
    if (!date) {
      errors.receiptDate = "Receipt date is required.";
    } else if (date > todayYmd()) {
      errors.receiptDate = "Receipt date cannot be in the future.";
    }

    var items = readItemsLikeServlet(form);
    if (items.length === 0) {
      errors.items = "Add at least one received batch line.";
    }

    var itemNotInPo = false;
    var batchMissing = false;
    var expiryMissing = false;
    var expired = false;
    var badQty = false;
    var badCost = false;
    var badInspection = false;
    var pendingInspection = false;
    var reasonMissing = false;
    var binMissing = false;
    var sawAccepted = false;
    var acceptedByPoItem = {};

    items.forEach(function (item) {
      var poi = poItemOf(po, item.poItemId);
      if (!poi) {
        itemNotInPo = true;
        return;
      }
      if (!item.batchNumber) batchMissing = true;
      if (!item.expiryDate) {
        expiryMissing = true;
      } else if (
        date &&
        item.expiryDate <= date &&
        item.inspectionResult === "CHAP_NHAN"
      ) {
        expired = true;
      }
      if (item.quantity == null || item.quantity <= 0) badQty = true;
      if (item.costPrice == null || item.costPrice < 0) badCost = true;
      var insp = item.inspectionResult;
      if (
        insp !== "CHO_KIEM_TRA" &&
        insp !== "CHAP_NHAN" &&
        insp !== "TU_CHOI"
      ) {
        badInspection = true;
      }
      if (strict && insp === "CHO_KIEM_TRA") pendingInspection = true;
      if (insp === "TU_CHOI" && !item.rejectionReason) reasonMissing = true;
      if (insp === "CHAP_NHAN") {
        sawAccepted = true;
        if (!item.binId) binMissing = true;
        if (item.quantity > 0) {
          acceptedByPoItem[item.poItemId] =
            (acceptedByPoItem[item.poItemId] || 0) + item.quantity;
        }
      }
    });

    var overdelivered = false;
    Object.keys(acceptedByPoItem).forEach(function (k) {
      var poi = poItemOf(po, k);
      if (!poi) return;
      if (acceptedByPoItem[k] > poi.remaining) overdelivered = true;
    });

    if (!errors.items) {
      if (itemNotInPo) {
        errors.items = "Every line must be a product of the selected purchase order.";
      } else if (batchMissing) {
        errors.items = "Batch number is required on every line.";
      } else if (expiryMissing) {
        errors.items = "Expiry date is required on every line.";
      } else if (expired) {
        errors.items =
          "Thuốc đã hết hạn vào ngày nhận không thể được chấp nhận — hãy đánh dấu TU_CHOI.";
      } else if (badQty) {
        errors.items = "Quantity must be greater than 0.";
      } else if (badCost) {
        errors.items = "Cost price must be 0 or greater.";
      } else if (badInspection) {
        errors.items =
          "Kết quả kiểm tra phải là Chờ kiểm tra, Chấp nhận hoặc Từ chối.";
      } else if (pendingInspection) {
        errors.items =
          "Mọi dòng phải được kiểm tra — đặt Chấp nhận hoặc Từ chối trước khi xác nhận.";
      } else if (reasonMissing) {
        errors.items = "A rejection reason is required for every rejected line.";
      } else if (binMissing) {
        errors.items = "Mỗi dòng Chấp nhận phải chọn Khu / Kệ / Ngăn đặt hàng.";
      } else if (overdelivered) {
        errors.items =
          "Accepted quantity exceeds the remaining quantity on the purchase order.";
      } else if (strict && items.length && !sawAccepted) {
        errors.items = "Phải có ít nhất một dòng được chấp nhận để xác nhận nhập kho.";
      }
    }

    return {
      ok: Object.keys(errors).length === 0,
      errors: errors,
      flags: {
        itemNotInPo: itemNotInPo,
        batchMissing: batchMissing,
        expiryMissing: expiryMissing,
        expired: expired,
        badQty: badQty,
        badCost: badCost,
        reasonMissing: reasonMissing,
        binMissing: binMissing,
        overdelivered: overdelivered,
        pendingInspection: pendingInspection
      },
      itemCount: items.length,
      strict: !!strict
    };
  }

  function row0(form) {
    return (form.items && form.items[0]) || {};
  }

  function check(pass, label, message) {
    return { pass: !!pass, label: label, message: message };
  }

  /** HTML / JS trên form JSP + Educational UX (ghi nhãn). */
  function browserField(form, fieldId) {
    var item = row0(form);
    var out = [];
    if (fieldId === "purchaseOrderId") {
      out.push(
        check(!!trim(form.purchaseOrderId), "HTML required", "Select Đơn đặt hàng có thuộc tính required.")
      );
    }
    if (fieldId === "receiptDate") {
      out.push(check(!!trim(form.receiptDate), "HTML required", "input type=date required."));
      if (form.receiptDate) {
        out.push(
          check(
            form.receiptDate <= todayYmd(),
            "Educational UX Validation",
            "Trình duyệt có thể cảnh báo ngày tương lai; servlet mới là chuẩn (after(today))."
          )
        );
      }
    }
    if (fieldId === "invoiceNumber") {
      out.push(
        check(
          (form.invoiceNumber || "").length <= 100,
          "HTML maxlength=100",
          "Không bắt buộc."
        )
      );
    }
    if (fieldId === "note") {
      out.push(
        check((form.note || "").length <= 500, "HTML maxlength=500", "Không bắt buộc.")
      );
    }
    if (fieldId === "poItemId") {
      out.push(check(!!trim(item.poItemId), "HTML required", "Mỗi dòng phải chọn sản phẩm."));
    }
    if (fieldId === "batchNumber") {
      out.push(
        check(!!trim(item.batchNumber), "HTML required", "maxlength=100, bắt buộc trên mọi dòng.")
      );
    }
    if (fieldId === "expiryDate") {
      out.push(check(!!trim(item.expiryDate), "HTML required", "input type=date required."));
    }
    if (fieldId === "quantity") {
      var q = Number(item.quantity);
      out.push(check(item.quantity !== "" && item.quantity != null, "HTML required", "Bắt buộc."));
      out.push(
        check(!(item.quantity !== "" && q < 1), "HTML min=1", "type=number min=1 — trình duyệt có thể chặn submit.")
      );
    }
    if (fieldId === "costPrice") {
      var c = Number(item.costPrice);
      out.push(check(item.costPrice !== "" && item.costPrice != null, "HTML required", "Bắt buộc."));
      out.push(
        check(!(item.costPrice !== "" && c < 0), "HTML min=0", "Giá không được âm trên form.")
      );
    }
    if (fieldId === "binId" || fieldId === "zoneRack") {
      var needBin = item.inspectionResult === "CHAP_NHAN";
      out.push(
        check(
          !needBin || !!trim(item.binId),
          "JS JSP: bin.required khi CHAP_NHAN",
          "goods-receipt-form.jsp toggleBinRequired — Educational UX + HTML5, servlet vẫn kiểm lại."
        )
      );
    }
    if (fieldId === "rejectionReason") {
      var needR = item.inspectionResult === "TU_CHOI";
      out.push(
        check(
          !needR || !!trim(item.rejectionReason),
          "JS: hiện + required khi TU_CHOI",
          "Dòng Từ chối thiếu lý do: trình duyệt có thể chặn; servlet cũng chặn."
        )
      );
    }
    if (fieldId === "inspectionResult") {
      out.push(
        check(
          ["CHO_KIEM_TRA", "CHAP_NHAN", "TU_CHOI"].indexOf(item.inspectionResult) >= 0,
          "3 option trên select",
          "Mặc định CHO_KIEM_TRA."
        )
      );
    }
    if (fieldId === "saveDraft") {
      out.push(
        check(true, "submit POST", "Nút Lưu nháp serialize form — chưa chạy servlet cho đến khi mô phỏng POST.")
      );
    }
    if (fieldId === "supplierName") {
      out.push(check(true, "readonly", "Không validate — không gửi lên server."));
    }
    return out;
  }

  function servletField(form, fieldId, catalog) {
    var draft = servletValidate(form, catalog, false);
    var item = row0(form);
    var out = [];
    function add(pass, label, msg) {
      out.push({
        pass: pass,
        label: label,
        message: msg,
        runsWhen: "Khi POST Lưu nháp — validateReceipt(..., false)"
      });
    }
    if (fieldId === "purchaseOrderId") {
      add(!draft.errors.purchaseOrderId, "PO bắt buộc + còn nhận", draft.errors.purchaseOrderId || "PO mở nhận (DA_DAT_HANG / DA_NHAN_MOT_PHAN).");
    }
    if (fieldId === "supplierName") {
      add(true, "supplierId từ PO", "Không đọc supplier từ form.");
    }
    if (fieldId === "receiptDate") {
      add(!draft.errors.receiptDate, "Không tương lai", draft.errors.receiptDate || "Ngày hợp lệ.");
    }
    if (fieldId === "invoiceNumber" || fieldId === "note") {
      add(true, "Không bắt buộc", "trim; không rule lỗi riêng.");
    }
    if (fieldId === "poItemId" || fieldId === "quantity" || fieldId === "saveDraft") {
      if (draft.itemCount === 0) {
        add(false, "Cần ít nhất một dòng", "Add at least one received batch line.");
      }
    }
    if (fieldId === "poItemId") {
      add(!draft.flags.itemNotInPo, "Thuộc PO đã chọn", draft.flags.itemNotInPo ? "Every line must be a product of the selected purchase order." : "product_id lấy từ PO.");
    }
    if (fieldId === "batchNumber") {
      add(!draft.flags.batchMissing, "Batch bắt buộc mọi dòng", draft.flags.batchMissing ? "Batch number is required on every line." : "OK.");
    }
    if (fieldId === "expiryDate") {
      add(!draft.flags.expiryMissing, "Hạn dùng bắt buộc", draft.flags.expiryMissing ? "Expiry date is required on every line." : "OK.");
      add(!draft.flags.expired, "Hết hạn + CHAP_NHAN", draft.flags.expired ? "Thuốc đã hết hạn vào ngày nhận không thể được chấp nhận — hãy đánh dấu TU_CHOI." : "Không dính rule hết hạn+chấp nhận.");
    }
    if (fieldId === "quantity") {
      add(!draft.flags.badQty, "Quantity > 0", draft.flags.badQty ? "Quantity must be greater than 0." : "OK.");
      add(!draft.flags.overdelivered, "Tổng CHAP_NHAN ≤ remaining", draft.flags.overdelivered ? "Accepted quantity exceeds the remaining quantity on the purchase order." : "Chưa vượt phần còn lại (chỉ cộng dòng Chấp nhận).");
    }
    if (fieldId === "costPrice") {
      add(!draft.flags.badCost, "Cost ≥ 0", draft.flags.badCost ? "Cost price must be 0 or greater." : "OK.");
    }
    if (fieldId === "zoneRack") {
      add(true, "Không đọc zone/rack", "Servlet không nhận zoneId/rackId.");
    }
    if (fieldId === "binId") {
      add(
        !draft.flags.binMissing,
        "CHAP_NHAN phải có Bin (cả lúc nháp)",
        draft.flags.binMissing
          ? "Mỗi dòng Chấp nhận phải chọn Khu / Kệ / Ngăn đặt hàng."
          : item.inspectionResult === "CHAP_NHAN"
            ? "Dòng Chấp nhận đã có Bin."
            : "Dòng chưa Chấp nhận — Bin không bắt buộc trên nháp."
      );
    }
    if (fieldId === "inspectionResult") {
      add(true, "CHO_KIEM_TRA được nháp", "strict=false không chặn Chờ kiểm tra. Confirm (strict=true) mới cấm.");
    }
    if (fieldId === "rejectionReason") {
      add(!draft.flags.reasonMissing, "TU_CHOI cần lý do", draft.flags.reasonMissing ? "A rejection reason is required for every rejected line." : "OK.");
    }
    if (fieldId === "saveDraft") {
      add(draft.ok, "validateReceipt(false)", draft.ok ? "errors rỗng — mới được gọi createDraft." : firstError(draft.errors));
    }
    return out;
  }

  function firstError(errors) {
    var keys = Object.keys(errors);
    if (!keys.length) return "";
    return keys[0] + ": " + errors[keys[0]];
  }

  function daoConfirmOnly() {
    return [
      {
        pass: null,
        label: "Chỉ lúc Xác nhận — không chạy khi Lưu nháp",
        message:
          "GoodsReceiptDAO.confirm: phiếu còn BAN_NHAP; PO còn mở; Bin tồn tại + HOAT_DONG; lô/hạn không xung đột; kiểm lại SL chấp nhận; cộng tồn + NHAP_KHO trong một transaction."
      }
    ];
  }

  function fieldStatus(form, fieldId, catalog) {
    var browser = browserField(form, fieldId);
    var servlet = servletField(form, fieldId, catalog);
    var browserFail = browser.filter(function (c) {
      return c.pass === false;
    });
    var servletFail = servlet.filter(function (c) {
      return c.pass === false;
    });
    return {
      browser: browser,
      servlet: servlet,
      daoConfirm: daoConfirmOnly(),
      browserOk: browserFail.length === 0,
      servletWouldFail: servletFail.length > 0,
      servletFail: servletFail
    };
  }

  var SCENARIOS = [
    { id: "no-po", label: "1. Không chọn PO" },
    { id: "po-closed", label: "2. PO không còn nhận hàng [DEMO SCENARIO]" },
    { id: "future-date", label: "3. Ngày nhận ở tương lai" },
    { id: "no-items", label: "4. Không có dòng sản phẩm" },
    { id: "missing-batch", label: "5. Thiếu số lô" },
    { id: "missing-expiry", label: "6. Thiếu hạn sử dụng" },
    { id: "qty-zero", label: "7. Quantity = 0" },
    { id: "cost-negative", label: "8. Giá nhập âm" },
    { id: "chap-no-bin", label: "9. Chấp nhận không có Bin" },
    { id: "reject-no-reason", label: "10. Từ chối không có lý do" },
    { id: "expired-accept", label: "11. Hết hạn nhưng Chấp nhận" },
    { id: "overdelivered", label: "12. SL Chấp nhận vượt remaining" },
    { id: "db-error", label: "13. Lỗi database giả lập [DEMO SCENARIO]" }
  ];

  function applyScenario(form, id, catalog) {
    var f = JSON.parse(JSON.stringify(form));
    var item = f.items[0] || {};
    if (id === "no-po") f.purchaseOrderId = "";
    if (id === "po-closed") f.purchaseOrderId = "88";
    if (id === "future-date") {
      var t = todayYmd().split("-").map(Number);
      t[2] += 2;
      if (t[2] > 28) {
        t[1] += 1;
        t[2] = 1;
      }
      f.receiptDate =
        t[0] +
        "-" +
        (t[1] < 10 ? "0" : "") +
        t[1] +
        "-" +
        (t[2] < 10 ? "0" : "") +
        t[2];
    }
    if (id === "no-items") f.items = [];
    if (id === "missing-batch") item.batchNumber = "";
    if (id === "missing-expiry") item.expiryDate = "";
    if (id === "qty-zero") item.quantity = "0";
    if (id === "cost-negative") item.costPrice = "-1";
    if (id === "chap-no-bin") {
      item.inspectionResult = "CHAP_NHAN";
      item.binId = "";
      item.zoneId = "";
      item.rackId = "";
    }
    if (id === "reject-no-reason") {
      item.inspectionResult = "TU_CHOI";
      item.rejectionReason = "";
    }
    if (id === "expired-accept") {
      item.inspectionResult = "CHAP_NHAN";
      item.expiryDate = f.receiptDate || todayYmd();
      if (!item.binId) {
        item.zoneId = "1";
        item.rackId = "11";
        item.binId = "111";
      }
    }
    if (id === "overdelivered") {
      var po = poOf(f, catalog);
      var rem = 80;
      if (po && po.items[0]) rem = po.items[0].remaining;
      item.inspectionResult = "CHAP_NHAN";
      item.quantity = String(rem + 10);
      if (!item.binId) {
        item.zoneId = "1";
        item.rackId = "11";
        item.binId = "111";
      }
    }
    if (f.items[0]) f.items[0] = item;
    return f;
  }

  function buildPostBody(form) {
    var parts = [];
    function add(k, v) {
      parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(v == null ? "" : v));
    }
    add("purchaseOrderId", form.purchaseOrderId);
    add("receiptDate", form.receiptDate);
    add("invoiceNumber", form.invoiceNumber);
    add("note", form.note);
    (form.items || []).forEach(function (it) {
      add("poItemId", it.poItemId);
      add("batchNumber", it.batchNumber);
      add("expiryDate", it.expiryDate);
      add("quantity", it.quantity);
      add("costPrice", it.costPrice);
      add("binId", it.binId);
      add("inspectionResult", it.inspectionResult);
      add("rejectionReason", it.rejectionReason);
    });
    add("submitAction", "draft");
    return parts.join("&");
  }

  function buildPostPreview(form) {
    return (
      "POST /Pharma_Flow/inventory/receipts?action=create HTTP/1.1\n" +
      "Content-Type: application/x-www-form-urlencoded\n\n" +
      buildPostBody(form)
    );
  }

  global.SFE_VALIDATE = {
    todayYmd: todayYmd,
    parseId: parseId,
    servletValidate: servletValidate,
    browserField: browserField,
    servletField: servletField,
    fieldStatus: fieldStatus,
    daoConfirmOnly: daoConfirmOnly,
    scenarios: SCENARIOS,
    applyScenario: applyScenario,
    buildPostBody: buildPostBody,
    buildPostPreview: buildPostPreview,
    firstError: firstError,
    poOf: poOf
  };
})(window);
