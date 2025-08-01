import type { NodeIndex } from "./node-index"
import type {
	OsmGeoJSONProperties,
	OsmNode,
	OsmRelation,
	OsmWay,
} from "./types"
import { wayIsArea } from "./way-is-area"

export function entitiesToGeoJSON(osm: {
	nodes: NodeIndex
	ways: Map<number, OsmWay>
}) {
	return [
		...nodesToFeatures(osm.nodes),
		...osm.ways.values().map((way) => wayToFeature(way, osm.nodes)),
	]
}

function includeNode(node: OsmNode) {
	if (!node.tags || Object.keys(node.tags).length === 0) return false
	return true
}

export function nodesToFeatures(nodes: NodeIndex, filter = includeNode) {
	const features: GeoJSON.Feature<GeoJSON.Point, OsmGeoJSONProperties>[] = []
	for (const node of nodes) {
		if (filter(node)) {
			features.push(nodeToFeature(node))
		}
	}
	return features
}

export function nodeToFeature(
	node: OsmNode,
): GeoJSON.Feature<GeoJSON.Point, OsmGeoJSONProperties> {
	return {
		type: "Feature",
		id: node.id,
		geometry: {
			type: "Point",
			coordinates: [node.lon, node.lat],
		},
		properties: node.tags ?? {},
	}
}

function includeWay(way: OsmWay) {
	if (!way.tags || Object.keys(way.tags).length === 0) return false
	return true
}

export function waysToFeatures(
	ways: Map<number, OsmWay>,
	nodes: NodeIndex,
	filter = includeWay,
) {
	return Array.from(ways.values().filter(filter))
		.map((way) => wayToFeature(way, nodes))
		.filter((f) => f.geometry.type !== "Polygon")
}

export function wayToFeature(
	way: OsmWay,
	nodes: NodeIndex,
): GeoJSON.Feature<GeoJSON.LineString | GeoJSON.Polygon, OsmGeoJSONProperties> {
	return {
		type: "Feature",
		id: way.id,
		geometry: wayIsArea(way.refs, way.tags)
			? {
					type: "Polygon",
					coordinates: [way.refs.map((r) => nodes.getNodePosition(r))],
				}
			: {
					type: "LineString",
					coordinates: way.refs.map((r) => nodes.getNodePosition(r)),
				},
		properties: way.tags ?? {},
	}
}

export function wayToLineString(
	way: OsmWay,
	refToPosition: (r: number) => [number, number],
): GeoJSON.Feature<GeoJSON.LineString, OsmGeoJSONProperties> {
	return {
		type: "Feature",
		id: way.id,
		geometry: {
			type: "LineString",
			coordinates: way.refs.map(refToPosition),
		},
		properties: way.tags ?? {},
	}
}

export function wayToEditableGeoJson(
	way: OsmWay,
	nodes: NodeIndex,
): GeoJSON.FeatureCollection<
	GeoJSON.LineString | GeoJSON.Polygon | GeoJSON.Point,
	OsmGeoJSONProperties
> {
	const getNode = (r: number) => {
		const n = nodes.get(r)
		if (!n) throw new Error(`Node ${r} not found`)
		return n
	}
	const wayFeature = wayToFeature(way, nodes)
	const wayNodes = way.refs.map((id) => {
		const node = getNode(id)
		return nodeToFeature(node)
	})

	return {
		type: "FeatureCollection",
		features: [wayFeature, ...wayNodes],
	}
}

export function relationToFeature(
	relation: OsmRelation,
	nodes: NodeIndex,
): GeoJSON.Feature<GeoJSON.Polygon, OsmGeoJSONProperties> {
	return {
		type: "Feature",
		id: relation.id,
		geometry: {
			type: "Polygon",
			coordinates: [
				relation.members.map((member) => nodes.getNodePosition(member.ref)),
			],
		},
		properties: relation.tags ?? {},
	}
}
