import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import { verifyAccessToken } from "../utils/jwt";
import { getLiveMetrics } from "../services/metricsService";
import { db } from "../db/client";
import { transactions, events } from "../db/schema";
import { faker } from "@faker-js/faker";
import type { WsServerMessage, WsClientMessage } from "@dashboard/shared";

interface AuthenticatedWs extends WebSocket {
  userId?: string;
  isAlive: boolean;
}

let wss: WebSocketServer;

function broadcast(message: WsServerMessage) {
  if (!wss) return;
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

export function setupWebSocket(server: Server) {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: AuthenticatedWs, req: IncomingMessage) => {
    ws.isAlive = true;

    // Authenticate via token in query string
    const url = new URL(req.url ?? "", `http://localhost`);
    const token = url.searchParams.get("token");

    if (!token) {
      ws.close(4001, "Unauthorized");
      return;
    }

    try {
      const payload = verifyAccessToken(token);
      ws.userId = payload.userId;
    } catch {
      ws.close(4001, "Token invalid or expired");
      return;
    }

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (data) => {
      try {
        const msg: WsClientMessage = JSON.parse(data.toString());
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on("close", () => {
      // cleanup if needed
    });
  });

  // Ping/pong heartbeat
  setInterval(() => {
    wss.clients.forEach((client) => {
      const ws = client as AuthenticatedWs;
      if (!ws.isAlive) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  // Broadcast live metrics every 5 seconds
  setInterval(async () => {
    if (wss.clients.size === 0) return;
    try {
      const metrics = await getLiveMetrics();
      broadcast({ type: "metrics_update", data: metrics as any });
    } catch {
      // ignore
    }
  }, 30000);

  // Live data simulator — disabled by default, enable via toggle
  let simulatorEnabled = false;

  function startSimulator() {
    const delay = 8000 + Math.random() * 12000; // slower: 8-20 seconds
    setTimeout(async () => {
      if (simulatorEnabled) {
        await simulateEvent();
      }
      startSimulator();
    }, delay);
  }

  startSimulator();

  return {
    enableSimulator: () => {
      simulatorEnabled = true;
    },
    disableSimulator: () => {
      simulatorEnabled = false;
    },
  };
}

async function simulateEvent() {
  // Pick a random customer and generate a random event
  const eventTypes = ["login", "feature_use", "api_call", "export", "settings_change"];
  const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

  const [event] = await db
    .insert(events)
    .values({
      eventType,
      metadata: { simulated: true, source: "live_simulator" },
    })
    .returning();

  broadcast({
    type: "new_event",
    data: {
      id: event.id,
      customerId: event.customerId ?? "",
      eventType: event.eventType,
      createdAt: event.createdAt?.toISOString() ?? new Date().toISOString(),
    },
  });

  // Occasionally generate a new transaction (20% chance)
  if (Math.random() < 0.2) {
    const amount = (29 + Math.random() * 970).toFixed(2);
    const [tx] = await db
      .insert(transactions)
      .values({
        type: "payment",
        amount,
        currency: "USD",
      })
      .returning();

    broadcast({
      type: "new_transaction",
      data: {
        id: tx.id,
        customerId: tx.customerId ?? "",
        customerName: faker.company.name(),
        customerEmail: faker.internet.email(),
        plan: faker.helpers.arrayElement(["starter", "growth", "enterprise"]),
        type: tx.type as any,
        amount: parseFloat(String(tx.amount)),
        currency: tx.currency ?? "USD",
        createdAt: tx.createdAt?.toISOString() ?? new Date().toISOString(),
      },
    });
  }
}
