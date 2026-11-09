# PHARMAFLOW — ĐẶC TẢ NGHIỆP VỤ NHẬP KHO (GOODS RECEIVING)

> **Mục đích:** Tài liệu nghiệp vụ **độc lập**, dùng để giải thích hoặc giao cho AI xây dựng chức năng/mô phỏng luồng nhập kho PharmaFlow mà **không cần cung cấp riêng hai Google Docs** (tài liệu yêu cầu và SDS). Tập trung vào **nghiệp vụ, quy tắc, dữ liệu và luồng xử lý**; không phải yêu cầu xây dựng toàn bộ website học Java Servlet/JSP.
>
> **Căn cứ:** (1) *PharmaFlow: A Smart Inventory & Sales Management System for Private Pharmacies* — đặc biệt UC16, UC17, UC20, BR-01 đến BR-05; (2) *PharmaFlow_SDS_Document* — thiết kế dữ liệu, PO/GR/batch/movement; (3) repo `longv0208/Pharma_Flow` nhánh `main` tại thời điểm rà soát, bao gồm migration và hướng dẫn kho; (4) source Java/JSP triển khai thực tế.
>
> **Quy ước về độ tin cậy:** **[SRS]** = yêu cầu nghiệp vụ; **[SDS]** = thiết kế; **[CODE]** = đã đối chiếu source tĩnh; **[DEMO]** = dữ liệu giả để giải thích, không phải số liệu thực. Khi tài liệu khác code, mô tả **[CODE]** là hành vi của phiên bản đang triển khai; không suy diễn là đã chạy thử trên Tomcat/MySQL.

---

## 1. Tổng quan và mục tiêu

PharmaFlow quản lý nhà thuốc tư nhân, kết nối **nhập hàng**, **quản lý tồn kho**, **bán tại quầy (POS)** và **đơn hàng online** trên **cùng một nguồn tồn kho**. Khi nhà cung cấp giao thuốc, nhân viên không được đơn giản nhập số lượng cộng thẳng vào Product. Phải ghi nhận một **Goods Receipt** và từng **Goods Receipt Item** tương ứng với sản phẩm/lô thực nhận, đối chiếu với **Purchase Order (PO)**, kiểm tra chất lượng, xác định vị trí cất trữ và ghi lại biến động tồn kho.

Các mục tiêu bắt buộc:

1. Truy vết thuốc theo **nhà cung cấp → đơn đặt hàng → phiếu nhập → dòng nhập → số lô/hạn dùng → vị trí kho**.
2. Chỉ thuốc/dòng **được chấp nhận** mới có thể cộng vào tồn vật lý khi phiếu **được xác nhận thành công**.
3. Tách rõ **lưu nháp** và **xác nhận**; việc tạo/sửa/hủy nháp không làm tăng kho.
4. Không cho nhập vượt phần **chưa nhận** của PO.
5. Cập nhật đồng thời tồn theo ngăn, tổng tồn theo lô, số lượng PO đã nhận và **Inventory Movement** trong một transaction; lỗi phải rollback toàn bộ.
6. Tồn kho sau nhập là nguồn dùng chung cho POS và online, theo các quy tắc hạn dùng, trạng thái lô, giữ hàng và FEFO.

### Ví dụ cơ bản [DEMO]

PO đặt **100 hộp Paracetamol 500 mg**, trước đó đã nhận 20 hộp. Lần giao tiếp theo có 40 hộp, trong đó 30 hộp đạt và 10 hộp hỏng/vỡ hộp. Nhân viên lập phiếu với **hai dòng**: 30 hộp `CHAP_NHAN`, 10 hộp `TU_CHOI` (ghi lý do). Sau xác nhận thành công:

- Hàng thực tế được kiểm tra trong lần này: 40 hộp.
- Cộng tồn: **+30** hộp vào đúng lô/ngăn.
- `received_quantity` của PO: **20 → 50**.
- PO còn chưa nhận: **100 − 50 = 50** hộp.
- 10 hộp từ chối **không** cộng tồn, không làm tăng `received_quantity`.
- Phiếu nhập chuyển sang `CHAP_NHAN_MOT_PHAN`, PO vẫn `DA_NHAN_MOT_PHAN`.
- Phát sinh lịch sử `NHAP_KHO` cho **dòng được chấp nhận**, không phát sinh movement nhập kho cho dòng từ chối.

> Một dòng nhập hiện tại có kết quả kiểm tra chung cho toàn dòng. Muốn nhận một phần và từ chối phần còn lại của cùng sản phẩm, phải **tách thành các dòng** tương ứng, không gán hai kết quả trái ngược cho một dòng.

---

## 2. Phạm vi, tác nhân và phân quyền

| Tác nhân | Vai trò thực tế |
|---|---|
| `CHU_QUAN_QUAN_TRI` — Owner/Admin | Quản lý PO, quản trị; được xem/tạo/sửa/xác nhận/hủy nháp phiếu nhập |
| `NHAN_VIEN` — Pharmacy Staff | Tiếp nhận và kiểm tra hàng; được thao tác nhập kho theo phân quyền code |
| Supplier | Giao hàng và chứng từ; là thực thể bên ngoài, **không đăng nhập** hệ thống ở phiên bản này |
| PharmaFlow | Đối chiếu PO, kiểm tra dữ liệu, quản lý trạng thái, cập nhật tồn và lịch sử |
| MySQL | Lưu các bảng PO/GR, lô, vị trí, movement và thông tin người thực hiện |

**[CODE]** `GoodsReceiptServlet.requireReceiver()` kiểm tra `session.getAttribute("currentUser")`, lấy `User.roleName`; chỉ chấp nhận `CHU_QUAN_QUAN_TRI` hoặc `NHAN_VIEN`. Không hợp lệ thì redirect tới `/authen?action=login`. Nhà cung cấp, khách hàng, nhân viên giao hàng không có màn nhập kho theo quyền này.

**Phạm vi không bao gồm**: tự động đặt hàng từ AI, trả hàng lại nhà cung cấp, hoàn tiền nhà cung cấp, kiểm tra dược lý tự động, quản lý nhà thuốc nhiều chi nhánh. SRS bản đầu mô tả chọn Supplier để nhận hàng; code đã phát triển luồng nhận hàng từ **PO đã đặt**.

---

## 3. Các khái niệm cốt lõi

