import {
GoogleAuthProvider,
browserLocalPersistence,
createUserWithEmailAndPassword,
getRedirectResult,
onAuthStateChanged,
sendEmailVerification,
setPersistence,
signInWithEmailAndPassword,
signInWithPopup,
signInWithRedirect,
signOut,
updateProfile,
type User,
} from “firebase/auth”;

import {
doc,
getDoc,
setDoc,
serverTimestamp,
} from “firebase/firestore”;

import { auth, db } from “./firebase”;

export const ADMIN_EMAIL =
“hamidocan0411@gmail.com”;

export type UserRole =
| “customer”
| “courier”
| “admin”;

export interface AuthUserProfile {
id: string;
name: string;
email: string;
phone: string;
role: UserRole;
avatar?: string;
vehicle?: string;
plate?: string;
courierStatus?:
| “Müsait”
| “Meşgul”
| “Çevrimdışı”;
totalDeliveries?: number;
rating?: number;
createdAt: string;
}

interface RegisterData {
name: string;
email: string;
password: string;
phone?: string;
}

function createAuthError(
code: string,
message: string
): Error & { code: string } {
const error = new Error(message) as Error & {
code: string;
};

error.code = code;
return error;
}

function getErrorCode(error: unknown): string {
if (
typeof error === “object” &&
error !== null &&
“code” in error
) {
return String(
Reflect.get(error, “code”) ?? “”
);
}

return “”;
}

function getDefaultRole(
email: string
): UserRole {
return email.trim().toLowerCase() ===
ADMIN_EMAIL.toLowerCase()
? “admin”
: “customer”;
}

function normalizeRole(
value: unknown,
email: string
): UserRole {
if (
value === “admin” ||
value === “courier” ||
value === “customer”
) {
return value;
}

return getDefaultRole(email);
}

function normalizeProfile(
uid: string,
data: Record<string, unknown>,
fallbackUser?: User
): AuthUserProfile {
const email =
typeof data.email === “string”
? data.email
: fallbackUser?.email ?? “”;

const name =
typeof data.name === “string” &&
data.name.trim()
? data.name
: fallbackUser?.displayName ??
“Trustline Kullanıcısı”;

const phone =
typeof data.phone === “string”
? data.phone
: fallbackUser?.phoneNumber ?? “”;

const createdAt =
typeof data.createdAt === “string”
? data.createdAt
: new Date().toISOString();

return {
id: uid,
name,
email,
phone,
role: normalizeRole(
data.role,
email
),
avatar:
typeof data.avatar === “string”
? data.avatar
: fallbackUser?.photoURL ??
undefined,
vehicle:
typeof data.vehicle === “string”
? data.vehicle
: undefined,
plate:
typeof data.plate === “string”
? data.plate
: undefined,
courierStatus:
data.courierStatus === “Müsait” ||
data.courierStatus === “Meşgul” ||
data.courierStatus === “Çevrimdışı”
? data.courierStatus
: undefined,
totalDeliveries:
typeof data.totalDeliveries ===
“number”
? data.totalDeliveries
: 0,
rating:
typeof data.rating === “number”
? data.rating
: 5,
createdAt,
};
}

/**

* Firebase kullanıcısının Firestore profilini
* getirir veya ilk girişte oluşturur.
    */
    export async function ensureUserProfile(
    user: User
    ): Promise {
    const userRef = doc(
    db,
    “users”,
    user.uid
    );

const snapshot =
await getDoc(userRef);

if (snapshot.exists()) {
return normalizeProfile(
user.uid,
snapshot.data(),
user
);
}

const role =
getDefaultRole(
user.email ?? “”
);

const profileData = {
id: user.uid,
name:
user.displayName?.trim() ||
“Trustline Kullanıcısı”,
email:
user.email ?? “”,
phone:
user.phoneNumber ?? “”,
role,
avatar:
user.photoURL ?? “”,
totalDeliveries: 0,
rating: 5,
createdAt:
new Date().toISOString(),
createdAtServer:
serverTimestamp(),
};

await setDoc(
userRef,
profileData
);

return normalizeProfile(
user.uid,
profileData,
user
);
}

