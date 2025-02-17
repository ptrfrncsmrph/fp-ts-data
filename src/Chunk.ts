/**
 * @since 1.0.0
 */

import type { TypeLambda } from "@fp-ts/core/HKT"
import type { Order } from "@fp-ts/core/typeclass/Order"
import type { Either } from "@fp-ts/data/Either"
import * as Equal from "@fp-ts/data/Equal"
import { identity, pipe } from "@fp-ts/data/Function"
import * as MRef from "@fp-ts/data/MutableRef"
import type { NonEmptyIterable } from "@fp-ts/data/NonEmpty"
import type { Option } from "@fp-ts/data/Option"
import * as O from "@fp-ts/data/Option"
import type { Predicate, Refinement } from "@fp-ts/data/Predicate"
import * as RA from "@fp-ts/data/ReadonlyArray"

const TypeId: unique symbol = Symbol.for("@fp-ts/data/Chunk") as TypeId

/**
 * @since 1.0.0
 * @category symbol
 */
export type TypeId = typeof TypeId

/**
 * @category model
 * @since 1.0.0
 */
export interface NonEmptyChunk<A> extends Chunk<A>, NonEmptyIterable<A> {}

/**
 * @since 1.0.0
 * @category models
 */
export interface Chunk<A> extends Iterable<A>, Equal.Equal {
  readonly _id: TypeId

  readonly length: number

  /** @internal */
  right: Chunk<A>
  /** @internal */
  left: Chunk<A>
  /** @internal */
  backing: Backing<A>
  /** @internal */
  depth: number

  /**
   * @since 1.0.0
   */
  toReadonlyArray(this: Chunk<A>): ReadonlyArray<A>

  /**
   * @since 1.0.0
   */
  isNonEmpty(this: Chunk<A>): this is NonEmptyChunk<A>

  /**
   * @since 1.0.0
   */
  isEmpty(this: Chunk<A>): boolean

  /**
   * @since 1.0.0
   */
  map<B>(this: Chunk<A>, f: (a: A) => B): Chunk<B>

  /**
   * @since 1.0.0
   */
  flatMap<B>(this: Chunk<A>, f: (a: A) => Chunk<B>): Chunk<B>

  /**
   * @since 1.0.0
   */
  forEach(this: Chunk<A>, f: (a: A) => void): void

  /**
   * @since 1.0.0
   */
  append<B>(this: Chunk<A>, b: B): Chunk<A | B>

  /**
   * @since 1.0.0
   */
  prepend<B>(this: Chunk<A>, b: B): Chunk<A | B>

  /**
   * @since 1.0.0
   */
  concat<B>(this: Chunk<A>, that: Chunk<B>): Chunk<A | B>

  /**
   * @since 1.0.0
   */
  pipe<B>(this: Chunk<A>, f: (self: Chunk<A>) => B): B

  /**
   * @since 1.0.0
   */
  get(this: Chunk<A>, index: number): Option<A>

  /**
   * @since 1.0.0
   */
  unsafeGet(this: Chunk<A>, index: number): A
}

/**
 * @since 1.0.0
 * @category type lambdas
 */
export interface ChunkTypeLambda extends TypeLambda {
  readonly type: Chunk<this["Target"]>
}

/** @internal */
type Backing<A> =
  | IArray<A>
  | IConcat<A>
  | IAppend<A>
  | ISlice<A>
  | IPrepend<A>
  | ISingleton<A>
  | IEmpty

/** @internal */
interface IArray<A> {
  readonly _tag: "IArray"
  readonly array: ReadonlyArray<A>
}

/** @internal */
interface IConcat<A> {
  readonly _tag: "IConcat"
  readonly left: Chunk<A>
  readonly right: Chunk<A>
}

/** @internal */
interface ISingleton<A> {
  readonly _tag: "ISingleton"
  readonly a: A
}

/** @internal */
interface IAppend<A> {
  readonly _tag: "IAppend"
  readonly start: Chunk<A>
  readonly buffer: Array<unknown>
  readonly bufferUsed: number
  readonly chain: MRef.MutableRef<number>
}

/** @internal */
interface IPrepend<A> {
  readonly _tag: "IPrepend"
  readonly end: Chunk<A>
  readonly buffer: Array<unknown>
  readonly bufferUsed: number
  readonly chain: MRef.MutableRef<number>
}

/** @internal */
interface ISlice<A> {
  readonly _tag: "ISlice"
  readonly chunk: Chunk<A>
  readonly offset: number
  readonly length: number
}

/** @internal */
interface IEmpty {
  readonly _tag: "IEmpty"
}

/** @internal */
const emptyArray: ReadonlyArray<never> = []

/** @internal */
function copy<A>(
  src: ReadonlyArray<A>,
  srcPos: number,
  dest: Array<A>,
  destPos: number,
  len: number
) {
  for (let i = srcPos; i < Math.min(src.length, srcPos + len); i++) {
    dest[destPos + i - srcPos] = src[i]!
  }
  return dest
}

/** @internal */
const BufferSize = 64

/** @internal */
class ChunkImpl<A> implements Chunk<A> {
  readonly _id: typeof TypeId = TypeId

  readonly length: number
  readonly depth: number
  readonly left: Chunk<A>
  readonly right: Chunk<A>

  constructor(readonly backing: Backing<A>) {
    switch (backing._tag) {
      case "IEmpty": {
        this.length = 0
        this.depth = 0
        this.left = this
        this.right = this
        break
      }
      case "IConcat": {
        this.length = backing.left.length + backing.right.length
        this.depth = 1 + Math.max(backing.left.depth, backing.right.depth)
        this.left = backing.left
        this.right = backing.right
        break
      }
      case "IArray": {
        this.length = backing.array.length
        this.depth = 0
        this.left = _empty
        this.right = _empty
        break
      }
      case "IAppend": {
        this.length = this.length = backing.start.length + backing.bufferUsed
        this.depth = 0
        this.left = _empty
        this.right = _empty
        break
      }
      case "IPrepend": {
        this.length = this.length = backing.end.length + backing.bufferUsed
        this.depth = 0
        this.left = _empty
        this.right = _empty
        break
      }
      case "ISingleton": {
        this.length = 1
        this.depth = 0
        this.left = _empty
        this.right = _empty
        break
      }
      case "ISlice": {
        this.length = backing.length
        this.depth = 0
        this.left = _empty
        this.right = _empty
        break
      }
    }
  }