| Thuật ngữ | Giải thích | Ví dụ [DEMO] |
|---|---|---|
| Product | Mặt hàng/thuốc trong danh mục, chưa biểu diễn một lô cụ thể | Paracetamol 500 mg |
| Supplier | Nhà cung cấp thuốc | Công ty Dược A |
| Purchase Order (PO) | Đơn đặt mua, ghi số lượng mong muốn | PO #501 đặt 100 hộp |
| PO Item | Một dòng mặt hàng đặt mua, có `ordered_quantity`, `received_quantity` | 100 hộp Paracetamol, đã nhận 20 |
| Goods Receipt (GR) | Phiếu ghi nhận lần giao hàng thực tế | GR #801, ngày nhận 09/11/2026 |
| Goods Receipt Item | Một dòng sản phẩm/lô trong GR | 30 hộp, LOT-2026-A |
| Batch / Lot | Lô thuốc theo `product_id` + `batch_number`, hạn dùng | LOT-2026-A, 01/09/2027 |
| Inspection | Kết quả kiểm tra dòng thuốc | `CHAP_NHAN` / `TU_CHOI` |
| Zone → Rack → Bin | Khu → Kệ → Ngăn đặt thuốc | Zone A → Rack R1 → Bin B03 |
| On-hand | Tồn vật lý trong kho | 100 hộp |
| Reserved | Lượng tồn đang được giữ cho đơn online | 20 hộp |
| Available/Saleable | Lượng có thể phân bổ bán từ **các lô hợp lệ**, sau khi trừ Reserved | 80 hộp nếu lô còn hạn, mở khóa |
| Inventory Movement | Nhật ký thay đổi tồn (ai, khi nào, trước/sau, nguồn tham chiếu) | `NHAP_KHO +30` |

**Cực kỳ quan trọng:** `Goods Receipt` **không phải** `receipts` (hóa đơn bán hàng POS). `goods_receipts` là chứng từ **nhập**, còn bảng `receipts` thuộc luồng bán tại quầy.

---

## 4. Điều kiện tiên quyết để nhập kho

Trước khi có thể nhập hàng:

1. Có tài khoản đăng nhập thuộc nhóm được phép nhập kho.
2. Có Supplier và Product hợp lệ trong dữ liệu danh mục.
3. Có **Purchase Order** do admin đặt, với sản phẩm và số lượng rõ ràng.
4. PO ở trạng thái **`DA_DAT_HANG`** (đã đặt) hoặc **`DA_NHAN_MOT_PHAN`** (đã nhận một phần).
5. Có vị trí kho **Zone / Rack / Bin** đang hoạt động cho các dòng `CHAP_NHAN`.
6. Với các lần nhập sau, số lượng chấp nhận không vượt phần PO còn phải nhận.

**[CODE]** `PurchaseOrderDAO.findReceivable()` chỉ trả về PO có trạng thái `DA_DAT_HANG`, `DA_NHAN_MOT_PHAN`, sắp xếp ID giảm dần. Supplier được **suy ra từ PO**, không chọn tự do để thay đổi PO đã đặt.

### 4.1. Trạng thái PO [SDS + CODE]

| Mã trạng thái | Diễn giải | Có tiếp tục nhập hàng? |
|---|---|---|
| `BAN_NHAP` | Đơn đặt đang soạn | Không |
| `DA_DAT_HANG` | Đã đặt, chờ nhận | Có |
| `DA_NHAN_MOT_PHAN` | Đã nhận một phần, còn thiếu | Có |
| `DA_NHAN_DU` | Đã nhận đủ số đặt | Không |
| `DA_HUY` | Đã hủy PO | Không |

`ordered_quantity` là lượng đặt ban đầu; `received_quantity` là tổng lượng **được chấp nhận từ các phiếu đã xác nhận**. Lượng còn lại để nhận = `ordered_quantity − received_quantity`.

Tạo PO **không cộng tồn**, dù PO đã chuyển `DA_DAT_HANG`.

---

## 5. Trọn vẹn quy trình nghiệp vụ từ đầu đến cuối

### Giai đoạn A — Nhà thuốc đặt hàng

**A1.** Owner/Admin tạo PO với Supplier và các dòng thuốc (`Product`, `ordered_quantity`, `unit_cost`).

**A2.** Admin đặt PO; PO chuyển `DA_DAT_HANG`. Thời điểm này là **đặt mua**, không phải nhập kho. Database chưa cộng `inventory_batches`.

**A3.** Supplier chuẩn bị và giao thuốc. Người nhận đối chiếu phiếu giao hàng/hóa đơn và thuốc thực nhận so với PO.

### Giai đoạn B — Mở màn hình nhập kho

**B1.** Người dùng hợp lệ mở mục **Nhập kho**. Màn danh sách hiển thị các GR đã tạo, cho lọc theo từ khóa/trạng thái, xem chi tiết, sửa nháp (khi còn được phép).

**B2.** Nhấn **`+ Nhập thuốc`** → màn tạo phiếu nhập mới.

**B3.** Chọn **Purchase Order**. Hệ thống chỉ cho chọn PO đủ điều kiện; sau khi chọn, hiển thị tên Supplier **chỉ đọc** và những sản phẩm/PO item thuộc PO đó, kèm số đặt, số đã nhận, số còn lại.

**B4.** Nhập header cho phiếu:

- `receiptDate`: ngày nhận hàng (bắt buộc, không được ở tương lai).
- `invoiceNumber`: tham chiếu số hóa đơn giao hàng (không bắt buộc).
- `note`: ghi chú (không bắt buộc).
- `receivedBy`: tự lấy người đang đăng nhập, không để người dùng tự nhập ID người nhận.

**Lưu ý code:** khi đổi PO ở form tạo mới, JavaScript chuyển sang **GET reload** để máy chủ nạp PO items; nếu đã có dòng hàng trên form, hiện hộp xác nhận vì thao tác đổi PO sẽ làm mất các dòng đã nhập. Hệ thống cố giữ lại ngày nhận, số hóa đơn và ghi chú đã điền.

### Giai đoạn C — Nhập từng dòng hàng và kiểm tra

**C1.** Với mỗi lô thuốc được giao, nhập một dòng gồm:

| Trường nhập | Ý nghĩa | Quy tắc |
|---|---|---|
| `poItemId` | Mặt hàng tương ứng của PO | Bắt buộc; phải thuộc PO đã chọn |
| `batchNumber` | Số lô trên bao bì | Bắt buộc |
| `expiryDate` | Hạn dùng của lô | Bắt buộc |
| `quantity` | Số lượng được kiểm tra trên dòng | Số nguyên dương |
| `costPrice` | Giá nhập/đơn vị | Số không âm |
| Zone | Khu chứa | Lựa chọn hỗ trợ UI |
| Rack | Kệ trong Zone | Lựa chọn hỗ trợ UI |
| `binId` | Ngăn lưu thuốc | Bắt buộc khi chấp nhận |
| `inspectionResult` | Kết quả kiểm tra | `CHO_KIEM_TRA`, `CHAP_NHAN`, `TU_CHOI` |
| `rejectionReason` | Lý do từ chối | Bắt buộc khi `TU_CHOI` |

