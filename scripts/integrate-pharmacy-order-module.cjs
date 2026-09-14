const fs = require('fs');
const path = require('path');

const root = process.cwd();

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, content) => fs.writeFileSync(path.join(root, file), content, 'utf8');

function patch(file, marker, replacement, label) {
  const content = read(file);
  if (!content.includes(marker)) {
    throw new Error(`Patch marker not found: ${file} -> ${label}`);
  }
  write(file, content.replace(marker, replacement));
}

function patchAll(file, marker, replacement, label) {
  const content = read(file);
  if (!content.includes(marker)) {
    throw new Error(`Patch marker not found: ${file} -> ${label}`);
  }
  write(file, content.split(marker).join(replacement));
}

patch(
  'src/types.ts',
  "export type UserRole = 'customer' | 'courier' | 'admin';",
  "export type UserRole = 'customer' | 'courier' | 'admin';\n\nexport type OrderType = 'standard' | 'pharmacy';",
  'OrderType'
);

patch(
  'src/types.ts',
  "  id: string;\n  customerId: string;",
  "  id: string;\n  orderType?: OrderType;\n  customerId: string;",
  'OrderType field'
);

patch(
  'src/types.ts',
  "  estimatedDeliveryMinutes?: number;\n\n  deliveryProof?: DeliveryProof;",
  "  estimatedDeliveryMinutes?: number;\n\n  pharmacyName?: string;\n  pharmacyAddress?: string;\n  pharmacyProduct?: string;\n  pharmacyProductDescription?: string;\n  pharmacyQuantity?: number;\n  pharmacyRecipientName?: string;\n  pharmacyRecipientPhone?: string;\n  pharmacyDeliveryType?: 'Standart Teslimat' | 'Acil Teslimat';\n  pharmacyPaymentMethod?: 'Nakit';\n  pharmacyPrescriptionPath?: string;\n  pharmacyPrescriptionFileName?: string;\n\n  deliveryProof?: DeliveryProof;",
  'pharmacy fields'
);

patch(
  'src/components/NewOrderModal.tsx',
  "          id: generatedOrderId,\n\n          customerId:",
  "          id: generatedOrderId,\n\n          orderType: \"standard\",\n\n          customerId:",
  'standard orderType'
);

patch(
  'src/App.tsx',
  'import { NewOrderModal } from "./components/NewOrderModal";\n',
  'import { NewOrderModal } from "./components/NewOrderModal";\nimport { PharmacyOrderPanel } from "./components/PharmacyOrderPanel";\n',
  'PharmacyOrderPanel import'
);

patch(
  'src/App.tsx',
  '  const [isNewOrderOpen, setIsNewOrderOpen] =\n    useState(false);\n',
  '  const [isNewOrderOpen, setIsNewOrderOpen] =\n    useState(false);\n\n  const [isPharmacyOrderOpen, setIsPharmacyOrderOpen] =\n    useState(false);\n',
  'pharmacy state'
);

patch(
  'src/App.tsx',
  '  const handleOpenNewOrder = (\n    prefill?: Partial<Order>\n  ) => {\n    setNewOrderPrefill(\n      prefill\n    );\n\n    setIsNewOrderOpen(\n      true\n    );\n  };\n',
  '  const handleOpenNewOrder = (\n    prefill?: Partial<Order>\n  ) => {\n    setNewOrderPrefill(\n      prefill\n    );\n\n    setIsNewOrderOpen(\n      true\n    );\n  };\n\n  const handleOpenPharmacyOrder = () => {\n    if (currentUser?.role !== "customer") return;\n    setIsPharmacyOrderOpen(true);\n  };\n',
  'pharmacy handler'
);

patch(
  'src/App.tsx',
  '                    onOpenNewOrder={\n                      handleOpenNewOrder\n                    }\n                    onOpenAI={() =>',
  '                    onOpenNewOrder={\n                      handleOpenNewOrder\n                    }\n                    onOpenPharmacyOrder={\n                      handleOpenPharmacyOrder\n                    }\n                    onOpenAI={() =>',
  'CustomerHome pharmacy prop'
);

patch(
  'src/App.tsx',
  '        onOrderCreated={(\n          order\n        ) => {\n          setActiveTab(\n            "orders"\n          );\n\n          setSelectedOrderId(\n            order.id\n          );\n        }}\n      />\n\n      <NotificationDrawer',
  '        onOrderCreated={(\n          order\n        ) => {\n          setActiveTab(\n            "orders"\n          );\n\n          setSelectedOrderId(\n            order.id\n          );\n        }}\n      />\n\n      <PharmacyOrderPanel\n        isOpen={isPharmacyOrderOpen}\n        onClose={() => setIsPharmacyOrderOpen(false)}\n        currentUser={currentUser}\n        pricing={pricing}\n        onOrderCreated={(order) => {\n          setIsPharmacyOrderOpen(false);\n          setActiveTab("orders");\n          setSelectedOrderId(order.id);\n        }}\n      />\n\n      <NotificationDrawer',
  'PharmacyOrderPanel render'
);

