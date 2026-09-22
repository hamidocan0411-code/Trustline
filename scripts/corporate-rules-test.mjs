import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, collection, addDoc } from "firebase/firestore";

const projectId = "trustline-rules-test";
const rules = readFileSync("firestore.rules", "utf8");
const env = await initializeTestEnvironment({
  projectId,
  firestore: { rules },
});

const admin = env.authenticatedContext("admin-uid", { email: "hamidocan0411@gmail.com" }).firestore();
const corpA = env.authenticatedContext("corp-a", { email: "a@example.com" }).firestore();
const corpB = env.authenticatedContext("corp-b", { email: "b@example.com" }).firestore();
const customer = env.authenticatedContext("customer-uid", { email: "c@example.com" }).firestore();

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "pricing/default"), {
    perKmPrice: 50, minPrice: 250, urgentMultiplier: 1.3, vipMultiplier: 1.6
  });
  await setDoc(doc(db, "users/corp-a"), {
    id:"corp-a", role:"corporate", email:"a@example.com", name:"Firma A", companyId:"company-a", companyName:"Firma A"
  });
  await setDoc(doc(db, "users/corp-b"), {
    id:"corp-b", role:"corporate", email:"b@example.com", name:"Firma B", companyId:"company-b", companyName:"Firma B"
  });
  await setDoc(doc(db, "users/customer-uid"), {
    id:"customer-uid", role:"customer", email:"c@example.com", name:"Bireysel"
  });
  await setDoc(doc(db, "orders/order-a"), {
    customerId:"corp-a", customerType:"corporate", companyId:"company-a", companyName:"Firma A",
    status:"Kurye Bekleniyor", courierId:null, orderType:"standard", distanceKm:5,
    packageCount:1, packageSize:"Küçük", courierType:"Standart Kurye", price:250,
    customerName:"Firma A", customerPhone:"555", pickupAddress:"A", deliveryAddress:"B", note:""
  });
});

const corporateOrder = {
  customerId:"corp-a", customerType:"corporate", companyId:"company-a", companyName:"Firma A",
  status:"Kurye Bekleniyor", courierId:null, orderType:"standard", distanceKm:5,
  packageCount:1, packageSize:"Küçük", courierType:"Standart Kurye", price:250,
  customerName:"Firma A", customerPhone:"555", pickupAddress:"A", deliveryAddress:"B", note:""
};

await assertSucceeds(addDoc(collection(corpA, "orders"), corporateOrder));
await assertFails(addDoc(collection(corpB, "orders"), { ...corporateOrder, companyId:"company-b", companyName:"Firma B", customerId:"corp-b" }));
await assertFails(addDoc(collection(customer, "orders"), { ...corporateOrder, customerId:"customer-uid", customerType:"corporate" }));
await assertSucceeds(getDoc(doc(corpA, "orders/order-a")));
await assertFails(getDoc(doc(corpB, "orders/order-a")));
await assertFails(setDoc(doc(corpA, "users/corp-a"), { role:"admin", email:"a@example.com" }, { merge:true }));

await env.cleanup();
console.log("CORPORATE_RULES_VALIDATION_PASS");
