import {
  addDoc,
  collection,
  serverTimestamp,
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
  const user =
    auth.currentUser;

  if (!user) {
    throw new Error(
      'Teslimat kanıtı kaydetmek için giriş yapmalısınız.'
    );
  }

  if (
    !proof.receiverName.trim()
  ) {
    throw new Error(
      'Teslim alan kişinin adı zorunludur.'
    );
  }

  const proofRef =
    collection(
      db,
      'orders',
      order.id,
      'deliveryProofs'
    );

  await addDoc(
    proofRef,
    {
      orderId: order.id,
      courierId: user.uid,
      receiverName:
        proof.receiverName.trim(),
      deliveryNote:
        proof.deliveryNote.trim(),
      signature:
        proof.signature || '',
      deliveryPhoto: null,
      deliveredAt:
        serverTimestamp(),
      status:
        'Teslim Edildi',
    }
  );
}