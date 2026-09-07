import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from 'firebase/auth';

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';

import { auth, db } from './firebase';

import type {
  UserProfile,
  UserRole,
} from '../types';

const ADMIN_EMAIL = 'hamidocan0411@gmail.com';

/**
 * E-posta adresine göre varsayılan rol.
 *
 * Normal kayıt olan kullanıcılar customer olur.
 * Admin hesabı ise e-posta üzerinden admin olarak tanınır.
 *
 * Kurye hesaplarının rolü ise StorageService tarafından
 * oluşturulan Firestore profiline göre korunur.
 */
function getDefaultRole(email: string): UserRole {
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase()
    ? 'admin'
    : 'customer';
}

/**
 * Firebase'den gelen kullanıcı profilini uygulamanın
 * UserProfile tipine güvenli şekilde dönüştürür.
 */
function normalizeProfile(
  user: User,
  data: Record<string, any>
): UserProfile {
  let role: UserRole =
    data.role === 'admin' ||
    data.role === 'courier' ||
    data.role === 'customer'
      ? data.role
      : getDefaultRole(user.email || '');

  /**
   * Admin hesabının rolü her durumda admin olsun.
   */
  if (
    user.email?.trim().toLowerCase() ===
    ADMIN_EMAIL.toLowerCase()
  ) {
    role = 'admin';
  }

  return {
    id: user.uid,

    name:
      typeof data.name === 'string' && data.name.trim()
        ? data.name
        : user.displayName || 'Kullanıcı',

    email:
      typeof data.email === 'string' && data.email.trim()
        ? data.email
        : user.email || '',

    phone:
      typeof data.phone === 'string'
        ? data.phone
        : '',

    role,

    avatar:
      typeof data.avatar === 'string'
        ? data.avatar
        : undefined,

    vehicle:
      typeof data.vehicle === 'string'
        ? data.vehicle
        : undefined,

    plate:
      typeof data.plate === 'string'
        ? data.plate
        : undefined,

    courierStatus:
      data.courierStatus === 'Müsait' ||
      data.courierStatus === 'Meşgul' ||
      data.courierStatus === 'Çevrimdışı'
        ? data.courierStatus
        : undefined,

    totalDeliveries:
      typeof data.totalDeliveries === 'number'
        ? data.totalDeliveries
        : 0,

    rating:
      typeof data.rating === 'number'
        ? data.rating
        : 5,

    createdAt:
      typeof data.createdAt === 'string'
        ? data.createdAt
        : new Date().toISOString(),

    /**
     * UserProfile tipinde bulunmuyorsa bile Firestore'dan gelen
     * alanın uygulamada sorun çıkarmaması için güvenli tutuluyor.
     */
    ...(typeof data.updatedAt === 'string'
      ? { updatedAt: data.updatedAt }
      : {}),

    ...(typeof data.isActive === 'boolean'
      ? { isActive: data.isActive }
      : { isActive: true }),
  } as UserProfile;
}

/**
 * Firebase Auth kullanıcısı ile Firestore users/{uid}
 * kaydını eşleştirir.
 *
 * ÖNEMLİ:
 * Kurye hesabı admin panelinden oluşturulduysa burada bulunan
 * mevcut role kesinlikle korunur.
 */
