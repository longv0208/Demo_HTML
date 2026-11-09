/** Nghiệp vụ nhập kho — tóm tắt từ docs/PharmaFlow_Dac_Ta_Nghiep_Vu_Nhap_Kho.md; code: ../Pharma_Flow */
window.SFE_BUSINESS = {
  sourceDoc: "docs/PharmaFlow_Dac_Ta_Nghiep_Vu_Nhap_Kho.md",
  codeRoot: "../Pharma_Flow",

  oneLiner:
    "Nhân viên nhận hàng theo PO, ghi từng lô + kết quả kiểm tra, lưu GR nháp; chỉ khi Xác nhận (transaction) các dòng CHAP_NHAN mới cộng tồn đúng Zone/Rack/Bin, tăng PO received, ghi NHAP_KHO. Nháp và dòng từ chối không cộng kho.",

  goals: [
    "Truy vết: Supplier → PO → GR → dòng → lô/hạn → vị trí kho",
    "Chỉ dòng CHAP_NHAN mới cộng tồn khi xác nhận thành công",
    "Tách Lưu nháp và Xác nhận — nháp không tăng kho",
    "Không nhập vượt phần chưa nhận của PO",
    "Cộng ngăn + tổng lô + PO received + Movement trong một transaction; lỗi → rollback"
  ],

  concepts: [
    { term: "PO (Purchase Order)", meaning: "Đơn đặt mua — số lượng mong muốn. Tạo/đặt PO không cộng tồn." },
    { term: "GR (Goods Receipt)", meaning: "Phiếu nhận hàng thực tế. Không nhầm với receipts (hóa đơn bán POS)." },
    { term: "GR Item", meaning: "Một dòng lô trong phiếu: số lô, hạn, SL, kiểm tra, ngăn…" },
    { term: "Inspection", meaning: "CHO_KIEM_TRA | CHAP_NHAN | TU_CHOI — kết quả kiểm tra từng dòng." },
    { term: "Zone → Rack → Bin", meaning: "Khu → Kệ → Ngăn. Backend chỉ lưu binId; Zone/Rack là UI phụ thuộc." },
    { term: "On-hand vs Saleable", meaning: "On-hand = tồn vật lý. Saleable còn lọc trạng thái lô/hạn — không đồng nghĩa." }
  ],

  phases: [
    {
      id: "A",
      title: "A — Đặt hàng (trước nhập kho)",
      points: [
        "Admin tạo PO + đặt hàng → trạng thái DA_DAT_HANG",
        "Chưa cộng inventory_batches",
        "Supplier giao hàng; nhân viên đối chiếu với PO"
      ]
    },
    {
      id: "B",
      title: "B — Mở form nhập kho (màn này)",
      points: [
        "GET ?action=new → form tạo phiếu",
        "Chọn PO receivable (DA_DAT_HANG / DA_NHAN_MOT_PHAN)",
        "Supplier chỉ đọc, suy ra từ PO",
        "Điền ngày nhận / hóa đơn / ghi chú; receivedBy lấy từ session"
      ]
    },
    {
      id: "C",
      title: "C — Nhập dòng hàng & kiểm tra",
      points: [
        "Mỗi lô = một dòng; cùng SP nhiều lô → nhiều dòng",
        "CHO_KIEM_TRA: được lưu nháp, không được xác nhận",
        "CHAP_NHAN: cần Bin; không chấp nhận hết hạn tại ngày nhận",
        "TU_CHOI: cần lý do; không cộng tồn khi xác nhận"
      ]
    },
    {
      id: "D",
      title: "D — Lưu nháp (màn này — nút #4)",
      points: [
        "POST ?action=create → status BAN_NHAP",
        "INSERT goods_receipts + goods_receipt_items",
        "KHÔNG cộng ngăn/lô/PO received/movement",
        "Thông báo: «Đã lưu nháp phiếu nhập — chưa có gì vào kho.»"
      ]
    },
    {
      id: "F",
      title: "F — Xác nhận (chưa có trên form create)",
      points: [
        "Form create chỉ có Lưu nháp — phải có nháp rồi mới xác nhận",
        "Confirm: không còn CHO_KIEM_TRA; ≥1 CHAP_NHAN; kiểm tra Bin/PO",
        "Transaction: +on_hand tại bin, sync lô, +received_quantity, NHAP_KHO"
      ]
    }
  ],

  demoStory: {
    tag: "[DEMO]",
    title: "Ví dụ cơ bản trên form này",
    body:
      "PO đặt 100 hộp Paracetamol, đã nhận 20. Lần này giao 40 hộp: muốn 30 đạt + 10 từ chối thì tách 2 dòng (không gán 2 kết quả trên 1 dòng). Sau xác nhận: +30 vào lô/ngăn; PO received 20→50; 10 từ chối không cộng kho; phiếu có thể CHAP_NHAN_MOT_PHAN.",
    note: "Form create hiện chỉ Lưu nháp — ví dụ đầy đủ thuộc giai đoạn xác nhận (màn sau)."
  },

  draftRules: [
    "PO phải mở nhận hàng; ngày nhận bắt buộc, không tương lai",
    "≥1 dòng; batchNumber + expiryDate bắt buộc; quantity > 0; costPrice ≥ 0",
    "Cho phép dòng CHO_KIEM_TRA khi lưu nháp",
    "Tổng CHAP_NHAN theo PO item không vượt phần còn lại (kể cả khi còn đang nháp)",
    "TU_CHOI phải có rejectionReason",
    "Lưu nháp thành công → redirect list ?ok=created — kho chưa đổi"
  ],

  statusGr: [
    { code: "BAN_NHAP", meaning: "Nháp — sửa/xác nhận/hủy được; kho chưa đổi" },
    { code: "DA_XAC_NHAN", meaning: "Tất cả dòng chấp nhận — kho đã cộng; không sửa" },
    { code: "CHAP_NHAN_MOT_PHAN", meaning: "Vừa đạt vừa từ chối — chỉ dòng đạt vào kho" },
    { code: "DA_HUY", meaning: "Hủy nháp — kho chưa từng đổi vì nháp" }
  ],

  topics: [
    {
      id: "overview",
      title: "Tổng quan nhập kho",
      summary: "PO đặt mua ≠ nhập kho. GR ghi nhận giao hàng thực tế.",
      body:
        "Nhập kho không phải cộng thẳng số lượng vào Product. Nhân viên lập Goods Receipt (phiếu nhập) gắn với Purchase Order, ghi từng lô/hạn dùng, kiểm tra chất lượng rồi mới xác nhận để cộng tồn.",
      points: [
        "Mục tiêu: truy vết Supplier → PO → GR → dòng → lô → vị trí kho",
        "Tồn sau nhập dùng chung cho POS và online",
        "GR ≠ receipts (hóa đơn bán POS)",
        "Trên form create hiện tại: chỉ lưu nháp — chưa cộng kho"
      ]
    },
    {
      id: "po",
      title: "Vai trò Purchase Order",
      summary: "Chỉ PO DA_DAT_HANG / DA_NHAN_MOT_PHAN; Supplier theo PO.",
      body:
        "Phiếu nhập lấy hàng từ PO đã đặt. Hệ thống chỉ hiện PO còn nhận được. Supplier không chọn tự do — điền theo PO. Số còn lại = ordered − received.",
      points: [
        "DA_DAT_HANG / DA_NHAN_MOT_PHAN → được chọn trên form",
        "BAN_NHAP / DA_NHAN_DU / DA_HUY → không nhận tiếp",
        "Đổi PO trên form create = GET reload (giống JSP)",
        "Không nhập vượt phần còn lại của từng PO item"
      ]
    },
    {
      id: "inspection",
      title: "Kiểm tra chất lượng dòng",
      summary: "3 trạng thái; chỉ CHAP_NHAN vào kho lúc xác nhận.",
      body:
        "Mỗi dòng có một kết quả kiểm tra. Muốn vừa nhận vừa từ chối cùng sản phẩm phải tách thành nhiều dòng.",
      points: [
        "CHO_KIEM_TRA — được Lưu nháp, không được Xác nhận",
        "CHAP_NHAN — cần Bin; hết hạn tại ngày nhận không được chấp nhận",
        "TU_CHOI — bắt buộc lý do; không cộng tồn khi xác nhận",
        "Hệ thống ghi nhận lựa chọn của người dùng, không tự kiểm nghiệm thuốc"
      ]
    },
    {
      id: "draft-vs-confirm",
      title: "Nháp vs Xác nhận",
      summary: "Nháp không cộng kho. Confirm mới chạy transaction tồn.",
      body:
        "Đây là điểm sinh viên hay nhầm. Lưu nháp chỉ ghi bảng phiếu. Chỉ Xác nhận mới cộng ngăn/lô, tăng PO received và ghi movement NHAP_KHO trong một transaction.",
      points: [
        "Lưu nháp (màn này): INSERT goods_receipts status=BAN_NHAP + items",
        "Không đổi inventory_batches / locations / movements / PO received",
        "Form create không có nút Xác nhận — phải có nháp rồi mới confirm",
        "Thông báo nháp: «Đã lưu nháp phiếu nhập — chưa có gì vào kho.»"
      ]
    },
    {
      id: "location",
      title: "Vị trí Zone / Rack / Bin",
      summary: "Bin bắt buộc khi chấp nhận; Zone/Rack hỗ trợ UI.",
      body:
        "Chuỗi chọn: Khu → Kệ → Ngăn. Backend lưu binId. Zone/Rack tải phụ thuộc (demo JSON / API locations). Dòng CHAP_NHAN phải có ngăn đang hoạt động.",
      points: [
        "Zone / Rack: select UI, không phải field POST chính",
        "binId: gửi trong form, bắt buộc khi chấp nhận",
        "Sau xác nhận: cộng on_hand tại đúng (batch, bin)",
        "On-hand vật lý ≠ chắc chắn Saleable (còn lọc hạn/trạng thái lô)"
      ]
    }
  ]
};