  toReadonlyArray(this: Chunk<A>): ReadonlyArray<A> {
    switch (this.backing._tag) {
      case "IEmpty": {
        return emptyArray
      }
      case "IArray": {
        return this.backing.array
      }
      default: {
        const arr = new Array<A>(this.length)
        copyToArray(this, arr, 0)
        this.backing = {
          _tag: "IArray",
          array: arr
        }
        this.left = _empty
        this.right = _empty
        this.depth = 0
        return arr
      }
    }
  }

  isNonEmpty(this: Chunk<A>): this is NonEmptyChunk<A> {
    return this.length > 0
  }

  isEmpty(this: Chunk<A>): boolean {
    return !this.isNonEmpty()
  }

  map<B>(this: Chunk<A>, f: (a: A) => B): Chunk<B> {
    return this.backing._tag === "ISingleton" ?
      singleton(f(this.backing.a)) :
      unsafeFromArray(RA.map(f)(toReadonlyArray(this)))
  }

  flatMap<B>(this: Chunk<A>, f: (a: A) => Chunk<B>): Chunk<B> {
    if (this.backing._tag === "ISingleton") {
      return f(this.backing.a)
    }
    let r: Chunk<B> = _empty
    for (const k of this) {
      r = concat(f(k))(r)
    }
    return r
  }

  forEach(this: Chunk<A>, f: (a: A) => void): void {
    return this.backing._tag === "ISingleton" ?
      f(this.backing.a) :
      toReadonlyArray(this).forEach(f)
  }

  append<B>(this: Chunk<A>, b: B): Chunk<A | B> {
    switch (this.backing._tag) {
      case "IAppend": {
        if (
          this.backing.bufferUsed < this.backing.buffer.length &&
          MRef.compareAndSet(this.backing.bufferUsed, this.backing.bufferUsed + 1)(
            this.backing.chain
          )
        ) {
          this.backing.buffer[this.backing.bufferUsed] = b
          return new ChunkImpl({
            _tag: "IAppend",
            start: this.backing.start,
            buffer: this.backing.buffer,
            bufferUsed: this.backing.bufferUsed + 1,
            chain: this.backing.chain
          })
        } else {
          const buffer = new Array(BufferSize)
          buffer[0] = b
          const newArr: Array<A | B> = new Array(this.backing.bufferUsed)
          for (let i = 0; i < this.backing.bufferUsed; i++) {
            newArr[i] = this.backing.buffer[i] as A | B
          }
          const chunk = unsafeFromArray(newArr)
          return new ChunkImpl({
            _tag: "IAppend",
            start: concat(chunk)(this.backing.start),
            buffer,
            bufferUsed: 1,
            chain: MRef.make(1)
          })
        }
      }
      default: {
        const buffer = new Array(BufferSize)
        buffer[0] = b
        return new ChunkImpl({
          _tag: "IAppend",
          buffer,
          start: this,
          bufferUsed: 1,
          chain: MRef.make(1)
        })
      }
    }
  }

  prepend<B>(this: Chunk<A>, b: B): Chunk<A | B> {
    switch (this.backing._tag) {
      case "IPrepend": {
        if (
          this.backing.bufferUsed < this.backing.buffer.length &&
          MRef.compareAndSet(this.backing.bufferUsed, this.backing.bufferUsed + 1)(
            this.backing.chain
          )
        ) {
          this.backing.buffer[BufferSize - this.backing.bufferUsed - 1] = b
          return new ChunkImpl({
            _tag: "IPrepend",
            end: this.backing.end,
            buffer: this.backing.buffer,
            bufferUsed: this.backing.bufferUsed + 1,
            chain: this.backing.chain
          })
        } else {
          const buffer = new Array(BufferSize)
          buffer[BufferSize - 1] = b
          const newArr: Array<A | B> = new Array(this.backing.bufferUsed)
          for (let i = 0; i < this.backing.bufferUsed; i++) {
            newArr[i] = this.backing
              .buffer[(this.backing.buffer.length - this.backing.bufferUsed) + i] as A | B
          }
          const chunk = unsafeFromArray(newArr)
          return new ChunkImpl({
            _tag: "IPrepend",
            end: chunk.concat(this.backing.end),
            buffer,
            bufferUsed: 1,
            chain: MRef.make(1)
          })
        }
      }
      default: {
        const buffer = new Array(BufferSize)
        buffer[BufferSize - 1] = b
        return new ChunkImpl({
          _tag: "IPrepend",
          buffer,
          end: this,
          bufferUsed: 1,
          chain: MRef.make(1)
        })
      }
    }
  }

  concat<B>(this: Chunk<A>, that: Chunk<B>): Chunk<A | B> {
    if (this.backing._tag === "IEmpty") {
      return that
    }
    if (that.backing._tag === "IEmpty") {
      return this
    }
    if (this.backing._tag === "IAppend") {
      const chunk = take(this.backing.bufferUsed)(unsafeFromArray(this.backing.buffer as Array<A>))
      return pipe(this.backing.start, concat(chunk), concat(that))
    }
    if (that.backing._tag === "IPrepend") {
      const chunk = unsafeFromArray(
        that.backing.bufferUsed === 0 ?
          [] :
          (that.backing.buffer as Array<B>).slice(-that.backing.bufferUsed)
      )
      return pipe(this, concat(chunk), concat(that.backing.end))
    }
    const diff = that.depth - this.depth
    if (Math.abs(diff) <= 1) {
      return new ChunkImpl<A | B>({ _tag: "IConcat", left: this, right: that })
    } else if (diff < -1) {
      if (this.left.depth >= this.right.depth) {
        const nr = concat(that)(this.right)
        return new ChunkImpl({ _tag: "IConcat", left: this.left, right: nr })
      } else {
        const nrr = concat(that)(this.right.right)
        if (nrr.depth === this.depth - 3) {
          const nr = new ChunkImpl({ _tag: "IConcat", left: this.right.left, right: nrr })
          return new ChunkImpl({ _tag: "IConcat", left: this.left, right: nr })
        } else {
          const nl = new ChunkImpl({ _tag: "IConcat", left: this.left, right: this.right.left })
          return new ChunkImpl({ _tag: "IConcat", left: nl, right: nrr })
        }
      }
    } else {
      if (this.right.depth >= that.left.depth) {
        const nl = concat(that.left)(this)
        return new ChunkImpl({ _tag: "IConcat", left: nl, right: that.right })
      } else {
        const nll = concat(that.left.left)(this)
        if (nll.depth === that.depth - 3) {
          const nl = new ChunkImpl({ _tag: "IConcat", left: nll, right: that.left.right })
          return new ChunkImpl({ _tag: "IConcat", left: nl, right: that.right })
        } else {
          const nr = new ChunkImpl({ _tag: "IConcat", left: that.left.right, right: that.right })
          return new ChunkImpl({ _tag: "IConcat", left: nll, right: nr })
        }
      }
    }
  }