**C2.** Nhân viên quan sát thuốc thực tế: đúng sản phẩm, đúng số lô, đúng hạn, tình trạng bao bì, số lượng và các điều kiện chất lượng thích hợp của nhà thuốc. Hệ thống **ghi nhận kết quả do người dùng chọn**, không tự thực hiện kiểm nghiệm thuốc ngoài đời.

**C3.** Chọn một trong ba trạng thái kiểm tra:

- `CHO_KIEM_TRA` — chưa đánh giá xong; **được phép lưu nháp**, **không được xác nhận**.
- `CHAP_NHAN` — chấp nhận đưa hàng vào kho; phải chọn ngăn hợp lệ. Thuốc hết hạn **tại ngày nhận** không được đánh dấu chấp nhận.
- `TU_CHOI` — không cho nhập tồn; phải ghi lý do. Không yêu cầu `binId` để cất trữ như hàng đạt.

**C4.** Nếu cùng một sản phẩm được giao nhiều lô hoặc cùng một lô cần đặt nhiều ngăn: tạo **nhiều dòng**. Các dòng cùng PO item được cộng tổng để kiểm tra không nhận vượt số còn lại.

**C5.** Chọn vị trí lưu trữ cho từng dòng chấp nhận theo chuỗi:

`Zone (Khu) → Rack (Kệ) → Bin (Ngăn)`.

Trong form hiện tại, Zone/Rack là các select phụ thuộc. Chọn Zone thì tải các Rack hoạt động, chọn Rack thì tải các Bin hoạt động. **Backend nhận và lưu `binId`**; Zone/Rack được xác định theo quan hệ của Bin.

> **[CODE – phần mở rộng so với SDS gốc]** `storage_zones`, `storage_racks`, `storage_bins`, `inventory_batch_locations` được bổ sung bằng migration `sql/migration_001_warehouse_locations.sql`. SDS cơ sở trước đó có `storage_location` dạng chuỗi, nhưng hiện tại việc nhập thành công phải xác định ngăn chứa thực tế. Khi xem kho theo lô, cần tính theo từng bin và tổng các bin.

### Giai đoạn D — Lưu nháp (chưa cộng kho)

**D1.** Người dùng nhấn **Lưu nháp** trên form tạo mới.

**D2.** Hệ thống kiểm tra dữ liệu căn bản: PO đủ điều kiện, ngày nhận không ở tương lai, có dòng hàng, các trường bắt buộc, số lượng/giá hợp lệ, quan hệ với PO, lý do từ chối nếu có, và số lượng chấp nhận không vượt phần còn lại. Ở bước này **vẫn cho phép dòng `CHO_KIEM_TRA` tồn tại**.

**D3.** Nếu hợp lệ, ghi:

- Một bản ghi `goods_receipts` với `status='BAN_NHAP'`.
- Các bản ghi `goods_receipt_items` với dữ liệu từng lô và kết quả kiểm tra hiện thời.

**D4.** Sau khi lưu nháp, người dùng thấy thông báo thành công: **"Đã lưu nháp phiếu nhập — chưa có gì vào kho."**

**D5.** Phiếu nháp có thể được mở lại để sửa, kiểm tra tiếp, xác nhận hoặc hủy.

**Tác động đến kho ở D1–D5: KHÔNG**. Cụ thể không cộng `inventory_batch_locations`, không tăng `inventory_batches.on_hand_quantity`, không cộng `purchase_order_items.received_quantity`, không ghi movement `NHAP_KHO`.

### Giai đoạn E — Xem lại và sửa nháp

**E1.** Mở chi tiết GR để đối chiếu thông tin; nhấn **Sửa** nếu phiếu ở `BAN_NHAP`.

**E2.** Có thể chỉnh ngày nhận, hóa đơn, ghi chú, danh sách dòng/lô, số lượng, giá, kết quả kiểm tra, vị trí ngăn. Sau khi đã tạo nháp, **PO, Supplier và người nhận ban đầu không được đổi**.

**E3.** Nhấn **Lưu nháp** để cập nhật các bảng phiếu nhập. Vẫn **không cộng tồn**.

**E4.** Có thể nhấn **Xác nhận nhập** từ trang sửa; thao tác này chạy xác nhận trên dữ liệu vừa nhập trong form và lưu + xác nhận **cùng một transaction** nếu hợp lệ.

**E5.** Cũng có thể nhấn **Xác nhận nhập** ở trang chi tiết; hệ thống lấy **dữ liệu nháp đã lưu trong DB** để xác nhận. Đây là hai nguồn dữ liệu khác nhau (xem mục 7.4).

### Giai đoạn F — Xác nhận nhập kho (lúc thay đổi tồn)

**F1.** Người dùng chủ động nhấn nút **Xác nhận nhập**, đồng ý xác nhận.

**F2.** Hệ thống kiểm tra quyền, nạp lại phiếu, bảo đảm còn `BAN_NHAP`; kiểm tra PO vẫn có thể nhận và đúng Supplier.

**F3.** Kiểm tra tất cả dòng: đúng PO item, đúng Product, thông tin lô hợp lệ, số lượng/giá hợp lệ, **không còn `CHO_KIEM_TRA`**, dòng từ chối có lý do, dòng chấp nhận có Bin hợp lệ; **ít nhất một dòng chấp nhận**.

**F4.** Cộng lượng chấp nhận dự kiến theo từng PO item rồi đối chiếu với lượng còn lại để nhận, kể cả trường hợp một PO item được chia nhiều batch/bin.

**F5.** Trong **một transaction JDBC**, với **mỗi dòng `CHAP_NHAN`**:

