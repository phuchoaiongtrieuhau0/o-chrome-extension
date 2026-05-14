const crypto = require("crypto");
const fs = require("fs");

const pemPath = `extension.pem`;

if (!pemPath) {
    console.error("Usage: node get-extension-id.js extension.pem");
    process.exit(1);
}

const privateKeyPem = fs.readFileSync(pemPath);
const publicKeyDer = crypto
    .createPublicKey(privateKeyPem)
    .export({
        type: "spki",
        format: "der",
    });

const hash = crypto.createHash("sha256").update(publicKeyDer).digest();
const first16Bytes = hash.subarray(0, 16);

const id = [...first16Bytes]
    .map((byte) => {
        const hi = byte >> 4;
        const lo = byte & 0x0f;
        return String.fromCharCode(97 + hi) + String.fromCharCode(97 + lo);
    })
    .join("");

console.log(id);