  get(this: Chunk<A>, index: number): Option<A> {
    return index < 0 || index >= this.length ? O.none : O.some(this.unsafeGet(index))
  }

  unsafeGet(this: Chunk<A>, index: number): A {
    switch (this.backing._tag) {
      case "IEmpty": {
        throw new Error(`Index out of bounds`)
      }
      case "ISlice": {
        return this.backing.chunk.unsafeGet(index + this.backing.offset)
      }
      case "IAppend": {
        if (index < 0 || index >= this.length) {
          throw new Error(`Index out of bounds`)
        } else if (index < this.backing.start.length) {
          return this.backing.start.unsafeGet(index)
        } else {
          return (this.backing.buffer as Array<A>)[index - this.backing.start.length]!
        }
      }
      case "IPrepend": {
        if (index < 0 || index >= this.length) {
          throw new Error(`Index out of bounds`)
        } else if (index < this.backing.bufferUsed) {
          return (this.backing.buffer as Array<A>)[BufferSize - this.backing.bufferUsed + index]!
        } else {
          return this.backing.end.unsafeGet(index - this.backing.bufferUsed)
        }
      }
      case "ISingleton": {
        if (index !== 0) {
          throw new Error(`Index out of bounds`)
        }
        return this.backing.a
      }
      case "IArray": {
        if (index >= this.length || index < 0) {
          throw new Error(`Index out of bounds`)
        }
        return this.backing.array[index]!
      }
      case "IConcat": {
        return index < this.left.length
          ? this.left.unsafeGet(index)
          : this.right.unsafeGet(index - this.left.length)
      }
    }
  }

  pipe<B>(this: Chunk<A>, f: (self: Chunk<A>) => B): B {
    return f(this)
  }

  [Equal.symbolEqual](that: unknown): boolean {
    return isChunk(that) && Equal.equals(toReadonlyArray(this), toReadonlyArray(that))
  }

  [Equal.symbolHash](): number {
    return Equal.hash(toReadonlyArray(this))
  }

  [Symbol.iterator](): Iterator<A> {
    switch (this.backing._tag) {
      case "IArray": {
        return this.backing.array[Symbol.iterator]()
      }
      case "IEmpty": {
        return emptyArray[Symbol.iterator]()
      }
      default: {
        return toReadonlyArray(this)[Symbol.iterator]()
      }
    }
  }
}

/** @internal */
const copyToArray = <A>(self: Chunk<A>, array: Array<any>, n: number) => {
  switch (self.backing._tag) {
    case "IArray": {
      copy(self.backing.array, 0, array, n, self.length)
      break
    }
    case "IConcat": {
      copyToArray(self.left, array, n)
      copyToArray(self.right, array, n + self.left.length)
      break
    }
    case "IAppend": {
      copyToArray(self.backing.start, array, n)
      copy(
        self.backing.buffer as Array<A>,
        0,
        array,
        self.backing.start.length + n,
        self.backing.bufferUsed
      )
      break
    }
    case "IPrepend": {
      const length = Math.min(self.backing.bufferUsed, Math.max(array.length - n, 0))
      copy(self.backing.buffer, BufferSize - self.backing.bufferUsed, array, n, length)
      copyToArray(self.backing.end, array, n + length)
      break
    }
    case "ISingleton": {
      array[n] = self.backing.a
      break
    }
    case "ISlice": {
      let i = 0
      let j = n
      while (i < self.length) {
        array[j] = unsafeGet(i)(self)
        i += 1
        j += 1
      }
      break
    }
  }
}

/**
 * Checks if `u` is a `Chunk<unknown>`
 *
 * @since 1.0.0
 * @category constructors
 */
export const isChunk: {
  <A>(u: Iterable<A>): u is Chunk<A>
  (u: unknown): u is Chunk<unknown>
} = (u: unknown): u is Chunk<unknown> =>
  typeof u === "object" && u != null && "_id" in u && u["_id"] === TypeId

const _empty = new ChunkImpl<never>({ _tag: "IEmpty" })

/**
 * @since 1.0.0
 * @category constructors
 */
export const empty: <A = never>() => Chunk<A> = () => _empty

/**
 * Converts from an `Iterable<A>`
 *
 * @since 1.0.0
 * @category conversions
 */
export const fromIterable = <A>(self: Iterable<A>): Chunk<A> =>
  isChunk(self) ?
    self :
    new ChunkImpl({
      _tag: "IArray",
      array: Array.from(self)
    })

/**
 * Converts to a `ReadonlyArray<A>`
 *
 * @since 1.0.0
 * @category conversions
 */
export const toReadonlyArray = <A>(self: Chunk<A>): ReadonlyArray<A> => self.toReadonlyArray()

/**
 * This function provides a safe way to read a value at a particular index from a `Chunk`.
 *
 * @since 1.0.0
 * @category elements
 */
export const get = (index: number) => <A>(self: Chunk<A>): Option<A> => self.get(index)

/**
 * Wraps an array into a chunk without copying, unsafe on mutable arrays
 *
 * @since 1.0.0
 * @category unsafe
 */
