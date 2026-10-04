import { MyDatabase } from "../collections";
import { createReplication } from "./base/createReplication";
import { OrganizationSettings } from "@/types/organization_settings.type";

export function replicateOrganizationSettingsNew(
  db: MyDatabase,
  supabaseUrl: string,
  supabaseKey: string,
) {
  const repl = createReplication<OrganizationSettings>({
    collectionName: "organization_settings",
    tableName: "organization_settings",
  });
  return repl(db, supabaseUrl, supabaseKey);
}
