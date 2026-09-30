import { model, Schema, type HydratedDocument, type Types } from "mongoose";

export type AttendanceLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  distanceMeters: number;
};

export type AttendanceStatus = "Present" | "Checked Out";
export type AttendanceVerificationMethod = "face" | "manual" | "daily_task" | "login" | "auto_offline";

export type Attendance = {
  userId: Types.ObjectId;
  date: string;
  status: AttendanceStatus;
  checkInAt: Date;
  checkOutAt?: Date;
  checkInLocation?: AttendanceLocation;
  checkOutLocation?: AttendanceLocation;
  checkInMethod: AttendanceVerificationMethod;
  checkOutMethod?: AttendanceVerificationMethod;
  checkInManualReason?: string;
  checkOutManualReason?: string;
  checkInFaceVerified?: boolean;
  checkOutFaceVerified?: boolean;
  checkInLivenessPassed?: boolean;
  checkOutLivenessPassed?: boolean;
  checkInFaceEnrollmentId?: Types.ObjectId;
  checkOutFaceEnrollmentId?: Types.ObjectId;
  checkInVerificationModelVersion?: string;
  checkOutVerificationModelVersion?: string;
  checkInVerificationChallengeId?: Types.ObjectId;
  checkOutVerificationChallengeId?: Types.ObjectId;
  checkInDeviceIdHash?: string;
  checkOutDeviceIdHash?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type AttendanceDocument = HydratedDocument<Attendance>;

const attendanceLocationSchema = new Schema<AttendanceLocation>(
  {
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    accuracy: { type: Number, min: 0 },
    distanceMeters: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const attendanceSchema = new Schema<Attendance>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String, required: true, index: true },
    status: { type: String, enum: ["Present", "Checked Out"], default: "Present", index: true },
    checkInAt: { type: Date, required: true },
    checkOutAt: { type: Date },
    checkInLocation: { type: attendanceLocationSchema },
    checkOutLocation: { type: attendanceLocationSchema },
    checkInMethod: { type: String, enum: ["face", "manual", "daily_task", "login", "auto_offline"], required: true, default: "face", index: true },
    checkOutMethod: { type: String, enum: ["face", "manual", "daily_task", "login", "auto_offline"], index: true },
    checkInManualReason: { type: String, trim: true, maxlength: 240 },
    checkOutManualReason: { type: String, trim: true, maxlength: 240 },
    checkInFaceVerified: { type: Boolean, default: false },
    checkOutFaceVerified: { type: Boolean, default: false },
    checkInLivenessPassed: { type: Boolean, default: false },
    checkOutLivenessPassed: { type: Boolean, default: false },
    checkInFaceEnrollmentId: { type: Schema.Types.ObjectId, ref: "FaceEnrollment" },
    checkOutFaceEnrollmentId: { type: Schema.Types.ObjectId, ref: "FaceEnrollment" },
    checkInVerificationModelVersion: { type: String, trim: true, maxlength: 80 },
    checkOutVerificationModelVersion: { type: String, trim: true, maxlength: 80 },
    checkInVerificationChallengeId: { type: Schema.Types.ObjectId, ref: "FaceVerificationChallenge" },
    checkOutVerificationChallengeId: { type: Schema.Types.ObjectId, ref: "FaceVerificationChallenge" },
    checkInDeviceIdHash: { type: String, select: false },
    checkOutDeviceIdHash: { type: String, select: false },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(_document, value) {
        const output = value as Record<string, unknown>;
        delete output.checkInDeviceIdHash;
        delete output.checkOutDeviceIdHash;
        delete output.checkInFaceImage;
        delete output.checkOutFaceImage;
        return output;
      },
    },
  },
);

attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: -1, status: 1 });

export const AttendanceModel = model("Attendance", attendanceSchema);