export async function ensureUserProfile(
  user: User
): Promise<UserProfile> {
  if (!user?.uid) {
    throw new Error('Geçersiz Firebase kullanıcı hesabı.');
  }

  const userRef = doc(db, 'users', user.uid);

  const snapshot = await getDoc(userRef);

  if (snapshot.exists()) {
    const data = snapshot.data() as Record<string, any>;

    const profile = normalizeProfile(user, data);

    console.log(
      'Firestore kullanıcı profili bulundu:',
      {
        uid: user.uid,
        email: user.email,
        role: profile.role,
      }
    );

    return profile;
  }

  /**
   * Buraya düşüyorsa Firebase Auth hesabı var ama
   * users/{uid} Firestore kaydı yok demektir.
   *
   * Normal müşteri kayıtlarında bu kayıt otomatik oluşturulabilir.
   *
   * Ancak burada KURYE oluşturmak kesinlikle yapılmaz.
   * Çünkü kurye hesabının rolü admin panelinden verilmelidir.
   */
  const role = getDefaultRole(user.email || '');

  const profile: UserProfile = {
    id: user.uid,
    name: user.displayName || 'Kullanıcı',
    email: user.email || '',
    phone: '',
    role,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true,
  } as UserProfile;

  try {
    await setDoc(userRef, {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      role: profile.role,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log(
      'Yeni Firestore kullanıcı profili oluşturuldu:',
      {
        uid: user.uid,
        role: profile.role,
      }
    );
  } catch (error) {
    console.error(
      'Firestore kullanıcı profili oluşturulamadı:',
      error
    );

    throw error;
  }

  return profile;
}

/**
 * Yeni müşteri hesabı oluşturur.
 */
export async function registerUser(
  email: string,
  password: string,
  name: string,
  phone: string = ''
): Promise<UserProfile> {
  const cleanEmail = email.trim();
  const cleanName = name.trim();
  const cleanPhone = phone.trim();

  if (!cleanEmail) {
    throw new Error('E-posta adresi gerekli.');
  }

  if (!password) {
    throw new Error('Şifre gerekli.');
  }

  if (!cleanName) {
    throw new Error('Ad soyad gerekli.');
  }

  const credential =
    await createUserWithEmailAndPassword(
      auth,
      cleanEmail,
      password
    );

  const user = credential.user;

  try {
    await updateProfile(user, {
      displayName: cleanName,
    });

    const role = getDefaultRole(user.email || cleanEmail);

    const userRef = doc(
      db,
      'users',
      user.uid
    );

    const profile: UserProfile = {
      id: user.uid,
      name: cleanName,
      email: user.email || cleanEmail,
      phone: cleanPhone,
      role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
    } as UserProfile;

    await setDoc(userRef, {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      role: profile.role,
      isActive: true,
      totalDeliveries: 0,
      rating: 5,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log(
      'Firestore kullanıcı kaydı başarıyla tamamlandı:',
      user.uid
    );

    return profile;
  } catch (error) {
    console.error(
      'Kullanıcı Firestore kaydı oluşturulamadı:',
      error
    );

    /**
     * Burada Auth hesabını silmiyoruz.
     *
     * Çünkü bazı durumlarda Firestore geçici olarak hata verebilir.
     * Kullanıcının hesabının kaybolmasını istemiyoruz.
     */
    throw error;
  }
}

/**
 * Kullanıcı giriş yapar ve Firestore profilini getirir.
 */
export async function loginUser(
  email: string,
  password: string
): Promise<UserProfile> {
  const cleanEmail = email.trim();

  if (!cleanEmail) {
    throw new Error('E-posta adresi gerekli.');
  }

  if (!password) {
    throw new Error('Şifre gerekli.');
  }

  console.log(
    'Firebase giriş yapılıyor:',
    cleanEmail
  );

  const credential =
    await signInWithEmailAndPassword(
      auth,
      cleanEmail,
      password
    );

  console.log(
    'Firebase Auth girişi başarılı:',
    credential.user.uid
  );

  const profile =
    await ensureUserProfile(credential.user);

  console.log(
    'Kullanıcı profili hazır:',
    {
      uid: profile.id,
      role: profile.role,
      email: profile.email,
    }
  );

  return profile;
}

/**
 * Çıkış yap.
 */
export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);

    console.log(
      'Firebase hesabından çıkış yapıldı.'
    );
  } catch (error) {
    console.error(
      'Çıkış yapılırken hata:',
      error
    );

    throw error;
  }
}

/**
 * Firebase Auth değişikliklerini dinler.
 *
 * App.tsx bu fonksiyon üzerinden:
 *
 * user
 * profile
 *
 * bilgilerini alır.
 */
export function subscribeToAuth(
  callback: (
    user: User | null,
    profile: UserProfile | null
  ) => void
): () => void {
  return onAuthStateChanged(
    auth,
    async (user) => {
      /**
       * Kullanıcı çıkış yaptı.
       */
      if (!user) {
        console.log(
          'Firebase Auth: kullanıcı yok.'
        );

        callback(null, null);
        return;
      }

      console.log(
        'Firebase Auth kullanıcı bulundu:',
        {
          uid: user.uid,
          email: user.email,
        }
      );

      try {
        const profile =
          await ensureUserProfile(user);

        /**
         * Profil başarıyla alındı.
         */
        console.log(
          'Auth profili başarıyla yüklendi:',
          {
            uid: profile.id,
            role: profile.role,
          }
        );

        callback(user, profile);
      } catch (error) {
        console.error(
          'Kullanıcı profili alınamadı:',
          error
        );

        /**
         * App.tsx burada profile === null görecek.
         * Böylece uygulamanın exception ile siyah ekrana
         * düşmesini engelliyoruz.
         */
        callback(user, null);
      }
    }
  );
}

/**
 * O an Firebase Auth'da oturum açmış kullanıcının
 * Firestore profilini getirir.
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const user = auth.currentUser;

  if (!user) {
    return null;
  }

  try {
    return await ensureUserProfile(user);
  } catch (error) {
    console.error(
      'Mevcut kullanıcı profili alınamadı:',
      error
    );

    return null;
  }
}

/**
 * Kullanıcının admin olup olmadığını kontrol eder.
 */
export function isAdminUser(
  user: User | null
): boolean {
  return (
    !!user?.email &&
    user.email.trim().toLowerCase() ===
      ADMIN_EMAIL.toLowerCase()
  );
}

/**
 * Kullanıcının kurye olup olmadığını kontrol eder.
 *
 * Bu kontrol Firestore profilindeki role üzerinden yapılır.
 */
export async function isCourierUser(
  user: User | null
): Promise<boolean> {
  if (!user) {
    return false;
  }

  try {
    const profile =
      await ensureUserProfile(user);

    return profile.role === 'courier';
  } catch (error) {
    console.error(
      'Kurye kontrolü yapılamadı:',
      error
    );

    return false;
  }
}