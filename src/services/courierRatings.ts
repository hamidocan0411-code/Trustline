import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "./firebase";
import type { CourierRating } from "../types";

export interface CourierRatingSummary {
  average: number;
  count: number;
  total: number;
}

const emptySummary: CourierRatingSummary = {
  average: 0,
  count: 0,
  total: 0,
};

const normalizeScore = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(1, Math.min(5, Math.round(value)));
};

export function getCourierRatingSummary(
  ratings: CourierRating[]
): CourierRatingSummary {
  const valid = ratings.filter(
    (rating) =>
      Number.isFinite(Number(rating.score)) &&
      Number(rating.score) >= 1 &&
      Number(rating.score) <= 5
  );

  const total = valid.reduce(
    (sum, rating) => sum + Number(rating.score),
    0
  );

  return {
    average:
      valid.length > 0
        ? Number((total / valid.length).toFixed(2))
        : 0,
    count: valid.length,
    total,
  };
}

export function subscribeToCourierRatingSummary(
  courierId: string,
  onChange: (summary: CourierRatingSummary) => void
): () => void {
  if (!courierId) {
    onChange(emptySummary);
    return () => {};
  }

  const ratingsQuery = query(
    collection(db, "courierRatings"),
    where("courierId", "==", courierId)
  );

  return onSnapshot(
    ratingsQuery,
    (snapshot) => {
      const ratings: CourierRating[] = snapshot.docs.map(
        (item) => ({
          ...(item.data() as CourierRating),
          id: item.id,
        })
      );

      onChange(getCourierRatingSummary(ratings));
    },
    (error) => {
      console.error(
        "❌ Kurye puan listener hatası:",
        error
      );

      onChange(emptySummary);
    }
  );
}

export function subscribeToAllCourierRatings(
  onChange: (ratings: CourierRating[]) => void
): () => void {
  return onSnapshot(
    collection(db, "courierRatings"),
    (snapshot) => {
      onChange(
        snapshot.docs.map((item) => ({
          ...(item.data() as CourierRating),
          id: item.id,
        }))
      );
    },
    (error) => {
      console.error(
        "❌ Tüm kurye puanları listener hatası:",
        error
      );

      onChange([]);
    }
  );
}

export async function getCourierRatingForOrder(
  orderId: string
): Promise<CourierRating | null> {
  if (!orderId) return null;

  const snapshot = await getDoc(
    doc(db, "courierRatings", orderId)
  );

  if (!snapshot.exists()) {
    return null;
  }

  return {
    ...(snapshot.data() as CourierRating),
    id: snapshot.id,
  };
}

export async function submitCourierRating(input: {
  orderId: string;
  courierId: string;
  score: number;
  comment?: string;
}): Promise<CourierRating> {
  const firebaseUser = auth.currentUser;

  if (!firebaseUser) {
    throw new Error(
      "Puan vermek için giriş yapmalısınız."
    );
  }

  if (!input.orderId || !input.courierId) {
    throw new Error(
      "Sipariş ve kurye bilgisi gerekli."
    );
  }

  const orderRef = doc(db, "orders", input.orderId);
  const orderSnapshot = await getDoc(orderRef);

  if (!orderSnapshot.exists()) {
    throw new Error("Sipariş bulunamadı.");
  }

  const order = orderSnapshot.data() as {
    customerId?: string;
    courierId?: string | null;
    status?: string;
  };

  if (order.customerId !== firebaseUser.uid) {
    throw new Error(
      "Bu sipariş için puan verme yetkiniz yok."
    );
  }

  if (order.courierId !== input.courierId) {
    throw new Error(
      "Kurye bilgisi doğrulanamadı."
    );
  }

  if (order.status !== "Teslim Edildi") {
    throw new Error(
      "Kurye yalnızca teslim edilmiş siparişlerden sonra puanlanabilir."
    );
  }

  const score = normalizeScore(
    Number(input.score)
  );

  if (score < 1 || score > 5) {
    throw new Error(
      "Puan 1 ile 5 arasında olmalıdır."
    );
  }

  const ratingRef = doc(
    db,
    "courierRatings",
    input.orderId
  );

  const existing =
    await getDoc(ratingRef);

  if (existing.exists()) {
    throw new Error(
      "Bu sipariş için daha önce puan verdiniz."
    );
  }

  const createdAt =
    new Date().toISOString();

  const rating: CourierRating = {
    id: input.orderId,
    orderId: input.orderId,
    courierId: input.courierId,
    customerId: firebaseUser.uid,
    customerName:
      firebaseUser.displayName || "",
    score,
    comment:
      input.comment?.trim() || "",
    createdAt,
  };

  await setDoc(ratingRef, {
    orderId: rating.orderId,
    courierId: rating.courierId,
    customerId: rating.customerId,
    customerName: rating.customerName,
    score: rating.score,
    comment: rating.comment,
    createdAt: rating.createdAt,
  });

  return rating;
}
