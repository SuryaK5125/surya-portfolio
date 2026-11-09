/**
 * Minimal PNG decode/encode (8-bit, non-interlaced; grey, grey+alpha, RGB,
 * RGBA) and box-filter downsampling. Node built-ins only.
 */
const zlib = require('zlib');

const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

function decodePng(buf) {
    if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('Not a PNG');
    let offset = 8;
    let width, height, bitDepth, colorType, interlace;
    let palette = null;
    let paletteAlpha = null;
    const idat = [];
    while (offset < buf.length) {
        const length = buf.readUInt32BE(offset);
        const type = buf.toString('ascii', offset + 4, offset + 8);
        const data = buf.slice(offset + 8, offset + 8 + length);
        if (type === 'IHDR') {
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            bitDepth = data[8];
            colorType = data[9];
            interlace = data[12];
        } else if (type === 'PLTE') {
            palette = data;
        } else if (type === 'tRNS') {
            paletteAlpha = data;
        } else if (type === 'IDAT') {
            idat.push(data);
        } else if (type === 'IEND') {
            break;
        }
        offset += 12 + length;
    }
    if (interlace !== 0) throw new Error('Interlaced PNGs are not supported');

    // Indexed colour (1/2/4/8-bit) → RGBA
    if (colorType === 3) {
        if (!palette) throw new Error('Indexed PNG without palette');
        const raw = zlib.inflateSync(Buffer.concat(idat));
        const stride = Math.ceil((width * bitDepth) / 8);
        const lines = unfilter(raw, stride, height, 1);
        const out = Buffer.alloc(width * height * 4);
        const perByte = 8 / bitDepth;
        const mask = (1 << bitDepth) - 1;
        for (let y = 0; y < height; y++)
            for (let x = 0; x < width; x++) {
                const byte = lines[y * stride + Math.floor(x / perByte)];
                const shift = 8 - bitDepth * ((x % perByte) + 1);
                const index = (byte >> shift) & mask;
                const o = (y * width + x) * 4;
                out[o] = palette[index * 3];
                out[o + 1] = palette[index * 3 + 1];
                out[o + 2] = palette[index * 3 + 2];
                out[o + 3] = paletteAlpha && index < paletteAlpha.length ? paletteAlpha[index] : 255;
            }
        return { width, height, channels: 4, data: out };
    }

    const channels = CHANNELS[colorType];
    if (bitDepth !== 8 || !channels) {
        throw new Error(`Unsupported PNG (depth ${bitDepth}, type ${colorType})`);
    }
    const raw = zlib.inflateSync(Buffer.concat(idat));
    return { width, height, channels, data: unfilter(raw, width * channels, height, channels) };
}

/** Reverses PNG scanline filters. `bpp` is bytes per complete pixel (min 1). */
function unfilter(raw, stride, height, bpp) {
    const channels = bpp;
    const out = Buffer.alloc(stride * height);
    const paeth = (a, b, c) => {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    };
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        const line = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        for (let x = 0; x < stride; x++) {
            const a = x >= channels ? out[y * stride + x - channels] : 0;
            const b = y > 0 ? out[(y - 1) * stride + x] : 0;
            const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0;
            let v = line[x];
            if (filter === 1) v += a;
            else if (filter === 2) v += b;
            else if (filter === 3) v += (a + b) >> 1;
            else if (filter === 4) v += paeth(a, b, c);
            out[y * stride + x] = v & 0xff;
        }
    }
    return out;
}

/** Drops alpha from an RGBA image (for opaque textures such as normal maps). */
function toRgb({ width, height, data }) {
    const out = Buffer.alloc(width * height * 3);
    for (let i = 0; i < width * height; i++) data.copy(out, i * 3, i * 4, i * 4 + 3);
    return { width, height, channels: 3, data: out };
}

/** Converts any decoded image to RGBA. */
function toRgba({ width, height, channels, data }) {
    const out = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i++) {
        const s = i * channels;
        if (channels === 1) out.fill(data[s], i * 4, i * 4 + 3), (out[i * 4 + 3] = 255);
        else if (channels === 2) out.fill(data[s], i * 4, i * 4 + 3), (out[i * 4 + 3] = data[s + 1]);
        else if (channels === 3) data.copy(out, i * 4, s, s + 3), (out[i * 4 + 3] = 255);
        else data.copy(out, i * 4, s, s + 4);
    }
    return { width, height, channels: 4, data: out };
}

/** Box-filter downsample of an RGBA image by an integer factor (alpha-weighted colour). */
function downsampleRgba(img, factor) {
    const w = Math.floor(img.width / factor);
    const h = Math.floor(img.height / factor);
    const out = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
            let r = 0, g = 0, b = 0, a = 0;
            for (let dy = 0; dy < factor; dy++)
                for (let dx = 0; dx < factor; dx++) {
                    const i = ((y * factor + dy) * img.width + (x * factor + dx)) * 4;
                    const al = img.data[i + 3];
                    r += img.data[i] * al;
                    g += img.data[i + 1] * al;
                    b += img.data[i + 2] * al;
                    a += al;
                }
            const o = (y * w + x) * 4;
            out[o] = a ? Math.round(r / a) : 0;
            out[o + 1] = a ? Math.round(g / a) : 0;
            out[o + 2] = a ? Math.round(b / a) : 0;
            out[o + 3] = Math.round(a / (factor * factor));
        }
    return { width: w, height: h, channels: 4, data: out };
}

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

const crc32 = (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
};

function encodePng({ width, height, channels, data }) {
    const colorType = { 1: 0, 2: 4, 3: 2, 4: 6 }[channels];
    const stride = width * channels;
    const raw = Buffer.alloc((stride + 1) * height);
    for (let y = 0; y < height; y++) {
        raw[y * (stride + 1)] = 0;
        data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
    }
    const chunk = (type, body) => {
        const len = Buffer.alloc(4);
        len.writeUInt32BE(body.length);
        const td = Buffer.concat([Buffer.from(type, 'ascii'), body]);
        const crc = Buffer.alloc(4);
        crc.writeUInt32BE(crc32(td));
        return Buffer.concat([len, td, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = colorType;
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

module.exports = { decodePng, toRgba, toRgb, downsampleRgba, encodePng };
