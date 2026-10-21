import { KeyValueStore } from './key_value.js'

const store = new KeyValueStore<number>()
store.set('a', 1)
console.log(store.get('a'))
