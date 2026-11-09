/**
 * Trace Flow — POST ?action=create (Lưu nháp).
 * Bước và code đối chiếu GoodsReceiptServlet / GoodsReceiptDAO (phân tích tĩnh).
 */
window.SFE_TRACE_SAVE_DRAFT = {
  id: "save-draft",
  title: "Lưu nháp phiếu nhập",
  githubBase:
    "https://github.com/longv0208/Pharma_Flow/blob/main/",
  branches: {
    success: { label: "Success", color: "ok" },
    validation: { label: "Validation Error", color: "err" },
    dbError: { label: "Database Error", color: "err" }
  },
  validationScenarios: [
    {
      id: "no-po",
      label: "Chưa chọn PO",
      errorKey: "purchaseOrderId",
      message: "Please choose a purchase order."
    },
    {
      id: "po-closed",
      label: "PO không còn nhận hàng",
      errorKey: "purchaseOrderId",
      message: "This purchase order is not open for receiving."
    },
    {
      id: "bad-date",
      label: "Ngày nhận không hợp lệ",
      errorKey: "receiptDate",
      message: "Receipt date cannot be in the future. / required"
    },
    {
      id: "no-items",
      label: "Không có dòng sản phẩm",
      errorKey: "items",
      message: "Add at least one received batch line."
    },
    {
      id: "batch-missing",
      label: "Thiếu số lô / hạn dùng",
      errorKey: "items",
      message: "Batch number / Expiry date is required on every line."
    },
    {
      id: "bad-qty",
      label: "Số lượng không hợp lệ",
      errorKey: "items",
      message: "Quantity must be greater than 0."
    },
    {
      id: "bad-cost",
      label: "Giá nhập âm",
      errorKey: "items",
      message: "Cost price must be 0 or greater."
    },
    {
      id: "overdelivered",
      label: "Vượt phần còn lại của PO",
      errorKey: "items",
      message: "Accepted quantity exceeds the remaining quantity on the purchase order."
    }
  ],

  /**
   * steps: mỗi bước có id, title, component, file, method, lines, code, explain,
   * vars (fn hoặc object), io, nextWhy, branchEnds (optional)
   */
  steps: [
    {
      id: "click",
      title: "1. Người dùng nhấn Lưu nháp",
      component: "UI / JSP",
      file: "web/WEB-INF/views/admin/goods-receipt-form.jsp",
      method: "(submit button)",
      lines: "281",
      code:
        '<button type="submit" name="submitAction" value="draft"\n' +
        '        class="btn btn-secondary">Lưu nháp</button>',
      explain:
        "Bạn bấm nút Lưu nháp trên form. Đây mới chỉ là thao tác trên màn hình. Trình duyệt chưa gửi gì tới máy chủ cho đến khi nó gom các ô có tên rồi tạo yêu cầu HTTP.",
      io: { in: "Click chuột / Enter trên form", out: "Sự kiện gửi form" },
      nextWhy: "Bước tiếp theo: trình duyệt gom mọi ô có tên và tạo yêu cầu gửi lên máy chủ."
    },
    {
      id: "http-post",
      title: "2. Browser tạo POST request",
      component: "HTTP",
      file: "goods-receipt-form.jsp",
      method: "form method=post",
      lines: "105–107",
      code:
        '<form method="post" id="grForm"\n' +
        '      action="${ctx}/inventory/receipts?action=create">',
      explain:
        "Phương thức POST được dùng vì bạn đang tạo phiếu mới. Tham số action=create nằm trên đường dẫn. Nội dung gửi đi gồm các ô: đơn đặt hàng, ngày nhận, mã dòng đơn, số lô, và các ô khác. Nhiều dòng hàng dùng cùng một tên ô, lặp lại — trong HTML không có dấu ngoặc vuông.",
      dynamicHttp: true,
      io: { in: "Giá trị form hiện tại", out: "HTTP POST + Cookie JSESSIONID" },
      nextWhy: "Máy chủ Tomcat nhìn địa chỉ /inventory/receipts rồi đưa yêu cầu cho đúng chương trình Servlet đã gắn nhãn @WebServlet."
    },
    {
      id: "mapping",
      title: "3. Servlet URL Mapping",
      component: "Container",
      file: "src/java/controller/GoodsReceiptServlet.java",
      method: "@WebServlet",
      lines: "39–40",
      code:
        '@WebServlet(name = "GoodsReceiptServlet",\n' +
        '            urlPatterns = {"/inventory/receipts"})\n' +
        "public class GoodsReceiptServlet extends HttpServlet {",
      explain:
        "Mọi yêu cầu tới địa chỉ /inventory/receipts (sau tên ứng dụng) đều vào chương trình GoodsReceiptServlet. Không đi qua MainController.",
      vars: { urlPattern: "/inventory/receipts", contextPath: "/Pharma_Flow [DEMO]" },
      io: { in: "POST /Pharma_Flow/inventory/receipts?action=create", out: "Instance servlet" },
      nextWhy: "Vì phương thức là POST, máy chủ gọi hàm doPost của GoodsReceiptServlet."
    },
    {
      id: "dopost",
      title: "4. doPost() được gọi",
      component: "Servlet",
      file: "GoodsReceiptServlet.java",
      method: "doPost",
      lines: "76–86",
      code:
        "@Override\n" +
        "protected void doPost(HttpServletRequest req, HttpServletResponse resp)\n" +
        "        throws ServletException, IOException {\n" +
        "    User user = requireReceiver(req, resp);\n" +
        "    if (user == null) return;\n" +
        "    String action = req.getParameter(\"action\");\n" +
        "    ...\n" +
        "}",
      explain:
        "Yêu cầu POST không đi vào hàm doGet. Việc đầu tiên luôn là kiểm tra người dùng đã đăng nhập và có quyền nhận hàng hay chưa.",
      io: { in: "HttpServletRequest / Response", out: "Gọi requireReceiver" },
      nextWhy: "Chưa biết người dùng hợp lệ thì chưa được xử lý thao tác lưu phiếu."
    },
    {
      id: "auth",
      title: "5. Kiểm tra session & role",
      component: "Servlet / Session",
      file: "GoodsReceiptServlet.java",
      method: "requireReceiver",
      lines: "597–612",
      code:
        "HttpSession session = req.getSession(false);\n" +
        "Object u = session != null ? session.getAttribute(\"currentUser\") : null;\n" +
        "if (u instanceof User) {\n" +
        "    String role = ((User) u).getRoleName();\n" +
        "    if (\"CHU_QUAN_QUAN_TRI\".equals(role) || \"NHAN_VIEN\".equals(role))\n" +
        "        return (User) u;\n" +
        "}\n" +
        "resp.sendRedirect(... + \"/authen?action=login\");",
      explain:
        "Chỉ chủ quán / quản trị hoặc nhân viên mới được nhập kho. Thông tin người dùng nằm trong phiên đăng nhập, thuộc tính currentUser. Bài học này giả sử bạn đã đăng nhập với vai trò nhân viên.",
      vars: {
        "session.currentUser": "User#[DEMO]",
        roleName: "NHAN_VIEN",
        result: "user object (không null)"
      },
      scopes: {
        session: { currentUser: "User demo — NHAN_VIEN" },
        request: { action: "create" }
      },
      io: { in: "Cookie JSESSIONID → session", out: "User hợp lệ" },
      nextWhy: "Đã có người dùng hợp lệ, nên chương trình đọc tham số action để biết bạn muốn làm gì."
    },
    {
      id: "action-switch",
      title: "6. Đọc action=create",
      component: "Servlet",
      file: "GoodsReceiptServlet.java",
      method: "doPost switch",
      lines: "82–90",
      code:
        'String action = req.getParameter("action");\n' +
        "switch (action) {\n" +
        '    case "create":\n' +
        "        handleCreate(req, resp, user);\n" +
        "        break;\n" +
        "    ...\n" +
        "}",
      explain:
        "Tham số action=create trên đường dẫn chọn nhánh tạo phiếu mới, hàm handleCreate. Các nhánh cập nhật, xác nhận, hủy phiếu là chuyện khác — không chạy ở đây.",
      vars: { action: "create", branch: 'case "create"' },
      io: { in: 'getParameter("action")', out: "handleCreate(...)" },
      nextWhy: "Bước tiếp theo là logic lưu phiếu mới."
    },
    {
      id: "handle-create",
      title: "7. handleCreate()",
      component: "Servlet",
      file: "GoodsReceiptServlet.java",
      method: "handleCreate",
      lines: "192–196",
      code:
        "private void handleCreate(...) {\n" +
        "    GoodsReceipt receipt = readReceiptForm(req);\n" +
        "    List<GoodsReceiptItem> items = readItemsForm(req);\n" +
        "    Map<String, String> errors = validateReceipt(receipt, items, false);\n" +
        "    ...\n" +
        "}",
      explain:
        "Hàm handleCreate đọc phần đầu phiếu và từng dòng hàng, rồi gọi validateReceipt ở chế độ lưu nháp (strict = false). Chế độ này vẫn cho phép dòng Chờ kiểm tra.",
      io: { in: "request + user", out: "Gọi readReceiptForm / readItemsForm" },
      nextWhy: "Cần đọc xong dữ liệu form thành đối tượng phiếu trước khi kiểm tra."
    },
    {
      id: "read-receipt",
      title: "8. readReceiptForm()",
      component: "Servlet",
      file: "GoodsReceiptServlet.java",
      method: "readReceiptForm",
      lines: "361–368",
      code:
        "r.setPurchaseOrderId(parseIdOrNull(req.getParameter(\"purchaseOrderId\")));\n" +
        "r.setReceiptDate(parseDate(req.getParameter(\"receiptDate\")));\n" +
        "r.setInvoiceNumber(trim(req.getParameter(\"invoiceNumber\")));\n" +
        "r.setNote(trim(req.getParameter(\"note\")));",
      explain: "Hàm này chỉ đọc phần đầu phiếu: đơn đặt hàng, ngày nhận, số hóa đơn, ghi chú. Nhà cung cấp sẽ được lấy từ đơn đặt hàng lúc kiểm tra, không đọc từ form.",
      dynamicVars: "receipt",
      io: { in: "request parameters", out: "GoodsReceipt (chưa status)" },
      nextWhy: "Tiếp tục đọc các dòng hàng. Nhiều dòng dùng cùng tên ô, máy chủ đọc thành mảng."
    },
    {
      id: "read-items",
      title: "9. readItemsForm()",
      component: "Servlet",
      file: "GoodsReceiptServlet.java",
      method: "readItemsForm",
      lines: "376–418",
      code:
        'String[] poItemIds = req.getParameterValues("poItemId");\n' +
        'String[] batchNumbers = req.getParameterValues("batchNumber");\n' +
        "// expiryDate[], quantity[], costPrice[], inspectionResult[], ...\n" +
        "for (int i = 0; i < poItemIds.length; i++) {\n" +
        "    if (parseId(poItemIds[i]) <= 0) continue; // dòng trống\n" +
        "    ...\n" +
        "}",
      explain:
        "Trên HTML, nhiều dòng hàng dùng cùng tên ô (poItemId, quantity, …). Chương trình Servlet lấy chúng thành các mảng song song. Trong mã HTML không có tên poItemId[] với dấu ngoặc vuông.",
      dynamicVars: "items",
      io: { in: "parameter arrays", out: "List<GoodsReceiptItem>" },
      nextWhy: "Bước kiểm tra trên máy chủ mới là kết luận cuối. Kiểm tra trên trình duyệt chỉ là hỗ trợ."
    },
    {
      id: "validate",
      title: "10. validateReceipt(..., false)",
      component: "Servlet",
      file: "GoodsReceiptServlet.java",
      method: "validateReceipt",
      lines: "429–589",
      code:
        "Map<String, String> errors = validateReceipt(receipt, items, false);\n" +
        "if (!errors.isEmpty()) {\n" +
        "    repopulateForm(req, resp, \"create\", receipt, items, errors);\n" +
        "    return;\n" +
        "}",
      explain:
        "Chế độ lưu nháp (strict = false) vẫn cho phép Chờ kiểm tra. Máy chủ kiểm tra đơn đặt hàng còn mở, ngày nhận, từng dòng hàng, số lô, số lượng, giá, và không cho nhận quá số còn lại trên đơn. Đây là kiểm tra trên máy chủ — khác với thuộc tính bắt buộc trên HTML hay JavaScript trên trang.",
      branchPoint: true,
      io: { in: "receipt + items + strict=false", out: "errors map (rỗng = OK)" },
      nextWhy: "Nếu không còn lỗi: gán trạng thái bản nháp rồi gọi chương trình ghi dữ liệu. Nếu còn lỗi: trả lại form để bạn sửa."
    },
    {
      id: "create-draft",
      title: "11. GoodsReceiptDAO.createDraft()",
      component: "DAO",
      file: "src/java/dao/GoodsReceiptDAO.java",
      method: "createDraft",
      lines: "249–258",
      code:
        "receipt.setStatus(\"BAN_NHAP\");\n" +
        "receipt.setReceivedBy(user.getUserId());\n" +
        "long receiptId = new GoodsReceiptDAO().createDraft(receipt, items);",
      explain:
        "Hàm ghi phiếu createDraft chỉ chạy khi kiểm tra đã đạt. Trạng thái phiếu được gán là bản nháp (BAN_NHAP). Đây chưa phải bước Xác nhận nhập kho.",
      skipOn: ["validation"],
      io: { in: "GoodsReceipt + items", out: "receiptId > 0 hoặc ≤0" },
      nextWhy: "Chương trình ghi dữ liệu mở một lần lưu (transaction) rồi thêm dòng vào bảng."
    },
    {
      id: "jdbc",
      title: "12. JDBC INSERT trong transaction",
      component: "DAO / JDBC",
      file: "GoodsReceiptDAO.java",
      method: "createDraft",
      lines: "250–317",
      code:
        "INSERT INTO goods_receipts\n" +
        "  (supplier_id, purchase_order_id, received_by, receipt_date,\n" +
        "   invoice_number, note, status)\n" +
        "VALUES (?,?,?,?,?,?,'BAN_NHAP');\n\n" +
        "INSERT INTO goods_receipt_items\n" +
        "  (goods_receipt_id, purchase_order_item_id, product_id, batch_id, bin_id,\n" +
        "   batch_number, expiry_date, quantity, cost_price,\n" +
        "   inspection_result, rejection_reason)\n" +
        "VALUES (?,?,?,NULL,?,?,?,?,?,?,?);",
      explain:
        "Lúc lưu nháp, cột lô tồn kho (batch_id) để trống. Không sửa bảng tồn kho. Không tăng số lượng đã nhận trên đơn đặt hàng.",
      skipOn: ["validation"],
      dbPreview: true,
      io: { in: "PreparedStatement binds", out: "Rows staged (chưa commit)" },
      nextWhy: "Sau khi chạy câu lệnh thêm dòng: hoặc xác nhận lưu vĩnh viễn, hoặc hủy hết nếu lỗi."
    },
    {
      id: "commit",
      title: "13. Commit — chưa cộng inventory",
      component: "Database",
      file: "GoodsReceiptDAO.java",
      method: "createDraft",
      lines: "319–324",
      code:
        "conn.commit();\n" +
        "return receiptId;\n" +
        "// catch SQLException → rollback → return -1",
      explain:
        "Nếu thành công: phiếu và dòng hàng đã có trong cơ sở dữ liệu, trạng thái bản nháp. Số thuốc trên kệ, vị trí lô, sổ xuất-nhập kho, số lượng đã nhận trên đơn đặt hàng đều không đổi. Nếu câu lệnh lỗi: hủy thay đổi, mã phiếu trả về -1.",
      skipOn: ["validation"],
      branchPointDb: true,
      dbAfter: true,
      io: { in: "TX open", out: "COMMIT hoặc ROLLBACK" },
      nextWhy: "GoodsReceiptServlet nhận mã phiếu để quyết định chuyển trang hay trả lỗi."
    },
    {
      id: "redirect",
      title: "14. sendRedirect(?ok=created)",
      component: "Servlet",
      file: "GoodsReceiptServlet.java",
      method: "handleCreate",
      lines: "206–212",
      code:
        "if (receiptId <= 0) {\n" +
        "    errors.put(\"form\", \"Could not save...\");\n" +
        "    repopulateForm(...); return;\n" +
        "}\n" +
        "resp.sendRedirect(req.getContextPath() + LIST_URL + \"?ok=created\");",
      explain:
        "Máy chủ bảo trình duyệt mở trang khác (chuyển trang), không trả lại cùng yêu cầu POST. Trình duyệt sẽ gửi một yêu cầu GET mới. Dữ liệu tạm của lần POST không còn.",
      skipOn: ["validation"],
      onlySuccessOrDb: true,
      io: { in: "receiptId", out: "HTTP 302 Location: .../receipts?ok=created" },
      nextWhy: "Trình duyệt làm theo địa chỉ máy chủ vừa gửi và xin trang danh sách."
    },
    {
      id: "get-list",
      title: "15. Browser GET danh sách",
      component: "HTTP",
      file: "(browser)",
      method: "GET",
      lines: "—",
      code: "GET /Pharma_Flow/inventory/receipts?ok=created HTTP/1.1",
      explain: "Đây là yêu cầu mới, không còn nội dung form POST. Tham số ok=created trên đường dẫn dùng để hiện thông báo thành công.",
      skipOn: ["validation", "dbError"],
      io: { in: "302 Location", out: "GET list" },
      nextWhy: "GoodsReceiptServlet.doGet gọi handleList để lấy danh sách phiếu."
    },
    {
      id: "handle-list",
      title: "16. handleList + forward JSP",
      component: "Servlet",
      file: "GoodsReceiptServlet.java",
      method: "handleList",
      lines: "108–115",
      code:
        "req.setAttribute(\"receipts\", dao.findAll(keyword, status));\n" +
        "req.getRequestDispatcher(LIST_JSP).forward(req, resp);",
      explain:
        "Máy chủ đưa dữ liệu vào trang danh sách rồi gửi HTML về. Trình duyệt vẫn đứng ở địa chỉ /inventory/receipts?ok=created. Trang đọc tham số ok và danh sách phiếu.",
      skipOn: ["validation", "dbError"],
      io: { in: "GET", out: "RequestDispatcher → goods-receipt-list.jsp" },
      nextWhy: "Trang JSP vẽ HTML danh sách cho trình duyệt hiện ra."
    },
    {
      id: "jsp-result",
      title: "17. JSP thông báo thành công",
      component: "JSP / UI",
      file: "web/WEB-INF/views/admin/goods-receipt-list.jsp",
      method: "(EL/JSTL)",
      lines: "(param.ok)",
      code:
        '<!-- Nghiệp vụ: "Đã lưu nháp phiếu nhập — chưa có gì vào kho." -->\n' +
        "<c:if test=\"${param.ok == 'created'}\">...</c:if>",
      explain:
        "Bạn thấy trang danh sách và thông báo: đã lưu nháp phiếu nhập — chưa có gì vào kho. Số thuốc trên kệ chưa tăng. Đây đúng giai đoạn lưu nháp trong quy trình nhập kho.",
      skipOn: ["validation", "dbError"],
      resultScreen: true,
      io: { in: "receipts + ok=created", out: "HTML danh sách" },
      nextWhy: "Kết thúc luồng lưu nháp thành công."
    },
    {
      id: "validation-end",
      title: "Kết quả: Validation Error → forward form",
      component: "Servlet",
      file: "GoodsReceiptServlet.java",
      method: "repopulateForm",
      lines: "633–646",
      code:
        "req.setAttribute(\"errors\", errors);\n" +
        "req.setAttribute(\"mode\", \"create\");\n" +
        "req.setAttribute(\"receipt\", receipt);\n" +
        "req.setAttribute(\"items\", items);\n" +
        "req.getRequestDispatcher(FORM_JSP).forward(req, resp);",
      explain:
        "Máy chủ không chuyển trang. Nó trả lại cùng form, kèm danh sách lỗi và dữ liệu bạn vừa gõ để bạn sửa. Địa chỉ có thể vẫn là ?action=create. Cơ sở dữ liệu không thêm phiếu.",
      onlyOn: ["validation"],
      io: { in: "errors map", out: "HTML form với field-error" },
      nextWhy: "Bạn sửa dữ liệu rồi bấm Lưu nháp lần nữa."
    },
    {
      id: "db-end",
      title: "Kết quả: Database Error → forward form",
      component: "Servlet",
      file: "GoodsReceiptServlet.java",
      method: "handleCreate",
      lines: "207–210",
      code:
        "errors.put(\"form\", \"Could not save the receipt. Please try again.\");\n" +
        "repopulateForm(req, resp, \"create\", receipt, items, errors);",
      explain:
        "Hàm ghi phiếu createDraft trả về -1 vì câu lệnh cơ sở dữ liệu lỗi và đã hủy thay đổi. Không có phiếu mới. Form hiện thông báo không lưu được.",
      onlyOn: ["dbError"],
      io: { in: "receiptId <= 0", out: "forward form + errors.form" },
      nextWhy: "Kết thúc nhánh lỗi cơ sở dữ liệu."
    }
  ]
};