export const unsafeFromArray = <A>(self: ReadonlyArray<A>): Chunk<A> =>
  new ChunkImpl({
    _tag: "IArray",
    array: self
  })

/**
 * Gets an element unsafely, will throw on out of bounds
 *
 * @since 1.0.0
 * @category unsafe
 */
export const unsafeGet = (index: number) => <A>(self: Chunk<A>): A => self.unsafeGet(index)

/**
 * Appends the value to the chunk
 *
 * @since 1.0.0
 * @category mutations
 */
export const append = <A1>(a: A1) => <A>(self: Chunk<A>): Chunk<A | A1> => self.append(a)

/**
 * Prepends the value to the chunk
 *
 * @since 1.0.0
 * @category mutations
 */
export const prepend = <B>(elem: B) => <A>(self: Chunk<A>): Chunk<A | B> => self.prepend(elem)

/**
 * Takes the first up to `n` elements from the chunk
 *
 * @since 1.0.0
 * @category mutations
 */
export const take = (n: number) =>
  <A>(self: Chunk<A>): Chunk<A> => {
    if (n <= 0) {
      return _empty
    } else if (n >= self.length) {
      return self
    } else {
      switch (self.backing._tag) {
        case "ISlice": {
          return new ChunkImpl({
            _tag: "ISlice",
            chunk: self,
            length: n,
            offset: self.backing.offset
          })
        }
        default: {
          return new ChunkImpl({
            _tag: "ISlice",
            chunk: self,
            offset: 0,
            length: n
          })
        }
      }
    }
  }

/**
 * Drops the first up to `n` elements from the chunk
 *
 * @since 1.0.0
 * @category mutations
 */
export const drop = (n: number) =>
  <A>(self: Chunk<A>): Chunk<A> => {
    if (n <= 0) {
      return self
    } else if (n >= self.length) {
      return _empty
    } else {
      const len = self.length
      switch (self.backing._tag) {
        case "ISlice": {
          return new ChunkImpl({
            _tag: "ISlice",
            chunk: self.backing.chunk,
            length: self.backing.length - n,
            offset: self.backing.offset + n
          })
        }
        default: {
          return new ChunkImpl({
            _tag: "ISlice",
            chunk: self,
            offset: n,
            length: len - n
          })
        }
      }
    }
  }

/**
 * Drops the last `n` elements.
 *
 * @since 1.0.0
 * @category mutations
 */
export const dropRight = (n: number) =>
  <A>(self: Chunk<A>): Chunk<A> => pipe(self, take(Math.max(0, self.length - n)))

/**
 * Drops all elements so long as the predicate returns true.
 *
 * @since 1.0.0
 * @category mutations
 */
export const dropWhile = <A>(f: (a: A) => boolean) => {
  return (self: Chunk<A>): Chunk<A> => {
    const arr = toReadonlyArray(self)
    const len = arr.length
    let i = 0
    while (i < len && f(arr[i]!)) {
      i++
    }
    return pipe(self, drop(i))
  }
}

/**
 * @category mutations
 * @since 1.0.0
 */
export function prependAllNonEmpty<B>(
  that: NonEmptyChunk<B>
): <A>(self: Chunk<A>) => NonEmptyChunk<A | B>
export function prependAllNonEmpty<B>(
  that: Chunk<B>
): <A>(self: NonEmptyChunk<A>) => NonEmptyChunk<A | B>
export function prependAllNonEmpty<B>(
  that: Chunk<B>
): <A>(self: NonEmptyChunk<A>) => Chunk<A | B> {
  return (self) => concat(self)(that)
}

/**
 * Concatenates the two chunks
 *
 * @since 1.0.0
 * @category mutations
 */
export const concat = <B>(that: Chunk<B>) => <A>(self: Chunk<A>): Chunk<A | B> => self.concat(that)

/**
 * Compares the two chunks of equal length using the specified function
 *
 * @since 1.0.0
 * @category elements
 */
export const correspondsTo = <A, B>(that: Chunk<B>, f: (a: A, b: B) => boolean) =>
  (self: Chunk<A>): boolean => {
    if (self.length !== that.length) {
      return false
    }
    const selfArray = toReadonlyArray(self)
    const thatArray = toReadonlyArray(that)
    return selfArray.every((v, i) => f(v, thatArray[i]))
  }

/**
 * Returns a filtered and mapped subset of the elements.
 *
 * @since 1.0.0
 * @category filtering
 */
export const filterMap = <A, B>(f: (a: A) => Option<B>) =>
  (self: Iterable<A>): Chunk<B> => unsafeFromArray(RA.filterMap(f)(self))

/**
 * Returns a filtered and mapped subset of the elements.
 *
 * @since 1.0.0
 * @category filtering
 */
export const filter: {
  <C extends A, B extends A, A = C>(
    refinement: Refinement<A, B>
  ): (self: Chunk<C>) => Chunk<B>
  <B extends A, A = B>(predicate: Predicate<A>): (self: Chunk<B>) => Chunk<B>
} = <A>(f: Predicate<A>) =>
  (self: Chunk<A>) => unsafeFromArray(RA.filterMap(O.liftPredicate(f))(self))

/**
 * Returns a filtered and mapped subset of the elements.
 *
 * @since 1.0.0
 * @category filtering
 */
export const filterMapWithIndex = <A, B>(f: (a: A, i: number) => Option<B>) =>
  (self: Iterable<A>): Chunk<B> => unsafeFromArray(RA.filterMapWithIndex(f)(self))

/**
 * Transforms all elements of the chunk for as long as the specified function returns some value
 *
 * @since 1.0.0
 * @category filtering
 */
export const filterMapWhile = <A, B>(f: (a: A) => Option<B>) =>
  (self: Iterable<A>): Chunk<B> => {
    const res: Array<B> = []
    for (const a of self) {
      const b = f(a)
      if (O.isSome(b)) {
        res.push(b.value)
      } else {
        break
      }
    }
    return unsafeFromArray(res)
  }

/**
 * Tests whether a value is a member of a `Chunk<A>`.
 *
 * @since 1.0.0
 * @category elements
 */
export const elem = <B>(b: B) =>
  <A>(self: Chunk<A>): boolean => pipe(toReadonlyArray(self), RA.elem(b))

