# PharmaFlow Learning Lab (Demo_HTML)

Website học Java Servlet/JSP MVC2 — luồng **Nhập kho / Lưu nháp**, đối chiếu source `../Pharma_Flow`.

## Chạy

Mở `index.html` trong trình duyệt (không cần Tomcat/MySQL).

## Kiểm tra nhanh

1. Trang chủ hiểu được mục đích + CTA **Bắt đầu bài học**.
2. Form: cột **SL** đủ rộng; đổi PO cập nhật NCC/sản phẩm (có confirm).
3. Thêm/xóa dòng; kiểm tra TU_CHOI hiện lý do; Zone→Rack→Bin; summary.
4. Tab **Actions / Nghiệp vụ** không chồng panel.
5. **Lưu nháp** hoặc **Bắt đầu mô phỏng** mở Trace (Prev/Next/Play/Pause/Reset).
6. Nhánh Success / Validation / DB Error + Database [DEMO] trước/sau.

## File chính

| File | Vai trò |
|---|---|
| `nhap-kho-form.html` | Page Explorer + Trace modal |
| `js/page-explorer.js` | Inspector, tabs, hotspot |
| `js/form-demo.js` | Thao tác form demo |
| `js/trace-flow.js` | Mô phỏng từng bước |
| `data/save-draft-trace.js` | 17 bước + nhánh lỗi |
| `data/demo-catalog.js` | 2 PO demo |
| `docs/PharmaFlow_Dac_Ta_Nghiep_Vu_Nhap_Kho.md` | Đặc tả nghiệp vụ |

## Chưa làm (đúng scope)

- Trace **Xác nhận nhập** đầy đủ
- POS / Online / Stocktake / Adjustment
