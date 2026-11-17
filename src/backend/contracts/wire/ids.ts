import { z } from "zod";
import { publicIdPattern, type IdPrefix } from "./id-prefixes.ts";

export { ID_PREFIX, publicIdPattern, type IdPrefix } from "./id-prefixes.ts";

/** Zod factory for a public ID of the given prefix, e.g. `publicId("pst")`. */
export function publicId(prefix: IdPrefix) {
  return z.string().regex(publicIdPattern(prefix), `Must be a ${prefix}_ id`);
}

/** ISO-8601 UTC timestamp with milliseconds and `Z` (03-domain-and-entity-map.md). */
export const IsoDateTime = z.string().datetime({ precision: 3 });
