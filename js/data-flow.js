/**
 * Data flow theo hành động thật — không tô layer chỉ vì đang focus field.
 * Đối chiếu JSP (GET PO, fetch locations) + GoodsReceiptServlet + LocationServlet.
 */
(function (global) {
  "use strict";

  var LAYERS = [
    {
      id: "browser",
      label: "Trình duyệt",
      hint: "Màn hình bạn đang điền. Trang được vẽ từ tệp JSP, rồi trình duyệt hiện thành HTML."
    },
    {
      id: "httpReq",
      label: "Gửi yêu cầu",
      hint: "Trình duyệt gửi yêu cầu GET (tải trang) hoặc POST (gửi phiếu khi Lưu nháp) tới máy chủ."
    },
    {
      id: "servlet",
      label: "Chương trình Servlet",
      hint: "GoodsReceiptServlet nhận phiếu nhập tại /inventory/receipts. LocationServlet nhận khu/kệ/ngăn tại /inventory/locations."
    },
    {
      id: "dao",
      label: "Chương trình đọc/ghi dữ liệu",
      hint: "PurchaseOrderDAO đọc đơn đặt hàng. LocationDAO đọc kệ và ngăn. GoodsReceiptDAO ghi hoặc đọc phiếu nhập."
    },
    {
      id: "db",
      label: "Cơ sở dữ liệu MySQL",
      hint: "Dữ liệu chỉ đổi khi máy chủ xác nhận lưu vĩnh viễn (COMMIT). Đọc thì không đổi."
    },
    {
      id: "httpRes",
      label: "Máy chủ trả kết quả",
      hint: "Máy chủ trả lại trang HTML, dữ liệu JSON, hoặc lệnh chuyển sang trang khác."
    }
  ];

  var ST = {
    idle: "Chưa được gọi",
    running: "Đang xử lý (mô phỏng)",
    done: "Đã xong bước này",
    error: "Phát hiện lỗi",
    na: "Không dùng trong thao tác này"
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
      return "Bạn đổi đơn đặt hàng. Trình duyệt gửi yêu cầu GET để tải lại form. GoodsReceiptServlet gọi handleNewForm, nhờ PurchaseOrderDAO đọc đơn còn nhận hàng từ MySQL, rồi trả lại trang form với sản phẩm mới. Chưa ghi phiếu.";
    }
    if (type === "zone") {
      return "Bạn chọn khu. Trình duyệt hỏi danh sách kệ tại LocationServlet (không phải GoodsReceiptServlet). LocationDAO đọc các kệ đang hoạt động từ MySQL rồi trả danh sách về ô chọn Kệ.";
    }
    if (type === "rack") {
      return "Bạn chọn kệ. Trình duyệt hỏi danh sách ngăn tại LocationServlet. LocationDAO đọc các ngăn đang hoạt động từ MySQL rồi trả danh sách về ô chọn Ngăn. Mã khu và mã kệ không được gửi khi Lưu nháp.";
    }
    if (type === "cancel") {
      return "Bạn bấm Hủy. Trình duyệt xin trang danh sách bằng GET, không gửi form. GoodsReceiptServlet gọi handleList, GoodsReceiptDAO chỉ đọc danh sách. Không tạo phiếu mới.";
    }
    if (type === "save-draft") {
      if (action.branch === "validation") {
        return "Bạn bấm Lưu nháp. Trình duyệt gửi toàn bộ form. GoodsReceiptServlet kiểm tra bằng validateReceipt và phát hiện lỗi, nên trả lại form. Chương trình ghi phiếu không chạy. Cơ sở dữ liệu không đổi.";
      }
      if (action.branch === "dbError") {
        return "Dữ liệu đã hợp lệ nhưng hàm ghi phiếu createDraft gặp lỗi. Máy chủ hủy thay đổi (rollback) rồi trả lại form. Không có phiếu mới.";
      }
      return "Bạn bấm Lưu nháp. Máy chủ kiểm tra xong, GoodsReceiptDAO.createDraft thêm phiếu bản nháp và các dòng hàng, rồi xác nhận lưu. Máy chủ chuyển bạn sang trang danh sách. Số thuốc trên kệ không tăng.";
    }
    return "Bạn đang điền form trên trình duyệt. Chưa gửi đến máy chủ Java. GoodsReceiptServlet và LocationServlet chưa nhận yêu cầu nào.";
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
      base.method = "Màn hình form (HTML và JavaScript trên trang JSP)";
      base.input = "Bạn đang sửa ô " + fieldId;
      base.output = "Giá trị hiện tại: " + fieldId + " = " + String(val);
      base.nextWhy = sent
        ? "Thao tác này đã gửi yêu cầu tới máy chủ."
        : "Giá trị mới chỉ nằm trên trình duyệt cho đến khi bạn đổi đơn đặt hàng, chọn khu hoặc kệ, bấm Lưu nháp, hoặc bấm Hủy.";
      return base;
    }

    if (layerId === "httpReq") {
      base.file = "goods-receipt-form.jsp";
      base.method = sent ? (type === "save-draft" ? "POST (gửi dữ liệu form)" : "GET (xin trang hoặc danh sách)") : "—";
      base.input = sent ? "Giá trị đang có trên form" : "Không gửi gì";
      base.output = requestText(action, form);
      base.nextWhy = sent
        ? "Máy chủ Tomcat khớp địa chỉ với chương trình Servlet được gắn @WebServlet."
        : "Chưa có yêu cầu nào rời khỏi trình duyệt.";
      return base;
    }

    if (layerId === "servlet") {
      if (!sent) {
        base.file = "GoodsReceiptServlet.java";
        base.method = "Chưa chạy readItemsForm hay handleCreate";
        base.input = "Chưa có yêu cầu";
        base.output = "Chưa chạy";
        base.nextWhy = "Chương trình Servlet chỉ chạy khi trình duyệt gửi yêu cầu HTTP.";
        return base;
      }
      if (type === "po-change") {
        base.file = "GoodsReceiptServlet.java";
        base.method = "doGet rồi handleNewForm";
        base.input = "Mã đơn đặt hàng trên đường dẫn, kèm ngày nhận, hóa đơn, ghi chú";
        base.output = "Trả lại trang form với danh sách đơn còn nhận hàng và sản phẩm của đơn vừa chọn";
        base.nextWhy = "Cần chương trình đọc đơn đặt hàng (PurchaseOrderDAO) để nạp dữ liệu.";
        return base;
      }
      if (type === "zone" || type === "rack") {
        base.file = "LocationServlet.java";
        base.method = type === "zone" ? "handleApiRacks (tìm kệ theo khu)" : "handleApiBins (tìm ngăn theo kệ)";
        base.input = type === "zone" ? "Mã khu" : "Mã kệ";
        base.output = "Danh sách kệ hoặc ngăn dạng JSON để JavaScript đổ vào ô chọn";
        base.nextWhy = "LocationDAO chỉ lấy mục đang hoạt động.";
        return base;
      }
      if (type === "cancel") {
        base.file = "GoodsReceiptServlet.java";
        base.method = "doGet rồi handleList (mặc định khi không có action)";
        base.input = "GET, không gửi nội dung form";
        base.output = "Trả về trang danh sách phiếu nhập";
        base.nextWhy = "Không gọi hàm ghi phiếu bản nháp createDraft.";
        return base;
      }
      base.file = "GoodsReceiptServlet.java";
      base.method = "doPost rồi handleCreate rồi validateReceipt ở chế độ lưu nháp";
      base.input = "Toàn bộ form gửi bằng POST (tên ô không có dấu ngoặc vuông)";
      if (action.branch === "validation") {
        base.status = "error";
        base.output = "Kiểm tra chưa đạt: " + V.firstError(draft.errors);
        base.nextWhy = "Máy chủ điền lại form và trả về cùng trang. Chương trình ghi dữ liệu không được gọi.";
      } else {
        base.output = "Không còn lỗi. Gán trạng thái phiếu là bản nháp (BAN_NHAP).";
        base.nextWhy = "Gọi GoodsReceiptDAO.createDraft để ghi phiếu vào cơ sở dữ liệu.";
      }
      return base;
    }

    if (layerId === "dao") {
      base.hasSql = sent && type !== "cancel" ? type !== "save-draft" || action.branch !== "validation" : type === "cancel";
      if (!sent) {
        base.method = "Chưa được gọi";
        base.input = "—";
        base.output = "—";
        base.nextWhy = "Chưa có yêu cầu HTTP thì chưa có câu lệnh đọc hoặc ghi cơ sở dữ liệu.";
        return base;
      }
      if (type === "po-change") {
        base.file = "PurchaseOrderDAO.java";
        base.method = "findReceivable, findById, findItems (chỉ đọc)";
        base.hasSql = true;
        base.input = "Mã đơn đặt hàng = " + form.purchaseOrderId;
        base.output = "Đơn đặt hàng và từng dòng hàng (số đặt, số đã nhận, số còn lại). Chỉ đọc, không sửa.";
        base.nextWhy = "GoodsReceiptServlet gắn dữ liệu vào trang rồi trả form về trình duyệt.";
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
        base.method = "findAll (chỉ đọc danh sách)";
        base.hasSql = true;
        base.dbChanged = false;
        base.input = "Bộ lọc từ khóa hoặc trạng thái, nếu có";
        base.output = "Danh sách phiếu đang có. Không thêm phiếu mới.";
        return base;
      }
      if (action.branch === "validation") {
        base.method = "createDraft không được gọi";
        base.hasSql = false;
        base.output = "Không ghi gì";
        base.nextWhy = "Hàm kiểm tra validateReceipt còn lỗi nên dừng trước khi ghi.";
        return base;
      }
      base.file = "GoodsReceiptDAO.java";
      base.method = "createDraft (ghi phiếu bản nháp)";
      base.hasSql = true;
      base.input = "Phiếu nhập và danh sách dòng hàng";
      if (action.branch === "dbError") {
        base.status = "error";
        base.output = "Ghi thất bại, hủy thay đổi, trả về -1";
        base.dbChanged = false;
      } else {
        base.output = "Mã phiếu mới (demo). Cột lô tồn kho trên dòng hàng để trống.";
        base.dbChanged = true;
      }
      return base;
    }

    if (layerId === "db") {
      var nGr = (sim.goodsReceipts || []).length;
      if (!sent) {
        base.output = "Chưa thay đổi. Số phiếu demo đang có: " + nGr;
        return base;
      }
      if (type === "po-change" || type === "zone" || type === "rack" || type === "cancel") {
        base.hasSql = true;
        base.dbChanged = false;
        base.output = "Chỉ đọc. Số thuốc trên kệ và số lượng đã nhận trên đơn đặt hàng không đổi.";
        return base;
      }
      if (action.branch === "validation" || action.branch === "dbError") {
        base.dbChanged = false;
        base.output =
          "Không xác nhận lưu. Bảng phiếu nhập không thêm dòng. Số thuốc trên kệ, vị trí lô, số lượng đã nhận trên đơn đặt hàng, và sổ xuất-nhập kho đều không đổi.";
        return base;
      }
      base.hasSql = true;
      base.dbChanged = true;
      base.output =
        "Sau khi lưu: thêm 1 phiếu bản nháp vào bảng goods_receipts; thêm " +
        (form.items || []).length +
        " dòng hàng vào bảng goods_receipt_items. Số thuốc trên kệ không tăng. Số lượng đã nhận trên đơn đặt hàng không tăng. Không có dòng sổ nhập kho.";
      return base;
    }

    if (layerId === "httpRes") {
      if (!sent) {
        base.output = "Máy chủ chưa trả gì vì chưa có yêu cầu.";
        return base;
      }
      if (type === "po-change") {
        base.method = "Trả lại trang form";
        base.output = "HTML form với sản phẩm của đơn vừa chọn, cùng địa chỉ GET, không chuyển trang.";
        return base;
      }
      if (type === "zone" || type === "rack") {
        base.method = "Trả dữ liệu JSON";
        base.output = "Danh sách kệ hoặc ngăn. JavaScript đổ vào ô chọn, không vẽ lại cả trang.";
        return base;
      }
      if (type === "cancel") {
        base.method = "Trả về trang danh sách";
        base.output = "Danh sách phiếu. Không có thông báo đã lưu nháp.";
        return base;
      }
      if (action.branch === "validation" || action.branch === "dbError") {
        base.method = "Trả lại form, không chuyển trang";
        base.output = "Cùng yêu cầu POST; trang hiện danh sách lỗi. Địa chỉ có thể vẫn là ?action=create.";
        return base;
      }
      base.method = "Chuyển trang rồi xin danh sách bằng GET";
      base.output = "Trình duyệt mở /inventory/receipts?ok=created. handleList hiện thông báo: «Đã lưu nháp phiếu nhập — chưa có gì vào kho.»";
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