1. Tìm `inventory_batches` theo cặp `(product_id, batch_number)`.
2. Nếu lô chưa tồn tại: tạo một lô mới với thông tin Supplier, hạn, giá, nguồn phiếu nhập và tồn ban đầu 0.
3. Nếu lô đã tồn tại: yêu cầu hạn dùng phải trùng hạn đã ghi; khác hạn → lỗi `batchconflict`, **không nhập**.
4. Cộng tồn vật lý tại đúng `inventory_batch_locations` theo `(batch_id, bin_id)` bằng `LocationDAO.addOnHandAtBin`.
5. Đồng bộ tổng tồn lô qua `LocationDAO.syncBatchTotals`.
6. Làm mới trạng thái lô theo hạn/tồn; **không tự mở khóa** lô `BI_KHOA` đã có.
7. Gắn `goods_receipt_items.batch_id`, `goods_receipt_items.bin_id` để truy vết.
8. Cộng `purchase_order_items.received_quantity` đúng lượng chấp nhận.
9. Ghi `inventory_movements` loại `NHAP_KHO`, `on_hand_change=+quantity`, `reserved_change=0`, trước/sau, `performed_by`, ngăn nhận và tham chiếu GR.

**F6.** Tính lại PO:

- Mọi PO item đã nhận đủ → `DA_NHAN_DU`.
- Vẫn còn thiếu ít nhất một mặt hàng nhưng có phần đã nhận → `DA_NHAN_MOT_PHAN`.

**F7.** Tính trạng thái phiếu:

- Tất cả dòng đều chấp nhận → `DA_XAC_NHAN`.
- Có cả dòng chấp nhận và dòng từ chối → `CHAP_NHAN_MOT_PHAN`.
- Tất cả dòng từ chối → **không cho xác nhận**, phiếu vẫn nháp (hoặc có thể hủy nháp).

**F8.** Nếu mọi phép kiểm tra và ghi dữ liệu đều thành công → `COMMIT`. Nếu lỗi bất kỳ ở giữa → `ROLLBACK` tất cả. Không được có trường hợp cộng kho xong nhưng PO hoặc lịch sử không được cập nhật.

**F9.** Chuyển tới chi tiết phiếu, hiển thị thông báo **"Đã xác nhận phiếu nhập — số lượng chấp nhận đã vào kho."**

### Giai đoạn G — Kiểm tra kết quả và truy vết

Người dùng có thể kiểm tra ở:

- **Chi tiết phiếu nhập:** mã GR, PO, Supplier, người nhập, ngày nhập, từng dòng hàng, số lô, hạn dùng, số lượng, vị trí, kết quả kiểm tra và lý do từ chối.
- **Chi tiết Purchase Order:** cột `received_quantity` và trạng thái nhận đủ/nhận một phần.
- **Tồn kho → chi tiết sản phẩm/lô:** lô mới hoặc lô cũ được cộng đúng số lượng, đúng ngăn.
- **Lịch sử tồn kho:** movement `NHAP_KHO`, người thực hiện, trước/sau, tham chiếu phiếu nhập.

---

## 6. Các trạng thái nghiệp vụ và chuyển trạng thái

### 6.1. Goods Receipt [SDS + CODE]

| Trạng thái | Ý nghĩa | Cho sửa? | Cho xác nhận? | Kho đã đổi? |
|---|---|---|---|---|
| `BAN_NHAP` | Đã lưu dữ liệu GR, đang chờ kiểm tra/xác nhận | Có | Có, nếu qua validation | Chưa |
| `DA_XAC_NHAN` | Xác nhận thành công, không có dòng bị từ chối | Không | Không | Đã cộng các dòng chấp nhận |
| `CHAP_NHAN_MOT_PHAN` | Xác nhận với cả dòng chấp nhận và từ chối | Không | Không | Chỉ cộng dòng chấp nhận |
| `DA_HUY` | Hủy phiếu nháp | Không | Không | Chưa |

```text
             +-------------+
             |   BAN_NHAP  |
             +-------------+
               |      |      \
    xác nhận   |      |       \ hủy nháp
   tất cả đạt  |      |        v
               v      |      DA_HUY
         DA_XAC_NHAN  |
                      | xác nhận: vừa đạt vừa từ chối
                      v
             CHAP_NHAN_MOT_PHAN
```

**Không có** nhánh `DA_XAC_NHAN → BAN_NHAP`; xác nhận thành công không được sửa hoặc hủy bằng thao tác hủy nháp. Không được xác nhận lần hai để cộng tồn hai lần.

### 6.2. Trạng thái kiểm tra theo từng dòng

`CHO_KIEM_TRA` → nhân viên quyết định `CHAP_NHAN` hoặc `TU_CHOI`. Chưa quyết định thì chỉ lưu nháp.

- `CHAP_NHAN`: đi vào tác động tồn kho sau xác nhận.
- `TU_CHOI`: vẫn lưu trong chứng từ để truy vết nhưng **không cộng kho**.

### 6.3. Trạng thái lô `inventory_batches`

- `CO_SAN` — sẵn có.
- `SAP_HET_HAN` — gần hết hạn nhưng còn đủ điều kiện bán theo quy tắc của hệ thống.
- `HET_HAN` — hết hạn, không được phân bổ bán.
- `BI_KHOA` — bị khóa, không được phân bổ bán.
- `HET_HANG` — hết tồn.

Lúc nhập: lô mới/đã có được tính lại trạng thái theo **hạn dùng và tồn**; nếu lô cũ đang `BI_KHOA`, nhập thêm không tự xóa cờ khóa. Một lô nhận ngày trước nhưng đã hết hạn ở **ngày hiện tại** vẫn không được xem là hàng có thể bán; cần phân biệt **ngày nhận** với **ngày kiểm tra khả dụng**.

---

## 7. Những quy tắc bắt buộc và các trường hợp bị từ chối

### 7.1. Quy tắc về PO

- Không có PO hợp lệ → không thể xác nhận.
- Chỉ PO `DA_DAT_HANG`/`DA_NHAN_MOT_PHAN` còn khả năng nhận hàng.
- Supplier trên GR phải trùng Supplier của PO.
- PO item trên từng dòng GR phải thực sự thuộc PO được chọn; không cho lấy Product ID tùy ý từ form thay cho PO item.
- Tổng **các dòng được chấp nhận** theo cùng PO item không được vượt `ordered_quantity - received_quantity`.

### 7.2. Quy tắc về dòng thuốc/lô

- Phải có ít nhất một dòng.
- `batchNumber` và `expiryDate` bắt buộc.
- `quantity` là số nguyên **lớn hơn 0**.
- `costPrice` **lớn hơn hoặc bằng 0**.
- Với `CHAP_NHAN`: `expiryDate` phải **sau** `receiptDate`; không chấp nhận thuốc đã hết hạn vào ngày nhận.
- Với `TU_CHOI`: `rejectionReason` không được rỗng.
- Lúc xác nhận không được còn `CHO_KIEM_TRA`.
- Lúc xác nhận phải tồn tại ít nhất một dòng `CHAP_NHAN`.
- Với `CHAP_NHAN`: `binId` bắt buộc; ngăn, kệ, khu phải đang hoạt động theo kiểm tra backend.
- Nếu lô trùng `(product_id,batch_number)` đã tồn tại nhưng hạn dùng khác nhau → lỗi, không gộp sai lô.