/**

* Email + şifre ile kayıt.
    */
    export async function registerUser({
    name,
    email,
    password,
    phone = “”,
    }: RegisterData): Promise {
    const cleanName =
    name.trim();

const cleanEmail =
email.trim().toLowerCase();

const cleanPhone =
phone.trim();

if (!cleanName) {
throw new Error(
“Ad soyad gerekli.”
);
}

if (!cleanEmail) {
throw new Error(
“E-posta adresi gerekli.”
);
}

if (password.length < 6) {
throw new Error(
“Şifre en az 6 karakter olmalıdır.”
);
}

const credential =
await createUserWithEmailAndPassword(
auth,
cleanEmail,
password
);

const user =
credential.user;

try {
await updateProfile(
user,
{
displayName:
cleanName,
}
);

const role =
  getDefaultRole(
    cleanEmail
  );
const profileData = {
  id: user.uid,
  name: cleanName,
  email: cleanEmail,
  phone: cleanPhone,
  role,
  avatar: "",
  totalDeliveries: 0,
  rating: 5,
  createdAt:
    new Date().toISOString(),
  createdAtServer:
    serverTimestamp(),
};
await setDoc(
  doc(
    db,
    "users",
    user.uid
  ),
  profileData
);
await sendEmailVerification(
  user
);
await signOut(auth);
throw createAuthError(
  "auth/email-verification-required",
  "Hesabınız oluşturuldu. E-posta adresinizi doğrulamanız gerekiyor. E-postanıza gönderilen doğrulama bağlantısına tıklayın."
);

} catch (error) {
if (
getErrorCode(error) ===
“auth/email-verification-required”
) {
throw error;
}

await signOut(auth).catch(
  () => undefined
);
throw error;

}
}

/**

* Email + şifre ile giriş.
    */
    export async function loginUser(
    email: string,
    password: string
    ): Promise {
    const cleanEmail =
    email.trim().toLowerCase();

if (!cleanEmail) {
throw new Error(
“E-posta adresi gerekli.”
);
}

if (!password) {
throw new Error(
“Şifre gerekli.”
);
}

const credential =
await signInWithEmailAndPassword(
auth,
cleanEmail,
password
);

const user =
credential.user;

if (!user.emailVerified) {
await signOut(auth).catch(
() => undefined
);

throw createAuthError(
  "auth/email-not-verified",
  "E-posta adresiniz henüz doğrulanmamış. E-postanıza gönderilen doğrulama bağlantısına tıklayın."
);

}

return ensureUserProfile(
user
);
}

/**

* Google provider.
    */
    function createGoogleProvider(): GoogleAuthProvider {
    const provider =
    new GoogleAuthProvider();

provider.setCustomParameters({
prompt: “select_account”,
});

provider.addScope(
“profile”
);

provider.addScope(
“email”
);

return provider;
}

/**

* Mobil cihaz kontrolü.
    */
    function isMobileDevice(): boolean {
    if (
    typeof window ===
    “undefined”
    ) {
    return false;
    }

const userAgent =
navigator.userAgent ||
navigator.vendor ||
“”;

const mobileRegex =
/Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile/i;

const isMobileUserAgent =
mobileRegex.test(
userAgent
);

const isIPadOS =
navigator.platform ===
“MacIntel” &&
navigator.maxTouchPoints >
1;

return (
isMobileUserAgent ||
isIPadOS
);
}

/**

* Google ile giriş.
* ÖNEMLİ:
* Firebase Auth oturumunu önce
* local persistence ile sabitliyoruz.
* Mobil:
* redirect
* Masaüstü:
* popup
* Popup desteklenmezse:
* redirect
    */
    export async function loginWithGoogle(): Promise {
    const provider =
    createGoogleProvider();

/*

* Google dönüşünden sonra oturumun
* sayfa yenilense bile korunmasını sağla.
    */
    await setPersistence(
    auth,
    browserLocalPersistence
    );

if (isMobileDevice()) {
await signInWithRedirect(
auth,
provider
);

throw createAuthError(
  "auth/google-redirect-started",
  "Google giriş sayfasına yönlendiriliyorsunuz..."
);

}

try {
const credential =
await signInWithPopup(
auth,
provider
);

return await ensureUserProfile(
  credential.user
);

} catch (error) {
const code =
getErrorCode(error);

const shouldUseRedirect =
  code ===
    "auth/popup-blocked" ||
  code ===
    "auth/operation-not-supported-in-this-environment" ||
  code ===
    "auth/popup-closed-by-user";
if (shouldUseRedirect) {
  await signInWithRedirect(
    auth,
    provider
  );
  throw createAuthError(
    "auth/google-redirect-started",
    "Google giriş sayfasına yönlendiriliyorsunuz..."
  );
}
console.error(
  "Google giriş hatası:",
  error
);
throw error;

}
}

