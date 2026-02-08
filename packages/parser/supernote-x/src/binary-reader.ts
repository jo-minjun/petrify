export class BinaryReader {
  private readonly view: DataView;
  private readonly bytes: Uint8Array;
  private pos = 0;

  constructor(data: ArrayBuffer) {
    this.view = new DataView(data);
    this.bytes = new Uint8Array(data);
  }

  get position(): number {
    return this.pos;
  }

  get length(): number {
    return this.view.byteLength;
  }

  seek(offset: number): void {
    this.pos = offset;
  }

  readUint32LE(): number {
    const val = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return val;
  }

  readBytes(length: number): Uint8Array {
    const slice = this.bytes.slice(this.pos, this.pos + length);
    this.pos += length;
    return slice;
  }

  readString(length: number): string {
    return new TextDecoder().decode(this.readBytes(length));
  }

  readBlock(): Uint8Array {
    const size = this.readUint32LE();
    if (size === 0) return new Uint8Array(0);
    return this.readBytes(size);
  }

  readBlockAsString(): string {
    return new TextDecoder().decode(this.readBlock());
  }
}
