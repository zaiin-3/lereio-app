const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

async function notifyPartner({ code, senderUid, title, body, tab }) {
  if (!code || !senderUid) return;

  const roomSnap = await db.doc(`rooms/${code}`).get();
  if (!roomSnap.exists) return;

  const memberUids = roomSnap.data().memberUids || [];
  const partnerUid = memberUids.find((uid) => uid !== senderUid);
  if (!partnerUid) return;

  const [senderSnap, partnerSnap] = await Promise.all([
    db.doc(`rooms/${code}/members/${senderUid}`).get(),
    db.doc(`rooms/${code}/members/${partnerUid}`).get()
  ]);

  if (!partnerSnap.exists) return;

  const tokens = partnerSnap.data().fcmTokens || [];
  if (!Array.isArray(tokens) || tokens.length === 0) return;

  const senderName = (senderSnap.exists && senderSnap.data().name) || "Partner";
  const resolvedTitle = title.replace("{sender}", senderName);

  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: {
      title: resolvedTitle,
      body
    },
    data: {
      tab: tab || "home"
    },
    android: {
      priority: "high",
      notification: {
        channelId: "lereio_default",
        sound: "default"
      }
    }
  });

  // Clean up expired or invalid device tokens automatically
  const invalidTokens = [];
  response.responses.forEach((res, idx) => {
    if (!res.success) {
      const errCode = res.error?.code || "";
      if (
        errCode === "messaging/registration-token-not-registered" ||
        errCode === "messaging/invalid-registration-token"
      ) {
        invalidTokens.push(tokens[idx]);
      }
    }
  });

  if (invalidTokens.length > 0) {
    await partnerSnap.ref.update({
      fcmTokens: FieldValue.arrayRemove(...invalidTokens)
    });
  }
}

exports.onNewChatMessage = onDocumentCreated("rooms/{code}/messages/{id}", async (event) => {
  const data = event.data?.data();
  if (!data) return;
  await notifyPartner({
    code: event.params.code,
    senderUid: data.senderUid,
    title: "{sender}",
    body: data.image ? "Sent a photo 📷" : (data.text || "Sent a message"),
    tab: "chat"
  });
});

exports.onNewMemory = onDocumentCreated("rooms/{code}/memories/{id}", async (event) => {
  const data = event.data?.data();
  if (!data) return;
  await notifyPartner({
    code: event.params.code,
    senderUid: data.uploadedBy,
    title: "{sender} added a photo",
    body: data.caption || "Shared Gallery",
    tab: "memories"
  });
});

exports.onNewNote = onDocumentCreated("rooms/{code}/posts/{id}", async (event) => {
  const data = event.data?.data();
  if (!data) return;
  await notifyPartner({
    code: event.params.code,
    senderUid: data.authorUid,
    title: "{sender} left a note",
    body: data.content || "Shared Notes",
    tab: "feed"
  });
});

exports.onThinkingOfYou = onDocumentCreated("rooms/{code}/pings/{id}", async (event) => {
  const data = event.data?.data();
  if (!data) return;
  await notifyPartner({
    code: event.params.code,
    senderUid: data.senderUid,
    title: "{sender}",
    body: "Thinking of you ♡",
    tab: "home"
  });
});