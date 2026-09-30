import { model, Schema, type HydratedDocument, type Types } from "mongoose";

export type EmployeeDocumentRef = { name: string; type: string; size: string };

export type EmployeeProfile = {
  phone?: string;
  location?: string;
  designation?: string;
  employmentType?: string;
  joiningDate?: Date;
  employmentStatus?: "Active" | "On Leave" | "Inactive";
  personalInformation?: {
    dateOfBirth?: string;
    gender?: string;
    nationality?: string;
    maritalStatus?: string;
  };
  contact?: {
    address?: string;
    emergencyContact?: string;
  };
  skills?: string[];
  experience?: string[];
  education?: string[];
  documents?: EmployeeDocumentRef[];
  salaryDetails?: {
    annualCtc?: number;
    monthlySalary?: number;
    bank?: string;
    taxId?: string;
  };
  performanceScore?: number;
  employeeCode?: string;
};

export type User = {
  fullName: string;
  companyName: string;
  email: string;
  passwordHash: string;
  pinHash?: string;
  pinSetAt?: Date;
  lastSeenAt?: Date;
  role: string;
  isEmailVerified: boolean;
  isActive: boolean;
  lastLoginAt?: Date;
  organizationId?: Types.ObjectId;
  departmentId?: Types.ObjectId;
  branchId?: Types.ObjectId;
  managerId?: Types.ObjectId;
  teamIds?: Types.ObjectId[];
  avatar?: string;
  employeeProfile?: EmployeeProfile;
  isProfileComplete: boolean;
  mustChangePassword: boolean;
  passwordChangedAt?: Date;
  temporaryPasswordExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type UserDocument = HydratedDocument<User>;

const employeeProfileSchema = new Schema<EmployeeProfile>(
  {
    phone: { type: String, trim: true, maxlength: 32 },
    location: { type: String, trim: true, maxlength: 160 },
    designation: { type: String, trim: true, maxlength: 120 },
    employmentType: { type: String, trim: true, maxlength: 40 },
    joiningDate: { type: Date },
    employmentStatus: { type: String, enum: ["Active", "On Leave", "Inactive"] },
    personalInformation: {
      dateOfBirth: { type: String, trim: true, maxlength: 32 },
      gender: { type: String, trim: true, maxlength: 32 },
      nationality: { type: String, trim: true, maxlength: 64 },
      maritalStatus: { type: String, trim: true, maxlength: 32 },
    },
    contact: {
      address: { type: String, trim: true, maxlength: 240 },
      emergencyContact: { type: String, trim: true, maxlength: 64 },
    },
    skills: [{ type: String, trim: true, maxlength: 60 }],
    experience: [{ type: String, trim: true, maxlength: 200 }],
    education: [{ type: String, trim: true, maxlength: 200 }],
    documents: [
      {
        name: { type: String, trim: true, maxlength: 160 },
        type: { type: String, trim: true, maxlength: 40 },
        size: { type: String, trim: true, maxlength: 20 },
      },
    ],
    salaryDetails: {
      annualCtc: { type: Number, min: 0 },
      monthlySalary: { type: Number, min: 0 },
      bank: { type: String, trim: true, maxlength: 120 },
      taxId: { type: String, trim: true, maxlength: 40 },
    },
    performanceScore: { type: Number, min: 0, max: 100 },
    employeeCode: { type: String, trim: true, maxlength: 40 },
  },
  { _id: false },
);

const userSchema = new Schema<User>(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    pinHash: {
      type: String,
      select: false,
    },
    pinSetAt: {
      type: Date,
    },
    lastSeenAt: {
      type: Date,
      index: true,
    },
    role: {
      type: String,
      default: "Employee",
      index: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLoginAt: {
      type: Date,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      index: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      index: true,
    },
    managerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    teamIds: [{ type: Schema.Types.ObjectId, ref: "Team" }],
    avatar: { type: String },
    employeeProfile: { type: employeeProfileSchema, default: undefined },
    isProfileComplete: {
      type: Boolean,
      default: false,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
      index: true,
    },
    passwordChangedAt: {
      type: Date,
    },
    temporaryPasswordExpiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(_doc, ret) {
        const response = ret as { passwordHash?: string };
        delete response.passwordHash;
        return ret;
      },
    },
  },
);

export const UserModel = model("User", userSchema);