### 7.3. Ví dụ lỗi nghiệp vụ

| Tình huống | Kết quả đúng |
|---|---|
| Chọn PO đang `BAN_NHAP` | Không được tạo phiếu nhận hợp lệ; PO không hiển thị trong danh sách chọn |
| Ngày nhận là ngày tương lai | Báo lỗi, không lưu hợp lệ |
| Dòng thiếu số lô/hạn dùng | Báo lỗi |
| Nhận 60 khi PO chỉ còn 40 | Báo lỗi quá số lượng chưa nhận |
| Dòng chấp nhận nhưng ngày hết hạn ≤ ngày nhận | Không cho chấp nhận; cần từ chối |
| Dòng từ chối nhưng không ghi lý do | Báo lỗi |
| Dòng chấp nhận chưa chọn ngăn | Không cho xác nhận |
| Chọn ngăn/kệ/khu đã ngừng hoạt động | Không cho xác nhận |
| Có dòng còn `CHO_KIEM_TRA` | Có thể lưu nháp, không thể xác nhận |
| Tất cả các dòng đều `TU_CHOI` | Không thể xác nhận, có thể xử lý lại/hủy nháp |
| Xác nhận lại phiếu đã xác nhận | Chặn, **không cộng kho lần hai** |
| Lỗi SQL giữa transaction | Rollback, không để kho/PO/movement lệch |

**Không được mô phỏng “từ chối” như một lần trừ tồn:** thuốc chưa được chấp nhận chưa từng được cộng kho, nên không phát sinh lượng cần trừ trong luồng xác nhận GR.

### 7.4. Hai cách xác nhận phiếu nháp trong code hiện tại

**Cách A — Xác nhận từ trang chi tiết GR:**

- Form gửi `goodsReceiptId` và `confirmSource=saved`.
- Backend sử dụng **những dòng phiếu đã lưu trong database**, không đọc lại toàn bộ các dòng từ request rỗng.
- Thực hiện `GoodsReceiptDAO.confirmReceipt(id, userId)`.
- Nếu thất bại, điều hướng về form sửa với mã lỗi phù hợp.

**Cách B — Xác nhận ngay từ form Sửa GR:**

- Form gửi `goodsReceiptId`, `confirmSource=form` **và toàn bộ dữ liệu chỉnh sửa**.
- Backend chạy validation chặt (`strict=true`); lỗi form thì hiển thị lại form để sửa, vẫn giữ dữ liệu đã nhập.
- Nếu hợp lệ, `GoodsReceiptDAO.updateAndConfirmDraft` **lưu bản sửa và xác nhận trong cùng một transaction**; tránh trường hợp phần chỉnh sửa được lưu nhưng xác nhận thất bại.

**Không tồn tại thao tác “tạo phiếu mới rồi xác nhận luôn” bằng một lần submit trong form hiện tại.** Form tạo mới chỉ có **Lưu nháp**; muốn xác nhận phải có GR nháp đã lưu.

---

## 8. Cơ sở dữ liệu liên quan [SDS + CODE + migration]

### 8.1. Bảng dữ liệu và vai trò

| Bảng | Dữ liệu nghiệp vụ chính |
|---|---|
| `suppliers` | Thông tin nhà cung cấp |
| `products` | Thuốc/mặt hàng trong danh mục |
| `purchase_orders` | Header PO: supplier, người tạo, ngày đặt, trạng thái |
| `purchase_order_items` | Product, `ordered_quantity`, `received_quantity`, giá mua |
| `goods_receipts` | Header GR: supplier, PO, người nhận, ngày nhận, hóa đơn, ghi chú, trạng thái |
| `goods_receipt_items` | Chi tiết từng dòng: PO item, product, batch, expiry, quantity, cost, inspection, reason, bin |
| `inventory_batches` | Mỗi lô: Product, Supplier, batch number, expiry, on-hand tổng, reserved tổng, status |
| `storage_zones` | Các khu kho |
| `storage_racks` | Các kệ thuộc khu |
| `storage_bins` | Các ngăn thuộc kệ |
| `inventory_batch_locations` | Số lượng on-hand và reserved của từng `(batch_id,bin_id)` |
| `inventory_movements` | Nhật ký nhập kho và các biến động tồn khác |
| `users` | Người nhận, người thực hiện |

`storage_zones`, `storage_racks`, `storage_bins`, `inventory_batch_locations` và trường `goods_receipt_items.bin_id` **không nằm đầy đủ trong thiết kế bảng cũ của SDS**, mà được bổ sung ở `migration_001_warehouse_locations.sql`. Khi triển khai mới phải tính cả migration, không chỉ lấy 30 bảng của schema nền.

### 8.2. Quan hệ chính

```text
Supplier 1 ── N PurchaseOrder 1 ── N PurchaseOrderItem N ── 1 Product
                 │                          │
                 │                          └─ liên kết với từng GoodsReceiptItem
                 │
                 └─ 1 ── N GoodsReceipt 1 ── N GoodsReceiptItem
                                                       │
                                                       ├─ N ── 1 Product
                                                       ├─ N ── 1 InventoryBatch (sau xác nhận)
                                                       └─ N ── 1 StorageBin (dòng chấp nhận)

Product 1 ── N InventoryBatch 1 ── N InventoryBatchLocation N ── 1 StorageBin
StorageZone 1 ── N StorageRack 1 ── N StorageBin
InventoryBatch 1 ── N InventoryMovement (loại NHAP_KHO, tham chiếu GR)
```

Một PO có thể được nhận qua **nhiều GR**; một GR có thể có **nhiều dòng của cùng một Product/PO item** để phản ánh nhiều lô hoặc nhiều ngăn khác nhau.

### 8.3. Trước và sau khi nhập [DEMO]

Giả sử lô `LOT-A`, ngăn `A/R1/B03` trước nhập có:

