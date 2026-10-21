import assert from 'node:assert/strict'
import { test } from 'node:test'
import { KeyValueStore } from './key_value.js'

test('set stores a value under its key', () => {
  const store = new KeyValueStore<number>()

  assert.equal(store.get('a'), null)
  store.set('a', 1)

  assert.equal(store.get('a'), 1)
})

test('set overwrites an existing value', () => {
  const store = new KeyValueStore<number>()
  store.set('a', 1)

  store.set('a', 2)

  assert.equal(store.get('a'), 2)
})

test('delete removes the key and preserves other values', () => {
  const store = new KeyValueStore<number>()
  store.set('a', 1)
  store.set('b', 2)

  store.delete('a')

  assert.equal(store.get('a'), null)
  assert.equal(store.get('b'), 2)
})

test('delete does nothing when the key is missing', () => {
  const store = new KeyValueStore<number>()
  store.set('a', 1)

  store.delete('missing')

  assert.equal(store.get('missing'), null)
  assert.equal(store.get('a'), 1)
})

test('begin preserves existing values and allows transaction writes', () => {
  const store = new KeyValueStore<number>()
  store.set('a', 1)

  store.begin()

  assert.equal(store.get('a'), 1)
  store.set('a', 2)
  store.set('b', 3)
  assert.equal(store.get('a'), 2)
  assert.equal(store.get('b'), 3)
})

test('begin supports nested transactions with the current values', () => {
  const store = new KeyValueStore<number>()
  store.begin()
  store.set('a', 1)

  store.begin()

  assert.equal(store.get('a'), 1)
  store.delete('a')
  store.set('b', 2)
  assert.equal(store.get('a'), null)
  assert.equal(store.get('b'), 2)
})

test('commit throws without an active transaction and preserves the store', () => {
  const store = new KeyValueStore<number>()
  store.set('a', 1)

  assert.throws(() => store.commit(), { message: 'No active transaction' })
  assert.equal(store.get('a'), 1)

  store.begin()
  store.set('a', 2)
  store.commit()
  assert.equal(store.get('a'), 2)
})

test('commit persists additions and updates while preserving untouched keys', () => {
  const store = new KeyValueStore<number>()
  store.set('a', 1)
  store.set('untouched', 10)
  store.begin()
  store.set('a', 2)
  store.set('b', 3)

  store.commit()

  assert.equal(store.get('a'), 2)
  assert.equal(store.get('b'), 3)
  assert.equal(store.get('untouched'), 10)
  assert.throws(() => store.commit(), { message: 'No active transaction' })
})

test('commit persists deletions', () => {
  const store = new KeyValueStore<number>()
  store.set('a', 1)
  store.set('b', 2)
  store.begin()
  store.delete('a')

  store.commit()

  assert.equal(store.get('a'), null)
  assert.equal(store.get('b'), 2)
})

test('committing an unchanged transaction preserves existing values', () => {
  const store = new KeyValueStore<number>()
  store.set('a', 1)
  store.begin()

  store.commit()

  assert.equal(store.get('a'), 1)
  assert.throws(() => store.commit(), { message: 'No active transaction' })
})

test('an empty store supports beginning and committing a transaction', () => {
  const store = new KeyValueStore<number>()
  store.begin()

  store.commit()

  assert.equal(store.get('missing'), null)
  store.set('a', 1)
  assert.equal(store.get('a'), 1)
})

test('nested commit closes only the innermost transaction', () => {
  const store = new KeyValueStore<number>()
  store.set('a', 1)
  store.begin()
  store.set('a', 2)
  store.set('parentOnly', 10)
  store.begin()
  store.set('a', 3)
  store.set('childOnly', 20)

  store.commit()

  assert.equal(store.get('a'), 3)
  assert.equal(store.get('parentOnly'), 10)
  assert.equal(store.get('childOnly'), 20)

  store.set('afterChildCommit', 30)
  store.commit()

  assert.equal(store.get('a'), 3)
  assert.equal(store.get('parentOnly'), 10)
  assert.equal(store.get('childOnly'), 20)
  assert.equal(store.get('afterChildCommit'), 30)
  assert.throws(() => store.commit(), { message: 'No active transaction' })
})

