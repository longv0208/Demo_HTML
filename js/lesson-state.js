/**
 * Nguồn state thống nhất cho Guided + Explorer.
 * Form, tour, mô phỏng DB, hành động data-flow — một chỗ.
 * Không phải session Java thật; sessionStorage chỉ giữ bài học [DEMO].
 */
(function (global) {
  "use strict";

  var KEY = "sfe_lesson_v2";
  var listeners = [];

  function defaultForm() {
    return {
      purchaseOrderId: "12",
      receiptDate: "2026-11-09",
      invoiceNumber: "HD-DEMO-001",
      note: "[DEMO] Phiếu nhập thử",
      items: [
        {
          poItemId: "101",
          batchNumber: "LOT-A01",
          expiryDate: "2027-06-30",
          quantity: "40",
          costPrice: "15000",
          zoneId: "1",
          rackId: "11",
          binId: "111",
          inspectionResult: "CHO_KIEM_TRA",
          rejectionReason: ""
        }
      ]
    };
  }

  function defaultSim() {
    var catalog = global.SFE_DEMO || {};
    var poReceived = {};
    Object.keys(catalog.purchaseOrders || {}).forEach(function (id) {
      (catalog.purchaseOrders[id].items || []).forEach(function (it) {
        poReceived[it.poItemId] = it.received;
      });
    });
    return {
      goodsReceipts: [],
      goodsReceiptItems: [],
      nextReceiptId: 901,
      inventoryBatches: [],
      inventoryBatchLocations: [],
      inventoryMovements: [],
      poReceived: poReceived
    };
  }

  function defaultSnap() {
    return {
      tourIndex: 0,
      mode: "guided",
      lastAction: { type: "idle", fieldId: "purchaseOrderId" },
      traceIndex: 0,
      traceBranch: "auto",
      demoScenario: null,
      form: defaultForm(),
      sim: defaultSim(),
      lastResult: null
    };
  }

  var snap = defaultSnap();

  function load() {
    try {
      var raw = sessionStorage.getItem(KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed && parsed.form) {
        snap.form = parsed.form;
        snap.tourIndex = parsed.tourIndex || 0;
        snap.mode = parsed.mode === "explorer" ? "explorer" : "guided";
        if (parsed.sim) snap.sim = parsed.sim;
      }
    } catch (e) {}
  }

  function persist() {
    try {
      sessionStorage.setItem(
        KEY,
        JSON.stringify({
          form: snap.form,
          tourIndex: snap.tourIndex,
          mode: snap.mode === "explorer" ? "explorer" : "guided",
          sim: snap.sim
        })
      );
    } catch (e) {}
  }

  function notify() {
    persist();
    listeners.forEach(function (fn) {
      try {
        fn(snap);
      } catch (e) {}
    });
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  load();

  global.SFE_LESSON = {
    GH: "https://github.com/longv0208/Pharma_Flow/blob/main/",
    defaultForm: defaultForm,
    defaultSim: defaultSim,

    get: function () {
      return snap;
    },
    getForm: function () {
      return snap.form;
    },
    setForm: function (form) {
      snap.form = form;
      notify();
    },
    patchForm: function (patch) {
      Object.keys(patch).forEach(function (k) {
        snap.form[k] = patch[k];
      });
      notify();
    },

    getTourIndex: function () {
      return snap.tourIndex;
    },
    setTourIndex: function (i) {
      snap.tourIndex = i;
      persist();
    },

    getMode: function () {
      return snap.mode;
    },
    setMode: function (m) {
      snap.mode = m;
      persist();
    },

    getAction: function () {
      return snap.lastAction;
    },
    setAction: function (action) {
      snap.lastAction = action;
    },

    getTrace: function () {
      return { index: snap.traceIndex, branch: snap.traceBranch };
    },
    setTraceIndex: function (i) {
      snap.traceIndex = i;
    },
    setTraceBranch: function (b) {
      snap.traceBranch = b;
    },

    getScenario: function () {
      return snap.demoScenario;
    },
    setScenario: function (id) {
      snap.demoScenario = id;
    },

    getSim: function () {
      return snap.sim;
    },
    getResult: function () {
      return snap.lastResult;
    },
    setResult: function (r) {
      snap.lastResult = r;
    },

    applyDraftSuccess: function (form) {
      var sim = snap.sim;
      var id = sim.nextReceiptId++;
      var catalog = global.SFE_DEMO || {};
      var po = (catalog.purchaseOrders || {})[form.purchaseOrderId] ||
        (catalog.closedOrders || {})[form.purchaseOrderId];
      sim.goodsReceipts.push({
        id: id,
        purchaseOrderId: form.purchaseOrderId,
        supplierId: po ? po.supplierId : null,
        receiptDate: form.receiptDate,
        invoiceNumber: form.invoiceNumber,
        note: form.note,
        status: "BAN_NHAP"
      });
      (form.items || []).forEach(function (it) {
        sim.goodsReceiptItems.push({
          goodsReceiptId: id,
          poItemId: it.poItemId,
          binId: it.binId || null,
          batchNumber: it.batchNumber,
          expiryDate: it.expiryDate,
          quantity: it.quantity,
          costPrice: it.costPrice,
          inspectionResult: it.inspectionResult,
          rejectionReason: it.rejectionReason,
          batchId: null
        });
      });
      snap.lastResult = { kind: "created", receiptId: id };
      persist();
      return id;
    },

    resetLesson: function () {
      var mode = snap.mode === "explorer" ? "explorer" : "guided";
      snap = defaultSnap();
      snap.mode = mode;
      try {
        sessionStorage.removeItem(KEY);
        sessionStorage.removeItem("sfe_wizard_form_v1");
      } catch (e) {}
      persist();
      return snap;
    },

    subscribe: function (fn) {
      listeners.push(fn);
    },
    persist: persist,
    clone: clone
  };
})(window);
