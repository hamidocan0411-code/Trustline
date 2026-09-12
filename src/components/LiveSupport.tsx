import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  CheckCircle2,
  Headphones,
  MessageCircle,
  Send,
  Trash2,
  X,
} from "lucide-react";

import {
  supportService,
  type SupportMessage,
  type SupportTicket,
} from "../services/support";

import { auth } from "../services/firebase";

interface LiveSupportProps {
  isAdmin?: boolean;
  embedded?: boolean;
}

interface ChatWindowProps {
  ticket: SupportTicket;
  isAdmin: boolean;
  messages: SupportMessage[];
  onSend: (text: string) => void;
  onClose?: () => void;
  onFinish?: () => void;
}

function ChatWindow({
  ticket,
  isAdmin,
  messages,
  onSend,
  onClose,
  onFinish,
}: ChatWindowProps) {
  const [text, setText] = useState("");

  const messagesEndRef =
    useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  const handleSend = () => {
    const value = text.trim();

    if (!value) {
      return;
    }

    onSend(value);
    setText("");
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[520px] w-full flex-col overflow-hidden rounded-3xl border border-[#303036] bg-[#19191E] shadow-2xl">
      <div className="flex shrink-0 items-center justify-between border-b border-[#303036] bg-[#222229] px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#D6A84F]/15">
            <Headphones
              size={19}
              className="text-[#D6A84F]"
            />
          </div>

          <div className="min-w-0">
            <div className="truncate text-sm font-black text-white">
              {isAdmin
                ? ticket.customerName || "Müşteri"
                : "TrustLine Canlı Destek"}
            </div>

            <div className="mt-0.5 text-[10px] text-[#888888]">
              {ticket.status === "aktif"
                ? "● Canlı görüşme"
                : ticket.status === "bekliyor"
                ? "Destek bekleniyor"
                : "Görüşme kapalı"}
            </div>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#888888] transition hover:bg-[#303036] hover:text-white"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div>
              <MessageCircle
                size={30}
                className="mx-auto text-[#55555D]"
              />

              <p className="mt-3 text-xs text-[#777777]">
                {ticket.status === "bekliyor"
                  ? "Destek talebiniz oluşturuldu."
                  : ticket.status === "aktif"
                  ? "Henüz mesaj yok."
                  : "Bu görüşmede mesaj bulunmuyor."}
              </p>

              {ticket.status === "bekliyor" && (
                <p className="mt-1 text-[10px] text-[#55555D]">
                  Bir yönetici görüşmeyi kabul ettiğinde burada iletişim başlayacak.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const mine = isAdmin
                ? message.senderRole === "admin"
                : message.senderRole === "customer";

              return (
                <div
                  key={message.id}
                  className={`flex ${
                    mine
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[82%] rounded-2xl px-4 py-3 ${
                      mine
                        ? "rounded-br-md bg-[#D6A84F] text-[#0B0B0D]"
                        : "rounded-bl-md bg-[#303036] text-white"
                    }`}
                  >
                    <div
                      className={`mb-1 text-[9px] font-bold ${
                        mine
                          ? "text-[#0B0B0D]/60"
                          : "text-[#888888]"
                      }`}
                    >
                      {mine
                        ? "Siz"
                        : message.senderRole === "admin"
                        ? "TrustLine Destek"
                        : ticket.customerName || "Müşteri"}
                    </div>

                    <div className="whitespace-pre-wrap break-words text-xs leading-5">
                      {message.text}
                    </div>

                    {message.createdAt && (
                      <div
                        className={`mt-1 text-[8px] ${
                          mine
                            ? "text-[#0B0B0D]/50"
                            : "text-[#666666]"
                        }`}
                      >
                        {new Date(
                          message.createdAt
                        ).toLocaleTimeString(
                          "tr-TR",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {ticket.status === "aktif" && (
        <div className="shrink-0 border-t border-[#303036] p-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={text}
              onChange={(event) =>
                setText(event.target.value)
              }
              onKeyDown={handleKeyDown}
              placeholder="Mesajınızı yazın..."
              className="min-w-0 flex-1 rounded-2xl border border-[#303036] bg-[#0B0B0D] px-4 py-3 text-xs text-white outline-none placeholder:text-[#55555D] focus:border-[#D6A84F]/60"
            />

            <button
              type="button"
              onClick={handleSend}
              disabled={!text.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#D6A84F] text-[#0B0B0D] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={17} />
            </button>
          </div>

          {isAdmin && onFinish && (
            <button
              type="button"
              onClick={onFinish}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-[10px] font-bold text-red-400 transition hover:bg-red-500/10"
            >
              <CheckCircle2 size={13} />
              Görüşmeyi Kapat
            </button>
          )}
        </div>
      )}

      {ticket.status === "kapalı" && (
        <div className="shrink-0 border-t border-[#303036] px-4 py-3 text-center text-[10px] text-[#777777]">
          Bu destek görüşmesi kapatıldı.
        </div>
      )}
    </div>
  );
}

export function LiveSupport({
  isAdmin = false,
  embedded = false,
}: LiveSupportProps) {
  const [
    customerTicket,
    setCustomerTicket,
  ] = useState<SupportTicket | null>(null);

  const [
    customerMessages,
    setCustomerMessages,
  ] = useState<SupportMessage[]>([]);

  const [
    customerOpen,
    setCustomerOpen,
  ] = useState(false);

  const [
    customerLoading,
    setCustomerLoading,
  ] = useState(false);

  const hadCustomerTicketRef =
    useRef(false);

  const [
    tickets,
    setTickets,
  ] = useState<SupportTicket[]>([]);

  const [
    selectedTicket,
    setSelectedTicket,
  ] = useState<SupportTicket | null>(null);

  const [
    adminMessages,
    setAdminMessages,
  ] = useState<SupportMessage[]>([]);

  const [
    adminLoading,
    setAdminLoading,
  ] = useState(false);

  const [
    deletingTicketId,
    setDeletingTicketId,
  ] = useState<string | null>(null);

  /*
   * ==========================================================
   * CUSTOMER ACTIVE TICKET
   * ==========================================================
   */

  useEffect(() => {
    if (isAdmin) {
      return;
    }

    const customerId =
      auth.currentUser?.uid;

    if (!customerId) {
      setCustomerTicket(null);
      return;
    }

    console.log(
      "🟢 Müşteri ticket listener bağlandı:",
      customerId
    );

    const unsubscribe =
      supportService.subscribeCustomerTicket(
        customerId,
        (updatedTicket) => {
          console.log(
            "🟢 Müşteri ticket güncellendi:",
            updatedTicket
          );

          /*
           * Yönetici görüşmeyi sonlandırdığında ticket silinir.
           * Açık pencereyi de aynı anda kapatmazsak yalnızca bulanık
           * arka plan ekranda kalıyordu.
           */
          if (
            hadCustomerTicketRef.current &&
            !updatedTicket
          ) {
            setCustomerOpen(false);
          }

          hadCustomerTicketRef.current =
            Boolean(updatedTicket);

          setCustomerTicket(updatedTicket);
        }
      );

    return () => {
      console.log(
        "🟡 Müşteri ticket listener kapandı:",
        customerId
      );

      unsubscribe?.();
    };
  }, [isAdmin]);

  /*
   * ==========================================================
   * CUSTOMER MESSAGES
   * ==========================================================
   */

  useEffect(() => {
    if (
      isAdmin ||
      !customerTicket ||
      customerTicket.status !== "aktif"
    ) {
      setCustomerMessages([]);
      return;
    }

    const ticketId =
      customerTicket.id;

    console.log(
      "🔴 Müşteri mesaj listener bağlandı:",
      ticketId
    );

    const unsubscribe =
      supportService.subscribeMessages(
        ticketId,
        (messages) => {
          console.log(
            "🔵 Müşteri mesajları güncellendi:",
            messages.length
          );

          setCustomerMessages(
            messages
          );
        }
      );

    return () => {
      console.log(
        "🟡 Müşteri mesaj listener kapandı:",
        ticketId
      );

      unsubscribe?.();
    };
  }, [
    isAdmin,
    customerTicket?.id,
    customerTicket?.status,
  ]);

  /*
   * ==========================================================
   * ADMIN TICKETS
   * ==========================================================
   */

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    const unsubscribe =
      supportService.subscribeAllTickets(
        (nextTickets) => {
          setTickets(nextTickets);

          setSelectedTicket((current) => {
            if (!current) {
              return current;
            }

            return (
              nextTickets.find(
                (ticket) =>
                  ticket.id === current.id
              ) || current
            );
          });
        }
      );

    return () => {
      unsubscribe?.();
    };
  }, [isAdmin]);

  /*
   * ==========================================================
   * ADMIN SELECTED TICKET MESSAGES
   * ==========================================================
   */

  useEffect(() => {
    if (
      !isAdmin ||
      !selectedTicket
    ) {
      setAdminMessages([]);
      return;
    }

    const unsubscribe =
      supportService.subscribeMessages(
        selectedTicket.id,
        (messages) => {
          setAdminMessages(messages);
        }
      );

    return () => {
      unsubscribe?.();
    };
  }, [
    isAdmin,
    selectedTicket?.id,
  ]);

  /*
   * ==========================================================
   * CUSTOMER OPEN SUPPORT
   * ==========================================================
   */

  const handleCustomerOpen =
    async () => {
      setCustomerOpen(true);

      if (customerTicket) {
        return;
      }

      try {
        setCustomerLoading(true);

        const ticket =
          await supportService.createTicket();

        setCustomerTicket(ticket);
      } catch (error) {
        console.error(
          "Canlı destek talebi oluşturulamadı:",
          error
        );

        window.alert(
          "Canlı destek başlatılamadı. Lütfen tekrar deneyin."
        );
      } finally {
        setCustomerLoading(false);
      }
    };

  /*
   * ==========================================================
   * CUSTOMER MESSAGE
   * ==========================================================
   */

  const handleCustomerSend =
    async (text: string) => {
      if (
        !customerTicket ||
        customerTicket.status !== "aktif"
      ) {
        console.warn(
          "⚠️ Müşteri mesajı gönderilemedi: görüşme aktif değil.",
          customerTicket
        );

        return;
      }

      try {
        console.log(
          "📤 Müşteri mesaj gönderiyor:",
          {
            ticketId:
              customerTicket.id,
            text,
          }
        );

        await supportService.sendMessage(
          customerTicket.id,
          text,
          "customer"
        );

        console.log(
          "✅ Müşteri mesajı başarıyla gönderildi."
        );
      } catch (error) {
        console.error(
          "❌ Müşteri destek mesajı gönderilemedi:",
          error
        );

        window.alert(
          "Mesaj gönderilemedi. Lütfen tekrar deneyin."
        );
      }
    };

  /*
   * ==========================================================
   * ADMIN ACCEPT
   * ==========================================================
   */

  const handleAccept =
    async (
      ticket: SupportTicket
    ) => {
      try {
        setAdminLoading(true);

        await supportService.acceptTicket(
          ticket.id
        );

        setSelectedTicket({
          ...ticket,
          status: "aktif",
        });
      } catch (error) {
        console.error(
          "Destek talebi kabul edilemedi:",
          error
        );

        window.alert(
          "Destek talebi kabul edilemedi."
        );
      } finally {
        setAdminLoading(false);
      }
    };

  /*
   * ==========================================================
   * ADMIN MESSAGE
   * ==========================================================
   */

  const handleAdminSend =
    async (text: string) => {
      if (
        !selectedTicket ||
        selectedTicket.status !== "aktif"
      ) {
        return;
      }

      try {
        await supportService.sendMessage(
          selectedTicket.id,
          text,
          "admin"
        );
      } catch (error) {
        console.error(
          "Admin destek mesajı gönderilemedi:",
          error
        );

        window.alert(
          "Mesaj gönderilemedi."
        );
      }
    };

  /*
   * ==========================================================
   * ADMIN CLOSE
   * ==========================================================
   */

  const handleAdminClose =
    async () => {
      if (!selectedTicket) {
        return;
      }

      const ticketId =
        selectedTicket.id;

      try {
        setAdminLoading(true);

        await supportService.closeTicket(
          ticketId
        );

        setSelectedTicket(null);

        setAdminMessages([]);

        setTickets((current) =>
          current.filter(
            (ticket) =>
              ticket.id !== ticketId
          )
        );
      } catch (error) {
        console.error(
          "Destek görüşmesi kapatılamadı:",
          error
        );

        window.alert(
          "Görüşme kapatılamadı."
        );
      } finally {
        setAdminLoading(false);
      }
    };

  /*
   * ==========================================================
   * ADMIN DELETE OLD TICKET
   * ==========================================================
   */

  const handleDeleteTicket =
    async (
      ticket: SupportTicket
    ) => {
      const confirmed =
        window.confirm(
          `"${ticket.customerName || "Müşteri"}" adlı müşterinin destek kaydı ve tüm mesajları silinsin mi?`
        );

      if (!confirmed) {
        return;
      }

      try {
        setDeletingTicketId(
          ticket.id
        );

        await supportService.deleteTicket(
          ticket.id
        );

        if (
          selectedTicket?.id ===
          ticket.id
        ) {
          setSelectedTicket(null);
          setAdminMessages([]);
        }

        setTickets((current) =>
          current.filter(
            (item) =>
              item.id !== ticket.id
          )
        );
      } catch (error) {
        console.error(
          "Destek kaydı silinemedi:",
          error
        );

        window.alert(
          "Destek kaydı silinemedi. Lütfen tekrar deneyin."
        );
      } finally {
        setDeletingTicketId(null);
      }
    };

  /*
   * ==========================================================
   * CUSTOMER UI
   * ==========================================================
   */

  if (!isAdmin) {
    const ticketStatus = customerTicket?.status;

    return (
      <>
        {customerOpen &&
          (customerLoading || customerTicket) && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-5">
            <div className="w-full max-w-[430px]">
            {customerLoading ? (
              <div className="flex h-[300px] items-center justify-center rounded-3xl border border-[#303036] bg-[#19191E] shadow-2xl">
                <div className="text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#303036] border-t-[#D6A84F]" />

                  <p className="mt-3 text-xs text-[#777777]">
                    Destek bağlantısı kuruluyor...
                  </p>
                </div>
              </div>
            ) : customerTicket ? (
              <ChatWindow
                ticket={customerTicket}
                isAdmin={false}
                messages={customerMessages}
                onSend={handleCustomerSend}
                onClose={() =>
                  setCustomerOpen(false)
                }
              />
            ) : null}
            </div>
          </div>
        )}

        {embedded ? (
          <section className="mt-5 overflow-hidden rounded-[28px] border border-[#2E2E36] bg-gradient-to-br from-[#19191E] to-[#111116] shadow-xl">
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#D6A84F]/20 bg-[#D6A84F]/10">
                  <Headphones size={22} className="text-[#D6A84F]" />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-black text-white">
                      Yardım Merkezi
                    </p>

                    {ticketStatus === "aktif" && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-black text-emerald-400">
                        ● TEMSİLCİ BAĞLI
                      </span>
                    )}

                    {ticketStatus === "bekliyor" && (
                      <span className="rounded-full bg-[#D6A84F]/10 px-2 py-1 text-[9px] font-black text-[#D6A84F]">
                        ● SIRADA
                      </span>
                    )}
                  </div>

                  <p className="mt-1 max-w-md text-xs leading-5 text-[#8F8F99]">
                    {ticketStatus === "aktif"
                      ? "Destek temsilciniz görüşmede. Mesajlaşarak anında yardım alabilirsiniz."
                      : ticketStatus === "bekliyor"
                      ? "Talebiniz alındı. Bir temsilci görüşmeyi kabul ettiğinde buradan mesajlaşabilirsiniz."
                      : "Sipariş, teslimat veya hesabınızla ilgili sorularınız için destek ekibimize ulaşın."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCustomerOpen}
                className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#D6A84F] px-5 py-3.5 text-xs font-black text-[#0B0B0D] transition hover:-translate-y-0.5 hover:bg-[#E2B866]"
              >
                <MessageCircle size={17} />
                {ticketStatus === "aktif"
                  ? "Görüşmeye Dön"
                  : ticketStatus === "bekliyor"
                  ? "Talebi Görüntüle"
                  : "Canlı Desteğe Bağlan"}
              </button>
            </div>
          </section>
        ) : (
          <button
            type="button"
            onClick={handleCustomerOpen}
            className="fixed bottom-5 right-5 z-[99] flex items-center gap-2 rounded-full border border-[#D6A84F]/40 bg-[#19191E] px-5 py-3.5 text-xs font-black text-[#D6A84F] shadow-2xl transition hover:scale-[1.02] hover:bg-[#222229]"
          >
            <MessageCircle size={17} />
            Canlı Destek
          </button>
        )}
      </>
    );
  }

  /*
   * ==========================================================
   * ADMIN UI
   * ==========================================================
   */

  const waitingTickets =
    tickets.filter(
      (ticket) =>
        ticket.status === "bekliyor"
    );

  const activeTickets =
    tickets.filter(
      (ticket) =>
        ticket.status === "aktif"
    );

  const closedTickets =
    tickets.filter(
      (ticket) =>
        ticket.status === "kapalı"
    );

  return (
    <div
      id="trustline-admin-support"
      className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_minmax(0,1fr)]"
    >
      <div className="overflow-hidden rounded-3xl border border-[#303036] bg-[#19191E]">
        <div className="border-b border-[#303036] bg-[#222229] px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Headphones
                  size={18}
                  className="text-[#D6A84F]"
                />

                <h2 className="text-sm font-black text-white">
                  Canlı Destek
                </h2>
              </div>

              <p className="mt-1 text-[10px] text-[#777777]">
                Müşteri destek talepleri
              </p>
            </div>

            {waitingTickets.length > 0 && (
              <div className="flex h-8 min-w-8 items-center justify-center rounded-full bg-[#D6A84F] px-2 text-xs font-black text-[#0B0B0D]">
                {waitingTickets.length}
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-[#D6A84F]/20 bg-[#D6A84F]/5 px-3 py-2">
              <div className="text-[8px] font-bold text-[#777777]">
                BEKLİYOR
              </div>

              <div className="mt-1 text-sm font-black text-[#D6A84F]">
                {waitingTickets.length}
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
              <div className="text-[8px] font-bold text-[#777777]">
                AKTİF
              </div>

              <div className="mt-1 text-sm font-black text-emerald-400">
                {activeTickets.length}
              </div>
            </div>

            <div className="rounded-xl border border-[#303036] bg-[#0B0B0D] px-3 py-2">
              <div className="text-[8px] font-bold text-[#777777]">
                KAPALI
              </div>

              <div className="mt-1 text-sm font-black text-[#777777]">
                {closedTickets.length}
              </div>
            </div>
          </div>
        </div>

        <div className="max-h-[620px] overflow-y-auto p-3">
          {tickets.length === 0 ? (
            <div className="py-14 text-center">
              <MessageCircle
                size={32}
                className="mx-auto text-[#44444B]"
              />

              <p className="mt-3 text-xs text-[#777777]">
                Henüz destek talebi yok.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tickets.map((ticket) => {
                const selected =
                  selectedTicket?.id ===
                  ticket.id;

                const deleting =
                  deletingTicketId ===
                  ticket.id;

                return (
                  <div
                    key={ticket.id}
                    className={`rounded-2xl border p-3 transition ${
                      selected
                        ? "border-[#D6A84F]/50 bg-[#D6A84F]/10"
                        : "border-[#303036] bg-[#0B0B0D]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedTicket(
                          ticket
                        )
                      }
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-black text-white">
                            {ticket.customerName ||
                              "Müşteri"}
                          </div>

                          <div className="mt-1 truncate text-[9px] text-[#666666]">
                            {ticket.customerEmail ||
                              ""}
                          </div>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[8px] font-black ${
                            ticket.status ===
                            "bekliyor"
                              ? "bg-[#D6A84F]/15 text-[#D6A84F]"
                              : ticket.status ===
                                "aktif"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-[#303036] text-[#777777]"
                          }`}
                        >
                          {ticket.status ===
                          "bekliyor"
                            ? "BEKLİYOR"
                            : ticket.status ===
                              "aktif"
                            ? "AKTİF"
                            : "KAPALI"}
                        </span>
                      </div>

                      {ticket.lastMessage && (
                        <div className="mt-3 truncate text-[10px] text-[#888888]">
                          {ticket.lastMessage}
                        </div>
                      )}

                      {ticket.createdAt && (
                        <div className="mt-2 text-[8px] text-[#55555D]">
                          {new Date(
                            ticket.createdAt
                          ).toLocaleString(
                            "tr-TR",
                            {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </div>
                      )}
                    </button>

                    <div className="mt-3 flex items-center justify-between border-t border-[#303036] pt-2">
                      <span className="text-[8px] text-[#55555D]">
                        {ticket.status ===
                        "kapalı"
                          ? "Arşiv kaydı"
                          : "Destek kaydı"}
                      </span>

                      <button
                        type="button"
                        disabled={deleting}
                        onClick={() =>
                          handleDeleteTicket(
                            ticket
                          )
                        }
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[9px] font-bold text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 size={12} />

                        {deleting
                          ? "Siliniyor..."
                          : "Sil"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="min-w-0">
        {!selectedTicket ? (
          <div className="flex min-h-[520px] items-center justify-center rounded-3xl border border-[#303036] bg-[#19191E]">
            <div className="text-center">
              <Headphones
                size={38}
                className="mx-auto text-[#44444B]"
              />

              <h3 className="mt-4 text-sm font-black text-white">
                Destek görüşmesi seçin
              </h3>

              <p className="mt-2 max-w-xs text-xs leading-5 text-[#666666]">
                Müşterilerden gelen canlı destek talepleri burada anlık olarak görünür.
              </p>
            </div>
          </div>
        ) : (
          <div>
            {selectedTicket.status ===
              "bekliyor" && (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-[#D6A84F]/30 bg-[#D6A84F]/5 px-4 py-3">
                <div>
                  <div className="text-xs font-black text-[#D6A84F]">
                    Yeni destek talebi
                  </div>

                  <div className="mt-1 text-[10px] text-[#888888]">
                    Müşteri görüşme için bekliyor.
                  </div>
                </div>

                <button
                  type="button"
                  disabled={adminLoading}
                  onClick={() =>
                    handleAccept(
                      selectedTicket
                    )
                  }
                  className="shrink-0 rounded-xl bg-[#D6A84F] px-4 py-2.5 text-[10px] font-black text-[#0B0B0D] transition hover:opacity-90 disabled:opacity-50"
                >
                  {adminLoading
                    ? "Kabul ediliyor..."
                    : "Kabul Et"}
                </button>
              </div>
            )}

            <ChatWindow
              ticket={selectedTicket}
              isAdmin={true}
              messages={adminMessages}
              onSend={handleAdminSend}
              onClose={() =>
                setSelectedTicket(null)
              }
              onFinish={
                selectedTicket.status ===
                "aktif"
                  ? handleAdminClose
                  : undefined
              }
            />

            {selectedTicket.status ===
              "kapalı" && (
              <button
                type="button"
                disabled={
                  deletingTicketId ===
                  selectedTicket.id
                }
                onClick={() =>
                  handleDeleteTicket(
                    selectedTicket
                  )
                }
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs font-black text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
              >
                <Trash2 size={15} />

                {deletingTicketId ===
                selectedTicket.id
                  ? "Kayıt siliniyor..."
                  : "Bu destek kaydını tamamen sil"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default LiveSupport;
