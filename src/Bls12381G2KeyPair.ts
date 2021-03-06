/*
 * Copyright 2020 - MATTR Limited
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import bs58 from "bs58";
import {
  generateBls12381KeyPair,
  blsVerify,
  blsSign
} from "@mattrglobal/node-bbs-signatures";
import {
  KeyPairOptions,
  KeyPairSigner,
  KeyPairVerifier,
  GenerateKeyPairOptions
} from "./types";

/**
 * z represents the multibase encoding scheme of base58 encoding
 * @see https://github.com/multiformats/multibase/blob/master/multibase.csv#L18
 * @ignore
 */
const MULTIBASE_ENCODED_BASE58_IDENTIFIER = "z";

/**
 * 0x01 indicates the end of the leading bytes according to variable integer spec
 * @see https://github.com/multiformats/multicodec
 * @ignore
 */
const VARIABLE_INTEGER_TRAILING_BYTE = 0x01;

/**
 * 0xeb indicates a BLS 12-381 G2 public key
 *
 */
const BLS12381G2_MULTICODEC_IDENTIFIER = 0xeb;

/**
 * @ignore
 * Returns an object with an async sign function for producing BBS+ signatures.
 * The sign function is bound to the KeyPair
 * and then returned by the KeyPair's signer method.
 * @param key - A Bls12381G2KeyPair.
 *
 * @returns An object with an async function sign
 * using the private key passed in.
 */
const signerFactory = (key: Bls12381G2KeyPair): KeyPairSigner => {
  if (!key.privateKeyBuffer) {
    return {
      async sign(): Promise<string> {
        throw new Error("No private key to sign with.");
      }
    };
  }
  return {
    async sign({ data }): Promise<string> {
      //TODO assert data runtime string | string[]
      if (typeof data === "string") {
        return Buffer.from(
          blsSign({
            messages: [data],
            keyPair: {
              secretKey: new Uint8Array(key.privateKeyBuffer as Uint8Array),
              publicKey: new Uint8Array(key.publicKeyBuffer)
            }
          })
        ).toString("base64");
      }
      return Buffer.from(
        blsSign({
          messages: data,
          keyPair: {
            secretKey: new Uint8Array(key.privateKeyBuffer as Uint8Array),
            publicKey: new Uint8Array(key.publicKeyBuffer)
          }
        })
      ).toString("base64");
    }
  };
};

/**
 * @ignore
 * Returns an object with an async verify function for verifying BBS+ signatures.
 * The verify function is bound to the KeyPair
 * and then returned by the KeyPair's verifier method.
 * @param key - A Bls12381G2KeyPair.
 *
 * @returns An async verifier specific
 * to the key passed in.
 */
const verifierFactory = (key: Bls12381G2KeyPair): KeyPairVerifier => {
  if (!key.publicKeyBuffer) {
    return {
      async verify(): Promise<boolean> {
        throw new Error("No public key to verify with.");
      }
    };
  }

  return {
    async verify({ data, signature }): Promise<boolean> {
      //TODO assert data
      if (typeof data === "string") {
        return blsVerify({
          messages: [data],
          publicKey: new Uint8Array(key.publicKeyBuffer),
          signature: new Uint8Array(Buffer.from(signature, "base64"))
        }).verified;
      }
      return blsVerify({
        messages: data,
        publicKey: new Uint8Array(key.publicKeyBuffer),
        signature: new Uint8Array(Buffer.from(signature, "base64"))
      }).verified;
    }
  };
};

/**
 * A BLS 12-381 based key pair
 */
export class Bls12381G2KeyPair {
  /**
   * The key id
   */
  readonly id?: string;
  /**
   * The key controller
   */
  readonly controller?: string;
  /**
   * Buffer containing the raw bytes of the private key
   */
  readonly privateKeyBuffer?: Uint8Array;
  /**
   * Buffer containing the raw bytes of the public key
   */
  readonly publicKeyBuffer: Uint8Array;
  /**
   * Type identifier for the key pair
   */
  readonly type: string = "Bls12381G2Key2020";

  /**
   * Default constructor.
   */
  constructor(options: KeyPairOptions) {
    //TODO need some assert statements here
    this.id = options.id;
    this.controller = options.controller;
    this.privateKeyBuffer = options.privateKeyBase58
      ? bs58.decode(options.privateKeyBase58)
      : undefined;
    this.publicKeyBuffer = bs58.decode(options.publicKeyBase58);
    //TODO assert if key pair is the wrong length?
  }

