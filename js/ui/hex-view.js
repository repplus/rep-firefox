export function generateHexView(content) {
    if (!content) return '';

    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    let output = '';
    const length = data.length;

    for (let i = 0; i < length; i += 16) {
        // Offset
        output += i.toString(16).padStart(8, '0') + '  ';

        // Hex Bytes
        let hex = '';
        let ascii = '';

        for (let j = 0; j < 16; j++) {
            if (i + j < length) {
                const byte = data[i + j];
                hex += byte.toString(16).padStart(2, '0') + ' ';
                ascii += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
            } else {
                hex += '   ';
                ascii += ' ';
            }

            if (j === 7) hex += ' '; // Extra space after 8 bytes
        }

        output += hex + ' |' + ascii + '|\n';
    }

    return output;
}