test('nested commits preserve deletions from both parent and child', () => {
  const store = new KeyValueStore<number>()
  store.set('a', 1)
  store.set('b', 2)
  store.begin()
  store.delete('a')
  store.begin()
  store.delete('b')

  store.commit()
  store.commit()

  assert.equal(store.get('a'), null)
  assert.equal(store.get('b'), null)
})

test('a new transaction starts from the previously committed state', () => {
  const store = new KeyValueStore<number>()
  store.begin()
  store.set('a', 1)
  store.commit()

  store.begin()
  assert.equal(store.get('a'), 1)
  store.set('a', 2)
  store.commit()

  assert.equal(store.get('a'), 2)
})

test('committing preserves falsy values and an empty key', () => {
  const store = new KeyValueStore<number | boolean | string>()
  store.begin()
  store.set('', 0)
  store.set('enabled', false)
  store.set('text', '')

  store.commit()

  assert.equal(store.get(''), 0)
  assert.equal(store.get('enabled'), false)
  assert.equal(store.get('text'), '')
  assert.equal(store.get('missing'), null)
})

test('store instances have independent transaction state', () => {
  const first = new KeyValueStore<number>()
  const second = new KeyValueStore<number>()
  first.begin()
  first.set('a', 1)
  second.set('a', 2)

  first.commit()

  assert.equal(first.get('a'), 1)
  assert.equal(second.get('a'), 2)
  assert.throws(() => second.commit(), { message: 'No active transaction' })
})

test('rollback throws without an active transaction and preserves the store', () => {
  const store = new KeyValueStore<number>()
  store.set('a', 1)

  assert.throws(() => store.rollback(), { message: 'No active transaction' })
  assert.equal(store.get('a'), 1)
  store.begin()
  store.set('a', 2)
  store.rollback()
  assert.equal(store.get('a'), 1)
})

test('rollback reverses additions, updates, and deletions', () => {
  const store = new KeyValueStore<number>()
  store.set('updated', 1)
  store.set('deleted', 2)
  store.set('untouched', 3)
  store.begin()
  store.set('added', 4)
  store.set('updated', 5)
  store.delete('deleted')

  store.rollback()

  assert.equal(store.get('added'), null)
  assert.equal(store.get('updated'), 1)
  assert.equal(store.get('deleted'), 2)
  assert.equal(store.get('untouched'), 3)
  assert.throws(() => store.rollback(), { message: 'No active transaction' })
})

test('nested rollback restores the parent transaction and allows committing it', () => {
  const store = new KeyValueStore<number>()
  store.set('a', 1)
  store.begin()
  store.set('a', 2)
  store.set('parentOnly', 10)
  store.begin()
  store.set('a', 3)
  store.delete('parentOnly')
  store.set('childOnly', 20)

  store.rollback()

  assert.equal(store.get('a'), 2)
  assert.equal(store.get('parentOnly'), 10)
  assert.equal(store.get('childOnly'), null)
  store.set('afterRollback', 30)
  store.commit()
  assert.equal(store.get('a'), 2)
  assert.equal(store.get('afterRollback'), 30)
  assert.throws(() => store.commit(), { message: 'No active transaction' })
})

test('rolling back the outer transaction discards a committed inner transaction', () => {
  const store = new KeyValueStore<number>()
  store.set('a', 1)
  store.begin()
  store.set('a', 2)
  store.begin()
  store.delete('a')
  store.set('b', 3)
  store.commit()

  store.rollback()

  assert.equal(store.get('a'), 1)
  assert.equal(store.get('b'), null)
})

test('begin, begin, set, rollback, commit leaves the key unset', () => {
  const store = new KeyValueStore<number>()

  store.begin()
  store.begin()
  store.set('a', 1)
  store.rollback()
  store.commit()

  assert.equal(store.get('a'), null)
})

