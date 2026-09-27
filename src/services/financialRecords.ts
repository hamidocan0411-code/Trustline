import { collection, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";

export interface FinancialRecord {
  id: string;
  orderId: string;
  amount: number;
  currency: "TRY";
  revenueDate: string;
  status: "Teslim Edildi";
  revenueType: "delivery";
  createdAt: string;
  companyId?: string;
  customerType?: "individual" | "corporate";
  customerId?: string;
}

export function subscribeToFinancialRecords(
  callback: (records: FinancialRecord[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, "financialRecords"),
    (snapshot) => {
      const records = snapshot.docs
        .map((item) => ({
          ...(item.data() as Omit<FinancialRecord, "id">),
          id: item.id,
        }))
        .filter(
          (record) =>
            record.status === "Teslim Edildi" &&
            Number.isFinite(Number(record.amount)) &&
            !!record.revenueDate
        );

      callback(records);
    },
    (error) => {
      console.error("Finansal kayıt listener hatası:", error);
      callback([]);
    }
  );
}
