# Demo_HTML — Servlet Flow Explorer (Nhập kho)

Folder demo độc lập. **Code thật** vẫn nằm ở `../Pharma_Flow`; đây chỉ là HTML/JS học tập.

## Chạy

Mở `index.html` hoặc `nhap-kho-form.html` bằng trình duyệt (không cần server).

## Cấu trúc

| Đường dẫn | Nội dung |
|---|---|
| `nhap-kho-form.html` | Page Explorer — form tạo phiếu nhập |
| `data/nhap-kho-form-actions.js` | Map action từ Servlet/JSP |
| `data/nhap-kho-nghiep-vu.js` | Tóm tắt nghiệp vụ từ đặc tả |
| `docs/PharmaFlow_Dac_Ta_Nghiep_Vu_Nhap_Kho.md` | Đặc tả nghiệp vụ đầy đủ |
| `css/main.css` | Copy CSS app từ Pharma_Flow |
| `css/explorer.css` | Chrome 3-pane explorer |

## Tab Nghiệp vụ

- Mục tiêu, khái niệm, giai đoạn A→F, quy tắc Lưu nháp, trạng thái GR
- Mỗi Action (hotspot) có khối **Nghiệp vụ** + **Tác động kho** trong Inspector

## Nguồn đối chiếu code

- `../Pharma_Flow/src/java/controller/GoodsReceiptServlet.java`
- `../Pharma_Flow/web/WEB-INF/views/admin/goods-receipt-form.jsp`
- `../Pharma_Flow/src/java/dao/GoodsReceiptDAO.java`
