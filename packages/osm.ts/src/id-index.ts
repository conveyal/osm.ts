import {
	BufferConstructor,
	IdArrayType,
	ResizeableTypedArray,
	type TypedArrayBuffer,
} from "./typed-arrays"

export type IdOrIndex = { id: number } | { index: number }

const BLOCK_SIZE = 256

export type IdIndexTransferables = {
	ids: TypedArrayBuffer
	sortedIds: TypedArrayBuffer
	sortedIdPositionToIndex: TypedArrayBuffer
	anchors: TypedArrayBuffer
}

/**
 * Efficiently store and lookup IDs.
 *
 * This is used to store IDs in a sorted array and then use binary search to find the index of an ID.
 * Maps max out at 2^32 IDs.
 */
export class IdIndex {
	private ids = new ResizeableTypedArray(IdArrayType)
	private indexBuilt = false
	private idsAreSorted = true
	private idsSorted: Float64Array = new Float64Array(0)
	private sortedIdPositionToIndex: Uint32Array = new Uint32Array(0)
	private anchors: Float64Array = new Float64Array(0)

	static from({
		ids,
		sortedIds,
		sortedIdPositionToIndex,
		anchors,
	}: IdIndexTransferables) {
		const idIndex = new IdIndex()
		idIndex.ids = ResizeableTypedArray.from(IdArrayType, ids)
		idIndex.idsSorted = new Float64Array(sortedIds)
		idIndex.sortedIdPositionToIndex = new Uint32Array(sortedIdPositionToIndex)
		idIndex.anchors = new Float64Array(anchors)
		idIndex.indexBuilt = true
		return idIndex
	}

	transferables(): IdIndexTransferables {
		return {
			ids: this.ids.array.buffer,
			sortedIds: this.idsSorted.buffer,
			sortedIdPositionToIndex: this.sortedIdPositionToIndex.buffer,
			anchors: this.anchors.buffer,
		}
	}

	get size() {
		return this.ids.length
	}

	get isReady() {
		return this.indexBuilt
	}

	add(id: number): void {
		if (this.indexBuilt) throw Error("ID index already built.")
		if (id < this.ids.at(-1)) this.idsAreSorted = false
		this.ids.push(id)
	}

	at(index: number): number {
		return this.ids.at(index)
	}

	/**
	 * Build the index of IDs to positions.
	 *
	 * If the IDs are not sorted, we need to sort them and build a new index.
	 * If the IDs are sorted, we can use the existing index.
	 */
	finish() {
		if (this.indexBuilt) throw Error("ID index already build.")
		this.ids.compact()
		if (!this.idsAreSorted) {
			console.warn("OSM IDs were not sorted. Sorting now...")
			// Build the sorted index
			this.idsSorted = new Float64Array(this.size)
			this.sortedIdPositionToIndex = new Uint32Array(this.size)

			// Fill and sort with positions.
			for (let i = 0; i < this.size; i++) {
				this.idsSorted[i] = this.ids.at(i)
				this.sortedIdPositionToIndex[i] = i
			}

			// Sort by id, carrying position; use native sort on chunks or a custom radix/merge for stability.
			// For simplicity:
			const tmp = Array.from({ length: this.size }, (_, i) => ({
				id: this.idsSorted[i],
				pos: this.sortedIdPositionToIndex[i],
			}))
			tmp.sort((a, b) => a.id - b.id)
			for (let i = 0; i < this.size; i++) {
				this.idsSorted[i] = tmp[i].id
				this.sortedIdPositionToIndex[i] = tmp[i].pos
			}
		} else {
			// Point to the same array
			this.idsSorted = this.ids.array
		}

		// Build anchors (every blockSize-th key)
		const aLen = Math.ceil(this.size / BLOCK_SIZE)
		const sab = new BufferConstructor(aLen * Float64Array.BYTES_PER_ELEMENT)
		this.anchors = new Float64Array(sab, 0, aLen)
		for (let j = 0; j < aLen; j++) {
			this.anchors[j] = this.idsSorted[Math.min(j * BLOCK_SIZE, this.size - 1)]
		}

		this.indexBuilt = true
	}

	// Lookup id → index
	getIndexFromId(id: number): number {
		if (!this.indexBuilt) throw Error("IdIndex not built.")

		// binary search anchors
		let lo = 0
		let hi = this.anchors.length - 1
		while (lo < hi) {
			const mid = (lo + hi + 1) >>> 1
			if (this.anchors[mid] <= id) lo = mid
			else hi = mid - 1
		}
		const start = lo * BLOCK_SIZE
		const end = Math.min(start + BLOCK_SIZE, this.idsSorted.length)

		// binary search within block
		let l = start
		let r = end - 1
		while (l <= r) {
			const m = (l + r) >>> 1
			const v = this.idsSorted[m]
			if (v === id) {
				if (this.idsAreSorted) {
					return m
				}
				return this.sortedIdPositionToIndex[m]
			}
			if (v < id) l = m + 1
			else r = m - 1
		}

		// ID not found
		return -1
	}

	/**
	 * Pass an ID or an index, get both.
	 */
	idOrIndex(i: IdOrIndex): [index: number, id: number] {
		if ("id" in i) return [this.getIndexFromId(i.id), i.id]
		return [i.index, this.at(i.index)]
	}
}
