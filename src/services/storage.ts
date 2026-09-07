private setupAdminUsersListener(): void {
  if (!auth.currentUser) {
    return;
  }

  const usersQuery = query(
    collection(db, COLLECTIONS.users),
    where("role", "==", "customer")
  );

  const unsubscribe = onSnapshot(
    usersQuery,
    (snapshot) => {
      this.users = snapshot.docs.map((item) =>
        this.mapUserProfile(item.id, item.data())
      );

      saveCache(CACHE_KEYS.users, this.users);
      this.notify();
    },
    (error) => {
      console.error(
        "Admin müşteri listener hatası:",
        error
      );
    }
  );

  this.firestoreUnsubscribers.push(unsubscribe);
}