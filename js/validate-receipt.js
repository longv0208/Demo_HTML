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
        check(
          !!trim(form.purchaseOrderId),
          "Trình duyệt bắt buộc phải chọn đơn đặt hàng",
          "Ô chọn Đơn đặt hàng được đánh dấu bắt buộc trên trang web. Nếu để trống, trình duyệt có thể chặn bạn gửi form. Máy chủ Java vẫn kiểm tra lại khi bạn bấm Lưu nháp."
        )
      );
    }
    if (fieldId === "receiptDate") {
      out.push(
        check(
          !!trim(form.receiptDate),
          "Trình duyệt bắt buộc phải có ngày nhận",
          "Ô Ngày nhận là ô chọn ngày và được đánh dấu bắt buộc. Để trống thì trình duyệt có thể chặn gửi form."
        )
      );
      if (form.receiptDate) {
        out.push(
          check(
            form.receiptDate <= todayYmd(),
            "Trình duyệt cảnh báo nếu chọn ngày sau hôm nay",
            "Bài học này cảnh báo ngay trên màn hình khi ngày nhận ở tương lai. Kết luận cuối cùng vẫn do máy chủ Java quyết định khi bạn bấm Lưu nháp."
          )
        );
      }
    }
    if (fieldId === "invoiceNumber") {
      out.push(
        check(
          (form.invoiceNumber || "").length <= 100,
          "Không được gõ quá 100 ký tự",
          "Số hóa đơn không bắt buộc. Bạn có thể để trống. Nếu điền thì tối đa 100 ký tự."
        )
      );
    }
    if (fieldId === "note") {
      out.push(
        check(
          (form.note || "").length <= 500,
          "Không được gõ quá 500 ký tự",
          "Ghi chú không bắt buộc. Bạn có thể để trống. Nếu điền thì tối đa 500 ký tự."
        )
      );
    }
    if (fieldId === "poItemId") {
      out.push(
        check(
          !!trim(item.poItemId),
          "Trình duyệt bắt buộc mỗi dòng phải chọn sản phẩm",
          "Mỗi dòng hàng phải chọn một sản phẩm thuộc đơn đặt hàng. Để trống thì trình duyệt có thể chặn gửi form."
        )
      );
    }
    if (fieldId === "batchNumber") {
      out.push(
        check(
          !!trim(item.batchNumber),
          "Trình duyệt bắt buộc phải có số lô",
          "Mọi dòng hàng đều phải có số lô, tối đa 100 ký tự. Thiếu số lô thì trình duyệt có thể chặn gửi form."
        )
      );
    }
    if (fieldId === "expiryDate") {
      out.push(
        check(
          !!trim(item.expiryDate),
          "Trình duyệt bắt buộc phải có hạn dùng",
          "Ô hạn dùng là ô chọn ngày và được đánh dấu bắt buộc trên mỗi dòng."
        )
      );
    }
    if (fieldId === "quantity") {
      var q = Number(item.quantity);
      out.push(
        check(
          item.quantity !== "" && item.quantity != null,
          "Trình duyệt bắt buộc phải có số lượng",
          "Mỗi dòng phải có số lượng. Để trống thì trình duyệt có thể chặn gửi form."
        )
      );
      out.push(
        check(
          !(item.quantity !== "" && q < 1),
          "Số lượng trên form phải từ 1 trở lên",
          "Ô số lượng được đặt tối thiểu là 1. Nếu gõ 0 hoặc số âm, trình duyệt có thể chặn gửi form."
        )
      );
    }
    if (fieldId === "costPrice") {
      var c = Number(item.costPrice);
      out.push(
        check(
          item.costPrice !== "" && item.costPrice != null,
          "Trình duyệt bắt buộc phải có giá nhập",
          "Mỗi dòng phải có giá nhập. Để trống thì trình duyệt có thể chặn gửi form."
        )
      );
      out.push(
        check(
          !(item.costPrice !== "" && c < 0),
          "Giá nhập trên form không được âm",
          "Ô giá nhập được đặt tối thiểu là 0. Giá âm thì trình duyệt có thể chặn gửi form."
        )
      );
    }
    if (fieldId === "binId" || fieldId === "zoneRack") {
      var needBin = item.inspectionResult === "CHAP_NHAN";
      out.push(
        check(
          !needBin || !!trim(item.binId),
          "Khi chọn Chấp nhận, trình duyệt bắt buộc phải chọn ngăn",
          "Trang gốc dùng JavaScript để bắt buộc ô Ngăn khi kết quả kiểm tra là Chấp nhận. Đây chỉ là kiểm tra trên màn hình. Máy chủ Java vẫn kiểm tra lại khi Lưu nháp."
        )
      );
    }
    if (fieldId === "rejectionReason") {
      var needR = item.inspectionResult === "TU_CHOI";
      out.push(
        check(
          !needR || !!trim(item.rejectionReason),
          "Khi chọn Từ chối, trình duyệt bắt buộc phải có lý do",
          "Ô lý do hiện ra khi bạn chọn Từ chối. Thiếu lý do thì trình duyệt có thể chặn gửi form. Máy chủ Java cũng từ chối nếu thiếu."
        )
      );
    }
    if (fieldId === "inspectionResult") {
      out.push(
        check(
          ["CHO_KIEM_TRA", "CHAP_NHAN", "TU_CHOI"].indexOf(item.inspectionResult) >= 0,
          "Phải chọn một trong ba kết quả kiểm tra",
          "Ba lựa chọn là Chờ kiểm tra, Chấp nhận, hoặc Từ chối. Mặc định là Chờ kiểm tra. Lưu nháp vẫn cho phép để Chờ kiểm tra."
        )
      );
    }
    if (fieldId === "saveDraft") {
      out.push(
        check(
          true,
          "Nút Lưu nháp gửi toàn bộ form lên máy chủ",
          "Khi bạn bấm nút, trình duyệt gom mọi ô có tên rồi gửi đi bằng phương thức POST. Chương trình Java trên máy chủ chưa chạy cho đến khi yêu cầu đó được gửi (ở bài học này: khi mô phỏng Lưu nháp)."
        )
      );
    }
    if (fieldId === "supplierName") {
      out.push(
        check(
          true,
          "Ô chỉ đọc, không gõ được",
          "Bạn không nhập nhà cung cấp. Ô này không được gửi lên máy chủ. Máy chủ tự lấy nhà cung cấp từ đơn đặt hàng đã chọn."
        )
      );
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
        runsWhen:
          "Chỉ chạy thật khi bạn bấm Lưu nháp. Chương trình kiểm tra tên validateReceipt, chế độ lưu nháp (không bắt buộc đã kiểm tra xong từng dòng)."
      });
    }
    if (fieldId === "purchaseOrderId") {
      add(
        !draft.errors.purchaseOrderId,
        "Máy chủ bắt buộc đơn đặt hàng còn đang mở để nhận",
        draft.errors.purchaseOrderId
          ? "Máy chủ từ chối. Thông báo gốc: " + draft.errors.purchaseOrderId
          : "Đơn đã chọn tồn tại và còn mở: trạng thái Đã đặt hàng (DA_DAT_HANG) hoặc Đã nhận một phần (DA_NHAN_MOT_PHAN)."
      );
    }
    if (fieldId === "supplierName") {
      add(
        true,
        "Máy chủ tự lấy nhà cung cấp từ đơn đặt hàng",
        "Chương trình không đọc ô Nhà cung cấp trên form. Nó lấy mã nhà cung cấp từ đơn đặt hàng rồi gắn vào phiếu."
      );
    }
    if (fieldId === "receiptDate") {
      add(
        !draft.errors.receiptDate,
        "Máy chủ không cho ngày nhận ở tương lai",
        draft.errors.receiptDate
          ? "Máy chủ từ chối. Thông báo gốc: " + draft.errors.receiptDate
          : "Ngày nhận có giá trị và không sau hôm nay."
      );
    }
    if (fieldId === "invoiceNumber" || fieldId === "note") {
      add(
        true,
        "Máy chủ không bắt buộc ô này",
        "Chương trình chỉ cắt khoảng trắng thừa. Thiếu số hóa đơn hoặc ghi chú không bị xem là lỗi khi Lưu nháp."
      );
    }
    if (fieldId === "poItemId" || fieldId === "quantity" || fieldId === "saveDraft") {
      if (draft.itemCount === 0) {
        add(
          false,
          "Máy chủ bắt buộc phải có ít nhất một dòng hàng",
          "Chưa có dòng sản phẩm hợp lệ. Thông báo gốc: Add at least one received batch line."
        );
      }
    }
    if (fieldId === "poItemId") {
      add(
        !draft.flags.itemNotInPo,
        "Sản phẩm phải thuộc đơn đặt hàng đã chọn",
        draft.flags.itemNotInPo
          ? "Có dòng không thuộc đơn đang chọn. Thông báo gốc: Every line must be a product of the selected purchase order."
          : "Mã sản phẩm được lấy từ đơn đặt hàng, không tin giá trị tự gõ trên form."
      );
    }
    if (fieldId === "batchNumber") {
      add(
        !draft.flags.batchMissing,
        "Máy chủ bắt buộc mọi dòng phải có số lô",
        draft.flags.batchMissing
          ? "Có dòng thiếu số lô. Thông báo gốc: Batch number is required on every line."
          : "Mọi dòng đều đã có số lô."
      );
    }
    if (fieldId === "expiryDate") {
      add(
        !draft.flags.expiryMissing,
        "Máy chủ bắt buộc mọi dòng phải có hạn dùng",
        draft.flags.expiryMissing
          ? "Có dòng thiếu hạn dùng. Thông báo gốc: Expiry date is required on every line."
          : "Mọi dòng đều đã có hạn dùng."
      );
      add(
        !draft.flags.expired,
        "Không được Chấp nhận lô đã hết hạn vào ngày nhận",
        draft.flags.expired
          ? "Thuốc đã hết hạn vào ngày nhận không thể được chấp nhận — hãy đánh dấu Từ chối."
          : "Không dính quy tắc hết hạn cộng với Chấp nhận."
      );
    }
    if (fieldId === "quantity") {
      add(
        !draft.flags.badQty,
        "Số lượng trên máy chủ phải lớn hơn 0",
        draft.flags.badQty
          ? "Có dòng số lượng bằng 0 hoặc không hợp lệ. Thông báo gốc: Quantity must be greater than 0."
          : "Số lượng trên các dòng đều lớn hơn 0."
      );
      add(
        !draft.flags.overdelivered,
        "Tổng số lượng Chấp nhận không được vượt phần còn lại trên đơn",
        draft.flags.overdelivered
          ? "Tổng số lượng Chấp nhận lớn hơn số còn lại trên đơn đặt hàng. Thông báo gốc: Accepted quantity exceeds the remaining quantity on the purchase order."
          : "Chưa vượt phần còn lại. Máy chủ chỉ cộng các dòng đánh Chấp nhận, không cộng dòng Chờ kiểm tra hay Từ chối."
      );
    }
    if (fieldId === "costPrice") {
      add(
        !draft.flags.badCost,
        "Giá nhập trên máy chủ phải từ 0 trở lên",
        draft.flags.badCost
          ? "Có dòng giá nhập bị thiếu hoặc bị âm. Thông báo gốc: Cost price must be 0 or greater."
          : "Giá nhập trên các dòng đều hợp lệ."
      );
    }
    if (fieldId === "zoneRack") {
      add(
        true,
        "Máy chủ phiếu nhập không đọc Khu và Kệ",
        "GoodsReceiptServlet không nhận mã khu hay mã kệ. Hai ô này chỉ giúp bạn tìm ngăn trên màn hình. Giá trị gửi lên máy chủ là mã ngăn (binId)."
      );
    }
    if (fieldId === "binId") {
      add(
        !draft.flags.binMissing,
        "Dòng Chấp nhận phải có ngăn, kể cả khi chỉ lưu nháp",
        draft.flags.binMissing
          ? "Có dòng Chấp nhận chưa chọn ngăn. Thông báo gốc: Mỗi dòng Chấp nhận phải chọn Khu / Kệ / Ngăn đặt hàng."
          : item.inspectionResult === "CHAP_NHAN"
            ? "Dòng Chấp nhận đã có ngăn."
            : "Dòng chưa phải Chấp nhận nên ngăn không bắt buộc lúc lưu nháp."
      );
    }
    if (fieldId === "inspectionResult") {
      add(
        true,
        "Lưu nháp vẫn cho phép Chờ kiểm tra",
        "Chế độ lưu nháp (strict = false) không chặn kết quả Chờ kiểm tra. Chỉ bước Xác nhận sau này (strict = true) mới bắt buộc mọi dòng phải Chấp nhận hoặc Từ chối. Bài học này không chạy bước Xác nhận."
      );
    }
    if (fieldId === "rejectionReason") {
      add(
        !draft.flags.reasonMissing,
        "Dòng Từ chối phải có lý do",
        draft.flags.reasonMissing
          ? "Có dòng Từ chối thiếu lý do. Thông báo gốc: A rejection reason is required for every rejected line."
          : "Không có dòng Từ chối nào thiếu lý do."
      );
    }
    if (fieldId === "saveDraft") {
      add(
        draft.ok,
        "Máy chủ kiểm tra toàn bộ phiếu trước khi ghi",
        draft.ok
          ? "Không còn lỗi. Chỉ khi đó chương trình mới gọi GoodsReceiptDAO.createDraft để ghi phiếu bản nháp vào cơ sở dữ liệu."
          : "Còn lỗi nên chương trình chưa ghi phiếu. Chi tiết: " + firstError(draft.errors)
      );
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
        label: "Các bước này chỉ chạy khi Xác nhận nhập kho — bài học này không làm",
        message:
          "Khi có người bấm Xác nhận sau này, chương trình GoodsReceiptDAO.confirm mới chạy. Lúc đó nó kiểm tra phiếu vẫn còn bản nháp, đơn đặt hàng vẫn còn mở, ngăn chứa hàng tồn tại và đang hoạt động, số lô với hạn dùng không xung đột, số lượng chấp nhận vẫn hợp lệ, rồi mới cộng thuốc vào kệ và ghi sổ nhập kho trong một lần lưu. Nút Lưu nháp không chạy hàm này, nên số thuốc trên kệ không tăng."
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
