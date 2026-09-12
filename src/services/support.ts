import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "./firebase";

export type SupportTicketStatus =
  | "bekliyor"
  | "aktif"
  | "kapalı";

export interface SupportTicket {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  status: SupportTicketStatus;
  assignedAdminId?: string;
  createdAt: string;
  acceptedAt?: string;
  closedAt?: string;
  updatedAt: string;
  lastMessage?: string;
  lastMessageAt?: string;
}

export interface SupportMessage {
  id: string;
  senderId: string;
  senderRole: "customer" | "admin";
  text: string;
  createdAt: string;
}

class SupportService {
  async createTicket(): Promise<SupportTicket> {
    const user = auth.currentUser;

    if (!user) {
      throw new Error(
        "Canlı destek için giriş yapılması gerekiyor."
      );
    }

    const now =
      new Date().toISOString();

    const customerName =
      user.displayName ||
      user.email?.split("@")[0] ||
      "Müşteri";

    const customerEmail =
      user.email || "";

    const ticketRef =
      await addDoc(
        collection(
          db,
          "supportTickets"
        ),
        {
          customerId:
            user.uid,
          customerName,
          customerEmail,
          status: "bekliyor",
          createdAt: now,
          updatedAt: now,
          lastMessage: "",
          lastMessageAt: now,
        }
      );

    const ticket: SupportTicket = {
      id: ticketRef.id,
      customerId: user.uid,
      customerName,
      customerEmail,
      status: "bekliyor",
      createdAt: now,
      updatedAt: now,
      lastMessage: "",
      lastMessageAt: now,
    };

    console.log(
      "✅ Canlı destek oluşturuldu:",
      ticket
    );

    return ticket;
  }

  async findCustomerTicket(): Promise<SupportTicket | null> {
    const user =
      auth.currentUser;

    if (!user) {
      return null;
    }

    return new Promise(
      (resolve) => {
        const q = query(
          collection(
            db,
            "supportTickets"
          ),
          where(
            "customerId",
            "==",
            user.uid
          )
        );

        let finished = false;

        let unsubscribe:
          | (() => void)
          | null = null;

        unsubscribe =
          onSnapshot(
            q,
            (snapshot) => {
              const tickets =
                snapshot.docs
                  .map(
                    (item) =>
                      ({
                        id: item.id,
                        ...item.data(),
                      }) as SupportTicket
                  )
                  .filter(
                    (ticket) =>
                      ticket.status !==
                      "kapalı"
                  )
                  .sort(
                    (a, b) =>
                      new Date(
                        b.createdAt
                      ).getTime() -
                      new Date(
                        a.createdAt
                      ).getTime()
                  );

              if (!finished) {
                finished = true;

                if (unsubscribe) {
                  unsubscribe();
                }

                resolve(
                  tickets[0] ||
                    null
                );
              }
            },
            (error) => {
              console.error(
                "Canlı destek ticket okuma hatası:",
                error
              );

              if (!finished) {
                finished = true;

                if (unsubscribe) {
                  unsubscribe();
                }

                resolve(null);
              }
            }
          );
      }
    );
  }

