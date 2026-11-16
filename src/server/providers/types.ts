export interface SmsProvider {
  send(msg: {
    to: string;
    templateId: string;
    vars: Record<string, string>;
  }): Promise<{ providerMessageId: string }>;
}

export interface EmailProvider {
  send(msg: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<{ providerMessageId: string }>;
}

export interface PaymentGateway {
  createOrder(i: {
    amountPaise: number;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<{ gatewayOrderId: string }>;
  fetchPayment(id: string): Promise<{
    id: string;
    orderId: string;
    amountPaise: number;
    status: "captured" | "failed" | "authorized";
  }>;
  verifySignature(i: { orderId: string; paymentId: string; signature: string }): boolean;
  refund(i: {
    paymentId: string;
    amountPaise: number;
    idempotencyKey: string;
  }): Promise<{ refundId: string }>;
}

export interface FileStore {
  put(path: string, body: Uint8Array, contentType: string): Promise<void>;
  get(path: string): Promise<{ body: Uint8Array; contentType: string } | null>;
  delete(path: string): Promise<void>;
}

export type Deps = {
  sms: SmsProvider;
  email: EmailProvider;
  payments: PaymentGateway;
  files: FileStore;
  now: () => Date;
};
