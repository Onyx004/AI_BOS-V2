import { model, Schema, type HydratedDocument, type Types } from "mongoose";

export const meetingStatuses = ["Scheduled", "In Progress", "Completed", "Cancelled"] as const;
export type MeetingStatus = (typeof meetingStatuses)[number];

export const meetingSources = ["manual", "google", "zoom"] as const;
export type MeetingSource = (typeof meetingSources)[number];

export type Meeting = {
  organizationId?: Types.ObjectId;
  title: string;
  organizerId?: Types.ObjectId;
  organizerName: string;
  startTime: Date;
  endTime?: Date;
  status: MeetingStatus;
  link?: string;
  source: MeetingSource;
  externalId?: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type MeetingDocument = HydratedDocument<Meeting>;

const meetingSchema = new Schema<Meeting>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", index: true },
    title: { type: String, required: true, trim: true, maxlength: 200, index: true },
    organizerId: { type: Schema.Types.ObjectId, ref: "User" },
    organizerName: { type: String, required: true, trim: true, maxlength: 160 },
    startTime: { type: Date, required: true, index: true },
    endTime: { type: Date },
    status: { type: String, enum: meetingStatuses, default: "Scheduled", index: true },
    link: { type: String, trim: true, maxlength: 500 },
    source: { type: String, enum: meetingSources, default: "manual", index: true },
    externalId: { type: String, trim: true, maxlength: 200 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, versionKey: false },
);

meetingSchema.index({ organizationId: 1, source: 1, externalId: 1 }, { unique: false });
meetingSchema.index({ organizationId: 1, startTime: -1 });

export const MeetingModel = model("Meeting", meetingSchema);
