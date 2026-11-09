/**
 * Field + layer map — đối chiếu goods-receipt-form.jsp + GoodsReceiptServlet
 * (validateReceipt strict=false lúc Lưu nháp) + GoodsReceiptDAO.createDraft.
 */
window.SFE_FIELD_GUIDE = {
  /** Thứ tự hướng dẫn trên form JSP đầy đủ (không tách trang). */
  tourOrder: [
    "purchaseOrderId",
    "supplierName",
    "receiptDate",
    "invoiceNumber",
    "note",
    "poItemId",
    "batchNumber",
    "expiryDate",
    "quantity",
    "costPrice",
    "zoneRack",
    "binId",
    "inspectionResult",
    "rejectionReason",
    "saveDraft"
  ],

  layers: [
    {
      id: "ui",
      label: "Màn hình / JSP",
      color: "ui",
      hint: "Người dùng điền trên HTML render từ JSP"
    },
    {
      id: "http",
      label: "HTTP",
      color: "http",
      hint: "GET reload PO hoặc POST body lúc Lưu nháp"
    },
    {
      id: "servlet",
      label: "Servlet",
      color: "ctrl",
      hint: "GoodsReceiptServlet đọc param + validateReceipt"
    },
    {
      id: "dao",
      label: "DAO / SQL",
      color: "dao",
      hint: "Chỉ chạy khi Lưu nháp — createDraft"
    },
    {
      id: "db",
      label: "Bảng DB",
      color: "ok",
      hint: "goods_receipts + items BAN_NHAP — chưa cộng kho"
    }
  ],

  steps: [
    {
      id: "po",
      n: 1,
      title: "Chọn đơn đặt hàng",
      subtitle: "PO mở nhận hàng — Supplier tự điền, không chọn tự do.",
      activeLayers: ["ui", "http", "servlet"],
      layerNote: "Đổi PO trên form create là GET reload. Ghi DB chỉ xảy ra ở bước Lưu nháp.",
      fields: ["purchaseOrderId", "supplierName"]
    },
    {
      id: "header",
      n: 2,
      title: "Thông tin phiếu",
      subtitle: "Ngày nhận bắt buộc; hóa đơn và ghi chú tùy chọn.",
      activeLayers: ["ui", "http", "servlet"],
      layerNote: "Các field này vào POST body khi Lưu nháp. Servlet đọc trong readReceiptForm().",
      fields: ["receiptDate", "invoiceNumber", "note"]
    },
    {
      id: "lines",
      n: 3,
      title: "Dòng hàng & kiểm tra",
      subtitle: "Mỗi lô một dòng. Nháp cho phép CHO_KIEM_TRA.",
      activeLayers: ["ui", "http", "servlet"],
      layerNote: "Cùng name lặp lại (poItemId, quantity…) — Servlet dùng getParameterValues. Zone/Rack không POST.",
      fields: [
        "poItemId",
        "batchNumber",
        "expiryDate",
        "quantity",
        "costPrice",
        "zoneRack",
        "binId",
        "inspectionResult",
        "rejectionReason"
      ]
    },
    {
      id: "save",
      n: 4,
      title: "Lưu nháp",
      subtitle: "POST ?action=create → BAN_NHAP. Kho chưa đổi.",
      activeLayers: ["ui", "http", "servlet", "dao", "db"],
      layerNote: "Toàn bộ đường đi: nút → POST → doPost → handleCreate → validateReceipt(false) → createDraft → redirect.",
      fields: ["saveDraft"]
    }
  ],

  fields: {
    purchaseOrderId: {
      name: "purchaseOrderId",
      label: "Đơn đặt hàng",
      business:
        "Chỉ PO DA_DAT_HANG hoặc DA_NHAN_MOT_PHAN. findReceivable() lọc danh sách. Đổi PO reload GET để nạp sản phẩm.",
      param: "purchaseOrderId (POST) · po (query khi đổi)",
      client: "HTML required trên <select>",
      server:
        "validateReceipt: bắt buộc; PO tồn tại; status mở nhận. Authoritative ở server.",
      stopsAt: "servlet",
      dbOnSave: "goods_receipts.purchase_order_id",
      httpWhenChange:
        "GET /inventory/receipts?action=new&po={id}&receiptDate=…",
      code: {
        ui: '<select name="purchaseOrderId" required>',
        http: "GET ?action=new&po=12   (đổi PO)\nPOST body purchaseOrderId=12  (lúc lưu)",
        servlet:
          'r.setPurchaseOrderId(parseIdOrNull(req.getParameter("purchaseOrderId")));\n// validate: DA_DAT_HANG || DA_NHAN_MOT_PHAN',
        dao: "Chưa INSERT — đợi createDraft khi Lưu nháp",
        db: "Cột purchase_order_id lúc Lưu nháp"
      },
      file: "GoodsReceiptServlet.java :361, 436–448"
    },
    supplierName: {
      name: "(không gửi)",
      label: "Nhà cung cấp",
      business:
        "Không chọn tự do. Hiển thị tên từ PO đã chọn. Servlet gán supplierId từ PO.",
      param: "Không có input name supplier — không nằm trong POST",
      client: "readonly",
      server: "receipt.setSupplierId(po.getSupplierId()) trong validateReceipt",
      stopsAt: "servlet",
      dbOnSave: "goods_receipts.supplier_id (từ PO, không từ form)",
      code: {
        ui: '<input id="supplierName" readonly>',
        http: "Không có parameter supplier",
        servlet: "if (po != null) receipt.setSupplierId(po.getSupplierId());",
        dao: "psReceipt.setLong(1, receipt.getSupplierId());",
        db: "supplier_id"
      },
      file: "GoodsReceiptServlet.java :451–453"
    },
    receiptDate: {
      name: "receiptDate",
      label: "Ngày nhận",
      business: "Ngày hàng thực nhận. Không được ở tương lai.",
      param: "receiptDate (yyyy-MM-dd)",
      client: "input type=date required",
      server:
        "Bắt buộc; parseDate; nếu after(today) → errors.receiptDate. Server là chuẩn.",
      stopsAt: "servlet",
      dbOnSave: "goods_receipts.receipt_date",
      code: {
        ui: '<input type="date" name="receiptDate" required>',
        http: "receiptDate=2026-11-09",
        servlet:
          'r.setReceiptDate(parseDate(req.getParameter("receiptDate")));\n// not null; not after today',
        dao: "psReceipt.setDate(4, receipt.getReceiptDate());",
        db: "receipt_date"
      },
      file: "GoodsReceiptServlet.java :455–462"
    },
    invoiceNumber: {
      name: "invoiceNumber",
      label: "Số hóa đơn",
      business: "Tham chiếu hóa đơn NCC — không bắt buộc.",
      param: "invoiceNumber",
      client: "maxlength=100",
      server: "trim; không bắt buộc",
      stopsAt: "servlet",
      dbOnSave: "goods_receipts.invoice_number",
      code: {
        ui: '<input name="invoiceNumber" maxlength="100">',
        http: "invoiceNumber=HD-DEMO-001",
        servlet: 'r.setInvoiceNumber(trim(req.getParameter("invoiceNumber")));',
        dao: "psReceipt.setString(5, receipt.getInvoiceNumber());",
        db: "invoice_number"
      },
      file: "GoodsReceiptServlet.java :365"
    },
    note: {
      name: "note",
      label: "Ghi chú",
      business: "Ghi chú tùy chọn trên phiếu.",
      param: "note",
      client: "maxlength=500",
      server: "trim; không bắt buộc",
      stopsAt: "servlet",
      dbOnSave: "goods_receipts.note",
      code: {
        ui: '<textarea name="note" maxlength="500">',
        http: "note=...",
        servlet: 'r.setNote(trim(req.getParameter("note")));',
        dao: "psReceipt.setString(6, receipt.getNote());",
        db: "note"
      },
      file: "GoodsReceiptServlet.java :366"
    },
    poItemId: {
      name: "poItemId",
      label: "Sản phẩm (PO item)",
      business:
        "Phải thuộc PO đã chọn. product_id lấy từ PO, không tin form. Cùng SP nhiều lô → nhiều dòng.",
      param: "poItemId (lặp — getParameterValues)",
      client: "select required",
      server: "poItem phải có trong PO; không thì errors.items",
      stopsAt: "servlet",
      dbOnSave: "goods_receipt_items.purchase_order_item_id + product_id",
      code: {
        ui: '<select name="poItemId" required>',
        http: "poItemId=101&poItemId=102",
        servlet:
          'String[] poItemIds = req.getParameterValues("poItemId");\nitem.setProductId(poItem.getProductId());',
        dao: "psItem.setLong(2, item.getPurchaseOrderItemId());",
        db: "purchase_order_item_id, product_id"
      },
      file: "GoodsReceiptServlet.java :376–398, 492–498"
    },
    batchNumber: {
      name: "batchNumber",
      label: "Số lô",
      business: "Số lô trên bao bì — bắt buộc mọi dòng kể cả nháp.",
      param: "batchNumber (lặp)",
      client: "required maxlength=100",
      server: "rỗng → errors.items Batch number is required",
      stopsAt: "servlet",
      dbOnSave: "goods_receipt_items.batch_number",
      code: {
        ui: '<input name="batchNumber" required>',
        http: "batchNumber=LOT-A01",
        servlet: "if (batch empty) batchMissing = true;",
        dao: "psItem.setString(5, item.getBatchNumber());",
        db: "batch_number"
      },
      file: "GoodsReceiptServlet.java :500–502"
    },
    expiryDate: {
      name: "expiryDate",
      label: "Hạn dùng",
      business:
        "Bắt buộc. Nếu CHAP_NHAN mà hạn ≤ ngày nhận → không cho chấp nhận (phải TU_CHOI).",
      param: "expiryDate (lặp)",
      client: "type=date required",
      server: "bắt buộc; expired+CHAP_NHAN → lỗi",
      stopsAt: "servlet",
      dbOnSave: "goods_receipt_items.expiry_date",
      code: {
        ui: '<input type="date" name="expiryDate" required>',
        http: "expiryDate=2027-06-30",
        servlet: "expiryMissing / expired+CHAP_NHAN",
        dao: "psItem.setDate(6, item.getExpiryDate());",
        db: "expiry_date"
      },
      file: "GoodsReceiptServlet.java :503–508"
    },
    quantity: {
      name: "quantity",
      label: "Số lượng (SL)",
      business:
        "SL trên dòng kiểm tra. Tổng CHAP_NHAN theo PO item không vượt phần còn lại.",
      param: "quantity (lặp)",
      client: "type=number min=1 required",
      server: "phải > 0; overdelivery nếu accepted > remaining",
      stopsAt: "servlet",
      dbOnSave: "goods_receipt_items.quantity",
      code: {
        ui: '<input type="number" name="quantity" min="1" required>',
        http: "quantity=40",
        servlet: "qty <= 0 → badQty; accepted sum vs remaining",
        dao: "psItem.setInt(7, item.getQuantity());",
        db: "quantity"
      },
      file: "GoodsReceiptServlet.java :510–511, 547–557"
    },
    costPrice: {
      name: "costPrice",
      label: "Giá nhập",
      business: "Giá/đơn vị. Form gợi ý unitCost từ PO khi chọn sản phẩm.",
      param: "costPrice (lặp)",
      client: "min=0 required",
      server: "null hoặc < 0 → errors.items",
      stopsAt: "servlet",
      dbOnSave: "goods_receipt_items.cost_price",
      code: {
        ui: '<input type="number" name="costPrice" min="0" required>',
        http: "costPrice=15000",
        servlet: "costPrice.signum() < 0 → badCost",
        dao: "psItem.setBigDecimal(8, item.getCostPrice());",
        db: "cost_price"
      },
      file: "GoodsReceiptServlet.java :513–515"
    },
    zoneRack: {
      name: "(không POST)",
      label: "Khu / Kệ",
      business:
        "UI phụ thuộc: chọn Zone tải Rack, chọn Rack tải Bin. Backend không nhận zoneId/rackId.",
      param: "Không — chỉ JS cascade",
      client: "select phụ thuộc (demo JSON, gốc: /inventory/locations API)",
      server: "Không đọc zone/rack",
      stopsAt: "ui",
      dbOnSave: "Không lưu zone/rack riêng",
      code: {
        ui: '<select class="gr-zone"> / <select class="gr-rack">',
        http: "Không có zoneId hay rackId trong form POST",
        servlet: "—",
        dao: "—",
        db: "—"
      },
      file: "goods-receipt-form.jsp JS loadRacks/loadBins"
    },
    binId: {
      name: "binId",
      label: "Ngăn (Bin)",
      business:
        "Nơi cất hàng khi dòng là CHAP_NHAN. validateReceipt bắt Bin trên dòng Chấp nhận cả khi Lưu nháp (strict=false). CHO_KIEM_TRA / TU_CHOI được để trống Bin lúc nháp. DAO lúc Xác nhận mới kiểm Bin HOAT_DONG.",
      param: "binId (lặp)",
      client: "JS JSP: bin.required = (inspection === CHAP_NHAN)",
      server:
        "CHAP_NHAN && binId empty → binMissing, kể cả nháp. Không phụ thuộc cờ strict.",
      stopsAt: "servlet",
      dbOnSave: "goods_receipt_items.bin_id (NULL nếu dòng chưa chấp nhận)",
      code: {
        ui: '<select name="binId" class="gr-bin">',
        http: "binId=111",
        servlet:
          'if ("CHAP_NHAN".equals(inspection) && (binId == null || binId <= 0)) binMissing = true;',
        dao: "psItem.setLong(4, bin) hoặc NULL — nháp không kiểm HOAT_DONG",
        db: "bin_id"
      },
      file: "GoodsReceiptServlet.java :412–415, 529–533"
    },
    inspectionResult: {
      name: "inspectionResult",
      label: "Kiểm tra",
      business:
        "CHO_KIEM_TRA được Lưu nháp, không được Xác nhận. Chỉ CHAP_NHAN cộng kho lúc confirm. Một dòng một kết quả.",
      param: "inspectionResult (lặp)",
      client: "3 option; mặc định CHO_KIEM_TRA",
      server: "nháp cho pending; giá trị lạ → badInspection",
      stopsAt: "servlet",
      dbOnSave: "goods_receipt_items.inspection_result",
      code: {
        ui: '<select name="inspectionResult">CHO_KIEM_TRA|CHAP_NHAN|TU_CHOI',
        http: "inspectionResult=CHO_KIEM_TRA",
        servlet: 'empty → "CHO_KIEM_TRA"; strict chặn CHO_KIEM_TRA',
        dao: "psItem.setString(9, item.getInspectionResult());",
        db: "inspection_result"
      },
      file: "GoodsReceiptServlet.java :406–409, 516–523"
    },
    rejectionReason: {
      name: "rejectionReason",
      label: "Lý do từ chối",
      business: "Bắt buộc khi TU_CHOI. Dòng từ chối không cộng tồn lúc xác nhận.",
      param: "rejectionReason (lặp)",
      client: "hiện + required khi TU_CHOI",
      server: "TU_CHOI mà rỗng → errors.items",
      stopsAt: "servlet",
      dbOnSave: "goods_receipt_items.rejection_reason",
      code: {
        ui: '<input name="rejectionReason" hidden trừ khi TU_CHOI>',
        http: "rejectionReason=Vỡ+hộp",
        servlet: "TU_CHOI && reason empty → reasonMissing",
        dao: "psItem.setString(10, item.getRejectionReason());",
        db: "rejection_reason"
      },
      file: "GoodsReceiptServlet.java :524–527"
    },
    saveDraft: {
      name: "submitAction=draft",
      label: "Nút Lưu nháp",
      business:
        "Ghi phiếu BAN_NHAP. Thông báo: «Đã lưu nháp phiếu nhập — chưa có gì vào kho.» Form create không có Xác nhận.",
      param: "action=create (query) + body form + submitAction=draft",
      client: "submit POST; JS disable nút chống double-submit",
      server:
        "doPost → handleCreate → validateReceipt(..., false) → createDraft. Lỗi → forward form. OK → sendRedirect ?ok=created",
      stopsAt: "db",
      dbOnSave:
        "INSERT goods_receipts BAN_NHAP + goods_receipt_items. Không đụng inventory_* / PO received / NHAP_KHO",
      code: {
        ui: '<button type="submit" name="submitAction" value="draft">Lưu nháp</button>',
        http: "POST /inventory/receipts?action=create",
        servlet: "case \"create\": handleCreate(...)",
        dao:
          "INSERT INTO goods_receipts (...) VALUES (?,?,?,?,?,?,'BAN_NHAP');\nINSERT INTO goods_receipt_items (...)",
        db: "GR + items; inventory không đổi"
      },
      file: "GoodsReceiptServlet.java :192–212 · DAO :249–319"
    }
  },

  howTo: {
    purchaseOrderId: "Chọn PO còn DA_DAT_HANG hoặc DA_NHAN_MOT_PHAN. Đổi PO reload GET.",
    supplierName: "Không nhập. Hệ thống điền từ PO.",
    receiptDate: "Ngày hàng thực nhận, không ở tương lai.",
    invoiceNumber: "Tùy chọn — số HĐ nhà cung cấp, tối đa 100 ký tự.",
    note: "Tùy chọn, tối đa 500 ký tự.",
    poItemId: "Chọn sản phẩm thuộc PO. Cùng SP nhiều lô → nhiều dòng.",
    batchNumber: "Số lô trên bao bì — bắt buộc mọi dòng.",
    expiryDate: "Hạn dùng. Nếu chấp nhận, hạn phải sau ngày nhận.",
    quantity: "Số lượng trên dòng kiểm tra, nguyên dương.",
    costPrice: "Giá/đơn vị ≥ 0. Form gợi ý unitCost của PO.",
    zoneRack: "Chọn Khu rồi Kệ để nạp Bin (fetch LocationServlet). Không POST.",
    binId: "Bắt buộc nếu dòng là Chấp nhận — kể cả lúc lưu nháp.",
    inspectionResult: "Nháp cho phép Chờ kiểm tra. Chỉ Chấp nhận sẽ cộng kho lúc xác nhận (ngoài phạm vi bài này).",
    rejectionReason: "Bắt buộc khi Từ chối.",
    saveDraft: "POST create. Thành công → danh sách + «chưa có gì vào kho.»"
  },
  required: {
    purchaseOrderId: true,
    supplierName: false,
    receiptDate: true,
    invoiceNumber: false,
    note: false,
    poItemId: true,
    batchNumber: true,
    expiryDate: true,
    quantity: true,
    costPrice: true,
    zoneRack: false,
    binId: "Khi inspection = CHAP_NHAN",
    inspectionResult: true,
    rejectionReason: "Khi inspection = TU_CHOI",
    saveDraft: true
  },
  inventoryOnDraft: false
};
