import {
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";

import {
  doc,
  updateDoc,
} from "firebase/firestore";

import {
  auth,
  db,
  storage as firebaseStorage,
} from "./firebase";

import type {
  DeliveryProof,
} from "../types";

function createStoragePath(
  orderId: string,
  file: File
): string {
  const extension =
    file.name.split(".").pop() ||
    "jpg";

  const safeExtension =
    extension
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 8) || "jpg";

  return `delivery-proofs/${orderId}/delivery-${Date.now()}.${safeExtension}`;
}

export async function uploadDeliveryPhoto(
  orderId: string,
  file: File
): Promise<string> {
  if (!auth.currentUser) {
    throw new Error(
      "Firebase oturumu bulunamadı."
    );
  }

  if (
    !file.type.startsWith("image/")
  ) {
    throw new Error(
      "Yalnızca görsel dosyaları yüklenebilir."
    );
  }

  if (
    file.size >
    10 * 1024 * 1024
  ) {
    throw new Error(
      "Fotoğraf boyutu 10 MB'dan büyük olamaz."
    );
  }

  const path =
    createStoragePath(
      orderId,
      file
    );

  const storageRef =
    ref(
      firebaseStorage,
      path
    );

  await uploadBytes(
    storageRef,
    file,
    {
      contentType:
        file.type,
      cacheControl:
        "public,max-age=31536000",
    }
  );

  return getDownloadURL(
    storageRef
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

  let deliveryPhoto:
    | string
    | undefined;

  if (params.photoFile) {
    deliveryPhoto =
      await uploadDeliveryPhoto(
        params.orderId,
        params.photoFile
      );
  }

  const deliveredAt =
    new Date().toISOString();

  const proof: DeliveryProof = {
    ...(deliveryPhoto
      ? {
          deliveryPhoto,
        }
      : {}),
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
      deliveryPhoto:
        deliveryPhoto || null,
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