import fetch from "node-fetch";
import webpush from "web-push";
import http from "http";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;

webpush.setVapidDetails(
  "mailto:example@example.com",
  VAPID_PUBLIC,
  VAPID_PRIVATE
);

let lastTicketId = null;
let subscribers = [];

function sendPush(title, body) {
  subscribers.forEach(sub => {
    webpush.sendNotification(sub, JSON.stringify({ title, body }))
      .catch(err => console.log("Push error:", err));
  });
}

async function checkTickets() {
  try {
    const res = await fetch("https://bpms.okcs.com/api/tickets/latest");
    const data = await res.json();
    const currentId = data.id;

    if (lastTicketId === null) {
      lastTicketId = currentId;
      return;
    }

    if (currentId > lastTicketId) {
      lastTicketId = currentId;
      sendPush("تیکت جدید", "یک تیکت جدید برای شما ثبت شد");
    }
  } catch (e) {
    console.log("Error checking tickets:", e);
  }
}

setInterval(checkTickets, 30000);

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/subscribe") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      const sub = JSON.parse(body);
      subscribers.push(sub);
      res.writeHead(201);
      res.end("Subscribed");
    });
  } else {
    res.writeHead(200);
    res.end("BPMS Push Server Running");
  }
});

server.listen(3000, () => console.log("Server running on port 3000"));
