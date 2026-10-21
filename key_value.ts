const DELETED = Symbol('deleted')

export class KeyValueStore<Value> {
  private readonly layers: Map<string, Value | typeof DELETED>[] = [new Map()]

  private get currentLayer(): Map<string, Value | typeof DELETED> {
    return this.layers[this.layers.length - 1]!
  }

  set(key: string, value: Value): void {
    this.currentLayer.set(key, value)
  }

  get(key: string): Value | null {
    for (let index = this.layers.length - 1; index >= 0; index--) {
      const layer = this.layers[index]!
      if (layer.has(key)) {
        const value = layer.get(key)!
        return value === DELETED ? null : value
      }
    }

    return null
  }

  delete(key: string): void {
    if (this.layers.length === 1) {
      this.currentLayer.delete(key)
    } else {
      this.currentLayer.set(key, DELETED)
    }
  }

  begin(): void {
    this.layers.push(new Map())
  }

  commit(): void {
    const transaction = this.popTransaction()
    for (const [key, value] of transaction) {
      if (value === DELETED) {
        this.delete(key)
      } else {
        this.set(key, value)
      }
    }
  }

  rollback(): void {
    this.popTransaction()
  }

  private popTransaction = (): Map<string, Value | typeof DELETED> => {
    if (this.layers.length === 1) {
      throw new Error('No active transaction')
    }

    return this.layers.pop()!
  }
}
