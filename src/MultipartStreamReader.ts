import { hthvParse as parseHeader } from 'http-header-value';
import { ByteBuffer } from "@h7/byte-buffer";

export type CurrentPart = {
  contentType: string | null,
  name: string | null,
  filename: string | null,
  body: ByteBuffer,
};

export type Part = {
  contentType: string | null,
  name: string,
  filename: string | null,
  body: Uint8Array,
};

type OnPartFunction = (part: Part) => void | Promise<void>;

export type MultipartStreamReaderOptions = {
  stream: ReadableStream<Uint8Array>,
  boundary: string,
  onPart: OnPartFunction,
};

type STATE =
  | 'PREAMBLE'
  | 'SECTION_DIVIDER'
  | 'SECTION_DIVIDER_BODY'
  | 'SECTION_CLOSER'
  | 'SECTION_HEADER'
  | 'BODY'
  | 'EPILOGUE';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export default class MultipartStreamReader {
  constructor(options: MultipartStreamReaderOptions) {

    const {
      stream,
      boundary,
      onPart,
    } = options;

    this.reader = stream.getReader();
    this.byteBuffer = new ByteBuffer(new Uint8Array([13, 10]));
    this.boundary = boundary;

    this._boundary = new Uint8Array([13, 10, 45, 45, ...encoder.encode(boundary)]);
    this._boundaryCloser = new Uint8Array([13, 10, 45, 45, ...encoder.encode(boundary), 45, 45]);

    this.state = 'PREAMBLE';
    this.currentPart = null;

    this.onPart = onPart;
  }

  reader: ReadableStreamDefaultReader<Uint8Array>;
  byteBuffer: ByteBuffer;
  boundary: string;
  _boundary: Uint8Array;
  _boundaryCloser: Uint8Array;

  state: STATE;

  currentPart: CurrentPart | null;

  onPart: OnPartFunction;

  _findBoundary() {
    return this.byteBuffer.indexOf(this._boundary);
  }
  _findBoundaryCloser() {
    return this.byteBuffer.indexOf(this._boundaryCloser);
  }

  _assertEqual(a: Uint8Array, b: Uint8Array) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (a.at(i) !== b.at(i)) {
        return false;
      }
    }
    return true;

  }
  
  async _partComplete() {
    if (this.currentPart != null) {
      if (this.currentPart.name == null) {
        throw new Error('Part was missing name');
      }
      const part: Part = {
        name: this.currentPart.name,
        contentType: this.currentPart.contentType,
        filename: this.currentPart.filename,
        body: this.currentPart.body.slice(),
      }
      // fire an event
      await this.onPart(part);
    }
  }

  async performWork() {

    while (true) {

      if (this.state === 'PREAMBLE') {

        const pos = this._findBoundary();
        if (pos !== -1) {

          // boundary found, we have to consume bytes from the buffer before it
          // (and throw them away)
          this.byteBuffer.pull(pos);

          // let's pull in the next chunk in case it contains the first two bytes of section divider
          const { done, value } = await this.reader.read();
          if (!done) {
            this.byteBuffer.append(value);
          }

          if (this.byteBuffer.indexOf(this._boundaryCloser) === 0) {
            // It's a closer
            this.state = 'SECTION_CLOSER';
            continue;
          }

          // It's a divider
          this.state = 'SECTION_DIVIDER';
          continue;

        }

        // no boundary found - we will consume everything up to the last CR in the buffer
        if (this.byteBuffer.length > 0) {
          let posCr = -1;
          while (true) {
            const p = this.byteBuffer.indexOf(new Uint8Array([13]), posCr + 1);
            if (p === -1) {
              break;
            }
            posCr = p;
          }

          // The last CR in the buffer could be the start of a boundary.
          const lengthToConsume = posCr !== -1 ? posCr : this.byteBuffer.length;
          this.byteBuffer.pull(lengthToConsume);
        }

        // let's pull in the next chunk and try again
        const { done, value } = await this.reader.read();
        if (done) {
          // We're in the preamble and we're done? no way.
          throw new Error('Assertion: PREAMBLE state and ran out of stream.');
        }

        this.byteBuffer.append(value);
        continue;
      }

      if (this.state === 'SECTION_CLOSER') {
        // Consume the closer
        const closer = this.byteBuffer.pull(this._boundaryCloser.length);
        if (!this._assertEqual(this._boundaryCloser, closer)) {
          throw new Error(`Assertion: in SECTION_CLOSER state, but consumed something else ${String(closer)}`);
        }

        await this._partComplete();
        this.currentPart = null;

        this.state = 'EPILOGUE';
        continue;
      }

      if (this.state === 'EPILOGUE') {
        // We're done here. Throw away the rest of the stream.
        while (true) {
          const { done } = await this.reader.read();
          if (done) {
            return;
          }
        }
      }

      if (this.state === 'SECTION_DIVIDER') {
        // Consume the divider
        const divider = this.byteBuffer.pull(this._boundary.length);
        if (!this._assertEqual(this._boundary, divider)) {
          throw new Error(`Assertion: in SECTION_DIVIDER state, but consumed something else ${String(divider)}`);
        }

        await this._partComplete();
        this.currentPart = {
          name: null,
          contentType: null,
          filename: null,
          body: new ByteBuffer(),
        };

        this.state = 'SECTION_DIVIDER_BODY';
        continue;

      }

      if (this.state === 'SECTION_DIVIDER_BODY') {

        // Consume up to the next CR/LF
        const pos = this.byteBuffer.indexOf(new Uint8Array([13, 10]));

        if (pos !== -1) {
          // CR/LF found, consume bytes from the buffer up to and including them
          const bytes = this.byteBuffer.pull(pos);
          if (bytes.some(v => v !== 32)) {
            throw new Error(`Assertion: in SECTION_DIVIDER_BODY state, but consumed something else ${String(bytes)}`);
          }
          this.byteBuffer.pull(2);

          this.state = 'SECTION_HEADER';
          continue;
        }

        // no CRLF found, pull a chunk and try again
        // let's pull in the next chunk and try again
        const { done, value } = await this.reader.read();
        if (done) {
          throw new Error('Assertion: SECTION_DIVIDER_BODY state and ran out of stream.');
        }

        this.byteBuffer.append(value);
        continue;
      }

      if (this.state === 'SECTION_HEADER') {

        if (this.currentPart == null) {
          throw new Error('Assertion: SECTION_HEADER chunk with no current part.');
        }

        // Look ahead until we see the double CR LF, which is the end of the header
        const pos = this.byteBuffer.indexOf(new Uint8Array([13, 10, 13, 10]));

        if (pos !== -1) {
          // CR LF found twice in a row, that's the end of the headers!
          const bytes = this.byteBuffer.pull(pos);
          // The headers should be in UTF-8 (let's hope), so we'll decode them as such
          const headers = decoder.decode(bytes).split('\r\n');

          // Each segment is a header string, and we only accept content-disposition and content-type
          for (const header of headers) {
            if (header.toLowerCase().startsWith('content-disposition:')) {
              const value = header.slice('content-disposition:'.length).trim();

              const [ headerItem ] = parseHeader(value);
              if (headerItem.v !== 'form-data') {
                // ignore it!
                continue;
              }

              const nameParamItem = headerItem.p['name'];
              if (nameParamItem != null) {
                this.currentPart.name = nameParamItem.v;
              }

              const filenameParamItem = headerItem.p['filename'];
              if (filenameParamItem != null) {
                this.currentPart.filename = filenameParamItem.v;
              }
            }
            if (header.toLowerCase().startsWith('content-type:')) {
              const value = header.slice('content-type:'.length).trim();

              const [ headerItem ] = parseHeader(value);
              this.currentPart.contentType = headerItem.v;
            }
          }

          this.byteBuffer.pull(4);
          this.state = 'BODY';
          continue;
        }

        // no double CR LF found
        // let's pull in the next chunk and try again
        const { done, value } = await this.reader.read();
        if (done) {
          // We're in the preamble and we're done? no way.
          throw new Error('Assertion: SECTION_HEADER state and ran out of stream.');
        }

        this.byteBuffer.append(value);
        continue;
      }

      if (this.state === 'BODY') {
        if (this.currentPart == null) {
          throw new Error('Assertion: BODY chunk with no current part.');
        }

        const pos = this._findBoundary();
        if (pos !== -1) {

          // boundary found, we have to consume bytes from the buffer before it
          const body = this.byteBuffer.pull(pos);
          this.currentPart.body.append(body);

          // let's pull in the next chunk in case it contains the first two bytes of section divider
          const { done, value } = await this.reader.read();
          if (!done) {
            this.byteBuffer.append(value);
          }

          if (this.byteBuffer.indexOf(this._boundaryCloser) === 0) {
            // It's a closer
            this.state = 'SECTION_CLOSER';
            continue;
          }

          // It's a divider
          this.state = 'SECTION_DIVIDER';
          continue;

        }

        // no boundary found - we will consume everything up to the last CR in the buffer
        if (this.byteBuffer.length > 0) {
          let posCr = -1;
          while (true) {
            const p = this.byteBuffer.indexOf(new Uint8Array([13]), posCr + 1);
            if (p === -1) {
              break;
            }
            posCr = p;
          }

          // The last CR in the buffer could be the start of a boundary.
          const lengthToConsume = posCr !== -1 ? posCr : this.byteBuffer.length;
          const body = this.byteBuffer.pull(lengthToConsume);
          this.currentPart.body.append(body);
        }

        // let's pull in the next chunk and try again
        const { done, value } = await this.reader.read();
        if (done) {
          // We're in the preamble and we're done? no way.
          throw new Error('Assertion: BODY state and ran out of stream.');
        }

        this.byteBuffer.append(value);

        continue;
      }

      throw new Error('Should not reach here');
    }

  }


}
