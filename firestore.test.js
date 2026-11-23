import { createRequire } from "node:module";
import { test, before, after, beforeEach } from "node:test";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");

let testEnv;
const PROJECT_ID = process.env.GCP_PROJECT || "demo-no-project";
const HOST_A_UID = "host_alpha_uid";
const HOST_B_UID = "host_beta_uid";
const STUDENT_UID = "student_rahul_uid";
const VOLUNTEER_UID = "volunteer_door_uid";

const [emulatorHost, emulatorPortStr] = (
  process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085"
).split(":");
const emulatorPort = parseInt(emulatorPortStr, 10);

before(async () => {
  const rules = fs.readFileSync("./firestore.rules", "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: emulatorHost,
      port: emulatorPort,
    },
  });
});

after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

function pastDate(offsetMs = 5000) {
  return new Date(Date.now() - offsetMs);
}

test("Unauthenticated users cannot read or write any collection", async () => {
  const unauthDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(unauthDb.collection("events").where("status", "==", "published").get());
  await assertFails(unauthDb.collection("tickets").where("userId", "==", STUDENT_UID).get());
  await assertFails(unauthDb.collection("payouts").where("hostId", "==", HOST_A_UID).get());
  await assertFails(
    unauthDb.collection("users").doc(STUDENT_UID).set({
      userId: STUDENT_UID,
      name: "Fake",
      email: "fake@campus.edu",
      role: "user",
      createdAt: pastDate(),
      updatedAt: pastDate(),
    })
  );
});

test("User profiles are strictly isolated to owner", async () => {
  const hostDb = testEnv.authenticatedContext(HOST_A_UID).firestore();
  const studentDb = testEnv.authenticatedContext(STUDENT_UID).firestore();
  const now = pastDate();

  await assertSucceeds(
    hostDb.collection("users").doc(HOST_A_UID).set({
      userId: HOST_A_UID,
      name: "Organizer Alpha",
      email: "alpha@campus.edu",
      role: "host",
      college: "IIT Tech",
      createdAt: now,
      updatedAt: now,
    })
  );

  // Student cannot read Host's profile or overwrite it
  await assertFails(studentDb.collection("users").doc(HOST_A_UID).get());
  await assertFails(
    studentDb.collection("users").doc(HOST_A_UID).update({
      name: "Hacked",
      updatedAt: pastDate(1000),
    })
  );
});

test("Organizer A can create/edit own events; Organizer B cannot edit or delete Organizer A's events", async () => {
  const hostADb = testEnv.authenticatedContext(HOST_A_UID).firestore();
  const hostBDb = testEnv.authenticatedContext(HOST_B_UID).firestore();
  const now = pastDate();

  await assertSucceeds(
    hostADb.collection("events").doc("evt_alpha_1").set({
      hostId: HOST_A_UID,
      hostName: "Tech Society",
      title: "HackFest 2026",
      description: "24h Campus Hackathon",
      imageUrl: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d",
      date: "2026-11-30",
      startTime: "09:00 AM",
      endTime: "06:00 PM",
      location: "Main Campus",
      venue: "Auditorium A",
      price: 299,
      capacity: 100,
      ticketsSold: 0,
      availableTickets: 100,
      status: "published",
      category: "Hackathon",
      gatePin: "482910",
      createdAt: now,
      updatedAt: now,
    })
  );

  // Host B cannot edit or delete Host A's event
  await assertFails(
    hostBDb.collection("events").doc("evt_alpha_1").update({
      title: "Hijacked Fest",
      updatedAt: pastDate(1000),
    })
  );
  await assertFails(hostBDb.collection("events").doc("evt_alpha_1").delete());

  // Host A can query own events
  await assertSucceeds(
    hostADb.collection("events").where("hostId", "==", HOST_A_UID).get()
  );
});

