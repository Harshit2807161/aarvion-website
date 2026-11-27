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

/**
 * Private file storage. Every provider checks keys with `assertSafeKey` and content types with
 * `assertStoredType` (file-keys.ts). `put` never overwrites: an existing key throws
 * `FileExistsError`. `get` returns null for a missing file and throws `FileTooLargeError` over
 * `maxBytes` (default `DEFAULT_MAX_READ_BYTES`, 8 MiB).
 */
export interface FileStore {
  readonly kind: "memory" | "local" | "blob";
  put(path: string, body: Uint8Array, contentType: string): Promise<void>;
  get(
    path: string,
    opts?: { maxBytes?: number },
  ): Promise<{ body: Uint8Array; contentType: string } | null>;
  delete(path: string): Promise<void>;
}

export type Deps = {
  sms: SmsProvider;
  email: EmailProvider;
  payments: PaymentGateway;
  files: FileStore;
  now: () => Date;
};
