export type MemberStatus = 'active' | 'churned';

export interface MemberRecord {
  id: string;
  name: string;
  telegram: string;
  phone: string;
  startedAt: string;
  endsAt: string;
  startedAtMs: number;
  endsAtMs: number;
  status: MemberStatus;
  plan: string;
  paymentCount: number;
  lifetimeDays: number;
  recurrent: boolean;
}