patch(
  'src/components/CustomerHome.tsx',
  '  Truck,\n  Zap,\n} from "lucide-react";',
  '  Truck,\n  Zap,\n  Pill,\n} from "lucide-react";',
  'Pill import'
);

patch(
  'src/components/CustomerHome.tsx',
  'interface Props {\n  onOpenNewOrder: (\n    prefill?: Partial<Order>\n  ) => void;',
  'interface Props {\n  onOpenNewOrder: (\n    prefill?: Partial<Order>\n  ) => void;\n  onOpenPharmacyOrder: () => void;',
  'CustomerHome prop'
);

patch(
  'src/components/CustomerHome.tsx',
  'export function CustomerHome({\n  onOpenNewOrder,\n  onOpenAI,',
  'export function CustomerHome({\n  onOpenNewOrder,\n  onOpenPharmacyOrder,\n  onOpenAI,',
  'CustomerHome destructuring'
);

patch(
  'src/components/CustomerHome.tsx',
  '                <button\n                  type="button"\n                  onClick={onOpenAI}\n                  className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-[#3A3A43] bg-white/[0.03] px-6 text-sm font-bold text-white transition hover:border-[#D6A84F]/40 hover:bg-white/[0.06]"\n                >\n                  <Bot\n                    size={18}\n                    className="text-[#D6A84F]"\n                  />\n\n                  Trustline AI\n                </button>',
  '                <button\n                  type="button"\n                  onClick={onOpenAI}\n                  className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-[#3A3A43] bg-white/[0.03] px-6 text-sm font-bold text-white transition hover:border-[#D6A84F]/40 hover:bg-white/[0.06]"\n                >\n                  <Bot\n                    size={18}\n                    className="text-[#D6A84F]"\n                  />\n\n                  Trustline AI\n                </button>\n\n                <button\n                  type="button"\n                  onClick={onOpenPharmacyOrder}\n                  className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-6 text-sm font-black text-emerald-300 transition hover:border-emerald-400/50 hover:bg-emerald-500/10"\n                >\n                  <Pill size={18} />\n                  Eczane Siparişi\n                </button>',
  'CustomerHome pharmacy button'
);

patch(
  'src/components/AdminPanel.tsx',
  '  Order,\n  OrderStatus,\n  PricingConfig,',
  '  Order,\n  OrderStatus,\n  OrderType,\n  PricingConfig,',
  'Admin OrderType import'
);

patch(
  'src/components/AdminPanel.tsx',
  '  const [statusFilter, setStatusFilter] =\n    useState<"Tümü" | OrderStatus>("Tümü");\n',
  '  const [statusFilter, setStatusFilter] =\n    useState<"Tümü" | OrderStatus>("Tümü");\n\n  const [orderTypeFilter, setOrderTypeFilter] =\n    useState<"all" | OrderType>("all");\n',
  'Admin order type state'
);

patch(
  'src/components/AdminPanel.tsx',
  '          const matchesStatus =\n            statusFilter ===\n              "Tümü" ||\n            order.status ===\n              statusFilter;\n\n          return (\n            matchesSearch &&\n            matchesStatus\n          );',
  '          const matchesStatus =\n            statusFilter ===\n              "Tümü" ||\n            order.status ===\n              statusFilter;\n\n          const normalizedOrderType = order.orderType ?? "standard";\n          const matchesOrderType =\n            orderTypeFilter === "all" ||\n            normalizedOrderType === orderTypeFilter;\n\n          return (\n            matchesSearch &&\n            matchesStatus &&\n            matchesOrderType\n          );',
  'Admin order type filter logic'
);

patch(
  'src/components/AdminPanel.tsx',
  '      safeOrders,\n      searchTerm,\n      statusFilter,\n    ]);',
  '      safeOrders,\n      searchTerm,\n      statusFilter,\n      orderTypeFilter,\n    ]);',
  'Admin order type dependencies'
);

