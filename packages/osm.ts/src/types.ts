import type { OsmPbfInfo } from "./proto/osmformat"

/**
 * A bounding box in the format [minLon, minLat, maxLon, maxLat].
 * GeoJSON.BBox allows for 3D bounding boxes, but we use tools that expect 2D bounding boxes.
 */
export type Bbox = [number, number, number, number]

export type OsmReadStats = {
	blocks: number
	chunks: number
	inflateMs: number
	inflateBytes: number
}

export interface OsmPbfInfoParsed extends OsmPbfInfo {
	user?: string
}

export interface OsmTags {
	[key: string]: string
}

export interface OsmEntity {
	id: number
	tags?: OsmTags
	info?: OsmPbfInfoParsed
}

export interface OsmNode extends OsmEntity {
	lat: number
	lon: number
}

export interface OsmWay extends OsmEntity {
	refs: number[]
}

export interface OsmRelationMember {
	type: string
	ref: number
	role?: string
}

export interface OsmRelation extends OsmEntity {
	members: OsmRelationMember[]
}

export type OsmGeoJSONProperties = {
	info?: OsmPbfInfoParsed
	tags?: OsmTags
}

export type OsmGeoJSONFeature = GeoJSON.Feature<
	GeoJSON.Point | GeoJSON.LineString | GeoJSON.Polygon,
	OsmGeoJSONProperties
>
