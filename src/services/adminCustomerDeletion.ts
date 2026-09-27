import { auth } from "./firebase";

const CUSTOMER_ADMIN_ENDPOINT =
  "https://trustline-fcm-push.hamidocan0411.workers.dev/admin/customer-profile";

export async function deleteCustomerAccount(
  customerId: string,
  confirmationEmail: string
): Promise<void> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("Admin oturumu bulunamadı.");
  }

  if (!customerId) {
    throw new Error("Silinecek müşteri bulunamadı.");
  }

  const idToken = await currentUser.getIdToken();

  const response = await fetch(CUSTOMER_ADMIN_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: customerId,
      confirmationEmail,
    }),
  });

  let payload: { error?: string; code?: string } | null = null;

  try {
    payload = (await response.json()) as { error?: string; code?: string };
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if (payload?.error) {
      throw new Error(payload.error);
    }

    throw new Error("Müşteri profili silinemedi. Lütfen tekrar deneyin.");
  }
}
