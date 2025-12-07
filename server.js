import http from "http";
import fetch from "node-fetch";
import webpush from "web-push";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;

const BPMS_USER = process.env.BPMS_USER;
const BPMS_PASS = process.env.BPMS_PASS;

webpush.setVapidDetails(
  "mailto:example@example.com",
  VAPID_PUBLIC,
  VAPID_PRIVATE
);

let lastTicketId = null;
let subscribers = [];
let authCookie = null;

async function loginToBPMS() {
  try {
    const res = await fetch("https://bizagiback.okcs.com/api/Account/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: BPMS_USER,
        password: BPMS_PASS
      })
    });

    const setCookie = res.headers.get("set-cookie");
    if (setCookie && setCookie.includes(".ASPXAUTH")) {
      authCookie = setCookie.split(";")[0];
      console.log("✅ Logged in to BPMS");
    } else {
      console.log("❌ Login failed: no auth cookie");
    }
  } catch (err) {
    console.log("❌ Login error:", err);
  }
}

async function checkTickets() {
  if (!authCookie) {
    await loginToBPMS();
    if (!authCookie) return;
  }

  try {
    const res = await fetch(
      "https://bpms.okcs.com/Rest/Inbox/FullSummary?taskState=all",
      {
        headers: { Cookie: authCookie }
      }
    );

    const data = await res.json();
    const latest = data[0];
    if (!latest) return;

    const currentId = latest.taskId || latest.id || latest.caseId;

    if (lastTicketId === null) {
      lastTicketId = currentId;
      return;
    }

    if (currentId !== lastTicketId) {
      lastTicketId = currentId;
      const title = "تیکت جدید";
      const body = latest.taskName || "یک تیکت جدید ثبت شد";
      sendPush(title, body);
      console.log("📨 New ticket notification sent:", currentId);
    }
  } catch (err) {
    console.log("❌ Error checking tickets:", err);
    authCookie = null; // لاگین دوباره در چک بعدی
  }
}

function sendPush(title, body) {
  subscribers.forEach(sub => {
    webpush
      .sendNotification(sub, JSON.stringify({ title, body }))
      .catch(err => console.log("Push error:", err));
  });
}

setInterval(checkTickets, 30000);

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/subscribe") {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", () => {
      const sub = JSON.parse(body);
      subscribers.push(sub);
      res.writeHead(201);
      res.end("✅ Subscribed");
    });
  } else {
    res.writeHead(200);
    res.end("BPMS Push Server Running");
  }
});

server.listen(3000, () => console.log("🚀 Server running on port 3000"));
