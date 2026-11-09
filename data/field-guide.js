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
      label: "Màn hình form",
      color: "ui",
      hint: "Đây là trang web bạn đang điền. Trang được vẽ từ tệp JSP, rồi trình duyệt hiện thành HTML."
    },
    {
      id: "http",
      label: "Gửi yêu cầu HTTP",
      hint: "HTTP là cách trình duyệt nói chuyện với máy chủ: GET để tải trang, POST để gửi phiếu khi Lưu nháp."
    },
    {
      id: "servlet",
      label: "Chương trình Servlet",
      hint: "GoodsReceiptServlet là chương trình Java nhận yêu cầu phiếu nhập, đọc dữ liệu form và kiểm tra."
    },
    {
      id: "dao",
      label: "Chương trình ghi dữ liệu",
      hint: "GoodsReceiptDAO.createDraft chỉ chạy khi Lưu nháp thành công — đây là bước ghi phiếu vào cơ sở dữ liệu."
    },
    {
      id: "db",
      label: "Cơ sở dữ liệu",
      hint: "Hai bảng được thêm dòng: phiếu nhập (goods_receipts) và dòng hàng (goods_receipt_items), trạng thái bản nháp. Số thuốc trên kệ chưa đổi."
    }
  ],

  steps: [
    {
      id: "po",
      n: 1,
      title: "Chọn đơn đặt hàng",
      subtitle: "Chỉ đơn còn đang mở để nhận hàng. Nhà cung cấp được điền sẵn, bạn không chọn tự do.",
      activeLayers: ["ui", "http", "servlet"],
      layerNote: "Khi bạn đổi đơn đặt hàng, trình duyệt gửi yêu cầu GET để tải lại form. Cơ sở dữ liệu chưa ghi phiếu mới — việc ghi chỉ xảy ra khi bấm Lưu nháp.",
      fields: ["purchaseOrderId", "supplierName"]
    },
    {
      id: "header",
      n: 2,
      title: "Thông tin phiếu",
      subtitle: "Ngày nhận hàng bắt buộc. Số hóa đơn và ghi chú có thể để trống.",
      activeLayers: ["ui", "http", "servlet"],
      layerNote: "Các ô này sẽ được gửi kèm khi bạn bấm Lưu nháp. Chương trình GoodsReceiptServlet đọc chúng trong hàm readReceiptForm.",
      fields: ["receiptDate", "invoiceNumber", "note"]
    },
    {
      id: "lines",
      n: 3,
      title: "Dòng hàng và kiểm tra",
      subtitle: "Mỗi số lô một dòng. Lưu nháp vẫn cho phép chọn Chờ kiểm tra.",
      activeLayers: ["ui", "http", "servlet"],
      layerNote: "Nhiều dòng hàng dùng cùng một tên ô (ví dụ quantity lặp lại). Chương trình đọc bằng getParameterValues. Khu và Kệ chỉ dùng trên màn hình, không gửi lên máy chủ.",
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
      subtitle: "Gửi phiếu lên máy chủ. Phiếu được ghi ở trạng thái bản nháp. Số thuốc trên kệ chưa tăng.",
      activeLayers: ["ui", "http", "servlet", "dao", "db"],
      layerNote: "Đường đi đầy đủ: bạn bấm nút → trình duyệt gửi POST → GoodsReceiptServlet.doPost → handleCreate → validateReceipt (chế độ lưu nháp) → GoodsReceiptDAO.createDraft → máy chủ chuyển bạn sang trang danh sách.",
      fields: ["saveDraft"]
    }
  ],

  fields: {
    purchaseOrderId: {
      name: "purchaseOrderId",
      label: "Đơn đặt hàng",
      business:
        "Đây là đơn đặt hàng (purchase order) mà nhà cung cấp đã giao hàng. Hệ thống chỉ cho chọn đơn còn đang mở để nhận: trạng thái Đã đặt hàng (DA_DAT_HANG) hoặc Đã nhận một phần (DA_NHAN_MOT_PHAN). Danh sách đó do chương trình PurchaseOrderDAO, hàm findReceivable, lọc sẵn. Khi bạn đổi đơn, trình duyệt gửi yêu cầu GET để tải lại form với đúng sản phẩm của đơn đó.",
      param: "purchaseOrderId (gửi khi Lưu nháp) · po (trên đường dẫn khi đổi đơn)",
      client: "Ô chọn bắt buộc trên trình duyệt (thuộc tính required của HTML).",
      server:
        "Khi Lưu nháp, hàm validateReceipt kiểm tra lại: phải chọn đơn, đơn phải tồn tại, và đơn còn mở để nhận hàng. Máy chủ mới là kết luận cuối.",
      stopsAt: "servlet",
      dbOnSave: "Cột purchase_order_id trong bảng phiếu nhập goods_receipts",
      httpWhenChange:
        "GET /inventory/receipts?action=new&po={id}&receiptDate=…",
      code: {
        ui: '<select name="purchaseOrderId" required>',
        http: "GET ?action=new&po=12   (đổi đơn đặt hàng)\nPOST body purchaseOrderId=12  (lúc lưu nháp)",
        servlet:
          'r.setPurchaseOrderId(parseIdOrNull(req.getParameter("purchaseOrderId")));\n// validate: DA_DAT_HANG || DA_NHAN_MOT_PHAN',
        dao: "Chưa ghi vào cơ sở dữ liệu — đợi GoodsReceiptDAO.createDraft khi Lưu nháp",
        db: "Cột purchase_order_id lúc Lưu nháp"
      },
      file: "GoodsReceiptServlet.java :361, 436–448"
    },
    supplierName: {
      name: "(không gửi)",
      label: "Nhà cung cấp",
      business:
        "Bạn không chọn nhà cung cấp tự do. Ô này chỉ hiện tên nhà cung cấp gắn với đơn đặt hàng vừa chọn. Khi kiểm tra phiếu, chương trình GoodsReceiptServlet lấy mã nhà cung cấp từ đơn đặt hàng rồi gán vào phiếu (receipt.setSupplierId).",
      param: "Không có tên ô supplier trên form — giá trị này không được gửi khi Lưu nháp",
      client: "Ô chỉ đọc, không gõ được.",
      server: "Trong validateReceipt: nếu tìm được đơn đặt hàng thì lấy supplierId từ đơn đó.",
      stopsAt: "servlet",
      dbOnSave: "Cột supplier_id trong bảng goods_receipts (lấy từ đơn đặt hàng, không lấy từ form)",
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
      business:
        "Đây là ngày hàng thực sự về kho. Không được chọn ngày ở tương lai (sau hôm nay). Máy chủ Java sẽ kiểm tra lại ngày này khi bạn bấm Lưu nháp, dù trình duyệt đã cảnh báo hay chưa.",
      param: "receiptDate (định dạng năm-tháng-ngày, ví dụ 2026-11-09)",
      client: "Ô chọn ngày, bắt buộc trên trình duyệt.",
      server:
        "Hàm validateReceipt bắt buộc phải có ngày; nếu ngày sau hôm nay thì báo lỗi. Kết luận cuối cùng là của máy chủ.",
      stopsAt: "servlet",
      dbOnSave: "Cột receipt_date trong bảng goods_receipts",
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
      business:
        "Đây là số hóa đơn của nhà cung cấp, dùng để đối chiếu giấy tờ. Ô này không bắt buộc: bạn có thể để trống. Tối đa 100 ký tự.",
      param: "invoiceNumber",
      client: "Không bắt buộc, tối đa 100 ký tự.",
      server: "Máy chủ chỉ cắt khoảng trắng thừa. Không bắt buộc phải có số hóa đơn.",
      stopsAt: "servlet",
      dbOnSave: "Cột invoice_number trong bảng goods_receipts",
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
      business:
        "Ghi chú tự do trên phiếu nhập, ví dụ ghi chú giao hàng trễ. Ô này không bắt buộc. Tối đa 500 ký tự.",
      param: "note",
      client: "Không bắt buộc, tối đa 500 ký tự.",
      server: "Máy chủ chỉ cắt khoảng trắng thừa. Không bắt buộc phải có ghi chú.",
      stopsAt: "servlet",
      dbOnSave: "Cột note trong bảng goods_receipts",
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
      label: "Sản phẩm (dòng trên đơn đặt hàng)",
      business:
        "Bạn chọn sản phẩm thuộc đơn đặt hàng đang mở. Mã sản phẩm trong kho được lấy từ đơn đặt hàng, máy chủ không tin giá trị tự gõ trên form. Nếu cùng một sản phẩm có nhiều số lô, hãy thêm nhiều dòng — mỗi lô một dòng.",
      param: "poItemId (lặp lại từng dòng — máy chủ đọc bằng getParameterValues)",
      client: "Ô chọn bắt buộc trên mỗi dòng.",
      server: "Dòng hàng phải thuộc đơn đặt hàng đã chọn. Nếu không, máy chủ báo lỗi trên nhóm dòng hàng (errors.items).",
      stopsAt: "servlet",
      dbOnSave: "Cột purchase_order_item_id và product_id trong bảng goods_receipt_items",
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
      business:
        "Số lô in trên bao bì thuốc. Mọi dòng hàng đều phải có số lô, kể cả khi bạn chỉ lưu nháp và chưa kiểm tra xong. Thiếu số lô thì máy chủ từ chối lưu.",
      param: "batchNumber (lặp lại từng dòng)",
      client: "Bắt buộc, tối đa 100 ký tự.",
      server: "Nếu để trống, máy chủ báo: Batch number is required on every line.",
      stopsAt: "servlet",
      dbOnSave: "Cột batch_number trong bảng goods_receipt_items",
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
        "Ngày hết hạn của lô thuốc, bắt buộc trên mọi dòng. Nếu bạn chọn Chấp nhận mà hạn dùng đã đến hoặc đã qua ngày nhận hàng, máy chủ không cho chấp nhận — phải chuyển sang Từ chối.",
      param: "expiryDate (lặp lại từng dòng)",
      client: "Ô chọn ngày, bắt buộc trên trình duyệt.",
      server: "Phải có hạn dùng. Nếu hết hạn mà vẫn chọn Chấp nhận thì máy chủ báo lỗi.",
      stopsAt: "servlet",
      dbOnSave: "Cột expiry_date trong bảng goods_receipt_items",
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
      label: "Số lượng",
      business:
        "Số lượng trên dòng kiểm tra này, phải là số nguyên lớn hơn 0. Nếu dòng được đánh Chấp nhận, tổng số lượng chấp nhận của cùng một sản phẩm trên đơn không được lớn hơn số lượng còn lại trên đơn đặt hàng.",
      param: "quantity (lặp lại từng dòng)",
      client: "Ô số, tối thiểu 1, bắt buộc.",
      server: "Phải lớn hơn 0. Nếu tổng số lượng Chấp nhận vượt phần còn lại trên đơn thì máy chủ báo lỗi.",
      stopsAt: "servlet",
      dbOnSave: "Cột quantity trong bảng goods_receipt_items",
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
      business:
        "Giá nhập theo từng đơn vị sản phẩm. Không được nhập số âm. Khi bạn chọn sản phẩm, form gợi ý giá theo đơn đặt hàng (unitCost) để bạn khỏi nhớ.",
      param: "costPrice (lặp lại từng dòng)",
      client: "Ô số, tối thiểu 0, bắt buộc.",
      server: "Thiếu giá hoặc giá nhỏ hơn 0 thì máy chủ báo lỗi trên dòng hàng.",
      stopsAt: "servlet",
      dbOnSave: "Cột cost_price trong bảng goods_receipt_items",
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
        "Hai ô này chỉ giúp bạn tìm ngăn chứa hàng cho dễ. Chọn Khu thì tải danh sách Kệ; chọn Kệ thì tải danh sách Ngăn. Máy chủ phiếu nhập không nhận mã khu hay mã kệ — chỉ nhận mã ngăn (binId) khi Lưu nháp.",
      param: "Không gửi lên máy chủ — chỉ JavaScript trên trang gọi LocationServlet",
      client: "Hai ô chọn phụ thuộc nhau. Bản gốc gọi /inventory/locations; bản học này dùng dữ liệu JSON có sẵn.",
      server: "GoodsReceiptServlet không đọc zoneId hay rackId.",
      stopsAt: "ui",
      dbOnSave: "Không lưu riêng cột khu hay kệ trên phiếu nhập",
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
        "Ngăn là chỗ cất hàng trên kệ. Nếu dòng được đánh Chấp nhận, bạn phải chọn ngăn — kể cả khi chỉ Lưu nháp. Hàm validateReceipt kiểm tra điều này luôn, không chờ bước Xác nhận. Dòng Chờ kiểm tra hoặc Từ chối được để trống ngăn lúc nháp. Chương trình ghi dữ liệu lúc Xác nhận sau này mới kiểm tra ngăn còn đang hoạt động (HOAT_DONG).",
      param: "binId (lặp lại từng dòng)",
      client: "JavaScript trên JSP: ô ngăn trở thành bắt buộc khi kết quả kiểm tra là Chấp nhận.",
      server:
        "Nếu kết quả là Chấp nhận mà chưa chọn ngăn, máy chủ báo lỗi. Quy tắc này chạy cả lúc Lưu nháp, không phụ thuộc cờ strict.",
      stopsAt: "servlet",
      dbOnSave: "Cột bin_id trong bảng goods_receipt_items (để trống nếu dòng chưa chấp nhận)",
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
        "Kết quả kiểm tra từng dòng hàng. Có ba lựa chọn: Chờ kiểm tra (CHO_KIEM_TRA), Chấp nhận (CHAP_NHAN), Từ chối (TU_CHOI). Lưu nháp vẫn cho phép Chờ kiểm tra. Chỉ dòng Chấp nhận mới làm tăng số thuốc trên kệ khi có người bấm Xác nhận sau này — bài học này không làm bước đó. Mỗi dòng chỉ có một kết quả.",
      param: "inspectionResult (lặp lại từng dòng)",
      client: "Ba lựa chọn; mặc định là Chờ kiểm tra.",
      server: "Lưu nháp cho phép Chờ kiểm tra. Giá trị lạ thì máy chủ báo lỗi. Bước Xác nhận (strict=true) mới cấm Chờ kiểm tra.",
      stopsAt: "servlet",
      dbOnSave: "Cột inspection_result trong bảng goods_receipt_items",
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
      business:
        "Bắt buộc khi dòng được đánh Từ chối. Dòng từ chối không làm tăng số thuốc trên kệ lúc xác nhận sau này. Nếu chọn Từ chối mà để trống lý do, máy chủ từ chối lưu nháp.",
      param: "rejectionReason (lặp lại từng dòng)",
      client: "Ô hiện ra và bắt buộc khi chọn Từ chối.",
      server: "Nếu kết quả là Từ chối mà lý do trống, máy chủ báo lỗi trên dòng hàng.",
      stopsAt: "servlet",
      dbOnSave: "Cột rejection_reason trong bảng goods_receipt_items",
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
        "Nút này ghi phiếu ở trạng thái bản nháp (BAN_NHAP). Sau khi thành công, trang danh sách hiện thông báo: «Đã lưu nháp phiếu nhập — chưa có gì vào kho.» Form tạo phiếu không có nút Xác nhận: phải lưu nháp trước, xác nhận là bước khác ngoài bài học này.",
      param: "action=create trên đường dẫn, cộng toàn bộ form, cộng submitAction=draft",
      client: "Nút gửi form bằng POST. JavaScript khóa nút để tránh bấm hai lần.",
      server:
        "GoodsReceiptServlet.doPost gọi handleCreate, rồi validateReceipt ở chế độ lưu nháp (strict=false), rồi GoodsReceiptDAO.createDraft. Nếu lỗi thì trả lại form. Nếu ổn thì chuyển sang trang danh sách (?ok=created).",
      stopsAt: "db",
      dbOnSave:
        "Thêm dòng vào bảng phiếu nhập goods_receipts (trạng thái bản nháp) và bảng dòng hàng goods_receipt_items. Không đổi số thuốc trên kệ, không tăng số lượng đã nhận trên đơn đặt hàng, không ghi sổ xuất-nhập kho.",
      code: {
        ui: '<button type="submit" name="submitAction" value="draft">Lưu nháp</button>',
        http: "POST /inventory/receipts?action=create",
        servlet: "case \"create\": handleCreate(...)",
        dao:
          "INSERT INTO goods_receipts (...) VALUES (?,?,?,?,?,?,'BAN_NHAP');\nINSERT INTO goods_receipt_items (...)",
        db: "Phiếu + dòng hàng; tồn kho không đổi"
      },
      file: "GoodsReceiptServlet.java :192–212 · DAO :249–319"
    }
  },

  howTo: {
    purchaseOrderId:
      "Mở danh sách rồi chọn một đơn đặt hàng còn đang nhận hàng (Đã đặt hàng hoặc Đã nhận một phần). Sau khi chọn, trang sẽ tải lại để hiện nhà cung cấp và sản phẩm.",
    supplierName:
      "Bạn không nhập ô này. Hệ thống tự điền tên nhà cung cấp từ đơn đặt hàng đã chọn.",
    receiptDate:
      "Chọn ngày hàng thực sự về kho. Không chọn ngày sau hôm nay.",
    invoiceNumber:
      "Có thể để trống. Nếu điền, ghi số hóa đơn nhà cung cấp, tối đa 100 ký tự.",
    note:
      "Có thể để trống. Nếu điền, ghi chú tự do, tối đa 500 ký tự.",
    poItemId:
      "Chọn sản phẩm thuộc đơn đặt hàng đang mở. Cùng một sản phẩm nhiều số lô thì thêm nhiều dòng.",
    batchNumber:
      "Gõ đúng số lô in trên bao bì. Mọi dòng đều phải có, kể cả khi chỉ lưu nháp.",
    expiryDate:
      "Chọn hạn dùng của lô. Nếu bạn Chấp nhận dòng này, hạn dùng phải sau ngày nhận hàng.",
    quantity:
      "Gõ số lượng trên dòng này, là số nguyên lớn hơn 0.",
    costPrice:
      "Gõ giá nhập mỗi đơn vị, không được âm. Form thường gợi ý sẵn giá trên đơn đặt hàng.",
    zoneRack:
      "Chọn Khu trước, rồi chọn Kệ, để danh sách Ngăn hiện ra. Hai ô này không được gửi lên máy chủ phiếu nhập.",
    binId:
      "Nếu dòng là Chấp nhận thì phải chọn ngăn, kể cả lúc lưu nháp. Dòng Chờ kiểm tra hoặc Từ chối có thể để trống.",
    inspectionResult:
      "Lưu nháp cho phép để Chờ kiểm tra. Chỉ dòng Chấp nhận mới làm tăng tồn kho khi xác nhận sau này (bài này không làm bước đó).",
    rejectionReason:
      "Chỉ hiện khi chọn Từ chối. Lúc đó bắt buộc phải ghi lý do.",
    saveDraft:
      "Bấm nút để gửi toàn bộ form lên máy chủ. Nếu thành công bạn sẽ thấy trang danh sách và thông báo chưa có gì vào kho."
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
    binId: "Bắt buộc khi kết quả kiểm tra là Chấp nhận",
    inspectionResult: true,
    rejectionReason: "Bắt buộc khi kết quả kiểm tra là Từ chối",
    saveDraft: true
  },
  inventoryOnDraft: false
};
