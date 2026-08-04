import { wipeAllData } from "./helpers"

/**
 * Wipes the isolated test DB so every run starts from a clean slate
 * (fresh DB anyway via pb_data_test, this guards against leftovers).
 */
export default async function globalSetup() {
  await wipeAllData()
}
