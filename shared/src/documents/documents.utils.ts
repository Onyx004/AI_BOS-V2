import type { ManagedDocument } from "./documents.types";

export function getDocumentStats(documents: ManagedDocument[]) {
 return {
 total: documents.length,
 shared: documents.filter((document) => document.sharedWith.length > 0).length,
 versions: documents.reduce((sum, document) => sum + document.versions.length, 0),
 storage: documents.length * 2.1,
 };
}