test("Student booking, organizer strict isolation, and Volunteer Gate PIN vs Wrong PIN verification", async () => {
  const hostADb = testEnv.authenticatedContext(HOST_A_UID).firestore();
  const hostBDb = testEnv.authenticatedContext(HOST_B_UID).firestore();
  const studentDb = testEnv.authenticatedContext(STUDENT_UID).firestore();
  const volunteerDb = testEnv.authenticatedContext(VOLUNTEER_UID).firestore();
  const created = pastDate(10000);

  await assertSucceeds(
    hostADb.collection("events").doc("evt_alpha_1").set({
      hostId: HOST_A_UID,
      hostName: "Tech Society",
      title: "HackFest 2026",
      description: "24h Campus Hackathon",
      imageUrl: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d",
      date: "2026-11-30",
      startTime: "09:00 AM",
      endTime: "06:00 PM",
      location: "Main Campus",
      venue: "Auditorium A",
      price: 299,
      capacity: 100,
      ticketsSold: 0,
      availableTickets: 100,
      status: "published",
      category: "Hackathon",
      gatePin: "482910",
      createdAt: created,
      updatedAt: created,
    })
  );

  // Student updates event counters (+1 sold / -1 avail) and creates ticket
  await assertSucceeds(
    studentDb.collection("events").doc("evt_alpha_1").update({
      ticketsSold: 1,
      availableTickets: 99,
      status: "published",
      updatedAt: pastDate(5000),
    })
  );

  await assertSucceeds(
    studentDb.collection("tickets").doc("TKT-1001").set({
      eventId: "evt_alpha_1",
      eventTitle: "HackFest 2026",
      eventDate: "2026-11-30",
      eventTime: "09:00 AM",
      eventVenue: "Auditorium A",
      eventImageUrl: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d",
      userId: STUDENT_UID,
      userName: "Rahul Sharma",
      userEmail: "rahul@campus.edu",
      college: "IIT Tech",
      rollNo: "CS2026-42",
      hostId: HOST_A_UID,
      amount: 299,
      status: "confirmed",
      qrToken: "CP-PASS-TKT-1001-ABC",
      qrHash: "9f86d081884c7d659a2feaa0c55ad015",
      entryStatus: "not_entered",
      createdAt: created,
      updatedAt: created,
    })
  );

  // Organizer B CANNOT read Organizer A's tickets or list them
  await assertFails(hostBDb.collection("tickets").doc("TKT-1001").get());
  await assertFails(
    hostBDb.collection("tickets").where("hostId", "==", HOST_A_UID).get()
  );
  // Organizer B CANNOT scan Organizer A's ticket!
  await assertFails(
    hostBDb.collection("tickets").doc("TKT-1001").update({
      entryStatus: "entered",
      entryTime: "10:15:00 AM",
      entryTimestampMs: Date.now() - 1000,
      verifiedBy: "organizer",
      updatedAt: pastDate(1000),
    })
  );

  // Volunteer CANNOT list tickets PII or check in with wrong Gate PIN
  await assertFails(volunteerDb.collection("tickets").doc("TKT-1001").get());
  await assertFails(
    volunteerDb.collection("tickets").doc("TKT-1001").update({
      entryStatus: "entered",
      entryTime: "10:15:00 AM",
      entryTimestampMs: Date.now() - 1000,
      verifiedBy: "volunteer",
      volunteerPin: "000000",
      updatedAt: pastDate(1000),
    })
  );

  // Volunteer with VALID 6-digit Gate PIN "482910" SUCCEEDS on check-in
  await assertSucceeds(
    volunteerDb.collection("tickets").doc("TKT-1001").update({
      entryStatus: "entered",
      entryTime: "10:15:05 AM",
      entryTimestampMs: Date.now() - 1000,
      verifiedBy: "volunteer",
      volunteerPin: "482910",
      updatedAt: pastDate(1000),
    })
  );

  // Duplicate volunteer scan is REJECTED by rules because entryStatus is already 'entered'
  await assertFails(
    volunteerDb.collection("tickets").doc("TKT-1001").update({
      entryStatus: "entered",
      entryTime: "10:16:00 AM",
      entryTimestampMs: Date.now() - 500,
      verifiedBy: "volunteer",
      volunteerPin: "482910",
      updatedAt: pastDate(500),
    })
  );

  // Organizer A CAN list their own event's tickets and see the volunteer check-in!
  await assertSucceeds(
    hostADb.collection("tickets").where("hostId", "==", HOST_A_UID).get()
  );
});

test("Organizer payouts are strictly isolated per organizer and immutable", async () => {
  const hostADb = testEnv.authenticatedContext(HOST_A_UID).firestore();
  const hostBDb = testEnv.authenticatedContext(HOST_B_UID).firestore();
  const now = pastDate();

  await assertSucceeds(
    hostADb.collection("payouts").doc("PAY-9001").set({
      hostId: HOST_A_UID,
      hostName: "Organizer Alpha",
      amount: 500,
      method: "UPI",
      destination: "alpha@okaxis",
      accountHolderName: "Tech Society",
      status: "completed",
      referenceId: "UTR8492019283",
      createdAt: now,
      updatedAt: now,
    })
  );

  await assertSucceeds(
    hostADb.collection("payouts").where("hostId", "==", HOST_A_UID).get()
  );
  await assertFails(hostBDb.collection("payouts").doc("PAY-9001").get());
  await assertFails(
    hostBDb.collection("payouts").where("hostId", "==", HOST_A_UID).get()
  );
  await assertFails(
    hostADb.collection("payouts").doc("PAY-9001").update({ amount: 99999 })
  );
});