/**
 * Filter out optional values
 *
 * @since 1.0.0
 * @category filtering
 */
export const compact = <A>(self: Iterable<Option<A>>): Chunk<A> => pipe(self, filterMap(identity))

/**
 * Deduplicates adjacent elements that are identical.
 *
 * @since 1.0.0
 * @category filtering
 */
export const dedupeAdjacent = <A>(self: Chunk<A>): Chunk<A> => {
  const builder: Array<A> = []
  let lastA: O.Option<A> = O.none

  for (const a of self) {
    if (O.isNone(lastA) || !Equal.equals(a, lastA.value)) {
      builder.push(a)
      lastA = O.some(a)
    }
  }

  return unsafeFromArray(builder)
}

/**
 * Check if a predicate holds true for any `Chunk` member.
 *
 * @since 1.0.0
 * @category elements
 */
export const some = <A>(f: (a: A) => boolean) =>
  (self: Chunk<A>): boolean => toReadonlyArray(self).findIndex((v) => f(v)) !== -1

/**
 * Check if a predicate holds true for every `Chunk` member.
 *
 * @since 1.0.0
 * @category elements
 */
export const every = <A>(f: (a: A) => boolean) =>
  (self: Chunk<A>): boolean => toReadonlyArray(self).every((v) => f(v))

/**
 * Find the first element which satisfies a predicate (or a refinement) function.
 *
 * @since 1.0.0
 * @category elements
 */
export function findFirst<A, B extends A>(
  refinement: Refinement<A, B>
): (self: Chunk<A>) => Option<B>
export function findFirst<A>(predicate: Predicate<A>): (self: Chunk<A>) => Option<A>
export function findFirst<A>(predicate: Predicate<A>) {
  return (self: Chunk<A>): Option<A> => RA.findFirst(predicate)(toReadonlyArray(self))
}

/**
 * Find the first index for which a predicate holds
 *
 * @since 1.0.0
 * @category elements
 */
export const findFirstIndex = <A>(f: Predicate<A>) =>
  (self: Chunk<A>): Option<number> => RA.findFirstIndex(f)(toReadonlyArray(self))

/**
 * Find the first index for which a predicate holds
 *
 * @since 1.0.0
 * @category elements
 */
export const findLastIndex = <A>(f: Predicate<A>) =>
  (self: Chunk<A>): Option<number> => RA.findLastIndex(f)(toReadonlyArray(self))

/**
 * Find the last element which satisfies a predicate function
 *
 * @since 1.0.0
 * @category elements
 */
export function findLast<A, B extends A>(f: Refinement<A, B>): (self: Chunk<A>) => Option<B>
export function findLast<A>(f: Predicate<A>): (self: Chunk<A>) => Option<A>
export function findLast<A>(f: Predicate<A>) {
  return (self: Chunk<A>): Option<A> => RA.findLast(f)(toReadonlyArray(self))
}

/**
 * Returns a chunk with the elements mapped by the specified function.
 *
 * @since 1.0.0
 * @category sequencing
 */
export const flatMap = <A, B>(f: (a: A) => Chunk<B>) =>
  (self: Chunk<A>): Chunk<B> => {
    if (self.backing._tag === "ISingleton") {
      return f(self.backing.a)
    }
    let r: Chunk<B> = _empty
    for (const k of self) {
      r = concat(f(k))(r)
    }
    return r
  }

/**
 * Flattens a chunk of chunks into a single chunk by concatenating all chunks.
 *
 * @since 1.0.0
 * @category sequencing
 */
export const flatten: <A>(self: Chunk<Chunk<A>>) => Chunk<A> = flatMap(identity)

/**
 * Iterate over the chunk applying `f`.
 *
 * @since 1.0.0
 * @category elements
 */
export const forEach = <A>(f: (a: A) => void) => (self: Chunk<A>): void => self.forEach(f)

/**
 * Groups elements in chunks of up to `n` elements.
 *
 * @since 1.0.0
 * @category elements
 */
export const chunksOf = (n: number) =>
  <A>(self: Chunk<A>): Chunk<Chunk<A>> => {
    const gr: Array<Chunk<A>> = []
    let current: Array<A> = []

    toReadonlyArray(self).forEach((a) => {
      current.push(a)
      if (current.length >= n) {
        gr.push(unsafeFromArray(current))
        current = []
      }
    })

    if (current.length > 0) {
      gr.push(unsafeFromArray(current))
    }

    return unsafeFromArray(gr)
  }

/**
 * Returns the first element of this chunk if it exists.
 *
 * @since 1.0.0
 * @category elements
 */
export const head: <A>(self: Chunk<A>) => Option<A> = get(0)

/**
 * Creates a Chunk of unique values that are included in all given Chunks.
 *
 * The order and references of result values are determined by the Chunk.
 *
 * @since 1.0.0
 * @category elements
 */
export const intersection = <A>(that: Chunk<A>) =>
  <B>(self: Chunk<B>): Chunk<A & B> =>
    pipe(
      toReadonlyArray(self),
      RA.intersection(toReadonlyArray(that)),
      unsafeFromArray
    )

/**
 * Determines if the chunk is empty.
 *
 * @since 1.0.0
 * @category elements
 */
export const isEmpty = <A>(self: Chunk<A>): boolean => self.isEmpty()

/**
 * Determines if the chunk is not empty.
 *
 * @since 1.0.0
 * @category elements
 */
export const isNonEmpty = <A>(self: Chunk<A>): self is NonEmptyChunk<A> => self.isNonEmpty()

/**
 * Folds over the elements in this chunk from the left.
 *
 * @since 1.0.0
 * @category folding
 */
export const reduce = <A, B>(b: B, f: (s: B, a: A) => B) =>
  (self: Chunk<A>): B => pipe(toReadonlyArray(self), RA.reduce(b, f))

/**
 * Folds over the elements in this chunk from the left.
 *
 * @since 1.0.0
 * @category folding
 */
export const reduceWithIndex = <B, A>(b: B, f: (b: B, a: A, i: number) => B) =>
  (self: Chunk<A>): B => pipe(toReadonlyArray(self), RA.reduceWithIndex(b, f))

