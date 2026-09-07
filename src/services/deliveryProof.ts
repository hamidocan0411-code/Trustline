import {
  doc,
  updateDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "./firebase";

import type {
  DeliveryProof,
} from "../types";

export async function uploadDeliveryPhoto(
  _orderId: string,
  _file: File
): Promise<string> {
  throw new Error(
    "Teslim fotoğrafı V1 sürümünde devre dışıdır. Teslim kanıtı imza, teslim alan kişi ve not ile kaydedilir."
  );
}

export async function saveDeliveryProof(
  params: {
    orderId: string;
    receiverName: string;
    deliveryNote?: string;
    signature: string;
    photoFile?: File;
  }
): Promise<DeliveryProof> {
  if (!auth.currentUser) {
    throw new Error(
      "Firebase oturumu bulunamadı."
    );
  }

  const receiverName =
    params.receiverName.trim();

  if (!receiverName) {
    throw new Error(
      "Teslim alan kişinin adı zorunludur."
    );
  }

  if (!params.signature) {
    throw new Error(
      "Alıcı imzası zorunludur."
    );
  }

  const deliveredAt =
    new Date().toISOString();

  /*
   * V1'de Firebase Storage kullanılmadığı için
   * fotoğraf Firestore'a yüklenmez.
   *
   * İmza + teslim alan kişi + teslim notu
   * Firestore üzerinde saklanır.
   */

  const proof: DeliveryProof = {
    receiverName,
    ...(params.deliveryNote?.trim()
      ? {
          deliveryNote:
            params.deliveryNote.trim(),
        }
      : {}),
    signature:
      params.signature,
    deliveredAt,
  };

  await updateDoc(
    doc(
      db,
      "orders",
      params.orderId
    ),
    {
      deliveryProof: proof,

      deliveryPhoto: null,

      receiverName,

      deliveryNote:
        params.deliveryNote?.trim() ||
        "",

      signature:
        params.signature,

      deliveredAt,

      status:
        "Teslim Edildi",

      updatedAt:
        deliveredAt,
    }
  );

  return proof;
}