| Giá trị | Trước | Sau nhập chấp nhận 30 |
|---|---:|---:|
| `inventory_batch_locations.on_hand_quantity` tại B03 | 12 | 42 |
| `inventory_batch_locations.reserved_quantity` tại B03 | 2 | 2 |
| `inventory_batches.on_hand_quantity` *(giả sử chỉ có ngăn này)* | 12 | 42 |
| `inventory_batches.reserved_quantity` | 2 | 2 |
| `purchase_order_items.received_quantity` | 20 | 50 |
| Inventory Movement `on_hand_change` | — | +30 |
| Inventory Movement `reserved_change` | — | 0 |

Khoảng chênh `on_hand - reserved` tại ngăn tăng từ 10 lên 40. Tuy nhiên lượng **có thể bán** vẫn phải qua bộ lọc trạng thái lô/hạn dùng, không được suy luận rằng mọi hàng vật lý đều có thể bán.

### 8.4. Nguyên tắc transaction và hai tầng tồn

- `inventory_batch_locations` lưu **phân bổ theo ngăn**.
- `inventory_batches.on_hand_quantity` và `.reserved_quantity` là **tổng của các ngăn**; không sửa tổng lô đơn lẻ rồi bỏ qua vị trí.
- Mọi thao tác cộng tồn phải dùng `LocationDAO.addOnHandAtBin(connection,...)` trong **cùng JDBC transaction** với xác nhận GR.
- `syncBatchTotals` tính lại tổng trên `inventory_batch_locations`.
- Lịch sử movement ghi trong cùng transaction.
- Nếu một bước fail → rollback cả cập nhật ngăn, lô, PO, GR và movement.

### 8.5. FEFO và tồn khả dụng (liên quan gián tiếp sau nhập)

Nhập kho **không cần tự động chọn lô theo FEFO** vì lô được nhập theo nhãn thực tế; FEFO chủ yếu áp dụng **khi phân bổ xuất/bán**.

Tài liệu quy tắc kho hiện tại nêu điều kiện lô có thể phân bổ:

```sql
b.status IN ('CO_SAN', 'SAP_HET_HAN')
AND b.expiry_date > CURDATE()
```

Do đó `Saleable` của sản phẩm về bản chất là tổng `(on_hand - reserved)` trên **những lô đủ điều kiện**. Lô hết hạn/đang bị khóa không bán được, kể cả khi còn tồn vật lý. `SAP_HET_HAN` vẫn có thể bán nếu chưa hết hạn và không bị chặn theo quy tắc hiện tại.

---

## 9. Giao diện mà nghiệp vụ hiện tại sử dụng [CODE]

> Phần này chỉ nhằm xác định **người dùng thấy gì và thao tác gì**, không phải yêu cầu xây mockup; mọi mô phỏng UI sau này phải dựa trên JSP/CSS gốc.

| Màn hình | Chức năng người dùng |
|---|---|
| Danh sách phiếu nhập | Xem, lọc `q`/`status`, `+ Nhập thuốc`, xem chi tiết, sửa nháp |
| Form tạo mới | Chọn PO, xem Supplier, điền ngày nhận/hóa đơn/ghi chú, thêm/xóa dòng, chọn kiểm tra/vị trí, **Lưu nháp** |
| Form sửa nháp | Sửa thông tin và dòng hàng, **Lưu nháp** hoặc **Xác nhận nhập** |
| Chi tiết phiếu | Xem các dòng, số lô, hạn, vị trí, kiểm tra; khi `BAN_NHAP` có nút **Sửa**, **Xác nhận nhập**, **Hủy nháp** |
| Chi tiết tồn kho/lô | Kiểm tra lô và vị trí đã tăng sau xác nhận |
| Lịch sử kho | Xem `NHAP_KHO` kèm người thao tác và trước/sau |

**Các trạng thái thông báo quan trọng:**

- Lưu nháp thành công: `Đã lưu nháp phiếu nhập — chưa có gì vào kho.`
- Cập nhật nháp thành công: `Đã cập nhật phiếu nhập nháp.`
- Hủy nháp thành công: `Đã hủy phiếu nhập nháp.`
- Xác nhận thành công: `Đã xác nhận phiếu nhập — số lượng chấp nhận đã vào kho.`

**Các tương tác dễ bị làm sai khi giải thích:**

- Chọn PO trên form tạo mới **reload bằng GET**, không phải một endpoint JSON tải PO items.
- Chọn Zone/Rack gọi các endpoint JSON riêng để nạp Rack/Bin.
- Bấm **Thêm sản phẩm/Xóa dòng** là thay đổi giao diện với JavaScript, chưa ghi DB.
- Chọn `TU_CHOI` thì lý do từ chối bắt buộc, chọn `CHAP_NHAN` thì Bin bắt buộc.
- Chỉ `Lưu nháp`/`Xác nhận`/`Hủy nháp` mới ảnh hưởng tới bản ghi phiếu theo các thao tác tương ứng; **chỉ xác nhận** tác động tồn.

---

## 10. Luồng kỹ thuật đối chiếu với nghiệp vụ (để AI không tự tạo route)

> Đây là **bản đồ source** hỗ trợ giải thích, không phải hướng dẫn code lại hệ thống.

| Tác vụ | HTTP (sau context path) | Servlet / xử lý chính | Tác động |
|---|---|---|---|
| Mở danh sách | `GET /inventory/receipts` | `GoodsReceiptServlet.doGet → handleList` | Đọc GR, forward JSP danh sách |
| Lọc danh sách | `GET /inventory/receipts?q=...&status=...` | `handleList → GoodsReceiptDAO.findAll` | Đọc và hiển thị danh sách lọc |
| Tạo form | `GET /inventory/receipts?action=new` | `handleNewForm` | Đọc PO còn có thể nhận, forward form; chưa ghi DB |
| Chọn PO khi tạo | `GET /inventory/receipts?action=new&po=...` | `handleNewForm → loadPoContext` | Đọc Supplier, PO items để dựng lại form |
| Nạp kệ | `GET /inventory/locations?action=api-racks&zoneId=...` | `LocationServlet.handleApiRacks` | Trả JSON Rack |
| Nạp ngăn | `GET /inventory/locations?action=api-bins&rackId=...` | `LocationServlet.handleApiBins` | Trả JSON Bin |
| Lưu phiếu mới | `POST /inventory/receipts?action=create` | `handleCreate → GoodsReceiptDAO.createDraft` | INSERT nháp GR/items, chưa cộng kho |
| Xem chi tiết | `GET /inventory/receipts?action=detail&id=...` | `handleDetail` | Đọc GR/items, forward JSP chi tiết |
| Mở sửa | `GET /inventory/receipts?action=edit&id=...` | `handleEditForm` | Chỉ cho `BAN_NHAP` |
| Lưu nháp sửa | `POST /inventory/receipts?action=update` | `handleUpdate → GoodsReceiptDAO.updateDraft` | UPDATE nháp, chưa cộng kho |
| Xác nhận từ chi tiết | `POST /inventory/receipts?action=confirm` | `handleConfirm → confirmReceipt`, `confirmSource=saved` | Đọc bản nháp đã lưu và xác nhận bằng transaction |
| Xác nhận từ form sửa | `POST /inventory/receipts?action=confirm` | `handleConfirm → updateAndConfirmDraft`, `confirmSource=form` | Lưu + xác nhận nguyên tử |
| Hủy nháp | `POST /inventory/receipts?action=cancel` | `handleCancel → GoodsReceiptDAO.cancelDraft` | Chuyển `DA_HUY`, không cộng/trừ kho |

