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
      summary: "PO đặt mua ≠ nhập kho. GR ghi nhận giao hàng thực tế."
    },
    {
      id: "po",
      title: "Vai trò Purchase Order",
      summary: "Chỉ PO DA_DAT_HANG / DA_NHAN_MOT_PHAN; Supplier theo PO."
    },
    {
      id: "inspection",
      title: "Kiểm tra chất lượng dòng",
      summary: "3 trạng thái; chỉ CHAP_NHAN vào kho lúc xác nhận."
    },
    {
      id: "draft-vs-confirm",
      title: "Nháp vs Xác nhận",
      summary: "Nháp không cộng kho. Confirm mới chạy transaction tồn."
    },
    {
      id: "location",
      title: "Vị trí Zone / Rack / Bin",
      summary: "Bin bắt buộc khi chấp nhận; Zone/Rack hỗ trợ UI."
    }
  ]
};
