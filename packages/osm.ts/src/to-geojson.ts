import type {
	OsmGeoJSONProperties,
	OsmNode,
	OsmRelation,
	OsmWay,
} from "./types"
import { wayIsArea } from "./way-is-area"

export async function* generateGeoJsonFromEntities(
	entities: AsyncGenerator<OsmNode | OsmWay | OsmRelation | OsmNode[]>,
) {
	const nodes: Map<number, OsmNode> = new Map()
	for await (const entity of entities) {
		if (Array.isArray(entity)) {
			for (const node of entity) {
				nodes.set(node.id, node)
				if (node.tags && Object.keys(node.tags).length > 0) {
					yield nodeToFeature(node)
				}
			}
		} else if (entity.type === "node") {
			nodes.set(entity.id, entity)
			if (entity.tags && Object.keys(entity.tags).length > 0) {
				yield nodeToFeature(entity)
			}
		} else if (entity.type === "way") {
			yield wayToFeature(entity, nodes)
		}
	}
}

export function entitiesToGeoJSON(osm: {
	nodes: Map<number, OsmNode>
	ways: Map<number, OsmWay>
}) {
	return [...nodesToFeatures(osm.nodes), ...waysToFeatures(osm.ways, osm.nodes)]
}

export function nodesToFeatures(nodes: Map<number, OsmNode>) {
	return Array.from(
		nodes.values().filter((n) => n.tags && Object.keys(n.tags).length > 0),
	).map(nodeToFeature)
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
		properties: {
			info: node.info,
			tags: node.tags,
		},
	}
}

export function waysToFeatures(
	ways: Map<number, OsmWay>,
	nodes: Map<number, OsmNode>,
) {
	return Array.from(ways.values()).map((way) => wayToFeature(way, nodes))
}

export function wayToFeature(
	way: OsmWay,
	nodes: Map<number, OsmNode>,
): GeoJSON.Feature<GeoJSON.LineString | GeoJSON.Polygon, OsmGeoJSONProperties> {
	const getNode = (r: number) => {
		const n = nodes.get(r)
		if (!n) throw new Error(`Node ${r} not found`)
		return [n.lon, n.lat]
	}
	return {
		type: "Feature",
		id: way.id,
		geometry: wayIsArea(way.refs, way.tags)
			? {
					type: "Polygon",
					coordinates: [way.refs.map(getNode)],
				}
			: {
					type: "LineString",
					coordinates: way.refs.map(getNode),
				},
		properties: {
			info: way.info,
			tags: way.tags,
		},
	}
}
