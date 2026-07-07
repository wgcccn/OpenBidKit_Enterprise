export type BusinessBidClauseStatus = 'responded' | 'deviation' | 'pending';
export type BusinessBidAttachmentStatus = 'ready' | 'review' | 'missing';

export interface BusinessBidClauseItem {
  id: string;
  clause: string;
  requirement: string;
  response: string;
  owner: string;
  status: BusinessBidClauseStatus;
}

export interface BusinessBidAttachmentItem {
  id: string;
  name: string;
  type: string;
  status: BusinessBidAttachmentStatus;
}

export interface BusinessBidProjectProfile {
  projectName: string;
  bidderName: string;
  bidAmount: string;
  validityDays: string;
}

export interface BusinessBidWorkspaceState {
  project: BusinessBidProjectProfile;
  clauses: BusinessBidClauseItem[];
  attachments: BusinessBidAttachmentItem[];
  updatedAt?: string;
}
