export async function registerUser(
  email: string,
  password: string,
  name: string,
  phone: string = ''
): Promise<UserProfile> {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );
  const user = credential.user;

  // Profil güncellemesini yap ve bitmesini bekle
  await updateProfile(user, {
    displayName: name.trim(),
  });

  const role = getDefaultRole(user.email || '');
  const userRef = doc(db, 'users', user.uid);

  const profile: UserProfile = {
    id: user.uid,
    name: name.trim(),
    email: user.email || email.trim(),
    phone: phone.trim(),
    role,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true,
  };

  // KRİTİK NOKTA: Firestore'a yazma işlemi KESİNLİKLE tamamlanana kadar 
  // fonksiyondan çıkış yapma (await ile kilitle)
  try {
    await setDoc(userRef, {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      role: profile.role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: true,
    });
    console.log('Firestore kullanıcı kaydı başarıyla tamamlandı:', user.uid);
  } catch (firestoreErr) {
    console.error('Firestore kullanıcı kaydı yazılırken kritik hata:', firestoreErr);
    throw firestoreErr;
  }

  return profile;
}
