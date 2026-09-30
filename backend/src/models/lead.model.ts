import { model, Schema, type HydratedDocument, type Types } from "mongoose";

export const leadStatuses = ["New", "Contacted", "Qualified", "Proposal", "Negotiation", "Won", "Lost"] as const;
export type LeadStatus = (typeof leadStatuses)[number];

export type LeadActivity = { title: string; detail: string; at: Date; by?: Types.ObjectId };

export type Lead = {
  organizationId?: Types.ObjectId;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  source: string;
  status: LeadStatus;
  value: number;
  currency?: string;
  ownerId?: Types.ObjectId;
  metadata: Record<string, unknown>;
  activities: LeadActivity[];
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type LeadDocument = HydratedDocument<Lead>;

const leadSchema = new Schema<Lead>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", index: true },
    name: { type: String, required: true, trim: true, maxlength: 160, index: true },
    company: { type: String, trim: true, maxlength: 180, index: true },
    email: { type: String, trim: true, lowercase: true, maxlength: 180, index: true },
    phone: { type: String, trim: true, maxlength: 32 },
    source: { type: String, required: true, trim: true, maxlength: 80, default: "Workflow", index: true },
    status: { type: String, enum: leadStatuses, default: "New", index: true },
    value: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, uppercase: true, maxlength: 3 },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    activities: {
      type: [
        new Schema<LeadActivity>(
          {
            title: { type: String, required: true, maxlength: 120 },
            detail: { type: String, default: "", maxlength: 400 },
            at: { type: Date, default: Date.now },
            by: { type: Schema.Types.ObjectId, ref: "User" },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, versionKey: false },
);

leadSchema.index({ name: "text", company: "text", email: "text", source: "text" });
leadSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
leadSchema.index({ ownerId: 1, status: 1, createdAt: -1 });

export const LeadModel = model("Lead", leadSchema);