patch(
  'src/components/AdminPanel.tsx',
  '              </select>\n            </div>\n\n            <div className="grid gap-3">',
  '              </select>\n\n              <div className="flex flex-wrap gap-2">\n                <button type="button" onClick={() => setOrderTypeFilter("all")} className={`rounded-xl border px-4 py-3 text-sm font-bold ${orderTypeFilter === "all" ? "border-[#D6A84F] bg-[#D6A84F]/10 text-[#D6A84F]" : "border-[#303036] bg-[#19191E] text-[#999999]"}`}>Tümü</button>\n                <button type="button" onClick={() => setOrderTypeFilter("standard")} className={`rounded-xl border px-4 py-3 text-sm font-bold ${orderTypeFilter === "standard" ? "border-[#D6A84F] bg-[#D6A84F]/10 text-[#D6A84F]" : "border-[#303036] bg-[#19191E] text-[#999999]"}`}>Normal Siparişler</button>\n                <button type="button" onClick={() => setOrderTypeFilter("pharmacy")} className={`rounded-xl border px-4 py-3 text-sm font-bold ${orderTypeFilter === "pharmacy" ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : "border-[#303036] bg-[#19191E] text-[#999999]"}`}>Eczane Siparişleri</button>\n              </div>\n            </div>\n\n            <div className="grid gap-3">',
  'Admin filter controls'
);

patch(
  'src/components/AdminPanel.tsx',
  '                          <StatusBadge\n                            status={\n                              order.status\n                            }\n                          />',
  '                          <StatusBadge\n                            status={\n                              order.status\n                            }\n                          />\n\n                          {(order.orderType ?? "standard") === "pharmacy" ? (\n                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[8px] font-black uppercase tracking-wide text-emerald-300">💊 ECZANE SİPARİŞİ</span>\n                          ) : (\n                            <span className="inline-flex items-center gap-1 rounded-full border border-[#303036] bg-[#101014] px-2 py-1 text-[8px] font-black uppercase tracking-wide text-[#8F8F99]">📦 NORMAL SİPARİŞ</span>\n                          )}',
  'Admin order badge'
);

patch(
  'src/components/AdminPanel.tsx',
  '              {selectedOrder.deliveryProof && (',
  '              {selectedOrder.orderType === "pharmacy" && (\n                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">\n                  <div className="mb-3 flex items-center gap-2 text-sm font-black text-emerald-300">\n                    💊 Eczane Siparişi\n                  </div>\n                  <div className="grid gap-3 text-sm md:grid-cols-2">\n                    <div><span className="text-xs text-[#777780]">Eczane:</span><div className="mt-1 font-bold text-white">{selectedOrder.pharmacyName || "-"}</div></div>\n                    <div><span className="text-xs text-[#777780]">Ürün:</span><div className="mt-1 font-bold text-white">{selectedOrder.pharmacyProduct || "-"} × {selectedOrder.pharmacyQuantity || 0}</div></div>\n                    <div><span className="text-xs text-[#777780]">Teslim alan:</span><div className="mt-1 font-bold text-white">{selectedOrder.pharmacyRecipientName || selectedOrder.receiverName || "-"}</div></div>\n                    <div><span className="text-xs text-[#777780]">Telefon:</span><div className="mt-1 font-bold text-white">{selectedOrder.pharmacyRecipientPhone || selectedOrder.customerPhone || "-"}</div></div>\n                    <div className="md:col-span-2"><span className="text-xs text-[#777780]">Reçete / belge:</span><div className="mt-1 break-all font-mono text-xs text-[#C8C8D0]">{selectedOrder.pharmacyPrescriptionFileName || "Belge eklenmedi"}</div></div>\n                  </div>\n                </div>\n              )}\n\n              {selectedOrder.deliveryProof && (',
  'Admin pharmacy detail'
);

patch(
  'src/components/CourierPanel.tsx',
  '<span className="font-mono text-xs font-black text-white">#{order.id}</span>',
  '<span className="font-mono text-xs font-black text-white">#{order.id}</span>\n                          {order.orderType === "pharmacy" && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[8px] font-black text-emerald-300">💊 ECZANE</span>}',
  'Courier pharmacy badge'
);

let storageRules = read('storage.rules');
if (!storageRules.includes('match /pharmacy-prescriptions/')) {
  const marker = '    match /{allPaths=**} {';
  if (!storageRules.includes(marker)) {
    throw new Error('Patch marker not found: storage.rules -> catchall');
  }

  storageRules = storageRules.replace(
    marker,
    `    match /pharmacy-prescriptions/{orderId}/{fileName} {\n      allow read: if signedIn();\n\n      allow create, update:\n        if signedIn()\n        && request.resource.size <= 10 * 1024 * 1024\n        && (\n          request.resource.contentType.matches('image/.*')\n          || request.resource.contentType == 'application/pdf'\n        );\n\n      allow delete: if isAdmin();\n    }\n\n${marker}`
  );

  write('storage.rules', storageRules);
}

console.log('Eczane sipariş modülü entegrasyonu tamamlandı.');
console.log('Dosyalar: types.ts, NewOrderModal.tsx, App.tsx, CustomerHome.tsx, AdminPanel.tsx, CourierPanel.tsx, storage.rules');
console.log('Yeni: src/components/PharmacyOrderPanel.tsx');