/**

* Google redirect sonucunu işler.
* Bu fonksiyon uygulama açılır açılmaz
* sadece redirect dönüşünü kontrol eder.
    /
    export async function handleGoogleRedirectResult(): Promise<AuthUserProfile | null> {
    try {
    /
    * Eğer Firebase zaten kullanıcıyı
    * restore ettiyse doğrudan kullan.
        */
        if (auth.currentUser) {
        return await ensureUserProfile(
        auth.currentUser
        );
        }
    const result =
    await getRedirectResult(
    auth
    );
    if (result?.user) {
    return await ensureUserProfile(
    result.user
    );
    }
    /*
    * Redirect sonucu yoksa burada
    * uzun süre beklemiyoruz.
    * Auth listener asıl kullanıcı
    * senkronizasyonunu yapacak.
        */
        return null;
        } catch (error) {
        console.error(
        “Google redirect sonucu alınamadı:”,
        error
        );
    /*
    * Firebase kullanıcıyı oluşturmuşsa
    * redirect sonucundaki hataya rağmen
    * kullanıcıyı kaybetme.
        */
        if (auth.currentUser) {
        try {
        return await ensureUserProfile(
        auth.currentUser
        );
        } catch {
        // Orijinal hata aşağıdan fırlatılır.
        }
        }
    throw error;
    }
    }

/**

* Çıkış.
    */
    export async function logoutUser(): Promise {
    await signOut(auth);
    }

/**

* Mevcut Firebase kullanıcısının
* Firestore profilini getirir.
    */
    export async function getCurrentUserProfile(): Promise<AuthUserProfile | null> {
    const user =
    auth.currentUser;

if (!user) {
return null;
}

if (
user.providerData.some(
(provider) =>
provider.providerId ===
“password”
) &&
!user.emailVerified
) {
await signOut(auth).catch(
() => undefined
);

return null;

}

try {
return await ensureUserProfile(
user
);
} catch (error) {
console.error(
“Mevcut kullanıcı profili alınamadı:”,
error
);

return null;

}
}

/**

* Kullanıcı auth durumunu dinler.
* Google kullanıcısı için email doğrulaması
* aranmaz.
    */
    export function subscribeToAuth(
    callback: (
    user: User | null,
    profile: AuthUserProfile | null
    ) => void
    ): () => void {
    return onAuthStateChanged(
    auth,
    async (user) => {
    if (!user) {
    callback(
    null,
    null
    );
    return;
    }
    /*
    * Email + şifre kullanıcıları için
    * doğrulama zorunlu.
    *
    * Google kullanıcıları buraya
    * takılmaz.
    */
    if (
    user.providerData.some(
    (provider) =>
    provider.providerId ===
    “password”
    ) &&
    !user.emailVerified
    ) {
    await signOut(
    auth
    ).catch(
    () => undefined
    );

 callback(
   null,
   null
 );
 return;

    }
    try {
    /*
    * Kullanıcı auth state’e girdikten sonra
    * Firestore profilini al.
    */
    const profile =
    await ensureUserProfile(
    user
    );

 callback(
   user,
   profile
 );

    } catch (error) {
    console.error(
    “Kullanıcı profili alınamadı:”,
    error
    );

 /*
  * Google Auth başarılıysa kullanıcıyı
  * login ekranına düşürmemek için
  * user'ı koruyoruz.
  */
 callback(
   user,
   null
 );

    }
    }
    );
    }

/**

* Admin kontrolü.
    */
    export function isAdminUser(
    profile: AuthUserProfile | null
    ): boolean {
    if (!profile) {
    return false;
    }

return (
profile.role ===
“admin” ||
profile.email.toLowerCase() ===
ADMIN_EMAIL.toLowerCase()
);
}

/**

* Kurye kontrolü.
    */
    export function isCourierUser(
    profile: AuthUserProfile | null
    ): boolean {
    return (
    profile?.role ===
    “courier”
    );
    }

/**

* Müşteri kontrolü.
    */
    export function isCustomerUser(
    profile: AuthUserProfile | null
    ): boolean {
    return (
    profile?.role ===
    “customer”
    );
    }

/**

* Firebase Auth kullanıcısını
* doğrudan döndürür.
    */
    export function getFirebaseUser(): User | null {
    return auth.currentUser;
    }