  /**
   * Generates a BLS 12-381 key pair
   * @param options [Optional] options for the key pair generation
   *
   * @returns A BLS 12-381 key pair
   */
  static async generate(
    options?: GenerateKeyPairOptions
  ): Promise<Bls12381G2KeyPair> {
    const keyPair = options?.seed
      ? generateBls12381KeyPair(options.seed)
      : generateBls12381KeyPair();
    return new Bls12381G2KeyPair({
      ...options,
      privateKeyBase58: bs58.encode(keyPair.secretKey as Uint8Array),
      publicKeyBase58: bs58.encode(keyPair.publicKey)
    });
  }

  /**
   * Constructs a BLS 12-381 key pair from options
   * @param options [Optional] options for key pair
   *
   * @returns A BLS 12-381 key pair
   */
  static async from(options: KeyPairOptions): Promise<Bls12381G2KeyPair> {
    return new Bls12381G2KeyPair(options);
  }

  /**
   * Returns a signer object for use with jsonld-signatures.
   *
   * @returns {{sign: Function}} A signer for the json-ld block.
   */
  signer(): KeyPairSigner {
    return signerFactory(this);
  }

  /**
   * Returns a verifier object for use with jsonld-signatures.
   *
   * @returns {{verify: Function}} Used to verify jsonld-signatures.
   */
  verifier(): KeyPairVerifier {
    return verifierFactory(this);
  }

  /**
   * Returns the base58 encoded public key.
   *
   * @returns The base58 encoded public key.
   */
  get publicKey(): string {
    return bs58.encode(this.publicKeyBuffer);
  }

  /**
   * Returns the base58 encoded private key.
   *
   * @returns The base58 encoded private key.
   */
  get privateKey(): string | undefined {
    if (this.privateKeyBuffer) {
      return bs58.encode(this.privateKeyBuffer);
    }
    return undefined;
  }

  /**
   * Adds a public key base to a public key node.
   *
   * @param publicKeyNode - The public key node.
   * @param publicKeyNode.publicKeyBase58 - Base58 public key.
   *
   * @returns A PublicKeyNode in a block.
   */
  addEncodedPublicKey(publicKeyNode: any): any {
    publicKeyNode.publicKeyBase58 = this.publicKey;
    return publicKeyNode;
  }

  /**
   * Generates and returns a public key fingerprint.
   *
   * @param publicKeyBase58 - The base58 encoded public key material.
   *
   * @returns The fingerprint.
   */
  static fingerprintFromPublicKey({ publicKeyBase58 }: any): string {
    const keyBytes = bs58.decode(publicKeyBase58);
    const buffer = new Uint8Array(2 + keyBytes.length);

    buffer[0] = BLS12381G2_MULTICODEC_IDENTIFIER;
    buffer[1] = VARIABLE_INTEGER_TRAILING_BYTE;
    buffer.set(keyBytes, 2);

    return `${MULTIBASE_ENCODED_BASE58_IDENTIFIER}${bs58.encode(buffer)}`;
  }

  /**
   * Generates and returns a public key fingerprint.
   *
   * @returns The fingerprint.
   */
  fingerprint(): string {
    const publicKeyBase58 = this.publicKey;
    return Bls12381G2KeyPair.fingerprintFromPublicKey({ publicKeyBase58 });
  }

  /**
   * Verifies whether the fingerprint was generated from a given key pair.
   *
   * @param fingerprint - A Base58 public key.
   *
   * @returns An object indicating valid is true or false.
   */
  verifyFingerprint(fingerprint: string): any {
    // fingerprint should have `z` prefix indicating
    // that it's multi-base encoded
    if (!(typeof fingerprint === "string" && fingerprint[0] === "z")) {
      return {
        error: new Error("`fingerprint` must be a multibase encoded string."),
        valid: false
      };
    }
    let fingerprintBuffer;
    try {
      fingerprintBuffer = bs58.decode(fingerprint.slice(1));
    } catch (e) {
      return { error: e, valid: false };
    }
    const publicKeyBuffer = new Buffer(this.publicKeyBuffer);

    // validate the first two multicodec bytes 0xeb01
    const valid =
      fingerprintBuffer.slice(0, 2).toString("hex") === "eb01" &&
      publicKeyBuffer.equals(fingerprintBuffer.slice(2));
    if (!valid) {
      return {
        error: new Error("The fingerprint does not match the public key."),
        valid: false
      };
    }
    return { valid };
  }
}