  subscribeCustomerTicket(
    customerId: string,
    callback: (
      ticket: SupportTicket | null
    ) => void
  ) {
    if (!customerId) {
      callback(null);
      return () => {};
    }

    const q = query(
      collection(
        db,
        "supportTickets"
      ),
      where(
        "customerId",
        "==",
        customerId
      )
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const tickets =
          snapshot.docs
            .map(
              (item) =>
                ({
                  id: item.id,
                  ...item.data(),
                }) as SupportTicket
            )
            .filter(
              (ticket) =>
                ticket.status !==
                "kapalı"
            )
            .sort(
              (a, b) =>
                new Date(
                  b.createdAt
                ).getTime() -
                new Date(
                  a.createdAt
                ).getTime()
            );

        callback(
          tickets[0] ||
            null
        );
      },
      (error) => {
        console.error(
          "Müşteri destek listener hatası:",
          error
        );

        callback(null);
      }
    );
  }

  subscribeAllTickets(
    callback: (
      tickets: SupportTicket[]
    ) => void
  ) {
    const q = query(
      collection(
        db,
        "supportTickets"
      )
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const tickets =
          snapshot.docs
            .map(
              (item) =>
                ({
                  id: item.id,
                  ...item.data(),
                }) as SupportTicket
            )
            .sort(
              (a, b) =>
                new Date(
                  b.createdAt
                ).getTime() -
                new Date(
                  a.createdAt
                ).getTime()
            );

        callback(tickets);
      },
      (error) => {
        console.error(
          "Admin destek listener hatası:",
          error
        );

        callback([]);
      }
    );
  }

  subscribeMessages(
    ticketId: string,
    callback: (
      messages: SupportMessage[]
    ) => void
  ) {
    if (!ticketId) {
      callback([]);
      return () => {};
    }

    const messagesRef =
      collection(
        db,
        "supportTickets",
        ticketId,
        "messages"
      );

    return onSnapshot(
      messagesRef,
      (snapshot) => {
        const messages: SupportMessage[] =
          snapshot.docs
            .map(
              (item) =>
                ({
                  id: item.id,
                  ...item.data(),
                }) as SupportMessage
            )
            .sort(
              (a, b) =>
                new Date(
                  a.createdAt
                ).getTime() -
                new Date(
                  b.createdAt
                ).getTime()
            );

        callback(messages);
      },
      (error) => {
        console.error(
          "Destek mesajları listener hatası:",
          error
        );

        callback([]);
      }
    );
  }

  async acceptTicket(
    ticketId: string
  ): Promise<void> {
    const user =
      auth.currentUser;

    if (!user) {
      throw new Error(
        "Admin oturumu bulunamadı."
      );
    }

    if (!ticketId) {
      throw new Error(
        "Destek talebi bulunamadı."
      );
    }

    const ticketRef =
      doc(
        db,
        "supportTickets",
        ticketId
      );

    const ticketSnapshot =
      await getDoc(
        ticketRef
      );

    if (
      !ticketSnapshot.exists()
    ) {
      throw new Error(
        "Destek talebi artık bulunamadı."
      );
    }

    const ticket =
      ticketSnapshot.data() as SupportTicket;

    if (
      ticket.status ===
      "kapalı"
    ) {
      throw new Error(
        "Bu destek talebi kapatılmış."
      );
    }

    const now =
      new Date().toISOString();

    await updateDoc(
      ticketRef,
      {
        status: "aktif",
        assignedAdminId:
          user.uid,
        acceptedAt: now,
        updatedAt: now,
      }
    );

    console.log(
      "✅ Destek talebi kabul edildi:",
      ticketId
    );
  }

  async sendMessage(
    ticketId: string,
    text: string,
    senderRole:
      | "customer"
      | "admin"
  ): Promise<void> {
    const user =
      auth.currentUser;

    if (!user) {
      throw new Error(
        "Oturum bulunamadı."
      );
    }

    const cleanText =
      text.trim();

    if (!cleanText) {
      return;
    }

    if (!ticketId) {
      throw new Error(
        "Destek talebi bulunamadı."
      );
    }

    const ticketRef =
      doc(
        db,
        "supportTickets",
        ticketId
      );

    const ticketSnapshot =
      await getDoc(
        ticketRef
      );

    if (
      !ticketSnapshot.exists()
    ) {
      throw new Error(
        "Destek talebi bulunamadı veya silinmiş."
      );
    }

    const ticketData =
      ticketSnapshot.data() as SupportTicket;

    if (
      ticketData.status !==
      "aktif"
    ) {
      throw new Error(
        "Bu destek görüşmesi henüz aktif değil."
      );
    }

    if (
      senderRole ===
      "customer"
    ) {
      if (
        ticketData.customerId !==
        user.uid
      ) {
        throw new Error(
          "Bu destek görüşmesine erişim yetkiniz yok."
        );
      }
    }

    if (
      senderRole ===
      "admin"
    ) {
      if (
        ticketData.assignedAdminId &&
        ticketData.assignedAdminId !==
          user.uid
      ) {
        throw new Error(
          "Bu destek görüşmesi başka bir yöneticiye atanmış."
        );
      }
    }

    const now =
      new Date().toISOString();

    const messageRef =
      doc(
        collection(
          db,
          "supportTickets",
          ticketId,
          "messages"
        )
      );

    await setDoc(
      messageRef,
      {
        senderId:
          user.uid,
        senderRole,
        text: cleanText,
        createdAt: now,
      }
    );

    try {
      await updateDoc(
        ticketRef,
        {
          lastMessage:
            cleanText,
          lastMessageAt:
            now,
          updatedAt: now,
        }
      );
    } catch (error) {
      console.warn(
        "Mesaj gönderildi fakat ticket son mesaj bilgisi güncellenemedi:",
        error
      );
    }

    console.log(
      "✅ Destek mesajı gönderildi:",
      {
        ticketId,
        senderRole,
        messageId:
          messageRef.id,
      }
    );
  }

  async closeTicket(
    ticketId: string
  ): Promise<void> {
    await this.deleteTicket(
      ticketId
    );
  }

  async deleteTicket(
    ticketId: string
  ): Promise<void> {
    const user =
      auth.currentUser;

    if (!user) {
      throw new Error(
        "Oturum bulunamadı."
      );
    }

    if (!ticketId) {
      throw new Error(
        "Silinecek destek kaydı bulunamadı."
      );
    }

    const ticketRef =
      doc(
        db,
        "supportTickets",
        ticketId
      );

    const ticketSnapshot =
      await getDoc(
        ticketRef
      );

    if (
      !ticketSnapshot.exists()
    ) {
      return;
    }

    const ticketData =
      ticketSnapshot.data() as SupportTicket;

    const isAdmin =
      user.email ===
      "hamidocan0411@gmail.com";

    if (
      !isAdmin &&
      ticketData.customerId !==
        user.uid
    ) {
      throw new Error(
        "Bu destek kaydını silme yetkiniz yok."
      );
    }

    const messagesRef =
      collection(
        db,
        "supportTickets",
        ticketId,
        "messages"
      );

    const messagesSnapshot =
      await getDocs(
        messagesRef
      );

    for (
      const message of
        messagesSnapshot.docs
    ) {
      await deleteDoc(
        message.ref
      );
    }

    await deleteDoc(
      ticketRef
    );

    console.log(
      "🗑️ Destek kaydı ve mesajları silindi:",
      ticketId
    );
  }
}

export const supportService =
  new SupportService();