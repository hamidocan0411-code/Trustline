import {
  addDoc,
  collection,
  doc,
  updateDoc,
} from 'firebase/firestore';

import { auth, db } from './firebase';

import type { Order } from '../types';

export interface DeliveryProofData {
  receiverName: string;
  deliveryNote: string;
  signature: string;
}

export async function saveDeliveryProof(
  order: Order,
  proof: DeliveryProofData
): Promise<void> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error(
      'Teslimat kanıtı kaydetmek için giriş yapmalısınız.'
    );
  }

  if (!order.id) {
    throw new Error(
      'Teslimat kanıtı için sipariş ID gerekli.'
    );
  }

  if (order.courierId && user.uid !== order.courierId) {
    throw new Error(
      'Bu siparişin teslimat kanıtını yalnızca atanan kurye kaydedebilir.'
    );
  }

  if (!proof.receiverName.trim()) {
    throw new Error(
      'Teslim alan kişinin adı zorunludur.'
    );
  }

  const deliveredAt = new Date().toISOString();
  const receiverName = proof.receiverName.trim();
  const deliveryNote = proof.deliveryNote.trim();
  const signature = proof.signature || '';

  const proofData = {
    orderId: order.id,
    courierId: user.uid,
    receiverName,
    deliveryNote,
    signature,
    deliveryPhoto: null,
    deliveredAt,
    status: 'Teslim Edildi' as const,
  };

  const proofRef = collection(
    db,
    'orders',
    order.id,
    'deliveryProofs'
  );

  await addDoc(proofRef, proofData);

  await updateDoc(
    doc(db, 'orders', order.id),
    {
      status: 'Teslim Edildi',
      receiverName,
      deliveryNote,
      signature,
      deliveryPhoto: null,
      deliveredAt,
      deliveryProof: {
        receiverName,
        deliveryNote,
        signature,
        deliveryPhoto: null,
        deliveredAt,
      },
      courierId: order.courierId || user.uid,
      courierName: order.courierName || '',
      courierPhone: order.courierPhone || '',
      updatedAt: deliveredAt,
    }
  );
}
