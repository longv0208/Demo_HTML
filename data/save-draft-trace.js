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
        "Người dùng nhấn nút submit trong form #grForm. Đây là thao tác trên giao diện — chưa có HTTP cho đến khi browser serialize form.",
      io: { in: "Click chuột / Enter trên form", out: "Sự kiện submit" },
      nextWhy: "Trình duyệt thu thập các control có name và tạo HTTP request."
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
        "POST vì tạo bản ghi mới. action=create nằm trên query string. Body là application/x-www-form-urlencoded: purchaseOrderId, receiptDate, poItemId, batchNumber, … (cùng tên lặp lại cho nhiều dòng — KHÔNG có [] trong HTML).",
      dynamicHttp: true,
      io: { in: "Giá trị form hiện tại", out: "HTTP POST + Cookie JSESSIONID" },
      nextWhy: "Tomcat khớp URL pattern với @WebServlet."
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
        "Mọi request tới /inventory/receipts (sau context path) vào GoodsReceiptServlet — không đi qua MainController.",
      vars: { urlPattern: "/inventory/receipts", contextPath: "/Pharma_Flow [DEMO]" },
      io: { in: "POST /Pharma_Flow/inventory/receipts?action=create", out: "Instance servlet" },
      nextWhy: "Method HTTP = POST → container gọi doPost()."
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
        "POST không vào doGet(). Đầu tiên luôn kiểm tra quyền người nhận hàng.",
      io: { in: "HttpServletRequest / Response", out: "Gọi requireReceiver" },
      nextWhy: "Chưa biết user hợp lệ thì không xử lý action."
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
        "Chỉ Owner/Admin hoặc Nhân viên được nhập kho. Session attribute: currentUser. [DEMO] giả sử đã đăng nhập NHAN_VIEN.",
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
      nextWhy: "Có user → đọc parameter action."
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
        'Query param action=create chọn nhánh handleCreate. (update/confirm/cancel là nhánh khác — không chạy ở đây.)',
      vars: { action: "create", branch: 'case "create"' },
      io: { in: 'getParameter("action")', out: "handleCreate(...)" },
      nextWhy: "Vào logic lưu phiếu mới."
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
        "Đọc header + dòng hàng, rồi validate với strict=false (cho phép CHO_KIEM_TRA khi lưu nháp).",
      io: { in: "request + user", out: "Gọi readReceiptForm / readItemsForm" },
      nextWhy: "Cần object domain trước khi validate."
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
      explain: "Chỉ đọc parameter header. Supplier sẽ suy từ PO lúc validate.",
      dynamicVars: "receipt",
      io: { in: "request parameters", out: "GoodsReceipt (chưa status)" },
      nextWhy: "Tiếp tục đọc các dòng song song."
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
        "HTML dùng cùng name lặp lại (poItemId, quantity…) — Servlet lấy mảng song song. Không có tên poItemId[] trong markup.",
      dynamicVars: "items",
      io: { in: "parameter arrays", out: "List<GoodsReceiptItem>" },
      nextWhy: "Validation authoritative ở server."
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
        "strict=false: vẫn cho CHO_KIEM_TRA. Kiểm tra PO mở nhận, ngày, dòng, lô, SL, giá, over-delivery… Đây là validation SERVER — khác HTML required/JS.",
      branchPoint: true,
      io: { in: "receipt + items + strict=false", out: "errors map (rỗng = OK)" },
      nextWhy: "errors rỗng → gán BAN_NHAP và gọi DAO; có lỗi → forward form."
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
        "Chỉ chạy khi validation OK. status=BAN_NHAP — chưa phải xác nhận nhập kho.",
      skipOn: ["validation"],
      io: { in: "GoodsReceipt + items", out: "receiptId > 0 hoặc ≤0" },
      nextWhy: "DAO mở JDBC transaction và INSERT."
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
        "batch_id = NULL lúc nháp. Không UPDATE inventory_* / purchase_order_items.received_quantity.",
      skipOn: ["validation"],
      dbPreview: true,
      io: { in: "PreparedStatement binds", out: "Rows staged (chưa commit)" },
      nextWhy: "executeUpdate xong → commit hoặc rollback."
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
        "Thành công: GR + items tồn tại với BAN_NHAP. inventory_batches / locations / movements / PO received KHÔNG đổi. Lỗi SQL → rollback, receiptId=-1.",
      skipOn: ["validation"],
      branchPointDb: true,
      dbAfter: true,
      io: { in: "TX open", out: "COMMIT hoặc ROLLBACK" },
      nextWhy: "Controller nhận receiptId."
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
        "PRG: Post/Redirect/Get. sendRedirect ≠ forward — browser tạo request GET mới; request attribute của POST bị mất.",
      skipOn: ["validation"],
      onlySuccessOrDb: true,
      io: { in: "receiptId", out: "HTTP 302 Location: .../receipts?ok=created" },
      nextWhy: "Browser theo Location."
    },
    {
      id: "get-list",
      title: "15. Browser GET danh sách",
      component: "HTTP",
      file: "(browser)",
      method: "GET",
      lines: "—",
      code: "GET /Pharma_Flow/inventory/receipts?ok=created HTTP/1.1",
      explain: "Request mới, không còn body POST. ok=created là flash qua query.",
      skipOn: ["validation", "dbError"],
      io: { in: "302 Location", out: "GET list" },
      nextWhy: "doGet → handleList."
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
        "forward giữ cùng request GET — JSP đọc param.ok và attribute receipts. URL trình duyệt vẫn /inventory/receipts?ok=created.",
      skipOn: ["validation", "dbError"],
      io: { in: "GET", out: "RequestDispatcher → goods-receipt-list.jsp" },
      nextWhy: "JSP render HTML."
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
        "Người dùng thấy danh sách + thông báo lưu nháp. Kho chưa tăng — đúng giai đoạn D đặc tả nghiệp vụ.",
      skipOn: ["validation", "dbError"],
      resultScreen: true,
      io: { in: "receipts + ok=created", out: "HTML danh sách" },
      nextWhy: "Kết thúc luồng Success."
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
        "Không redirect. forward giữ POST request + attribute errors/items để JSP hiện lỗi và giữ input. URL có thể vẫn là ?action=create. Không ghi DB.",
      onlyOn: ["validation"],
      io: { in: "errors map", out: "HTML form với field-error" },
      nextWhy: "Người dùng sửa và submit lại."
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
        "createDraft trả -1 (SQLException đã rollback). Không có GR mới. Thông báo lỗi form.",
      onlyOn: ["dbError"],
      io: { in: "receiptId <= 0", out: "forward form + errors.form" },
      nextWhy: "Kết thúc nhánh lỗi DB."
    }
  ]
};
