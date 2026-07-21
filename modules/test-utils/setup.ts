import '@testing-library/jest-dom/vitest'
import { setupMockElectron } from './mocks/electron'

// happy-dom lacks ResizeObserver; several Radix primitives need it.
class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver

// happy-dom's base Node.prototype.nodeName getter returns '' — every concrete
// class (Element, Text, Comment, …) overrides it. DOMPurify hardens against
// DOM clobbering by caching the BASE prototype getter, so under happy-dom it
// reads '' for every node and the §4.9 sanitizer allowlist collapses. Redefine
// the base getter to dispatch to the closest subclass getter (never recursing
// past Node.prototype), which restores real tag names for cached readers.
if (typeof window !== 'undefined') {
  const nodePrototype = window.Node.prototype
  Object.defineProperty(nodePrototype, 'nodeName', {
    configurable: true,
    get(this: Node): string {
      let proto = Object.getPrototypeOf(this) as object | null
      while (proto !== null && proto !== nodePrototype) {
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'nodeName')
        if (descriptor?.get !== undefined) return descriptor.get.call(this) as string
        proto = Object.getPrototypeOf(proto) as object | null
      }
      return ''
    },
  })

  // happy-dom's NodeIterator also lacks the spec's node-removal steps: once
  // DOMPurify removes the iterator's reference node, nextNode() returns null
  // and every later sibling escapes sanitization. A pre-order snapshot is
  // equivalent for DOMPurify's single forward pass (nodes inside removed
  // subtrees are still visited, which only over-sanitizes detached nodes).
  // Patched on the prototype that actually owns the method in the live
  // document's chain — the environment's window.Document class is NOT in
  // window.document's prototype chain under vitest + happy-dom.
  const matches = (node: Node, whatToShow: number): boolean =>
    ((whatToShow >>> (node.nodeType - 1)) & 1) === 1
  let ownerProto = Object.getPrototypeOf(window.document) as object | null
  while (
    ownerProto !== null &&
    Object.getOwnPropertyDescriptor(ownerProto, 'createNodeIterator') === undefined
  ) {
    ownerProto = Object.getPrototypeOf(ownerProto) as object | null
  }
  if (ownerProto !== null) {
    ;(ownerProto as Document).createNodeIterator = function createNodeIterator(
      root: Node,
      whatToShow = 0xffffffff,
    ): NodeIterator {
      const snapshot: Node[] = []
      const collect = (node: Node): void => {
        if (matches(node, whatToShow)) snapshot.push(node)
        for (const child of Array.from(node.childNodes)) collect(child)
      }
      collect(root)
      let index = 0
      return {
        root,
        whatToShow,
        filter: null,
        referenceNode: root,
        pointerBeforeReferenceNode: true,
        nextNode: (): Node | null => snapshot[index++] ?? null,
        previousNode: (): Node | null => snapshot[--index - 1] ?? null,
        detach: (): void => {},
      } as NodeIterator
    }
  }
}

beforeEach(() => {
  // Node-environment suites (e.g. modules/persistence, which runs PGlite via
  // `@vitest-environment node`) have no DOM to reset.
  if (typeof window === 'undefined') return
  localStorage.clear()
  setupMockElectron()
})
