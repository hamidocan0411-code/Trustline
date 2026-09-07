export async function registerUser(
  email: string,
  password: string,
  name: string,
  phone: string = ''
): Promise<UserProfile> {
  // 1. Firebase Auth ile kullanıcı oluştur
  const credential = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );
  const user = credential.user;

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

  try {
    // 2. Doğrudan Firestore'a kullanıcıyı yazmayı dene
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
  } catch (firestoreErr) {
    console.error('Firestore kullanıcı kaydı yazılırken hata:', firestoreErr);
    throw firestoreErr;
  }

  return profile;
}
