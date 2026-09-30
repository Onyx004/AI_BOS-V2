import {
  administratorMonitoringPermissionKeys,
} from "../constants/administrator-monitoring-access.js";
import {
  AdministratorMonitoringAccessModel,
} from "../models/administrator-monitoring-access.model.js";
import {
  RuntimeMigrationModel,
} from "../models/runtime-migration.model.js";
import { salesDefaultCrmPermissionKeys } from "../constants/permissions.js";
import { removeGuestRole, syncDefaultRoles } from "./default-role-sync.js";
import { AttendanceModel } from "../models/attendance.model.js";
import { RoleModel } from "../models/role.model.js";
import { FaceEnrollmentModel } from "../models/face-enrollment.model.js";
import {
  UserModel,
} from "../models/user.model.js";

const administratorMonitoringAccessMigrationKey =
  "administrator-monitoring-access-v1";
const crmPermissionsMigrationKey = "crm-permissions-v1";
const removeGuestRoleMigrationKey = "remove-guest-role-v1";
const biometricRetentionMigrationKey =
  "face-attendance-biometric-retention-v2";

async function applyAdministratorMonitoringAccessMigration() {
  const applied =
    await RuntimeMigrationModel
      .findOne({
        key:
          administratorMonitoringAccessMigrationKey,
      })
      .lean();

  if (applied) {
    return;
  }

  const administrators =
    await UserModel.find({
      role: {
        $in: [
          "Administrator",
          "Admin",
        ],
      },
    })
      .select(
        "_id",
      )
      .lean();

  if (administrators.length > 0) {
    await AdministratorMonitoringAccessModel
      .bulkWrite(
        administrators.map(
          (administrator) => ({
            updateOne: {
              filter: {
                administratorUserId:
                  administrator._id,
              },
              update: {
                $setOnInsert: {
                  administratorUserId:
                    administrator._id,
                  enabled: true,
                  permissionKeys: [
                    ...administratorMonitoringPermissionKeys,
                  ],
                },
              },
              upsert: true,
            },
          }),
        ),
      );
  }

  await RuntimeMigrationModel.create({
    key:
      administratorMonitoringAccessMigrationKey,
    appliedAt:
      new Date(),
  });
}

async function applyBiometricRetentionMigration() {
  const applied = await RuntimeMigrationModel.findOne({ key: biometricRetentionMigrationKey }).lean();
  if (applied) return;

  // Legacy Face ID versions could retain PNG data in attendance documents.
  // V2 stores descriptors only and removes inactive templates as part of the
  // authorized deletion/replacement lifecycle.
  await AttendanceModel.collection.updateMany(
    {},
    { $unset: { checkInFaceImage: "", checkOutFaceImage: "" } },
  );
  await FaceEnrollmentModel.collection.updateMany(
    { status: { $ne: "active" } },
    { $unset: { templateEncrypted: "", templateHash: "" } },
  );
  await RuntimeMigrationModel.create({ key: biometricRetentionMigrationKey, appliedAt: new Date() });
}

/** Existing databases already have a Sales role; give it the CRM read/write/update defaults without touching other permissions. */
async function applyCrmPermissionsMigration() {
  const applied = await RuntimeMigrationModel.findOne({ key: crmPermissionsMigrationKey }).lean();
  if (applied) return;

  await RoleModel.updateOne({ slug: "sales" }, { $addToSet: { permissionKeys: { $each: salesDefaultCrmPermissionKeys } } });
  await RuntimeMigrationModel.create({ key: crmPermissionsMigrationKey, appliedAt: new Date() });
}

async function applyRemoveGuestRoleMigration() {
  const applied = await RuntimeMigrationModel.findOne({ key: removeGuestRoleMigrationKey }).lean();
  if (applied) return;

  await removeGuestRole();
  await RuntimeMigrationModel.create({ key: removeGuestRoleMigrationKey, appliedAt: new Date() });
}

export async function applyRuntimeMigrations(): Promise<void> {
  await applyAdministratorMonitoringAccessMigration();
  await applyBiometricRetentionMigration();
  await applyCrmPermissionsMigration();
  await applyRemoveGuestRoleMigration();
  // Every start: built-in roles must exist and keep their locked default permissions.
  await syncDefaultRoles();
}
