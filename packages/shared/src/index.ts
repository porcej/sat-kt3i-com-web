import { z } from "zod";

/** CelesTrak GP / OMM JSON record (subset validated at API boundary). */
export const OmmRecordSchema = z.object({
  OBJECT_NAME: z.string(),
  OBJECT_ID: z.string().optional(),
  EPOCH: z.string(),
  MEAN_MOTION: z.number(),
  ECCENTRICITY: z.number(),
  INCLINATION: z.number(),
  RA_OF_ASC_NODE: z.number(),
  ARG_OF_PERICENTER: z.number(),
  MEAN_ANOMALY: z.number(),
  EPHEMERIS_TYPE: z.number().optional(),
  CLASSIFICATION_TYPE: z.string().optional(),
  NORAD_CAT_ID: z.number(),
  ELEMENT_SET_NO: z.number().optional(),
  REV_AT_EPOCH: z.number().optional(),
  BSTAR: z.number(),
  MEAN_MOTION_DOT: z.number(),
  MEAN_MOTION_DDOT: z.number().optional(),
  TLE_LINE1: z.string().optional(),
  TLE_LINE2: z.string().optional(),
});

export type OmmRecord = z.infer<typeof OmmRecordSchema>;

/** Two-line element set only (e.g. AMSAT bulletins). */
export const TleOnlyRecordSchema = z.object({
  OBJECT_NAME: z.string(),
  NORAD_CAT_ID: z.number(),
  TLE_LINE1: z.string(),
  TLE_LINE2: z.string(),
});

export type TleOnlyRecord = z.infer<typeof TleOnlyRecordSchema>;

export const CatalogRecordSchema = z.union([OmmRecordSchema, TleOnlyRecordSchema]);

export type CatalogRecord = z.infer<typeof CatalogRecordSchema>;

export const SatelliteGroupSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  source: z.enum(["celestrak", "amsat", "space-track"]),
  celestrakGroup: z.string().optional(),
  tleUrl: z.string().url().optional(),
  /** Path after `https://www.space-track.org/basicspacedata/query/` */
  spaceTrackQuery: z.string().optional(),
});

export type SatelliteGroup = z.infer<typeof SatelliteGroupSchema>;

export const GroupsResponseSchema = z.object({
  groups: z.array(SatelliteGroupSchema),
});

export const ElementsResponseSchema = z.object({
  satelliteId: z.number(),
  source: z.string(),
  record: CatalogRecordSchema.nullable(),
  error: z.string().optional(),
});

export const TleCachePayloadSchema = z.object({
  fetchedAt: z.string(),
  source: z.string(),
  groupId: z.string(),
  satellites: z.array(CatalogRecordSchema),
  lastError: z.string().optional(),
});

export type TleCachePayload = z.infer<typeof TleCachePayloadSchema>;
