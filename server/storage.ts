import { type Session, type Message, type Vendor, type Call, type Transaction } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Session management
  createSession(): Promise<Session>;
  getSession(id: string): Promise<Session | undefined>;
  updateSession(id: string, updates: Partial<Session>): Promise<Session>;
  
  // Message operations
  addMessage(sessionId: string, message: Message): Promise<void>;
  
  // Vendor operations
  setVendors(sessionId: string, vendors: Vendor[]): Promise<void>;
  setSelectedVendor(sessionId: string, vendor: Vendor): Promise<void>;
  
  // Call operations
  setCurrentCall(sessionId: string, call: Call): Promise<void>;
  updateCall(sessionId: string, updates: Partial<Call>): Promise<void>;
  
  // Transaction operations
  createTransaction(transaction: Transaction): Promise<void>;
  setTransaction(sessionId: string, transaction: Transaction): Promise<void>;
  updateTransaction(sessionId: string, updates: Partial<Transaction>): Promise<void>;
}

export class MemStorage implements IStorage {
  private sessions: Map<string, Session>;

  constructor() {
    this.sessions = new Map();
  }

  async createSession(): Promise<Session> {
    const id = randomUUID();
    const session: Session = {
      id,
      messages: [],
      vendors: [],
      journeyStatus: "chatting",
      createdAt: new Date().toISOString(),
    };
    this.sessions.set(id, session);
    return session;
  }

  async getSession(id: string): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<Session> {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error("Session not found");
    }
    const updated = { ...session, ...updates };
    this.sessions.set(id, updated);
    return updated;
  }

  async addMessage(sessionId: string, message: Message): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    session.messages.push(message);
  }

  async setVendors(sessionId: string, vendors: Vendor[]): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    session.vendors = vendors;
  }

  async setSelectedVendor(sessionId: string, vendor: Vendor): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    session.selectedVendor = vendor;
  }

  async setCurrentCall(sessionId: string, call: Call): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    session.currentCall = call;
  }

  async updateCall(sessionId: string, updates: Partial<Call>): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.currentCall) {
      throw new Error("Call not found");
    }
    session.currentCall = { ...session.currentCall, ...updates };
  }

  async createTransaction(transaction: Transaction): Promise<void> {
    // Find the session that has a vendor matching this transaction's vendorId
    // This is a workaround since Transaction doesn't have sessionId
    const sessions = Array.from(this.sessions.values());
    for (const session of sessions) {
      if (session.selectedVendor?.id === transaction.vendorId) {
        session.transaction = transaction;
        return;
      }
    }
    throw new Error("Session not found for transaction");
  }

  async setTransaction(sessionId: string, transaction: Transaction): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    session.transaction = transaction;
  }

  async updateTransaction(sessionId: string, updates: Partial<Transaction>): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.transaction) {
      throw new Error("Transaction not found");
    }
    session.transaction = { ...session.transaction, ...updates };
  }
}

export const storage = new MemStorage();
