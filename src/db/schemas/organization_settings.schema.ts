import { OrganizationSettings } from "@/types/organization_settings.type";
import { RxJsonSchema } from "rxdb";

export const organizationSettingsSchema: RxJsonSchema<OrganizationSettings> = {
  title: "organization settings schema",
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 36 },
    serie_rgd: { type: "string" },
    logo_url: { type: "string" },
    theme_color: { type: "string" },
    created_at: { type: "number" },
    updated_at: { type: "number" },
    _deleted: { type: "boolean" },
  },
  required: ["id", "_deleted", "created_at", "updated_at"],
};