**Quy tắc Servlet/JSP hiện tại:** Java 17, Jakarta Servlet, Model 2 Servlet/JSP, JDBC/MySQL; `GoodsReceiptServlet` mapping `/inventory/receipts`, `LocationServlet` mapping `/inventory/locations`. JSP thuộc `WEB-INF` chỉ được forward từ servlet. Định tuyến qua query parameter `action` (không phải mọi thao tác dùng `MainController`). Các URL trong bảng **chưa kèm context path**, vì tên WAR/context thực tế phụ thuộc triển khai.

Các file gốc cần đối chiếu nếu AI được truy cập GitHub:

- [`GoodsReceiptServlet.java`](https://github.com/longv0208/Pharma_Flow/blob/main/src/java/controller/GoodsReceiptServlet.java)
- [`GoodsReceiptDAO.java`](https://github.com/longv0208/Pharma_Flow/blob/main/src/java/dao/GoodsReceiptDAO.java)
- [`PurchaseOrderServlet.java`](https://github.com/longv0208/Pharma_Flow/blob/main/src/java/controller/PurchaseOrderServlet.java)
- [`PurchaseOrderDAO.java`](https://github.com/longv0208/Pharma_Flow/blob/main/src/java/dao/PurchaseOrderDAO.java)
- [`LocationServlet.java`](https://github.com/longv0208/Pharma_Flow/blob/main/src/java/controller/LocationServlet.java)
- [`LocationDAO.java`](https://github.com/longv0208/Pharma_Flow/blob/main/src/java/dao/LocationDAO.java)
- [`goods-receipt-list.jsp`](https://github.com/longv0208/Pharma_Flow/blob/main/web/WEB-INF/views/admin/goods-receipt-list.jsp)
- [`goods-receipt-form.jsp`](https://github.com/longv0208/Pharma_Flow/blob/main/web/WEB-INF/views/admin/goods-receipt-form.jsp)
- [`goods-receipt-detail.jsp`](https://github.com/longv0208/Pharma_Flow/blob/main/web/WEB-INF/views/admin/goods-receipt-detail.jsp)
- [`warehouse-location-guide.md`](https://github.com/longv0208/Pharma_Flow/blob/main/docs/warehouse-location-guide.md)
- [`inventory-availability-rules.md`](https://github.com/longv0208/Pharma_Flow/blob/main/docs/inventory-availability-rules.md)
- [`migration_001_warehouse_locations.sql`](https://github.com/longv0208/Pharma_Flow/blob/main/sql/migration_001_warehouse_locations.sql)
- [`db_vi_full.sql`](https://github.com/longv0208/Pharma_Flow/blob/main/db_vi_full.sql)

---

## 11. Bộ tình huống kiểm thử nghiệp vụ (Acceptance Cases)

Mọi dữ liệu ở mục này đều là **[DEMO]**. Tách kiểm thử *logic nghiệp vụ* khỏi khẳng định đã chạy trên hệ thống thật.

| ID | Tình huống | Kết quả phải có |
|---|---|---|
| GR-01 | PO đã đặt, phiếu mới có một dòng đạt | Lưu nháp trước không tăng kho; xác nhận tăng đúng batch/bin và PO received |
| GR-02 | Nhập nhiều dòng/lô cho cùng PO item | Tổng accepted không vượt PO còn lại; mỗi dòng vào đúng lô/ngăn |
| GR-03 | Một lô đặt ở hai ngăn | Hai dòng cùng product/batch/expiry, khác Bin; tổng lô = tổng 2 ngăn |
| GR-04 | Có dòng đạt và dòng bị từ chối | Chỉ dòng đạt cộng kho; phiếu `CHAP_NHAN_MOT_PHAN` |
| GR-05 | Tất cả bị từ chối | Không cho xác nhận; không cộng kho |
| GR-06 | Vẫn còn `CHO_KIEM_TRA` | Lưu nháp được; xác nhận bị chặn |
| GR-07 | Hạn dùng ≤ ngày nhận cho dòng đạt | Không chấp nhận; yêu cầu từ chối |
| GR-08 | Thiếu Bin hoặc Bin ngưng hoạt động | Không xác nhận được |
| GR-09 | Nhận vượt PO | Không xác nhận được; mọi số lượng giữ nguyên |
| GR-10 | Cùng product + batch number, khác expiry | Báo `batchconflict`; rollback |
| GR-11 | Nhấn xác nhận hai lần | Chỉ lần đầu thay đổi kho; lần sau bị chặn |
| GR-12 | Chỉnh sửa/hủy nháp | Không phát sinh `NHAP_KHO`; không đổi `received_quantity` |
| GR-13 | Xác nhận từ form sửa | Lưu chỉnh sửa và cập nhật kho trong cùng transaction |
| GR-14 | Gặp lỗi database giữa confirm | Tất cả thay đổi rollback |
| GR-15 | Tài khoản không có quyền | Không truy cập được nghiệp vụ; điều hướng đăng nhập |
| GR-16 | Nhập vào lô đang `BI_KHOA` | Không tự gỡ khóa lô; tồn vật lý có thể thay đổi nhưng vẫn không bán được |
| GR-17 | Lô hết hạn theo ngày hiện tại | Không được đưa vào Saleable, kể cả còn On-hand vật lý |

### Checklist nghiệm thu nghiệp vụ

- [ ] Phân biệt rõ **PO đặt mua**, **GR nhận thực tế**, **Batch tồn kho** và **Movement lịch sử**.
- [ ] Phiếu chỉ nhận từ PO đủ điều kiện (`DA_DAT_HANG`/`DA_NHAN_MOT_PHAN`).
- [ ] Supplier lấy theo PO, không cho chọn lệch với PO.
- [ ] Có thể chia cùng Product thành nhiều dòng Batch/Bin.
- [ ] Có 3 lựa chọn kiểm tra; chỉ dòng `CHAP_NHAN` vào kho.
- [ ] Dòng `TU_CHOI` phải ghi lý do; dòng chấp nhận phải chọn Bin hoạt động.
- [ ] Lưu/sửa/hủy nháp **không tác động tồn và PO received**.
- [ ] Xác nhận kiểm tra lại ở backend; không chỉ dựa vào HTML required/JS.
- [ ] Xác nhận là transaction; không ghi dở dang.
- [ ] Tổng batch và tổng location luôn khớp.
- [ ] Movement `NHAP_KHO` chứa người thực hiện, before/after, tham chiếu GR và Bin.
- [ ] Trạng thái PO/GR đổi đúng theo số lượng và kết quả kiểm tra.
- [ ] Không nhập lặp khi người dùng xác nhận nhiều lần.
- [ ] Không hiểu nhầm hàng on-hand là hàng chắc chắn saleable.
- [ ] Những số liệu giả lập được đánh dấu `[DEMO]`.

---

## 12. Những điểm cần phân biệt giữa tài liệu và code

| Nguồn/tình huống | Tài liệu | Code hiện tại | Khi AI mô tả |
|---|---|---|---|
| Chọn Supplier | UC16 nói người nhận chọn Supplier | Form chọn PO, Supplier tự hiện theo PO | Dùng hành vi code; vẫn giải thích quan hệ Supplier |
| Nhận không có PO | SDS cho `purchase_order_id` nullable ở schema | Controller/confirm yêu cầu PO hợp lệ | Không dựng nghiệp vụ nhập tự do khi mô phỏng phiên bản hiện tại |
| Vị trí kho | SDS gốc có `storage_location` dạng text | Migration thêm Zone/Rack/Bin, `inventory_batch_locations`, `bin_id` | Ưu tiên mô hình vị trí mới |
| Tạo và xác nhận | SRS mô tả một quy trình nghiệp vụ liên tục | Code bắt buộc lưu nháp trước, sau đó xác nhận | Tách hai thời điểm rõ ràng |
| Hết hạn | SRS: không nhập/bán hàng không đạt | Code chặn chấp nhận hết hạn **tại ngày nhận**; Saleable lại kiểm tra **ngày hiện tại** | Giải thích riêng hai thời điểm |
| Bán/xuất sau nhập | SRS yêu cầu một kho thống nhất và FEFO | Code có điều kiện allocatable, reserved và từng Bin | Không coi `+On-hand` là `+Saleable` vô điều kiện |
| Trả hàng Supplier | Không nằm trong scope phiên bản đầu | Không có luồng Supplier Return trong GR | Không tự sáng tạo nút trả hàng/refund |
| AI purchase suggestion | Ngoài scope ban đầu | Enum PO có source `GOI_Y_AI`, không đồng nghĩa đã triển khai dự báo AI | Không quảng cáo tính năng AI Forecasting |

---

## 13. Hướng dẫn sử dụng tài liệu này khi giao AI

Tài liệu này là **nguồn nghiệp vụ của riêng luồng nhập kho**. Nếu bạn giao AI xây một màn hình tương tác theo `servlet_flow_explorer_prompt.md`, yêu cầu AI:

1. Sử dụng các quy tắc từ tài liệu này, và **đọc code GitHub thực tế trước khi lập trace** nếu có thể.
2. Không bỏ qua điều kiện `BAN_NHAP` hoặc nhầm nhánh `create` với `confirm`.
3. Không tự thêm field, endpoint, trạng thái, chức năng AI, trả hàng/hoàn tiền không được chứng minh trong source.
4. Chia triển khai theo thứ tự: **Danh sách phiếu nhập → Form tạo → Lưu nháp → Sửa nháp → Xác nhận → Đối chiếu tồn/movement → Nhánh lỗi**. Mỗi giai đoạn hoàn thiện rồi nghiệm thu mới chuyển sang giai đoạn tiếp theo.
5. Nếu không kết nối được DB hoặc không chạy được Tomcat, có thể dùng dữ liệu giả lập **[DEMO]**, nhưng không được nói đã chạy thử nghiệp vụ thực tế.

### Một câu mô tả ngắn gọn để AI hiểu yêu cầu

> “Luồng nhập kho PharmaFlow là quy trình nhân viên nhận hàng theo PO, ghi nhận từng lô và kết quả kiểm tra, lưu GR ở trạng thái nháp, sau đó xác nhận trong một JDBC transaction. Chỉ các dòng được chấp nhận mới cộng tồn vào đúng Zone/Rack/Bin, đồng bộ tổng lô, tăng số lượng đã nhận của PO, ghi movement NHAP_KHO và cập nhật trạng thái. Mọi lỗi phải chặn xác nhận/rollback; thao tác nháp và dòng từ chối không cộng tồn. Hãy dùng source code hiện tại làm chuẩn cho các tương tác kỹ thuật.”

---

## 14. Nguồn tham chiếu

**Tài liệu người dùng cung cấp:**

- [PharmaFlow – Project Requirements / Use Cases](https://docs.google.com/document/d/1PXKHIw4ibg3pqiTHl0HeoVPXmyI4Kq1jntOKMsfu8z8/edit)
- [PharmaFlow – Software Design Specification (SDS)](https://docs.google.com/document/d/118Og5wsO6zSuoNSD2EsSSZevCsZva1qNl3bwsch8qgI/edit)
- [Repository PharmaFlow](https://github.com/longv0208/Pharma_Flow)

**Phạm vi đã đối chiếu:** UC16 Receive Stock, UC17 Manage Inventory Batches, UC20 Inventory History, BR-01/02/03/04/05; SDS database `goods_receipts`, `goods_receipt_items`, `purchase_orders`, `purchase_order_items`, `inventory_batches`, `inventory_movements`; source `GoodsReceiptServlet`, `GoodsReceiptDAO`, `PurchaseOrderDAO`, `LocationServlet`, `LocationDAO` cùng các JSP liên quan; `docs/warehouse-location-guide.md`, `docs/inventory-availability-rules.md`, migration vị trí kho.

**Giới hạn kiểm chứng:** Đây là tài liệu tổng hợp từ yêu cầu, thiết kế và **phân tích source tĩnh**. Không hàm ý đã chạy kiểm thử end-to-end trong Tomcat/MySQL hoặc xác minh dữ liệu thật của người dùng. Cần đối chiếu lại nếu repository thay đổi về sau.