/**
 * Folds over the elements in this chunk from the right.
 *
 * @since 1.0.0
 * @category folding
 */
export const reduceRight = <A, S>(s: S, f: (s: S, a: A) => S) =>
  (self: Chunk<A>): S => pipe(toReadonlyArray(self), RA.reduceRight(s, (s, a) => f(s, a)))

/**
 * Folds over the elements in this chunk from the right.
 *
 * @since 1.0.0
 * @category folding
 */
export const reduceRightWithIndex = <B, A>(b: B, f: (b: B, a: A, i: number) => B) =>
  (self: Chunk<A>): B => pipe(toReadonlyArray(self), RA.reduceRightWithIndex(b, f))

/**
 * Joins the elements together with "sep" in the middle.
 *
 * @since 1.0.0
 * @category folding
 */
export const join = (sep: string) =>
  (self: Chunk<string>): string =>
    pipe(self, reduce("", (s, a) => (s.length > 0 ? `${s}${sep}${a}` : a)))

/**
 * Returns the last element of this chunk if it exists.
 *
 * @since 1.0.0
 * @category elements
 */
export const last = <A>(self: Chunk<A>): Option<A> => get(self.length - 1)(self)

/**
 * Builds a `NonEmptyChunk` from an non-empty collection of elements.
 *
 * @since 1.0.0
 * @category constructors
 */
export const make = <As extends readonly [any, ...ReadonlyArray<any>]>(
  ...as: As
): NonEmptyChunk<As[number]> => unsafeFromArray(as) as any

/**
 * Builds a `NonEmptyChunk` from a single element.
 *
 * @since 1.0.0
 * @category constructors
 */
export const singleton = <A>(a: A): NonEmptyChunk<A> =>
  new ChunkImpl({ _tag: "ISingleton", a }) as any

/**
 * Return a Chunk of length n with element i initialized with f(i).
 *
 * **Note**. `n` is normalized to an integer >= 1.
 *
 * @since 1.0.0
 * @category constructors
 */
export const makeBy = <A>(f: (i: number) => A) =>
  (n: number): NonEmptyChunk<A> => make(...RA.makeBy(f)(n))

/**
 * Returns an effect whose success is mapped by the specified f function.
 *
 * @since 1.0.0
 * @category mapping
 */
export const map = <A, B>(f: (a: A) => B) => (self: Chunk<A>): Chunk<B> => self.map(f)

/**
 * Returns an effect whose success is mapped by the specified f function.
 *
 * @since 1.0.0
 * @category mapping
 */
export const mapWithIndex = <A, B>(f: (a: A, i: number) => B) =>
  (self: Chunk<A>): Chunk<B> =>
    self.backing._tag === "ISingleton" ?
      singleton(f(self.backing.a, 0)) :
      unsafeFromArray(pipe(toReadonlyArray(self), RA.mapWithIndex(f)))

/**
 * Statefully maps over the chunk, producing new elements of type `B`.
 *
 * @since 1.0.0
 * @category folding
 */
export function mapAccum<S, A, B>(s: S, f: (s: S, a: A) => readonly [S, B]) {
  return (self: Chunk<A>): readonly [S, Chunk<B>] => {
    let s1 = s
    const res: Array<B> = []
    for (const a of toReadonlyArray(self)) {
      const r = f(s1, a)
      s1 = r[0]
      res.push(r[1])
    }
    return [s1, unsafeFromArray(res)]
  }
}

/**
 * Separate elements based on a predicate that also exposes the index of the element.
 *
 * @category filtering
 * @since 1.0.0
 */
export const partitionWithIndex: {
  <C extends A, B extends A, A = C>(refinement: (a: A, i: number) => a is B): (
    fb: Chunk<C>
  ) => readonly [Chunk<C>, Chunk<B>]
  <B extends A, A = B>(predicate: (a: A, i: number) => boolean): (
    fb: Chunk<B>
  ) => readonly [Chunk<B>, Chunk<B>]
} = <A>(f: (a: A, i: number) => boolean) => {
  return (self: Chunk<A>): readonly [Chunk<A>, Chunk<A>] =>
    pipe(
      toReadonlyArray(self),
      RA.partitionWithIndex(f),
      ([l, r]) => [unsafeFromArray(l), unsafeFromArray(r)]
    )
}

/**
 * Separate elements based on a predicate.
 *
 * @category filtering
 * @since 1.0.0
 */
export const partition: {
  <C extends A, B extends A, A = C>(refinement: Refinement<A, B>): (
    fc: Chunk<C>
  ) => readonly [Chunk<C>, Chunk<B>]
  <B extends A, A = B>(
    predicate: Predicate<A>
  ): (fb: Chunk<B>) => readonly [Chunk<B>, Chunk<B>]
} = <B extends A, A = B>(predicate: Predicate<A>) =>
  (fb: Chunk<B>): readonly [Chunk<B>, Chunk<B>] =>
    pipe(
      toReadonlyArray(fb),
      RA.partition(predicate),
      ([l, r]) => [unsafeFromArray(l), unsafeFromArray(r)]
    )

/**
 * Partitions the elements of this chunk into two chunks using f.
 *
 * @category filtering
 * @since 1.0.0
 */
export const partitionMap = <A, B, C>(
  f: (a: A) => Either<B, C>
) =>
  (fa: Chunk<A>): readonly [Chunk<B>, Chunk<C>] =>
    pipe(
      fa,
      toReadonlyArray,
      RA.partitionMap(f),
      ([l, r]) => [unsafeFromArray(l), unsafeFromArray(r)]
    )

/**
 * Partitions the elements of this chunk into two chunks.
 *
 * @category filtering
 * @since 1.0.0
 */
export const separate = <A, B>(self: Chunk<Either<A, B>>): readonly [Chunk<A>, Chunk<B>] =>
  pipe(
    self,
    toReadonlyArray,
    RA.separate,
    ([l, r]) => [unsafeFromArray(l), unsafeFromArray(r)]
  )

/**
 * Create a non empty `Chunk` containing a range of integers, including both endpoints.
 *
 * @category constructors
 * @since 1.0.0
 */
