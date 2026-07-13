/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as authUtils from "../authUtils.js";
import type * as categories from "../categories.js";
import type * as cleanup from "../cleanup.js";
import type * as email from "../email.js";
import type * as floraFauna from "../floraFauna.js";
import type * as gematria from "../gematria.js";
import type * as groups from "../groups.js";
import type * as lib_taxonomy from "../lib/taxonomy.js";
import type * as merch from "../merch.js";
import type * as redesign from "../redesign.js";
import type * as roles from "../roles.js";
import type * as seed from "../seed.js";
import type * as stickers from "../stickers.js";
import type * as subcategories from "../subcategories.js";
import type * as taxonomy from "../taxonomy.js";
import type * as taxonomyAudit from "../taxonomyAudit.js";
import type * as trinity from "../trinity.js";
import type * as uploads from "../uploads.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authUtils: typeof authUtils;
  categories: typeof categories;
  cleanup: typeof cleanup;
  email: typeof email;
  floraFauna: typeof floraFauna;
  gematria: typeof gematria;
  groups: typeof groups;
  "lib/taxonomy": typeof lib_taxonomy;
  merch: typeof merch;
  redesign: typeof redesign;
  roles: typeof roles;
  seed: typeof seed;
  stickers: typeof stickers;
  subcategories: typeof subcategories;
  taxonomy: typeof taxonomy;
  taxonomyAudit: typeof taxonomyAudit;
  trinity: typeof trinity;
  uploads: typeof uploads;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