test('successive rollbacks restore each preceding snapshot', () => {
  const store = new KeyValueStore<number>()
  store.set('a', 0)
  for (const value of [1, 2, 3]) {
    store.begin()
    store.set('a', value)
  }

  for (const expected of [2, 1, 0]) {
    store.rollback()
    assert.equal(store.get('a'), expected)
  }

  assert.throws(() => store.rollback(), { message: 'No active transaction' })
})

test('rollback handles an empty transaction and supports subsequent transactions', () => {
  const store = new KeyValueStore<number>()
  store.begin()
  store.rollback()
  assert.equal(store.get('a'), null)

  store.begin()
  store.set('a', 1)
  store.commit()
  store.begin()
  store.set('a', 2)
  store.rollback()

  assert.equal(store.get('a'), 1)
})

test('reads find inherited values across empty transaction layers', () => {
  const store = new KeyValueStore<number>()
  store.set('a', 1)
  store.begin()
  store.set('b', 2)
  store.begin()
  store.begin()

  assert.equal(store.get('a'), 1)
  assert.equal(store.get('b'), 2)
  assert.equal(store.get('missing'), null)
})

test('a parent deletion hides the base value in nested transactions', () => {
  const store = new KeyValueStore<number>()
  store.set('a', 1)
  store.begin()
  store.delete('a')
  store.begin()
  assert.equal(store.get('a'), null)

  store.set('a', 2)
  assert.equal(store.get('a'), 2)
  store.rollback()
  assert.equal(store.get('a'), null)
  store.rollback()
  assert.equal(store.get('a'), 1)
})

test('an inner deletion stays hidden after commit and is restored by outer rollback', () => {
  const store = new KeyValueStore<number>()
  store.set('a', 1)
  store.begin()
  store.begin()
  store.delete('a')
  store.commit()

  assert.equal(store.get('a'), null)
  store.begin()
  assert.equal(store.get('a'), null)
  store.commit()
  store.rollback()
  assert.equal(store.get('a'), 1)
})

test('committing a new value replaces a parent deletion', () => {
  const store = new KeyValueStore<number>()
  store.set('a', 1)
  store.begin()
  store.delete('a')
  store.begin()
  store.set('a', 2)

  store.commit()
  assert.equal(store.get('a'), 2)
  store.commit()
  assert.equal(store.get('a'), 2)
})

test('a stored undefined shadows an inherited value', () => {
  const store = new KeyValueStore<number | undefined>()
  store.set('a', 1)
  store.begin()
  store.set('a', undefined)

  assert.equal(store.get('a'), undefined)
  store.commit()
  assert.equal(store.get('a'), undefined)
  store.delete('a')
  assert.equal(store.get('a'), null)
})

test('transaction layers retain only changed keys instead of copying the dataset', () => {
  const store = new KeyValueStore<number>()
  const datasetSize = 10_000
  const transactionDepth = 50
  for (let index = 0; index < datasetSize; index++) {
    store.set(`key-${index}`, index)
  }

  // Inspect retained entries to avoid GC-dependent heap assertions.
  const layers = Reflect.get(store, 'layers') as Map<string, unknown>[]
  for (let depth = 0; depth < transactionDepth; depth++) {
    store.begin()
    assert.equal(layers[layers.length - 1]!.size, 0)
    store.set('changed', depth)
    store.set('changed', depth + 1)
    store.delete('key-0')
    assert.equal(layers[layers.length - 1]!.size, 2)
  }

  assert.equal(layers.length, transactionDepth + 1)
  assert.equal(layers.reduce((total, layer) => total + layer.size, 0),
    datasetSize + transactionDepth * 2)
  assert.equal(store.get('key-9999'), 9999)
  assert.equal(store.get('key-0'), null)

  for (let depth = 0; depth < transactionDepth; depth++) {
    store.rollback()
  }

  assert.equal(layers.length, 1)
  assert.equal(layers[0]!.size, datasetSize)
  assert.equal(store.get('key-0'), 0)
  assert.equal(store.get('changed'), null)
})
