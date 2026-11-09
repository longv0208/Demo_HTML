/**
 * Dữ liệu DEMO cho form nhập kho — không phải DB thật.
 * Hai PO receivable giống findReceivable() (DA_DAT_HANG / DA_NHAN_MOT_PHAN).
 */
window.SFE_DEMO = {
  locations: {
    zones: [
      { id: "1", code: "A" },
      { id: "2", code: "B" }
    ],
    racksByZone: {
      "1": [
        { id: "11", code: "A-01" },
        { id: "12", code: "A-02" }
      ],
      "2": [
        { id: "21", code: "B-01" }
      ]
    },
    binsByRack: {
      "11": [
        { id: "111", code: "A-01-01" },
        { id: "112", code: "A-01-02" }
      ],
      "12": [{ id: "121", code: "A-02-01" }],
      "21": [{ id: "211", code: "B-01-01" }]
    }
  },

  purchaseOrders: {
    "12": {
      id: "12",
      supplierName: "Công ty Dược ABC",
      supplierId: 3,
      orderDate: "2026-11-01",
      status: "DA_NHAN_MOT_PHAN",
      items: [
        {
          poItemId: "101",
          productId: "55",
          name: "Paracetamol 500mg (PARA500)",
          ordered: 100,
          received: 20,
          remaining: 80,
          cost: "15000"
        },
        {
          poItemId: "102",
          productId: "56",
          name: "Vitamin C 1000mg (VITC1K)",
          ordered: 50,
          received: 0,
          remaining: 50,
          cost: "22000"
        }
      ]
    },
    "15": {
      id: "15",
      supplierName: "MedSupply XYZ",
      supplierId: 7,
      orderDate: "2026-11-05",
      status: "DA_DAT_HANG",
      items: [
        {
          poItemId: "201",
          productId: "70",
          name: "Amoxicillin 500mg (AMOX500)",
          ordered: 80,
          received: 0,
          remaining: 80,
          cost: "18000"
        },
        {
          poItemId: "202",
          productId: "71",
          name: "Omeprazole 20mg (OME20)",
          ordered: 40,
          received: 0,
          remaining: 40,
          cost: "25000"
        }
      ]
    }
  },

  closedOrders: {
    "88": {
      id: "88",
      supplierName: "NCC đã giao xong",
      supplierId: 9,
      orderDate: "2026-10-01",
      status: "DA_HOAN_THANH",
      items: [
        {
          poItemId: "301",
          productId: "80",
          name: "Ibuprofen 400mg (IBU400)",
          ordered: 10,
          received: 10,
          remaining: 0,
          cost: "12000"
        }
      ]
    }
  }
};