export const range = (start: number, end: number): NonEmptyChunk<number> =>
  start <= end ? makeBy((i) => start + i)(end - start + 1) : singleton(start)

/**
 * Reverse a Chunk, creating a new Chunk.
 *
 * @since 1.0.0
 * @category elements
 */
export const reverse = <A>(self: Chunk<A>): Chunk<A> =>
  unsafeFromArray(RA.reverse(toReadonlyArray(self)))

/**
 * Retireves the size of the chunk
 *
 * @since 1.0.0
 * @category elements
 */
export const size = <A>(self: Chunk<A>): number => self.length

/**
 * Sort the elements of a Chunk in increasing order, creating a new Chunk.
 *
 * @since 1.0.0
 * @category elements
 */
export const sort = <B>(O: Order<B>) =>
  <A extends B>(as: Chunk<A>): Chunk<A> =>
    pipe(
      toReadonlyArray(as),
      RA.sort(O),
      unsafeFromArray
    )

/**
 *  Returns two splits of this chunk at the specified index.
 *
 * @since 1.0.0
 * @category elements
 */
export const splitAt = (n: number) =>
  <A>(self: Chunk<A>): readonly [Chunk<A>, Chunk<A>] => [take(n)(self), drop(n)(self)]

/**
 * Splits this chunk into `n` equally sized chunks.
 *
 * @since 1.0.0
 * @category elements
 */
export const split = (n: number) =>
  <A>(self: Chunk<A>): Chunk<Chunk<A>> => {
    const length = self.length
    const k = Math.floor(n)
    const quotient = Math.floor(length / k)
    const remainder = length % k

    const chunks: Array<Chunk<A>> = []
    let i = 0

    let chunk: Array<A> = []

    toReadonlyArray(self).forEach((a) => {
      chunk.push(a)
      if (
        (i <= remainder && chunk.length > quotient) ||
        (i > remainder && chunk.length >= quotient)
      ) {
        chunks.push(unsafeFromArray(chunk))
        chunk = []
      }
      i++
    })

    if (chunk.length > 0) {
      chunks.push(unsafeFromArray(chunk))
    }

    return unsafeFromArray(chunks)
  }

/**
 * Splits this chunk on the first element that matches this predicate.
 *
 * @since 1.0.0
 * @category elements
 */
export const splitWhere = <A>(f: Predicate<A>) =>
  (self: Chunk<A>): readonly [Chunk<A>, Chunk<A>] => {
    let i = 0
    for (const a of toReadonlyArray(self)) {
      if (f(a)) {
        break
      } else {
        i++
      }
    }
    return splitAt(i)(self)
  }

/**
 * Returns every elements after the first.
 *
 * @since 1.0.0
 * @category elements
 */
export const tail = <A>(self: Chunk<A>): Option<Chunk<A>> =>
  self.length > 0 ? O.some(drop(1)(self)) : O.none

/**
 * Takes the last `n` elements.
 *
 * @since 1.0.0
 * @category elements
 */
export const takeRight = (n: number) =>
  <A>(self: Chunk<A>): Chunk<A> => pipe(self, drop(self.length - n))

/**
 * Takes all elements so long as the predicate returns true.
 *
 * @since 1.0.0
 * @category elements
 */
export const takeWhile = <A>(f: Predicate<A>) =>
  (self: Chunk<A>): Chunk<A> => {
    const res: Array<A> = []
    for (const a of toReadonlyArray(self)) {
      if (f(a)) {
        res.push(a)
      } else {
        break
      }
    }
    return unsafeFromArray(res)
  }

/**
 * Constructs a `Chunk` by repeatedly applying the function `f` as long as it * returns `Some`.
 *
 * @since 1.0.0
 * @category elements
 */
export const unfold = <A, S>(s: S, f: (s: S) => Option<readonly [A, S]>): Chunk<A> => {
  const builder: Array<A> = []
  let cont = true
  let s1 = s
  while (cont) {
    const x = f(s1)
    if (O.isSome(x)) {
      s1 = x.value[1]
      builder.push(x.value[0])
    } else {
      cont = false
    }
  }
  return unsafeFromArray(builder)
}

/**
 * Creates a Chunks of unique values, in order, from all given Chunks.
 *
 * @since 1.0.0
 * @category elements
 */
export function union<A>(that: Chunk<A>) {
  return <B>(self: Chunk<B>): Chunk<A | B> =>
    unsafeFromArray(RA.union(toReadonlyArray(that))(toReadonlyArray(self)))
}

/**
 * Remove duplicates from an array, keeping the first occurrence of an element.
 *
 * @since 1.0.0
 * @category elements
 */
export const dedupe = <A>(self: Chunk<A>): Chunk<A> =>
  unsafeFromArray(RA.uniq(toReadonlyArray(self)))

/**
 * Returns the first element of this chunk.
 *
 * @since 1.0.0
 * @category unsafe
 */
export const unsafeHead = <A>(self: Chunk<A>): A => unsafeGet(0)(self)

/**
 * Returns the last element of this chunk.
 *
 * @since 1.0.0
 * @category unsafe
 */
export const unsafeLast = <A>(self: Chunk<A>): A => unsafeGet(self.length - 1)(self)

/**
 * Takes an array of pairs and return two corresponding arrays.
 *
 * Note: The function is reverse of `zip`.
 *
 * @since 1.0.0
 * @category elements
 */
export const unzip = <A, B>(as: Chunk<readonly [A, B]>): readonly [Chunk<A>, Chunk<B>] => {
  const fa: Array<A> = []
  const fb: Array<B> = []

  toReadonlyArray(as).forEach(([a, b]) => {
    fa.push(a)
    fb.push(b)
  })

  return [unsafeFromArray(fa), unsafeFromArray(fb)]
}

/**
 * Zips this chunk pointwise with the specified chunk.
 *
 * @since 1.0.0
 * @category elements
 */
export const zip = <B>(that: Chunk<B>) =>
  <A>(self: Chunk<A>): Chunk<readonly [A, B]> => pipe(self, zipWith(that, (a, b) => [a, b]))

/**
 * Zips this chunk pointwise with the specified chunk using the specified combiner.
 *
 * @since 1.0.0
 * @category elements
 */
