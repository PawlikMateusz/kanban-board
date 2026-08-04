import PocketBase from "pocketbase"

export const pb = new PocketBase("/")
pb.autoCancellation(false)

export function fileUrl(record: { collectionId: string; id: string }, filename: string) {
  return pb.files.getURL(record, filename)
}
