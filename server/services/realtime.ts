import type { Server as HttpServer } from "node:http";
import type { Socket } from "socket.io";
import { Server } from "socket.io";
import { parse as parseCookie } from "cookie";
import { SESSION_COOKIE, verifySession } from "../middleware/auth";

let io: Server | null = null;

export function configureRealtime(server: HttpServer): Server {
  io = new Server(server, {
    transports: ["websocket", "polling"]
  });

  io.use((socket: Socket, next) => {
    try {
      const cookies = parseCookie(socket.handshake.headers.cookie ?? "");
      const token = cookies[SESSION_COOKIE];
      if (!token) return next(new Error("unauthorized"));
      verifySession(token);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join("admins");
  });

  return io;
}

export function emitDashboardUpdate(payload: unknown): void {
  io?.to("admins").emit("dashboard:update", payload);
}

export function emitNewOrder(payload: unknown): void {
  io?.to("admins").emit("order:new", payload);
}