export const zipWith = <A, B, C>(that: Chunk<B>, f: (a: A, b: B) => C) =>
  (self: Chunk<A>): Chunk<C> => {
    const selfA = toReadonlyArray(self)
    const thatA = toReadonlyArray(that)
    const len = Math.min(selfA.length, thatA.length)
    const res: Array<C> = new Array(len)
    for (let i = 0; i < len; i++) {
      res[i] = f(selfA[i], thatA[i])
    }
    return unsafeFromArray(res)
  }

/**
 * Zips this chunk pointwise with the specified chunk to produce a new chunk with
 * pairs of elements from each chunk, filling in missing values from the
 * shorter chunk with `None`. The returned chunk will have the length of the
 * longer chunk.
 *
 * @since 1.0.0
 * @category elements
 */
export const zipAll = <B>(that: Chunk<B>) =>
  <A>(self: Chunk<A>): Chunk<readonly [Option<A>, Option<B>]> =>
    pipe(
      self,
      zipAllWith(
        that,
        (a, b) => [O.some(a), O.some(b)],
        (a) => [O.some(a), O.none],
        (b) => [O.none, O.some(b)]
      )
    )

/**
 * Zips with chunk with the specified chunk to produce a new chunk with
 * pairs of elements from each chunk combined using the specified function
 * `both`. If one chunk is shorter than the other uses the specified
 * function `left` or `right` to map the element that does exist to the
 * result type.
 *
 * @since 1.0.0
 * @category elements
 */
export const zipAllWith = <A, B, C, D, E>(
  that: Chunk<B>,
  f: (a: A, b: B) => C,
  left: (a: A) => D,
  right: (b: B) => E
) =>
  (self: Chunk<A>): Chunk<C | D | E> => {
    const length = Math.max(self.length, that.length)
    if (length === 0) {
      return _empty
    }
    const leftarr = toReadonlyArray(self)
    const rightArr = toReadonlyArray(that)
    let i = 0
    let j = 0
    let k = 0
    const leftLength = leftarr.length
    const rightLength = rightArr.length
    const builder: Array<C | D | E> = new Array(length)
    while (i < length) {
      if (j < leftLength && k < rightLength) {
        builder.push(f(leftarr![j]!, rightArr![k]!))
        i++
        j++
        k++
      } else if (j < leftLength) {
        builder.push(left(leftarr![j]!))
        i++
        j++
      } else if (k < rightLength) {
        builder.push(right(rightArr![k]!))
        i++
        k++
      }
    }
    return unsafeFromArray(builder)
  }

/**
 * Zips this chunk crosswise with the specified chunk using the specified combiner.
 *
 * @since 1.0.0
 * @category elements
 */
export const crossWith = <A, B, C>(that: Chunk<B>, f: (a: A, b: B) => C) =>
  (self: Chunk<A>): Chunk<C> => pipe(self, flatMap((a) => pipe(that, map((b) => f(a, b)))))

/**
 * Zips this chunk crosswise with the specified chunk.
 *
 * @since 1.0.0
 * @category elements
 */
export const cross = <B>(that: Chunk<B>) =>
  <A>(self: Chunk<A>): Chunk<readonly [A, B]> => pipe(self, crossWith(that, (a, b) => [a, b]))

/**
 * Zips this chunk with the index of every element, starting from the initial
 * index value.
 *
 * @category elements
 * @since 1.0.0
 */
export const zipWithIndex = <A>(self: Chunk<A>): Chunk<readonly [A, number]> =>
  zipWithIndexOffset(0)(self)

/**
 * Zips this chunk with the index of every element, starting from the initial
 * index value.
 *
 * @category elements
 * @since 1.0.0
 */
export const zipWithIndexOffset = (offset: number) =>
  <A>(self: Chunk<A>): Chunk<[A, number]> => {
    const iterator = self[Symbol.iterator]()
    let next: IteratorResult<A>
    let i = offset
    const builder: Array<[A, number]> = []
    while (!(next = iterator.next()).done) {
      builder.push([next.value, i])
      i = i + 1
    }
    return unsafeFromArray(builder)
  }

/**
 * Delete the element at the specified index, creating a new `Chunk`,
 * or returning the input if the index is out of bounds.
 *
 * @category mutations
 * @since 1.0.0
 */
export const remove = (i: number) =>
  <A>(self: Chunk<A>): Chunk<A> => pipe(self, toReadonlyArray, RA.remove(i), unsafeFromArray)

/**
 * Change the element at the specified index, creating a new `Chunk`,
 * or returning the input if the index is out of bounds.
 *
 * @category mutations
 * @since 1.0.0
 */
export const replace = <B>(i: number, b: B): <A>(self: Chunk<A>) => Chunk<B | A> =>
  modify(i, () => b)

/**
 * @category mutations
 * @since 1.0.0
 */
export const replaceOption = <B>(i: number, b: B): <A>(self: Chunk<A>) => Option<Chunk<B | A>> =>
  modifyOption(i, () => b)

/**
 * Apply a function to the element at the specified index, creating a new `Chunk`,
 * or returning the input if the index is out of bounds.
 *
 * @category mutations
 * @since 1.0.0
 */
export const modify = <A, B>(i: number, f: (a: A) => B) =>
  (self: Chunk<A>): Chunk<A | B> => pipe(modifyOption(i, f)(self), O.getOrElse(() => self))

/**
 * @category mutations
 * @since 1.0.0
 */
export const modifyOption = <A, B>(i: number, f: (a: A) => B) =>
  (self: Chunk<A>): Option<Chunk<A | B>> =>
    pipe(self, toReadonlyArray, RA.modifyOption(i, f), O.map(unsafeFromArray))

/**
 * Returns the first element of this non empty chunk.
 *
 * @since 1.0.0
 * @category elements
 */
export const headNonEmpty: <A>(self: NonEmptyChunk<A>) => A = unsafeHead

/**
 * Returns every elements after the first.
 *
 * @since 1.0.0
 * @category elements
 */
export const tailNonEmpty = <A>(self: NonEmptyChunk<A>): Chunk<A> => drop(1)(self)
