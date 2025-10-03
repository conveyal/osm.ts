/**
 * Use SharedArrayBuffer if the runtime supports it, otherwise fall back to ArrayBuffer.
 */
export const BufferConstructor =
	typeof SharedArrayBuffer !== "undefined"
		? (SharedArrayBuffer as SharedArrayBufferConstructor)
		: (ArrayBuffer as ArrayBufferConstructor)
export type BufferType = InstanceType<typeof BufferConstructor>

export type TypedArray<B extends BufferType = BufferType> =
	| Int8Array<B>
	| Uint8Array<B>
	| Uint8ClampedArray<B>
	| Int16Array<B>
	| Uint16Array<B>
	| Int32Array<B>
	| Uint32Array<B>
	| Float32Array<B>
	| Float64Array<B>

export interface TypedArrayConstructor<
	T extends TypedArray<BufferType> = TypedArray<BufferType>,
> {
	new (buffer: BufferType): T
	readonly BYTES_PER_ELEMENT: number
}

/**
 * OSM IDs can be stored as 64-bit floating point numbers.
 */
export const IdArrayType = Float64Array

/**
 * When we are storing coordinates, we need to be able to store 64-bit floating point numbers.
 * However, for benchmarking it is handy to test 32-bit floating point numbers.
 */
export const CoordinateArrayType = Float64Array

/**
 * When we are storing indexes into other arrays, we never need an index to exceed 2^32.
 */
export const IndexArrayType = Uint32Array

/**
 * Default buffer size.
 */
export const DEFAULT_BUFFER_SIZE = 2 ** 20 // 1 MiB

export class ResizeableTypedArray<TA extends TypedArray>
	implements RelativeIndexable<number>
{
	ArrayType: TypedArrayConstructor<TA>
	array: TA
	items = 0

	private buffer: BufferType
	bufferSize: number
	maxByteLength: number

	static from<TA extends TypedArray>(
		ArrayType: TypedArrayConstructor<TA>,
		buffer: BufferType,
	) {
		const rta = new ResizeableTypedArray<TA>(ArrayType)
		rta.buffer = buffer
		rta.array = new ArrayType(buffer)
		rta.items = length
		return rta
	}

	constructor(ArrayType: TypedArrayConstructor<TA>) {
		this.ArrayType = ArrayType
		this.bufferSize = DEFAULT_BUFFER_SIZE
		this.maxByteLength = DEFAULT_BUFFER_SIZE * 2
		this.buffer = new BufferConstructor(this.bufferSize, {
			maxByteLength: this.maxByteLength,
		})
		this.array = new this.ArrayType(this.buffer)
	}

	private expandArray() {
		this.bufferSize *= 2
		if (this.bufferSize > this.buffer.maxByteLength) {
			this.maxByteLength *= 2
			const newBuffer = new BufferConstructor(this.bufferSize, {
				maxByteLength: this.maxByteLength,
			})
			const newArray = new this.ArrayType(newBuffer)
			newArray.set(this.array)
			this.buffer = newBuffer
			this.array = newArray
		} else {
			if (this.buffer instanceof SharedArrayBuffer && this.buffer.growable) {
				this.buffer.grow(this.bufferSize)
			} else if (this.buffer instanceof ArrayBuffer && this.buffer.resizable) {
				this.buffer.resize(this.bufferSize)
			} else {
				throw Error("Buffer is not growable or resizable")
			}
		}
	}

	/**
	 * Handle negative numbers
	 */
	at(index: number): number {
		if (index < 0) {
			const newIndex = this.length + index
			if (newIndex < 0) throw Error(`Index out of bounds: ${index}`)
			return this.at(newIndex)
		}
		const result = this.array.at(index)
		if (result === undefined || index >= this.length)
			throw Error(`Index out of bounds: ${index}`)
		return result
	}

	slice(start: number, end: number) {
		return this.array.slice(start, end)
	}

	get length() {
		return this.items
	}

	push(value: number): number {
		if (this.length >= this.array.length) {
			this.expandArray()
		}
		this.array[this.items++] = value
		return this.length - 1
	}

	pushMany(values: number[] | TypedArray) {
		while (this.length + values.length > this.array.length) this.expandArray()
		this.array.set(values, this.length)
		this.items += values.length
	}

	compact() {
		if (this.buffer instanceof SharedArrayBuffer) {
			this.buffer = this.buffer.slice(
				0,
				this.length * this.ArrayType.BYTES_PER_ELEMENT,
			)
		} else {
			this.buffer = this.buffer.transferToFixedLength(
				this.length * this.ArrayType.BYTES_PER_ELEMENT,
			)
		}
		this.array = new this.ArrayType(this.buffer)
		return this.array
	}
}
