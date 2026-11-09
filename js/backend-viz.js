/**
 * Sequence diagram animation — Browser ↔ Servlet ↔ DAO ↔ MySQL.
 * Một khung, mũi tên chạy lần lượt. Không lật từng màn method.
 */
(function (global) {
  "use strict";

  var ACTORS = [
    { id: "browser", label: "Trình duyệt", sub: "Màn hình bạn đang điền" },
    { id: "servlet", label: "GoodsReceiptServlet", sub: "Điều khiển phiếu nhập" },
    { id: "dao", label: "DAO", sub: "Chưa được gọi" },
    { id: "mysql", label: "MySQL", sub: "Nơi lưu dữ liệu" }
  ];

  function actorsOf(kind) {
    var browser = { id: "browser", label: "Trình duyệt", sub: "Màn hình bạn đang điền" };
    var mysql = { id: "mysql", label: "MySQL", sub: "Nơi lưu dữ liệu" };
    if (kind === "location") {
      return [
        browser,
        { id: "servlet", label: "LocationServlet", sub: "Điều khiển khu / kệ / ngăn" },
        { id: "dao", label: "LocationDAO", sub: "Đọc kệ và ngăn" },
        mysql
      ];
    }
    if (kind === "po") {
      return [
        browser,
        { id: "servlet", label: "GoodsReceiptServlet", sub: "Điều khiển phiếu nhập" },
        { id: "dao", label: "PurchaseOrderDAO", sub: "Đọc đơn đặt hàng" },
        mysql
      ];
    }
    if (kind === "save") {
      return [
        browser,
        { id: "servlet", label: "GoodsReceiptServlet", sub: "Điều khiển phiếu nhập" },
        { id: "dao", label: "GoodsReceiptDAO", sub: "Ghi phiếu bản nháp" },
        mysql
      ];
    }
    if (kind === "list") {
      return [
        browser,
        { id: "servlet", label: "GoodsReceiptServlet", sub: "Điều khiển phiếu nhập" },
        { id: "dao", label: "GoodsReceiptDAO", sub: "Đọc danh sách phiếu" },
        mysql
      ];
    }
    return [
      browser,
      { id: "servlet", label: "GoodsReceiptServlet", sub: "Chưa nhận yêu cầu" },
      { id: "dao", label: "DAO", sub: "Chưa được gọi" },
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
    if (live == null && field === "saveDraft") live = "chưa gửi đi";
    return {
      title: "Bạn đang điền form, chưa gửi đến máy chủ",
      summary: "Dữ liệu mới chỉ nằm trên trình duyệt. Chương trình Java GoodsReceiptServlet và LocationServlet chưa nhận yêu cầu nào.",
      ran: false,
      actors: actorsOf("idle"),
      messages: [
        msg("browser", "browser", "Giá trị trên form: " + field + " = " + String(live == null ? "" : live), {
          note: "Bạn đang gõ trên màn hình. Máy chủ Java chưa được gọi. Hàm doGet và doPost của GoodsReceiptServlet chưa chạy. LocationServlet cũng chưa chạy. Cơ sở dữ liệu chưa đổi.",
          kind: "self"
        })
      ]
    };
  }

  function walkPo(form, catalog) {
    var po = poOf(form, catalog);
    return {
      title: "Đổi đơn đặt hàng — tải lại form",
      summary: "Trình duyệt xin máy chủ mở lại trang theo đơn vừa chọn. GoodsReceiptServlet đọc đơn đặt hàng, chưa ghi phiếu mới.",
      ran: true,
      actors: actorsOf("po"),
      messages: [
        msg("browser", "servlet", "Gửi yêu cầu mở lại form theo đơn vừa chọn", {
          note: "Bạn đổi ô Đơn đặt hàng. Trình duyệt gửi yêu cầu GET tới địa chỉ /inventory/receipts với action=new và mã đơn (po). Chương trình nhận yêu cầu tên GoodsReceiptServlet, hàm doGet rồi gọi handleNewForm. Đây chỉ là tải lại trang, chưa lưu phiếu.",
          file: GH.servlet,
          line: 118
        }),
        msg("servlet", "dao", "Hỏi danh sách đơn đặt hàng còn nhận hàng", {
          note: "GoodsReceiptServlet nhờ chương trình PurchaseOrderDAO, hàm findReceivable. Chỉ lấy đơn còn mở: Đã đặt hàng (DA_DAT_HANG) hoặc Đã nhận một phần (DA_NHAN_MOT_PHAN).",
          file: GH.poDao,
          line: 151
        }),
        msg("dao", "mysql", "Đọc bảng đơn đặt hàng còn mở", {
          note: "Câu lệnh chỉ đọc, không sửa dữ liệu. Máy chủ cơ sở dữ liệu MySQL trả về các đơn đủ điều kiện nhận hàng.",
          sql: "SELECT po.*, s.supplier_name ...\nFROM purchase_orders po\nWHERE po.status IN ('DA_DAT_HANG','DA_NHAN_MOT_PHAN')"
        }),
        ret("mysql", "dao", "Trả về các đơn còn mở", { note: "Chỉ đọc. Không thêm, không sửa, không xóa dòng nào." }),
        msg("servlet", "dao", "Hỏi chi tiết đơn vừa chọn và từng dòng hàng", {
          note: "Tiếp theo, PurchaseOrderDAO.findById và findItems lấy nhà cung cấp cùng danh sách sản phẩm của đúng đơn bạn vừa chọn.",
          file: GH.servlet,
          line: 618
        }),
        msg("dao", "mysql", "Đọc dòng hàng của đơn " + (form.purchaseOrderId || "?"), {
          note: "Vẫn chỉ đọc. Kết quả dùng để vẽ lại các ô sản phẩm trên form.",
          sql: "SELECT i.*, p.product_name, p.sku\nFROM purchase_order_items i JOIN products p …\nWHERE i.purchase_order_id = " + (form.purchaseOrderId || "?")
        }),
        ret("mysql", "dao", po ? "Nhà cung cấp " + po.supplierName + ", " + (po.items || []).length + " dòng hàng" : "Không tìm thấy đơn"),
        ret("servlet", "browser", "Trả lại trang form đã điền sẵn", {
          note: "GoodsReceiptServlet không chuyển sang địa chỉ khác. Nó đưa dữ liệu vào trang JSP rồi gửi HTML form mới về trình duyệt, với danh sách sản phẩm của đơn vừa chọn.",
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
      title: isZone ? "Chọn khu — tải danh sách kệ" : "Chọn kệ — tải danh sách ngăn",
      summary: isZone
        ? "Trình duyệt hỏi danh sách kệ trong khu vừa chọn. Chương trình nhận yêu cầu là LocationServlet, không phải GoodsReceiptServlet."
        : "Trình duyệt hỏi danh sách ngăn trên kệ vừa chọn. Chương trình nhận yêu cầu là LocationServlet, không phải GoodsReceiptServlet.",
      ran: true,
      actors: actorsOf("location"),
      messages: [
        msg("browser", "servlet", isZone
          ? "Hỏi danh sách kệ trong khu vừa chọn"
          : "Hỏi danh sách ngăn trên kệ vừa chọn", {
          note: isZone
            ? "JavaScript trên trang gửi yêu cầu GET tới /inventory/locations với action=api-racks và mã khu. LocationServlet.doGet gọi handleApiRacks. GoodsReceiptServlet không tham gia bước này."
            : "JavaScript trên trang gửi yêu cầu GET tới /inventory/locations với action=api-bins và mã kệ. LocationServlet.doGet gọi handleApiBins. GoodsReceiptServlet không tham gia bước này.",
          file: GH.location,
          line: isZone ? 262 : 291
        }),
        msg("servlet", "dao", isZone ? "Nhờ LocationDAO tìm kệ đang hoạt động" : "Nhờ LocationDAO tìm ngăn đang hoạt động", {
          note: isZone
            ? "Hàm findRacks chỉ lấy kệ thuộc khu đã chọn và đang ở trạng thái hoạt động (HOAT_DONG)."
            : "Hàm findBins chỉ lấy ngăn thuộc kệ đã chọn và đang ở trạng thái hoạt động (HOAT_DONG).",
          file: GH.locDao,
          line: isZone ? 192 : 328
        }),
        msg("dao", "mysql", isZone ? "Đọc bảng kệ đang hoạt động" : "Đọc bảng ngăn đang hoạt động", {
          note: "Câu lệnh chỉ đọc. Không ghi phiếu nhập, không đổi số thuốc trên kệ."
        }),
        ret("mysql", "dao", "Trả về " + list.length + " mục đang hoạt động", {
          note: "Máy chủ cơ sở dữ liệu trả danh sách cho chương trình LocationDAO."
        }),
        ret("servlet", "browser", "Gửi danh sách về trình duyệt để hiện lên ô chọn", {
          note: "LocationServlet trả dữ liệu dạng JSON, không vẽ lại cả trang. JavaScript đổ danh sách vào ô Kệ hoặc ô Ngăn. Mã khu và mã kệ không được gửi khi Lưu nháp — máy chủ phiếu nhập chỉ nhận mã ngăn."
        })
      ]
    };
  }

  function walkCancel(sim) {
    var n = ((sim && sim.goodsReceipts) || []).length;
    return {
      title: "Bấm Hủy — quay về danh sách, không lưu phiếu",
      summary: "Link Hủy chỉ xin trang danh sách. Không gửi form, không tạo phiếu mới, không gọi hàm ghi nháp.",
      ran: true,
      actors: actorsOf("list"),
      messages: [
        msg("browser", "servlet", "Xin trang danh sách phiếu nhập", {
          note: "Nút Hủy trên form tạo mới là một liên kết GET tới /inventory/receipts, không gửi dữ liệu form. GoodsReceiptServlet.doGet không thấy action đặc biệt nên gọi handleList. Đây không phải thao tác hủy một phiếu đã lưu.",
          file: GH.servlet,
          line: 108
        }),
        msg("servlet", "dao", "Nhờ GoodsReceiptDAO đọc danh sách phiếu", {
          note: "Hàm findAll chỉ đọc. Không thêm phiếu, không sửa phiếu, không gọi createDraft.",
          file: GH.grDao,
          line: 138
        }),
        msg("dao", "mysql", "Đọc bảng phiếu nhập", {
          note: "Câu lệnh SELECT chỉ xem dữ liệu đã có. Cơ sở dữ liệu không thêm dòng mới."
        }),
        ret("mysql", "dao", "Trả về " + n + " phiếu đang có", { note: "Chỉ đọc." }),
        ret("servlet", "browser", "Hiện trang danh sách", {
          note: "GoodsReceiptServlet đưa dữ liệu vào trang danh sách rồi gửi HTML về trình duyệt. Không có thông báo «đã lưu nháp», vì bạn đã hủy chứ không lưu."
        })
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
      msg("browser", "servlet", "Gửi toàn bộ phiếu lên máy chủ", {
        note: "Bạn bấm Lưu nháp. Trình duyệt gửi toàn bộ form bằng phương thức POST tới /inventory/receipts?action=create. Chương trình nhận yêu cầu tên GoodsReceiptServlet, hàm doPost rồi gọi handleCreate. Tên các ô trên form không có dấu ngoặc vuông.",
        file: GH.servlet,
        line: 76
      }),
      msg("servlet", "servlet", "Đọc thông tin phiếu và từng dòng hàng", {
        note: "Hàm readReceiptForm đọc phần đầu phiếu (đơn đặt hàng, ngày nhận, hóa đơn, ghi chú). Hàm readItemsForm đọc từng dòng hàng. Dòng chưa chọn sản phẩm sẽ bị bỏ qua.",
        file: GH.servlet,
        line: 376
      }),
      msg("servlet", "servlet", "Kiểm tra dữ liệu đã hợp lệ chưa", {
        status: fail ? "error" : "ok",
        note: fail
          ? "Hàm validateReceipt chạy ở chế độ lưu nháp (strict = false) và phát hiện lỗi. Chi tiết: " + firstErr + ". Vì chưa đạt, chương trình chưa ghi vào cơ sở dữ liệu. Dòng Chờ kiểm tra được phép. Dòng Chấp nhận vẫn phải có ngăn."
          : "Hàm validateReceipt chạy ở chế độ lưu nháp (strict = false) và không còn lỗi. Dòng Chờ kiểm tra được phép. Dòng Chấp nhận vẫn phải có ngăn. Bây giờ mới được ghi phiếu bản nháp.",
        file: GH.servlet,
        line: 429
      })
    ];

    if (fail) {
      messages.push(
        ret("servlet", "browser", "Trả lại form kèm thông báo lỗi", {
          note: "GoodsReceiptServlet điền lại form bằng dữ liệu vừa gửi (repopulateForm) rồi gửi cùng trang form về trình duyệt. Chương trình ghi phiếu GoodsReceiptDAO.createDraft không được gọi. Cơ sở dữ liệu không thêm phiếu mới.",
          file: GH.servlet,
          line: 633
        }),
        msg("servlet", "dao", "Không gọi hàm ghi phiếu bản nháp", {
          kind: "note",
          status: "skip",
          note: "Vì kiểm tra chưa đạt, chương trình return trước khi tạo GoodsReceiptDAO. Không có câu lệnh thêm dòng vào bảng."
        })
      );
      return {
        title: "Lưu nháp bị dừng vì dữ liệu chưa hợp lệ",
        summary: "Máy chủ đã nhận phiếu nhưng hàm kiểm tra validateReceipt báo lỗi. Form được trả lại. Chưa ghi vào cơ sở dữ liệu.",
        ran: true,
        actors: actorsOf("save"),
        messages: messages
      };
    }

    messages.push(
      msg("servlet", "dao", "Nhờ chương trình ghi phiếu bản nháp", {
        note: "GoodsReceiptServlet gán trạng thái phiếu là bản nháp (BAN_NHAP) rồi gọi GoodsReceiptDAO.createDraft với phiếu và danh sách dòng hàng.",
        file: GH.servlet,
        line: 206
      }),
      msg("dao", "mysql", "Thêm một phiếu mới, trạng thái bản nháp", {
        status: dbErr ? "error" : "ok",
        note: "Câu lệnh thêm một dòng vào bảng phiếu nhập goods_receipts. Cột trạng thái mang giá trị BAN_NHAP, nghĩa là bản nháp. Số thuốc trên kệ chưa đổi.",
        sql: insertReceiptSql(form, catalog),
        file: GH.grDao,
        line: 250
      })
    );

    if (dbErr) {
      messages.push(
        ret("mysql", "dao", "Cơ sở dữ liệu báo lỗi khi ghi", { kind: "error", status: "error", note: "Đây là tình huống học tập: câu lệnh thêm dòng thất bại." }),
        msg("dao", "mysql", "Hủy toàn bộ thay đổi vừa thử ghi", { kind: "error", status: "error", note: "Hàm createDraft gọi rollback. Phiếu mới không được giữ lại." }),
        ret("dao", "servlet", "Báo không lưu được (mã -1)", { kind: "error", status: "error", note: "createDraft trả về -1 để GoodsReceiptServlet biết ghi thất bại." }),
        ret("servlet", "browser", "Trả lại form với thông báo không lưu được", { status: "error", note: "Người dùng vẫn ở trang form. Không có phiếu mới trên danh sách." })
      );
      return {
        title: "Lưu nháp thất bại vì lỗi cơ sở dữ liệu (tình huống học)",
        summary: "Hàm ghi phiếu createDraft gặp lỗi. Mọi thay đổi bị hủy. Cơ sở dữ liệu không giữ phiếu mới.",
        ran: true,
        actors: actorsOf("save"),
        messages: messages
      };
    }

    messages.push(
      ret("mysql", "dao", "Trả về mã phiếu vừa tạo: " + recId, {
        note: "MySQL cấp mã tự tăng cho phiếu mới. Chương trình dùng mã này để gắn các dòng hàng."
      }),
      msg("dao", "mysql", "Thêm từng dòng hàng vào bảng chi tiết", {
        sql: insertItemSql(form, catalog, recId),
        file: GH.grDao,
        line: 296,
        note: "Mỗi dòng trên form thành một dòng trong bảng goods_receipt_items. Cột lô tồn kho (batch_id) để trống vì lưu nháp chưa tạo lô trên kệ."
      }),
      ret("mysql", "dao", "Đã ghi " + ((form.items || []).length) + " dòng hàng", {
        note: "Các dòng hàng đã vào bảng chi tiết, vẫn chưa cộng số thuốc trên kệ."
      }),
      msg("dao", "mysql", "Xác nhận lưu vĩnh viễn", {
        note: "COMMIT nghĩa là giữ những dòng vừa thêm. Hàm createDraft không đụng bảng tồn kho, không tăng số lượng đã nhận trên đơn đặt hàng, không ghi sổ xuất-nhập kho.",
        file: GH.grDao,
        line: 319
      }),
      ret("dao", "servlet", "Trả về mã phiếu " + recId, {
        note: "GoodsReceiptServlet nhận mã phiếu để chuyển người dùng sang trang danh sách."
      }),
      ret("servlet", "browser", "Bảo trình duyệt mở trang danh sách", {
        note: "Máy chủ gửi lệnh chuyển trang (redirect) tới /inventory/receipts?ok=created. Trình duyệt sẽ gửi một yêu cầu GET mới, không còn dữ liệu POST.",
        file: GH.servlet,
        line: 212
      }),
      msg("browser", "servlet", "Xin trang danh sách phiếu nhập", {
        note: "Đây là yêu cầu mới sau khi chuyển trang. GoodsReceiptServlet.doGet gọi handleList. Tham số ok=created dùng để hiện thông báo thành công.",
        file: GH.servlet,
        line: 108
      }),
      msg("servlet", "dao", "Nhờ đọc danh sách phiếu", {
        note: "Hàm GoodsReceiptDAO.findAll chỉ đọc. Phiếu bản nháp vừa tạo sẽ xuất hiện trong danh sách."
      }),
      msg("dao", "mysql", "Đọc bảng phiếu nhập", {
        note: "Câu lệnh SELECT xem các phiếu đã có, gồm phiếu bản nháp vừa lưu."
      }),
      ret("mysql", "dao", "Danh sách gồm phiếu bản nháp vừa tạo", {
        note: "Phiếu mới có trạng thái BAN_NHAP. Số thuốc trên kệ vẫn như cũ."
      }),
      ret("servlet", "browser", "Hiện danh sách kèm thông báo chưa vào kho", {
        note: "Trang danh sách hiện dòng: «Đã lưu nháp phiếu nhập — chưa có gì vào kho.» Đó là kết quả đúng của nút Lưu nháp."
      })
    );

    return {
      title: "Lưu nháp thành công — phiếu bản nháp đã được ghi",
      summary: "Máy chủ kiểm tra xong, ghi phiếu ở trạng thái bản nháp, rồi mở trang danh sách. Số thuốc trên kệ không tăng.",
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
    var head = 68;
    var rowH = 50;
    var padX = 96;
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
        (xs[i] - 84) +
        '" y="6" width="168" height="50" rx="8"/>' +
        '<text class="seq-box-t" x="' +
        xs[i] +
        '" y="24" text-anchor="middle">' +
        esc(a.label) +
        "</text>" +
        '<text class="seq-box-s" x="' +
        xs[i] +
        '" y="44" text-anchor="middle">' +
        esc(a.sub) +
        "</text>" +
        '<line class="seq-life" x1="' +
        xs[i] +
        '" y1="56" x2="' +
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
        var label = esc(m.label.length > 72 ? m.label.slice(0, 70) + "…" : m.label);
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
      return '<p class="be-cap-empty">Bấm Phát để xem từng bước trên một hình. Bấm Hiện cả luồng để xem hết mũi tên cùng lúc.</p>';
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
      '<span class="seq-chip">Bước ' +
      (index + 1) +
      " trên " +
      walk.messages.length +
      "</span> Từ <strong>" +
      esc(actorLabel(walk, m.from)) +
      "</strong> đến <strong>" +
      esc(actorLabel(walk, m.to)) +
      "</strong></p>" +
      '<p class="be-cap-note"><strong>Đang làm gì:</strong> ' +
      esc(m.label) +
      file +
      "</p>" +
      (m.note ? "<p class=\"be-cap-note\"><strong>Giải thích:</strong> " + esc(m.note) + "</p>" : "") +
      (m.sql ? '<p class="be-cap-note"><strong>Câu lệnh ghi hoặc đọc dữ liệu:</strong></p><pre class="wiz-code be-sql">' + esc(m.sql) + "</pre>" : "")
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
      "<div><p class=\"be-kicker\">Sơ đồ luồng — từng mũi tên là một lần gọi giữa các phần của hệ thống</p>" +
      '<h2 class="be-title">' +
      esc(walk.title) +
      "</h2><p class=\"be-sum\">" +
      esc(walk.summary) +
      "</p></div>" +
      '<div class="be-nav">' +
      '<button type="button" class="sfe-btn primary" data-be-play>Phát</button>' +
      '<button type="button" class="sfe-btn" data-be-all">Hiện cả luồng</button>' +
      "</div></div>" +
      '<p class="seq-legend">Mũi tên liền nét là đang gọi hoặc đang gửi yêu cầu. Mũi tên nét đứt là trả kết quả về. Màu đỏ là lỗi. Cột không sáng nghĩa là phần đó chưa được gọi. Bốn cột trên một hình: trình duyệt, chương trình điều khiển (Servlet), chương trình đọc/ghi dữ liệu (DAO), cơ sở dữ liệu MySQL.</p>' +
      svgDiagram(walk) +
      '<div class="be-caption" data-be-cap></div>' +
      '<p class="be-note">Đây là mô phỏng trên trình duyệt, không phải máy chủ Tomcat thật. Tên chương trình, tên hàm và câu lệnh SQL khớp mã nguồn Pharma_Flow.</p>'
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
